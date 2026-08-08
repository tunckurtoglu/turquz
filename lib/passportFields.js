// lib/passportFields.js
// Pasaport OCR'dan gelen doğum yerini profile yazmadan önce süz.
// AI bazen ikamet adresini (CV location) veya veriliş yerini doğum yeri sanabiliyor.

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Pasaporttan okunan doğum yeri güvenilir mi? (ikamet adresi / yalnızca uyruk değilse)
export function sanitizeBirthPlace(placeOfBirth, profile = {}) {
  const pob = String(placeOfBirth || '').trim();
  if (!pob) return null;

  const pobN = norm(pob);
  const locN = norm(profile.location);
  const natN = norm(profile.nationality);

  if (locN && pobN === locN) return null;
  if (locN && locN.length > 8 && pobN.length > 8 && (locN.includes(pobN) || pobN.includes(locN))) return null;
  if (natN && pobN === natN) return null;

  return pob;
}

// Pasaport doğrulaması sonrası birthPlace güncellensin mi?
export function birthPlaceFromOcr(placeOfBirth, profile = {}) {
  return sanitizeBirthPlace(placeOfBirth, profile);
}
