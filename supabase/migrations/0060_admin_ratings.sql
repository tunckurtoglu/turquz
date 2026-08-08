-- 0060_admin_ratings.sql
-- Admin: aday puanlarını ve istihdam logunu tam görür / düzenler / siler.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

-- Puanlar: admin her şeyi yapabilir (acente politikaları OR ile kalır).
drop policy if exists candidate_ratings_admin_all on public.candidate_ratings;
create policy candidate_ratings_admin_all
  on public.candidate_ratings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- İstihdam logu: admin tam erişim (puan hakkı / denetim).
drop policy if exists agency_employment_log_admin_all on public.agency_employment_log;
create policy agency_employment_log_admin_all
  on public.agency_employment_log
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admin: adayın tüm puanları + acente özeti (tek sorgu).
create or replace function public.admin_list_candidate_ratings(p_candidate uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  out jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.updated_at desc), '[]'::jsonb)
  into out
  from (
    select
      r.agency_id,
      r.candidate_id,
      r.discipline,
      r.communication,
      r.rehire,
      r.created_at,
      r.updated_at,
      round(((r.discipline + r.communication + r.rehire) / 3.0)::numeric, 1) as avg_score,
      coalesce(ap.company_name, au.email, r.agency_id::text) as agency_label,
      au.email as agency_email
    from public.candidate_ratings r
    left join auth.users au on au.id = r.agency_id
    left join public.agency_profiles ap on ap.user_id = r.agency_id
    where r.candidate_id = p_candidate
  ) x;

  return out;
end $$;

revoke all on function public.admin_list_candidate_ratings(uuid) from public;
grant execute on function public.admin_list_candidate_ratings(uuid) to authenticated;

notify pgrst, 'reload schema';
