-- 0026_shared_slots.sql
-- Birleşik mülakat: aynı (acente, slot) için en fazla 3 aday seçebilir. 1 kişi=bireysel, 2-3=grup.
-- Aday seçimi RLS altında başka adayları sayamadığı için SECURITY DEFINER RPC ile yapılır.
-- Çalıştırma: Supabase > SQL Editor > Run.

-- Aday bir slot seçer. Aynı acente+slot için 3 dolmuşsa 'full' döner.
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
    set selected_slot = p_slot, status = 'scheduled', updated_at = now()
    where user_id = auth.uid();
  return 'ok';
end $$;
grant execute on function public.select_interview_slot(text) to authenticated;

-- Adayın kendi önerilen slotları için doluluk: { "<slot>": <kaç aday seçti>, ... }
create or replace function public.slot_availability() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare ag uuid; sl jsonb; s text; c int; res jsonb := '{}'::jsonb;
begin
  select created_by, slots into ag, sl from public.interviews where user_id = auth.uid();
  if ag is null then return res; end if;
  for s in select jsonb_array_elements_text(coalesce(sl, '[]'::jsonb)) loop
    select count(*) into c from public.interviews
      where created_by = ag and status = 'scheduled' and selected_slot = s;
    res := res || jsonb_build_object(s, c);
  end loop;
  return res;
end $$;
grant execute on function public.slot_availability() to authenticated;

notify pgrst, 'reload schema';
