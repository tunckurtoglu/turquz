-- 0079_accept_employment_end.sql
-- Karşı taraf ayrılışı hemen onaylayabilir (7 gün beklemeden).
-- "Eski haline al" yalnızca talebi açan (veya admin) iptal edebilir.

-- İptal: yalnız talep sahibi + admin
create or replace function public.undo_employment_end(p_episode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
  other uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome <> 'early_exit_pending' then raise exception 'not_pending'; end if;
  if uid <> ep.end_requested_by and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  update public.employment_episodes
  set outcome = 'active',
      end_requested_by = null,
      end_requested_at = null,
      end_request_role = null,
      end_reason = null,
      silence_deadline_at = null,
      updated_at = now()
  where id = p_episode;

  other := case when uid = ep.candidate_id then ep.agency_id else ep.candidate_id end;
  perform public._employment_notify(
    other,
    'employment_end_undone',
    uid,
    jsonb_build_object('episodeId', p_episode, 'employerTitle', ep.employer_title)
  );
end;
$$;

revoke all on function public.undo_employment_end(uuid) from public;
grant execute on function public.undo_employment_end(uuid) to authenticated;

-- Karşı taraf onayı → erken ayrılış hemen kesinleşir
create or replace function public.accept_employment_end(p_episode uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ep public.employment_episodes%rowtype;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into ep from public.employment_episodes where id = p_episode for update;
  if not found then raise exception 'not_found'; end if;
  if ep.outcome <> 'early_exit_pending' then raise exception 'not_pending'; end if;
  if uid = ep.end_requested_by then raise exception 'cannot_accept_own'; end if;
  if uid <> ep.candidate_id and uid <> ep.agency_id and not public.is_admin() then
    raise exception 'forbidden';
  end if;

  perform public._finalize_employment_episode(p_episode, 'early_exit', uid, 'accepted');
end;
$$;

revoke all on function public.accept_employment_end(uuid) from public;
grant execute on function public.accept_employment_end(uuid) to authenticated;
