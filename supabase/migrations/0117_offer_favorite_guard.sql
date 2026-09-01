-- 0117_offer_favorite_guard.sql
-- Teklif: aday önce işletme favorisinde olmalı; offer_employer_id kaydedilir.

alter table public.candidate_status
  add column if not exists offer_employer_id uuid references public.agency_employers (id) on delete set null;

create or replace function public.offer_candidate(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  st text;
  ag text;
  emp uuid;
begin
  if not public.is_user_staff(auth.uid()) then
    raise exception 'forbidden';
  end if;
  if p_candidate is null then
    raise exception 'bad_request';
  end if;
  if public.is_user_staff(p_candidate) then
    raise exception 'not_candidate';
  end if;

  if not exists (
    select 1 from public.agency_favorites f
    where f.agency_id = auth.uid() and f.candidate_id = p_candidate
  ) then
    raise exception 'favorite_required';
  end if;

  select f.employer_id into emp
  from public.agency_favorites f
  where f.agency_id = auth.uid() and f.candidate_id = p_candidate
  limit 1;

  select cs.status, cs.accepted_by into st, ag
  from public.candidate_status cs
  where cs.user_id = p_candidate;

  if found then
    if st in ('accepted', 'in_transit', 'hired') then
      raise exception 'candidate_busy';
    end if;
    if st = 'offered' and ag is distinct from auth.uid()::text then
      raise exception 'already_offered';
    end if;
  end if;

  insert into public.candidate_status (
    user_id, docs_unlocked, stage, status, accepted_by,
    offered_at, accepted_at, docs_deadline_notified_at, offer_employer_id, updated_at
  )
  values (
    p_candidate, false, 0, 'offered', auth.uid()::text,
    now(), null, null, emp, now()
  )
  on conflict (user_id) do update set
    docs_unlocked = false,
    stage = 0,
    status = 'offered',
    accepted_by = auth.uid()::text,
    offered_at = now(),
    accepted_at = null,
    docs_deadline_notified_at = null,
    offer_employer_id = emp,
    updated_at = now();

  insert into public.notifications(user_id, type, ref_user)
  values (p_candidate, 'offer', auth.uid());
end;
$$;

grant execute on function public.offer_candidate(uuid) to authenticated;

notify pgrst, 'reload schema';
