// lib/agencyHomeUi.js
// Acente havuz ekranı stage değişince unmount olur; UI durumunu burada tutarız
// ki aday detayından geri dönünce favori filtresi / sekme korunur.

export const PIPELINE_STAGES = [
  { id: 'interviews', labelKey: 'sub_interviews' },
  { id: 'concluded', labelKey: 'sub_concluded' },
  { id: 'offered', labelKey: 'sub_offered' },
  { id: 'inprocess', labelKey: 'sub_inprocess' },
  { id: 'arrivals', labelKey: 'staff_tab_arrivals' },
  { id: 'transit', labelKey: 'ops_transit' },
  { id: 'staff', labelKey: 'staff_tab_list' },
  { id: 'former', labelKey: 'staff_tab_former' },
];

/** Günlük kullanım — şeritte görünen 6 aşama */
export const PIPELINE_STAGES_PRIMARY = [
  { id: 'interviews', labelKey: 'sub_interviews' },
  { id: 'offered', labelKey: 'sub_offered' },
  { id: 'inprocess', labelKey: 'sub_inprocess' },
  { id: 'arrivals', labelKey: 'staff_tab_arrivals' },
  { id: 'transit', labelKey: 'ops_transit' },
  { id: 'staff', labelKey: 'staff_tab_list' },
];

/** Nadiren açılan — “Daha fazla” menüsünde */
export const PIPELINE_STAGES_MORE = [
  { id: 'concluded', labelKey: 'sub_concluded' },
  { id: 'former', labelKey: 'staff_tab_former' },
];

const MORE_STAGE_IDS = new Set(PIPELINE_STAGES_MORE.map((s) => s.id));

export function isPipelineMoreStage(stage) {
  return MORE_STAGE_IDS.has(stage);
}

const PROCESS_STAGES = new Set(['interviews', 'concluded', 'offered', 'inprocess']);
const STAFF_STAGES = new Set(['arrivals', 'transit', 'staff', 'former']);

export function isProcessPipelineStage(stage) {
  return PROCESS_STAGES.has(stage);
}

export function isStaffPipelineStage(stage) {
  return STAFF_STAGES.has(stage);
}

/** Eski process/staff sekmelerini tek pipeline görünümüne çevir. */
export function normalizeAgencyView(view) {
  if (view === 'process' || view === 'staff' || view === 'hired') return 'pipeline';
  if (view === 'messages') return 'ops';
  if (['ops', 'pool', 'pipeline', 'hotels'].includes(view)) return view;
  return 'ops';
}

export function normalizePipelineStage(stage, legacy = {}) {
  if (stage && (PROCESS_STAGES.has(stage) || STAFF_STAGES.has(stage))) return stage;
  const { view, subView, staffView } = legacy;
  if (view === 'staff' || view === 'hired') {
    if (staffView === 'transit' || staffView === 'arrivals' || staffView === 'former') return staffView;
    return 'staff';
  }
  if (subView && PROCESS_STAGES.has(subView)) return subView;
  return 'interviews';
}

/** Ops desk / deep-link → pipeline stage */
export function stageFromOpsNav(cat, sub) {
  if (cat === 'messages') return null;
  if (cat === 'hired' || cat === 'staff') {
    if (sub === 'transit' || sub === 'arrivals' || sub === 'former') return sub;
    return 'staff';
  }
  if (cat === 'process') {
    if (typeof sub === 'string' && sub.startsWith('pipe_')) return 'inprocess';
    if (sub && PROCESS_STAGES.has(sub)) return sub;
    return 'inprocess';
  }
  return null;
}

let ui = {
  view: 'ops',
  pipelineStage: 'interviews',
  subView: 'interviews', // geriye dönük
  poolSort: 'online',
  advFilters: {},
  favOn: false,
};

export function readAgencyHomeUi() {
  return ui;
}

export function writeAgencyHomeUi(patch) {
  const next = { ...ui, ...patch };
  next.view = normalizeAgencyView(next.view);
  next.pipelineStage = normalizePipelineStage(next.pipelineStage, next);
  next.subView = isProcessPipelineStage(next.pipelineStage) ? next.pipelineStage : next.subView;
  ui = next;
}

export function resetAgencyHomeUi() {
  ui = {
    view: 'ops',
    pipelineStage: 'interviews',
    subView: 'interviews',
    poolSort: 'online',
    advFilters: {},
    favOn: false,
  };
}
