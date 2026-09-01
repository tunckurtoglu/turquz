// lib/pipeline.js
// Aday ↔ acenta sıralı belge akışı. Her adım bir öncekini bekler; belge yüklenince
// sonraki adım otomatik açılır. Hem aday hem acente ekranı bu tanımı kullanır.
//
// owner: adımın varsayılan sorumlusu ('candidate' | 'agency' | 'shared')
// shared: aynı kartta acente + aday belgeleri (sözleşme görüntüle → imzalı yükle)
export const PIPELINE = [
  // 1) İLK PAKET: aday tüm bu belgeleri TEK SEFERDE 14 gün içinde gönderir.
  { step: 1, owner: 'candidate', titleKey: 'pipe_step_1', kinds: ['passport', 'diploma', 'criminal', 'health_report'] },
  // 2) Sözleşme: acente gönderir → aday görüntüler/indirir → imzalı yükler (tek aşama)
  { step: 2, owner: 'shared', titleKey: 'pipe_step_2', kinds: ['contract_unsigned', 'contract_signed'] },
  { step: 3, owner: 'candidate', titleKey: 'pipe_step_3', kinds: ['consulate_ref'] },
  { step: 4, owner: 'candidate', titleKey: 'pipe_step_4', kinds: ['work_permit'] },
  { step: 5, owner: 'agency', titleKey: 'pipe_step_5', kinds: ['flight_ticket'] },
];

// İlk belge paketi için süre (gün).
export const PASSPORT_DEADLINE_DAYS = 14;
/** Konsolosluk referans numarası yükleme süresi (imzalı sözleşmeden sonra). */
export const CONSULATE_DEADLINE_DAYS = 7;
/** Adayın veya acentenin bir kez verebileceği ek süre. */
export const DOCS_EXTRA_DAYS = 3;

/** Belgeyi kim yükler / tamamlar? */
export function kindOwner(kind) {
  if (kind === 'success_certificate') return 'admin';
  if (kind === 'contract_unsigned' || kind === 'flight_ticket') return 'agency';
  return 'candidate';
}

/** Aktif adımda kart etiketinin kime göre gösterileceği (shared adım dinamik). */
export function stepActor(stepDef, has) {
  if (!stepDef) return 'candidate';
  if (stepDef.owner !== 'shared') return stepDef.owner;
  // Sözleşme: imzasız yoksa acente sırası; varsa aday sırası
  if (!has('contract_unsigned')) return 'agency';
  return 'candidate';
}

// Görüntü için sıralı tüm belgeler: [{ kind, owner, step }]
export const PIPELINE_KINDS = PIPELINE.flatMap((s) =>
  s.kinds.map((k) => ({ kind: k, owner: kindOwner(k), step: s.step })),
);

export function stepDefForKind(kind) {
  return PIPELINE.find((s) => s.kinds.includes(kind));
}

export const JOURNEY_COUNT = 9;

/**
 * Görünen kariyer adımı (1–9).
 * 6 transfer · 7 çalışma dönemi · 8 forum (yakında) · 9 başarı sertifikası (yakında).
 * Forum açılana kadar sezon bitince adım 8’de kalır; sertifika forumsuz verilmez.
 * @param {(k: string) => boolean} has
 * @param {boolean} pickupSent
 * @param {{ hired?: boolean, seasonComplete?: boolean, forumDone?: boolean }} [opts]
 */
export function journeyStep(has, pickupSent, opts = {}) {
  const hired = !!opts.hired;
  const seasonComplete = !!opts.seasonComplete;
  const forumDone = !!opts.forumDone;
  const act = activeStep(has);
  if (act <= 5) return act;
  if (!(has('flight_ticket') || pickupSent)) return 6;
  if (!hired) return 6;
  if (!seasonComplete) return 7;
  // Forum henüz yok — herkes 8’de (yakında). İleride forumDone ile 9’a geçilir.
    if (!forumDone) return 8;
  const certDone = !!opts.certificateIssued || has('success_certificate');
  if (!certDone) return 9;
  return JOURNEY_COUNT + 1;
}

export function journeyTitleKey(step) {
  if (step >= 1 && step <= 9) return `pipe_step_${step}`;
  return null;
}

/** Sezon bitti mi? (forum / sertifika adımları için) */
export function seasonCompleteFromEpisode(episode) {
  const o = episode?.outcome;
  return o === 'completed' || o === 'early_exit';
}

// has: (kind) => boolean. Aktif adım = ilk tamamlanmamış adım. Hepsi tamamsa son+1.
export function activeStep(has) {
  for (const s of PIPELINE) {
    if (!s.kinds.every((k) => has(k))) return s.step;
  }
  return PIPELINE.length + 1;
}

// Bir belgenin durumu: 'done' (gönderilmiş) | 'active' (sırası gelmiş) | 'locked' (kilitli)
export function kindState(kind, has) {
  if (has(kind)) return 'done';
  const def = stepDefForKind(kind);
  if (!def) return 'locked';
  const act = activeStep(has);
  if (def.step > act) return 'locked';
  const owner = kindOwner(kind);
  const idx = def.kinds.indexOf(kind);
  const waitFor = def.kinds.slice(0, idx).filter((k) => kindOwner(k) !== owner);
  if (!waitFor.every((k) => has(k))) return 'locked';
  return 'active';
}

// Adayın bekleyen (sırası gelmiş + henüz yüklenmemiş) belge sayısı (anasayfa uyarısı için).
export function candidatePendingCount(has) {
  const act = activeStep(has);
  const def = PIPELINE.find((s) => s.step === act);
  if (!def) return 0;
  if (stepActor(def, has) !== 'candidate') return 0;
  return def.kinds.filter((k) => kindOwner(k) === 'candidate' && !has(k)).length;
}
