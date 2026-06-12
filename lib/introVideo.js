// lib/introVideo.js
// 20 sn'lik tanıtım videosu: 'documents' bucket'ına yüklenir (storage YOLU saklanır, base64 değil).
// Aday + acente imzalı URL ile oynatır (WebView içinde HTML5 <video>).
import { supabase } from './supabase';

const BUCKET = 'documents';
export const INTRO_VIDEO_MAX_SEC = 20;

// Yerel video uri -> storage'a AKITARAK yükler (base64 YOK, hızlı/az bellek) -> path döner.
export async function uploadIntroVideo(userId, uri, onProgress) {
  if (!userId) throw new Error('Oturum yok');
  // Her yükleme BENZERSİZ yol -> "Kaydet/Vazgeç/Değiştir" akışında eskiyle çakışmaz.
  const path = `${userId}/intro_${Date.now()}.mp4`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  const FS = await import('expo-file-system/legacy');
  const opts = {
    httpMethod: 'PUT',
    uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'content-type': 'video/mp4', 'x-upsert': 'true' },
  };
  const task = FS.createUploadTask(data.signedUrl, uri, opts, (p) => {
    if (onProgress && p.totalBytesExpectedToSend > 0) onProgress(p.totalBytesSent / p.totalBytesExpectedToSend);
  });
  const res = await task.uploadAsync();
  if (!res || res.status >= 300) throw new Error('upload_failed_' + (res && res.status));
  return path;
}

// Videoyu sil (storage + profilden temizlenmesi ayrıca saveProfile ile yapılır).
export async function removeIntroVideo(path) {
  if (!path || /^https?:\/\//.test(path)) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

// storage yolu -> imzalı oynatma URL'i. Zaten http(s) ise olduğu gibi döner.
export async function getIntroVideoUrl(path, expires = 3600) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expires);
  if (error) { console.warn('intro video url:', error.message); return null; }
  return data?.signedUrl || null;
}
