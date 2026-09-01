const normalizeCat = (c) => {
  if (c === 'process' || c === 'hired' || c === 'staff') return 'pipeline';
  return ['ops', 'pool', 'pipeline', 'hotels', 'messages'].includes(c) ? c : 'ops';
};

export function readHash() {
  const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const tab = h.get('tab');
  return {
    cat: normalizeCat(h.get('cat')),
    c: h.get('c'),
    tab: tab === 'docs' || tab === 'iv' ? tab : 'cv',
    emp: h.get('emp') || null,
    empName: h.get('empn') || '',
  };
}

export function writeHash(catVal, cId, tabVal = 'cv', mode = 'replace', employerFilter = undefined) {
  const p = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  if (catVal && catVal !== 'ops') p.set('cat', catVal);
  else p.delete('cat');
  if (cId) p.set('c', cId);
  else p.delete('c');
  if (cId && tabVal && tabVal !== 'cv') p.set('tab', tabVal);
  else p.delete('tab');
  if (employerFilter === null || (catVal && catVal !== 'pipeline')) {
    p.delete('emp');
    p.delete('empn');
  } else if (employerFilter && typeof employerFilter === 'object') {
    if (employerFilter.id) {
      p.set('emp', employerFilter.id);
      if (employerFilter.name) p.set('empn', employerFilter.name);
      else p.delete('empn');
    } else {
      p.delete('emp');
      p.delete('empn');
    }
  }
  const s = p.toString();
  const next = s ? `#${s}` : '';
  if ((window.location.hash || '') === next) return;
  const url = window.location.pathname + window.location.search + next;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

export function writeEmployerPipelineFilter(employerId, employerName = '', mode = 'replace') {
  const p = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  p.set('cat', 'pipeline');
  p.delete('c');
  p.delete('tab');
  if (employerId) {
    p.set('emp', employerId);
    if (employerName) p.set('empn', employerName);
    else p.delete('empn');
  } else {
    p.delete('emp');
    p.delete('empn');
  }
  const next = `#${p.toString()}`;
  if ((window.location.hash || '') === next) return;
  const url = window.location.pathname + window.location.search + next;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}
