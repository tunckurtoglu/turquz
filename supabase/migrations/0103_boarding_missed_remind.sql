-- 0103: Uçak kaçırma sonrası acenteye sık hatırlatma (yeni iniş saati / Varışlar).
-- Aday bileti kendisi alır; acente tarihleri güncellemezse Varışlar listesinde kaybolur.

create or replace function public.scan_boarding_missed_remind()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
  r record;
begin
  for r in
    select cs.user_id, cs.accepted_by, cs.flight_depart_on, cs.work_start_at,
           coalesce(cs.boarding_answered_at, cs.updated_at) as answered_at
    from public.candidate_status cs
    where cs.status in ('hired', 'in_transit')
      and cs.boarding_status = 'missed'
      and cs.accepted_by is not null
      and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      -- İlk bildirimden biraz sonra başla
      and coalesce(cs.boarding_answered_at, cs.updated_at) <= now() - interval '4 hours'
      -- Son boarding_missed (hatırlatma dahil) üzerinden 6 saat geçmiş olsun
      and not exists (
        select 1 from public.notifications n
        where n.user_id = cs.accepted_by::uuid
          and n.type = 'boarding_missed'
          and n.ref_user = cs.user_id
          and n.created_at > now() - interval '6 hours'
      )
  loop
    perform public._employment_notify(
      r.accepted_by::uuid,
      'boarding_missed',
      r.user_id,
      jsonb_build_object(
        'candidateId', r.user_id,
        'remind', true,
        'needArriveUpdate', true,
        'flightDepartOn', r.flight_depart_on,
        'workStartAt', r.work_start_at
      )
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.scan_boarding_missed_remind() from public;
grant execute on function public.scan_boarding_missed_remind() to authenticated;
grant execute on function public.scan_boarding_missed_remind() to service_role;

notify pgrst, 'reload schema';
