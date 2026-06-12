-- 0023_lifecycle.sql
-- Aday yaşam döngüsü: müsait -> mülakat -> teklif/süreç -> PERSONEL (hired) -> 1 yıl sonra pasif
-- -> aday tekrar aktifleşince süreç sıfırlanıp havuza döner.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.candidate_status add column if not exists hired_at timestamptz;
alter table public.candidate_status add column if not exists work_end_at timestamptz; -- sözleşme tarihi + 1 yıl

-- ---- Havuz görünümü: PERSONEL (hired) olanları havuzdan çıkar ----
drop view if exists public.candidate_pool;
create view public.candidate_pool with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.gender, p.nationality, p.birth_year, p.positions, p.languages, p.skills
  from public.profiles p
  left join public.candidate_status cs on cs.user_id = p.user_id
  where not public.is_user_staff(p.user_id)
    and coalesce(cs.status, '') <> 'hired';
grant select on public.candidate_pool to authenticated;

-- ---- Personel görünümü (acentenin işe aldıkları) ----
drop view if exists public.candidate_hired;
create view public.candidate_hired with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.gender, p.nationality, p.birth_year, p.positions, p.languages, p.skills,
    cs.work_end_at, cs.accepted_by
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'hired';
grant select on public.candidate_hired to authenticated;

-- ---- Tüm aşamalar bitince (uçak bileti gönderilince) PERSONEL'e geç ----
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare wend timestamptz;
begin
  if new.kind = 'flight_ticket' and new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    begin
      select (to_date(issue_date, 'DD/MM/YYYY') + interval '1 year')::timestamptz
        into wend from public.contracts where user_id = new.user_id;
    exception when others then wend := null; end;
    update public.candidate_status
      set status = 'hired', hired_at = now(),
          work_end_at = coalesce(wend, now() + interval '1 year'), updated_at = now()
      where user_id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists hire_on_complete on public.user_documents;
create trigger hire_on_complete after insert or update on public.user_documents
  for each row execute function public.tg_hire_on_complete();

-- ---- Aday: tekrar çalışmaya hazır -> süreci sıfırla, havuza dön (CV kalır) ----
create or replace function public.reactivate_candidate() returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from public.contracts      where user_id = auth.uid();
  delete from public.flights        where user_id = auth.uid();
  delete from public.interviews     where user_id = auth.uid();
  delete from public.user_documents where user_id = auth.uid();
  update public.candidate_status
    set status = 'new', docs_unlocked = false, stage = 0,
        accepted_by = null, accepted_at = null, hired_at = null, work_end_at = null, updated_at = now()
    where user_id = auth.uid();
end $$;
grant execute on function public.reactivate_candidate() to authenticated;

notify pgrst, 'reload schema';
