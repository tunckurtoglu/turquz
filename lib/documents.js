// lib/documents.js
// Hassas belgelerin (pasaport, adli sicil) private 'documents' bucket'ına yüklenmesi,
// üst-verisinin 'user_documents' tablosunda tutulması ve güvenli (imzalı) okunması.
// Bkz. supabase/migrations/0002_documents_storage.sql
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const BUCKET = 'documents';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

// base64 (ham) + mimeType ile yükler. Her yüklemede BENZERSİZ dosya adı kullanılır; böylece
// CDN önbelleği eski görseli göstermez (üzerine yazma sorunu). Eski dosya sonradan silinir.
export async function uploadDocument(userId, kind, base64, mimeType) {
  if (!userId) throw new Error('Oturum yok');

  // İmzalı sözleşme: ödemesiz yükleme yok (DB trigger/RLS ile de kilitli).
  if (kind === 'contract_signed') {
    const { data: con, error: conErr } = await supabase
      .from('contracts')
      .select('payment_status')
      .eq('user_id', userId)
      .maybeSingle();
    if (conErr) throw conErr;
    const st = con?.payment_status || 'unpaid';
    if (st !== 'paid' && st !== 'waived') {
      throw new Error('contract_payment_required');
    }
  }

  const ext = EXT[mimeType] || 'jpg';
  const path = `${userId}/${kind}_${Date.now()}.${ext}`;

  // Yeni dosyayı yüklemeden önce eski yolu öğren (sonra silmek için).
  const { data: prev } = await supabase
    .from('user_documents')
    .select('storage_path')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: mimeType, upsert: true });
  if (upErr) throw upErr;

  // Yeni yükleme TASLAK'tır: submitted_at = null. Karşı taraf, "Belgeleri Gönder"
  // basılana (submitDocuments) kadar bu belgeyi görmez. Yeniden yükleme de taslağa döner.
  const { data, error } = await supabase
    .from('user_documents')
    .upsert(
      { user_id: userId, kind, storage_path: path, mime_type: mimeType, status: 'uploaded', submitted_at: null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,kind' },
    )
    .select()
    .single();
  if (error) throw error;

  // Eski dosyayı temizle (yeni yol farklıysa).
  if (prev?.storage_path && prev.storage_path !== path) {
    supabase.storage.from(BUCKET).remove([prev.storage_path]).catch(() => {});
  }
  return data;
}

// Belge(leri) GÖNDER: taslağı karşı tarafa ilet (submitted_at = now). Bir adımın
// tüm belgeleri tek seferde gönderilir. Döner: güncellenen satırlar.
export async function submitDocuments(userId, kinds) {
  if (!userId || !kinds?.length) return [];
  const { data, error } = await supabase
    .from('user_documents')
    .update({ submitted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('kind', kinds)
    .select();
  if (error) throw error;
  return data || [];
}

// Kullanıcının tüm belge üst-verisi (kind -> satır eşlemesi için ham liste).
export async function listDocuments(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from('user_documents').select('*').eq('user_id', userId);
  if (error) {
    console.warn('Belgeler okunamadı:', error.message);
    return [];
  }
  return data || [];
}

// Geçici (varsayılan 60 sn) imzalı görüntüleme bağlantısı. Otele iletim de bununla yapılır.
export async function getSignedUrl(path, expiresIn = 60) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

// Pasaportu Edge Function ile doğrula (son kullanma < 1 yıl / okunaklılık).
// Döner: { status, expiryDate, note } veya { error }.
export async function verifyDocument(kind = 'passport') {
  const { data, error } = await supabase.functions.invoke('verify-passport', { body: { kind } });
  if (error) throw error;
  return data;
}

// Acente: belgeyi beğenmedi -> tekrar iste. Belge silinir + adaya 'reupload' bildirimi (RPC).
export async function requestReupload(candidateUserId, kind) {
  const { error } = await supabase.rpc('request_reupload', { p_candidate: candidateUserId, p_kind: kind });
  if (error) throw error;
}

// Belgeyi sil: önce dosya, sonra üst-veri satırı.
export async function removeDocument(userId, kind, path) {
  if (path) await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await supabase.from('user_documents').delete().eq('user_id', userId).eq('kind', kind);
  if (error) throw error;
}

// Bir adayın TÜM belgelerini sil (teklif geri çekme / sıfırlama). Staff delete RLS gerekir (0015).
export async function removeAllDocuments(userId) {
  const rows = await listDocuments(userId);
  const paths = rows.map((r) => r.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from('user_documents').delete().eq('user_id', userId);
  if (error) throw error;
}
