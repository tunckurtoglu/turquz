// lib/docTypes.js
// Aday-yükleme belge kataloğu — TEK KAYNAK. Hem Belgelerim ekranı hem anasayfa sayacı
// bunu kullanır. Belgeler "stage" (aşama) sırasına göre açılır:
//   1: kabul sonrası ilk belgeler   2: imzalı sözleşme   3: konsolosluk ref   4: çalışma izni
// Acenta tarafı belgeler (imzasız sözleşme, uçak bileti, transfer) panel ile gelecek.
// label/desc i18n anahtarları: doc_<kind> / doc_<kind>_desc
export const CANDIDATE_DOCS = [
  // 1. paket (tek seferde, 10 gün): pasaport + diploma + adli sicil + sağlık raporu
  { kind: 'passport',        icon: '🛂', stage: 1, sensitive: false, required: true },
  { kind: 'diploma',         icon: '🎓', stage: 1, sensitive: false, required: true, langNote: true, pdfOnly: true },
  { kind: 'criminal',        icon: '📄', stage: 1, sensitive: true,  required: true, langNote: true, pdfOnly: true },
  { kind: 'health_report',   icon: '🏥', stage: 1, sensitive: true,  required: true, langNote: true, pdfOnly: true },
  { kind: 'contract_signed', icon: '✍️', stage: 2, sensitive: false, required: true, pdfOnly: true },
  { kind: 'consulate_ref',   icon: '🔢', stage: 3, sensitive: false, required: true },
  { kind: 'work_permit',     icon: '🪪', stage: 4, sensitive: false, required: true },
];

// Adayın bulunduğu aşamada görünmesi gereken belgeler.
export function visibleDocs(stage) {
  return CANDIDATE_DOCS.filter((d) => d.stage <= (stage || 0));
}

// Mevcut aşamada eksik (yüklenmemiş) zorunlu belge sayısı.
export function missingDocCount(stage, uploadedKinds) {
  const have = new Set(uploadedKinds || []);
  return visibleDocs(stage).filter((d) => d.required && !have.has(d.kind)).length;
}
