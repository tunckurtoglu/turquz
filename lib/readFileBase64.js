// lib/readFileBase64.js
// PDF/uri → base64. Yeni expo-file-system File API yerine legacy kullan
// (statik File import / New API bazı release build'lerde fatal JS üretebiliyor).
export async function readFileBase64(uri) {
  const FS = await import('expo-file-system/legacy');
  return FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
}
