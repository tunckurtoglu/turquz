// Sözleşme portalı UI metinleri — app i18n dilleriyle aynı kodlar.
const STR = {
  kicker: {
    tr: 'İş sözleşmesi', en: 'Employment contract', ru: 'Трудовой договор', kk: 'Еңбек шарты',
    ky: 'Эмгек келишими', uz: 'Mehnat shartnomasi', tk: 'Iş şertnamasy', de: 'Arbeitsvertrag',
    th: 'สัญญาจ้างงาน', fa: 'قرارداد کار',
  },
  landing_title: {
    tr: 'Sözleşmenizi buradan görüntüleyebilirsiniz',
    en: 'You can view your contract here',
    ru: 'Здесь вы можете просмотреть договор',
    kk: 'Келісімшартты осында көре аласыз',
    ky: 'Келишимди бул жерден көрө аласыз',
    uz: 'Shartnomani shu yerda ko‘rishingiz mumkin',
    tk: 'Şertnamaňyzy şu ýerden görüp bilersiňiz',
    de: 'Hier können Sie Ihren Vertrag ansehen',
    th: 'คุณสามารถดูสัญญาได้ที่นี่',
    fa: 'می‌توانید قرارداد را اینجا ببینید',
  },
  landing_lead: {
    tr: 'Sözleşmeyi görüntüleyin, indirip imzalayın; imzalı halini uygulamadan yükleyin.',
    en: 'View the contract, download and sign it; then upload the signed copy in the app.',
    ru: 'Просмотрите договор, скачайте и подпишите; затем загрузите подписанную копию в приложении.',
    kk: 'Келісімшартты қарап, жүктеп қол қойыңыз; қол қойылған нұсқаны қолданбада жүктеңіз.',
    ky: 'Келишимди карап, жүктөп кол коюңуз; кол коюлган нусканы колдонмодо жүктөңүз.',
    uz: 'Shartnomani ko‘ring, yuklab olib imzolang; imzolangan nusxani ilovada yuklang.',
    tk: 'Şertnamany görüp, göçürip alyp gol çekin; gol çekilen nusgany programmada ýükläň.',
    de: 'Sehen Sie den Vertrag an, laden Sie ihn herunter und unterschreiben Sie; laden Sie die unterschriebene Fassung in der App hoch.',
    th: 'ดูสัญญา ดาวน์โหลดและเซ็น แล้วอัปโหลดฉบับที่เซ็นในแอป',
    fa: 'قرارداد را ببینید، دانلود و امضا کنید؛ سپس نسخه امضاشده را در اپ بارگذاری کنید.',
  },
  review: {
    tr: 'Sözleşmeyi görüntüle', en: 'View contract', ru: 'Посмотреть договор', kk: 'Келісімшартты көру',
    ky: 'Келишимди көрүү', uz: 'Shartnomani ko‘rish', tk: 'Şertnamany gör', de: 'Vertrag ansehen',
    th: 'ดูสัญญา', fa: 'مشاهده قرارداد',
  },
  loading: {
    tr: 'Yükleniyor…', en: 'Loading…', ru: 'Загрузка…', kk: 'Жүктелуде…', ky: 'Жүктөлүүдө…',
    uz: 'Yuklanmoqda…', tk: 'Ýüklenýär…', de: 'Wird geladen…', th: 'กำลังโหลด…', fa: 'در حال بارگذاری…',
  },
  back: {
    tr: 'Geri', en: 'Back', ru: 'Назад', kk: 'Артқа', ky: 'Артка', uz: 'Orqaga', tk: 'Yza',
    de: 'Zurück', th: 'กลับ', fa: 'بازگشت',
  },
  title: {
    tr: 'Sözleşme', en: 'Contract', ru: 'Договор', kk: 'Келісімшарт', ky: 'Келишим',
    uz: 'Shartnoma', tk: 'Şertnama', de: 'Vertrag', th: 'สัญญา', fa: 'قرارداد',
  },
  tip_pay: {
    tr: 'İndirmek için önce test ödemesini tamamlayın.',
    en: 'Complete the test payment first to download.',
    ru: 'Сначала завершите тестовую оплату, чтобы скачать.',
    kk: 'Жүктеу үшін алдымен тест төлемін аяқтаңыз.',
    ky: 'Жүктөө үчүн адегенде тест төлөмүн аяктаңыз.',
    uz: 'Yuklab olish uchun avval test to‘lovini yakunlang.',
    tk: 'Göçürip almak üçin ilki test tölegini tamamlaň.',
    de: 'Schließen Sie zuerst die Testzahlung ab, um herunterzuladen.',
    th: 'ชำระเงินทดสอบก่อนจึงดาวน์โหลดได้',
    fa: 'برای دانلود ابتدا پرداخت آزمایشی را کامل کنید.',
  },
  test_pay_title: {
    tr: 'Test ödemesi', en: 'Test payment', ru: 'Тестовая оплата', kk: 'Тест төлемі',
    ky: 'Тест төлөмү', uz: 'Test to‘lovi', tk: 'Test tölegi', de: 'Testzahlung',
    th: 'การชำระทดสอบ', fa: 'پرداخت آزمایشی',
  },
  test_pay_body: {
    tr: 'Stripe henüz bağlı değil. Şimdilik test ödemesi ile devam edebilirsiniz — gerçek kart çekilmez.',
    en: 'Stripe is not connected yet. Continue with a test payment for now — no real card charge.',
    ru: 'Stripe ещё не подключён. Пока можно продолжить тестовой оплатой — карта не списывается.',
    kk: 'Stripe әлі қосылмаған. Қазір тест төлемімен жалғастыруға болады — нақты картадан ақша алынбайды.',
    ky: 'Stripe азырынча туташкан эмес. Азыр тест төлөм менен уланта аласыз — чыныгы картадан акча алынбайт.',
    uz: 'Stripe hali ulanmagan. Hozircha test to‘lovi bilan davom etishingiz mumkin — haqiqiy karta yechilmaydi.',
    tk: 'Stripe entek birikdirilmedi. Häzirlikçe test tölegi bilen dowam edip bilersiňiz — hakyky kart çekilmez.',
    de: 'Stripe ist noch nicht verbunden. Vorerst Testzahlung — keine echte Kartenabbuchung.',
    th: 'ยังไม่ได้เชื่อม Stripe ชำระทดสอบได้ก่อน — ไม่ตัดบัตรจริง',
    fa: 'Stripe هنوز وصل نیست. فعلاً با پرداخت آزمایشی ادامه دهید — کارتی کسر نمی‌شود.',
  },
  test_pay_confirm: {
    tr: 'Test ödemesini tamamla', en: 'Complete test payment', ru: 'Завершить тестовую оплату',
    kk: 'Тест төлемін аяқтау', ky: 'Тест төлөмүн аяктоо', uz: 'Test to‘lovini yakunlash',
    tk: 'Test tölegini tamamla', de: 'Testzahlung abschließen', th: 'ชำระเงินทดสอบ', fa: 'تکمیل پرداخت آزمایشی',
  },
  test_pay_cancel: {
    tr: 'Vazgeç', en: 'Cancel', ru: 'Отмена', kk: 'Бас тарту', ky: 'Жокко чыгаруу',
    uz: 'Bekor qilish', tk: 'Ýatyr', de: 'Abbrechen', th: 'ยกเลิก', fa: 'انصراف',
  },
  tip_paid: {
    tr: 'Ödeme tamam — İndir PDF’i açar. Paylaş → Dosyalara Kaydet, imzalayıp uygulamadan yükleyin.',
    en: 'Paid — Download opens the PDF. Share → Save to Files, then sign and upload in the app.',
    ru: 'Оплата есть — «Скачать» откроет PDF. Поделиться → Файлы, подпишите и загрузите в приложении.',
    kk: 'Төлем бар — Жүктеу PDF ашады. Бөлісу → Файлдар, қол қойып қолданбада жүктеңіз.',
    ky: 'Төлөм бар — Жүктөө PDF ачат. Бөлүшүү → Файлдар, кол коюп колдонмодо жүктөңүз.',
    uz: 'To‘lov bor — Yuklab olish PDF ochadi. Ulashish → Fayllar, imzolab ilovada yuklang.',
    tk: 'Töleg bar — Ýükle PDF açýar. Paýlaş → Faýllar, gol çekip programmada ýükläň.',
    de: 'Bezahlt — Download öffnet das PDF. Teilen → Dateien, dann unterschreiben und in der App hochladen.',
    th: 'ชำระแล้ว — ดาวน์โหลดจะเปิด PDF แชร์ → บันทึกไฟล์ แล้วเซ็นอัปโหลดในแอป',
    fa: 'پرداخت شده — دانلود PDF را باز می‌کند. اشتراک → فایل‌ها؛ سپس امضا و بارگذاری در اپ.',
  },
  tip_print_save: {
    tr: 'PDF açılınca Paylaş → Dosyalara Kaydet ile telefona alın.',
    en: 'When the PDF opens, use Share → Save to Files.',
    ru: 'Когда PDF откроется: Поделиться → Файлы.',
    kk: 'PDF ашылса: Бөлісу → Файлдар.',
    ky: 'PDF ачылса: Бөлүшүү → Файлдар.',
    uz: 'PDF ochilganda: Ulashish → Fayllar.',
    tk: 'PDF açylanda: Paýlaş → Faýllar.',
    de: 'Wenn das PDF öffnet: Teilen → Dateien.',
    th: 'เมื่อ PDF เปิด: แชร์ → บันทึกไฟล์',
    fa: 'با باز شدن PDF: اشتراک → فایل‌ها.',
  },
  pay: {
    tr: 'Ödeme yap', en: 'Pay', ru: 'Оплатить', kk: 'Төлеу', ky: 'Төлөө', uz: 'To‘lash',
    tk: 'Töleg et', de: 'Bezahlen', th: 'ชำระเงิน', fa: 'پرداخت',
  },
  paying: {
    tr: 'İşleniyor…', en: 'Processing…', ru: 'Обработка…', kk: 'Өңделуде…', ky: 'Иштелүүдө…',
    uz: 'Qayta ishlanmoqda…', tk: 'Işlenýär…', de: 'Wird verarbeitet…', th: 'กำลังดำเนินการ…', fa: 'در حال پردازش…',
  },
  download: {
    tr: 'Sözleşmeyi İndir', en: 'Download contract', ru: 'Скачать договор', kk: 'Келісімшартты жүктеу',
    ky: 'Келишимди жүктөө', uz: 'Shartnomani yuklab olish', tk: 'Şertnamany ýükle',
    de: 'Vertrag herunterladen', th: 'ดาวน์โหลดสัญญา', fa: 'دانلود قرارداد',
  },
  preparing: {
    tr: 'Hazırlanıyor…', en: 'Preparing…', ru: 'Подготовка…', kk: 'Дайындалуда…', ky: 'Даярдалууда…',
    uz: 'Tayyorlanmoqda…', tk: 'Taýýarlanýar…', de: 'Wird vorbereitet…', th: 'กำลังเตรียม…', fa: 'در حال آماده‌سازی…',
  },
  err_token: {
    tr: 'Geçersiz veya eksik bağlantı. Lütfen uygulamadan yeniden açın.',
    en: 'Invalid or missing link. Please reopen from the app.',
    ru: 'Недействительная ссылка. Откройте снова из приложения.',
    kk: 'Жарамсыз сілтеме. Қолданбадан қайта ашыңыз.',
    ky: 'Жараксыз шилтеме. Колдонмодон кайра ачыңыз.',
    uz: 'Noto‘g‘ri havola. Ilovadan qayta oching.',
    tk: 'Nädogry baglanyşyk. Programmada täzeden açyň.',
    de: 'Ungültiger Link. Bitte erneut in der App öffnen.',
    th: 'ลิงก์ไม่ถูกต้อง เปิดใหม่จากแอป',
    fa: 'پیوند نامعتبر. از اپ دوباره باز کنید.',
  },
  err_expired: {
    tr: 'Bağlantının süresi dolmuş. Uygulamadan yeniden açın.',
    en: 'Link expired. Reopen from the app.',
    ru: 'Срок ссылки истёк. Откройте снова из приложения.',
    kk: 'Сілтеме мерзімі өтті. Қолданбадан қайта ашыңыз.',
    ky: 'Шилтеменин мөөнөтү бүттү. Колдонмодон кайра ачыңыз.',
    uz: 'Havola muddati tugadi. Ilovadan qayta oching.',
    tk: 'Baglanyşygyň möhleti gutardy. Programmada täzeden açyň.',
    de: 'Link abgelaufen. Erneut in der App öffnen.',
    th: 'ลิงก์หมดอายุ เปิดใหม่จากแอป',
    fa: 'پیوند منقضی شد. از اپ دوباره باز کنید.',
  },
  err_pay_first: {
    tr: 'Önce ödemeyi tamamlayın.',
    en: 'Complete payment first.',
    ru: 'Сначала завершите оплату.',
    kk: 'Алдымен төлемді аяқтаңыз.',
    ky: 'Адегенде төлөмдү аяктаңыз.',
    uz: 'Avval to‘lovni yakunlang.',
    tk: 'Ilki tölegi tamamlaň.',
    de: 'Zuerst Zahlung abschließen.',
    th: 'ชำระเงินก่อน',
    fa: 'ابتدا پرداخت را کامل کنید.',
  },
  err_pay_config: {
    tr: 'Ödeme henüz yapılandırılmadı. Turquz ile iletişime geçin.',
    en: 'Payment is not configured yet. Please contact Turquz.',
    ru: 'Оплата ещё не настроена. Свяжитесь с Turquz.',
    kk: 'Төлем әлі бапталмаған. Turquz-бен хабарласыңыз.',
    ky: 'Төлөм азырынча жөндөлгөн эмес. Turquz менен байланышыңыз.',
    uz: 'To‘lov hali sozlanmagan. Turquz bilan bog‘laning.',
    tk: 'Töleg entek düzülmedi. Turquz bilen habarlaşyň.',
    de: 'Zahlung ist noch nicht eingerichtet. Bitte Turquz kontaktieren.',
    th: 'ยังไม่ได้ตั้งค่าการชำระเงิน ติดต่อ Turquz',
    fa: 'پرداخت هنوز پیکربندی نشده. با Turquz تماس بگیرید.',
  },
  err_print: {
    tr: 'Yazdırma açılamadı. Lütfen tekrar deneyin.',
    en: 'Could not open print. Please try again.',
    ru: 'Не удалось открыть печать. Повторите попытку.',
    kk: 'Басып шығару ашылмады. Қайталап көріңіз.',
    ky: 'Басып чыгаруу ачылган жок. Кайталап көрүңүз.',
    uz: 'Chop etish ochilmadi. Qayta urinib ko‘ring.',
    tk: 'Çap açylmady. Gaýtadan synanyşyň.',
    de: 'Druck konnte nicht geöffnet werden. Bitte erneut versuchen.',
    th: 'เปิดพิมพ์ไม่ได้ ลองอีกครั้ง',
    fa: 'چاپ باز نشد. دوباره تلاش کنید.',
  },
  err_pdf_missing: {
    tr: 'Sözleşme PDF’i henüz hazır değil. Acentenizin sözleşmeyi göndermesini bekleyin.',
    en: 'Contract PDF is not ready yet. Wait for your agency to send the contract.',
    ru: 'PDF договора ещё не готов. Дождитесь отправки от агентства.',
    kk: 'Келісімшарт PDF әлі дайын емес. Агенттіктің жіберуін күтіңіз.',
    ky: 'Келишим PDF даяр эмес. Агенттиктин жөнөтүшүн күтүңүз.',
    uz: 'Shartnoma PDF hali tayyor emas. Agentlik yuborishini kuting.',
    tk: 'Şertnama PDF entek taýýar däl. Agentligiň ibermegini garaşyň.',
    de: 'Vertrags-PDF ist noch nicht bereit. Warten Sie auf die Agentur.',
    th: 'ไฟล์ PDF สัญญายังไม่พร้อม รอเอเจนซี่ส่งสัญญา',
    fa: 'PDF قرارداد هنوز آماده نیست. منتظر ارسال آژانس بمانید.',
  },
  err_pdf: {
    tr: 'PDF açılamadı. Lütfen tekrar deneyin.',
    en: 'Could not open the PDF. Please try again.',
    ru: 'Не удалось открыть PDF. Повторите попытку.',
    kk: 'PDF ашылмады. Қайталап көріңіз.',
    ky: 'PDF ачылган жок. Кайталап көрүңүз.',
    uz: 'PDF ochilmadi. Qayta urinib ko‘ring.',
    tk: 'PDF açylmady. Gaýtadan synanyşyň.',
    de: 'PDF konnte nicht geöffnet werden. Bitte erneut versuchen.',
    th: 'เปิด PDF ไม่ได้ ลองอีกครั้ง',
    fa: 'باز کردن PDF ممکن نشد. دوباره تلاش کنید.',
  },
};

const SUPPORTED = ['tr', 'en', 'ru', 'kk', 'ky', 'uz', 'tk', 'de', 'th', 'fa'];

export function resolveLang(raw) {
  const code = String(raw || '').toLowerCase().slice(0, 2);
  return SUPPORTED.includes(code) ? code : 'tr';
}

export function t(lang, key) {
  const row = STR[key];
  if (!row) return key;
  return row[lang] || row.en || row.tr || key;
}

export function dirOf(lang) {
  return lang === 'fa' ? 'rtl' : 'ltr';
}
