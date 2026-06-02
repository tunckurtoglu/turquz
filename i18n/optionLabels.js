// i18n/optionLabels.js
// Seçenek DEĞERLERİNİN (value) 8 dildeki görünen etiketleri.
// value HER ZAMAN sabit kalır (filtre + kayıt anahtarı); sadece label çevrilir.
// Bir değerin İNGİLİZCE/anahtar halini değiştirme — yeni değer eklemek serbest.
// Eksik çeviri olursa otomatik olarak 'en' veya değerin kendisi gösterilir.

// Diller (value = Türkçe ad, tarihsel anahtar olarak korunuyor)
export const LANG_LABELS = {
  'Türkçe':     { tr:'Türkçe', en:'Turkish', ru:'Турецкий', kk:'Түрік тілі', de:'Türkisch', th:'ตุรกี', uz:'Turkcha', fa:'ترکی' },
  'İngilizce':  { tr:'İngilizce', en:'English', ru:'Английский', kk:'Ағылшын тілі', de:'Englisch', th:'อังกฤษ', uz:'Inglizcha', fa:'انگلیسی' },
  'Rusça':      { tr:'Rusça', en:'Russian', ru:'Русский', kk:'Орыс тілі', de:'Russisch', th:'รัสเซีย', uz:'Ruscha', fa:'روسی' },
  'Almanca':    { tr:'Almanca', en:'German', ru:'Немецкий', kk:'Неміс тілі', de:'Deutsch', th:'เยอรมัน', uz:'Nemischa', fa:'آلمانی' },
  'Arapça':     { tr:'Arapça', en:'Arabic', ru:'Арабский', kk:'Араб тілі', de:'Arabisch', th:'อาหรับ', uz:'Arabcha', fa:'عربی' },
  'Fransızca':  { tr:'Fransızca', en:'French', ru:'Французский', kk:'Француз тілі', de:'Französisch', th:'ฝรั่งเศส', uz:'Fransuzcha', fa:'فرانسوی' },
  'İspanyolca': { tr:'İspanyolca', en:'Spanish', ru:'Испанский', kk:'Испан тілі', de:'Spanisch', th:'สเปน', uz:'Ispancha', fa:'اسپانیایی' },
  'Ukraynaca':  { tr:'Ukraynaca', en:'Ukrainian', ru:'Украинский', kk:'Украин тілі', de:'Ukrainisch', th:'ยูเครน', uz:'Ukraincha', fa:'اوکراینی' },
  'Farsça':     { tr:'Farsça', en:'Persian', ru:'Персидский', kk:'Парсы тілі', de:'Persisch', th:'เปอร์เซีย', uz:'Forscha', fa:'فارسی' },
  'Çince':      { tr:'Çince', en:'Chinese', ru:'Китайский', kk:'Қытай тілі', de:'Chinesisch', th:'จีน', uz:'Xitoycha', fa:'چینی' },
  'İtalyanca':  { tr:'İtalyanca', en:'Italian', ru:'Итальянский', kk:'Итальян тілі', de:'Italienisch', th:'อิตาลี', uz:'Italyancha', fa:'ایتالیایی' },
};

// Dil seviyeleri: A1..C2 evrensel, sadece "Anadil" çevrilir
export const LEVEL_LABELS = {
  'A1': { tr:'A1', en:'A1', ru:'A1', kk:'A1', de:'A1', th:'A1', uz:'A1', fa:'A1' },
  'A2': { tr:'A2', en:'A2', ru:'A2', kk:'A2', de:'A2', th:'A2', uz:'A2', fa:'A2' },
  'B1': { tr:'B1', en:'B1', ru:'B1', kk:'B1', de:'B1', th:'B1', uz:'B1', fa:'B1' },
  'B2': { tr:'B2', en:'B2', ru:'B2', kk:'B2', de:'B2', th:'B2', uz:'B2', fa:'B2' },
  'C1': { tr:'C1', en:'C1', ru:'C1', kk:'C1', de:'C1', th:'C1', uz:'C1', fa:'C1' },
  'C2': { tr:'C2', en:'C2', ru:'C2', kk:'C2', de:'C2', th:'C2', uz:'C2', fa:'C2' },
  'Anadil': { tr:'Anadil', en:'Native', ru:'Родной', kk:'Ана тілі', de:'Muttersprache', th:'ภาษาแม่', uz:'Ona tili', fa:'زبان مادری' },
};

// Uyruklar (value = Türkçe ülke adı)
export const NATION_LABELS = {
  'Türkiye':      { tr:'Türkiye', en:'Türkiye', ru:'Турция', kk:'Түркия', de:'Türkei', th:'ตุรกี', uz:'Turkiya', fa:'ترکیه' },
  'Azerbaycan':   { tr:'Azerbaycan', en:'Azerbaijan', ru:'Азербайджан', kk:'Әзірбайжан', de:'Aserbaidschan', th:'อาเซอร์ไบจาน', uz:'Ozarbayjon', fa:'آذربایجان' },
  'Belarus':      { tr:'Belarus', en:'Belarus', ru:'Беларусь', kk:'Беларусь', de:'Belarus', th:'เบลารุส', uz:'Belarus', fa:'بلاروس' },
  'Gürcistan':    { tr:'Gürcistan', en:'Georgia', ru:'Грузия', kk:'Грузия', de:'Georgien', th:'จอร์เจีย', uz:'Gruziya', fa:'گرجستان' },
  'Kazakistan':   { tr:'Kazakistan', en:'Kazakhstan', ru:'Казахстан', kk:'Қазақстан', de:'Kasachstan', th:'คาซัคสถาน', uz:'Qozogʻiston', fa:'قزاقستان' },
  'Kırgızistan':  { tr:'Kırgızistan', en:'Kyrgyzstan', ru:'Кыргызстан', kk:'Қырғызстан', de:'Kirgisistan', th:'คีร์กีซสถาน', uz:'Qirgʻiziston', fa:'قرقیزستان' },
  'Özbekistan':   { tr:'Özbekistan', en:'Uzbekistan', ru:'Узбекистан', kk:'Өзбекстан', de:'Usbekistan', th:'อุซเบกิสถาน', uz:'Oʻzbekiston', fa:'ازبکستان' },
  'Rusya':        { tr:'Rusya', en:'Russia', ru:'Россия', kk:'Ресей', de:'Russland', th:'รัสเซีย', uz:'Rossiya', fa:'روسیه' },
  'Tayland':      { tr:'Tayland', en:'Thailand', ru:'Таиланд', kk:'Тайланд', de:'Thailand', th:'ไทย', uz:'Tailand', fa:'تایلند' },
  'Türkmenistan': { tr:'Türkmenistan', en:'Turkmenistan', ru:'Туркменистан', kk:'Түрікменстан', de:'Turkmenistan', th:'เติร์กเมนิสถาน', uz:'Turkmaniston', fa:'ترکمنستان' },
  'Ukrayna':      { tr:'Ukrayna', en:'Ukraine', ru:'Украина', kk:'Украина', de:'Ukraine', th:'ยูเครน', uz:'Ukraina', fa:'اوکراین' },
  'Diğer':        { tr:'Diğer', en:'Other', ru:'Другое', kk:'Басқа', de:'Andere', th:'อื่นๆ', uz:'Boshqa', fa:'سایر' },
};

// Eğitim seviyeleri
export const EDU_LABELS = {
  'Lise':          { tr:'Lise', en:'High School', ru:'Среднее', kk:'Орта мектеп', de:'Gymnasium', th:'มัธยมปลาย', uz:'Oʻrta maktab', fa:'دبیرستان' },
  'Ön Lisans':     { tr:'Ön Lisans', en:'Associate', ru:'Колледж', kk:'Колледж', de:'Associate', th:'อนุปริญญา', uz:'Kichik mutaxassis', fa:'کاردانی' },
  'Lisans':        { tr:'Lisans', en:'Bachelor', ru:'Бакалавр', kk:'Бакалавр', de:'Bachelor', th:'ปริญญาตรี', uz:'Bakalavr', fa:'کارشناسی' },
  'Yüksek Lisans': { tr:'Yüksek Lisans', en:'Master', ru:'Магистр', kk:'Магистр', de:'Master', th:'ปริญญาโท', uz:'Magistr', fa:'کارشناسی ارشد' },
  'Doktora':       { tr:'Doktora', en:'PhD', ru:'Докторантура', kk:'Докторантура', de:'Promotion', th:'ปริญญาเอก', uz:'Doktorantura', fa:'دکترا' },
};

// Var / Yok (sabıka vb.)
export const YESNO_LABELS = {
  'Yok': { tr:'Yok', en:'No', ru:'Нет', kk:'Жоқ', de:'Nein', th:'ไม่มี', uz:'Yoʻq', fa:'ندارد' },
  'Var': { tr:'Var', en:'Yes', ru:'Есть', kk:'Бар', de:'Ja', th:'มี', uz:'Bor', fa:'دارد' },
};

// Pozisyonlar (value = İngilizce/Türkçe karışık tarihsel anahtarlar; sabit kalır)
export const POSITION_LABELS = {
  'Guest Relations':              { tr:'Misafir İlişkileri', en:'Guest Relations', ru:'Гостевой сервис', kk:'Қонақтармен жұмыс', de:'Gästebetreuung', th:'ดูแลลูกค้า', uz:'Mehmonlar bilan ishlash', fa:'روابط مهمان' },
  'Resepsiyon / Önbüro':          { tr:'Resepsiyon / Önbüro', en:'Reception / Front Desk', ru:'Ресепшн', kk:'Қабылдау бөлмесі', de:'Rezeption', th:'แผนกต้อนรับ', uz:'Qabulxona', fa:'پذیرش' },
  'Çocuk Animatörü':              { tr:'Çocuk Animatörü', en:'Kids Animator', ru:'Детский аниматор', kk:'Балалар аниматоры', de:'Kinderanimateur', th:'นักจัดกิจกรรมเด็ก', uz:'Bolalar animatori', fa:'انیماتور کودک' },
  'Animasyon':                    { tr:'Animasyon', en:'Animation', ru:'Анимация', kk:'Анимация', de:'Animation', th:'แอนิเมชัน', uz:'Animatsiya', fa:'برنامه‌های سرگرمی' },
  'Garson / Servis':              { tr:'Garson / Servis', en:'Waiter / Service', ru:'Официант', kk:'Даяшы', de:'Kellner / Service', th:'พนักงานเสิร์ฟ', uz:'Ofitsiant', fa:'گارسون / سرویس' },
  'Bar':                          { tr:'Bar', en:'Bar', ru:'Бар', kk:'Бар', de:'Bar', th:'บาร์', uz:'Bar', fa:'بار' },
  'Host / Hostes':                { tr:'Host / Hostes', en:'Host / Hostess', ru:'Хостес', kk:'Хостес', de:'Host / Hostess', th:'พนักงานต้อนรับ', uz:'Xostes', fa:'میزبان' },
  'Komi':                         { tr:'Komi', en:'Busser', ru:'Помощник официанта', kk:'Даяшы көмекшісі', de:'Hilfskellner', th:'ผู้ช่วยเสิร์ฟ', uz:'Ofitsiant yordamchisi', fa:'کمک گارسون' },
  'Kat Hizmetleri (Housekeeping)':{ tr:'Kat Hizmetleri', en:'Housekeeping', ru:'Хозяйственная служба', kk:'Бөлме қызметі', de:'Housekeeping', th:'แม่บ้าน', uz:'Xonalarni tozalash', fa:'خدمات اتاق' },
  'Aşçı / Mutfak':                { tr:'Aşçı / Mutfak', en:'Cook / Kitchen', ru:'Повар / Кухня', kk:'Аспаз / Ас үй', de:'Koch / Küche', th:'พ่อครัว / ครัว', uz:'Oshpaz / Oshxona', fa:'آشپز / آشپزخانه' },
  'Bellboy':                      { tr:'Bellboy', en:'Bellboy', ru:'Коридорный', kk:'Жүкші', de:'Page', th:'พนักงานยกกระเป๋า', uz:'Yukchi', fa:'پادو' },
  'Spa & Wellness':               { tr:'Spa & Wellness', en:'Spa & Wellness', ru:'Спа и велнес', kk:'Спа және велнес', de:'Spa & Wellness', th:'สปาและสุขภาพ', uz:'Spa va wellness', fa:'اسپا و سلامت' },
  'Satış & Pazarlama':            { tr:'Satış & Pazarlama', en:'Sales & Marketing', ru:'Продажи и маркетинг', kk:'Сату және маркетинг', de:'Vertrieb & Marketing', th:'ขายและการตลาด', uz:'Sotuv va marketing', fa:'فروش و بازاریابی' },
  'Muhasebe':                     { tr:'Muhasebe', en:'Accounting', ru:'Бухгалтерия', kk:'Бухгалтерия', de:'Buchhaltung', th:'บัญชี', uz:'Buxgalteriya', fa:'حسابداری' },
  'Güvenlik':                     { tr:'Güvenlik', en:'Security', ru:'Охрана', kk:'Қауіпсіздік', de:'Sicherheit', th:'รักษาความปลอดภัย', uz:'Xavfsizlik', fa:'حراست' },
  'Teknik Servis':                { tr:'Teknik Servis', en:'Technical Service', ru:'Техслужба', kk:'Техникалық қызмет', de:'Technischer Dienst', th:'ฝ่ายเทคนิค', uz:'Texnik xizmat', fa:'خدمات فنی' },
};

// Beceriler
export const SKILL_LABELS = {
  'Misafir İlişkileri':           { tr:'Misafir İlişkileri', en:'Guest Relations', ru:'Работа с гостями', kk:'Қонақтармен қарым-қатынас', de:'Gästebetreuung', th:'ดูแลลูกค้า', uz:'Mehmonlar bilan munosabat', fa:'ارتباط با مهمان' },
  'Servis ve Sunum Becerileri':   { tr:'Servis ve Sunum', en:'Service & Presentation', ru:'Сервис и подача', kk:'Қызмет көрсету', de:'Service & Präsentation', th:'การบริการ', uz:'Xizmat va taqdimot', fa:'سرویس و ارائه' },
  'Etkili İletişim':              { tr:'Etkili İletişim', en:'Effective Communication', ru:'Эффективное общение', kk:'Тиімді қарым-қатынас', de:'Effektive Kommunikation', th:'การสื่อสาร', uz:'Samarali muloqot', fa:'ارتباط مؤثر' },
  'Takım Çalışması ve Uyum':      { tr:'Takım Çalışması', en:'Teamwork', ru:'Командная работа', kk:'Командалық жұмыс', de:'Teamarbeit', th:'การทำงานเป็นทีม', uz:'Jamoaviy ish', fa:'کار تیمی' },
  'Problem Çözme':                { tr:'Problem Çözme', en:'Problem Solving', ru:'Решение проблем', kk:'Мәселе шешу', de:'Problemlösung', th:'แก้ปัญหา', uz:'Muammo yechish', fa:'حل مسئله' },
  'Stres Yönetimi':               { tr:'Stres Yönetimi', en:'Stress Management', ru:'Управление стрессом', kk:'Стресс басқару', de:'Stressmanagement', th:'จัดการความเครียด', uz:'Stressni boshqarish', fa:'مدیریت استرس' },
  'Bar Bilgisi':                  { tr:'Bar Bilgisi', en:'Bar Knowledge', ru:'Барное дело', kk:'Бар білімі', de:'Barkenntnisse', th:'ความรู้ด้านบาร์', uz:'Bar bilimi', fa:'دانش بار' },
  'Kasa / POS Kullanımı':         { tr:'Kasa / POS', en:'Cashier / POS', ru:'Касса / POS', kk:'Касса / POS', de:'Kasse / POS', th:'แคชเชียร์ / POS', uz:'Kassa / POS', fa:'صندوق / POS' },
  'Şikayet Yönetimi':             { tr:'Şikayet Yönetimi', en:'Complaint Handling', ru:'Работа с жалобами', kk:'Шағымдармен жұмыс', de:'Beschwerdemanagement', th:'จัดการข้อร้องเรียน', uz:'Shikoyatlar bilan ishlash', fa:'مدیریت شکایات' },
  'Zaman Yönetimi':               { tr:'Zaman Yönetimi', en:'Time Management', ru:'Тайм-менеджмент', kk:'Уақытты басқару', de:'Zeitmanagement', th:'บริหารเวลา', uz:'Vaqtni boshqarish', fa:'مدیریت زمان' },
  'Çok Dillilik':                 { tr:'Çok Dillilik', en:'Multilingual', ru:'Многоязычие', kk:'Көптілділік', de:'Mehrsprachigkeit', th:'หลายภาษา', uz:'Koʻp tillilik', fa:'چندزبانگی' },
  'Hijyen / HACCP':               { tr:'Hijyen / HACCP', en:'Hygiene / HACCP', ru:'Гигиена / HACCP', kk:'Гигиена / HACCP', de:'Hygiene / HACCP', th:'สุขอนามัย / HACCP', uz:'Gigiena / HACCP', fa:'بهداشت / HACCP' },
};

// Ehliyet özel etiketleri (yalnızca sözcük olanlar; harf kodları çevrilmez)
export const LICENSE_WORD_LABELS = {
  'Yok':            { tr:'Yok', en:'None', ru:'Нет', kk:'Жоқ', de:'Keiner', th:'ไม่มี', uz:'Yoʻq', fa:'ندارد' },
  'Motosiklet':     { tr:'Motosiklet', en:'Motorcycle', ru:'Мотоцикл', kk:'Мотоцикл', de:'Motorrad', th:'มอเตอร์ไซค์', uz:'Mototsikl', fa:'موتورسیکلت' },
  'Otomobil (Özel)':{ tr:'Otomobil (Özel)', en:'Car (Private)', ru:'Легковой (личный)', kk:'Жеңіл автокөлік', de:'PKW (privat)', th:'รถยนต์ส่วนตัว', uz:'Yengil avto', fa:'خودرو (شخصی)' },
  'Kamyon':         { tr:'Kamyon', en:'Truck', ru:'Грузовик', kk:'Жүк көлігі', de:'LKW', th:'รถบรรทุก', uz:'Yuk mashinasi', fa:'کامیون' },
  'Otobüs':         { tr:'Otobüs', en:'Bus', ru:'Автобус', kk:'Автобус', de:'Bus', th:'รถบัส', uz:'Avtobus', fa:'اتوبوس' },
  'Toplu Taşıma':   { tr:'Toplu Taşıma', en:'Public Transport', ru:'Общественный транспорт', kk:'Қоғамдық көлік', de:'ÖPNV', th:'ขนส่งสาธารณะ', uz:'Jamoat transporti', fa:'حمل‌ونقل عمومی' },
};
