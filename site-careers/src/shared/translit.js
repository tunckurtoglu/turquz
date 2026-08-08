// lib/translit.js
// Kiril (Rusça/Kazakça/Kırgızca/Ukraynaca) -> Latin harf çevirisi. Pasaportlardaki isimler
// Latin yazıldığı için CV/sözleşme/uçuş/acente görünümünde Latin isim kullanılır.
// NOT: Otomatik çeviri pasaportla BİREBİR aynı olmayabilir; aday "Pasaporttaki ad/soyad"
// alanını düzeltebilir (passportFirstName/passportLastName). Düzeltme varsa o kullanılır.

const MAP = {
  // Rusça
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  // Kazakça / Kırgızca ek harfler
  ә: 'a', ғ: 'g', қ: 'q', ң: 'ng', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
  // Ukraynaca ek harfler
  ї: 'yi', є: 'ye', ґ: 'g',
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Tek bir metni Latin'e çevir. Zaten Latin olan karakterler aynen kalır.
export function toLatin(input) {
  if (!input) return '';
  let out = '';
  for (const ch of String(input)) {
    const lower = ch.toLowerCase();
    const mapped = MAP[lower];
    if (mapped === undefined) { out += ch; continue; } // Latin / bilinmeyen: koru
    out += ch !== lower ? cap(mapped) : mapped;
  }
  return out;
}

// Metinde Kiril harf var mı? (çeviri/uyarı göstermek için)
export const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(String(s || ''));

// Pasaport (Latin) ad/soyad: aday düzeltmişse onu, yoksa otomatik çeviriyi döndür.
export const latinFirst = (d = {}) => (d.passportFirstName?.trim() ? d.passportFirstName.trim() : toLatin(d.firstName || ''));
export const latinLast = (d = {}) => (d.passportLastName?.trim() ? d.passportLastName.trim() : toLatin(d.lastName || ''));

// data kopyası: firstName/lastName Latin'e çevrilmiş haliyle (CV/sözleşme/uçuş builder'ları için).
export const withLatinName = (d = {}) => ({ ...d, firstName: latinFirst(d), lastName: latinLast(d) });

// İsim Latin'le örtüşmüyor mu (uyarı gerektirir mi)? Kiril ad/soyad varsa evet.
export const nameNeedsLatin = (d = {}) => hasCyrillic(d.firstName) || hasCyrillic(d.lastName);
