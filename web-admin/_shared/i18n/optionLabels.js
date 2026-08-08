// i18n/optionLabels.js
// Seçenek DEĞERLERİNİN (value) 8 dildeki görünen etiketleri.
// value HER ZAMAN sabit kalır (filtre + kayıt anahtarı); sadece label çevrilir.
// Bir değerin İNGİLİZCE/anahtar halini değiştirme — yeni değer eklemek serbest.
// Eksik çeviri olursa otomatik olarak 'en' veya değerin kendisi gösterilir.

// Diller (value = Türkçe ad, tarihsel anahtar olarak korunuyor)
export const LANG_LABELS = {
  'Türkçe': { tr:'Türkçe', en:'Turkish', ru:'Турецкий', kk:'Түрік тілі', de:'Türkisch', th:'ตุรกี', uz:'Turkcha', fa:'ترکی', ky:'Түркчө', tk:'Türkçe' },
  'İngilizce': { tr:'İngilizce', en:'English', ru:'Английский', kk:'Ағылшын тілі', de:'Englisch', th:'อังกฤษ', uz:'Inglizcha', fa:'انگلیسی', ky:'Англисче', tk:'Iňlisçe' },
  'Rusça': { tr:'Rusça', en:'Russian', ru:'Русский', kk:'Орыс тілі', de:'Russisch', th:'รัสเซีย', uz:'Ruscha', fa:'روسی', ky:'Орусча', tk:'Rusça' },
  'Almanca': { tr:'Almanca', en:'German', ru:'Немецкий', kk:'Неміс тілі', de:'Deutsch', th:'เยอรมัน', uz:'Nemischa', fa:'آلمانی', ky:'Немисче', tk:'Nemesçe' },
  'Arapça': { tr:'Arapça', en:'Arabic', ru:'Арабский', kk:'Араб тілі', de:'Arabisch', th:'อาหรับ', uz:'Arabcha', fa:'عربی', ky:'Арабча', tk:'Arapça' },
  'Fransızca': { tr:'Fransızca', en:'French', ru:'Французский', kk:'Француз тілі', de:'Französisch', th:'ฝรั่งเศส', uz:'Fransuzcha', fa:'فرانسوی', ky:'Французча', tk:'Fransuzça' },
  'İspanyolca': { tr:'İspanyolca', en:'Spanish', ru:'Испанский', kk:'Испан тілі', de:'Spanisch', th:'สเปน', uz:'Ispancha', fa:'اسپانیایی', ky:'Испанча', tk:'Ispança' },
  'Ukraynaca': { tr:'Ukraynaca', en:'Ukrainian', ru:'Украинский', kk:'Украин тілі', de:'Ukrainisch', th:'ยูเครน', uz:'Ukraincha', fa:'اوکراینی', ky:'Украинче', tk:'Ukrainçe' },
  'Farsça': { tr:'Farsça', en:'Persian', ru:'Персидский', kk:'Парсы тілі', de:'Persisch', th:'เปอร์เซีย', uz:'Forscha', fa:'فارسی', ky:'Фарсча', tk:'Parsça' },
  'Çince': { tr:'Çince', en:'Chinese', ru:'Китайский', kk:'Қытай тілі', de:'Chinesisch', th:'จีน', uz:'Xitoycha', fa:'چینی', ky:'Кытайча', tk:'Hytaýça' },
  'İtalyanca': { tr:'İtalyanca', en:'Italian', ru:'Итальянский', kk:'Итальян тілі', de:'Italienisch', th:'อิตาลี', uz:'Italyancha', fa:'ایتالیایی', ky:'Италиялык', tk:'Italýança' },
};

// Dil seviyeleri: A1..C2 evrensel, sadece "Anadil" çevrilir
export const LEVEL_LABELS = {
  'A1': { tr:'A1 – Başlangıç', en:'A1 – Beginner', ru:'A1 – Начальный', kk:'A1 – Бастауыш', de:'A1 – Anfänger', th:'A1 – เริ่มต้น', uz:'A1 – Boshlangʻich', fa:'A1 – مبتدی', ky:'A1 – Башталгыч', tk:'A1 – Başlangyç' },
  'A2': { tr:'A2 – Temel', en:'A2 – Elementary', ru:'A2 – Базовый', kk:'A2 – Негізгі', de:'A2 – Grundlegend', th:'A2 – พื้นฐาน', uz:'A2 – Asosiy', fa:'A2 – پایه', ky:'A2 – Негизги', tk:'A2 – Esasy' },
  'B1': { tr:'B1 – Orta', en:'B1 – Intermediate', ru:'B1 – Средний', kk:'B1 – Орташа', de:'B1 – Mittelstufe', th:'B1 – ปานกลาง', uz:'B1 – Oʻrta', fa:'B1 – متوسط', ky:'B1 – Орто', tk:'B1 – Orta' },
  'B2': { tr:'B2 – İyi', en:'B2 – Upper-Intermediate', ru:'B2 – Выше среднего', kk:'B2 – Орташадан жоғары', de:'B2 – Gut', th:'B2 – ดี', uz:'B2 – Yaxshi', fa:'B2 – خوب', ky:'B2 – Жакшы', tk:'B2 – Gowy' },
  'C1': { tr:'C1 – İleri', en:'C1 – Advanced', ru:'C1 – Продвинутый', kk:'C1 – Жоғары', de:'C1 – Fortgeschritten', th:'C1 – สูง', uz:'C1 – Ilgʻor', fa:'C1 – پیشرفته', ky:'C1 – Жогорку', tk:'C1 – Ýokary' },
  'C2': { tr:'C2 – Üst Düzey', en:'C2 – Proficient', ru:'C2 – Свободное владение', kk:'C2 – Жетік', de:'C2 – Kompetent', th:'C2 – เชี่ยวชาญ', uz:'C2 – Mukammal', fa:'C2 – تسلط کامل', ky:'C2 – Эркин', tk:'C2 – Erkin' },
  'Anadil': { tr:'Anadil', en:'Native', ru:'Родной', kk:'Ана тілі', de:'Muttersprache', th:'ภาษาแม่', uz:'Ona tili', fa:'زبان مادری', ky:'Эне тил', tk:'Ene dili' },
};

// Uyruklar (value = Türkçe ülke adı)
export const NATION_LABELS = {
  'Türkiye': { tr:'Türkiye', en:'Türkiye', ru:'Турция', kk:'Түркия', de:'Türkei', th:'ตุรกี', uz:'Turkiya', fa:'ترکیه', ky:'Түркия', tk:'Türkiýe' },
  'Azerbaycan': { tr:'Azerbaycan', en:'Azerbaijan', ru:'Азербайджан', kk:'Әзірбайжан', de:'Aserbaidschan', th:'อาเซอร์ไบจาน', uz:'Ozarbayjon', fa:'آذربایجان', ky:'Азербайжан', tk:'Azerbaýjan' },
  'Belarus': { tr:'Belarus', en:'Belarus', ru:'Беларусь', kk:'Беларусь', de:'Belarus', th:'เบลารุส', uz:'Belarus', fa:'بلاروس', ky:'Беларусь', tk:'Belarus' },
  'Gürcistan': { tr:'Gürcistan', en:'Georgia', ru:'Грузия', kk:'Грузия', de:'Georgien', th:'จอร์เจีย', uz:'Gruziya', fa:'گرجستان', ky:'Грузия', tk:'Gruziýa' },
  'Kazakistan': { tr:'Kazakistan', en:'Kazakhstan', ru:'Казахстан', kk:'Қазақстан', de:'Kasachstan', th:'คาซัคสถาน', uz:'Qozogʻiston', fa:'قزاقستان', ky:'Казакстан', tk:'Gazagystan' },
  'Kırgızistan': { tr:'Kırgızistan', en:'Kyrgyzstan', ru:'Кыргызстан', kk:'Қырғызстан', de:'Kirgisistan', th:'คีร์กีซสถาน', uz:'Qirgʻiziston', fa:'قرقیزستان', ky:'Кыргызстан', tk:'Gyrgyzystan' },
  'Özbekistan': { tr:'Özbekistan', en:'Uzbekistan', ru:'Узбекистан', kk:'Өзбекстан', de:'Usbekistan', th:'อุซเบกิสถาน', uz:'Oʻzbekiston', fa:'ازبکستان', ky:'Өзбекстан', tk:'Özbegistan' },
  'Rusya': { tr:'Rusya', en:'Russia', ru:'Россия', kk:'Ресей', de:'Russland', th:'รัสเซีย', uz:'Rossiya', fa:'روسیه', ky:'Россия', tk:'Russiýa' },
  'Tayland': { tr:'Tayland', en:'Thailand', ru:'Таиланд', kk:'Тайланд', de:'Thailand', th:'ไทย', uz:'Tailand', fa:'تایلند', ky:'Таиланд', tk:'Taýland' },
  'Türkmenistan': { tr:'Türkmenistan', en:'Turkmenistan', ru:'Туркменистан', kk:'Түрікменстан', de:'Turkmenistan', th:'เติร์กเมนิสถาน', uz:'Turkmaniston', fa:'ترکمنستان', ky:'Түркмөнстан', tk:'Türkmenistan' },
  'Ukrayna': { tr:'Ukrayna', en:'Ukraine', ru:'Украина', kk:'Украина', de:'Ukraine', th:'ยูเครน', uz:'Ukraina', fa:'اوکراین', ky:'Украина', tk:'Ukraina' },
  'Diğer': { tr:'Diğer', en:'Other', ru:'Другое', kk:'Басқа', de:'Andere', th:'อื่นๆ', uz:'Boshqa', fa:'سایر', ky:'Башка', tk:'Başga' },
};

// Eğitim seviyeleri
export const EDU_LABELS = {
  'Lise': { tr:'Lise', en:'High School', ru:'Среднее', kk:'Орта мектеп', de:'Gymnasium', th:'มัธยมปลาย', uz:'Oʻrta maktab', fa:'دبیرستان', ky:'Орто мектеп', tk:'Orta mekdep' },
  'Ön Lisans': { tr:'Ön Lisans', en:'Associate', ru:'Колледж', kk:'Колледж', de:'Associate', th:'อนุปริญญา', uz:'Kichik mutaxassis', fa:'کاردانی', ky:'Колледж', tk:'Kollej' },
  'Lisans': { tr:'Lisans', en:'Bachelor', ru:'Бакалавр', kk:'Бакалавр', de:'Bachelor', th:'ปริญญาตรี', uz:'Bakalavr', fa:'کارشناسی', ky:'Бакалавр', tk:'Bakalawr' },
  'Yüksek Lisans': { tr:'Yüksek Lisans', en:'Master', ru:'Магистр', kk:'Магистр', de:'Master', th:'ปริญญาโท', uz:'Magistr', fa:'کارشناسی ارشد', ky:'Магистр', tk:'Magistr' },
  'Doktora': { tr:'Doktora', en:'PhD', ru:'Докторантура', kk:'Докторантура', de:'Promotion', th:'ปริญญาเอก', uz:'Doktorantura', fa:'دکترا', ky:'Докторантура', tk:'Doktorantura' },
};

// Var / Yok (sabıka vb.)
export const YESNO_LABELS = {
  'Yok': { tr:'Yok', en:'No', ru:'Нет', kk:'Жоқ', de:'Nein', th:'ไม่มี', uz:'Yoʻq', fa:'ندارد', ky:'Жок', tk:'Ýok' },
  'Var': { tr:'Var', en:'Yes', ru:'Есть', kk:'Бар', de:'Ja', th:'มี', uz:'Bor', fa:'دارد', ky:'Бар', tk:'Bar' },
};

// Çalışma alanı sektörleri (value sabit)
export const POSITION_SECTOR_LABELS = {
  tourism: { tr:'Turizm', en:'Tourism', ru:'Туризм', kk:'Туризм', de:'Tourismus', th:'ท่องเที่ยว', uz:'Turizm', fa:'گردشگری', ky:'Туризм', tk:'Syýahatçylyk' },
  other: { tr:'Diğer', en:'Other', ru:'Другое', kk:'Басқа', de:'Andere', th:'อื่นๆ', uz:'Boshqa', fa:'سایر', ky:'Башка', tk:'Başga' },
};

// Pozisyonlar (value = İngilizce/Türkçe karışık tarihsel anahtarlar; sabit kalır)
export const POSITION_LABELS = {
  'Resepsiyon': { tr:'Resepsiyon', en:'Reception / Front Desk', ru:'Ресепшен', kk:'Ресепшн', de:'Rezeption', th:'แผนกต้อนรับ', uz:'Qabulxona', fa:'پذیرش', ky:'Ресепшн', tk:'Kabul ediş' },
  'Misafir İlişkileri Müdürü': { tr:'Misafir İlişkileri Müdürü', en:'Guest Relations Manager', ru:'Гостевой менеджер', kk:'Қонақтармен жұмыс менеджері', de:'Gästebetreuungsmanager', th:'ผู้จัดการดูแลลูกค้า', uz:'Mehmonlar bilan ishlash menejeri', fa:'مدیر روابط مهمان', ky:'Конок мамилелери менеджери', tk:'Myhman gatnaşyklary müdiri' },
  'Garson': { tr:'Garson', en:'Waiter', ru:'Официант', kk:'Даяшы', de:'Kellner', th:'พนักงานเสิร์ฟ', uz:'Ofitsiant', fa:'گارسون', ky:'Официант', tk:'Ofisiant' },
  'Barmen': { tr:'Barmen', en:'Bartender', ru:'Бармен', kk:'Бармен', de:'Barkeeper', th:'บาร์เทนเดอร์', uz:'Barmen', fa:'بارمن', ky:'Бармен', tk:'Barmen' },
  'Barista': { tr:'Barista', en:'Barista', ru:'Бариста', kk:'Бариста', de:'Barista', th:'บาริสต้า', uz:'Barista', fa:'باریستا', ky:'Бариста', tk:'Barista' },
  'Aşçı': { tr:'Aşçı', en:'Cook', ru:'Повар', kk:'Аспаз', de:'Koch', th:'พ่อครัว', uz:'Oshpaz', fa:'آشپز', ky:'Ашпозчу', tk:'Aşpez' },
  'Spor Animatörü': { tr:'Spor Animatörü', en:'Sports Animator', ru:'Спортивный аниматор', kk:'Спорт аниматоры', de:'Sportanimateur', th:'นักจัดกิจกรรมกีฬา', uz:'Sport animatori', fa:'انیماتور ورزشی', ky:'Спорт аниматору', tk:'Sport animatory' },
  'Çocuk Animatörü': { tr:'Çocuk Animatörü', en:'Kids Animator', ru:'Детский аниматор', kk:'Балалар аниматоры', de:'Kinderanimateur', th:'นักจัดกิจกรรมเด็ก', uz:'Bolalar animatori', fa:'انیماتور کودک', ky:'Балдар аниматору', tk:'Çaga animatory' },
  'Hostes': { tr:'Hostes', en:'Host / Hostess', ru:'Хостес', kk:'Хостес', de:'Hostess', th:'พนักงานต้อนรับ', uz:'Xostes', fa:'میزبان', ky:'Хостес', tk:'Hostes' },
  'Temizlik Görevlisi': { tr:'Temizlik Görevlisi', en:'Cleaner', ru:'Уборщик', kk:'Тазалаушы', de:'Reinigungskraft', th:'พนักงานทำความสะอาด', uz:'Farrosh', fa:'نظافتچی', ky:'Тазалоочу', tk:'Arassalaýjy' },
  'Kat Görevlisi': { tr:'Kat Görevlisi', en:'Housekeeping / Room Attendant', ru:'Горничная', kk:'Бөлме қызметшісі', de:'Zimmermädchen', th:'พนักงานทำความสะอาดห้องพัก', uz:'Xona xizmatchisi', fa:'خدمتکار اتاق', ky:'Бөлмө тейлөөчү', tk:'Otag hyzmatçysy' },
  'Mutfak Yardımcısı': { tr:'Mutfak Yardımcısı', en:'Kitchen Helper', ru:'Работник кухни', kk:'Ас үй жұмысшысы', de:'Küchenhilfe', th:'ผู้ช่วยในครัว', uz:'Oshxona yordamchisi', fa:'کمک‌آشپز', ky:'Ашкана жумушчусу', tk:'Aşhana işçisi' },
  'Masör / Masöz': { tr:'Masör / Masöz', en:'Masseur / Masseuse', ru:'Массажист / Массажистка', kk:'Массажист', de:'Masseur / Masseurin', th:'หมอนวด', uz:'Massajchi', fa:'ماساژور', ky:'Массажчы', tk:'Massažçy' },
  'Fabrika': { tr:'Fabrika', en:'Factory', ru:'Фабрика', kk:'Зауыт', de:'Fabrik', th:'โรงงาน', uz:'Fabrika', fa:'کارخانه', ky:'Фабрика', tk:'Fabrika' },
  'İnşaat': { tr:'İnşaat', en:'Construction', ru:'Строительство', kk:'Құрылыс', de:'Bauwesen', th:'ก่อสร้าง', uz:'Qurilish', fa:'ساختمان', ky:'Курулуш', tk:'Gurluşyk' },
  'Bahçe': { tr:'Bahçe', en:'Garden / Landscaping', ru:'Сад / озеленение', kk:'Бақ', de:'Garten', th:'สวน', uz:'Bogʻ', fa:'باغ', ky:'Бакча', tk:'Bagagy' },
};

// Beceriler
export const SKILL_LABELS = {
  'Misafir İlişkileri': { tr:'Misafir İlişkileri', en:'Guest Relations', ru:'Работа с гостями', kk:'Қонақтармен қарым-қатынас', de:'Gästebetreuung', th:'ดูแลลูกค้า', uz:'Mehmonlar bilan munosabat', fa:'ارتباط با مهمان', ky:'Конок мамилелери', tk:'Myhman gatnaşyklary' },
  'Servis ve Sunum Becerileri': { tr:'Servis ve Sunum', en:'Service & Presentation', ru:'Сервис и подача', kk:'Қызмет көрсету', de:'Service & Präsentation', th:'การบริการ', uz:'Xizmat va taqdimot', fa:'سرویس و ارائه', ky:'Тейлөө жана сунуштоо', tk:'Hyzmat we hödürleme' },
  'Etkili İletişim': { tr:'Etkili İletişim', en:'Effective Communication', ru:'Эффективное общение', kk:'Тиімді қарым-қатынас', de:'Effektive Kommunikation', th:'การสื่อสาร', uz:'Samarali muloqot', fa:'ارتباط مؤثر', ky:'Натыйжалуу баарлашуу', tk:'Täsirli aragatnaşyk' },
  'Takım Çalışması ve Uyum': { tr:'Takım Çalışması', en:'Teamwork', ru:'Командная работа', kk:'Командалық жұмыс', de:'Teamarbeit', th:'การทำงานเป็นทีม', uz:'Jamoaviy ish', fa:'کار تیمی', ky:'Командалык иш', tk:'Topar işi' },
  'Problem Çözme': { tr:'Problem Çözme', en:'Problem Solving', ru:'Решение проблем', kk:'Мәселе шешу', de:'Problemlösung', th:'แก้ปัญหา', uz:'Muammo yechish', fa:'حل مسئله', ky:'Маселе чечүү', tk:'Mesele çözmek' },
  'Stres Yönetimi': { tr:'Stres Yönetimi', en:'Stress Management', ru:'Управление стрессом', kk:'Стресс басқару', de:'Stressmanagement', th:'จัดการความเครียด', uz:'Stressni boshqarish', fa:'مدیریت استرس', ky:'Стрессти башкаруу', tk:'Stresi dolandyrmak' },
  'Bar Bilgisi': { tr:'Bar Bilgisi', en:'Bar Knowledge', ru:'Барное дело', kk:'Бар білімі', de:'Barkenntnisse', th:'ความรู้ด้านบาร์', uz:'Bar bilimi', fa:'دانش بار', ky:'Бар билими', tk:'Bar bilimi' },
  'Kasa / POS Kullanımı': { tr:'Kasa / POS', en:'Cashier / POS', ru:'Касса / POS', kk:'Касса / POS', de:'Kasse / POS', th:'แคชเชียร์ / POS', uz:'Kassa / POS', fa:'صندوق / POS', ky:'Касса / POS', tk:'Kassa / POS' },
  'Şikayet Yönetimi': { tr:'Şikayet Yönetimi', en:'Complaint Handling', ru:'Работа с жалобами', kk:'Шағымдармен жұмыс', de:'Beschwerdemanagement', th:'จัดการข้อร้องเรียน', uz:'Shikoyatlar bilan ishlash', fa:'مدیریت شکایات', ky:'Арыздарды башкаруу', tk:'Şikaýatlary dolandyrmak' },
  'Zaman Yönetimi': { tr:'Zaman Yönetimi', en:'Time Management', ru:'Тайм-менеджмент', kk:'Уақытты басқару', de:'Zeitmanagement', th:'บริหารเวลา', uz:'Vaqtni boshqarish', fa:'مدیریت زمان', ky:'Убакытты башкаруу', tk:'Wagty dolandyrmak' },
  'Çok Dillilik': { tr:'Çok Dillilik', en:'Multilingual', ru:'Многоязычие', kk:'Көптілділік', de:'Mehrsprachigkeit', th:'หลายภาษา', uz:'Koʻp tillilik', fa:'چندزبانگی', ky:'Көп тилдүүлүк', tk:'Köp dillilik' },
  'Hijyen / HACCP': { tr:'Hijyen / HACCP', en:'Hygiene / HACCP', ru:'Гигиена / HACCP', kk:'Гигиена / HACCP', de:'Hygiene / HACCP', th:'สุขอนามัย / HACCP', uz:'Gigiena / HACCP', fa:'بهداشت / HACCP', ky:'Гигиена / HACCP', tk:'Gigiýena / HACCP' },
};

// Çalışma durumu
export const EMPLOYMENT_STATUS_LABELS = {
  'student':  { tr:'Öğrenciyim', en:'Student',  ru:'Студент',   kk:'Студент',      de:'Student',    th:'นักเรียน',    uz:'Talaba',       fa:'دانشجو',      ky:'Студент',    tk:'Student'  },
  'employed': { tr:'Çalışıyorum', en:'Employed', ru:'Работающий', kk:'Жұмысшы',   de:'Berufstätig', th:'ทำงานอยู่', uz:'Ishlayman',     fa:'شاغل',         ky:'Иштеп жатам', tk:'Işleýärin' },
};

// Çalışma süresi tercihi
export const WORK_AVAILABILITY_LABELS = {
  seasonal:  { tr:'Sezonluk (3–6 Ay)', en:'Seasonal (3–6 months)', ru:'Сезонно (3–6 мес.)', kk:'Маусымдық (3–6 ай)', de:'Saisonal (3–6 Monate)', th:'ตามฤดูกาล (3–6 เดือน)', uz:'Mavsumiy (3–6 oy)', fa:'فصلی (۳–۶ ماه)', ky:'Мезгилдик (3–6 ай)', tk:'Möwsümle (3–6 aý)' },
  full_year: { tr:'Tüm Yıl (12 Ay)', en:'Full year (12 months)', ru:'Весь год (12 мес.)', kk:'Бүкіл жыл (12 ай)', de:'Ganzes Jahr (12 Monate)', th:'ตลอดปี (12 เดือน)', uz:'Butun yil (12 oy)', fa:'تمام سال (۱۲ ماه)', ky:'Бүткül жыл (12 ай)', tk:'Bütin ýyl (12 aý)' },
};

// Ehliyet özel etiketleri (yalnızca sözcük olanlar; harf kodları çevrilmez)
export const LICENSE_WORD_LABELS = {
  'Yok': { tr:'Yok', en:'None', ru:'Нет', kk:'Жоқ', de:'Keiner', th:'ไม่มี', uz:'Yoʻq', fa:'ندارد', ky:'Жок', tk:'Ýok' },
  'Motosiklet': { tr:'Motosiklet', en:'Motorcycle', ru:'Мотоцикл', kk:'Мотоцикл', de:'Motorrad', th:'มอเตอร์ไซค์', uz:'Mototsikl', fa:'موتورسیکلت', ky:'Мотоцикл', tk:'Motosikl' },
  'Otomobil (Özel)': { tr:'Otomobil (Özel)', en:'Car (Private)', ru:'Легковой (личный)', kk:'Жеңіл автокөлік', de:'PKW (privat)', th:'รถยนต์ส่วนตัว', uz:'Yengil avto', fa:'خودرو (شخصی)', ky:'Жеңил автоунаа', tk:'Ýeňil awtoulag' },
  'Kamyon': { tr:'Kamyon', en:'Truck', ru:'Грузовик', kk:'Жүк көлігі', de:'LKW', th:'รถบรรทุก', uz:'Yuk mashinasi', fa:'کامیون', ky:'Жүк ташуучу', tk:'Ýük ulagy' },
  'Otobüs': { tr:'Otobüs', en:'Bus', ru:'Автобус', kk:'Автобус', de:'Bus', th:'รถบัส', uz:'Avtobus', fa:'اتوبوس', ky:'Автобус', tk:'Awtobus' },
  'Toplu Taşıma': { tr:'Toplu Taşıma', en:'Public Transport', ru:'Общественный транспорт', kk:'Қоғамдық көлік', de:'ÖPNV', th:'ขนส่งสาธารณะ', uz:'Jamoat transporti', fa:'حمل‌ونقل عمومی', ky:'Коомдук транспорт', tk:'Jemgyýetçilik ulagy' },
};
