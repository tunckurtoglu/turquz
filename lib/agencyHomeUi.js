// lib/agencyHomeUi.js
// Acente havuz ekranı stage değişince unmount olur; UI durumunu burada tutarız
// ki aday detayından geri dönünce favori filtresi / sekme korunur.

let ui = {
  view: 'ops',
  subView: 'interviews',
  poolSort: 'online',
  advFilters: {},
  favEmployer: null, // { id, name } | null
};

export function readAgencyHomeUi() {
  return ui;
}

export function writeAgencyHomeUi(patch) {
  ui = { ...ui, ...patch };
}

export function resetAgencyHomeUi() {
  ui = {
    view: 'ops',
    subView: 'interviews',
    poolSort: 'online',
    advFilters: {},
    favEmployer: null,
  };
}
