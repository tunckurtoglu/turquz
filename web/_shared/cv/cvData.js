// cv/cvData.js
// CV'nin TEK veri modeli. Wizard bunu doldurur, buildCvHtml bunu okur,
// admin paneli de aynı yapıyı düzenler/listeler.

// Yeni bir başvuru başlarken kullanılacak boş şablon.
export const emptyCvData = {
  // --- Sidebar: kimlik ---
  photo: '',            // vesikalık (1:1). data URI ("data:image/jpeg;base64,...") veya http URL. PDF'e gömülür.
  photoFull: '',        // boydan tanıtım fotoğrafı (3:4). Otel galerisi + PDF 2. sayfa. Boşsa gizlenir.
  photoClose: '',       // yakın çekim tanıtım fotoğrafı (3:4). Otel galerisi + PDF 2. sayfa. Boşsa gizlenir.
  introVideo: '',       // 20 sn tanıtım videosu — storage YOLU (data değil; çok büyük). İmzalı URL ile oynatılır.
  firstName: '',
  lastName: '',

  // --- Main: üst bar ---
  title: '',            // ör. "Turizm & Otelcilik · Misafir İlişkileri"
  email: '',
  phone: '',
  location: '',         // ör. "Almatı, Kazakistan"

  // --- Sidebar: Kişisel Bilgiler ---
  passportNo: '',
  birthDate: '',        // serbest metin, ör. "10.04.2006"
  heightWeight: '',     // ör. "163 cm / 44 kg"
  nationality: '',
  gender: '',           // 'male' | 'female' | 'unspecified' (filtreleme için)
  employmentStatus: '', // 'student' | 'employed' (filtreleme için)
  availableMonths: '',  // 'seasonal' | 'full_year' (filtreleme için)
  driverLicense: '',

  // --- Sidebar: Diller ---  [{ name, level }]
  languages: [],        // ör. [{ name: 'Rusça', level: 'Anadil' }]

  // --- Sidebar: Aile Bilgileri ---
  family: {
    mother: { name: '', phone: '' },
    father: { name: '', phone: '' },
  },

  // --- Main: Profil ---
  profile: '',          // serbest paragraf

  // --- Main: İş Deneyimleri ---  [{ date, company, position }]
  experience: [],       // ör. [{ date: '04.2025 - 10.2025', company: 'Titanic Hotel Lara', position: 'Bar Garsonu' }]

  // --- Main: Eğitim ---  [{ date, school, description }]
  education: [],

  // --- Main: listeler ---
  skills: [],           // ['Misafir İlişkileri', ...]
  certificates: [],     // ['Sertifika adı — Kurum, Tarih', ...]
  positions: [],        // ['Resepsiyon', 'Garson', ...]
};

// Şablonun orijinaliyle birebir eşleşen örnek veri (test/önizleme için).
export const sampleCvData = {
  photo: '',            // gerçek fotoğrafı buraya data URI olarak koyabilirsin
  photoFull: '',
  photoClose: '',
  firstName: 'Zhansaya',
  lastName: 'Maratova',
  title: 'Turizm & Otelcilik · Misafir İlişkileri',
  email: 'Zmaratova305@gmail.com',
  phone: '+90 551 467 80 33',
  location: 'Almatı, Kazakistan',

  passportNo: '',
  birthDate: '10.04.2006',
  heightWeight: '163 cm / 44 kg',
  nationality: 'Kazakistan',
  driverLicense: '',

  languages: [
    { name: 'Rusça', level: 'Anadil' },
    { name: 'İngilizce', level: 'B2' },
    { name: 'Türkçe', level: 'B2' },
  ],

  family: {
    mother: { name: '', phone: '+7 705 206 7919' },
    father: { name: '', phone: '' },
  },

  profile:
    'Garsonluk ve otelde hosteslik alanlarında iki yıllık deneyime sahibim; ' +
    'misafir memnuniyetini her zaman ön planda tutarım. Yoğun çalışma temposuna ' +
    'uyum sağlayan, ekip çalışmasını seven ve iletişimi güçlü biriyim. Turizm ve ' +
    'otelcilik alanında kendimi geliştirmeye istekli ve motiveyim.',

  experience: [
    { date: '04.2025 - 10.2025', company: 'Titanic Hotel Lara', position: 'Bar Garsonu' },
    { date: '05.2024 - 11.2024', company: 'Alva Donna (Dobedan)', position: 'Garson / Hostes' },
  ],

  education: [
    { date: '2023 - Devam', school: 'MITU Üniversitesi', description: 'İşletme ve Yönetim Lisans Programı — 3. Sınıf' },
  ],

  skills: [
    'Misafir İlişkileri',
    'Servis ve Sunum Becerileri',
    'Etkili İletişim',
    'Takım Çalışması ve Uyum',
  ],
  certificates: [],
  positions: ['Resepsiyon', 'Garson', 'Çocuk Animatörü'],
};
