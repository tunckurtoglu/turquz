-- 0102: Uçuş teyidi sorusu / cevabı yalnızca kalkış günü (TR) ve sonrasında.
-- Bilet yüklenince boarding_status=pending olur; UI + RPC kalkış gününe kadar soruyu açmaz.
-- Bildirim taraması zaten flight_depart_on <= today koşuluyla çalışıyordu.

create or replace function public.candidate_answer_boarding(p_answer text)
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
  cur_board text;
  gate date;
  today_tr date := (timezone('Europe/Istanbul', now()))::date;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if ans not in ('confirmed', 'missed') then raise exception 'bad_answer'; end if;

  select cs.status, cs.boarding_status, coalesce(cs.flight_depart_on, cs.work_start_at)
    into cur_status, cur_board, gate
  from public.candidate_status cs
  where cs.user_id = uid;

  if cur_status is null
     or cur_status not in ('hired', 'in_transit')
     or cur_board is null
     or cur_board not in ('pending', 'no_response') then
    raise exception 'not_pending';
  end if;

  if gate is not null and gate > today_tr then
    raise exception 'boarding_too_early';
  end if;

  update public.candidate_status
  set boarding_status = ans,
      boarding_answered_at = now(),
      updated_at = now()
  where user_id = uid
  returning accepted_by into ag;

  if ag is not null and ag ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if ans = 'confirmed' then
      perform public._employment_notify(
        ag::uuid, 'boarding_confirmed', uid,
        jsonb_build_object('candidateId', uid)
      );
    else
      perform public._employment_notify(
        ag::uuid, 'boarding_missed', uid,
        jsonb_build_object('candidateId', uid, 'openWorkStart', true)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.candidate_answer_boarding(text) from public;
grant execute on function public.candidate_answer_boarding(text) to authenticated;
