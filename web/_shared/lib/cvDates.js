// lib/cvDates.js
// CV tarih satırlarını görüntüleme dilinde üret (Devam/Present vb. doğru dilde).
import { t as uiT } from '../i18n/ui';

export function formatExperienceDate(e, lang) {
  if (!e) return '';
  const present = uiT('present', lang);
  if (e.startMonth || e.startYear || e.ongoing) {
    const start = e.startMonth && e.startYear ? `${e.startMonth}.${e.startYear}` : (e.startYear || '');
    const end = e.ongoing
      ? present
      : (e.endMonth && e.endYear ? `${e.endMonth}.${e.endYear}` : (e.endYear || ''));
    return [start, end].filter(Boolean).join(' - ');
  }
  return e.date || '';
}

export function formatEducationDate(e, lang) {
  if (!e) return '';
  const present = uiT('present', lang);
  if (e.startYear || e.ongoing) {
    const start = e.startYear || '';
    const end = e.ongoing ? present : (e.endYear || '');
    return [start, end].filter(Boolean).join(' - ');
  }
  return e.date || '';
}
