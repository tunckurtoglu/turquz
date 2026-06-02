// i18n/ui.js
// Wizard ARAYÜZ metinleri (başlıklar, etiketler, butonlar) 8 dilde.
// Kullanım:  t('next', 'ru')  ->  'Далее'
// Anahtar bulunamazsa İngilizce'ye, o da yoksa anahtarın kendisine düşer.
//
// NOT: tr/en güvenilir; ru/kk/de/th/uz/fa için makul çeviriler kondu,
// resmî kullanım öncesi anadili konuşan biri gözden geçirmeli.

export const UI = {
  // --- Genel / navigasyon ---
  next:    { tr:'İleri', en:'Next', ru:'Далее', kk:'Келесі', de:'Weiter', th:'ถัดไป', uz:'Keyingi', fa:'بعدی' },
  back:    { tr:'Geri', en:'Back', ru:'Назад', kk:'Артқа', de:'Zurück', th:'ย้อนกลับ', uz:'Orqaga', fa:'قبلی' },
  preview: { tr:'Önizleme', en:'Preview', ru:'Просмотр', kk:'Алдын ала қарау', de:'Vorschau', th:'ตัวอย่าง', uz:'Koʻrish', fa:'پیش‌نمایش' },
  step:    { tr:'Adım', en:'Step', ru:'Шаг', kk:'Қадам', de:'Schritt', th:'ขั้นตอน', uz:'Qadam', fa:'مرحله' },

  // --- Adım başlıkları ---
  step_personal:   { tr:'Kişisel', en:'Personal', ru:'Личное', kk:'Жеке', de:'Persönlich', th:'ส่วนตัว', uz:'Shaxsiy', fa:'شخصی' },
  step_profile:    { tr:'Profil & Foto', en:'Profile & Photo', ru:'Профиль и фото', kk:'Профиль және фото', de:'Profil & Foto', th:'โปรไฟล์และรูป', uz:'Profil va foto', fa:'پروفایل و عکس' },
  step_family:     { tr:'Aile', en:'Family', ru:'Семья', kk:'Отбасы', de:'Familie', th:'ครอบครัว', uz:'Oila', fa:'خانواده' },
  step_languages:  { tr:'Diller', en:'Languages', ru:'Языки', kk:'Тілдер', de:'Sprachen', th:'ภาษา', uz:'Tillar', fa:'زبان‌ها' },
  step_experience: { tr:'İş Deneyimi', en:'Experience', ru:'Опыт работы', kk:'Жұмыс тәжірибесі', de:'Berufserfahrung', th:'ประสบการณ์', uz:'Tajriba', fa:'سوابق کاری' },
  step_education:  { tr:'Eğitim', en:'Education', ru:'Образование', kk:'Білім', de:'Ausbildung', th:'การศึกษา', uz:'Taʼlim', fa:'تحصیلات' },
  step_skills:     { tr:'Beceri / Sertifika', en:'Skills / Certificates', ru:'Навыки / Сертификаты', kk:'Дағдылар / Сертификаттар', de:'Fähigkeiten / Zertifikate', th:'ทักษะ / ใบรับรอง', uz:'Koʻnikma / Sertifikat', fa:'مهارت / گواهی' },

  // --- Karşılama / Kapanış cümleleri (form başı ve sonu) ---
  intro_title: { tr:'Sizi Tanıyalım', en:'Let’s Get to Know You', ru:'Давайте познакомимся', kk:'Сізбен танысайық', de:'Lernen wir Sie kennen', th:'มาทำความรู้จักคุณกัน', uz:'Keling, tanishaylik', fa:'بیایید شما را بشناسیم' },
  intro_body: { tr:'Her başarı hikâyesi bir adımla başlar. Şimdi sıra sizde.', en:'Every success story begins with a single step. Now it’s your turn.', ru:'Каждая история успеха начинается с одного шага. Теперь ваша очередь.', kk:'Әр табыс тарихы бір қадамнан басталады. Енді кезек сізде.', de:'Jede Erfolgsgeschichte beginnt mit einem Schritt. Jetzt sind Sie dran.', th:'ทุกเรื่องราวความสำเร็จเริ่มต้นด้วยก้าวเดียว ตอนนี้ถึงตาคุณแล้ว', uz:'Har bir muvaffaqiyat bir qadamdan boshlanadi. Endi navbat sizda.', fa:'هر داستان موفقیت با یک قدم آغاز می‌شود. حالا نوبت شماست.' },
  outro_title: { tr:'Teşekkür ederiz', en:'Thank You', ru:'Спасибо', kk:'Рақмет', de:'Vielen Dank', th:'ขอบคุณ', uz:'Rahmat', fa:'سپاسگزاریم' },
  outro_body: { tr:'Bugün attığınız adım, sınırların ötesindeki fırsatlara uzanan yolun başlangıcı olabilir.', en:'The step you take today may be the beginning of a journey toward opportunities beyond borders.', ru:'Шаг, который вы делаете сегодня, может стать началом пути к возможностям без границ.', kk:'Бүгін жасаған қадамыңыз шекарадан тыс мүмкіндіктерге апаратын жолдың басы болуы мүмкін.', de:'Der Schritt, den Sie heute gehen, kann der Beginn eines Weges zu Chancen jenseits der Grenzen sein.', th:'ก้าวที่คุณก้าวในวันนี้ อาจเป็นจุดเริ่มต้นของเส้นทางสู่โอกาสที่ไร้พรมแดน', uz:'Bugun qoʻygan qadamingiz chegaralardan tashqaridagi imkoniyatlarga yoʻl ochishi mumkin.', fa:'قدمی که امروز برمی‌دارید می‌تواند آغاز مسیری به‌سوی فرصت‌هایی فراتر از مرزها باشد.' },

  // --- Home (ana sayfa) ---
  home_greeting: { tr:'Hoş geldin', en:'Welcome', ru:'Добро пожаловать', kk:'Қош келдің', de:'Willkommen', th:'ยินดีต้อนรับ', uz:'Xush kelibsiz', fa:'خوش آمدید' },
  home_cv_ready: { tr:'CV’n hazır', en:'Your CV is ready', ru:'Ваше резюме готово', kk:'Түйіндемең дайын', de:'Dein Lebenslauf ist fertig', th:'เรซูเม่ของคุณพร้อมแล้ว', uz:'CV’ingiz tayyor', fa:'رزومه شما آماده است' },
  home_cv_card: { tr:'Özgeçmişim', en:'My CV', ru:'Моё резюме', kk:'Менің түйіндемем', de:'Mein Lebenslauf', th:'เรซูเม่ของฉัน', uz:'Mening CV’im', fa:'رزومه من' },
  home_edit: { tr:'Önizle / Düzenle', en:'Preview / Edit', ru:'Просмотр / Изменить', kk:'Қарау / Өзгерту', de:'Vorschau / Bearbeiten', th:'ดู / แก้ไข', uz:'Koʻrish / Tahrirlash', fa:'پیش‌نمایش / ویرایش' },
  home_new: { tr:'Yeni CV oluştur', en:'Create new CV', ru:'Создать новое резюме', kk:'Жаңа түйіндеме', de:'Neuen Lebenslauf', th:'สร้างเรซูเม่ใหม่', uz:'Yangi CV yaratish', fa:'ساخت رزومه جدید' },
  soon: { tr:'Yakında', en:'Coming soon', ru:'Скоро', kk:'Жақында', de:'Demnächst', th:'เร็วๆ นี้', uz:'Tez kunda', fa:'به‌زودی' },
  home_announcements: { tr:'Duyurular', en:'Announcements', ru:'Объявления', kk:'Хабарландырулар', de:'Ankündigungen', th:'ประกาศ', uz:'Eʼlonlar', fa:'اطلاعیه‌ها' },
  home_assistant: { tr:'Asistana Sor', en:'Ask the Assistant', ru:'Спросить ассистента', kk:'Көмекшіден сұра', de:'Assistent fragen', th:'ถามผู้ช่วย', uz:'Yordamchidan soʻrang', fa:'از دستیار بپرسید' },
  home_interviews: { tr:'Mülakatlar', en:'Interviews', ru:'Собеседования', kk:'Сұхбаттар', de:'Vorstellungsgespräche', th:'สัมภาษณ์', uz:'Suhbatlar', fa:'مصاحبه‌ها' },

  // --- Step1 bölüm başlıkları ---
  sec_about:    { tr:'Seni Tanıyalım', en:'About You', ru:'О себе', kk:'Сіз туралы', de:'Über dich', th:'เกี่ยวกับคุณ', uz:'Siz haqingizda', fa:'درباره شما' },
  sec_contact:  { tr:'İletişim', en:'Contact', ru:'Контакты', kk:'Байланыс', de:'Kontakt', th:'ติดต่อ', uz:'Aloqa', fa:'تماس' },
  sec_personal: { tr:'Kişisel Bilgiler', en:'Personal Info', ru:'Личные данные', kk:'Жеке мәліметтер', de:'Persönliche Daten', th:'ข้อมูลส่วนตัว', uz:'Shaxsiy maʼlumotlar', fa:'اطلاعات شخصی' },
  sec_birth:    { tr:'Doğum Tarihi', en:'Date of Birth', ru:'Дата рождения', kk:'Туған күні', de:'Geburtsdatum', th:'วันเกิด', uz:'Tugʻilgan sana', fa:'تاریخ تولد' },
  sec_hw:       { tr:'Boy / Kilo', en:'Height / Weight', ru:'Рост / Вес', kk:'Бой / Салмақ', de:'Größe / Gewicht', th:'ส่วนสูง / น้ำหนัก', uz:'Boʻy / Vazn', fa:'قد / وزن' },
  sec_other:    { tr:'Diğer', en:'Other', ru:'Прочее', kk:'Басқа', de:'Sonstiges', th:'อื่นๆ', uz:'Boshqa', fa:'سایر' },

  // --- Alan etiketleri ---
  f_firstName: { tr:'Ad', en:'First Name', ru:'Имя', kk:'Аты', de:'Vorname', th:'ชื่อ', uz:'Ism', fa:'نام' },
  ph_firstName: { tr:'Elif', en:'Emily', ru:'Анна', kk:'Аружан', de:'Lukas', th:'ศิริพร', uz:'Dilnoza', fa:'سارا' },
  ph_lastName:  { tr:'Yıldırım', en:'Walker', ru:'Иванова', kk:'Серікқызы', de:'Müller', th:'จันทร์ดี', uz:'Karimova', fa:'محمدی' },
  ph_title:     { tr:'Misafir İlişkileri', en:'Guest Relations', ru:'Гостевой сервис', kk:'Қонақтармен жұмыс', de:'Gästebetreuung', th:'ดูแลลูกค้า', uz:'Mehmonlar bilan ishlash', fa:'روابط مهمان' },
  ph_email:     { tr:'ornek@gmail.com', en:'example@gmail.com', ru:'primer@gmail.com', kk:'mysal@gmail.com', de:'beispiel@gmail.com', th:'example@gmail.com', uz:'namuna@gmail.com', fa:'example@gmail.com' },
  f_lastName:  { tr:'Soyad', en:'Last Name', ru:'Фамилия', kk:'Тегі', de:'Nachname', th:'นามสกุล', uz:'Familiya', fa:'نام خانوادگی' },
  f_title:     { tr:'Ünvan / Alan', en:'Title / Field', ru:'Должность / Сфера', kk:'Лауазым / Сала', de:'Titel / Bereich', th:'ตำแหน่ง / สาขา', uz:'Lavozim / Soha', fa:'عنوان / حوزه' },
  f_email:     { tr:'E-posta', en:'Email', ru:'Эл. почта', kk:'Электрондық пошта', de:'E-Mail', th:'อีเมล', uz:'Email', fa:'ایمیل' },
  f_phone:     { tr:'Telefon', en:'Phone', ru:'Телефон', kk:'Телефон', de:'Telefon', th:'โทรศัพท์', uz:'Telefon', fa:'تلفن' },
  f_phone2:    { tr:'Telefonunu tekrarla', en:'Repeat phone', ru:'Повторите телефон', kk:'Телефонды қайталаңыз', de:'Telefon wiederholen', th:'ยืนยันเบอร์โทร', uz:'Telefonni takrorlang', fa:'تکرار شماره تلفن' },
  f_address:   { tr:'Adres', en:'Address', ru:'Адрес', kk:'Мекенжай', de:'Adresse', th:'ที่อยู่', uz:'Manzil', fa:'آدرس' },
  f_passport:  { tr:'Pasaport No', en:'Passport No', ru:'Номер паспорта', kk:'Паспорт нөмірі', de:'Passnummer', th:'เลขพาสปอร์ต', uz:'Pasport raqami', fa:'شماره گذرنامه' },
  f_day:       { tr:'Gün', en:'Day', ru:'День', kk:'Күн', de:'Tag', th:'วัน', uz:'Kun', fa:'روز' },
  f_month:     { tr:'Ay', en:'Month', ru:'Месяц', kk:'Ай', de:'Monat', th:'เดือน', uz:'Oy', fa:'ماه' },
  f_year:      { tr:'Yıl', en:'Year', ru:'Год', kk:'Жыл', de:'Jahr', th:'ปี', uz:'Yil', fa:'سال' },
  f_height:    { tr:'Boy', en:'Height', ru:'Рост', kk:'Бойы', de:'Größe', th:'ส่วนสูง', uz:'Boʻy', fa:'قد' },
  f_weight:    { tr:'Kilo', en:'Weight', ru:'Вес', kk:'Салмағы', de:'Gewicht', th:'น้ำหนัก', uz:'Vazn', fa:'وزن' },
  f_nationality:{ tr:'Uyruk', en:'Nationality', ru:'Гражданство', kk:'Азаматтығы', de:'Staatsangeh.', th:'สัญชาติ', uz:'Fuqaroligi', fa:'ملیت' },
  f_lic_country:{ tr:'Ehliyet alındığı ülke', en:'License country', ru:'Страна выдачи прав', kk:'Куәлік берілген ел', de:'Land des Führerscheins', th:'ประเทศที่ออกใบขับขี่', uz:'Guvohnoma berilgan davlat', fa:'کشور صدور گواهینامه' },
  f_lic_class: { tr:'Ehliyet sınıfı', en:'License class', ru:'Категория прав', kk:'Куәлік санаты', de:'Führerscheinklasse', th:'ประเภทใบขับขี่', uz:'Guvohnoma toifasi', fa:'نوع گواهینامه' },
  f_criminal:  { tr:'Sabıka Kaydı', en:'Criminal Record', ru:'Судимость', kk:'Сотталғандығы', de:'Vorstrafen', th:'ประวัติอาชญากรรม', uz:'Sudlanganligi', fa:'سوء پیشینه' },

  // Step2 profil/foto
  sec_profile: { tr:'Profil / Özet', en:'Profile / Summary', ru:'Профиль / О себе', kk:'Профиль / Қысқаша', de:'Profil / Zusammenfassung', th:'โปรไฟล์ / สรุป', uz:'Profil / Qisqacha', fa:'پروفایل / خلاصه' },
  f_profile:   { tr:'Kendini kısaca anlat', en:'Briefly describe yourself', ru:'Коротко о себе', kk:'Өзіңіз туралы қысқаша', de:'Beschreibe dich kurz', th:'อธิบายตัวคุณสั้นๆ', uz:'Oʻzingiz haqingizda qisqacha', fa:'مختصری درباره خود' },
  min_chars:   { tr:'En az {n} karakter', en:'At least {n} characters', ru:'Не менее {n} символов', kk:'Кемінде {n} таңба', de:'Mindestens {n} Zeichen', th:'อย่างน้อย {n} ตัวอักษร', uz:'Kamida {n} belgi', fa:'حداقل {n} نویسه' },
  enough:      { tr:'Yeterli ✓', en:'Enough ✓', ru:'Достаточно ✓', kk:'Жеткілікті ✓', de:'Ausreichend ✓', th:'เพียงพอ ✓', uz:'Yetarli ✓', fa:'کافی ✓' },
  sec_photo:   { tr:'Fotoğraf', en:'Photo', ru:'Фото', kk:'Фото', de:'Foto', th:'รูปภาพ', uz:'Foto', fa:'عکس' },
  pick_photo:  { tr:'Galeriden Fotoğraf Seç', en:'Pick from Gallery', ru:'Выбрать из галереи', kk:'Галереядан таңдау', de:'Aus Galerie wählen', th:'เลือกจากแกลเลอรี', uz:'Galereyadan tanlash', fa:'انتخاب از گالری' },
  change:      { tr:'Değiştir', en:'Change', ru:'Изменить', kk:'Өзгерту', de:'Ändern', th:'เปลี่ยน', uz:'Oʻzgartirish', fa:'تغییر' },
  remove:      { tr:'Kaldır', en:'Remove', ru:'Удалить', kk:'Жою', de:'Entfernen', th:'ลบ', uz:'Olib tashlash', fa:'حذف' },
  optimizing:  { tr:'Fotoğraf optimize ediliyor…', en:'Optimizing photo…', ru:'Оптимизация фото…', kk:'Фото оңтайландырылуда…', de:'Foto wird optimiert…', th:'กำลังปรับรูป…', uz:'Foto optimallashtirilmoqda…', fa:'در حال بهینه‌سازی عکس…' },
  photo_tips_title: { tr:'İyi bir profil fotoğrafı için:', en:'For a good profile photo:', ru:'Для хорошего фото:', kk:'Жақсы фото үшін:', de:'Für ein gutes Foto:', th:'เพื่อรูปโปรไฟล์ที่ดี:', uz:'Yaxshi foto uchun:', fa:'برای یک عکس خوب:' },
  photo_tip_1: { tr:'Yüzün net görünsün, omuz hizasından çekilmiş olsun', en:'Face clearly visible, shoulder-up shot', ru:'Лицо чётко видно, по плечи', kk:'Бет анық көрінсін, иық деңгейінен', de:'Gesicht klar sichtbar, Schulterporträt', th:'เห็นใบหน้าชัดเจน ถ่ายระดับไหล่', uz:'Yuz aniq koʻrinsin, yelka sathidan', fa:'چهره واضح، از بالای شانه' },
  photo_tip_2: { tr:'Düz/sade arka plan, iyi aydınlatma', en:'Plain background, good lighting', ru:'Простой фон, хорошее освещение', kk:'Қарапайым фон, жақсы жарық', de:'Schlichter Hintergrund, gutes Licht', th:'พื้นหลังเรียบ แสงดี', uz:'Sodda fon, yaxshi yorugʻlik', fa:'پس‌زمینه ساده، نور مناسب' },
  photo_tip_3: { tr:'Resmî / bakımlı görünüm (vesikalık tarzı)', en:'Formal, neat look (ID-photo style)', ru:'Опрятный, деловой вид', kk:'Ұқыпты, ресми келбет', de:'Gepflegtes, formelles Aussehen', th:'ดูเรียบร้อยเป็นทางการ', uz:'Ozoda, rasmiy koʻrinish', fa:'ظاهر رسمی و مرتب' },
  photo_tip_4: { tr:'Tek kişi olsun, kare (1:1) kırpılır', en:'Single person, cropped square (1:1)', ru:'Один человек, квадрат (1:1)', kk:'Жалғыз адам, шаршы (1:1)', de:'Eine Person, quadratisch (1:1)', th:'คนเดียว ตัดสี่เหลี่ยม (1:1)', uz:'Bitta odam, kvadrat (1:1)', fa:'یک نفر، مربع (۱:۱)' },

  // Telefon doğrulama
  phone_mismatch: { tr:'Numaralar eşleşmiyor. İki alana da aynı numarayı yaz.', en:'Numbers do not match. Enter the same number in both.', ru:'Номера не совпадают. Введите одинаковый номер.', kk:'Нөмірлер сәйкес келмейді. Бірдей нөмір енгізіңіз.', de:'Nummern stimmen nicht überein. Gleiche Nummer eingeben.', th:'หมายเลขไม่ตรงกัน กรอกให้เหมือนกัน', uz:'Raqamlar mos emas. Bir xil raqam kiriting.', fa:'شماره‌ها یکسان نیستند. شماره یکسان وارد کنید.' },
  phone_ok:       { tr:'Numaralar eşleşti ✓', en:'Numbers match ✓', ru:'Номера совпадают ✓', kk:'Нөмірлер сәйкес ✓', de:'Nummern stimmen ✓', th:'หมายเลขตรงกัน ✓', uz:'Raqamlar mos ✓', fa:'شماره‌ها مطابقت دارند ✓' },

  // Aile
  parent_mother: { tr:'Anne', en:'Mother', ru:'Мать', kk:'Анасы', de:'Mutter', th:'แม่', uz:'Ona', fa:'مادر' },
  parent_father: { tr:'Baba', en:'Father', ru:'Отец', kk:'Әкесі', de:'Vater', th:'พ่อ', uz:'Ota', fa:'پدر' },

  // Tekrarlanan grup / liste
  add_lang:  { tr:'+ Dil ekle', en:'+ Add language', ru:'+ Добавить язык', kk:'+ Тіл қосу', de:'+ Sprache', th:'+ เพิ่มภาษา', uz:'+ Til qoʻshish', fa:'+ افزودن زبان' },
  add_exp:   { tr:'+ Deneyim ekle', en:'+ Add experience', ru:'+ Добавить опыт', kk:'+ Тәжірибе қосу', de:'+ Erfahrung', th:'+ เพิ่มประสบการณ์', uz:'+ Tajriba qoʻshish', fa:'+ افزودن سابقه' },
  add_edu:   { tr:'+ Eğitim ekle', en:'+ Add education', ru:'+ Добавить образование', kk:'+ Білім қосу', de:'+ Ausbildung', th:'+ เพิ่มการศึกษา', uz:'+ Taʼlim qoʻshish', fa:'+ افزودن تحصیلات' },
  add_cert:  { tr:'+ Sertifika ekle', en:'+ Add certificate', ru:'+ Добавить сертификат', kk:'+ Сертификат қосу', de:'+ Zertifikat', th:'+ เพิ่มใบรับรอง', uz:'+ Sertifikat qoʻshish', fa:'+ افزودن گواهی' },
  limit_max: { tr:'En fazla {n} adet ekleyebilirsin.', en:'You can add up to {n}.', ru:'Можно добавить до {n}.', kk:'Ең көбі {n} қосуға болады.', de:'Maximal {n} möglich.', th:'เพิ่มได้สูงสุด {n}', uz:'Koʻpi bilan {n} ta.', fa:'حداکثر {n} مورد.' },
  del:       { tr:'Sil', en:'Delete', ru:'Удалить', kk:'Жою', de:'Löschen', th:'ลบ', uz:'Oʻchirish', fa:'حذف' },

  // Diller / iş / eğitim alanları
  f_language:{ tr:'Dil', en:'Language', ru:'Язык', kk:'Тіл', de:'Sprache', th:'ภาษา', uz:'Til', fa:'زبان' },
  f_level:   { tr:'Seviye', en:'Level', ru:'Уровень', kk:'Деңгей', de:'Niveau', th:'ระดับ', uz:'Daraja', fa:'سطح' },
  sec_start: { tr:'Başlangıç', en:'Start', ru:'Начало', kk:'Басталуы', de:'Beginn', th:'เริ่ม', uz:'Boshlanish', fa:'شروع' },
  sec_end:   { tr:'Bitiş', en:'End', ru:'Окончание', kk:'Аяқталуы', de:'Ende', th:'สิ้นสุด', uz:'Tugash', fa:'پایان' },
  ongoing_work: { tr:'Hâlâ çalışıyorum (Devam)', en:'Currently working', ru:'Работаю сейчас', kk:'Әлі жұмыс істеймін', de:'Aktuell tätig', th:'ทำงานอยู่ปัจจุบัน', uz:'Hozir ishlayapman', fa:'هنوز مشغول به کار' },
  ongoing_edu:  { tr:'Hâlâ devam ediyor', en:'Currently studying', ru:'Учусь сейчас', kk:'Әлі оқып жатырмын', de:'Laufend', th:'กำลังศึกษา', uz:'Hozir oʻqiyapman', fa:'در حال تحصیل' },
  f_company: { tr:'Şirket / Yer', en:'Company / Place', ru:'Компания / Место', kk:'Компания / Орын', de:'Firma / Ort', th:'บริษัท / สถานที่', uz:'Kompaniya / Joy', fa:'شرکت / محل' },
  f_position:{ tr:'Pozisyon', en:'Position', ru:'Должность', kk:'Лауазым', de:'Position', th:'ตำแหน่ง', uz:'Lavozim', fa:'سمت' },
  f_startYear:{ tr:'Başlangıç Yılı', en:'Start Year', ru:'Год начала', kk:'Басталу жылы', de:'Startjahr', th:'ปีที่เริ่ม', uz:'Boshlanish yili', fa:'سال شروع' },
  f_endYear: { tr:'Bitiş Yılı', en:'End Year', ru:'Год окончания', kk:'Аяқталу жылы', de:'Endjahr', th:'ปีที่จบ', uz:'Tugash yili', fa:'سال پایان' },
  f_edu_level:{ tr:'Eğitim Seviyesi', en:'Education Level', ru:'Уровень образования', kk:'Білім деңгейі', de:'Bildungsniveau', th:'ระดับการศึกษา', uz:'Taʼlim darajasi', fa:'مقطع تحصیلی' },
  f_school:  { tr:'Okul', en:'School', ru:'Учебное заведение', kk:'Оқу орны', de:'Schule', th:'สถานศึกษา', uz:'Oʻquv yurti', fa:'مدرسه / دانشگاه' },
  f_edu_desc:{ tr:'Bölüm / Açıklama', en:'Field / Description', ru:'Специальность / Описание', kk:'Мамандық / Сипаттама', de:'Fach / Beschreibung', th:'สาขา / รายละเอียด', uz:'Yoʻnalish / Tavsif', fa:'رشته / توضیحات' },

  // Step7
  sec_skills:    { tr:'Beceriler', en:'Skills', ru:'Навыки', kk:'Дағдылар', de:'Fähigkeiten', th:'ทักษะ', uz:'Koʻnikmalar', fa:'مهارت‌ها' },
  pick_skills:   { tr:'Becerilerini seç', en:'Select your skills', ru:'Выберите навыки', kk:'Дағдыларды таңдаңыз', de:'Fähigkeiten wählen', th:'เลือกทักษะ', uz:'Koʻnikmalarni tanlang', fa:'مهارت‌ها را انتخاب کنید' },
  sec_positions: { tr:'Pozisyon Tercihleri', en:'Position Preferences', ru:'Предпочитаемые должности', kk:'Қалаған лауазымдар', de:'Positionswünsche', th:'ตำแหน่งที่สนใจ', uz:'Lavozim istaklari', fa:'سمت‌های مورد نظر' },
  pick_positions:{ tr:'Çalışmak istediğin pozisyonlar', en:'Positions you want', ru:'Желаемые должности', kk:'Жұмыс істегіңіз келетін лауазымдар', de:'Gewünschte Positionen', th:'ตำแหน่งที่ต้องการ', uz:'Istagan lavozimlaringiz', fa:'سمت‌های دلخواه' },
  sec_certs:     { tr:'Sertifikalar', en:'Certificates', ru:'Сертификаты', kk:'Сертификаттар', de:'Zertifikate', th:'ใบรับรอง', uz:'Sertifikatlar', fa:'گواهی‌نامه‌ها' },
  f_cert_name:   { tr:'Sertifika / Eğitim Adı', en:'Certificate / Course Name', ru:'Название сертификата / курса', kk:'Сертификат / Курс атауы', de:'Zertifikat / Kursname', th:'ชื่อใบรับรอง / คอร์ส', uz:'Sertifikat / Kurs nomi', fa:'نام گواهی / دوره' },
  f_cert_inst:   { tr:'Alındığı Kurum', en:'Issuing Institution', ru:'Учреждение', kk:'Берген мекеме', de:'Ausstellende Stelle', th:'สถาบันที่ออก', uz:'Bergan muassasa', fa:'مؤسسه صادرکننده' },

  select: { tr:'Seçiniz', en:'Select', ru:'Выберите', kk:'Таңдаңыз', de:'Auswählen', th:'เลือก', uz:'Tanlang', fa:'انتخاب کنید' },
  done:   { tr:'Bitti', en:'Done', ru:'Готово', kk:'Дайын', de:'Fertig', th:'เสร็จ', uz:'Tayyor', fa:'انجام شد' },
  close:  { tr:'Kapat', en:'Close', ru:'Закрыть', kk:'Жабу', de:'Schließen', th:'ปิด', uz:'Yopish', fa:'بستن' },
};

export function t(key, lang = 'tr', vars) {
  const entry = UI[key];
  let str = (entry && (entry[lang] || entry.en)) || key;
  if (vars) Object.keys(vars).forEach((k) => { str = str.replace(`{${k}}`, vars[k]); });
  return str;
}
