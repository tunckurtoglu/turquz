// Metro HBC bazen require()/import() için Promise veya nested default döndürür.
// React'e Promise verme — sadece çözülmüş function component.

function describeMod(mod) {
  if (mod == null) return String(mod);
  if (typeof mod.then === 'function') return 'Promise';
  if (typeof mod === 'function') return 'function';
  if (typeof mod === 'object') return `keys:${Object.keys(mod).slice(0, 12).join(',')}`;
  return typeof mod;
}

/**
 * @param {() => any} requireFn
 * @param {string} label
 * @returns {Promise<Function>}
 */
export async function loadDefaultExport(requireFn, label = 'modül') {
  let mod = requireFn();
  for (let i = 0; i < 5; i += 1) {
    if (mod && typeof mod.then === 'function') {
      mod = await mod;
      continue;
    }
    let C = mod;
    if (mod && typeof mod === 'object') {
      if ('default' in mod) C = mod.default;
      // nested default (bazı HBC çıktıları)
      if (C && typeof C === 'object' && typeof C.default === 'function') C = C.default;
      if (C && typeof C.then === 'function') {
        mod = C;
        continue;
      }
    }
    if (typeof C === 'function') return C;
    throw new Error(`${label} yok (${describeMod(mod)})`);
  }
  throw new Error(`${label} çözülemedi`);
}
