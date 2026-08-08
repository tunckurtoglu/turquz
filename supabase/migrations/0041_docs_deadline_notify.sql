-- 0041_docs_deadline_notify.sql
-- İlk belge paketi (10 gün) süresi dolunca acenteye tek seferlik bildirim bayrağı.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.candidate_status add column if not exists docs_deadline_notified_at timestamptz;

-- Teklif gönderilirken bayrağı sıfırla.
create or replace function public.offer_candidate(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_user_staff(auth.uid()) then return; end if;
  insert into public.candidate_status (user_id, docs_unlocked, stage, status, accepted_by, offered_at, accepted_at, docs_deadline_notified_at, updated_at)
    values (p_candidate, false, 0, 'offered', auth.uid()::text, now(), null, null, now())
  on conflict (user_id) do update set
    docs_unlocked = false, stage = 0, status = 'offered',
    accepted_by = auth.uid()::text, offered_at = now(), accepted_at = null,
    docs_deadline_notified_at = null, updated_at = now();
  insert into public.notifications(user_id, type, ref_user) values (p_candidate, 'offer', auth.uid());
end $$;

-- Aday kabul edince yeni süre başlar; bayrak sıfırlanır.
create or replace function public.accept_offer() returns void
  language plpgsql security definer set search_path = public as $$
declare ag text;
begin
  select accepted_by into ag from public.candidate_status where user_id = auth.uid() and status = 'offered';
  if ag is null then return; end if;
  update public.candidate_status set
    docs_unlocked = true, stage = 1, status = 'accepted', accepted_at = now(),
    docs_deadline_notified_at = null, updated_at = now()
    where user_id = auth.uid();
  insert into public.notifications(user_id, type, ref_user)
    values ((case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ag::uuid else null end), 'offer_accepted', auth.uid());
end $$;

-- Aday tekrar aktifleşince bayrak temizlenir.
create or replace function public.reactivate_candidate() returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from public.contracts      where user_id = auth.uid();
  delete from public.flights        where user_id = auth.uid();
  delete from public.interviews     where user_id = auth.uid();
  delete from public.user_documents where user_id = auth.uid();
  update public.candidate_status
    set status = 'new', docs_unlocked = false, stage = 0,
        accepted_by = null, accepted_at = null, hired_at = null, work_end_at = null,
        docs_deadline_notified_at = null, updated_at = now()
    where user_id = auth.uid();
end $$;

notify pgrst, 'reload schema';
