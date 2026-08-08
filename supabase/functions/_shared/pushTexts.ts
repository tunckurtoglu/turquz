// supabase/functions/_shared/pushTexts.ts
// Push bildirim metinleri — 10 dil. Alıcının push_tokens.locale değerine göre seçilir.

export const LANGS = ['tr', 'en', 'ru', 'kk', 'ky', 'uz', 'tk', 'de', 'th', 'fa'] as const;
export type Lang = (typeof LANGS)[number];

type Txt = { title: string; body: string };

export function resolveLang(locale?: string | null): Lang {
  const base = (locale || 'en').toLowerCase().split(/[-_]/)[0];
  return (LANGS as readonly string[]).includes(base) ? (base as Lang) : 'en';
}

function pick(map: Partial<Record<Lang, Txt>>, lang: Lang): Txt {
  return map[lang] ?? map.en ?? { title: '', body: '' };
}

// ---- Belge bildirimleri ----
const DOC_RING: Partial<Record<Lang, Txt>> = {
  tr: { title: '📄 Yeni belge — Acente', body: 'Acenten senin için bir belge yükledi. Hemen incele.' },
  en: { title: '📄 New document — Agency', body: 'Your agency uploaded a document for you. Review it now.' },
  ru: { title: '📄 Новый документ — Агентство', body: 'Агентство загрузило для вас документ. Проверьте сейчас.' },
  kk: { title: '📄 Жаңа құжат — Агенттік', body: 'Агенттік сіз үшін құжат жүктеді. Дереу қараңыз.' },
  ky: { title: '📄 Жаңы документ — Агенттик', body: 'Агенттик сиз үчүн документ жүктөдү. Дароо караңыз.' },
  uz: { title: '📄 Yangi hujjat — Agentlik', body: 'Agentlik siz uchun hujjat yukladi. Hoziroq ko‘ring.' },
  tk: { title: '📄 Täze resminama — Agentlik', body: 'Agentlik siziň üçin resminama ýükledi. Derrew gözden geçiriň.' },
  de: { title: '📄 Neues Dokument — Agentur', body: 'Ihre Agentur hat ein Dokument für Sie hochgeladen. Bitte prüfen.' },
  th: { title: '📄 เอกสารใหม่ — เอเจนซี่', body: 'เอเจนซี่อัปโหลดเอกสารให้คุณแล้ว กรุณาตรวจสอบ' },
  fa: { title: '📄 سند جدید — آژانس', body: 'آژانس برای شما سندی بارگذاری کرد. همین الان بررسی کنید.' },
};

const DOC_NORMAL: Partial<Record<Lang, Txt>> = {
  tr: { title: '📄 Aday belge yükledi', body: 'Bir aday yeni belge yükledi.' },
  en: { title: '📄 Candidate uploaded documents', body: 'A candidate submitted new documents.' },
  ru: { title: '📄 Кандидат загрузил документы', body: 'Кандидат отправил новые документы.' },
  kk: { title: '📄 Yміткер құжат жүктedi', body: 'Үміткер жаңа құжаттар жіберді.' },
  ky: { title: '📄 Талапкер документ жүктөдү', body: 'Талапкер жаңы документтерди жиберди.' },
  uz: { title: '📄 Nomzod hujjat yukladi', body: 'Nomzod yangi hujjatlarni yubordi.' },
  tk: { title: '📄 Talyp resminama ýükledi', body: 'Talyp täze resminamalary iberdi.' },
  de: { title: '📄 Kandidat hat Dokumente hochgeladen', body: 'Ein Kandidat hat neue Dokumente eingereicht.' },
  th: { title: '📄 ผู้สมัครอัปโหลดเอกสาร', body: 'ผู้สมัครส่งเอกสารใหม่แล้ว' },
  fa: { title: '📄 نامزد سند بارگذاری کرد', body: 'یک نامزد اسناد جدید ارسال کرد.' },
};

const DOC_FLIGHT: Partial<Record<Lang, Txt>> = {
  tr: { title: '✈️ Uçuş biletiniz hazır', body: 'Biletiniz yüklendi. Karşılama bilgileri uçuş vaktine yakın iletilecektir.' },
  en: { title: '✈️ Your flight ticket is ready', body: 'Your ticket has been uploaded. Pickup details will be shared closer to your flight.' },
  ru: { title: '✈️ Ваш авиабилет готов', body: 'Билет загружен. Информация о встрече будет отправлена ближе к вылету.' },
  kk: { title: '✈️ Ұшу билетіңіз дайын', body: 'Билет жүктелді. Кездесу ақпараты ұшу уақынына жақын жіберіледі.' },
  ky: { title: '✈️ Учак билетиңиз даяр', body: 'Билет жүктөлдү. Карşılama маалыматы учуу убактысына жакын жиберилет.' },
  uz: { title: '✈️ Parvoz chiptangiz tayyor', body: 'Chipta yuklandi. Kutib olish ma’lumotlari parvoz vaqtiga yaqin yuboriladi.' },
  tk: { title: '✈️ Uçuş biletiniňiz taýýar', body: 'Bilet ýüklendi. Garşylaýjy maglumatlar uçuş wagtyna ýakyn iberiler.' },
  de: { title: '✈️ Ihr Flugticket ist bereit', body: 'Ihr Ticket wurde hochgeladen. Abholinfos folgen kurz vor dem Flug.' },
  th: { title: '✈️ ตั๋วเครื่องบินพร้อมแล้ว', body: 'อัปโหลดตั๋วแล้ว ข้อมูลรับที่สนามบินจะส่งใกล้เวลาบิน' },
  fa: { title: '✈️ بلیط پرواز شما آماده است', body: 'بلیط بارگذاری شد. اطلاعات استقبال نزدیک زمان پرواز ارسال می‌شود.' },
};

const DOC_PICKUP: Partial<Record<Lang, Txt>> = {
  tr: { title: '🤝 Karşılama görevliniz belli oldu', body: 'Havaalanında sizi karşılayacak kişinin bilgileri eklendi. Uygulamadan görün.' },
  en: { title: '🤝 Your airport pickup contact', body: 'Details of who will meet you at the airport have been added. View in the app.' },
  ru: { title: '🤝 Ваш встречающий в аэропорту', body: 'Добавлены данные человека, который встретит вас. Смотрите в приложении.' },
  kk: { title: '🤝 Әуежайда қарсы алушыңыз', body: 'Сізді күтетін адамның деректері қосылды. Қолданбадан қараңыз.' },
  ky: { title: '🤝 Аэропортто карşılaýyňyz', body: 'Сизди күтүчү кишinin маалыматы кошулду. Колдонмодон караңыз.' },
  uz: { title: '🤝 Aeroportda kutib oluvchi', body: 'Sizni kutib oladigan shaxs ma’lumotlari qo‘shildi. Ilovadan ko‘ring.' },
  tk: { title: '🤝 Howa menzilinde garşylaýjy', body: 'Sizi garşylamaga geljek kişiniň maglumatlary goşuldy. Programmadan görüň.' },
  de: { title: '🤝 Ihr Abholkontakt am Flughafen', body: 'Die Daten Ihrer Abholperson wurden hinzugefügt. In der App ansehen.' },
  th: { title: '🤝 ผู้รับที่สนามบิน', body: 'เพิ่มข้อมูลผู้รับที่สนามบินแล้ว ดูในแอป' },
  fa: { title: '🤝 مسئول استقبال فرودگاه', body: 'اطلاعات فرد استقبال‌کننده اضافه شد. در اپ ببینید.' },
};

const DOC_PACKAGE: Partial<Record<Lang, Txt>> = {
  tr: { title: '📄 Aday belge paketi gönderdi', body: 'Yeni bir belge paketi incelemenizi bekliyor.' },
  en: { title: '📄 Candidate sent a document package', body: 'A new document package is ready for your review.' },
  ru: { title: '📄 Кандидат отправил пакет документов', body: 'Новый пакет документов ожидает проверки.' },
  kk: { title: '📄 Yміткер құжат топтамасын жіберді', body: 'Жаңа құжат топтамасы қарауды күтуде.' },
  ky: { title: '📄 Талапкер документ топтомосун жиберди', body: 'Жаңы документ топтомosu текшерүүнү күтөт.' },
  uz: { title: '📄 Nomzod hujjatlar to‘plamini yubordi', body: 'Yangi hujjatlar to‘plami ko‘rib chiqishni kutmoqda.' },
  tk: { title: '📄 Talyp resminama toplumyny iberdi', body: 'Täze resminama toplumy gözden geçirmegiňizi garaşýar.' },
  de: { title: '📄 Kandidat hat Dokumentenpaket gesendet', body: 'Ein neues Dokumentenpaket wartet auf Ihre Prüfung.' },
  th: { title: '📄 ผู้สมัครส่งชุดเอกสาร', body: 'ชุดเอกสารใหม่รอการตรวจสอบของคุณ' },
  fa: { title: '📄 نامزد بسته مدارک ارسال کرد', body: 'بسته مدارک جدید منتظر بررسی شماست.' },
};

export function docPushText(kind: string, byAgency: boolean, locale?: string | null): Txt {
  const lang = resolveLang(locale);
  if (kind === 'flight_ticket') return pick(DOC_FLIGHT, lang);
  if (kind === 'pickup') return pick(DOC_PICKUP, lang);
  if (kind === 'document_package') return pick(DOC_PACKAGE, lang);
  if (byAgency) return pick(DOC_RING, lang);
  return pick(DOC_NORMAL, lang);
}

// ---- Mülakat bildirimleri ----
const IV_PROPOSED: Partial<Record<Lang, Txt>> = {
  tr: { title: '🎥 Mülakat zamanı seç', body: 'Acenten görüntülü mülakat için saatler önerdi. Uygun olanı seç.' },
  en: { title: '🎥 Choose interview time', body: 'Your agency proposed video interview slots. Pick one that suits you.' },
  ru: { title: '🎥 Выберите время собеседования', body: 'Агентство предложило время видеособеседования. Выберите удобное.' },
  kk: { title: '🎥 Сұхбат уақытын таңдаңыз', body: 'Агенттік бейне сұхбат уақыттарын ұсынды. Сізге ыңғайлысын таңдаңыз.' },
  ky: { title: '🎥 Маек убактысын тандаңыз', body: 'Агенттик видео маек убакыттарын сунуштады. Ыңгайлуусун тандаңыз.' },
  uz: { title: '🎥 Suhbat vaqtini tanlang', body: 'Agentlik video suhbat vaqtlarini taklif qildi. Qulayini tanlang.' },
  tk: { title: '🎥 Söhbetdeşlik wagtyny saýlaň', body: 'Agentlik wideo söhbetdeşlik wagtlaryny hödürledi. Amatly bolanyny saýlaň.' },
  de: { title: '🎥 Interviewzeit wählen', body: 'Ihre Agentur hat Video-Interview-Zeiten vorgeschlagen. Wählen Sie einen Termin.' },
  th: { title: '🎥 เลือกเวลาสัมภาษณ์', body: 'เอเจนซี่เสนอเวลาสัมภาษณ์วิดีโอ กรุณาเลือกเวลาที่สะดวก' },
  fa: { title: '🎥 زمان مصاحبه را انتخاب کنید', body: 'آژانس زمان‌های مصاحبه ویدیویی پیشنهاد داده. یکی را انتخاب کنید.' },
};

const IV_SCHEDULED: Partial<Record<Lang, Txt>> = {
  tr: { title: '🎥 Mülakat planlandı', body: '{code} mülakat saatini seçti: {slot}' },
  en: { title: '🎥 Interview scheduled', body: '{code} selected an interview time: {slot}' },
  ru: { title: '🎥 Собеседование запланировано', body: '{code} выбрал(а) время: {slot}' },
  kk: { title: '🎥 Сұхбат жоспарланды', body: '{code} сұхбат уақытын таңдады: {slot}' },
  ky: { title: '🎥 Маек пландаштырылды', body: '{code} маек убактысын тандады: {slot}' },
  uz: { title: '🎥 Suhbat rejalashtirildi', body: '{code} suhbat vaqtini tanladi: {slot}' },
  tk: { title: '🎥 Söhbetdeşlik meýilleşdirildi', body: '{code} söhbet wagtyny saýlady: {slot}' },
  de: { title: '🎥 Interview geplant', body: '{code} hat eine Zeit gewählt: {slot}' },
  th: { title: '🎥 นัดสัมภาษณ์แล้ว', body: '{code} เลือกเวลาสัมภาษณ์: {slot}' },
  fa: { title: '🎥 مصاحبه زمان‌بندی شد', body: '{code} زمان مصاحبه را انتخاب کرد: {slot}' },
};

const IV_DECLINED: Partial<Record<Lang, { title: string; bodyWithCode: string; bodyNoCode: string }>> = {
  tr: { title: '✕ Mülakat reddedildi', bodyWithCode: '{code} mülakat davetinizi reddetti.', bodyNoCode: 'Bir aday mülakat davetinizi reddetti.' },
  en: { title: '✕ Interview declined', bodyWithCode: '{code} declined your interview invite.', bodyNoCode: 'A candidate declined your interview invite.' },
  ru: { title: '✕ Собеседование отклонено', bodyWithCode: '{code} отклонил(а) приглашение.', bodyNoCode: 'Кандидат отклонил приглашение на собеседование.' },
  kk: { title: '✕ Сұхбат қабылданбады', bodyWithCode: '{code} сұхбат шақыруыңыздан бас тартты.', bodyNoCode: 'Үміткер сұхбат шақыруыңыздан бас тартты.' },
  ky: { title: '✕ Маек четке кагылды', bodyWithCode: '{code} маек чакырууңузду четке какты.', bodyNoCode: 'Талапкер маек чакырууңузду четке какты.' },
  uz: { title: '✕ Suhbat rad etildi', bodyWithCode: '{code} suhbat taklifingizni rad etdi.', bodyNoCode: 'Nomzod suhbat taklifingizni rad etdi.' },
  tk: { title: '✕ Söhbet ret edildi', bodyWithCode: '{code} söhbet çakylygyňyzy ret etdi.', bodyNoCode: 'Dalaşgär söhbet çakylygyňyzy ret etdi.' },
  de: { title: '✕ Interview abgelehnt', bodyWithCode: '{code} hat Ihre Interview-Einladung abgelehnt.', bodyNoCode: 'Ein Bewerber hat die Interview-Einladung abgelehnt.' },
  th: { title: '✕ ปฏิเสธสัมภาษณ์', bodyWithCode: '{code} ปฏิเสธคำเชิญสัมภาษณ์ของคุณ', bodyNoCode: 'ผู้สมัครปฏิเสธคำเชิญสัมภาษณ์ของคุณ' },
  fa: { title: '✕ مصاحبه رد شد', bodyWithCode: '{code} دعوت مصاحبه شما را رد کرد.', bodyNoCode: 'یک داوطلب دعوت مصاحبه شما را رد کرد.' },
};

const IV_NO_RESPONSE: Partial<Record<Lang, { title: string; bodyWithCode: string; bodyNoCode: string }>> = {
  tr: { title: '⏳ Yanıt yok', bodyWithCode: '{code} {hours} saattir cevap vermedi. Bekleyebilir veya başka adaya davet gönderebilirsiniz.', bodyNoCode: 'Bir aday {hours} saattir cevap vermedi. Bekleyebilir veya başka adaya davet gönderebilirsiniz.' },
  en: { title: '⏳ No response', bodyWithCode: '{code} has not replied for {hours}h. You can wait or invite another candidate.', bodyNoCode: 'A candidate has not replied for {hours}h. You can wait or invite another candidate.' },
  ru: { title: '⏳ Нет ответа', bodyWithCode: '{code} не отвечает уже {hours} ч. Можно ждать или пригласить другого.', bodyNoCode: 'Кандидат не отвечает уже {hours} ч. Можно ждать или пригласить другого.' },
  kk: { title: '⏳ Жауап жоқ', bodyWithCode: '{code} {hours} сағат жауап бермеді. Күте аласыз немесе басқа үміткерді шақыра аласыз.', bodyNoCode: 'Үміткер {hours} сағат жауап бермеді.' },
  ky: { title: '⏳ Жооп жок', bodyWithCode: '{code} {hours} саат жооп берген жок. Күтө аласыз же башка талапкерди чакыра аласыз.', bodyNoCode: 'Талапкер {hours} саат жооп берген жок.' },
  uz: { title: '⏳ Javob yo‘q', bodyWithCode: '{code} {hours} soatdir javob bermadi. Kutishingiz yoki boshqa nomzodni taklif qilishingiz mumkin.', bodyNoCode: 'Nomzod {hours} soatdir javob bermadi.' },
  tk: { title: '⏳ Jogap ýok', bodyWithCode: '{code} {hours} sagat jogap bermedi. Garaşyp bilersiňiz ýa-da başga dalaşgäri çagyryp bilersiňiz.', bodyNoCode: 'Dalaşgär {hours} sagat jogap bermedi.' },
  de: { title: '⏳ Keine Antwort', bodyWithCode: '{code} hat seit {hours} Std. nicht geantwortet. Warten oder anderen einladen.', bodyNoCode: 'Ein Bewerber hat seit {hours} Std. nicht geantwortet.' },
  th: { title: '⏳ ไม่ตอบกลับ', bodyWithCode: '{code} ไม่ตอบมา {hours} ชม. คุณรอหรือเชิญผู้สมัครคนอื่นได้', bodyNoCode: 'ผู้สมัครไม่ตอบมา {hours} ชม.' },
  fa: { title: '⏳ بدون پاسخ', bodyWithCode: '{code} {hours} ساعت است پاسخ نداده. می‌توانید صبر کنید یا داوطلب دیگری دعوت کنید.', bodyNoCode: 'یک داوطلب {hours} ساعت است پاسخ نداده.' },
};

const IV_RESPOND_REMIND: Partial<Record<Lang, Txt>> = {
  tr: { title: '⏰ Mülakat yanıtı bekleniyor', body: 'Görüntülü mülakat davetine henüz yanıt vermediniz. Saat seçin veya reddedin.' },
  en: { title: '⏰ Interview reply needed', body: 'You haven’t replied to the video interview invite. Pick a time or decline.' },
  ru: { title: '⏰ Нужен ответ на собеседование', body: 'Вы ещё не ответили на приглашение. Выберите время или отклоните.' },
  kk: { title: '⏰ Сұхбат жауабы күтілуде', body: 'Бейне сұхбат шақыруына әлі жауап бермедіңіз. Уақыт таңдаңыз немесе бас тартыңыз.' },
  ky: { title: '⏰ Маек жообу күтүлүүдө', body: 'Видео маек чакырууга жооп бере элексиз. Убакыт тандаңыз же четке кагыңыз.' },
  uz: { title: '⏰ Suhbat javobi kutilmoqda', body: 'Video suhbat taklifiga hali javob bermadingiz. Vaqt tanlang yoki rad eting.' },
  tk: { title: '⏰ Söhbet jogaby garaşylýar', body: 'Wideo söhbet çakylygyna heniz jogap bermediňiz. Wagt saýlaň ýa-da ret ediň.' },
  de: { title: '⏰ Interview-Antwort offen', body: 'Sie haben die Video-Interview-Einladung noch nicht beantwortet. Zeit wählen oder ablehnen.' },
  th: { title: '⏰ รอตอบรับสัมภาษณ์', body: 'คุณยังไม่ได้ตอบคำเชิญสัมภาษณ์วิดีโอ เลือกเวลาหรือปฏิเสธ' },
  fa: { title: '⏰ پاسخ مصاحبه لازم است', body: 'هنوز به دعوت مصاحبه ویدیویی پاسخ نداده‌اید. زمان انتخاب کنید یا رد کنید.' },
};

const POOL_PASSIVE: Partial<Record<Lang, Txt>> = {
  tr: { title: '⏸ Havuzda geçici pasif', body: 'Yanıtsız mülakat davetleri nedeniyle profiliniz {days} gün havuzda gizlendi. Reddetmek ceza sayılmaz.' },
  en: { title: '⏸ Temporarily hidden from pool', body: 'Due to unanswered interview invites, your profile is hidden for {days} days. Declining does not count.' },
  ru: { title: '⏸ Временно скрыт из пула', body: 'Из‑за неотвеченных приглашений профиль скрыт на {days} дн. Отказ не считается.' },
  kk: { title: '⏸ Пулда уақытша пассив', body: 'Жауапсыз сұхбат шақырулары үшін профиліңіз {days} күн жасырылды.' },
  ky: { title: '⏸ Пулда убактылуу пассив', body: 'Жоопсуз маек чакыруулары үчүн профилиңиз {days} күн жашырылды.' },
  uz: { title: '⏸ Havzada vaqtincha passiv', body: 'Javobsiz suhbat takliflari tufayli profilingiz {days} kun yashirinadi.' },
  tk: { title: '⏸ Howuzda wagtlaýyn passiw', body: 'Jogapsyz söhbet çakylyklary sebäpli profiliňiz {days} gün gizlendi.' },
  de: { title: '⏸ Vorübergehend im Pool verborgen', body: 'Wegen unbeantworteter Einladungen ist Ihr Profil {days} Tage verborgen. Ablehnen zählt nicht.' },
  th: { title: '⏸ ซ่อนจากพูลชั่วคราว', body: 'เนื่องจากไม่ตอบคำเชิญสัมภาษณ์ โปรไฟล์ของคุณถูกซ่อน {days} วัน' },
  fa: { title: '⏸ موقتاً از استخر پنهان', body: 'به‌خاطر دعوت‌های بی‌پاسخ، پروفایل شما {days} روز پنهان است. رد کردن جریمه نیست.' },
};

export function interviewPushText(
  kind: 'proposed' | 'scheduled' | 'declined',
  locale?: string | null,
  vars?: { code?: string; slot?: string },
): Txt {
  const lang = resolveLang(locale);
  if (kind === 'declined') {
    const t = IV_DECLINED[lang] ?? IV_DECLINED.en!;
    const code = vars?.code || '';
    return { title: t.title, body: code ? t.bodyWithCode.replace('{code}', code) : t.bodyNoCode };
  }
  const base = kind === 'proposed' ? pick(IV_PROPOSED, lang) : pick(IV_SCHEDULED, lang);
  if (kind !== 'scheduled') return base;
  const code = vars?.code || '—';
  const slot = vars?.slot || '';
  return {
    title: base.title,
    body: base.body.replace('{code}', code).replace('{slot}', slot).replace(/\s:\s*$/, '').trim(),
  };
}

export function interviewNoResponsePushText(code: string, hours: number, locale?: string | null): Txt {
  const lang = resolveLang(locale);
  const t = IV_NO_RESPONSE[lang] ?? IV_NO_RESPONSE.en!;
  const h = String(Math.max(1, hours || 48));
  const body = (code ? t.bodyWithCode.replace('{code}', code) : t.bodyNoCode).replace(/\{hours\}/g, h);
  return { title: t.title, body };
}

export function interviewRespondRemindPushText(locale?: string | null): Txt {
  return pick(IV_RESPOND_REMIND, resolveLang(locale));
}

export function poolPassivePushText(days: number, locale?: string | null): Txt {
  const lang = resolveLang(locale);
  const t = POOL_PASSIVE[lang] ?? POOL_PASSIVE.en!;
  return { title: t.title, body: t.body.replace('{days}', String(days)) };
}

// ---- Mülakat hatırlatmaları (aday: 24sa / 1sa / 15dk önce) ----
const IV_REM_24H: Partial<Record<Lang, Txt>> = {
  tr: { title: '⏰ Mülakat hatırlatması', body: 'Mülakatınıza 24 saat kaldı. Saatinizi kontrol edin.' },
  en: { title: '⏰ Interview reminder', body: 'Your interview is in 24 hours. Check the time in the app.' },
  ru: { title: '⏰ Напоминание о собеседовании', body: 'До собеседования 24 часа. Проверьте время в приложении.' },
  kk: { title: '⏰ Сұхбат еске салу', body: 'Сұхбатқа 24 сағат қалды. Уақытты қолданбада тексеріңіз.' },
  ky: { title: '⏰ Маек эскертүүсү', body: 'Маекке 24 саат калды. Убактыны колдонмодон текшериңиз.' },
  uz: { title: '⏰ Suhbat eslatmasi', body: 'Suhbatga 24 soat qoldi. Vaqtni ilovadan tekshiring.' },
  tk: { title: '⏰ Söhbet ýatlatmasy', body: 'Söhbetdeşlige 24 sagat galdy. Wagty programmadan barlaň.' },
  de: { title: '⏰ Interview-Erinnerung', body: 'Ihr Interview ist in 24 Stunden. Zeit in der App prüfen.' },
  th: { title: '⏰ เตือนสัมภาษณ์', body: 'อีก 24 ชั่วโมงจะถึงการสัมภาษณ์ ตรวจเวลาในแอป' },
  fa: { title: '⏰ یادآوری مصاحبه', body: '۲۴ ساعت تا مصاحبه. زمان را در اپ بررسی کنید.' },
};
const IV_REM_1H: Partial<Record<Lang, Txt>> = {
  tr: { title: '⏰ Mülakat hatırlatması', body: 'Mülakatınıza 1 saat kaldı.' },
  en: { title: '⏰ Interview reminder', body: 'Your interview is in 1 hour.' },
  ru: { title: '⏰ Напоминание о собеседовании', body: 'До собеседования 1 час.' },
  kk: { title: '⏰ Сұхбат еске салу', body: 'Сұхбатқа 1 сағат қалды.' },
  ky: { title: '⏰ Маек эскертүүсү', body: 'Маекке 1 саат калды.' },
  uz: { title: '⏰ Suhbat eslatmasi', body: 'Suhbatga 1 soat qoldi.' },
  tk: { title: '⏰ Söhbet ýatlatmasy', body: 'Söhbetdeşlige 1 sagat galdy.' },
  de: { title: '⏰ Interview-Erinnerung', body: 'Ihr Interview ist in 1 Stunde.' },
  th: { title: '⏰ เตือนสัมภาษณ์', body: 'อีก 1 ชั่วโมงจะถึงการสัมภาษณ์' },
  fa: { title: '⏰ یادآوری مصاحبه', body: '۱ ساعت تا مصاحبه.' },
};
const IV_REM_15M: Partial<Record<Lang, Txt>> = {
  tr: { title: '⏰ Mülakat hatırlatması', body: 'Mülakatınıza 15 dakika kaldı.' },
  en: { title: '⏰ Interview reminder', body: 'Your interview is in 15 minutes.' },
  ru: { title: '⏰ Напоминание о собеседовании', body: 'До собеседования 15 минут.' },
  kk: { title: '⏰ Сұхбат еске салу', body: 'Сұхбатқа 15 минут қалды.' },
  ky: { title: '⏰ Маек эскертүүсү', body: 'Маекке 15 мүнөт калды.' },
  uz: { title: '⏰ Suhbat eslatmasi', body: 'Suhbatga 15 daqiqa qoldi.' },
  tk: { title: '⏰ Söhbet ýatlatmasy', body: 'Söhbetdeşlige 15 minut galdy.' },
  de: { title: '⏰ Interview-Erinnerung', body: 'Ihr Interview ist in 15 Minuten.' },
  th: { title: '⏰ เตือนสัมภาษณ์', body: 'อีก 15 นาทีจะถึงการสัมภาษณ์' },
  fa: { title: '⏰ یادآوری مصاحبه', body: '۱۵ دقیقه تا مصاحبه.' },
};

const IV_REM_5M: Partial<Record<Lang, Txt>> = {
  tr: { title: '⏰ Mülakat hatırlatması', body: 'Mülakatınıza 5 dakika kaldı. Görüşmeye katılmaya hazır olun.' },
  en: { title: '⏰ Interview reminder', body: 'Your interview is in 5 minutes. Get ready to join.' },
  ru: { title: '⏰ Напоминание о собеседовании', body: 'До собеседования 5 минут. Приготовьтесь подключиться.' },
  kk: { title: '⏰ Сұхбат еске салу', body: 'Сұхбатқа 5 минут қалды. Қосылуға дайын болыңыз.' },
  ky: { title: '⏰ Маек эскертүүсү', body: 'Маекке 5 мүнөт калды. Кошулууга даяр болуңуз.' },
  uz: { title: '⏰ Suhbat eslatmasi', body: 'Suhbatga 5 daqiqa qoldi. Qo‘shilishga tayyor bo‘ling.' },
  tk: { title: '⏰ Söhbet ýatlatmasy', body: 'Söhbetdeşlige 5 minut galdy. Goşulmaga taýýar boluň.' },
  de: { title: '⏰ Interview-Erinnerung', body: 'Ihr Interview ist in 5 Minuten. Bitte bereithalten.' },
  th: { title: '⏰ เตือนสัมภาษณ์', body: 'อีก 5 นาทีจะถึงการสัมภาษณ์ เตรียมเข้าร่วม' },
  fa: { title: '⏰ یادآوری مصاحبه', body: '۵ دقیقه تا مصاحبه. برای پیوستن آماده باشید.' },
};

const REM_MAP = { '24h': IV_REM_24H, '1h': IV_REM_1H, '15m': IV_REM_15M, '5m': IV_REM_5M } as const;

export function interviewReminderPushText(which: '24h' | '1h' | '15m' | '5m', locale?: string | null): Txt {
  const lang = resolveLang(locale);
  return pick(REM_MAP[which], lang);
}

// ---- Yeni aday (acente/admin) ----
type NewCand = { title: string; bodyWithCode: string; bodyNoCode: string };

const NEW_CANDIDATE: Partial<Record<Lang, NewCand>> = {
  tr: { title: '🆕 Yeni aday', bodyWithCode: 'Havuza yeni aday eklendi: {code}', bodyNoCode: 'Havuza yeni bir aday CV’si eklendi.' },
  en: { title: '🆕 New candidate', bodyWithCode: 'New candidate in the pool: {code}', bodyNoCode: 'A new candidate CV was added to the pool.' },
  ru: { title: '🆕 Новый кандидат', bodyWithCode: 'Новый кандидат в пуле: {code}', bodyNoCode: 'В пул добавлено новое резюме кандидата.' },
  kk: { title: '🆕 Жаңа yміткер', bodyWithCode: 'Қорға жаңа yміткер қосылды: {code}', bodyNoCode: 'Қорға жаңа yміткер CV қосылды.' },
  ky: { title: '🆕 Жаңы талапкер', bodyWithCode: 'Бассейнге жаңы талапкер кошулду: {code}', bodyNoCode: 'Бассейнге жаңы талапкер CV кошулду.' },
  uz: { title: '🆕 Yangi nomzod', bodyWithCode: 'Havzga yangi nomzod qo‘shildi: {code}', bodyNoCode: 'Havzga yangi nomzod CV qo‘shildi.' },
  tk: { title: '🆕 Täze talyp', bodyWithCode: 'Hawa täze talyp goşuldy: {code}', bodyNoCode: 'Hawa täze talyp CV goşuldy.' },
  de: { title: '🆕 Neuer Kandidat', bodyWithCode: 'Neuer Kandidat im Pool: {code}', bodyNoCode: 'Ein neuer Kandidaten-Lebenslauf wurde hinzugefügt.' },
  th: { title: '🆕 ผู้สมัครใหม่', bodyWithCode: 'ผู้สมัครใหม่ในพูล: {code}', bodyNoCode: 'มี CV ผู้สมัครใหม่ในพูลแล้ว' },
  fa: { title: '🆕 نامزد جدید', bodyWithCode: 'نامزد جدید در استخر: {code}', bodyNoCode: 'رزومه نامزد جدید به استخر اضافه شد.' },
};

export function newCandidatePushText(code: string, locale?: string | null): Txt {
  const lang = resolveLang(locale);
  const t = NEW_CANDIDATE[lang] ?? NEW_CANDIDATE.en!;
  return {
    title: t.title,
    body: code ? t.bodyWithCode.replace('{code}', code) : t.bodyNoCode,
  };
}

// ---- İlk belge paketi süresi doldu (acente) ----
const DOCS_DEADLINE: Partial<Record<Lang, { title: string; bodyWithCode: string; bodyNoCode: string }>> = {
  tr: { title: '⏰ Belge süresi doldu', bodyWithCode: '{code} adayının ilk belge paketi süresi doldu. Lütfen değerlendirin.', bodyNoCode: 'Bir adayın ilk belge paketi süresi doldu. Lütfen değerlendirin.' },
  en: { title: '⏰ Document deadline passed', bodyWithCode: 'Initial document deadline passed for {code}. Please review.', bodyNoCode: 'A candidate missed the initial document deadline. Please review.' },
  ru: { title: '⏰ Срок документов истёк', bodyWithCode: 'Срок первого пакета документов истёк для {code}. Пожалуйста, проверьте.', bodyNoCode: 'Истёк срок первого пакета документов кандидата. Пожалуйста, проверьте.' },
  kk: { title: '⏰ Құжат мерзімі аяқталды', bodyWithCode: '{code} yміткерінің алғашқы құжат пакеті мерзімі аяқталды. Қарап шығыңыз.', bodyNoCode: 'Бір yміткердің алғашқы құжат пакеті мерзімі аяқталды. Қарап шығыңыз.' },
  ky: { title: '⏰ Документ мөөнөтү бitti', bodyWithCode: '{code} талапкеринин биринчи документ пакетинин мөөнөтү бitti. Карап чыгыңыз.', bodyNoCode: 'Бир талапкердин биринчи документ пакетинин мөөнөтү бitti. Карап чыгыңыз.' },
  uz: { title: '⏰ Hujjat muddati tugadi', bodyWithCode: '{code} nomzodining birinchi hujjatlar paketi muddati tugadi. Iltimos, ko‘rib chiqing.', bodyNoCode: 'Nomzodning birinchi hujjatlar paketi muddati tugadi. Iltimos, ko‘rib chiqing.' },
  tk: { title: '⏰ Resminama möhleti gutardy', bodyWithCode: '{code} talypynyň ilkinji resminama paketiniň möhleti gutardy. Gözden geçiriň.', bodyNoCode: 'Talypyň ilkinji resminama paketiniň möhleti gutardy. Gözden geçiriň.' },
  de: { title: '⏰ Dokumentenfrist abgelaufen', bodyWithCode: 'Erstes Dokumentenpaket für {code} überfällig. Bitte prüfen.', bodyNoCode: 'Erstes Dokumentenpaket eines Kandidaten überfällig. Bitte prüfen.' },
  th: { title: '⏰ หมดเวลาส่งเอกสาร', bodyWithCode: 'หมดเวลาส่งเอกสารชุดแรกของ {code} กรุณาตรวจสอบ', bodyNoCode: 'ผู้สมัครพลาดกำหนดส่งเอกสารชุดแรก กรุณาตรวจสอบ' },
  fa: { title: '⏰ مهلت مدارک تمام شد', bodyWithCode: 'مهلت بسته اول مدارک {code} تمام شد. لطفاً بررسی کنید.', bodyNoCode: 'مهلت بسته اول مدارک یک نامزد تمام شد. لطفاً بررسی کنید.' },
};

export function docsDeadlinePushText(code: string, locale?: string | null): Txt {
  const lang = resolveLang(locale);
  const t = DOCS_DEADLINE[lang] ?? DOCS_DEADLINE.en!;
  return {
    title: t.title,
    body: code ? t.bodyWithCode.replace('{code}', code) : t.bodyNoCode,
  };
}

// ---- Teklif akışı ----
const OFFER: Partial<Record<Lang, Txt>> = {
  tr: { title: '📩 Yeni teklif', body: 'Bir işveren size teklif gönderdi! Lütfen yanıtlayın.' },
  en: { title: '📩 New offer', body: 'An employer sent you an offer! Please respond.' },
  ru: { title: '📩 Новое предложение', body: 'Работодатель отправил вам предложение! Ответьте, пожалуйста.' },
  kk: { title: '📩 Жаңа ұсыныс', body: 'Жұмыс беруші сізге ұсыныс жіберді! Жауап беріңіз.' },
  ky: { title: '📩 Жаңы сунуш', body: 'Иш берүүчү сизге сунуш жөнөттү! Жооп бериңиз.' },
  uz: { title: '📩 Yangi taklif', body: 'Ish beruvchi sizga taklif yubordi! Iltimos, javob bering.' },
  tk: { title: '📩 Täze teklip', body: 'Iş beriji size teklip iberdi! Jogap beriň.' },
  de: { title: '📩 Neues Angebot', body: 'Ein Arbeitgeber hat Ihnen ein Angebot gesendet! Bitte antworten.' },
  th: { title: '📩 ข้อเสนอใหม่', body: 'นายจ้างส่งข้อเสนอให้คุณ! โปรดตอบกลับ' },
  fa: { title: '📩 پیشنهاد جدید', body: 'یک کارفرما به شما پیشنهاد داد! لطفاً پاسخ دهید.' },
};

const OFFER_ACCEPTED: Partial<Record<Lang, { title: string; bodyWithCode: string; bodyNoCode: string }>> = {
  tr: { title: '✓ Teklif kabul edildi', bodyWithCode: '{code} teklifinizi kabul etti.', bodyNoCode: 'Bir aday teklifinizi kabul etti.' },
  en: { title: '✓ Offer accepted', bodyWithCode: '{code} accepted your offer.', bodyNoCode: 'A candidate accepted your offer.' },
  ru: { title: '✓ Предложение принято', bodyWithCode: '{code} принял(а) ваше предложение.', bodyNoCode: 'Кандидат принял ваше предложение.' },
  kk: { title: '✓ Ұсыныс қабылданды', bodyWithCode: '{code} ұсынысыңызды қабылдады.', bodyNoCode: 'Үміткер ұсынысыңызды қабылдады.' },
  ky: { title: '✓ Сунуш кабыл алынды', bodyWithCode: '{code} сунушуңузду кабыл алды.', bodyNoCode: 'Талапкер сунушуңузду кабыл алды.' },
  uz: { title: '✓ Taklif qabul qilindi', bodyWithCode: '{code} taklifingizni qabul qildi.', bodyNoCode: 'Nomzod taklifingizni qabul qildi.' },
  tk: { title: '✓ Teklip kabul edildi', bodyWithCode: '{code} teklibiňizi kabul etdi.', bodyNoCode: 'Dalaşgär teklibiňizi kabul etdi.' },
  de: { title: '✓ Angebot angenommen', bodyWithCode: '{code} hat Ihr Angebot angenommen.', bodyNoCode: 'Ein Bewerber hat Ihr Angebot angenommen.' },
  th: { title: '✓ ยอมรับข้อเสนอ', bodyWithCode: '{code} ยอมรับข้อเสนอของคุณ', bodyNoCode: 'ผู้สมัครยอมรับข้อเสนอของคุณ' },
  fa: { title: '✓ پیشنهاد پذیرفته شد', bodyWithCode: '{code} پیشنهاد شما را پذیرفت.', bodyNoCode: 'یک داوطلب پیشنهاد شما را پذیرفت.' },
};

const OFFER_REJECTED: Partial<Record<Lang, { title: string; bodyWithCode: string; bodyNoCode: string }>> = {
  tr: { title: '✕ Teklif reddedildi', bodyWithCode: '{code} teklifinizi reddetti.', bodyNoCode: 'Bir aday teklifinizi reddetti.' },
  en: { title: '✕ Offer declined', bodyWithCode: '{code} declined your offer.', bodyNoCode: 'A candidate declined your offer.' },
  ru: { title: '✕ Предложение отклонено', bodyWithCode: '{code} отклонил(а) ваше предложение.', bodyNoCode: 'Кандидат отклонил ваше предложение.' },
  kk: { title: '✕ Ұсыныс қабылданбады', bodyWithCode: '{code} ұсынысыңыздан бас тартты.', bodyNoCode: 'Үміткер ұсынысыңыздан бас тартты.' },
  ky: { title: '✕ Сунуш четке какты', bodyWithCode: '{code} сунушуңузду четке какты.', bodyNoCode: 'Талапкер сунушуңузду четке какты.' },
  uz: { title: '✕ Taklif rad etildi', bodyWithCode: '{code} taklifingizni rad etdi.', bodyNoCode: 'Nomzod taklifingizni rad etdi.' },
  tk: { title: '✕ Teklip ret edildi', bodyWithCode: '{code} teklibiňizi ret etdi.', bodyNoCode: 'Dalaşgär teklibiňizi ret etdi.' },
  de: { title: '✕ Angebot abgelehnt', bodyWithCode: '{code} hat Ihr Angebot abgelehnt.', bodyNoCode: 'Ein Bewerber hat Ihr Angebot abgelehnt.' },
  th: { title: '✕ ปฏิเสธข้อเสนอ', bodyWithCode: '{code} ปฏิเสธข้อเสนอของคุณ', bodyNoCode: 'ผู้สมัครปฏิเสธข้อเสนอของคุณ' },
  fa: { title: '✕ پیشنهاد رد شد', bodyWithCode: '{code} پیشنهاد شما را رد کرد.', bodyNoCode: 'یک داوطلب پیشنهاد شما را رد کرد.' },
};

export function offerPushText(kind: 'offer' | 'offer_accepted' | 'offer_rejected', code: string, locale?: string | null): Txt {
  const lang = resolveLang(locale);
  if (kind === 'offer') return pick(OFFER, lang);
  const map = kind === 'offer_accepted' ? OFFER_ACCEPTED : OFFER_REJECTED;
  const t = map[lang] ?? map.en!;
  return {
    title: t.title,
    body: code ? t.bodyWithCode.replace('{code}', code) : t.bodyNoCode,
  };
}

const ACTIVITY_NUDGE: Partial<Record<Lang, Txt>> = {
  tr: { title: 'Turquz', body: 'Bugün uygulamaya bir kez gir — profilin havuzda daha görünür olur; işverenler aktif adayları tercih eder.' },
  en: { title: 'Turquz', body: 'Open the app once today — your profile ranks higher; employers prefer active candidates.' },
  ru: { title: 'Turquz', body: 'Зайдите сегодня в приложение — профиль выше в пуле; работодатели выбирают активных.' },
  kk: { title: 'Turquz', body: 'Бүгін қосымшаға бір рет кіріңіз — профиліңіз пулда жоғарырақ көрінеді.' },
  ky: { title: 'Turquz', body: 'Бүгүн колдонмого бир жолу кириңиз — профилиңиз пулда жогорураак көрүнөт.' },
  uz: { title: 'Turquz', body: 'Bugun ilovaga bir marta kiring — profilingiz havzada yuqoriroq ko‘rinadi.' },
  tk: { title: 'Turquz', body: 'Şu gün programma bir gezek giriň — profiliňiz howuzda has görünýär.' },
  de: { title: 'Turquz', body: 'Öffne die App heute einmal — dein Profil steht weiter oben; Arbeitgeber bevorzugen Aktive.' },
  th: { title: 'Turquz', body: 'เปิดแอปวันนี้สักครั้ง — โปรไฟล์ของคุณจะเด่นขึ้นในพูล' },
  fa: { title: 'Turquz', body: 'امروز یک‌بار اپ را باز کنید — پروفایلتان در استخر بالاتر دیده می‌شود.' },
};

export function activityNudgePushText(locale?: string | null): Txt {
  return pick(ACTIVITY_NUDGE, resolveLang(locale));
}

export type PushTokenRow = { token: string; locale?: string | null };

/** Acente tercihi: satır yoksa açık. Adaylarda satır olmaz → her zaman true. */
export async function recipientAllowsPush(
  admin: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { general_push?: boolean; chat_push?: boolean; preferred_lang?: string | null } | null }> } } } },
  userId: string,
  channel: 'general' | 'chat',
): Promise<boolean> {
  try {
    const { data } = await admin.from('agency_notif_prefs').select('general_push, chat_push').eq('user_id', userId).maybeSingle();
    if (!data) return true;
    return channel === 'chat' ? data.chat_push !== false : data.general_push !== false;
  } catch {
    return true;
  }
}

const CHAT_MSG: Partial<Record<Lang, Txt>> = {
  tr: { title: '💬 Yeni mesaj', body: 'Süreç sohbetinde yeni bir mesaj var.' },
  en: { title: '💬 New message', body: 'You have a new message in process chat.' },
  ru: { title: '💬 Новое сообщение', body: 'Новое сообщение в чате процесса.' },
  kk: { title: '💬 Жаңа хабар', body: 'Процесс чатында жаңа хабар бар.' },
  ky: { title: '💬 Жаңы билдирүү', body: 'Процесс чатында жаңы билдирүү бар.' },
  uz: { title: '💬 Yangi xabar', body: 'Jarayon chatida yangi xabar bor.' },
  tk: { title: '💬 Täze habar', body: 'Proses söhbedinde täze habar bar.' },
  de: { title: '💬 Neue Nachricht', body: 'Neue Nachricht im Prozess-Chat.' },
  th: { title: '💬 ข้อความใหม่', body: 'มีข้อความใหม่ในแชทกระบวนการ' },
  fa: { title: '💬 پیام جدید', body: 'پیام جدیدی در گفتگوی فرایند دارید.' },
};

export function chatPushText(locale?: string | null, preview?: string | null): Txt {
  const base = pick(CHAT_MSG, resolveLang(locale));
  const p = (preview || '').trim().replace(/\s+/g, ' ');
  if (!p) return base;
  return { title: base.title, body: p.length > 120 ? `${p.slice(0, 117)}…` : p };
}

export async function sendExpoPush(messages: Record<string, unknown>[]) {
  if (!messages.length) return null;
  const resp = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  return resp.json().catch(() => null);
}
