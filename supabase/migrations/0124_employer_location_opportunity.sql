-- 0124_employer_location_opportunity.sql
-- Otel konumu + teklif/mülakatın hangi favori işletmeye ait olduğunun korunması.

alter table public.agency_employers
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists region text;

alter table public.interviews
  add column if not exists employer_id uuid references public.agency_employers (id) on delete set null;

alter table public.contracts
  add column if not exists employer_name text,
  add column if not exists employer_country text,
  add column if not exists employer_city text,
  add column if not exists employer_region text,
  add column if not exists employer_web_url text;

-- Teklif gönderimi sırasında favori işletmenin temel bilgilerinin hazır olmasını zorunlu kıl.
create or replace function public.tg_offer_employer_required()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'offered' and new.offer_employer_id is not null
     and not exists (
       select 1
       from public.agency_favorites f
       where f.agency_id::text = new.accepted_by
         and f.candidate_id = new.user_id
         and f.employer_id = new.offer_employer_id
     )
  then
    raise exception 'favorite_employer_mismatch';
  end if;

  if new.status = 'offered' and new.offer_employer_id is not null
     and not exists (
       select 1
       from public.agency_employers e
       where e.id = new.offer_employer_id
         and nullif(trim(e.name), '') is not null
         and nullif(trim(e.title), '') is not null
         and nullif(trim(e.address), '') is not null
         and nullif(trim(e.web_url), '') is not null
         and nullif(trim(e.country), '') is not null
         and nullif(trim(e.city), '') is not null
         and nullif(trim(e.region), '') is not null
     )
  then
    raise exception 'employer_incomplete'
      using hint = 'Complete hotel name, title, address, website, country, city and region before sending an offer';
  end if;
  return new;
end;
$$;

drop trigger if exists candidate_status_offer_employer_required on public.candidate_status;
create trigger candidate_status_offer_employer_required
before insert or update of status, offer_employer_id on public.candidate_status
for each row execute function public.tg_offer_employer_required();

-- Yeni mülakat teklifleri yalnızca adayın acente favorilerindeki işletmeyle açılır.
create or replace function public.agency_propose_interview(
  p_candidate uuid,
  p_employer uuid,
  p_slots jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employer uuid;
begin
  if not public.is_user_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if p_candidate is null then
    raise exception 'bad_request';
  end if;

  select f.employer_id
    into v_employer
  from public.agency_favorites f
  where f.agency_id = auth.uid()
    and f.candidate_id = p_candidate
  limit 1;

  if v_employer is null then
    raise exception 'favorite_required';
  end if;
  if p_employer is not null and p_employer is distinct from v_employer then
    raise exception 'favorite_employer_mismatch';
  end if;

  if not exists (
    select 1
    from public.agency_employers e
    where e.id = v_employer
      and e.agency_id = auth.uid()
      and nullif(trim(e.name), '') is not null
      and nullif(trim(e.title), '') is not null
      and nullif(trim(e.address), '') is not null
      and nullif(trim(e.web_url), '') is not null
      and nullif(trim(e.country), '') is not null
      and nullif(trim(e.city), '') is not null
      and nullif(trim(e.region), '') is not null
  ) then
    raise exception 'employer_incomplete';
  end if;

  insert into public.interviews (
    user_id, created_by, employer_id, status, slots, selected_slot,
    call_extra_secs, reminder_24h_sent_at, reminder_1h_sent_at,
    reminder_15m_sent_at, reminder_5m_sent_at, updated_at
  )
  values (
    p_candidate, auth.uid(), v_employer, 'proposed', coalesce(p_slots, '[]'::jsonb), null,
    0, null, null, null, null, now()
  )
  on conflict (user_id) do update set
    created_by = excluded.created_by,
    employer_id = excluded.employer_id,
    status = excluded.status,
    slots = excluded.slots,
    selected_slot = null,
    call_extra_secs = 0,
    reminder_24h_sent_at = null,
    reminder_1h_sent_at = null,
    reminder_15m_sent_at = null,
    reminder_5m_sent_at = null,
    updated_at = now();
end;
$$;

grant execute on function public.agency_propose_interview(uuid, uuid, jsonb) to authenticated;

-- Aday uygulaması hassas işveren tablosuna doğrudan erişmeden fırsat özetini alır.
-- Ödeme öncesinde yalnızca sansürlü ad + açık konum; ödeme sonrasında açık ad.
create or replace function public.candidate_offer_employer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_country text;
  v_city text;
  v_region text;
  v_paid boolean := false;
begin
  if auth.uid() is null then
    return null;
  end if;

  select coalesce(nullif(trim(e.name), ''), nullif(trim(e.title), '')),
         nullif(trim(e.country), ''),
         nullif(trim(e.city), ''),
         nullif(trim(e.region), '')
    into v_name, v_country, v_city, v_region
  from public.candidate_status cs
  join public.agency_employers e on e.id = cs.offer_employer_id
  where cs.user_id = auth.uid()
    and cs.status = 'offered'
    and e.agency_id::text = cs.accepted_by
  limit 1;

  if v_name is null then
    return null;
  end if;

  select public.contract_is_paid(c.payment_status)
    into v_paid
  from public.contracts c
  where c.user_id = auth.uid();

  return jsonb_build_object(
    'kind', 'offer',
    'displayName', case
      when coalesce(v_paid, false) then v_name
      else upper(left(v_name, 1)) || '...'
    end,
    'country', v_country,
    'city', v_city,
    'region', v_region,
    'revealed', coalesce(v_paid, false)
  );
end;
$$;

create or replace function public.candidate_interview_employer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_country text;
  v_city text;
  v_region text;
  v_paid boolean := false;
begin
  if auth.uid() is null then
    return null;
  end if;

  select coalesce(nullif(trim(e.name), ''), nullif(trim(e.title), '')),
         nullif(trim(e.country), ''),
         nullif(trim(e.city), ''),
         nullif(trim(e.region), '')
    into v_name, v_country, v_city, v_region
  from public.interviews i
  join public.agency_employers e on e.id = i.employer_id
  where i.user_id = auth.uid()
    and i.status in ('proposed', 'scheduled')
    and e.agency_id = i.created_by
  order by i.updated_at desc
  limit 1;

  if v_name is null then
    return null;
  end if;

  select public.contract_is_paid(c.payment_status)
    into v_paid
  from public.contracts c
  where c.user_id = auth.uid();

  return jsonb_build_object(
    'kind', 'interview',
    'displayName', case
      when coalesce(v_paid, false) then v_name
      else upper(left(v_name, 1)) || '...'
    end,
    'country', v_country,
    'city', v_city,
    'region', v_region,
    'revealed', coalesce(v_paid, false)
  );
end;
$$;

grant execute on function public.candidate_offer_employer() to authenticated;
grant execute on function public.candidate_interview_employer() to authenticated;

-- Sözleşme bedeli ödendikten sonra adayın çalışacağı işletmenin güvenli özeti.
create or replace function public.candidate_contract_employer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select jsonb_build_object(
    'kind', 'contract',
    'displayName', coalesce(nullif(trim(c.employer_name), ''), nullif(trim(e.name), ''), nullif(trim(e.title), '')),
    'title', c.title,
    'address', c.address,
    'country', coalesce(c.employer_country, e.country),
    'city', coalesce(c.employer_city, e.city),
    'region', coalesce(c.employer_region, e.region),
    'phone', c.phone,
    'email', c.email,
    'webUrl', coalesce(c.employer_web_url, e.web_url),
    'revealed', true
  )
    into v
  from public.contracts c
  join public.agency_employers e on e.id = c.employer_id
  where c.user_id = auth.uid()
    and e.agency_id = c.created_by
    and public.contract_is_paid(c.payment_status)
  limit 1;

  return v;
end;
$$;

grant execute on function public.candidate_contract_employer() to authenticated;

notify pgrst, 'reload schema';
