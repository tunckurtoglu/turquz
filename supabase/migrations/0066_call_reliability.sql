-- 0066_call_reliability.sql
-- Görüşme süresi uzatma (+5) oda genelinde kalıcı olsun; yeniden katılım penceresi buna uysun.

alter table public.interviews
  add column if not exists call_extra_secs integer not null default 0;

-- Acente (veya staff): aynı oda (acente+slot) için tüm adaylarda süreyi uzat.
create or replace function public.extend_interview_call(
  p_candidate uuid,
  p_add_secs integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_slot text;
  v_extra integer;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;
  if p_add_secs is null or p_add_secs < 60 or p_add_secs > 1800 then
    raise exception 'bad_add';
  end if;

  select created_by, selected_slot
    into v_agency, v_slot
  from public.interviews
  where user_id = p_candidate
    and status = 'scheduled';

  if v_agency is null or v_slot is null then
    raise exception 'no_interview';
  end if;

  if auth.uid() is distinct from v_agency and not public.is_staff() then
    raise exception 'forbidden';
  end if;

  update public.interviews
     set call_extra_secs = coalesce(call_extra_secs, 0) + p_add_secs,
         updated_at = now()
   where created_by = v_agency
     and selected_slot = v_slot
     and status = 'scheduled';

  select call_extra_secs into v_extra
  from public.interviews
  where user_id = p_candidate;

  return jsonb_build_object(
    'ok', true,
    'add_secs', p_add_secs,
    'extra_secs', coalesce(v_extra, 0)
  );
end;
$$;

revoke all on function public.extend_interview_call(uuid, integer) from public;
grant execute on function public.extend_interview_call(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
