-- 0091_ops_scan_and_chat.sql
-- 1) Dakikalık istihdam taraması (boarding / işe başlama / sessizlik) — uygulama açılışına bağlı kalmasın.
-- 2) Süreç sohbeti teklif kabulünden (belgeler) itibaren açık.
-- Çalıştırma: SQL Editor > Run. scan-ops HTTP cron'u deploy sonrası _schedule_scan_ops ile bağlanır.

-- ---- Sohbet: accepted / in_transit / hired ----
create or replace function public.process_chat_unlocked(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.candidate_status cs
    where cs.user_id = p_candidate
      and cs.status in ('accepted', 'in_transit', 'hired')
      and cs.accepted_by is not null
      and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  or public.contract_chat_unlocked(p_candidate);
$$;

revoke all on function public.process_chat_unlocked(uuid) from public;
grant execute on function public.process_chat_unlocked(uuid) to authenticated;

create or replace function public.ensure_process_chat(p_candidate uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_uid uuid := auth.uid();
  v_chat uuid;
  v_agency_txt text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select cs.accepted_by into v_agency_txt
  from public.candidate_status cs
  where cs.user_id = p_candidate
    and cs.status in ('accepted', 'in_transit', 'hired')
    and cs.accepted_by is not null
    and cs.accepted_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  limit 1;

  if v_agency_txt is not null then
    v_agency := v_agency_txt::uuid;
  else
    select c.created_by into v_agency
    from public.contracts c
    where c.user_id = p_candidate
      and public.contract_is_paid(c.payment_status)
    limit 1;
  end if;

  if v_agency is null then
    raise exception 'chat_locked';
  end if;

  if v_uid <> p_candidate and v_uid <> v_agency and not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  insert into public.process_chats (candidate_id, agency_id)
  values (p_candidate, v_agency)
  on conflict (candidate_id, agency_id) do update
    set closed_at = null
  returning id into v_chat;

  if v_chat is null then
    select id into v_chat from public.process_chats
    where candidate_id = p_candidate and agency_id = v_agency;
  end if;

  return v_chat;
end;
$$;

-- ---- Dakikalık SQL tarama (push yok; push scan-ops'ta) ----
do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  raise notice 'pg_cron: %', SQLERRM;
end $$;

do $$
begin
  perform cron.unschedule('turquz-employment-lifecycle');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule(
    'turquz-employment-lifecycle',
    '* * * * *',
    'select public.scan_employment_lifecycle();'
  );
exception when others then
  raise notice 'cron schedule: %', SQLERRM;
end $$;

-- HTTP scan-ops (mülakat / belge / varış / push). Secret git'e yazılmaz.
do $$
begin
  execute 'create extension if not exists pg_net';
exception when others then
  raise notice 'pg_net: %', SQLERRM;
end $$;

create or replace function public._schedule_scan_ops(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, cron, net, extensions
as $$
begin
  if p_url is null or p_url = '' or p_secret is null or p_secret = '' then
    raise exception 'url_and_secret_required';
  end if;
  begin
    perform cron.unschedule('turquz-scan-ops');
  exception when others then
    null;
  end;
  perform cron.schedule(
    'turquz-scan-ops',
    '* * * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{"scan":true}'::jsonb
      );
      $job$,
      p_url,
      p_secret
    )
  );
end;
$$;

revoke all on function public._schedule_scan_ops(text, text) from public, anon, authenticated;

notify pgrst, 'reload schema';
