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

export const YES_NO = ['Yok', 'Var'];

export const POSITIONS = [
  'Guest Relations', 'Resepsiyon / Önbüro', 'Çocuk Animatörü', 'Animasyon',
  'Garson / Servis', 'Bar', 'Host / Hostes', 'Komi', 'Kat Hizmetleri (Housekeeping)',
  'Aşçı / Mutfak', 'Bellboy', 'Spa & Wellness', 'Satış & Pazarlama',
  'Muhasebe', 'Güvenlik', 'Teknik Servis',
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

// Doğum yılları: 15–65 yaş aralığı, yeni yıllar üstte
export const BIRTH_YEARS = range(THIS_YEAR - 15, THIS_YEAR - 65).map(String);

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

// Etiket sözlüklerini dışa ver (CV motoru değer->etiket çevirisi için kullanır)
export {
  LANG_LABELS, LEVEL_LABELS, NATION_LABELS, EDU_LABELS, YESNO_LABELS,
  POSITION_LABELS, SKILL_LABELS, LICENSE_WORD_LABELS,
};
