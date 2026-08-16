-- 0080_docs_extra_time.sql
-- İlk belge paketi için somut son tarih + adayın bir kez +3 gün ek süre talebi.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.candidate_status
  add column if not exists docs_deadline_at timestamptz;

alter table public.candidate_status
  add column if not exists docs_extra_requested_at timestamptz;

update public.candidate_status
set docs_deadline_at = accepted_at + interval '10 days'
where accepted_at is not null
  and docs_deadline_at is null;

-- Teklif kabul / geri çek / yeniden kabul: accepted_at değişince süreyi sıfırla.
create or replace function public.candidate_status_docs_deadline_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.accepted_at is not null and new.docs_deadline_at is null then
      new.docs_deadline_at := new.accepted_at + interval '10 days';
    end if;
    return new;
  end if;

  if new.accepted_at is distinct from old.accepted_at then
    if new.accepted_at is null then
      new.docs_deadline_at := null;
      new.docs_extra_requested_at := null;
    else
      new.docs_deadline_at := new.accepted_at + interval '10 days';
      new.docs_extra_requested_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_candidate_status_docs_deadline on public.candidate_status;
create trigger trg_candidate_status_docs_deadline
  before insert or update of accepted_at
  on public.candidate_status
  for each row execute function public.candidate_status_docs_deadline_sync();

-- Aday: ilk paket tamam değilse bir kez +3 gün (süre dolmuşsa şimdiden itibaren).
create or replace function public.request_docs_extra_time()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  st public.candidate_status%rowtype;
  ag uuid;
  done int;
  new_end timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into st from public.candidate_status where user_id = uid for update;
  if not found then raise exception 'not_eligible'; end if;
  if st.status <> 'accepted' or st.accepted_at is null then raise exception 'not_eligible'; end if;
  if st.docs_extra_requested_at is not null then raise exception 'already_requested'; end if;

  select count(*) into done
  from public.user_documents
  where user_id = uid
    and kind in ('passport', 'diploma', 'criminal', 'health_report')
    and submitted_at is not null;
  if coalesce(done, 0) >= 4 then raise exception 'not_eligible'; end if;

  new_end := greatest(
    coalesce(st.docs_deadline_at, st.accepted_at + interval '10 days'),
    now()
  ) + interval '3 days';

  update public.candidate_status
  set docs_deadline_at = new_end,
      docs_extra_requested_at = now(),
      docs_deadline_notified_at = null,
      updated_at = now()
  where user_id = uid;

  ag := case
    when st.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then st.accepted_by::uuid
    else null
  end;
  if ag is not null then
    insert into public.notifications (user_id, type, ref_user)
    values (ag, 'docs_extra', uid);
  end if;

  return new_end;
end;
$$;

revoke all on function public.request_docs_extra_time() from public;
grant execute on function public.request_docs_extra_time() to authenticated;

notify pgrst, 'reload schema';
