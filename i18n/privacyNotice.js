// Uygulama içi KVKK Aydınlatma + Açık Rıza metni.
// Kaynak taslak: docs/kvkk-aydinlatma-riza-taslak.md
// [köşeli parantez] yerleri şirket bilgisi / avukat onayı ile doldurulacak.
// Metin değişince CONSENT_VERSION (lib/consent.js) artırılmalı.

export const PRIVACY_NOTICE_DOC_VERSION = 3;

const TR = {
  draftBanner:
    'Bu metin henüz taslaktır; hukuki tavsiye değildir. Yayına alınmadan önce KVKK alanında deneyimli bir avukata onaylatılmalıdır. Saklama süreleri gibi kalan [köşeli parantez] alanlar avukat onayıyla tamamlanacaktır.',
  sectionATitle: 'Bölüm A — Aydınlatma metni (KVKK md. 10)',
  sectionBTitle: 'Bölüm B — Açık rıza metni',
  sectionBIntro:
    'Uygulamada bu onaylar ayrı kutucuklar olarak sunulur; her biri reddedilebilir ve ilgili kişinin kendi dilinde gösterilir.',
  blocks: [
    {
      heading: '1. Veri sorumlusu',
      bullets: [
        'Unvan: TURQUZ ULUSLARARASI DANIŞMANLIK TİCARET LİMİTED ŞİRKETİ',
        'Adres: Liman Mah. Boğaçayı Cad. No: 30 İç Kapı No: 14 Konyaaltı / Antalya',
        'Vergi dairesi / VKN: Antalya Kurumlar — 8711330554',
        'İletişim / Başvuru: info@turquz.com, +7 919 011 55 66',
      ],
    },
    {
      heading: '2. İşlenen kişisel veriler',
      paragraphs: [
        'Turquz uygulaması üzerinden, işe yerleştirme amacıyla aşağıdaki veriler işlenir:',
      ],
      subBlocks: [
        {
          title: 'Genel nitelikli veriler',
          bullets: [
            'Kimlik: ad, soyad, doğum tarihi, uyruk, pasaport numarası',
            'İletişim: e-posta, telefon, adres',
            'Özgeçmiş: unvan, profil yazısı, iş deneyimi, eğitim, diller, beceriler, ehliyet, boy/kilo',
            'Görseller: vesikalık fotoğraf, boydan fotoğraf, yakın çekim fotoğraf',
          ],
        },
        {
          title: 'Özel nitelikli veriler (KVKK md. 6)',
          bullets: [
            'Kan grubu (sağlık verisi) — yalnızca aday açık rıza verirse',
            'Adli sicil belgesi (ceza mahkûmiyeti verisi) — yalnızca işe alım aşamasında, açık rızayla',
            'Pasaport belgesi (yüklenen görüntü/PDF)',
          ],
          note:
            'Belge yükleme alanı her adaya açık değildir; yalnızca bir otel/acente adayı kabul ettiğinde etkinleşir.',
        },
      ],
    },
    {
      heading: '3. İşleme amaçları',
      bullets: [
        'Turizm/otelcilik sektöründe işe yerleştirme ve aday-işveren eşleştirmesi',
        'İşverenlerin (otel/acente) adayı değerlendirmesi',
        'İşe alım sonrası süreçler (sözleşme, vize/çalışma izni, seyahat/transfer organizasyonu)',
        'Belgelerin geçerlilik/uygunluk kontrolü',
      ],
    },
    {
      heading: '4. Hukuki sebep',
      bullets: [
        'Genel veriler: ilgili kişinin açık rızası ve/veya sözleşmenin kurulması/ifası',
        'Özel nitelikli veriler: yalnızca ilgili kişinin açık rızası (KVKK md. 6/2)',
      ],
    },
    {
      heading: '5. Aktarılan taraflar',
      bullets: [
        'Oteller / acente(lar): aday eşleştiğinde, değerlendirme ve işe alım amacıyla',
        'Altyapı sağlayıcısı: Supabase (barındırma; sunucu konumu Avrupa Birliği — Frankfurt)',
        '(Kullanılması hâlinde) belge doğrulama için yapay zeka hizmet sağlayıcısı — şu an etkin değildir; etkinleştirilirse pasaport doğrulama amacıyla kullanılabilir.',
      ],
    },
    {
      heading: '6. Yurt dışına aktarım',
      paragraphs: [
        'Veriler, yurt dışındaki sunucu ve hizmet sağlayıcılarda (AB — Frankfurt; ve kullanılması hâlinde yapay zeka sağlayıcısı) işlenebilir/saklanabilir. Bu aktarım açık rıza ile yapılır.',
      ],
    },
    {
      heading: '7. Saklama süresi',
      bullets: [
        'Belgeler ve kişisel veriler, işe yerleştirme amacı sürdükçe ve [ör. hesabın silinmesi veya 2 yıl işlem görmemesi] hâline kadar saklanır; sonrasında silinir/anonimleştirilir.',
        'Açık rıza kayıtları, ispat amacıyla [saklama süresi] boyunca tutulur.',
      ],
    },
    {
      heading: '8. İlgili kişinin hakları (KVKK md. 11)',
      paragraphs: [
        'İlgili kişi; verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme, işlemeye itiraz ve zararın giderilmesini talep etme haklarına sahiptir. Başvurular info@turquz.com üzerinden yapılır.',
      ],
    },
  ],
  consents: [
    {
      title: '1) Genel veri işleme ve paylaşım',
      quote:
        'Kişisel verilerimin (fotoğraflarım dâhil) yukarıda belirtilen amaçlarla işlenmesine ve eşleştiğim otel/acentalarla paylaşılmasına açık rıza veriyorum.',
    },
    {
      title: '2) Özel nitelikli veri',
      quote:
        'Özel nitelikli kişisel verilerimin — kan grubum ve adli sicil belgem — yukarıdaki amaçlarla işlenmesine açık rıza veriyorum.',
      note:
        'Uygulamada kan grubu rızası CV adımında, adli sicil rızası belge yükleme adımında ayrı ayrı alınır.',
    },
    {
      title: '3) Yurt dışına aktarım',
      quote:
        'Verilerimin, yurt dışındaki sunucu ve hizmet sağlayıcılarda (AB — Frankfurt ve kullanılması hâlinde doğrulama amaçlı yapay zeka sağlayıcısı) işlenmesine/aktarılmasına açık rıza veriyorum.',
    },
  ],
};

const EN = {
  draftBanner:
    'This text is still a draft and is not legal advice. Have it reviewed by a lawyer experienced in personal-data law before relying on it in production. Remaining [bracketed] fields (e.g. retention periods) will be completed with counsel’s approval.',
  sectionATitle: 'Part A — Privacy notice',
  sectionBTitle: 'Part B — Explicit consent wording',
  sectionBIntro:
    'In the app these consents are shown as separate checkboxes; each can be declined and is shown in the user’s language.',
  blocks: [
    {
      heading: '1. Data controller',
      bullets: [
        'Legal name: TURQUZ ULUSLARARASI DANIŞMANLIK TİCARET LİMİTED ŞİRKETİ',
        'Address: Liman Mah. Boğaçayı Cad. No: 30 İç Kapı No: 14 Konyaaltı / Antalya, Türkiye',
        'Tax office / tax ID: Antalya Kurumlar — 8711330554',
        'Contact / requests: info@turquz.com, +7 919 011 55 66',
      ],
    },
    {
      heading: '2. Personal data processed',
      paragraphs: [
        'Through the Turquz app, the following data is processed for job placement:',
      ],
      subBlocks: [
        {
          title: 'Ordinary personal data',
          bullets: [
            'Identity: first name, last name, date of birth, nationality, passport number',
            'Contact: email, phone, address',
            'CV: title, profile text, work experience, education, languages, skills, driving licence, height/weight',
            'Images: ID-style photo, full-body photo, close-up photo',
          ],
        },
        {
          title: 'Special-category data',
          bullets: [
            'Blood type (health data) — only if the candidate gives explicit consent',
            'Criminal-record document — only at hiring stage, with explicit consent',
            'Passport document (uploaded image/PDF)',
          ],
          note:
            'Document upload is not open to every candidate; it unlocks only after a hotel/agency accepts the candidate.',
        },
      ],
    },
    {
      heading: '3. Purposes of processing',
      bullets: [
        'Job placement and candidate–employer matching in tourism/hospitality',
        'Employer (hotel/agency) evaluation of candidates',
        'Post-hire processes (contract, visa/work permit, travel/transfer)',
        'Checking validity/suitability of documents',
      ],
    },
    {
      heading: '4. Legal basis',
      bullets: [
        'Ordinary data: the data subject’s explicit consent and/or performance of a contract',
        'Special-category data: only the data subject’s explicit consent',
      ],
    },
    {
      heading: '5. Recipients',
      bullets: [
        'Hotels / agencies: when matched, for evaluation and hiring',
        'Infrastructure provider: Supabase (hosting; server location EU — Frankfurt)',
        '(If used) AI provider for document verification — not active today; if enabled, may be used for passport checks',
      ],
    },
    {
      heading: '6. International transfers',
      paragraphs: [
        'Data may be processed/stored on servers and providers abroad (EU — Frankfurt; and, if used, an AI provider). Such transfers are based on explicit consent.',
      ],
    },
    {
      heading: '7. Retention',
      bullets: [
        'Documents and personal data are kept while the placement purpose continues and until [e.g. account deletion or 2 years of inactivity], then deleted or anonymised.',
        'Consent records are kept for [retention period] for evidentiary purposes.',
      ],
    },
    {
      heading: '8. Your rights',
      paragraphs: [
        'You may request information about whether your data is processed, access, rectification, erasure, objection to processing, and compensation for damage. Requests are made via info@turquz.com.',
      ],
    },
  ],
  consents: [
    {
      title: '1) General processing and sharing',
      quote:
        'I give explicit consent to the processing of my personal data (including my photos) for the purposes above and to sharing with hotels/agencies I am matched with.',
    },
    {
      title: '2) Special-category data',
      quote:
        'I give explicit consent to the processing of my special-category personal data — my blood type and criminal-record document — for the purposes above.',
      note:
        'In the app, blood-type consent is collected in the CV step; criminal-record consent is collected at document upload.',
    },
    {
      title: '3) International transfer',
      quote:
        'I give explicit consent to processing/transfer of my data on servers and providers abroad (EU — Frankfurt and, if used, an AI provider for verification).',
    },
  ],
};

const BY_LANG = {
  tr: TR,
  en: EN,
};

/** Kullanıcı diline göre metin paketi (yoksa EN, o da yoksa TR). */
export function getPrivacyNotice(lang) {
  const code = String(lang || '').toLowerCase().slice(0, 2);
  return BY_LANG[code] || BY_LANG.en || BY_LANG.tr;
}
