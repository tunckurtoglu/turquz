// lib/employers.js
// Acentenin kayıtlı işletme (işveren) şablonları — sözleşme formu + işletme kaşesi.
import { supabase } from './supabase';

function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name || '',
    title: r.title || '',
    address: r.address || '',
    phone: r.phone || '',
    email: r.email || '',
    contactPhone: r.contact_phone || '',
    contactEmail: r.contact_email || '',
    lastUsedAt: r.last_used_at || null,
    stampImage: r.stamp_image || null,
    stampSignerName: r.stamp_signer_name || '',
    stampSignerTitle: r.stamp_signer_title || '',
    hasStamp: !!(r.stamp_image),
    taxPlatePath: r.tax_plate_path || null,
    taxPlateMime: r.tax_plate_mime || null,
    hasTaxPlate: !!(r.tax_plate_path),
    taxNo: r.tax_no || '',
    taxOffice: r.tax_office || '',
    taxPlateParsedAt: r.tax_plate_parsed_at || null,
  };
}

function toRow(agencyId, f) {
  const row = {
    agency_id: agencyId,
    name: (f.name || '').trim(),
    title: f.title || null,
    address: f.address || null,
    phone: f.phone || null,
    email: f.email || null,
    contact_phone: f.contactPhone || null,
    contact_email: f.contactEmail || null,
    updated_at: new Date().toISOString(),
  };
  if (f.stampImage !== undefined) row.stamp_image = f.stampImage || null;
  if (f.stampSignerName !== undefined) row.stamp_signer_name = (f.stampSignerName || '').trim() || null;
  if (f.stampSignerTitle !== undefined) row.stamp_signer_title = (f.stampSignerTitle || '').trim() || null;
  if (f.taxNo !== undefined) row.tax_no = (f.taxNo || '').trim() || null;
  if (f.taxOffice !== undefined) row.tax_office = (f.taxOffice || '').trim() || null;
  return row;
}

/** İşletme şablonundan sözleşme formunun işveren bölümüne giden alanlar. */
export function employerToContractFields(employer) {
  if (!employer) return {};
  return {
    title: employer.title || '',
    address: employer.address || '',
    phone: employer.phone || '',
    email: employer.email || '',
    contactPhone: employer.contactPhone || '',
    contactEmail: employer.contactEmail || '',
    employerId: employer.id || null,
  };
}

/** Seçilen işletmeyi mevcut sözleşme taslağına birleştir (pozisyon/maaş/konsolosluk korunur). */
export function mergeEmployerIntoContract(existing, employer) {
  const base = existing || {};
  return {
    ...base,
    ...employerToContractFields(employer),
    position: base.position || '',
    salary: base.salary || '',
    consulate: base.consulate || '',
    issueDate: base.issueDate || '',
  };
}

export function employerStampInfo(employer) {
  if (!employer?.stampImage) return null;
  return {
    image: employer.stampImage,
    name: employer.stampSignerName || employer.name || employer.title || '',
    subtitle: employer.stampSignerTitle || '',
  };
}

/** Sözleşme için zorunlu: vergi levhası + kaşe. */
export function employerReadyForContract(employer) {
  return !!(employer?.id && employer.hasTaxPlate && employer.hasStamp && employer.stampImage);
}

export function employerContractBlockReason(employer) {
  if (!employer?.id) return 'missing';
  const needTax = !employer.hasTaxPlate;
  const needStamp = !employer.hasStamp || !employer.stampImage;
  if (needTax && needStamp) return 'both';
  if (needTax) return 'tax';
  if (needStamp) return 'stamp';
  return null;
}

export async function listEmployers(agencyId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('agency_employers')
    .select('*')
    .eq('agency_id', agencyId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) {
    console.warn('İşletmeler okunamadı:', error.message);
    return [];
  }
  return (data || []).map(fromRow);
}

export async function getEmployer(agencyId, id) {
  if (!agencyId || !id) return null;
  const { data, error } = await supabase
    .from('agency_employers')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('id', id)
    .maybeSingle();
  if (error) { console.warn(error.message); return null; }
  return fromRow(data);
}

export async function saveEmployer(agencyId, fields, id) {
  if (!agencyId) throw new Error('Oturum yok');
  const name = (fields.name || '').trim();
  if (!name) throw new Error('name_required');
  const row = toRow(agencyId, { ...fields, name });
  if (id) {
    const { data, error } = await supabase.from('agency_employers').update(row).eq('id', id).eq('agency_id', agencyId).select().single();
    if (error) throw error;
    return fromRow(data);
  }
  const { data, error } = await supabase.from('agency_employers').insert(row).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function saveEmployerStamp(agencyId, employerId, { image, signerName, signerTitle }) {
  if (!agencyId || !employerId) throw new Error('missing');
  if (!image) throw new Error('stamp_need_image');
  const name = (signerName || '').trim();
  if (!name) throw new Error('stamp_need_name');
  const { data, error } = await supabase
    .from('agency_employers')
    .update({
      stamp_image: image,
      stamp_signer_name: name,
      stamp_signer_title: (signerTitle || '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employerId)
    .eq('agency_id', agencyId)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function clearEmployerStamp(agencyId, employerId) {
  if (!agencyId || !employerId) return;
  const { error } = await supabase
    .from('agency_employers')
    .update({
      stamp_image: null,
      stamp_signer_name: null,
      stamp_signer_title: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employerId)
    .eq('agency_id', agencyId);
  if (error) throw error;
}

export async function touchEmployer(agencyId, id) {
  if (!agencyId || !id) return;
  await supabase.from('agency_employers')
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('agency_id', agencyId);
}

export async function deleteEmployer(agencyId, id) {
  if (!agencyId || !id) return;
  const { data, error } = await supabase
    .from('agency_employers')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('delete_failed');
}

/** Path: {agencyId}/employers/{employerId}/vergi_levhasi.pdf */
export async function uploadEmployerTaxPlate(agencyId, employerId, base64, mime = 'application/pdf') {
  if (!agencyId || !employerId || !base64) throw new Error('missing');
  const { decode } = await import('base64-arraybuffer');
  const path = `${agencyId}/employers/${employerId}/vergi_levhasi.pdf`;
  const { error: upErr } = await supabase.storage
    .from('agency-docs')
    .upload(path, decode(base64), { contentType: mime || 'application/pdf', upsert: true });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from('agency_employers')
    .update({
      tax_plate_path: path,
      tax_plate_mime: mime || 'application/pdf',
      tax_plate_parsed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', employerId)
    .eq('agency_id', agencyId)
    .select('*')
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function getEmployerTaxPlateUrl(agencyId, employerId, expiresIn = 3600) {
  const emp = await getEmployer(agencyId, employerId);
  if (!emp?.taxPlatePath) return null;
  const { data, error } = await supabase.storage
    .from('agency-docs')
    .createSignedUrl(emp.taxPlatePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

/** Gemini ile vergi levhasından unvan/adres vb. doldur. */
export async function parseEmployerTaxPlate(employerId) {
  if (!employerId) throw new Error('missing');
  const { data, error } = await supabase.functions.invoke('parse-employer-tax', {
    body: { employerId },
  });
  const bodyErr = data?.error || (await error?.context?.json?.().catch?.(() => null))?.error;
  if (bodyErr) throw new Error(bodyErr);
  if (error) throw error;
  return data?.employer ? fromRow(data.employer) : null;
}
