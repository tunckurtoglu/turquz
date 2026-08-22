-- 0101: Süreç sohbeti yalnız sözleşme ödemesi (paid/waived) sonrası açılsın.
-- 0091 teklif kabulünden itibaren açmıştı; ürün kararı: ödeme sonrası.
-- Çalıştırma: 0100'den sonra SQL Editor > Run.

create or replace function public.process_chat_unlocked(p_candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.contract_chat_unlocked(p_candidate);
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select c.created_by into v_agency
  from public.contracts c
  where c.user_id = p_candidate
    and public.contract_is_paid(c.payment_status)
  limit 1;

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

revoke all on function public.ensure_process_chat(uuid) from public;
grant execute on function public.ensure_process_chat(uuid) to authenticated;

notify pgrst, 'reload schema';
