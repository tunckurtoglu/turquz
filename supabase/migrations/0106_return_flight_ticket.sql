-- 0106: Eve dönüş bileti (return_flight_ticket) + kariyer 8/9. adım.
-- Çalıştırma: SQL Editor > Run (0105'ten sonra).

alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents
  add constraint user_documents_kind_check
  check (kind in (
    'passport', 'diploma', 'criminal', 'health_report',
    'contract_signed', 'consulate_ref', 'work_permit',
    'contract_unsigned', 'flight_ticket',
    'success_certificate',
    'return_flight_ticket'
  ));

-- Dönüş bileti: acente yükler → adaya bildirim
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

    if new.kind in ('contract_unsigned', 'flight_ticket', 'success_certificate', 'return_flight_ticket') then
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

-- Acente dönüş biletini geri alabilir (hire/transit etkilemez)
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

  if p_kind is null or p_kind not in ('contract_unsigned', 'flight_ticket', 'return_flight_ticket') then
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

  if p_kind = 'return_flight_ticket' then
    kinds := array['return_flight_ticket'];
    delete from public.user_documents
    where user_id = p_candidate and kind = any(kinds);

    insert into public.notifications(user_id, type, ref_user, payload)
    values (
      p_candidate,
      'agency_doc_retracted',
      auth.uid(),
      jsonb_build_object('kind', p_kind)
    );
    return;
  end if;

  if st = 'hired' then
    raise exception 'already_hired';
  end if;

  if p_kind = 'contract_unsigned' then
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
end;
$$;

notify pgrst, 'reload schema';
