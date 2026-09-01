// lib/certificateAwards.js
// Kalıcı başarı sertifikası (işletme silinse de kalır; user_documents dışında).
import { supabase } from './supabase';

const BUCKET = 'certificate-awards';

export async function getMyCertificateAward(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('certificate_awards')
    .select('id, issued_at, email_sent_at, email_to, storage_path, snapshot')
    .eq('candidate_id', userId)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('certificate_awards:', error.message);
    return null;
  }
  return data;
}

export async function getCertificateAwardUrl(storagePath, expiresIn = 120) {
  if (!storagePath) throw new Error('missing');
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
