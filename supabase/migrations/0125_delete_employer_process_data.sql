-- 0125_delete_employer_process_data.sql
-- İşletme silinince işletmeye bağlı aday süreçlerini atomik olarak temizle.
-- Aday hesabı/profili silinmez; favori ve bu işletmeye bağlı süreç verileri silinir,
-- aday aktif başka bir süreçte değilse havuza dönecek şekilde sıfırlanır.

create or replace function public.agency_delete_employer(p_employer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid := auth.uid();
  v_count integer := 0;
  v_doc_paths text[];
begin
  if v_agency is null or not public.is_staff() then
    raise exception 'forbidden';
  end if;
  if p_employer is null then
    raise exception 'bad_request';
  end if;
  if not exists (
    select 1
    from public.agency_employers
    where id = p_employer
      and agency_id = v_agency
  ) then
    raise exception 'not_found';
  end if;

  drop table if exists pg_temp.agency_employer_delete_candidates;
  create temporary table agency_employer_delete_candidates (
    user_id uuid primary key
  ) on commit drop;

  -- Süreç bağlantısı olan adaylar: teklif, mülakat, sözleşme, personel kaydı
  -- veya bu işletme için açılmış belge süreci.
  insert into pg_temp.agency_employer_delete_candidates (user_id)
  select cs.user_id
  from public.candidate_status cs
  where cs.accepted_by = v_agency::text
    and cs.offer_employer_id = p_employer
  union
  select i.user_id
  from public.interviews i
  where i.employer_id = p_employer
  union
  select c.user_id
  from public.contracts c
  where c.employer_id = p_employer
  union
  select e.candidate_id
  from public.employment_episodes e
  where e.agency_id = v_agency
    and e.employer_id = p_employer
  union
  select cs.user_id
  from public.candidate_status cs
  join public.agency_favorites f
    on f.agency_id = v_agency
   and f.employer_id = p_employer
   and f.candidate_id = cs.user_id
  where cs.accepted_by = v_agency::text
    and cs.status <> 'new';

  select count(*) into v_count
  from pg_temp.agency_employer_delete_candidates;

  -- Storage temizliği istemci tarafından yapılacağı için yolları önce döndür.
  select coalesce(array_agg(ud.storage_path), array[]::text[])
    into v_doc_paths
  from public.user_documents ud
  join pg_temp.agency_employer_delete_candidates x on x.user_id = ud.user_id;

  -- İşletmeye ait sohbet, süreç dosyaları ve süreç kayıtları.
  delete from public.process_chats pc
  using pg_temp.agency_employer_delete_candidates x
  where pc.agency_id = v_agency
    and pc.candidate_id = x.user_id;

  delete from public.interviews i
  using pg_temp.agency_employer_delete_candidates x
  where i.user_id = x.user_id
    and (i.created_by = v_agency or i.employer_id = p_employer);

  delete from public.contracts c
  using pg_temp.agency_employer_delete_candidates x
  where c.user_id = x.user_id
    and (c.created_by = v_agency or c.employer_id = p_employer);

  delete from public.flights f
  using pg_temp.agency_employer_delete_candidates x
  where f.user_id = x.user_id;

  delete from public.user_documents ud
  using pg_temp.agency_employer_delete_candidates x
  where ud.user_id = x.user_id;

  delete from public.agency_cv_overrides o
  using pg_temp.agency_employer_delete_candidates x
  where o.agency_id = v_agency
    and o.candidate_id = x.user_id;

  delete from public.employment_episodes e
  where e.agency_id = v_agency
    and e.employer_id = p_employer;

  -- Teklif/mülakat/belge sürecini aday açısından sıfırla; profil korunur.
  update public.candidate_status cs
  set status = 'new',
      docs_unlocked = false,
      stage = 0,
      accepted_by = null,
      accepted_at = null,
      offered_at = null,
      hired_at = null,
      work_end_at = null,
      work_start_at = null,
      planned_end_on = null,
      flight_depart_on = null,
      boarding_status = null,
      work_start_asked_at = null,
      work_start_remind_count = 0,
      docs_deadline_at = null,
      docs_extra_requested_at = null,
      docs_agency_extra_at = null,
      docs_deadline_notified_at = null,
      consulate_deadline_at = null,
      consulate_agency_extra_at = null,
      consulate_deadline_notified_at = null,
      airport_check_status = null,
      airport_check_asked_at = null,
      airport_check_answered_at = null,
      airport_check_remind_count = 0,
      airport_check_last_answer = null,
      airport_check_negative_notified_at = null,
      offer_employer_id = null,
      updated_at = now()
  from pg_temp.agency_employer_delete_candidates x
  where cs.user_id = x.user_id;

  -- Açıkça silerek eski kurulumlarda da FK davranışına bağımlı kalma.
  delete from public.agency_employer_notes
  where agency_id = v_agency
    and employer_id = p_employer;

  delete from public.agency_favorites
  where agency_id = v_agency
    and employer_id = p_employer;

  delete from public.notifications n
  where (n.user_id = v_agency and n.ref_user in (
           select user_id from pg_temp.agency_employer_delete_candidates
        ))
     or (n.user_id in (
           select user_id from pg_temp.agency_employer_delete_candidates
         ) and n.ref_user = v_agency);

  delete from public.agency_employers
  where id = p_employer
    and agency_id = v_agency;

  return jsonb_build_object(
    'employer_id', p_employer,
    'reset_candidates', v_count,
    'document_paths', to_jsonb(coalesce(v_doc_paths, array[]::text[]))
  );
end;
$$;

revoke all on function public.agency_delete_employer(uuid) from public;
grant execute on function public.agency_delete_employer(uuid) to authenticated;

