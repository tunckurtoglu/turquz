-- 0107: Sözleşme ödemesi (paid/waived) sonrası acenteye CV PII açılır.
-- Havuz görünümü iletişim/pasaport/aileyi strip eder; client blur da uygular.
-- Ödeme sonrası bu RPC gerçek alanları döner; UI maskeyi kaldırır.
-- Çalıştırma: 0106'dan sonra SQL Editor > Run.

create or replace function public.get_candidate_cv_reveal(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok boolean;
  v_data jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  -- Yalnız personel (veya admin)
  if not public.is_user_staff(v_uid) and not public.is_admin() then
    return null;
  end if;

  -- Sözleşme ödenmiş ve bu acente sürecin sahibi (created_by) olmalı
  select exists (
    select 1
    from public.contracts c
    where c.user_id = p_user
      and public.contract_is_paid(c.payment_status)
      and (
        c.created_by = v_uid
        or public.is_admin()
      )
  ) into v_ok;

  if not v_ok then
    return null;
  end if;

  select data into v_data from public.profiles where user_id = p_user;
  if v_data is null then
    return null;
  end if;

  return jsonb_build_object(
    'email',        v_data->>'email',
    'phone',        v_data->>'phone',
    'phoneConfirm', v_data->>'phoneConfirm',
    'location',     v_data->>'location',
    'passportNo',   v_data->>'passportNo',
    'birthPlace',   v_data->>'birthPlace',
    'family',       v_data->'family',
    'firstName',    v_data->>'firstName',
    'lastName',     v_data->>'lastName'
  );
end;
$$;

revoke all on function public.get_candidate_cv_reveal(uuid) from public;
grant execute on function public.get_candidate_cv_reveal(uuid) to authenticated;

notify pgrst, 'reload schema';
