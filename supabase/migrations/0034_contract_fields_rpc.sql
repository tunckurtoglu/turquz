-- 0034_contract_fields_rpc.sql
-- SORUN: candidate_pool görünümü güvenlik için data'dan passportNo/iletişim/adres/aile
-- bilgisini ÇIKARIR; bu yüzden acente bu alanları HİÇ alamaz ve sözleşmeye çekilemez.
-- ÇÖZÜM: aday SÜREÇTEYKEN (teklif/kabul) acente, sözleşme için gereken özel alanları
-- SECURITY DEFINER RPC ile alır. Havuz genelinde gizlilik korunur; yalnız ilgili adayda açılır.

create or replace function public.get_candidate_contract_fields(p_user uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_ok boolean;
  v_data jsonb;
begin
  -- Yalnız personel (acente/admin) çağırabilir.
  if not public.is_user_staff(auth.uid()) then
    return null;
  end if;

  -- Aday bu acentenin sürecinde mi? (teklif gitti / belgeler açıldı / işe alındı)
  select exists (
    select 1 from public.candidate_status cs
    where cs.user_id = p_user
      and (cs.docs_unlocked = true or cs.status in ('offered', 'hired'))
  ) into v_ok;
  if not v_ok then
    return null;
  end if;

  select data into v_data from public.profiles where user_id = p_user;
  if v_data is null then
    return null;
  end if;

  -- Sözleşme + konsolosluk yazısı için gereken özel alanlar.
  return jsonb_build_object(
    'passportNo', v_data->>'passportNo',
    'birthPlace', v_data->>'birthPlace',
    'location',   v_data->>'location',
    'family',     v_data->'family'
  );
end;
$$;

grant execute on function public.get_candidate_contract_fields(uuid) to authenticated;

notify pgrst, 'reload schema';
