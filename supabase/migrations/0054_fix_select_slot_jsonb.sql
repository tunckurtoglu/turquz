-- 0054_fix_select_slot_jsonb.sql
-- 0052'de slots (jsonb) text[]'e atanıyordu → "malformed array literal".
-- Çalıştırma: Supabase > SQL Editor > Run.

create or replace function public.select_interview_slot(p_slot text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  ag uuid;
  c int;
  proposed jsonb;
  slot_ts timestamptz;
begin
  select created_by, slots into ag, proposed
    from public.interviews where user_id = auth.uid();
  if ag is null then return 'no_interview'; end if;

  -- Yalnızca acentenin önerdiği listeden seçim (jsonb dizi).
  if proposed is null
     or jsonb_typeof(proposed) <> 'array'
     or not exists (
       select 1 from jsonb_array_elements_text(proposed) s where s = p_slot
     ) then
    return 'invalid';
  end if;

  -- Geçmiş saatleri engelle (UTC ISO veya eski "gg.aa.yyyy ss:dd").
  begin
    if p_slot ~ '^\d{2}\.\d{2}\.\d{4} ' then
      slot_ts := to_timestamp(p_slot, 'DD.MM.YYYY HH24:MI');
    else
      slot_ts := p_slot::timestamptz;
    end if;
  exception when others then
    return 'invalid';
  end;
  if slot_ts < now() - interval '2 minutes' then
    return 'past';
  end if;

  select count(*) into c from public.interviews
    where created_by = ag and status = 'scheduled' and selected_slot = p_slot and user_id <> auth.uid();
  if c >= 3 then return 'full'; end if;

  update public.interviews
    set selected_slot = p_slot, status = 'scheduled', updated_at = now(),
        reminder_24h_sent_at = null, reminder_1h_sent_at = null,
        reminder_15m_sent_at = null, reminder_5m_sent_at = null
    where user_id = auth.uid();
  return 'ok';
end $$;

notify pgrst, 'reload schema';
