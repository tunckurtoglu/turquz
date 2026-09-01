// Havuz araması: kartta görünen Latin isim + Kiril asıl kayıt + kod.
// Yazıldıkça önek / parça eşleşmesi (modern typeahead).
import { candidateCode, maskedName } from './candidateCode';
import { latinFirst, latinLast, toLatin } from './translit';

const DIGRAPHS = [
  ['shch', 'щ'], ['sh', 'ш'], ['ch', 'ч'], ['kh', 'х'], ['ts', 'ц'],
  ['yu', 'ю'], ['ya', 'я'], ['zh', 'ж'], ['ye', 'є'], ['yi', 'ї'], ['ng', 'ң'],
];

const LATIN_TO_CYR = {
  a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'һ', i: 'и',
  j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р',
  s: 'с', t: 'т', u: 'у', v: 'в', w: 'у', x: 'кс', y: 'ы', z: 'з',
};

/** Arama için sadeleştir: Latin, i/ı birleşik, noktalama yok. */
export function foldSearch(input) {
  return toLatin(String(input || ''))
    .replace(/[İIıi]/g, 'i')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Şş]/g, 's')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function queryTokens(query) {
  return foldSearch(query).split(' ').filter(Boolean);
}

/** Latin sorguyu Kiril tahmini (Айгерим ← Aigerim). */
export function toCyrillicGuess(latin) {
  const s = foldSearch(latin).replace(/\s+/g, '');
  if (!s) return '';
  let out = '';
  let i = 0;
  while (i < s.length) {
    let hit = false;
    for (let d = 0; d < DIGRAPHS.length; d += 1) {
      const [lat, cyr] = DIGRAPHS[d];
      if (s.startsWith(lat, i)) {
        out += cyr;
        i += lat.length;
        hit = true;
        break;
      }
    }
    if (hit) continue;
    out += LATIN_TO_CYR[s[i]] || s[i];
    i += 1;
  }
  return out;
}

export function candidateSearchBlob(row) {
  const d = row?.data || {};
  const code = candidateCode(row?.nationality, row?.reg_no) || '';
  const compact = code.replace(/^([A-Za-z]{2})0+/, '$1');
  const positions = Array.isArray(d.positions) ? d.positions.join(' ') : '';
  return foldSearch([
    latinFirst(d),
    latinLast(d),
    maskedName(d),
    d.firstName,
    d.lastName,
    d.passportFirstName,
    d.passportLastName,
    row?.title,
    row?.nationality,
    positions,
    code,
    compact,
  ].filter(Boolean).join(' '));
}

/** Her yazılan parça, isim/kod içinde geçmeli veya bir kelimenin öneki olmalı. */
export function matchesCandidateQuery(row, query) {
  const toks = queryTokens(query);
  if (!toks.length) return true;
  const blob = candidateSearchBlob(row);
  if (!blob) return false;
  const parts = blob.split(' ');
  return toks.every((tok) => blob.includes(tok) || parts.some((p) => p.startsWith(tok)));
}
