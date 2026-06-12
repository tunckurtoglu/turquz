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

// Pozisyonlar (value = İngilizce/Türkçe karışık tarihsel anahtarlar; sabit kalır)
export const POSITION_LABELS = {
  'Guest Relations': { tr:'Misafir İlişkileri', en:'Guest Relations', ru:'Гостевой сервис', kk:'Қонақтармен жұмыс', de:'Gästebetreuung', th:'ดูแลลูกค้า', uz:'Mehmonlar bilan ishlash', fa:'روابط مهمان', ky:'Конок мамилелери', tk:'Myhman gatnaşyklary' },
  'Resepsiyon / Önbüro': { tr:'Resepsiyon / Önbüro', en:'Reception / Front Desk', ru:'Ресепшн', kk:'Қабылдау бөлмесі', de:'Rezeption', th:'แผนกต้อนรับ', uz:'Qabulxona', fa:'پذیرش', ky:'Кабылдама', tk:'Kabul ediş' },
  'Çocuk Animatörü': { tr:'Çocuk Animatörü', en:'Kids Animator', ru:'Детский аниматор', kk:'Балалар аниматоры', de:'Kinderanimateur', th:'นักจัดกิจกรรมเด็ก', uz:'Bolalar animatori', fa:'انیماتور کودک', ky:'Балдар аниматору', tk:'Çaga animatory' },
  'Animasyon': { tr:'Animasyon', en:'Animation', ru:'Анимация', kk:'Анимация', de:'Animation', th:'แอนิเมชัน', uz:'Animatsiya', fa:'برنامه‌های سرگرمی', ky:'Анимация', tk:'Animasiýa' },
  'Garson / Servis': { tr:'Garson / Servis', en:'Waiter / Service', ru:'Официант', kk:'Даяшы', de:'Kellner / Service', th:'พนักงานเสิร์ฟ', uz:'Ofitsiant', fa:'گارسون / سرویس', ky:'Официант', tk:'Ofisiant' },
  'Bar': { tr:'Bar', en:'Bar', ru:'Бар', kk:'Бар', de:'Bar', th:'บาร์', uz:'Bar', fa:'بار', ky:'Бар', tk:'Bar' },
  'Host / Hostes': { tr:'Host / Hostes', en:'Host / Hostess', ru:'Хостес', kk:'Хостес', de:'Host / Hostess', th:'พนักงานต้อนรับ', uz:'Xostes', fa:'میزبان', ky:'Хостес', tk:'Hostes' },
  'Komi': { tr:'Komi', en:'Busser', ru:'Помощник официанта', kk:'Даяшы көмекшісі', de:'Hilfskellner', th:'ผู้ช่วยเสิร์ฟ', uz:'Ofitsiant yordamchisi', fa:'کمک گارسون', ky:'Официант жардамчысы', tk:'Ofisiant kömekçisi' },
  'Kat Hizmetleri (Housekeeping)': { tr:'Kat Hizmetleri', en:'Housekeeping', ru:'Уборщик', kk:'Бөлме қызметі', de:'Housekeeping', th:'แม่บ้าน', uz:'Xonalarni tozalash', fa:'خدمات اتاق', ky:'Бөлмө тейлөө', tk:'Otag hyzmaty' },
  'Aşçı / Mutfak': { tr:'Aşçı / Mutfak', en:'Cook / Kitchen', ru:'Повар / Кухня', kk:'Аспаз / Ас үй', de:'Koch / Küche', th:'พ่อครัว / ครัว', uz:'Oshpaz / Oshxona', fa:'آشپز / آشپزخانه', ky:'Ашпозчу / Ашкана', tk:'Aşpez / Aşhana' },
  'Bellboy': { tr:'Bellboy', en:'Bellboy', ru:'Белбой', kk:'Жүкші', de:'Page', th:'พนักงานยกกระเป๋า', uz:'Yukchi', fa:'پادو', ky:'Жүкчү', tk:'Ýükçi' },
  'Spa & Wellness': { tr:'Spa & Wellness', en:'Spa & Wellness', ru:'Спа и велнес', kk:'Спа және велнес', de:'Spa & Wellness', th:'สปาและสุขภาพ', uz:'Spa va wellness', fa:'اسپا و سلامت', ky:'Спа жана велнес', tk:'Spa we wellness' },
  'Masör / Masöz': { tr:'Masör / Masöz', en:'Masseur / Masseuse', ru:'Массажист / Массажистка', kk:'Массажист', de:'Masseur / Masseurin', th:'นักนวด', uz:'Massajchi', fa:'ماساژور', ky:'Массажчы', tk:'Massažçy' },
  'Bakıcı': { tr:'Bakıcı', en:'Caregiver / Nanny', ru:'Няня', kk:'Күтуші', de:'Betreuer / Kindermädchen', th:'พี่เลี้ยง', uz:'Enaga', fa:'پرستار', ky:'Багуучу', tk:'Seretçi' },
  'Satış & Pazarlama': { tr:'Satış & Pazarlama', en:'Sales & Marketing', ru:'Продажи и маркетинг', kk:'Сату және маркетинг', de:'Vertrieb & Marketing', th:'ขายและการตลาด', uz:'Sotuv va marketing', fa:'فروش و بازاریابی', ky:'Сатуу жана маркетинг', tk:'Satuw we marketing' },
  'Muhasebe': { tr:'Muhasebe', en:'Accounting', ru:'Бухгалтерия', kk:'Бухгалтерия', de:'Buchhaltung', th:'บัญชี', uz:'Buxgalteriya', fa:'حسابداری', ky:'Бухгалтерия', tk:'Buhgalteriýa' },
  'Güvenlik': { tr:'Güvenlik', en:'Security', ru:'Охрана', kk:'Қауіпсіздік', de:'Sicherheit', th:'รักษาความปลอดภัย', uz:'Xavfsizlik', fa:'حراست', ky:'Коопсуздук', tk:'Howpsuzlyk' },
  'Teknik Servis': { tr:'Teknik Servis', en:'Technical Service', ru:'Техслужба', kk:'Техникалық қызмет', de:'Technischer Dienst', th:'ฝ่ายเทคนิค', uz:'Texnik xizmat', fa:'خدمات فنی', ky:'Техникалык кызмат', tk:'Tehniki hyzmat' },
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

// Ehliyet özel etiketleri (yalnızca sözcük olanlar; harf kodları çevrilmez)
export const LICENSE_WORD_LABELS = {
  'Yok': { tr:'Yok', en:'None', ru:'Нет', kk:'Жоқ', de:'Keiner', th:'ไม่มี', uz:'Yoʻq', fa:'ندارد', ky:'Жок', tk:'Ýok' },
  'Motosiklet': { tr:'Motosiklet', en:'Motorcycle', ru:'Мотоцикл', kk:'Мотоцикл', de:'Motorrad', th:'มอเตอร์ไซค์', uz:'Mototsikl', fa:'موتورسیکلت', ky:'Мотоцикл', tk:'Motosikl' },
  'Otomobil (Özel)': { tr:'Otomobil (Özel)', en:'Car (Private)', ru:'Легковой (личный)', kk:'Жеңіл автокөлік', de:'PKW (privat)', th:'รถยนต์ส่วนตัว', uz:'Yengil avto', fa:'خودرو (شخصی)', ky:'Жеңил автоунаа', tk:'Ýeňil awtoulag' },
  'Kamyon': { tr:'Kamyon', en:'Truck', ru:'Грузовик', kk:'Жүк көлігі', de:'LKW', th:'รถบรรทุก', uz:'Yuk mashinasi', fa:'کامیون', ky:'Жүк ташуучу', tk:'Ýük ulagy' },
  'Otobüs': { tr:'Otobüs', en:'Bus', ru:'Автобус', kk:'Автобус', de:'Bus', th:'รถบัส', uz:'Avtobus', fa:'اتوبوس', ky:'Автобус', tk:'Awtobus' },
  'Toplu Taşıma': { tr:'Toplu Taşıma', en:'Public Transport', ru:'Общественный транспорт', kk:'Қоғамдық көлік', de:'ÖPNV', th:'ขนส่งสาธารณะ', uz:'Jamoat transporti', fa:'حمل‌ونقل عمومی', ky:'Коомдук транспорт', tk:'Jemgyýetçilik ulagy' },
};
