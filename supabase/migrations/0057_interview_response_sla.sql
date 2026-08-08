-- 0057_interview_response_sla.sql
-- Mülakat daveti yanıt SLA'sı (48s), aday reddi, cevapsızlık + geçici pasif (3 ignore → 7 gün).
-- Çalıştırma: Supabase > SQL Editor > Run.

-- ---- Kolonlar ----
alter table public.interviews
  add column if not exists respond_by timestamptz,
  add column if not exists response_reminded_at timestamptz,
  add column if not exists no_response_notified_at timestamptz;

alter table public.profiles
  add column if not exists iv_ignore_streak int not null default 0,
  add column if not exists pool_passive_until timestamptz;

-- Mevcut açık davetler: 48 saatlik yanıt penceresi
update public.interviews
set respond_by = coalesce(respond_by, created_at + interval '48 hours')
where status = 'proposed' and respond_by is null;

-- proposed olunca SLA sıfırla / ayarla; pasif adaya yeni davet engelle
create or replace function public.tg_interviews_response_sla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  until_at timestamptz;
begin
  if new.status = 'proposed'
     and (tg_op = 'INSERT'
          or old.status is distinct from 'proposed'
          or old.slots is distinct from new.slots) then
    select pool_passive_until into until_at
      from public.profiles where user_id = new.user_id;
    if until_at is not null and until_at > now() then
      raise exception 'candidate_passive';
    end if;
    new.respond_by := now() + interval '48 hours';
    new.response_reminded_at := null;
    new.no_response_notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists interviews_response_sla on public.interviews;
create trigger interviews_response_sla
  before insert or update on public.interviews
  for each row execute function public.tg_interviews_response_sla();

-- Aday: mülakat davetini reddet (ceza yok; ignore streak sıfırlanır)
create or replace function public.candidate_decline_interview()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ag uuid;
  nat text;
  reg int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select created_by into ag
    from public.interviews
   where user_id = auth.uid() and status = 'proposed';
  if ag is null then
    return;
  end if;

  select nationality, reg_no into nat, reg
    from public.profiles where user_id = auth.uid();

  update public.profiles
     set iv_ignore_streak = 0
   where user_id = auth.uid();

  insert into public.notifications(user_id, type, ref_user, payload)
  values (
    ag,
    'interview_declined',
    auth.uid(),
    jsonb_build_object(
      'nationality', coalesce(nat, ''),
      'reg_no', reg
    )
  );

  delete from public.interviews where user_id = auth.uid();
end;
$$;

revoke all on function public.candidate_decline_interview() from public;
grant execute on function public.candidate_decline_interview() to authenticated;

-- Slot seçince ignore streak sıfırla
create or replace function public.select_interview_slot(p_slot text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  ag uuid;
  c int;
  proposed jsonb;
  slot_ts timestamptz;
begin
  select created_by, slots into ag, proposed
    from public.interviews where user_id = auth.uid();
  if ag is null then return 'no_interview'; end if;

  if proposed is null
     or jsonb_typeof(proposed) <> 'array'
     or not exists (
       select 1 from jsonb_array_elements_text(proposed) s where s = p_slot
     ) then
    return 'invalid';
  end if;

  begin
    if p_slot ~ '^\d{2}\.\d{2}\.\d{4} ' then
      slot_ts := to_timestamp(p_slot, 'DD.MM.YYYY HH24:MI');
    else
      slot_ts := p_slot::timestamptz;
    end if;
  exception when others then
    return 'invalid';
  end;
  if slot_ts < now() - interval '2 minutes' then
    return 'past';
  end if;

  select count(*) into c from public.interviews
    where created_by = ag and status = 'scheduled' and selected_slot = p_slot and user_id <> auth.uid();
  if c >= 3 then return 'full'; end if;

  update public.interviews
    set selected_slot = p_slot, status = 'scheduled', updated_at = now(),
        reminder_24h_sent_at = null, reminder_1h_sent_at = null,
        reminder_15m_sent_at = null, reminder_5m_sent_at = null
    where user_id = auth.uid();

  update public.profiles
     set iv_ignore_streak = 0
   where user_id = auth.uid();

  return 'ok';
end $$;

-- Havuz: geçici pasif adayları gizle
drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability
  from public.profiles p
  left join public.candidate_status cs on cs.user_id = p.user_id
  where not public.is_user_staff(p.user_id)
    and coalesce(cs.status, '') <> 'hired'
    and (p.pool_passive_until is null or p.pool_passive_until <= now());
grant select on public.candidate_pool to authenticated;

notify pgrst, 'reload schema';
