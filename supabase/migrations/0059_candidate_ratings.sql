-- 0059_candidate_ratings.sql
-- Acente/otel, çalıştığı adaya 1–5 puan verir (disiplin, iletişim, tekrar çalışır mıyım).
-- Ortalama + sayı havuzda TÜM acentelere açıktır.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- Kim kimi işe aldı (süreç bitince de kalır → puanlama hakkı sürer).
create table if not exists public.agency_employment_log (
  agency_id    uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null references auth.users (id) on delete cascade,
  hired_at     timestamptz not null default now(),
  ended_at     timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (agency_id, candidate_id)
);

alter table public.agency_employment_log enable row level security;

drop policy if exists agency_employment_log_select_own on public.agency_employment_log;
create policy agency_employment_log_select_own
  on public.agency_employment_log for select to authenticated
  using (agency_id = auth.uid() or public.is_admin());

-- Mevcut personelleri log'a yaz
insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
select cs.accepted_by::uuid, cs.user_id, coalesce(cs.hired_at, cs.accepted_at, now()), null
from public.candidate_status cs
where cs.status = 'hired'
  and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (agency_id, candidate_id) do update
  set hired_at = least(agency_employment_log.hired_at, excluded.hired_at),
      ended_at = null,
      updated_at = now();

-- Puanlar (acente başına bir kayıt; güncellenebilir)
create table if not exists public.candidate_ratings (
  agency_id      uuid not null references auth.users (id) on delete cascade,
  candidate_id   uuid not null references auth.users (id) on delete cascade,
  discipline     smallint not null check (discipline between 1 and 5),
  communication  smallint not null check (communication between 1 and 5),
  rehire         smallint not null check (rehire between 1 and 5),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (agency_id, candidate_id)
);

create index if not exists candidate_ratings_candidate_idx
  on public.candidate_ratings (candidate_id);

alter table public.candidate_ratings enable row level security;

-- Acente: bu adayı işe almış / almış mı?
create or replace function public.agency_can_rate_candidate(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    and p_candidate is not null
    and (
      exists (
        select 1 from public.candidate_status cs
        where cs.user_id = p_candidate
          and cs.status = 'hired'
          and cs.accepted_by = auth.uid()::text
      )
      or exists (
        select 1 from public.agency_employment_log el
        where el.agency_id = auth.uid()
          and el.candidate_id = p_candidate
      )
    );
$$;

revoke all on function public.agency_can_rate_candidate(uuid) from public;
grant execute on function public.agency_can_rate_candidate(uuid) to authenticated;

drop policy if exists candidate_ratings_select on public.candidate_ratings;
create policy candidate_ratings_select
  on public.candidate_ratings for select to authenticated
  using (public.is_staff() or candidate_id = auth.uid());

drop policy if exists candidate_ratings_insert on public.candidate_ratings;
create policy candidate_ratings_insert
  on public.candidate_ratings for insert to authenticated
  with check (agency_id = auth.uid() and public.agency_can_rate_candidate(candidate_id));

drop policy if exists candidate_ratings_update on public.candidate_ratings;
create policy candidate_ratings_update
  on public.candidate_ratings for update to authenticated
  using (agency_id = auth.uid() and public.agency_can_rate_candidate(candidate_id))
  with check (agency_id = auth.uid() and public.agency_can_rate_candidate(candidate_id));

-- Havuz özeti (ortalam + sayı) — staff + kendi adayı
create or replace view public.candidate_rating_stats
with (security_invoker = on) as
select
  candidate_id,
  round(avg((discipline + communication + rehire) / 3.0)::numeric, 1) as avg_score,
  count(*)::int as rating_count
from public.candidate_ratings
group by candidate_id;

grant select on public.candidate_rating_stats to authenticated;

-- İşe alınınca log
create or replace function public.tg_hire_on_complete() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  wend timestamptz;
  ag text;
begin
  if new.kind = 'flight_ticket' and new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    begin
      select (to_date(issue_date, 'DD/MM/YYYY') + interval '1 year')::timestamptz
        into wend from public.contracts where user_id = new.user_id;
    exception when others then wend := null; end;

    update public.candidate_status
      set status = 'hired', hired_at = now(),
          work_end_at = coalesce(wend, now() + interval '1 year'), updated_at = now()
      where user_id = new.user_id
      returning accepted_by into ag;

    if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
      values (ag::uuid, new.user_id, now(), null)
      on conflict (agency_id, candidate_id) do update
        set ended_at = null, hired_at = coalesce(agency_employment_log.hired_at, excluded.hired_at), updated_at = now();
    end if;
  end if;
  return new;
end $$;

-- Süreç sonunca log'u kapat (puan hakkı kalsın)
create or replace function public.agency_end_employment(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  ag uuid := auth.uid();
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  if not exists (
    select 1 from public.candidate_status cs
    where cs.user_id = p_candidate
      and cs.status = 'hired'
      and (cs.accepted_by = auth.uid()::text or public.is_admin())
  ) then
    raise exception 'not_hired';
  end if;

  insert into public.agency_employment_log (agency_id, candidate_id, hired_at, ended_at)
  select
    coalesce(nullif(cs.accepted_by, '')::uuid, ag),
    cs.user_id,
    coalesce(cs.hired_at, now()),
    now()
  from public.candidate_status cs
  where cs.user_id = p_candidate
    and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  on conflict (agency_id, candidate_id) do update
    set ended_at = now(), updated_at = now();

  delete from public.contracts      where user_id = p_candidate;
  delete from public.flights        where user_id = p_candidate;
  delete from public.interviews     where user_id = p_candidate;
  delete from public.user_documents where user_id = p_candidate;
  delete from public.agency_cv_overrides where candidate_id = p_candidate;

  update public.candidate_status
    set status = 'new', docs_unlocked = false, stage = 0,
        accepted_by = null, accepted_at = null, offered_at = null,
        hired_at = null, work_end_at = null,
        docs_deadline_notified_at = null, updated_at = now()
    where user_id = p_candidate;
end $$;

revoke all on function public.agency_end_employment(uuid) from public;
grant execute on function public.agency_end_employment(uuid) to authenticated;

-- Aday kendi reaktive ederse de log kapanır
create or replace function public.reactivate_candidate() returns void
  language plpgsql security definer set search_path = public as $$
begin
  update public.agency_employment_log
    set ended_at = coalesce(ended_at, now()), updated_at = now()
    where candidate_id = auth.uid() and ended_at is null;

  delete from public.contracts      where user_id = auth.uid();
  delete from public.flights        where user_id = auth.uid();
  delete from public.interviews     where user_id = auth.uid();
  delete from public.user_documents where user_id = auth.uid();
  update public.candidate_status
    set status = 'new', docs_unlocked = false, stage = 0,
        accepted_by = null, accepted_at = null, hired_at = null, work_end_at = null, updated_at = now()
    where user_id = auth.uid();
end $$;

grant execute on function public.reactivate_candidate() to authenticated;

notify pgrst, 'reload schema';
