// lib/candidateCode.js
// Acente, adayın kimlik/iletişim/aile bilgilerini GÖRMEZ (platform dışı iletişimi önlemek için).
// İsim yerine uyruk ülke kodu + user_id'den türetilen sabit bir numara gösterilir: ör. "KZ-4827".
// Gerçek veri acentenin cihazına gönderilmez; maskeleme veride yapılır.
import { latinFirst, latinLast } from './translit';

export const NATION_CODE = {
  'Türkiye': 'TR',
  'Azerbaycan': 'AZ',
  'Belarus': 'BY',
  'Gürcistan': 'GE',
  'Kazakistan': 'KZ',
  'Kırgızistan': 'KG',
  'Özbekistan': 'UZ',
  'Rusya': 'RU',
  'Tayland': 'TH',
  'Türkmenistan': 'TM',
  'Ukrayna': 'UA',
  'Diğer': 'XX',
};

// Aday No = ülke kodu + kayıt sırası (4 hane). Ör. Türkiye 1. kayıt -> "TR0001".
// Kod -> uyruk + numara çöz. Ör. "TR0123" -> { nationality:'Türkiye', regNo:123 }
const CODE_TO_NATION = Object.fromEntries(Object.entries(NATION_CODE).map(([nat, code]) => [code, nat]));
export function parseCode(input) {
  const m = String(input || '').toUpperCase().replace(/\s/g, '').match(/^([A-Z]{2})0*(\d+)$/);
  if (!m) return null;
  const nationality = CODE_TO_NATION[m[1]];
  if (!nationality) return null;
  return { nationality, regNo: parseInt(m[2], 10) };
}

export function candidateCode(nationality, regNo) {
  const cc = NATION_CODE[nationality] || 'XX';
  const n = parseInt(regNo, 10);
  return cc + (n ? String(n).padStart(4, '0') : '----');
}

// Acenteye gösterilecek isim: ad tam, soyad sadece baş harf + ".". Ör. "Aigerim N."
// İsim Latin'e çevrilir (pasaportla uyumlu); aday düzeltmişse o kullanılır.
export function maskedName(data) {
  const d = data || {};
  const first = latinFirst(d).trim();
  const last = latinLast(d).trim();
  const li = last ? last.charAt(0).toLocaleUpperCase('tr-TR') + '.' : '';
  return [first, li].filter(Boolean).join(' ');
}

// Acenteye gösterilecek maskelenmiş kopya: iletişim + aile her zaman gizli.
// candidateNo: önceden hesaplanmış aday no.
// revealName=false (ekran): soyad -> baş harf + ".".  revealName=true (otele PDF): gerçek isim.
export function maskCandidate(data, candidateNo, { revealName = false } = {}) {
  const d = data || {};
  const HIDDEN = '••••••••';
  const lf = latinFirst(d);
  const ll = latinLast(d);
  return {
    ...d,
    firstName: lf,
    lastName: revealName ? ll : (ll ? ll.trim().charAt(0).toLocaleUpperCase('tr-TR') + '.' : ''),
    candidateNo: candidateNo || '',
    passportNo: '', // pasaport no acenteye gösterilmez
    email: HIDDEN,
    phone: HIDDEN,
    phoneConfirm: HIDDEN,
    location: HIDDEN,
    family: {
      mother: { name: HIDDEN, lastName: HIDDEN, phone: HIDDEN },
      father: { name: HIDDEN, lastName: HIDDEN, phone: HIDDEN },
    },
  };
}
