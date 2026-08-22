// Acente “Bugün” — tek odak, düşük gürültü (300–500 kişi için).
// Metinler i18n: titleKey / hintKey / shortKey → t(...)

/** Odak önceliği (üstteki önce). “Tümü” yok. */
export const FOCUS_ORDER = [
  'start_confirm',
  'docs_overdue',
  'boarding',
  'arrival',
  'agency_turn',
  'interview_today',
  'chat',
  'transit',
  'offered_wait',
];

/** Ekranda gösterilen satır üst sınırı (grup başına). */
export const QUEUE_SHOW = 25;

/** API’den grup başına getirilen üst sınır. */
export const QUEUE_FETCH_PER_KIND = 50;

export const PENDING_ACTIONS = [
  {
    key: 'startConfirm',
    filter: 'start_confirm',
    titleKey: 'ops_start_confirm',
    hintKey: 'ops_start_confirm_hint',
    urgent: true,
  },
  {
    key: 'docsOverdue',
    filter: 'docs_overdue',
    titleKey: 'ops_docs_overdue',
    hintKey: 'ops_docs_overdue_hint',
    urgent: true,
  },
  {
    key: 'agencyTurn',
    filter: 'agency_turn',
    titleKey: 'ops_agency_turn',
    hintKey: 'ops_agency_turn_hint',
    urgent: true,
  },
  {
    key: 'boardingRisk',
    filter: 'boarding',
    titleKey: 'ops_boarding',
    hintKey: 'ops_boarding_hint',
    urgent: true,
  },
  {
    key: 'arrivalsSoon',
    filter: 'arrival',
    titleKey: 'ops_arrival',
    hintKey: 'ops_arrival_hint',
    urgent: true,
    cat: 'staff',
    sub: 'arrivals',
    webCat: 'hired',
    webSub: 'arrivals',
  },
  {
    key: 'interviewsToday',
    filter: 'interview_today',
    titleKey: 'ops_interview_today',
    hintKey: 'ops_interview_today_hint',
    urgent: false,
  },
  {
    key: 'chatUnread',
    filter: 'chat',
    cat: 'messages',
    titleKey: 'ops_chat',
    hintKey: 'ops_chat_hint',
    urgent: false,
  },
];

export const OPS_SHORTCUTS = [
  { key: 'pool', shortKey: 'ops_short_pool', cat: 'pool' },
  { key: 'offered', shortKey: 'ops_short_offered', cat: 'process', sub: 'offered' },
  { key: 'process', shortKey: 'ops_short_process', cat: 'process', sub: 'inprocess' },
  { key: 'transit', shortKey: 'ops_transit', cat: 'staff', sub: 'transit', webCat: 'hired', webSub: 'transit' },
  { key: 'hired', shortKey: 'ops_short_hired', cat: 'staff', webCat: 'hired' },
];

/**
 * Süreç özeti (funnel) — sakin envanter; tek odak kuyruğundan ayrı.
 * 9 kutu: Teklif → Mülakat → Belge → Sözleşme → Konsolosluk no → İzin → Bilet → Transfer → Yolda
 */
export const FUNNEL_TILES = [
  { id: 'offered', metricKey: 'funnelOffered', titleKey: 'ops_funnel_offer', nav: { cat: 'process', sub: 'offered' } },
  { id: 'interview', metricKey: 'funnelInterview', titleKey: 'ops_funnel_interview', nav: { cat: 'process', sub: 'interviews' } },
  { id: 'docs', metricKey: 'funnelDocs', titleKey: 'pipe_step_1', nav: { cat: 'process', sub: 'pipe_1' } },
  { id: 'contract', metricKey: 'funnelContract', titleKey: 'pipe_step_2', nav: { cat: 'process', sub: 'pipe_2' } },
  { id: 'ref', metricKey: 'funnelRef', titleKey: 'ops_funnel_ref', nav: { cat: 'process', sub: 'pipe_3' } },
  { id: 'permit', metricKey: 'funnelPermit', titleKey: 'ops_funnel_permit', nav: { cat: 'process', sub: 'pipe_4' } },
  { id: 'flight', metricKey: 'funnelFlight', titleKey: 'pipe_step_5', nav: { cat: 'process', sub: 'pipe_5' } },
  { id: 'transfer', metricKey: 'funnelTransfer', titleKey: 'ops_funnel_transfer', nav: { cat: 'process', sub: 'pipe_6' } },
  { id: 'transit', metricKey: 'funnelTransit', titleKey: 'ops_transit', nav: { cat: 'staff', sub: 'transit', webCat: 'hired', webSub: 'transit' } },
];

/** Filtre id → metrik / i18n. */
export const FOCUS_DEFS = {
  start_confirm: { key: 'startConfirm', titleKey: 'ops_start_confirm', hintKey: 'ops_start_confirm_hint', urgent: true },
  docs_overdue: { key: 'docsOverdue', titleKey: 'ops_docs_overdue', hintKey: 'ops_docs_overdue_hint', urgent: true },
  boarding: { key: 'boardingRisk', titleKey: 'ops_boarding', hintKey: 'ops_boarding_hint', urgent: true },
  arrival: { key: 'arrivalsSoon', titleKey: 'ops_arrival', hintKey: 'ops_arrival_hint', urgent: true, cat: 'staff', sub: 'arrivals' },
  agency_turn: { key: 'agencyTurn', titleKey: 'ops_agency_turn', hintKey: 'ops_agency_turn_hint', urgent: true },
  interview_today: { key: 'interviewsToday', titleKey: 'ops_interview_today', hintKey: 'ops_interview_today_hint', urgent: false },
  chat: { key: 'chatUnread', titleKey: 'ops_chat', hintKey: 'ops_chat_hint', urgent: false, cat: 'messages' },
  transit: { key: 'transit', titleKey: 'ops_transit', hintKey: 'ops_transit_hint', urgent: false },
  offered_wait: { key: 'offered', titleKey: 'ops_offered', hintKey: 'ops_offered_hint', urgent: false },
};

export function countForFocus(filterId, metrics = {}, countsByKind = {}) {
  if (countsByKind[filterId] != null) return Number(countsByKind[filterId]) || 0;
  const def = FOCUS_DEFS[filterId];
  if (!def) return 0;
  return Number(metrics[def.key]) || 0;
}

/** İlk dolu odak grubu; yoksa null (temiz gün). */
export function pickFocusFilter(metrics = {}, countsByKind = {}) {
  for (const id of FOCUS_ORDER) {
    if (countForFocus(id, metrics, countsByKind) > 0) return id;
  }
  return null;
}

/** Sadece dolu gruplar — chip şeridi. */
export function activeFocusGroups(metrics = {}, countsByKind = {}) {
  return FOCUS_ORDER
    .map((id) => {
      const def = FOCUS_DEFS[id];
      const count = countForFocus(id, metrics, countsByKind);
      return def && count > 0 ? { id, ...def, count } : null;
    })
    .filter(Boolean);
}

export function pendingTotal(metrics = {}) {
  return PENDING_ACTIONS.reduce((sum, a) => sum + (Number(metrics[a.key]) || 0), 0);
}

export function urgentTotal(metrics = {}) {
  return PENDING_ACTIONS.filter((a) => a.urgent)
    .reduce((sum, a) => sum + (Number(metrics[a.key]) || 0), 0);
}

/** Sessiz tarama: değişmeyen masayı yeniden çizme. */
export function opsFingerprint(data) {
  const m = data?.metrics || {};
  const metricPart = Object.keys(m).sort().map((k) => `${k}:${m[k]}`).join(',');
  const countPart = Object.entries(data?.countsByKind || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  const queuePart = (data?.queue || [])
    .map((q) => [
      q.kind, q.candidateId, q.detail || '', q.titleKey || '', q.label || '',
      q.openChat ? 1 : 0, q.boarding || '', q.openHireConfirm ? 1 : 0,
    ].join(':'))
    .join('|');
  return `${metricPart}#${countPart}#${queuePart}`;
}

/** Mevcut odak boşaldıysa bir sonrakine geç. */
export function nextFocusAfter(currentId, metrics = {}, countsByKind = {}) {
  if (currentId && countForFocus(currentId, metrics, countsByKind) > 0) return currentId;
  return pickFocusFilter(metrics, countsByKind);
}

export function sliceQueue(queue, filterId, show = QUEUE_SHOW) {
  const rows = (queue || []).filter((q) => q.kind === filterId);
  const total = rows.length;
  return { rows: rows.slice(0, show), shown: Math.min(total, show), total };
}
