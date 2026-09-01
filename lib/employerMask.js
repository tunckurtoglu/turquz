/** İşletme adını aday panelinde sansürler: "Zeynel Hotel" → "Z..." */
export function maskEmployerName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '—';
  return `${raw.charAt(0).toUpperCase()}...`;
}
