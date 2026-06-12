-- 0008_candidate_pool.sql
-- Aday havuzundan acente/admin profillerini gizle.
-- Havuz artık 'profiles' yerine 'candidate_pool' görünümünden okunur; bu görünüm
-- rolü agency/admin olan kullanıcıların profillerini hariç tutar.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- Verilen kullanıcı acente/admin mi? (RLS'yi aşmak için SECURITY DEFINER)
create or replace function public.is_user_staff(uid uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = uid and role in ('agency', 'admin'));
$$;

-- security_invoker=on: alt tablo (profiles) RLS'i çağıran kullanıcıya göre uygulanır
-- (acente hepsini görür), WHERE ise personel profillerini eler.
create or replace view public.candidate_pool with (security_invoker = on) as
  select user_id, full_name, title, data, updated_at
  from public.profiles
  where not public.is_user_staff(user_id);

grant select on public.candidate_pool to authenticated;

notify pgrst, 'reload schema';
