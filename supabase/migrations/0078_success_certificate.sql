-- 0078_success_certificate.sql
-- Turquz başarı sertifikası: sezon sonu resmi belge. Yalnız admin yükler;
-- aday ve acente belgeler ekranında 7. adım olarak görür / indirir.

alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents
  add constraint user_documents_kind_check
  check (kind in (
    'passport', 'diploma', 'criminal', 'health_report',
    'contract_signed', 'consulate_ref', 'work_permit',
    'contract_unsigned', 'flight_ticket',
    'success_certificate'
  ));

create or replace function public.tg_success_certificate_admin_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.kind is not distinct from 'success_certificate' and not public.is_admin() then
      raise exception 'success_certificate_admin_only';
    end if;
    return old;
  end if;
  if new.kind is not distinct from 'success_certificate' and not public.is_admin() then
    raise exception 'success_certificate_admin_only';
  end if;
  return new;
end;
$$;

drop trigger if exists success_certificate_admin_only on public.user_documents;
create trigger success_certificate_admin_only
  before insert or update or delete on public.user_documents
  for each row execute function public.tg_success_certificate_admin_only();

-- Sertifika gönderilince adayı (ve varsa acenteyi) bildir.
create or replace function public.tg_documents_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ag uuid;
  step1_kinds text[] := array['passport', 'diploma', 'criminal', 'health_report'];
  step1_done int;
begin
  if new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    if new.kind = any(step1_kinds) then
      select count(*)::int into step1_done
        from public.user_documents
        where user_id = new.user_id and kind = any(step1_kinds) and submitted_at is not null;
      if step1_done < array_length(step1_kinds, 1) then return new; end if;
      if new.kind <> 'health_report' then return new; end if;
    end if;

    if new.kind in ('contract_unsigned', 'flight_ticket', 'success_certificate') then
      insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'document', new.user_id);
      if new.kind = 'success_certificate' then
        select case when accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    then accepted_by::uuid else null end
          into ag from public.candidate_status where user_id = new.user_id;
        if ag is not null then
          insert into public.notifications(user_id, type, ref_user) values (ag, 'document', new.user_id);
        end if;
      end if;
    else
      select case when accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  then accepted_by::uuid else null end
        into ag from public.candidate_status where user_id = new.user_id;
      if ag is not null then
        insert into public.notifications(user_id, type, ref_user) values (ag, 'document', new.user_id);
      end if;
    end if;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
