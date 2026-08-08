-- 0035_pickup.sql
-- Havaalanı karşılama: adayı havaalanında karşılayacak kişinin adı + WhatsApp numarası.
-- Acente hazır olunca girer ve "Adaya Gönder" ile iletir (pickup_sent_at). Aday WhatsApp'tan
-- bu numaraya fotoğraflarını gönderir ki karşılayan kişi onu tanısın.
-- Çalıştırma: Supabase > SQL Editor > yapıştır > Run.

alter table public.flights add column if not exists pickup_name  text;
alter table public.flights add column if not exists pickup_phone text;        -- WhatsApp (uluslararası: +90...)
alter table public.flights add column if not exists pickup_sent_at timestamptz; -- adaya iletildiği an

-- Karşılama bilgisi adaya İLETİLİNCE (pickup_sent_at null -> dolu) adayı zille uyar.
create or replace function public.tg_flights_pickup_notify() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.pickup_sent_at is not null and (tg_op = 'INSERT' or old.pickup_sent_at is null) then
    insert into public.notifications(user_id, type, ref_user) values (new.user_id, 'pickup', new.created_by);
  end if;
  return new;
end $$;
drop trigger if exists flights_pickup_notify on public.flights;
create trigger flights_pickup_notify after insert or update on public.flights
  for each row execute function public.tg_flights_pickup_notify();

notify pgrst, 'reload schema';
