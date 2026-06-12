-- 0022_notifications.sql
-- Uygulama içi bildirim merkezi (zil ikonu). Her karşılıklı harekette otomatik satır eklenir
-- (trigger'lar SECURITY DEFINER ile çalışır; istemci doğrudan yazmaz). Push'tan bağımsızdır.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade, -- alıcı
  type       text not null,        -- interview_proposed | interview_scheduled | document | accepted
  ref_user   uuid,                 -- ilgili karşı taraf (aday/acente)
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- Trigger: mülakat ----
create or replace function public.tg_interviews_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'proposed' and (tg_op = 'INSERT' or old.status is distinct from new.status or old.slots is distinct from new.slots) then
    insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'interview_proposed', new.created_by);
  elsif new.status = 'scheduled' and (tg_op = 'INSERT' or old.status is distinct from 'scheduled') and new.created_by is not null then
    insert into public.notifications(user_id, type, ref_user) values (new.created_by, 'interview_scheduled', new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists interviews_notify on public.interviews;
create trigger interviews_notify after insert or update on public.interviews
  for each row execute function public.tg_interviews_notify();

-- ---- Trigger: belge gönderimi (submitted_at null -> dolu) ----
create or replace function public.tg_documents_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
declare ag uuid;
begin
  if new.submitted_at is not null and (tg_op = 'INSERT' or old.submitted_at is null) then
    if new.kind in ('contract_unsigned', 'flight_ticket') then
      insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'document', new.user_id);
    else
      select accepted_by into ag from public.candidate_status where user_id = new.user_id;
      if ag is not null then
        insert into public.notifications(user_id, type, ref_user) values (ag, 'document', new.user_id);
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists documents_notify on public.user_documents;
create trigger documents_notify after insert or update on public.user_documents
  for each row execute function public.tg_documents_notify();

-- ---- Trigger: teklif kabul (docs_unlocked true olunca adaya) ----
create or replace function public.tg_status_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.docs_unlocked is true and (tg_op = 'INSERT' or old.docs_unlocked is distinct from true) then
    insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'accepted', new.accepted_by);
  end if;
  return new;
end $$;
drop trigger if exists status_notify on public.candidate_status;
create trigger status_notify after insert or update on public.candidate_status
  for each row execute function public.tg_status_notify();

-- Anlık (zil otomatik güncellensin)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
