-- 0100: Acente kendi gönderdiği belgeyi geri alabilir (sözleşme / uçak bileti).
-- Yanlış PDF sonrası tüm süreci silmek yerine son acente adımını açar.
-- Çalıştırma: SQL Editor > Run (0099'dan sonra).

create or replace function public.retract_agency_doc(p_candidate uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
  ag text;
  kinds text[];
begin
  if not public.is_user_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;

  if p_kind is null or p_kind not in ('contract_unsigned', 'flight_ticket') then
    raise exception 'invalid_kind';
  end if;

  select status, accepted_by into st, ag
  from public.candidate_status
  where user_id = p_candidate;

  if ag is null or ag <> auth.uid()::text then
    if not public.is_admin() then
      raise exception 'not_owner';
    end if;
  end if;

  if st = 'hired' then
    raise exception 'already_hired';
  end if;

  if p_kind = 'contract_unsigned' then
    -- Uçuş sonrası sözleşmeyi geri almak süreci bozar.
    if exists (
      select 1 from public.user_documents
      where user_id = p_candidate and kind = 'flight_ticket' and submitted_at is not null
    ) then
      raise exception 'flight_already_sent';
    end if;
    if st = 'in_transit' then
      raise exception 'in_transit';
    end if;
    kinds := array['contract_unsigned', 'contract_signed'];
  else
    kinds := array['flight_ticket'];
  end if;

  delete from public.user_documents
  where user_id = p_candidate and kind = any(kinds);

  if p_kind = 'flight_ticket' and st = 'in_transit' then
    update public.candidate_status
      set status = 'accepted',
          hired_at = null,
          boarding_status = null,
          boarding_asked_at = null,
          boarding_answered_at = null,
          work_start_asked_at = null,
          work_start_remind_count = 0,
          updated_at = now()
      where user_id = p_candidate;

    -- Karşılama iletimini de geri al (tarihler / varış saati kalır).
    update public.flights
      set pickup_sent_at = null,
          updated_at = now()
      where user_id = p_candidate;
  end if;

  insert into public.notifications(user_id, type, ref_user, payload)
  values (
    p_candidate,
    'agency_doc_retracted',
    auth.uid(),
    jsonb_build_object('kind', p_kind)
  );
end $$;

grant execute on function public.retract_agency_doc(uuid, text) to authenticated;

-- Gönderilmiş uçak bileti PDF yolu değişince adaya in-app bildirim.
create or replace function public.tg_agency_flight_replaced() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'flight_ticket'
     and new.submitted_at is not null
     and old.storage_path is distinct from new.storage_path then
    insert into public.notifications(user_id, type, ref_user, payload)
    values (
      new.user_id,
      'flight_ticket_updated',
      auth.uid(),
      jsonb_build_object('kind', 'flight_ticket')
    );
  end if;
  return new;
end $$;

drop trigger if exists agency_flight_replaced on public.user_documents;
create trigger agency_flight_replaced
  after update of storage_path on public.user_documents
  for each row execute function public.tg_agency_flight_replaced();

notify pgrst, 'reload schema';
