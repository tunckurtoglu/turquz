-- 0089_agency_notice_insert_rls.sql
-- Acente JWT ile yazabilsin (service_role başlığı düşerse de insert çalışsın).
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

grant select, insert, update on public.agency_notices to authenticated;
grant select, insert on public.agency_notice_recipients to authenticated;
grant insert on public.notifications to authenticated;

grant select, insert, update on public.agency_notices to service_role;
grant select, insert on public.agency_notice_recipients to service_role;
grant select, insert on public.notifications to service_role;

drop policy if exists agency_notices_insert_own on public.agency_notices;
create policy agency_notices_insert_own on public.agency_notices
  for insert
  to authenticated
  with check (agency_id = auth.uid() and public.is_staff());

drop policy if exists agency_notices_update_own on public.agency_notices;
create policy agency_notices_update_own on public.agency_notices
  for update
  to authenticated
  using (agency_id = auth.uid() and public.is_staff())
  with check (agency_id = auth.uid() and public.is_staff());

drop policy if exists agency_notice_recipients_insert on public.agency_notice_recipients;
create policy agency_notice_recipients_insert on public.agency_notice_recipients
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.agency_notices n
      where n.id = notice_id
        and n.agency_id = auth.uid()
        and public.is_staff()
    )
  );

drop policy if exists notifications_agency_notice_insert on public.notifications;
create policy notifications_agency_notice_insert on public.notifications
  for insert
  to authenticated
  with check (type = 'agency_notice' and public.is_staff());

notify pgrst, 'reload schema';
