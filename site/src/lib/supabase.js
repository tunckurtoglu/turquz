// Opsiyonel Supabase istemcisi — iletişim formu kayıtları için.
// .env yoksa null döner; form otomatik olarak mailto'ya düşer (graceful fallback).
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anon ? createClient(url, anon, { auth: { persistSession: false } }) : null;

// İletişim mesajını contact_requests tablosuna yazar.
// Tablo migration'ı: supabase/migrations/0037_contact_requests.sql
export async function submitContact(payload) {
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const { error } = await supabase.from('contact_requests').insert({
    name: payload.name,
    org: payload.org || null,
    email: payload.email,
    kind: payload.kind || null,
    message: payload.message,
    lang: payload.lang || null,
    source: 'site',
  });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
