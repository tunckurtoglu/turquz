-- 0062_ratings_test_close.sql
-- Deneme bitti: puanlama hakkı yine sadece işe alan / almış acenteye.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

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

notify pgrst, 'reload schema';
