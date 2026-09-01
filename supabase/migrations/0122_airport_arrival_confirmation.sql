-- 0122_airport_arrival_confirmation.sql
-- Adaydan kalkıştan bir saat önce havaalanına geldi teyidi alınır.

alter table public.flights
  add column if not exists depart_at_ts timestamptz;

alter table public.candidate_status
  add column if not exists airport_check_status text
    check (airport_check_status is null or airport_check_status in ('pending', 'confirmed', 'missed', 'no_response')),
  add column if not exists airport_check_asked_at timestamptz,
  add column if not exists airport_check_answered_at timestamptz,
  add column if not exists airport_check_remind_count integer not null default 0,
  add column if not exists airport_check_last_answer text
    check (airport_check_last_answer is null or airport_check_last_answer in ('confirmed', 'not_yet')),
  add column if not exists airport_check_negative_notified_at timestamptz;

-- Eski uçuş kayıtlarında bilinen tarih/saat biçimlerini doldur.
update public.flights f
set depart_at_ts = make_timestamptz(
  matched[3]::integer,
  matched[2]::integer,
  matched[1]::integer,
  coalesce(matched[4], '0')::integer,
  coalesce(matched[5], '0')::integer,
  0,
  'Europe/Istanbul'
)
from public.flights source
cross join lateral regexp_matches(
  trim(source.depart_at),
  '^([0-9]{1,2})[./]([0-9]{1,2})[./]([0-9]{4})(?:[ T]([0-9]{1,2}):([0-9]{2}))?'
) as matched
where f.depart_at_ts is null
  and f.depart_at is not null
  and f.user_id = source.user_id;

-- Bilet yeniden yüklendiğinde teyit akışı yeniden başlar.
create or replace function public.tg_airport_check_init()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'flight_ticket' then
      update public.candidate_status
      set airport_check_status = null,
          airport_check_asked_at = null,
          airport_check_answered_at = null,
          airport_check_remind_count = 0,
          airport_check_last_answer = null,
          airport_check_negative_notified_at = null,
          updated_at = now()
      where user_id = old.user_id;
    end if;
    return old;
  end if;

  if new.kind = 'flight_ticket' and new.submitted_at is not null then
    update public.candidate_status
    set airport_check_status = 'pending',
        airport_check_asked_at = null,
        airport_check_answered_at = null,
        airport_check_remind_count = 0,
        airport_check_last_answer = null,
        airport_check_negative_notified_at = null,
        -- Eski kalkış günü sorusu artık havaalanı teyidiyle değiştirildi.
        boarding_status = null,
        updated_at = now()
    where user_id = new.user_id
      and status in ('hired', 'in_transit');
  end if;
  return new;
end;
$$;

drop trigger if exists user_documents_airport_check_init on public.user_documents;
create trigger user_documents_airport_check_init
after insert or delete or update of submitted_at, storage_path on public.user_documents
for each row execute function public.tg_airport_check_init();

-- Mevcut, henüz teyit akışına alınmamış uçuşları başlat.
update public.candidate_status cs
set airport_check_status = 'pending',
    airport_check_remind_count = 0,
    airport_check_last_answer = null,
    airport_check_negative_notified_at = null,
    boarding_status = null,
    updated_at = now()
from public.flights f
where f.user_id = cs.user_id
  and f.depart_at_ts is not null
  and cs.status in ('hired', 'in_transit')
  and cs.airport_check_status is null;

-- Transfer kartında teyit durumunu aktif personel görünümünde de taşı.
drop view if exists public.candidate_hired;
create view public.candidate_hired with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    p.turquz_certified,
    cs.work_end_at, cs.accepted_by,
    cs.airport_check_status, cs.airport_check_answered_at, cs.airport_check_last_answer
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'hired';
grant select on public.candidate_hired to authenticated;

drop view if exists public.candidate_in_transit;
create view public.candidate_in_transit with (security_invoker = on) as
  select p.user_id, p.title, p.reg_no,
    (p.data - 'email' - 'phone' - 'phoneConfirm' - 'location' - 'passportNo' - 'family') as data,
    p.updated_at, p.last_seen_at, p.gender, p.nationality, p.birth_year,
    p.positions, p.languages, p.skills,
    p.employment_status, p.work_availability,
    p.turquz_certified,
    cs.work_start_at, cs.flight_depart_on, cs.planned_end_on, cs.boarding_status,
    cs.accepted_by, cs.work_start_asked_at, cs.work_start_remind_count,
    cs.airport_check_status, cs.airport_check_asked_at, cs.airport_check_answered_at, cs.airport_check_last_answer
  from public.profiles p
  join public.candidate_status cs on cs.user_id = p.user_id
  where cs.status = 'in_transit';
grant select on public.candidate_in_transit to authenticated;

-- Dakikalık scan-ops çağrısından çalışır. İlk soru T-60, sonra T-45/T-30/T-15.
create or replace function public.scan_airport_arrival_checks()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  asked_count integer := 0;
  late_count integer := 0;
  v_now timestamptz := now();
begin
  for r in
    select cs.user_id,
           cs.accepted_by,
           cs.airport_check_status,
           cs.airport_check_asked_at,
           cs.airport_check_remind_count,
           f.depart_at_ts
    from public.candidate_status cs
    join public.flights f on f.user_id = cs.user_id
    where cs.status in ('hired', 'in_transit')
      and cs.airport_check_status = 'pending'
      and f.depart_at_ts is not null
  loop
    -- Uçuş saati geldi, son bildirimden sonra hâlâ olumlu teyit yok.
    if v_now >= r.depart_at_ts then
      update public.candidate_status
      set airport_check_status = 'no_response',
          updated_at = now()
      where user_id = r.user_id
        and airport_check_status = 'pending';

      if found and r.accepted_by is not null
         and r.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        perform public._employment_notify(
          r.accepted_by::uuid,
          'airport_check_late',
          r.user_id,
          jsonb_build_object(
            'candidateId', r.user_id,
            'reason', 'no_response',
            'departAt', r.depart_at_ts
          )
        );
        late_count := late_count + 1;
      end if;
      continue;
    end if;

    -- T-60 ile kalkış arasında en fazla dört soru: 60, 45, 30 ve 15 dakika.
    if v_now >= r.depart_at_ts - interval '1 hour'
       and (r.airport_check_asked_at is null
         or r.airport_check_asked_at <= v_now - interval '15 minutes')
       and coalesce(r.airport_check_remind_count, 0) < 4 then
      update public.candidate_status
      set airport_check_asked_at = now(),
          airport_check_remind_count = coalesce(airport_check_remind_count, 0) + 1,
          updated_at = now()
      where user_id = r.user_id
        and airport_check_status = 'pending';

      if found then
        perform public._employment_notify(
          r.user_id,
          'airport_check',
          nullif(r.accepted_by, '')::uuid,
          jsonb_build_object(
            'candidateId', r.user_id,
            'departAt', r.depart_at_ts,
            'attempt', coalesce(r.airport_check_remind_count, 0) + 1
          )
        );
        asked_count := asked_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('asked', asked_count, 'late', late_count);
end;
$$;

revoke all on function public.scan_airport_arrival_checks() from public;
grant execute on function public.scan_airport_arrival_checks() to authenticated;

-- Adayın havaalanına geldi cevabı.
create or replace function public.candidate_answer_airport_check(p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ag text;
  ans text := lower(trim(p_answer));
  cur_status text;
  cur_check text;
  depart_ts timestamptz;
  negative_notified timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if ans not in ('confirmed', 'not_yet', 'missed') then raise exception 'bad_answer'; end if;
  if ans = 'missed' then ans := 'not_yet'; end if;

  select cs.status, cs.airport_check_status, f.depart_at_ts
    into cur_status, cur_check, depart_ts
  from public.candidate_status cs
  left join public.flights f on f.user_id = cs.user_id
  where cs.user_id = uid
  for update of cs;

  if cur_status is null
     or cur_status not in ('hired', 'in_transit')
     or cur_check <> 'pending' then
    raise exception 'airport_check_not_pending';
  end if;

  if depart_ts is not null and now() >= depart_ts then
    raise exception 'airport_check_closed';
  end if;

  update public.candidate_status
  set airport_check_status = case when ans = 'confirmed' then 'confirmed' else 'pending' end,
      airport_check_answered_at = case when ans = 'confirmed' then now() else airport_check_answered_at end,
      airport_check_last_answer = ans,
      airport_check_negative_notified_at = case
        when ans = 'confirmed' then airport_check_negative_notified_at
        when airport_check_negative_notified_at is null then now()
        else airport_check_negative_notified_at
      end,
      updated_at = now()
  where user_id = uid
    and airport_check_status = 'pending'
  returning accepted_by, airport_check_negative_notified_at into ag, negative_notified;

  if ans = 'not_yet' and negative_notified is not null
     and negative_notified > now() - interval '2 seconds'
     and ag is not null
     and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform public._employment_notify(
      ag::uuid,
      'airport_check_warning',
      uid,
      jsonb_build_object(
        'candidateId', uid,
        'reason', 'candidate_not_yet',
        'departAt', depart_ts
      )
    );
  elsif ans = 'confirmed'
     and ag is not null
     and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform public._employment_notify(
      ag::uuid,
      'airport_check_confirmed',
      uid,
      jsonb_build_object('candidateId', uid, 'reason', 'candidate_confirmed')
    );
  end if;
end;
$$;

revoke all on function public.candidate_answer_airport_check(text) from public;
grant execute on function public.candidate_answer_airport_check(text) to authenticated;

notify pgrst, 'reload schema';
