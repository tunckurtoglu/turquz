-- 0028_decline_interview.sql
-- Acente sonuçlanan görüşmede bir adayı REDDEDER: adaya kibar bir bildirim gider, görüşme kapanır,
-- aday HAVUZDA müsait kalır (başka acenteler görebilir). SECURITY DEFINER (acente başka kullanıcıya bildirim yazamaz).
-- Çalıştırma: Supabase > SQL Editor > Run.

create or replace function public.decline_interview(p_candidate uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare ag uuid;
begin
  select created_by into ag from public.interviews where user_id = p_candidate;
  if ag is null or ag <> auth.uid() then return; end if;  -- yalnız görüşmeyi kuran acente
  insert into public.notifications(user_id, type, ref_user) values (p_candidate, 'rejected', ag);
  delete from public.interviews where user_id = p_candidate;  -- görüşme kapanır; aday havuzda kalır
end $$;
grant execute on function public.decline_interview(uuid) to authenticated;

notify pgrst, 'reload schema';
