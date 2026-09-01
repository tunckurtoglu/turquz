-- 0123_admin_airport_check_queue.sql
-- Admin operasyon merkezi: havaalanı teyidi bekleyen adaylar ve temas kayıtları.

create table if not exists public.airport_check_admin_actions (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references auth.users (id) on delete cascade,
  admin_id     uuid not null references auth.users (id) on delete restrict,
  action       text not null check (action in ('whatsapp_opened', 'contacted', 'resolved', 'reopened')),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists airport_check_admin_actions_candidate_idx
  on public.airport_check_admin_actions (candidate_id, created_at desc);

alter table public.airport_check_admin_actions enable row level security;
drop policy if exists airport_check_admin_actions_admin_select on public.airport_check_admin_actions;
create policy airport_check_admin_actions_admin_select
  on public.airport_check_admin_actions
  for select to authenticated
  using (public.is_admin());

drop policy if exists airport_check_admin_actions_admin_insert on public.airport_check_admin_actions;
create policy airport_check_admin_actions_admin_insert
  on public.airport_check_admin_actions
  for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

revoke all on table public.airport_check_admin_actions from public;
grant select, insert on public.airport_check_admin_actions to authenticated;

create index if not exists candidate_status_airport_check_idx
  on public.candidate_status (airport_check_status, updated_at desc);

create index if not exists flights_depart_at_ts_idx
  on public.flights (depart_at_ts);

create or replace function public.admin_list_airport_checks(p_limit integer default 200)
returns table (
  candidate_id             uuid,
  candidate_name           text,
  candidate_reg_no         integer,
  candidate_phone          text,
  agency_id                uuid,
  agency_company           text,
  agency_phone             text,
  flight_depart_at         timestamptz,
  flight_depart_label      text,
  flight_no                text,
  airport_status           text,
  last_answer              text,
  asked_at                 timestamptz,
  answered_at              timestamptz,
  remind_count             integer,
  minutes_to_departure     integer,
  alert_level              text,
  last_admin_action        text,
  last_admin_note          text,
  last_admin_action_at     timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    cs.user_id,
    coalesce(
      nullif(trim(p.full_name), ''),
      nullif(trim(concat_ws(' ', p.data->>'firstName', p.data->>'lastName')), ''),
      'İsimsiz aday'
    ),
    p.reg_no,
    coalesce(nullif(trim(p.data->>'phone'), ''), nullif(trim(p.data->>'phoneNumber'), '')),
    case
      when cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then cs.accepted_by::uuid
      else null
    end,
    ap.company_name,
    ap.phone_authorized,
    f.depart_at_ts,
    f.depart_at,
    f.flight_no,
    cs.airport_check_status,
    cs.airport_check_last_answer,
    cs.airport_check_asked_at,
    cs.airport_check_answered_at,
    coalesce(cs.airport_check_remind_count, 0),
    floor(extract(epoch from (f.depart_at_ts - now())) / 60)::integer,
    case
      when cs.airport_check_status in ('no_response', 'missed') then 'critical'
      when cs.airport_check_last_answer = 'not_yet' then 'warning'
      else 'pending'
    end,
    la.action,
    la.note,
    la.created_at
  from public.candidate_status cs
  join public.flights f on f.user_id = cs.user_id
  join public.profiles p on p.user_id = cs.user_id
  left join auth.users au
    on cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and au.id = cs.accepted_by::uuid
  left join public.agency_profiles ap on ap.user_id = au.id
  left join lateral (
    select a.action, a.note, a.created_at
    from public.airport_check_admin_actions a
    where a.candidate_id = cs.user_id
    order by a.created_at desc
    limit 1
  ) la on true
  where cs.status in ('hired', 'in_transit')
    and cs.airport_check_status in ('pending', 'missed', 'no_response')
    and (
      cs.airport_check_status in ('missed', 'no_response')
      or f.depart_at_ts <= now() + interval '1 hour'
    )
    and not (la.action = 'resolved' and la.created_at >= cs.updated_at)
  order by
    case
      when cs.airport_check_status in ('no_response', 'missed') then 0
      when cs.airport_check_last_answer = 'not_yet' then 1
      else 2
    end,
    f.depart_at_ts nulls last
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

revoke all on function public.admin_list_airport_checks(integer) from public;
grant execute on function public.admin_list_airport_checks(integer) to authenticated;

create or replace function public.admin_airport_check_action(
  p_candidate uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_candidate is null then raise exception 'candidate_required'; end if;
  if p_action not in ('whatsapp_opened', 'contacted', 'resolved', 'reopened') then
    raise exception 'bad_action';
  end if;

  insert into public.airport_check_admin_actions(candidate_id, admin_id, action, note)
  values (p_candidate, auth.uid(), p_action, nullif(trim(p_note), ''));
end;
$$;

revoke all on function public.admin_airport_check_action(uuid, text, text) from public;
grant execute on function public.admin_airport_check_action(uuid, text, text) to authenticated;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  return jsonb_build_object(
    'agencies', (select count(*)::int from public.user_roles where role = 'agency'),
    'candidates', (
      select count(*)::int from public.profiles p
      where not exists (
        select 1 from public.user_roles ur
        where ur.user_id = p.user_id and ur.role in ('agency', 'admin')
      )
    ),
    'admins', (select count(*)::int from public.user_roles where role = 'admin'),
    'hotels', 0,
    'airport_checks', (select count(*)::int from public.admin_list_airport_checks(500))
  );
end;
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

notify pgrst, 'reload schema';
