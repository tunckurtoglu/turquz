-- 0120_agency_profile_photo.sql
-- Acente ayarları kimlik kartında gösterilen profil fotoğrafı.

alter table public.agency_profiles
  add column if not exists profile_photo_path text;

notify pgrst, 'reload schema';
