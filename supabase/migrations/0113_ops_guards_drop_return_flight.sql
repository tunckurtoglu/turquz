-- 0113_ops_guards_drop_return_flight.sql
-- Kritik sahiplik/durum guard'ları + eve dönüş bileti kaldırma + offer exception'ları.
-- Çalıştırma: SQL Editor > Run (0112'den sonra).

-- ---------------------------------------------------------------------------
-- 1) Teklif: yalnız havuz / kendi teklifi; busy adaya yazılamaz
-- ---------------------------------------------------------------------------
create or replace function public.offer_candidate(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  st text;
  ag text;
begin
  if not public.is_user_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if p_candidate is null then
    raise exception 'bad_request';
  end if;
  -- Acente/admin kendisine teklif atamaz
  if public.is_user_staff(p_candidate) then
    raise exception 'not_candidate';
  end if;

  select cs.status, cs.accepted_by into st, ag
  from public.candidate_status cs
  where cs.user_id = p_candidate;

  if found then
    if st in ('accepted', 'in_transit', 'hired') then
      raise exception 'candidate_busy';
    end if;
    -- Başka acentenin açık teklifi varsa çalınamaz
    if st = 'offered' and ag is distinct from auth.uid()::text then
      raise exception 'already_offered';
    end if;
  end if;

  insert into public.candidate_status (
    user_id, docs_unlocked, stage, status, accepted_by,
    offered_at, accepted_at, docs_deadline_notified_at, updated_at
  )
  values (
    p_candidate, false, 0, 'offered', auth.uid()::text,
    now(), null, null, now()
  )
  on conflict (user_id) do update set
    docs_unlocked = false,
    stage = 0,
    status = 'offered',
    accepted_by = auth.uid()::text,
    offered_at = now(),
    accepted_at = null,
    docs_deadline_notified_at = null,
    updated_at = now();

  insert into public.notifications(user_id, type, ref_user)
  values (p_candidate, 'offer', auth.uid());
end;
$$;

grant execute on function public.offer_candidate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Kabul / red: sessiz return yerine exception
-- ---------------------------------------------------------------------------
create or replace function public.accept_offer() returns void
  language plpgsql security definer set search_path = public as $$
declare
  ag text;
begin
  select accepted_by into ag
  from public.candidate_status
  where user_id = auth.uid() and status = 'offered';

  if ag is null then
    raise exception 'no_offer';
  end if;

  update public.candidate_status set
    docs_unlocked = true,
    stage = 1,
    status = 'accepted',
    accepted_at = now(),
    docs_deadline_notified_at = null,
    updated_at = now()
  where user_id = auth.uid() and status = 'offered';

  insert into public.notifications(user_id, type, ref_user)
  values (
    (case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ag::uuid else null end),
    'offer_accepted',
    auth.uid()
  );
end;
$$;

grant execute on function public.accept_offer() to authenticated;

create or replace function public.reject_offer() returns void
  language plpgsql security definer set search_path = public as $$
declare
  ag text;
begin
  select accepted_by into ag
  from public.candidate_status
  where user_id = auth.uid() and status = 'offered';

  if ag is null then
    raise exception 'no_offer';
  end if;

  update public.candidate_status set
    docs_unlocked = false,
    stage = 0,
    status = 'new',
    accepted_by = null,
    accepted_at = null,
    offered_at = null,
    updated_at = now()
  where user_id = auth.uid() and status = 'offered';

  insert into public.notifications(user_id, type, ref_user)
  values (
    (case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ag::uuid else null end),
    'offer_rejected',
    auth.uid()
  );

  -- Ops log (0111 varsa)
  begin
    perform public._process_ops_log(
      auth.uid(), 'candidate',
      (case when ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ag::uuid else null end),
      auth.uid(),
      'offer_rejected', null, null, '{}'::jsonb
    );
  exception when undefined_function then
    null;
  end;
end;
$$;

grant execute on function public.reject_offer() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) request_reupload: yalnız sahip acente / admin
-- ---------------------------------------------------------------------------
create or replace function public.request_reupload(p_candidate uuid, p_kind text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  ag text;
begin
  if not public.is_user_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if p_candidate is null or p_kind is null or length(trim(p_kind)) = 0 then
    raise exception 'bad_request';
  end if;

  select accepted_by into ag
  from public.candidate_status
  where user_id = p_candidate;

  if not public.is_admin() then
    if ag is null or ag is distinct from auth.uid()::text then
      raise exception 'not_owner';
    end if;
  end if;

  delete from public.user_documents
  where user_id = p_candidate and kind = p_kind;

  insert into public.notifications(user_id, type, ref_user)
  values (p_candidate, 'reupload', auth.uid());
end;
$$;

grant execute on function public.request_reupload(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) waive_contract_payment: sahip acente / admin
-- ---------------------------------------------------------------------------
create or replace function public.waive_contract_payment(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;
  if p_candidate is null then
    raise exception 'bad_request';
  end if;

  if not public.is_admin() then
    if not exists (
      select 1 from public.candidate_status cs
      where cs.user_id = p_candidate
        and cs.accepted_by = auth.uid()::text
    ) and not exists (
      select 1 from public.contracts c
      where c.user_id = p_candidate
        and c.created_by = auth.uid()
    ) then
      raise exception 'forbidden';
    end if;
  end if;

  update public.contracts
     set payment_status = 'waived',
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where user_id = p_candidate;
end;
$$;

grant execute on function public.waive_contract_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Eve dönüş bileti kaldır (plan iptal)
-- ---------------------------------------------------------------------------
delete from public.user_documents where kind = 'return_flight_ticket';

alter table public.user_documents drop constraint if exists user_documents_kind_check;
alter table public.user_documents
  add constraint user_documents_kind_check
  check (kind in (
    'passport', 'diploma', 'criminal', 'health_report',
    'contract_signed', 'consulate_ref', 'work_permit',
    'contract_unsigned', 'flight_ticket',
    'success_certificate'
  ));

-- notify trigger: return_flight yok
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

-- retract: return_flight kaldırıldı
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
