-- 0031_offer_flow.sql
-- TEKLİF AKIŞI (iki adımlı):
--   1) Acente TEKLİF gönderir -> status='offered'. Belgeler KİLİTLİ kalır, aday "Süreçte"ye DÜŞMEZ.
--   2) Aday KABUL ederse -> status='accepted', belgeler açılır, "Süreçte"ye düşer, acenteye bildirim.
--      Aday REDDEDERSE -> havuza döner (status='new'), acenteye bildirim.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.candidate_status add column if not exists offered_at timestamptz;

-- --- Acente: TEKLİF gönder (yalnız staff). Belgeler AÇILMAZ; aday cevaplayana kadar bekler. ---
create or replace function public.offer_candidate(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_user_staff(auth.uid()) then return; end if;
  insert into public.candidate_status (user_id, docs_unlocked, stage, status, accepted_by, offered_at, accepted_at, updated_at)
    values (p_candidate, false, 0, 'offered', auth.uid()::text, now(), null, now())
  on conflict (user_id) do update set
    docs_unlocked = false, stage = 0, status = 'offered',
    accepted_by = auth.uid()::text, offered_at = now(), accepted_at = null, updated_at = now();
  insert into public.notifications(user_id, type, ref_user) values (p_candidate, 'offer', auth.uid());
end $$;
grant execute on function public.offer_candidate(uuid) to authenticated;

-- --- Aday: teklifi KABUL et (kendi durumu). Belgeler açılır + Süreçte + acenteye bildirim. ---
create or replace function public.accept_offer() returns void
  language plpgsql security definer set search_path = public as $$
declare ag text;
begin
  select accepted_by into ag from public.candidate_status where user_id = auth.uid() and status = 'offered';
  if ag is null then return; end if;  -- bekleyen teklif yok
  update public.candidate_status set
    docs_unlocked = true, stage = 1, status = 'accepted', accepted_at = now(), updated_at = now()
    where user_id = auth.uid();
  insert into public.notifications(user_id, type, ref_user)
    values ((case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ag::uuid else null end), 'offer_accepted', auth.uid());
end $$;
grant execute on function public.accept_offer() to authenticated;

-- --- Aday: teklifi REDDET. Havuza döner (kilitli) + acenteye bildirim. ---
create or replace function public.reject_offer() returns void
  language plpgsql security definer set search_path = public as $$
declare ag text;
begin
  select accepted_by into ag from public.candidate_status where user_id = auth.uid() and status = 'offered';
  if ag is null then return; end if;
  update public.candidate_status set
    docs_unlocked = false, stage = 0, status = 'new', accepted_by = null, accepted_at = null, offered_at = null, updated_at = now()
    where user_id = auth.uid();
  insert into public.notifications(user_id, type, ref_user)
    values ((case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ag::uuid else null end), 'offer_rejected', auth.uid());
end $$;
grant execute on function public.reject_offer() to authenticated;

notify pgrst, 'reload schema';
