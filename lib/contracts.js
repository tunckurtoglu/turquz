// lib/contracts.js
// İş sözleşmesi verisi (acentenin doldurduğu alanlar). Aday user_id'ye bağlı.
import { supabase } from './supabase';

// camelCase (uygulama) <-> snake_case (db) eşlemesi
function toRow(f, agencyId) {
  return {
    title: f.title || null,
    address: f.address || null,
    phone: f.phone || null,
    email: f.email || null,
    contact_phone: f.contactPhone || null,
    contact_email: f.contactEmail || null,
    position: f.position || null,
    salary: f.salary || null,
    consulate: f.consulate || null,
    issue_date: f.issueDate || null,
    employer_id: f.employerId || null,
    created_by: agencyId || null,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(r) {
  if (!r) return null;
  const paymentStatus = r.payment_status || 'unpaid';
  return {
    title: r.title || '',
    address: r.address || '',
    phone: r.phone || '',
    email: r.email || '',
    contactPhone: r.contact_phone || '',
    contactEmail: r.contact_email || '',
    position: r.position || '',
    salary: r.salary || '',
    consulate: r.consulate || '',
    issueDate: r.issue_date || '',
    employerId: r.employer_id || null,
    paymentStatus,
    paidAt: r.paid_at || null,
    /** paid veya waived → PDF indirme / app’te imzalı yükleme açık */
    isPaid: paymentStatus === 'paid' || paymentStatus === 'waived',
  };
}

export async function getContract(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.from('contracts').select('*').eq('user_id', candidateUserId).maybeSingle();
  if (error) { console.warn('Sözleşme okunamadı:', error.message); return null; }
  return fromRow(data);
}

// Sözleşme verisini kaydet (upsert). issueDate verilmezse mevcut korunur / bugünün tarihi atanır.
export async function saveContract(candidateUserId, fields, agencyId) {
  const row = { user_id: candidateUserId, ...toRow(fields, agencyId) };
  const { error } = await supabase.from('contracts').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

// Sözleşme verisini sil (teklif geri çekme / sıfırlama).
export async function deleteContract(candidateUserId) {
  const { error } = await supabase.from('contracts').delete().eq('user_id', candidateUserId);
  if (error) throw error;
}
