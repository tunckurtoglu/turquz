-- 0068_contract_signed_payment_gate.sql
-- İmzalı sözleşme (contract_signed) yükleme: contracts.payment_status paid|waived şart.
-- UI kilidini API/RLS ile güçlendirir; ödemesiz insert/update engellenir.
-- Staff (is_staff) muaf. Çalıştırma: Supabase SQL Editor veya db push.

-- Adayın imzalı sözleşme yükleyip yükleyemeyeceği
create or replace function public.can_upload_contract_signed(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.contracts c
     where c.user_id = p_user
       and public.contract_is_paid(c.payment_status)
  );
$$;

revoke all on function public.can_upload_contract_signed(uuid) from public;
grant execute on function public.can_upload_contract_signed(uuid) to authenticated;

-- Trigger: RLS atlanmış olsa bile (yanlış client) ödemesiz contract_signed yazılamaz
create or replace function public.tg_user_documents_payment_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind is distinct from 'contract_signed' then
    return new;
  end if;

  -- Acente / personel işlemleri
  if public.is_staff() then
    return new;
  end if;

  if not public.can_upload_contract_signed(new.user_id) then
    raise exception 'contract_payment_required'
      using errcode = 'P0001',
            hint = 'Pay contract fee before uploading signed contract';
  end if;

  return new;
end;
$$;

drop trigger if exists user_documents_payment_gate on public.user_documents;
create trigger user_documents_payment_gate
  before insert or update on public.user_documents
  for each row
  execute function public.tg_user_documents_payment_gate();

-- RLS: kendi satırına yazarken de aynı şart
drop policy if exists user_documents_insert_own on public.user_documents;
create policy user_documents_insert_own on public.user_documents
  for insert
  with check (
    auth.uid() = user_id
    and (
      kind is distinct from 'contract_signed'
      or public.can_upload_contract_signed(user_id)
    )
  );

drop policy if exists user_documents_update_own on public.user_documents;
create policy user_documents_update_own on public.user_documents
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      kind is distinct from 'contract_signed'
      or public.can_upload_contract_signed(user_id)
    )
  );

notify pgrst, 'reload schema';
