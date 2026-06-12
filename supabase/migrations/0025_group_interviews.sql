-- 0025_group_interviews.sql
-- GRUP mülakatı: acente/otel sabit bir saat belirler, birden çok adayı tek odaya davet eder.
-- Bireysel mülakattan (interviews) bağımsız. Oda adı: "grp-<groupId>".
-- Çalıştırma: Supabase > SQL Editor > Run.

create table if not exists public.interview_groups (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users (id) on delete cascade, -- acente/otel
  slot        timestamptz not null,                                        -- sabit görüşme anı (UTC)
  title       text,
  status      text not null default 'scheduled',                          -- scheduled | cancelled
  created_at  timestamptz not null default now()
);
create index if not exists ig_created_idx on public.interview_groups (created_by, slot);

create table if not exists public.interview_group_members (
  group_id          uuid not null references public.interview_groups (id) on delete cascade,
  candidate_user_id uuid not null references auth.users (id) on delete cascade,
  status            text not null default 'invited',                       -- invited | accepted | declined
  created_at        timestamptz not null default now(),
  primary key (group_id, candidate_user_id)
);
create index if not exists igm_candidate_idx on public.interview_group_members (candidate_user_id);

alter table public.interview_groups enable row level security;
alter table public.interview_group_members enable row level security;

-- Gruplar: sahip (acente) ya da üye aday görür.
drop policy if exists ig_select on public.interview_groups;
create policy ig_select on public.interview_groups for select using (
  created_by = auth.uid()
  or exists (select 1 from public.interview_group_members m where m.group_id = id and m.candidate_user_id = auth.uid())
);
-- Sadece staff (acente/otel/admin) grup oluşturur/günceller.
drop policy if exists ig_write on public.interview_groups;
create policy ig_write on public.interview_groups for all
  using (created_by = auth.uid() and public.is_user_staff(auth.uid()))
  with check (created_by = auth.uid() and public.is_user_staff(auth.uid()));

-- Üyeler: üye kendini, grup sahibi tüm üyeleri görür.
drop policy if exists igm_select on public.interview_group_members;
create policy igm_select on public.interview_group_members for select using (
  candidate_user_id = auth.uid()
  or exists (select 1 from public.interview_groups g where g.id = group_id and g.created_by = auth.uid())
);
-- Ekleme: yalnız grup sahibi üye ekler.
drop policy if exists igm_insert on public.interview_group_members;
create policy igm_insert on public.interview_group_members for insert with check (
  exists (select 1 from public.interview_groups g where g.id = group_id and g.created_by = auth.uid())
);
-- Güncelleme: aday kendi katılım durumunu (kabul/ret), sahip her şeyi.
drop policy if exists igm_update on public.interview_group_members;
create policy igm_update on public.interview_group_members for update using (
  candidate_user_id = auth.uid()
  or exists (select 1 from public.interview_groups g where g.id = group_id and g.created_by = auth.uid())
);
-- Silme: yalnız sahip.
drop policy if exists igm_delete on public.interview_group_members;
create policy igm_delete on public.interview_group_members for delete using (
  exists (select 1 from public.interview_groups g where g.id = group_id and g.created_by = auth.uid())
);

-- Anlık (davet/kabul canlı görünsün)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='interview_group_members') then
    alter publication supabase_realtime add table public.interview_group_members;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='interview_groups') then
    alter publication supabase_realtime add table public.interview_groups;
  end if;
end $$;

notify pgrst, 'reload schema';
