-- 0055_contract_payment.sql
-- Sözleşme web portalı + ödeme durumu.
-- unpaid | paid | waived — waived/paid indirmeyi açar; app evrak akışı aynı kalır.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.contracts
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists stripe_session_id text,
  add column if not exists portal_token text,
  add column if not exists portal_token_expires_at timestamptz;

do $$ begin
  alter table public.contracts
    drop constraint if exists contracts_payment_status_chk;
  alter table public.contracts
    add constraint contracts_payment_status_chk
    check (payment_status in ('unpaid', 'paid', 'waived'));
exception when others then null;
end $$;

create unique index if not exists contracts_portal_token_uidx
  on public.contracts (portal_token)
  where portal_token is not null;

-- Ödeme tamamlandı mı? (paid veya waived)
create or replace function public.contract_is_paid(p_status text)
returns boolean
language sql immutable as $$
  select p_status in ('paid', 'waived');
$$;

-- Acente/admin test veya özel durum için ödemeyi muaf tutabilir.
create or replace function public.waive_contract_payment(p_candidate uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not_allowed';
  end if;
  update public.contracts
     set payment_status = 'waived',
         paid_at = coalesce(paid_at, now()),
         updated_at = now()
   where user_id = p_candidate;
end;
$$;

grant execute on function public.waive_contract_payment(uuid) to authenticated;

notify pgrst, 'reload schema';
