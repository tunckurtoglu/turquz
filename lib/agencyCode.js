// Acente No = AG + kayıt sırası (4 hane). Ör. "AG0001".
export function agencyCode(regNo) {
  const n = parseInt(regNo, 10);
  return 'AG' + (n ? String(n).padStart(4, '0') : '----');
}

export function parseAgencyCode(input) {
  const m = String(input || '').toUpperCase().replace(/\s/g, '').match(/^AG0*(\d+)$/);
  if (!m) return null;
  return { regNo: parseInt(m[1], 10) };
}
