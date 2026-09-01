-- 0111_docs_deadlines_and_ops_audit.sql
-- İlk belge 14 gün · konsolosluk ref 7 gün · acente +3 / süreç sonlandır · ispat ops log.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- ─── Sütunlar ───────────────────────────────────────────────────────────────
alter table public.candidate_status
  add column if not exists docs_agency_extra_at timestamptz;

alter table public.candidate_status
  add column if not exists consulate_deadline_at timestamptz;

alter table public.candidate_status
  add column if not exists consulate_agency_extra_at timestamptz;

alter table public.candidate_status
  add column if not exists consulate_deadline_notified_at timestamptz;

-- ─── Ops audit (ispat kaydı) ────────────────────────────────────────────────
create table if not exists public.process_ops_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  actor_id      uuid,
  actor_role    text not null check (actor_role in ('candidate', 'agency', 'admin', 'system')),
  agency_id     uuid,
  candidate_id  uuid,
  event_type    text not null,
  reason        text,
  note          text,
  meta          jsonb not null default '{}'::jsonb
);

create index if not exists process_ops_log_created_idx
  on public.process_ops_log (created_at desc);
create index if not exists process_ops_log_candidate_idx
  on public.process_ops_log (candidate_id, created_at desc);
create index if not exists process_ops_log_agency_idx
  on public.process_ops_log (agency_id, created_at desc);
create index if not exists process_ops_log_event_idx
  on public.process_ops_log (event_type, created_at desc);

alter table public.process_ops_log enable row level security;

drop policy if exists process_ops_log_admin_select on public.process_ops_log;
create policy process_ops_log_admin_select on public.process_ops_log
  for select to authenticated
  using (public.is_admin());

revoke all on table public.process_ops_log from public;
grant select on table public.process_ops_log to authenticated;
grant insert on table public.process_ops_log to service_role;

create or replace function public._process_ops_log(
  p_actor uuid,
  p_actor_role text,
  p_agency uuid,
  p_candidate uuid,
  p_event text,
  p_reason text default null,
  p_note text default null,
  p_meta jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  insert into public.process_ops_log (
    actor_id, actor_role, agency_id, candidate_id, event_type, reason, note, meta
  ) values (
    p_actor, coalesce(nullif(trim(p_actor_role), ''), 'system'),
    p_agency, p_candidate, p_event, p_reason, p_note, coalesce(p_meta, '{}'::jsonb)
  ) returning id into rid;
  return rid;
end;
$$;

revoke all on function public._process_ops_log(uuid, text, uuid, uuid, text, text, text, jsonb) from public;

-- ─── accepted_at sync: 14 gün + konsolosluk alanlarını temizle ───────────────
create or replace function public.candidate_status_docs_deadline_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.accepted_at is not null and new.docs_deadline_at is null then
      new.docs_deadline_at := new.accepted_at + interval '14 days';
    end if;
    return new;
  end if;

  if new.accepted_at is distinct from old.accepted_at then
    if new.accepted_at is null then
      new.docs_deadline_at := null;
      new.docs_extra_requested_at := null;
      new.docs_agency_extra_at := null;
      new.docs_deadline_notified_at := null;
      new.consulate_deadline_at := null;
      new.consulate_agency_extra_at := null;
      new.consulate_deadline_notified_at := null;
    else
      new.docs_deadline_at := new.accepted_at + interval '14 days';
      new.docs_extra_requested_at := null;
      new.docs_agency_extra_at := null;
      new.docs_deadline_notified_at := null;
      new.consulate_deadline_at := null;
      new.consulate_agency_extra_at := null;
      new.consulate_deadline_notified_at := null;
    end if;
  end if;
  return new;
end;
$$;

-- Aktif süreçlerde 10→14 (ek süre yoksa ve hâlâ eski 10 günlük pencereyse)
update public.candidate_status
set docs_deadline_at = accepted_at + interval '14 days'
where accepted_at is not null
  and status = 'accepted'
  and docs_extra_requested_at is null
  and docs_agency_extra_at is null
  and docs_deadline_at is not null
  and docs_deadline_at <= accepted_at + interval '10 days 2 hours';

-- ─── İmzalı sözleşme → konsolosluk 7 gün başlar ────────────────────────────
create or replace function public.user_documents_consulate_deadline_start()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ag text;
begin
  if new.kind is distinct from 'contract_signed' then
    return new;
  end if;
  if new.submitted_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then
    return new;
  end if;

  update public.candidate_status
  set consulate_deadline_at = coalesce(consulate_deadline_at, new.submitted_at + interval '7 days'),
      consulate_deadline_notified_at = case
        when consulate_deadline_at is null then null
        else consulate_deadline_notified_at
      end,
      updated_at = now()
  where user_id = new.user_id
    and status = 'accepted'
    and consulate_deadline_at is null
  returning accepted_by into ag;

  if found then
    perform public._process_ops_log(
      new.user_id, 'candidate',
      case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ag::uuid else null end,
      new.user_id,
      'consulate_deadline_started',
      null, null,
      jsonb_build_object('from', 'contract_signed', 'deadlineAt', (new.submitted_at + interval '7 days'))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_documents_consulate_deadline on public.user_documents;
create trigger trg_user_documents_consulate_deadline
  after insert or update of submitted_at
  on public.user_documents
  for each row execute function public.user_documents_consulate_deadline_start();

-- Backfill: imzalı sözleşme var, konsolosluk yok
update public.candidate_status cs
set consulate_deadline_at = d.submitted_at + interval '7 days',
    updated_at = now()
from public.user_documents d
where d.user_id = cs.user_id
  and d.kind = 'contract_signed'
  and d.submitted_at is not null
  and cs.status = 'accepted'
  and cs.consulate_deadline_at is null
  and not exists (
    select 1 from public.user_documents c
    where c.user_id = cs.user_id and c.kind = 'consulate_ref' and c.submitted_at is not null
  );

-- ─── Aday +3 (14 gün fallback) + ops log ───────────────────────────────────
create or replace function public.request_docs_extra_time()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.candidate_status%rowtype;
  ag uuid;
  done int;
  new_end timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into st from public.candidate_status where user_id = uid for update;
  if not found then raise exception 'not_eligible'; end if;
  if st.status <> 'accepted' or st.accepted_at is null then raise exception 'not_eligible'; end if;
  if st.docs_extra_requested_at is not null then raise exception 'already_requested'; end if;

  select count(*) into done
    from public.user_documents
    where user_id = uid
      and kind in ('passport', 'diploma', 'criminal', 'health_report')
      and submitted_at is not null;
  if coalesce(done, 0) >= 4 then raise exception 'not_eligible'; end if;

  new_end := greatest(
    coalesce(st.docs_deadline_at, st.accepted_at + interval '14 days'),
    now()
  ) + interval '3 days';

  update public.candidate_status
  set docs_deadline_at = new_end,
      docs_extra_requested_at = now(),
      docs_deadline_notified_at = null,
      updated_at = now()
  where user_id = uid;

  ag := case
    when st.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then st.accepted_by::uuid
    else null
  end;
  if ag is not null then
    insert into public.notifications (user_id, type, ref_user)
    values (ag, 'docs_extra', uid);
  end if;

  perform public._process_ops_log(
    uid, 'candidate', ag, uid,
    'docs_extra_candidate', null, null,
    jsonb_build_object('newDeadline', new_end, 'days', 3)
  );

  return new_end;
end;
$$;

-- ─── Acente: +3 gün (docs veya consulate) ──────────────────────────────────
create or replace function public.agency_grant_deadline_extra(
  p_candidate uuid,
  p_scope text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid := auth.uid();
  st public.candidate_status%rowtype;
  scope text := lower(trim(p_scope));
  new_end timestamptz;
  done int;
begin
  if aid is null then raise exception 'not_authenticated'; end if;
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null then raise exception 'bad_request'; end if;
  if scope not in ('docs', 'consulate') then raise exception 'bad_scope'; end if;

  select * into st from public.candidate_status where user_id = p_candidate for update;
  if not found then raise exception 'not_found'; end if;
  if st.status <> 'accepted' then raise exception 'not_eligible'; end if;
  if st.accepted_by is distinct from aid::text then raise exception 'forbidden'; end if;

  if scope = 'docs' then
    if st.docs_agency_extra_at is not null then raise exception 'already_granted'; end if;
    select count(*) into done from public.user_documents
      where user_id = p_candidate
        and kind in ('passport', 'diploma', 'criminal', 'health_report')
        and submitted_at is not null;
    if coalesce(done, 0) >= 4 then raise exception 'not_eligible'; end if;

    new_end := greatest(
      coalesce(st.docs_deadline_at, st.accepted_at + interval '14 days'),
      now()
    ) + interval '3 days';

    update public.candidate_status
    set docs_deadline_at = new_end,
        docs_agency_extra_at = now(),
        docs_deadline_notified_at = null,
        updated_at = now()
    where user_id = p_candidate;

    insert into public.notifications (user_id, type, ref_user)
    values (p_candidate, 'docs_agency_extra', aid);

    perform public._process_ops_log(
      aid, 'agency', aid, p_candidate,
      'docs_extra_agency', null, null,
      jsonb_build_object('newDeadline', new_end, 'days', 3)
    );
  else
    if st.consulate_agency_extra_at is not null then raise exception 'already_granted'; end if;
    if st.consulate_deadline_at is null then raise exception 'not_eligible'; end if;
    select count(*) into done from public.user_documents
      where user_id = p_candidate and kind = 'consulate_ref' and submitted_at is not null;
    if coalesce(done, 0) >= 1 then raise exception 'not_eligible'; end if;

    new_end := greatest(st.consulate_deadline_at, now()) + interval '3 days';

    update public.candidate_status
    set consulate_deadline_at = new_end,
        consulate_agency_extra_at = now(),
        consulate_deadline_notified_at = null,
        updated_at = now()
    where user_id = p_candidate;

    insert into public.notifications (user_id, type, ref_user)
    values (p_candidate, 'consulate_agency_extra', aid);

    perform public._process_ops_log(
      aid, 'agency', aid, p_candidate,
      'consulate_extra_agency', null, null,
      jsonb_build_object('newDeadline', new_end, 'days', 3)
    );
  end if;

  return new_end;
end;
$$;

revoke all on function public.agency_grant_deadline_extra(uuid, text) from public;
grant execute on function public.agency_grant_deadline_extra(uuid, text) to authenticated;

-- ─── Acente: süreci sonlandır (havuza dön + sebep log) ─────────────────────
create or replace function public.agency_end_process(
  p_candidate uuid,
  p_reason text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid := auth.uid();
  st public.candidate_status%rowtype;
  reason text := lower(trim(p_reason));
begin
  if aid is null then raise exception 'not_authenticated'; end if;
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_candidate is null then raise exception 'bad_request'; end if;
  if reason not in ('docs_deadline', 'consulate_deadline', 'agency_cancel', 'offer_withdraw') then
    raise exception 'bad_reason';
  end if;

  select * into st from public.candidate_status where user_id = p_candidate for update;
  if not found then raise exception 'not_found'; end if;

  if st.status in ('hired', 'in_transit') then
    raise exception 'use_employment_end';
  end if;
  if st.accepted_by is not null and st.accepted_by is distinct from aid::text then
    raise exception 'forbidden';
  end if;

  begin
    perform public.close_process_chat(p_candidate);
  exception when others then
    update public.process_chats
    set closed_at = now()
    where candidate_id = p_candidate and closed_at is null;
  end;

  delete from public.user_documents where user_id = p_candidate;
  delete from public.contracts where user_id = p_candidate;
  delete from public.flights where user_id = p_candidate;
  delete from public.interviews where user_id = p_candidate;

  update public.candidate_status
  set docs_unlocked = false,
      stage = 0,
      status = 'new',
      accepted_by = null,
      accepted_at = null,
      offered_at = null,
      hired_at = null,
      work_end_at = null,
      docs_deadline_notified_at = null,
      updated_at = now()
  where user_id = p_candidate;

  perform public._process_ops_log(
    aid, 'agency', aid, p_candidate,
    'process_end', reason, nullif(trim(p_note), ''),
    jsonb_build_object(
      'prevStatus', st.status,
      'prevAcceptedAt', st.accepted_at,
      'prevDocsDeadline', st.docs_deadline_at,
      'prevConsulateDeadline', st.consulate_deadline_at
    )
  );

  insert into public.notifications (user_id, type, ref_user)
  values (p_candidate, 'process_ended', aid);
end;
$$;

revoke all on function public.agency_end_process(uuid, text, text) from public;
grant execute on function public.agency_end_process(uuid, text, text) to authenticated;

-- Teklif / kabul log (status değişimi)
create or replace function public.candidate_status_ops_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ag uuid;
begin
  if tg_op <> 'UPDATE' then return new; end if;

  if new.status is distinct from old.status then
    ag := case
      when new.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then new.accepted_by::uuid
      when old.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then old.accepted_by::uuid
      else null
    end;

    if new.status = 'offered' and old.status is distinct from 'offered' then
      perform public._process_ops_log(
        ag, 'agency', ag, new.user_id, 'offer_sent', null, null,
        jsonb_build_object('offeredAt', new.offered_at)
      );
    elsif new.status = 'accepted' and old.status is distinct from 'accepted' then
      perform public._process_ops_log(
        new.user_id, 'candidate', ag, new.user_id, 'offer_accepted', null, null,
        jsonb_build_object('acceptedAt', new.accepted_at, 'docsDeadline', new.docs_deadline_at)
      );
    elsif old.status in ('offered', 'accepted') and new.status = 'new'
          and new.accepted_by is null and old.accepted_by is not null then
      -- agency_end_process zaten loglar; çift kayıt olmasın diye burada atla
      null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_candidate_status_ops_audit on public.candidate_status;
create trigger trg_candidate_status_ops_audit
  after update of status
  on public.candidate_status
  for each row execute function public.candidate_status_ops_audit();

-- Belge gönderim logu
create or replace function public.user_documents_ops_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ag text;
  role_txt text;
begin
  if new.submitted_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then return new; end if;

  select accepted_by into ag from public.candidate_status where user_id = new.user_id;
  role_txt := case
    when new.kind in ('contract_unsigned', 'flight_ticket', 'return_flight_ticket') then 'agency'
    else 'candidate'
  end;

  perform public._process_ops_log(
    auth.uid(), role_txt,
    case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ag::uuid else null end,
    new.user_id,
    'doc_submitted',
    null, null,
    jsonb_build_object('kind', new.kind, 'submittedAt', new.submitted_at)
  );
  return new;
end;
$$;

drop trigger if exists trg_user_documents_ops_audit on public.user_documents;
create trigger trg_user_documents_ops_audit
  after insert or update of submitted_at
  on public.user_documents
  for each row execute function public.user_documents_ops_audit();

-- Admin liste RPC
create or replace function public.admin_list_process_ops(
  p_limit int default 200,
  p_candidate uuid default null,
  p_agency uuid default null,
  p_event text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  actor_id uuid,
  actor_role text,
  agency_id uuid,
  candidate_id uuid,
  event_type text,
  reason text,
  note text,
  meta jsonb,
  candidate_title text,
  candidate_reg_no int,
  agency_company text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.created_at, l.actor_id, l.actor_role, l.agency_id, l.candidate_id,
    l.event_type, l.reason, l.note, l.meta,
    coalesce(nullif(trim(cp.data->>'fullName'), ''), nullif(trim(cp.data->>'name'), ''), 'Aday') as candidate_title,
    cp.reg_no as candidate_reg_no,
    coalesce(nullif(trim(ap.data->>'company'), ''), nullif(trim(ap.data->>'agencyName'), ''), 'Acente') as agency_company
  from public.process_ops_log l
  left join public.profiles cp on cp.user_id = l.candidate_id
  left join public.profiles ap on ap.user_id = l.agency_id
  where public.is_admin()
    and (p_candidate is null or l.candidate_id = p_candidate)
    and (p_agency is null or l.agency_id = p_agency)
    and (p_event is null or p_event = '' or l.event_type = p_event)
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke all on function public.admin_list_process_ops(int, uuid, uuid, text) from public;
grant execute on function public.admin_list_process_ops(int, uuid, uuid, text) to authenticated;

-- Sistem: süre dolumu log (edge function çağırır)
create or replace function public.log_deadline_notified(
  p_candidate uuid,
  p_scope text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st public.candidate_status%rowtype;
  ag uuid;
  scope text := lower(trim(p_scope));
begin
  if scope not in ('docs', 'consulate') then raise exception 'bad_scope'; end if;
  select * into st from public.candidate_status where user_id = p_candidate;
  if not found then return; end if;
  ag := case
    when st.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then st.accepted_by::uuid else null end;
  perform public._process_ops_log(
    null, 'system', ag, p_candidate,
    case when scope = 'docs' then 'docs_deadline_warned' else 'consulate_deadline_warned' end,
    scope, null,
    jsonb_build_object(
      'deadlineAt', case when scope = 'docs' then st.docs_deadline_at else st.consulate_deadline_at end
    )
  );
end;
$$;

revoke all on function public.log_deadline_notified(uuid, text) from public;
grant execute on function public.log_deadline_notified(uuid, text) to service_role;

notify pgrst, 'reload schema';
