-- 0053_notif_payload.sql
-- Bildirimlere payload (aday kodu / seçilen slot) — acente kim+ne zaman görsün.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.notifications add column if not exists payload jsonb not null default '{}'::jsonb;

-- Mülakat: scheduled olunca acenteye aday + seçilen slot bilgisiyle bildirim.
create or replace function public.tg_interviews_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  nat text;
  reg int;
begin
  if new.status = 'proposed' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.slots is distinct from new.slots) then
    insert into public.notifications(user_id, type, ref_user, payload)
      values (new.user_id, 'interview_proposed', new.created_by, '{}'::jsonb);
  elsif new.status = 'scheduled' and (tg_op = 'INSERT' or old.status is distinct from 'scheduled') and new.created_by is not null then
    select p.nationality, p.reg_no into nat, reg
      from public.profiles p where p.user_id = new.user_id;
    insert into public.notifications(user_id, type, ref_user, payload)
      values (
        new.created_by,
        'interview_scheduled',
        new.user_id,
        jsonb_build_object(
          'slot', new.selected_slot,
          'nationality', coalesce(nat, ''),
          'reg_no', reg
        )
      );
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
