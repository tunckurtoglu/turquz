-- 0063_rating_breakdown.sql
-- Havuz özetine 3 kırılım ortalaması: disiplin / iletişim / tekrar.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

drop view if exists public.candidate_rating_stats;

create view public.candidate_rating_stats
with (security_invoker = on) as
select
  candidate_id,
  round(avg((discipline + communication + rehire) / 3.0)::numeric, 1) as avg_score,
  round(avg(discipline)::numeric, 1) as avg_discipline,
  round(avg(communication)::numeric, 1) as avg_communication,
  round(avg(rehire)::numeric, 1) as avg_rehire,
  count(*)::int as rating_count
from public.candidate_ratings
group by candidate_id;

grant select on public.candidate_rating_stats to authenticated;

notify pgrst, 'reload schema';
