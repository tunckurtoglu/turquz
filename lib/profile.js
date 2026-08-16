// lib/profile.js
// Aday CV/profil verisinin Supabase'e kaydı/okunması. Bkz. supabase/migrations/0006_profiles.sql
import { supabase } from './supabase';
import { candidateCode } from './candidateCode';
import { normalizeWorkAvailability } from '../cv/options';
import { touchLastSeen } from './lastSeen';

// CV verisini kaydet (varsa üzerine yaz). data = uygulamadaki tüm CV nesnesi.
export async function saveProfile(userId, data, sourceLang) {
  if (!userId) return;
  const d = data || {};
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || null;
  // Filtrelenebilir alanları sütunlara çıkar (kanonik değerlerle).
  const positions = Array.isArray(d.positions) ? d.positions.filter(Boolean) : [];
  const skills = Array.isArray(d.skills) ? d.skills.filter(Boolean) : [];
  const languages = Array.isArray(d.languages) ? d.languages.map((l) => l && l.name).filter(Boolean) : [];
  const birthYear = parseInt(d.birthYear, 10) || null;
  const workAvailability = normalizeWorkAvailability(d.availableMonths);
  const seenAt = new Date().toISOString();

  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      full_name: fullName,
      title: d.title || null,
      data: { ...d, availableMonths: workAvailability || d.availableMonths || null },
      source_lang: sourceLang || null,
      gender: d.gender || null,
      nationality: d.nationality || null,
      birth_year: birthYear,
      employment_status: d.employmentStatus || null,
      work_availability: workAvailability,
      available_months: null,
      positions,
      languages,
      skills,
      updated_at: seenAt,
      last_seen_at: seenAt,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
  // Havuz "henüz çevrimiçi olmadı" kalmasın — kayıt sonrası kesin dokun.
  touchLastSeen(true).catch(() => {});
}

// Adayın kayıtlı CV verisini getir (yoksa null).
export async function loadProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('data, reg_no').eq('user_id', userId).maybeSingle();
  if (error) {
    console.warn('Profil okunamadı:', error.message);
    return null;
  }
  const d = data?.data ?? null;
  if (d && data.reg_no) d.candidateNo = candidateCode(d.nationality, data.reg_no);
  if (d?.availableMonths) {
    const norm = normalizeWorkAvailability(d.availableMonths);
    if (norm) d.availableMonths = norm;
  }
  return d;
}
