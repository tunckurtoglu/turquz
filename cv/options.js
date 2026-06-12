// cv/options.js
// Filtrelemenin çalışabilmesi için kullanılan SABİT seçenek listeleri.
// DEĞERLER (value) hiç değişmez; sadece görünen ETİKET dile göre çevrilir.
// Mevcut bir değeri değiştirmekten kaçın (eski kayıtların filtresi bozulur); ekleme yap.
import {
  LANG_LABELS, LEVEL_LABELS, NATION_LABELS, EDU_LABELS, YESNO_LABELS,
  POSITION_LABELS, SKILL_LABELS, LICENSE_WORD_LABELS,
} from '../i18n/optionLabels';

// value listesini, seçili dilde { label, value } dizisine çevirir.
// Sözlükte karşılık yoksa İngilizce'ye, o da yoksa value'nun kendisine düşer.
const labelize = (values, dict, lang) =>
  values.map((v) => ({
    value: v,
    label: (dict[v] && (dict[v][lang] || dict[v].en)) || v,
  }));

// Tek bir değeri seçili dilde etikete çevirir (CV'de değer göstermek için)
export const labelOf = (dict, value, lang) =>
  (dict[value] && (dict[value][lang] || dict[value].en)) || value || '';

const range = (from, to, step = 1) => {
  const a = [];
  if (from <= to) for (let i = from; i <= to; i += step) a.push(i);
  else for (let i = from; i >= to; i -= step) a.push(i);
  return a;
};

export const LANGUAGES = [
  'Türkçe', 'İngilizce', 'Rusça', 'Almanca', 'Arapça',
  'Fransızca', 'İspanyolca', 'Ukraynaca', 'Farsça', 'Çince', 'İtalyanca',
];

export const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Anadil'];

// Türkiye en üstte; gerisi Türkçe alfabetik; 'Diğer' en sonda.
const _OTHER_NATIONS = [
  'Azerbaycan', 'Belarus', 'Gürcistan', 'Kazakistan', 'Kırgızistan',
  'Özbekistan', 'Rusya', 'Tayland', 'Türkmenistan', 'Ukrayna',
].sort((a, b) => a.localeCompare(b, 'tr'));
export const NATIONALITIES = ['Türkiye', ..._OTHER_NATIONS, 'Diğer'];

export const EDUCATION_LEVELS = ['Lise', 'Ön Lisans', 'Lisans', 'Yüksek Lisans', 'Doktora'];

// Ehliyet alındığı ülkeye göre harf/sınıf sistemi.
// NATIONALITIES'teki ülkelerle aynı anahtarlar kullanılır.
// AB/Sovyet tarzı sistemler benzer olduğundan ortak bir liste paylaşıyor.
const _EU_SOVIET = ['Yok', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'];

export const LICENSE_BY_COUNTRY = {
  'Türkiye': ['Yok', 'M', 'A1', 'A2', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'F', 'G'],
  'Azerbaycan': _EU_SOVIET,
  'Belarus': _EU_SOVIET,
  'Gürcistan': _EU_SOVIET,
  'Kazakistan': _EU_SOVIET,
  'Kırgızistan': _EU_SOVIET,
  'Özbekistan': _EU_SOVIET,
  'Rusya': ['Yok', 'M', 'A1', 'A', 'B1', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'Tm', 'Tb'],
  'Türkmenistan': _EU_SOVIET,
  'Ukrayna': _EU_SOVIET,
  'Tayland': ['Yok', 'Motosiklet', 'Otomobil (Özel)', 'Kamyon', 'Otobüs', 'Toplu Taşıma'],
  'Diğer': ['Yok', 'A', 'B', 'C', 'D', 'E'],
};

// Geriye dönük uyum (eski Select kullanımı için)
export const LICENSE_CLASSES = ['Yok', 'B', 'A', 'A2', 'C', 'D', 'E'];

// ---- Kan grubu ----
// DEĞER (value) evrensel ve sabit: filtre/CV için hiç değişmez.
// GÖSTERİM (label) ülkeye göre biçimlenir (ehliyet gibi ülkeye bağlı).
//   - 'western': A Rh+, 0 Rh+ ... (TR, Tayland, Diğer)
//   - 'soviet' : Roma rakamı, II(A) Rh+, I(0) Rh+ ... (Rusya ve eski Sovyet ülkeleri)
export const BLOOD_VALUES = ['0-pos', '0-neg', 'A-pos', 'A-neg', 'B-pos', 'B-neg', 'AB-pos', 'AB-neg'];

// Her değer için ABO grubu + Rh işareti (gösterim üretiminde kullanılır)
const _BLOOD_PARTS = {
  '0-pos': { abo: '0', oLetter: 'O', roman: 'I',   rh: '+' },
  '0-neg': { abo: '0', oLetter: 'O', roman: 'I',   rh: '−' },
  'A-pos': { abo: 'A', oLetter: 'A', roman: 'II',  rh: '+' },
  'A-neg': { abo: 'A', oLetter: 'A', roman: 'II',  rh: '−' },
  'B-pos': { abo: 'B', oLetter: 'B', roman: 'III', rh: '+' },
  'B-neg': { abo: 'B', oLetter: 'B', roman: 'III', rh: '−' },
  'AB-pos': { abo: 'AB', oLetter: 'AB', roman: 'IV', rh: '+' },
  'AB-neg': { abo: 'AB', oLetter: 'AB', roman: 'IV', rh: '−' },
};

// Ülkeye göre gösterim stili
const BLOOD_STYLE_BY_COUNTRY = {
  'Türkiye': 'western',
  'Azerbaycan': 'soviet',
  'Belarus': 'soviet',
  'Gürcistan': 'soviet',
  'Kazakistan': 'soviet',
  'Kırgızistan': 'soviet',
  'Özbekistan': 'soviet',
  'Rusya': 'soviet',
  'Türkmenistan': 'soviet',
  'Ukrayna': 'soviet',
  'Tayland': 'western',
  'Diğer': 'western',
};

// Kan grubu seçeneklerini ülkeye göre { value, label } olarak üret.
// Değer sabit; sadece gösterim ülkenin yaygın yazımına göre biçimlenir.
export function bloodOptions(country) {
  const style = BLOOD_STYLE_BY_COUNTRY[country] || 'western';
  return BLOOD_VALUES.map((v) => {
    const p = _BLOOD_PARTS[v];
    let label;
    if (style === 'soviet') {
      label = `${p.roman} (${p.abo}) Rh${p.rh}`;       // II (A) Rh+
    } else {
      label = `${p.abo} Rh${p.rh}`;                     // A Rh+
    }
    return { value: v, label };
  });
}

export const YES_NO = ['Yok', 'Var'];

export const POSITIONS = [
  'Guest Relations', 'Resepsiyon / Önbüro', 'Çocuk Animatörü', 'Animasyon',
  'Garson / Servis', 'Bar', 'Host / Hostes', 'Komi', 'Kat Hizmetleri (Housekeeping)',
  'Aşçı / Mutfak', 'Bellboy', 'Spa & Wellness', 'Masör / Masöz', 'Bakıcı',
  'Satış & Pazarlama', 'Muhasebe', 'Güvenlik', 'Teknik Servis',
];

export const SKILLS = [
  'Misafir İlişkileri', 'Servis ve Sunum Becerileri', 'Etkili İletişim',
  'Takım Çalışması ve Uyum', 'Problem Çözme', 'Stres Yönetimi',
  'Bar Bilgisi', 'Kasa / POS Kullanımı', 'Şikayet Yönetimi',
  'Zaman Yönetimi', 'Çok Dillilik', 'Hijyen / HACCP',
];

// ---- Sayısal / tarih seçenekleri (filtre için) ----
const THIS_YEAR = new Date().getFullYear();

// label gösterimde "163 cm", value sade "163" (filtre/hesap için)
export const HEIGHTS = range(140, 210).map((n) => ({ label: `${n} cm`, value: String(n) }));
export const WEIGHTS = range(40, 150).map((n) => ({ label: `${n} kg`, value: String(n) }));

export const DAYS = range(1, 31).map((n) => String(n).padStart(2, '0'));

export const MONTHS = [
  { label: 'Ocak', value: '01' }, { label: 'Şubat', value: '02' }, { label: 'Mart', value: '03' },
  { label: 'Nisan', value: '04' }, { label: 'Mayıs', value: '05' }, { label: 'Haziran', value: '06' },
  { label: 'Temmuz', value: '07' }, { label: 'Ağustos', value: '08' }, { label: 'Eylül', value: '09' },
  { label: 'Ekim', value: '10' }, { label: 'Kasım', value: '11' }, { label: 'Aralık', value: '12' },
];

// Ay adları çok dilli (value '01'..'12' sabit kalır, filtre/CV bozulmaz)
const MONTH_NAMES = {
  '01': { tr:'Ocak', en:'January', ru:'Январь', kk:'Қаңтар', de:'Januar', th:'มกราคม', uz:'Yanvar', fa:'ژانویه', ky:'Январь', tk:'Ýanwar' },
  '02': { tr:'Şubat', en:'February', ru:'Февраль', kk:'Ақпан', de:'Februar', th:'กุมภาพันธ์', uz:'Fevral', fa:'فوریه', ky:'Февраль', tk:'Fewral' },
  '03': { tr:'Mart', en:'March', ru:'Март', kk:'Наурыз', de:'März', th:'มีนาคม', uz:'Mart', fa:'مارس', ky:'Март', tk:'Mart' },
  '04': { tr:'Nisan', en:'April', ru:'Апрель', kk:'Сәуір', de:'April', th:'เมษายน', uz:'Aprel', fa:'آوریل', ky:'Апрель', tk:'Aprel' },
  '05': { tr:'Mayıs', en:'May', ru:'Май', kk:'Мамыр', de:'Mai', th:'พฤษภาคม', uz:'May', fa:'مه', ky:'Май', tk:'Maý' },
  '06': { tr:'Haziran', en:'June', ru:'Июнь', kk:'Маусым', de:'Juni', th:'มิถุนายน', uz:'Iyun', fa:'ژوئن', ky:'Июнь', tk:'Iýun' },
  '07': { tr:'Temmuz', en:'July', ru:'Июль', kk:'Шілде', de:'Juli', th:'กรกฎาคม', uz:'Iyul', fa:'ژوئیه', ky:'Июль', tk:'Iýul' },
  '08': { tr:'Ağustos', en:'August', ru:'Август', kk:'Тамыз', de:'August', th:'สิงหาคม', uz:'Avgust', fa:'اوت', ky:'Август', tk:'Awgust' },
  '09': { tr:'Eylül', en:'September', ru:'Сентябрь', kk:'Қыркүйек', de:'September', th:'กันยายน', uz:'Sentabr', fa:'سپتامبر', ky:'Сентябрь', tk:'Sentýabr' },
  '10': { tr:'Ekim', en:'October', ru:'Октябрь', kk:'Қазан', de:'Oktober', th:'ตุลาคม', uz:'Oktabr', fa:'اکتبر', ky:'Октябрь', tk:'Oktýabr' },
  '11': { tr:'Kasım', en:'November', ru:'Ноябрь', kk:'Қараша', de:'November', th:'พฤศจิกายน', uz:'Noyabr', fa:'نوامبر', ky:'Ноябрь', tk:'Noýabr' },
  '12': { tr:'Aralık', en:'December', ru:'Декабрь', kk:'Желтоқсан', de:'Dezember', th:'ธันวาคม', uz:'Dekabr', fa:'دسامبر', ky:'Декабрь', tk:'Dekabr' },
};

export function monthOptions(lang = 'tr') {
  return MONTHS.map(({ value }) => ({
    value,
    label: (MONTH_NAMES[value] && (MONTH_NAMES[value][lang] || MONTH_NAMES[value].en)) || value,
  }));
}

// Doğum yılları: 19–42 yaş aralığı (bugünün tarihine göre), yeni yıllar üstte
// Sınır yıllarda (tam 19 / tam 42) ay-gün kontrolü Step1'de yapılır.
export const MIN_AGE = 19;
export const MAX_AGE = 42;
export const BIRTH_YEARS = range(THIS_YEAR - MIN_AGE, THIS_YEAR - MAX_AGE).map(String);

// Uçuş için: yakın yıllar + saat/dakika seçenekleri.
export const FLIGHT_YEARS = range(THIS_YEAR, THIS_YEAR + 1).map(String); // bu yıl + gelecek yıl
export const HOURS = range(0, 23).map((n) => String(n).padStart(2, '0'));
export const MINUTES = range(0, 11).map((n) => String(n * 5).padStart(2, '0')); // 00,05,...,55

// Mülakat saatleri: 09:00 -> 16:00, yarım saat aralık.
export const INTERVIEW_TIMES = range(18, 32).map((n) => `${String(Math.floor(n / 2)).padStart(2, '0')}:${n % 2 ? '30' : '00'}`);
// Gün içi 3 zaman dilimi: her günde birer seçim.
export const IV_MORNING = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']; // sabah 09–12
export const IV_NOON = ['12:00', '12:30', '13:00', '13:30'];                       // öğle 12–14
export const IV_EVENING = ['14:00', '14:30', '15:00', '15:30', '16:00'];           // ikindi 14–16

// Doğum tarihinden yaş hesapla (gün/ay/yıl string). Eksikse null döner.
export function ageFromBirth(day, month, year) {
  const d = parseInt(day, 10), m = parseInt(month, 10), y = parseInt(year, 10);
  if (!d || !m || !y) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const md = (today.getMonth() + 1) - m;
  if (md < 0 || (md === 0 && today.getDate() < d)) age--;
  return age;
}

// İş/eğitim yılları: bu yıldan 1990'a, yeni yıllar üstte
export const WORK_YEARS = range(THIS_YEAR, 1990).map(String);

// ---- Dile göre seçenek listeleri (Select/MultiSelect'e doğrudan verilir) ----
// Kullanım:  langOptions('ru').LANGUAGES  ->  [{label:'Английский', value:'İngilizce'}, ...]
export function langOptions(lang = 'tr') {
  return {
    LANGUAGES: labelize(LANGUAGES, LANG_LABELS, lang),
    LANGUAGE_LEVELS: labelize(LANGUAGE_LEVELS, LEVEL_LABELS, lang),
    NATIONALITIES: labelize(NATIONALITIES, NATION_LABELS, lang),
    EDUCATION_LEVELS: labelize(EDUCATION_LEVELS, EDU_LABELS, lang),
    YES_NO: labelize(YES_NO, YESNO_LABELS, lang),
    POSITIONS: labelize(POSITIONS, POSITION_LABELS, lang),
    SKILLS: labelize(SKILLS, SKILL_LABELS, lang),
  };
}

// Ehliyet sınıfları: harf kodları (B, C1...) çevrilmez; sözcük olanlar çevrilir.
export function licenseOptions(country, lang = 'tr') {
  const list = LICENSE_BY_COUNTRY[country] || LICENSE_BY_COUNTRY['Diğer'];
  return list.map((v) => ({
    value: v,
    label: (LICENSE_WORD_LABELS[v] && (LICENSE_WORD_LABELS[v][lang] || LICENSE_WORD_LABELS[v].en)) || v,
  }));
}

// Tek bir kan grubu değerini ülke stiline göre etikete çevirir (CV gösterimi için).
export function bloodLabel(value, country) {
  if (!value) return '';
  const found = bloodOptions(country).find((o) => o.value === value);
  return found ? found.label : value;
}

// Etiket sözlüklerini dışa ver (CV motoru değer->etiket çevirisi için kullanır)
export {
  LANG_LABELS, LEVEL_LABELS, NATION_LABELS, EDU_LABELS, YESNO_LABELS,
  POSITION_LABELS, SKILL_LABELS, LICENSE_WORD_LABELS,
};
