-- 0029_fix_notify_uuid.sql
-- DÜZELTME: candidate_status.accepted_by TEXT iken notifications.ref_user UUID.
-- Trigger'lar accepted_by'ı doğrudan uuid sütununa yazınca "type uuid but expression is text" hatası
-- veriyordu (teklif gönderince). Güvenli cast: geçerli uuid değilse null.
-- Çalıştırma: Supabase > SQL Editor > Run.

-- Teklif kabul (docs_unlocked true) -> adaya 'accepted' bildirimi.
create or replace function public.tg_status_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare ref uuid;
begin
  if new.docs_unlocked is true and (tg_op = 'INSERT' or old.docs_unlocked is distinct from true) then
    ref := case when new.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then new.accepted_by::uuid else null end;
    insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'accepted', ref);
  end if;
  return new;
end $$;

-- Belge gönderimi -> karşı tarafa 'document' bildirimi (alıcı = accepted_by acente, güvenli cast).
create or replace function public.tg_documents_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare ag uuid;
begin
  if new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
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
