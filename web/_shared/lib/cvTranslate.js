// lib/cvTranslate.js
// Adayın serbest CV metinlerini hedef dile çevirir (translate-cv edge function, Gemini).
// Çeviri DB'de önbelleklenir; istemci çağırır ve sonucu CV verisine giydirir.
import { supabase } from './supabase';

// edge function extract() ile AYNI sözleşme.
export function extractCvFields(d) {
  return {
    title: d?.title || '',
    profile: d?.profile || '',
    experience: Array.isArray(d?.experience)
      ? d.experience.map((e) => ({
        company: e?.company || '',
        position: e?.position || '',
        date: e?.date || '',
      }))
      : [],
    education: Array.isArray(d?.education)
      ? d.education.map((e) => ({ description: e?.description || '', date: e?.date || '' }))
      : [],
    certificates: Array.isArray(d?.certificates)
      ? d.certificates.map((c) => (
        typeof c === 'string'
          ? { name: c, institution: '' }
          : { name: c?.name || '', institution: c?.institution || '' }
      ))
      : [],
  };
}

export function hasCvFreeText(fields) {
  if (!fields) return false;
  return !!(
    fields.title || fields.profile
    || fields.experience?.some((e) => e?.company || e?.position || e?.date)
    || fields.education?.some((e) => e?.description || e?.date)
    || fields.certificates?.some((c) => c?.name || c?.institution)
  );
}

function mergeExp(orig, tr) {
  if (typeof tr === 'string') return tr ? { ...orig, position: tr } : orig;
  if (!tr || typeof tr !== 'object') return orig;
  return {
    ...orig,
    ...(tr.company ? { company: tr.company } : {}),
    ...(tr.position ? { position: tr.position } : {}),
    ...(tr.date ? { date: tr.date } : {}),
  };
}

function mergeEdu(orig, tr) {
  if (typeof tr === 'string') return tr ? { ...orig, description: tr } : orig;
  if (!tr || typeof tr !== 'object') return orig;
  return {
    ...orig,
    ...(tr.description ? { description: tr.description } : {}),
    ...(tr.date ? { date: tr.date } : {}),
  };
}

function mergeCert(orig, tr) {
  if (typeof tr === 'string') return tr || orig;
  if (!tr || typeof tr !== 'object') return orig;
  if (typeof orig === 'string') return tr.name || tr.institution ? [tr.name, tr.institution].filter(Boolean).join(' — ') : orig;
  return {
    ...orig,
    ...(tr.name ? { name: tr.name } : {}),
    ...(tr.institution ? { institution: tr.institution } : {}),
  };
}

// Çeviriyi orijinal CV verisinin üstüne giydirir (yeni nesne; orijinali bozmaz).
export function applyCvTranslation(data, tr) {
  if (!data || !tr) return data;
  const d = { ...data };
  if (typeof tr.title === 'string' && tr.title) d.title = tr.title;
  if (typeof tr.profile === 'string' && tr.profile) d.profile = tr.profile;
  if (Array.isArray(tr.experience) && Array.isArray(data.experience)) {
    d.experience = data.experience.map((e, i) => mergeExp(e, tr.experience[i]));
  }
  if (Array.isArray(tr.education) && Array.isArray(data.education)) {
    d.education = data.education.map((e, i) => mergeEdu(e, tr.education[i]));
  }
  if (Array.isArray(tr.certificates) && Array.isArray(data.certificates) && tr.certificates.length === data.certificates.length) {
    d.certificates = data.certificates.map((c, i) => mergeCert(c, tr.certificates[i]));
  }
  return d;
}

async function invokeTranslate(body) {
  const { data, error } = await supabase.functions.invoke('translate-cv', { body });
  if (error) {
    console.warn('translate-cv hata:', error.message);
    return null;
  }
  if (data?.error) {
    console.warn('translate-cv:', data.error);
    return null;
  }
  if (!data?.fields) return null;
  return data.fields;
}

// Acente: aday CV'sini hedef dile çevir. sourceData verilirse ekrandaki veri kullanılır.
export async function translateCvFields(candidateUserId, target, sourceData) {
  if (!candidateUserId || !target) return null;
  try {
    const body = { candidateUserId, target };
    if (sourceData) body.fields = extractCvFields(sourceData);
    return await invokeTranslate(body);
  } catch (e) {
    console.warn('translate-cv exception:', e?.message);
    return null;
  }
}

// Aday önizleme: bellekteki CV verisini çevir (wizard adım 8).
export async function translateCvInline(data, target, candidateUserId) {
  if (!data || !target) return null;
  const fields = extractCvFields(data);
  if (!hasCvFreeText(fields)) return null;
  try {
    return await invokeTranslate({ target, fields, candidateUserId: candidateUserId || undefined });
  } catch (e) {
    console.warn('translate-cv inline exception:', e?.message);
    return null;
  }
}
