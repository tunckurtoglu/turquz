-- 0088_agency_notice_grants.sql
-- Edge function (service_role) yazabilsin; alıcı kontrolü tablolardan yapılır.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

grant select, insert on public.agency_notices to service_role;
grant select, insert on public.agency_notice_recipients to service_role;
grant select, insert on public.notifications to service_role;
grant select on public.profiles to service_role;
grant select on public.candidate_status to service_role;
grant select on public.user_roles to service_role;

notify pgrst, 'reload schema';
