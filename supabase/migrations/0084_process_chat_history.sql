-- 0084_process_chat_history.sql
-- Süreç bitince sohbeti kapat; ödeme/sözleşme yokken open chat'leri geçmişe al.
-- Çalıştırma: 0083'ten sonra SQL Editor > Run.

-- Ödenmiş sözleşme kalmayan açık sohbetleri kapat (geçmiş kayıt)
update public.process_chats pc
set closed_at = coalesce(pc.closed_at, now())
where pc.closed_at is null
  and not exists (
    select 1
    from public.contracts c
    where c.user_id = pc.candidate_id
      and public.contract_is_paid(c.payment_status)
  );

-- Aday için açık sohbeti kapat (acente withdraw / süreç sonu)
create or replace function public.close_process_chat(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.process_chats
  set closed_at = now()
  where candidate_id = p_candidate
    and closed_at is null
    and (
      agency_id = v_uid
      or candidate_id = v_uid
      or public.is_admin()
    );
end;
$$;

revoke all on function public.close_process_chat(uuid) from public;
grant execute on function public.close_process_chat(uuid) to authenticated;
