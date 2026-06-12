// lib/consent.js
// KVKK açık rıza kayıtları (Supabase 'consents' tablosu — bkz. supabase/migrations/0001_consents.sql).
// Her onay yeni bir satır olarak eklenir; en güncel satır kullanıcının mevcut rızasıdır.

import { supabase } from './supabase';

// Rıza metni sürümü. Aydınlatma/rıza metni değişince ARTTIR → kullanıcıya yeniden sorulur.
export const CONSENT_VERSION = 1;

// Kullanıcının en güncel rıza satırını getir (yoksa null).
export async function getLatestConsent(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('consents')
    .select('*')
    .eq('user_id', userId)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('Rıza kaydı okunamadı:', error.message);
    return null;
  }
  return data;
}

// Yeni rıza satırı yaz. choices: { general, sensitive, crossBorder }
export async function saveConsent(userId, { general, sensitive, crossBorder, locale }) {
  const { data, error } = await supabase
    .from('consents')
    .insert({
      user_id: userId,
      consent_version: CONSENT_VERSION,
      general: !!general,
      sensitive: !!sensitive,
      cross_border: !!crossBorder,
      locale: locale || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Herhangi bir belge yüklemek için zorunlu: genel işleme + yurt dışı aktarım + güncel sürüm.
export function canUploadDocs(row) {
  return !!row && row.consent_version === CONSENT_VERSION && row.general && row.cross_border;
}

// Özel nitelikli belge (adli sicil) için ek olarak gereken rıza.
export function hasSensitiveConsent(row) {
  return !!row && row.consent_version === CONSENT_VERSION && row.sensitive;
}
