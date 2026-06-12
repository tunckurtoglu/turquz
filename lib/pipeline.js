// lib/pipeline.js
// Aday ↔ acenta sıralı belge akışı. Her adım bir öncekini bekler; belge yüklenince
// sonraki adım otomatik açılır. Hem aday hem acente ekranı bu tanımı kullanır.
//
// owner: o adımdaki belgeyi kimin yükleyeceği ('candidate' | 'agency')
export const PIPELINE = [
  { step: 1, owner: 'candidate', kinds: ['passport'] },                        // ÖNCE pasaport (teklif sonrası 14 gün)
  { step: 2, owner: 'agency',    kinds: ['contract_unsigned'] },               // sonra acente imzasız hizmet sözleşmesi
  { step: 3, owner: 'candidate', kinds: ['contract_signed'] },                 // aday imzalı sözleşme
  { step: 4, owner: 'candidate', kinds: ['diploma', 'criminal'] },             // diploma + sabıka
  { step: 5, owner: 'candidate', kinds: ['consulate_ref'] },                   // konsolosluk ref no
  { step: 6, owner: 'candidate', kinds: ['work_permit'] },                     // çalışma izni / vize
  { step: 7, owner: 'agency',    kinds: ['flight_ticket'] },                   // uçak bileti
];

// Teklif sonrası pasaport için süre (gün).
export const PASSPORT_DEADLINE_DAYS = 14;

// Görüntü için sıralı tüm belgeler: [{ kind, owner, step }]
export const PIPELINE_KINDS = PIPELINE.flatMap((s) => s.kinds.map((k) => ({ kind: k, owner: s.owner, step: s.step })));

export function stepDefForKind(kind) {
  return PIPELINE.find((s) => s.kinds.includes(kind));
}

// has: (kind) => boolean. Aktif adım = ilk tamamlanmamış adım. Hepsi tamamsa son+1.
export function activeStep(has) {
  for (const s of PIPELINE) {
    if (!s.kinds.every((k) => has(k))) return s.step;
  }
  return PIPELINE.length + 1;
}

// Bir belgenin durumu: 'done' (yüklü) | 'active' (sırası gelmiş) | 'locked' (kilitli)
export function kindState(kind, has) {
  if (has(kind)) return 'done';
  const def = stepDefForKind(kind);
  if (!def) return 'locked';
  const act = activeStep(has);
  if (def.step <= act) return 'active';
  return 'locked';
}

// Adayın bekleyen (sırası gelmiş + henüz yüklenmemiş) belge sayısı (anasayfa uyarısı için).
export function candidatePendingCount(has) {
  const act = activeStep(has);
  const def = PIPELINE.find((s) => s.step === act);
  if (!def || def.owner !== 'candidate') return 0;
  return def.kinds.filter((k) => !has(k)).length;
}
