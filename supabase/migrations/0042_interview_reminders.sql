-- 0042_interview_reminders.sql
-- Mülakat hatırlatma push'ları (24sa / 1sa / 15dk) — adaya, tek seferlik.
-- Çalıştırma: Supabase > SQL Editor > Run.

alter table public.interviews add column if not exists reminder_24h_sent_at timestamptz;
alter table public.interviews add column if not exists reminder_1h_sent_at timestamptz;
alter table public.interviews add column if not exists reminder_15m_sent_at timestamptz;

-- Slot seçilince hatırlatma bayraklarını sıfırla.
create or replace function public.select_interview_slot(p_slot text) returns text
  language plpgsql security definer set search_path = public as $$
declare ag uuid; c int;
begin
  select created_by into ag from public.interviews where user_id = auth.uid();
  if ag is null then return 'no_interview'; end if;
  select count(*) into c from public.interviews
    where created_by = ag and status = 'scheduled' and selected_slot = p_slot and user_id <> auth.uid();
  if c >= 3 then return 'full'; end if;
  update public.interviews
    set selected_slot = p_slot, status = 'scheduled', updated_at = now(),
        reminder_24h_sent_at = null, reminder_1h_sent_at = null, reminder_15m_sent_at = null
    where user_id = auth.uid();
  return 'ok';
end $$;

notify pgrst, 'reload schema';
