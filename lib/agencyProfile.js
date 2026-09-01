// lib/agencyProfile.js — acente kurulum profili + vergi levhası.
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

function fromRow(r) {
  if (!r) return null;
  return {
    userId: r.user_id,
    regNo: r.reg_no ?? null,
    companyName: r.company_name || '',
    contactFirstName: r.contact_first_name || '',
    contactLastName: r.contact_last_name || '',
    phoneAuthorized: r.phone_authorized || '',
    phoneRep: r.phone_rep || '',
    profilePhotoPath: r.profile_photo_path || '',
    taxPlatePath: r.tax_plate_path || '',
    taxPlateMime: r.tax_plate_mime || '',
    completedAt: r.completed_at || null,
  };
}

/** Self-kayıt sonrası acente rolü + boş profil satırı. Aday hesabında hata verir. */
export async function registerAsAgency() {
  const { data, error } = await supabase.rpc('register_as_agency');
  if (error) throw error;
  return data;
}

/** Aday portalı: agency hesabı candidate olamaz. */
export async function registerAsCandidate() {
  const { data, error } = await supabase.rpc('register_as_candidate');
  if (error) throw error;
  return data;
}

export async function getAgencyProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('agency_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('agency_profiles okunamadı:', error.message);
    return null;
  }
  return fromRow(data);
}

export async function isAgencySetupComplete(userId) {
  if (!userId) return false;
  const { data, error } = await supabase.rpc('is_agency_setup_complete', { p_user: userId });
  if (error) {
    console.warn('is_agency_setup_complete:', error.message);
    return false;
  }
  return !!data;
}

/** Vergi levhası PDF (base64 ham, data: prefix yok). */
export async function uploadAgencyTaxPlate(userId, base64) {
  if (!userId || !base64) throw new Error('missing');
  const path = `${userId}/vergi_levhasi.pdf`;
  const { error: upErr } = await supabase.storage
    .from('agency-docs')
    .upload(path, decode(base64), { contentType: 'application/pdf', upsert: true });
  if (upErr) throw upErr;
  return path;
}

/** Yükle + profil satırını güncelle (ayarlar ekranı). */
export async function saveAgencyTaxPlate(userId, base64) {
  const path = await uploadAgencyTaxPlate(userId, base64);
  const { error } = await supabase
    .from('agency_profiles')
    .update({
      tax_plate_path: path,
      tax_plate_mime: 'application/pdf',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
  return path;
}

/** Vergi levhası için imzalı URL (görüntüleme). */
export async function getAgencyTaxPlateUrl(userId, expiresIn = 3600) {
  if (!userId) return null;
  const profile = await getAgencyProfile(userId);
  if (!profile?.taxPlatePath) return null;
  const { data, error } = await supabase.storage
    .from('agency-docs')
    .createSignedUrl(profile.taxPlatePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

/** Şirket adı güncelle (ayarlar). */
export async function updateAgencyCompanyName(userId, companyName) {
  if (!userId) throw new Error('Oturum yok');
  const { error } = await supabase
    .from('agency_profiles')
    .update({
      company_name: (companyName || '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) throw error;
}

/** Acente profil fotoğrafını private agency-docs bucket'ına yükler. */
export async function saveAgencyProfilePhoto(userId, base64, mime = 'image/webp') {
  if (!userId || !base64) throw new Error('missing');
  const match = String(base64).match(/^data:([^;]+);base64,(.+)$/);
  const contentType = mime || match?.[1] || 'image/webp';
  const rawBase64 = match?.[2] || base64;
  const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'webp';
  const previous = await getAgencyProfile(userId);
  const path = `${userId}/profile/avatar_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('agency-docs')
    .upload(path, decode(rawBase64), { contentType, upsert: true });
  if (upErr) throw upErr;
  const { error } = await supabase
    .from('agency_profiles')
    .update({ profile_photo_path: path, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw error;
  if (previous?.profilePhotoPath && previous.profilePhotoPath !== path) {
    supabase.storage.from('agency-docs').remove([previous.profilePhotoPath]).catch(() => {});
  }
  return path;
}

/** Profil fotoğrafı yolu için kısa ömürlü görüntüleme URL'si üretir. */
export async function getAgencyProfilePhotoUrl(userId, path, expiresIn = 3600) {
  const photoPath = path || (await getAgencyProfile(userId))?.profilePhotoPath;
  if (!photoPath) return null;
  if (/^https?:\/\//.test(photoPath)) return photoPath;
  const { data, error } = await supabase.storage
    .from('agency-docs')
    .createSignedUrl(photoPath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

/**
 * Kurulumu kaydet + completed_at.
 * fields: { contactFirstName, contactLastName, phoneAuthorized, phoneRep, companyName, taxPlatePath }
 */
export async function completeAgencySetup(userId, fields) {
  if (!userId) throw new Error('Oturum yok');
  const first = (fields.contactFirstName || '').trim();
  const last = (fields.contactLastName || '').trim();
  const p1 = (fields.phoneAuthorized || '').trim();
  const p2 = (fields.phoneRep || '').trim();
  const company = (fields.companyName || '').trim();
  const tax = (fields.taxPlatePath || '').trim();
  if (!company || !first || !last || !p1 || !p2 || !tax) throw new Error('incomplete');

  const row = {
    user_id: userId,
    company_name: company,
    contact_first_name: first,
    contact_last_name: last,
    phone_authorized: p1,
    phone_rep: p2,
    tax_plate_path: tax,
    tax_plate_mime: 'application/pdf',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('agency_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;

  await supabase.auth.updateUser({
    data: {
      first_name: first,
      last_name: last,
      phone: p1,
      phone_rep: p2,
      full_name: `${first} ${last}`.trim(),
      agency_setup_complete: true,
    },
  });

  return fromRow(data);
}
