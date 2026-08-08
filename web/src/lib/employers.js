// web/src/lib/employers.js — mobil lib/employers.js ile aynı mantık (web supabase).
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
  };
}

function toRow(agencyId, f) {
  return {
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
}

export function employerToContractFields(employer) {
  if (!employer) return {};
  return {
    title: employer.title || '',
    address: employer.address || '',
    phone: employer.phone || '',
    email: employer.email || '',
    contactPhone: employer.contactPhone || '',
    contactEmail: employer.contactEmail || '',
  };
}

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

export async function listEmployers(agencyId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('agency_employers')
    .select('*')
    .eq('agency_id', agencyId)
    .order('last_used_at', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
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

export async function touchEmployer(agencyId, id) {
  if (!agencyId || !id) return;
  await supabase.from('agency_employers')
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('agency_id', agencyId);
}

export async function deleteEmployer(agencyId, id) {
  if (!agencyId || !id) return;
  const { error } = await supabase.from('agency_employers').delete().eq('id', id).eq('agency_id', agencyId);
  if (error) throw error;
}
