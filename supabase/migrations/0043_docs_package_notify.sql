-- 0043_docs_package_notify.sql
-- İlk belge paketi (4 belge) tek seferde gönderilir; zil bildirimi de tek satır olsun.
-- Çalıştırma: Supabase > SQL Editor > Run.

create or replace function public.tg_documents_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ag uuid;
  step1_kinds text[] := array['passport', 'diploma', 'criminal', 'health_report'];
  step1_done int;
begin
  if new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    -- Adım 1 paketi: 4 belgenin hepsi gönderilince yalnızca bir kez bildir (health_report satırında).
    if new.kind = any(step1_kinds) then
      select count(*)::int into step1_done
        from public.user_documents
        where user_id = new.user_id and kind = any(step1_kinds) and submitted_at is not null;
      if step1_done < array_length(step1_kinds, 1) then return new; end if;
      if new.kind <> 'health_report' then return new; end if;
    end if;

    if new.kind in ('contract_unsigned', 'flight_ticket') then
      insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'document', new.user_id);
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
