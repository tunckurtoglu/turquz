-- 0051_end_employment_and_rem5m.sql
-- Acente personel sürecini sonlandırır (havuza dönüş) + mülakat 5dk hatırlatma kolonu.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.interviews add column if not exists reminder_5m_sent_at timestamptz;

-- Slot seçilince tüm hatırlatma bayraklarını sıfırla (5dk dâhil).
create or replace function public.select_interview_slot(p_slot text) returns text
  language plpgsql security definer set search_path = public as $$
declare ag uuid; c int;
begin
  select created_by into ag from public.interviews where user_id = auth.uid();
  if ag is null then return 'no_interview'; end if;
  select count(*) into c from public.interviews
    where created_by = ag and status = 'scheduled' and selected_slot = p_slot and user_id <> auth.uid();
  if c >= 3 then return 'full'; end if;
  update public.interviews
    set selected_slot = p_slot, status = 'scheduled', updated_at = now(),
        reminder_24h_sent_at = null, reminder_1h_sent_at = null,
        reminder_15m_sent_at = null, reminder_5m_sent_at = null
    where user_id = auth.uid();
  return 'ok';
end $$;

-- Acente: personel sürecini kalıcı olarak sonlandır (aday havuza döner; belgeler/sözleşme sıfırlanır).
create or replace function public.agency_end_employment(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1 from public.candidate_status cs
    where cs.user_id = p_candidate
      and cs.status = 'hired'
      and (cs.accepted_by = auth.uid() or public.is_admin())
  ) then
    raise exception 'not_hired';
  end if;

  delete from public.contracts      where user_id = p_candidate;
  delete from public.flights        where user_id = p_candidate;
  delete from public.interviews     where user_id = p_candidate;
  delete from public.user_documents where user_id = p_candidate;
  delete from public.agency_cv_overrides where candidate_id = p_candidate;

  update public.candidate_status
    set status = 'new', docs_unlocked = false, stage = 0,
        accepted_by = null, accepted_at = null, offered_at = null,
        hired_at = null, work_end_at = null,
        docs_deadline_notified_at = null, updated_at = now()
    where user_id = p_candidate;
end $$;

revoke all on function public.agency_end_employment(uuid) from public;
grant execute on function public.agency_end_employment(uuid) to authenticated;

notify pgrst, 'reload schema';
