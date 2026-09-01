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
  tr: { title: '✈️ Uçuş biletiniz hazır', body: 'İnişiniz {when}. Bileti belgelerden açabilirsiniz.' },
  en: { title: '✈️ Your flight ticket is ready', body: 'You land at {when}. Open the ticket in Documents.' },
  ru: { title: '✈️ Ваш авиабилет готов', body: 'Прилёт {when}. Откройте билет в документах.' },
  kk: { title: '✈️ Ұшу билетіңіз дайын', body: 'Қонуыңыз {when}. Билетті құжаттардан ашыңыз.' },
  ky: { title: '✈️ Учак билетиңиз даяр', body: 'Конушуңуз {when}. Билетти документтерден ачыңыз.' },
  uz: { title: '✈️ Parvoz chiptangiz tayyor', body: 'Qo‘nishingiz {when}. Chiptani hujjatlardan oching.' },
  tk: { title: '✈️ Uçuş biletiniňiz taýýar', body: 'Inişiňiz {when}. Bileti resminamalardan açyp bilersiňiz.' },
  de: { title: '✈️ Ihr Flugticket ist bereit', body: 'Ankunft {when}. Ticket unter Dokumente öffnen.' },
  th: { title: '✈️ ตั๋วเครื่องบินพร้อมแล้ว', body: 'ลงจอด {when} เปิดตั๋วในเอกสาร' },
  fa: { title: '✈️ بلیط پرواز شما آماده است', body: 'فرود شما {when}. بلیط را از مدارک باز کنید.' },
};
const DOC_FLIGHT_PLAIN: Partial<Record<Lang, Txt>> = {
  tr: { title: '✈️ Uçuş biletiniz hazır', body: 'Biletiniz yüklendi. Belgelerden açabilirsiniz.' },
  en: { title: '✈️ Your flight ticket is ready', body: 'Your ticket has been uploaded. Open it in Documents.' },
  ru: { title: '✈️ Ваш авиабилет готов', body: 'Билет загружен. Откройте его в документах.' },
  kk: { title: '✈️ Ұшу билетіңіз дайын', body: 'Билет жүктелді. Құжаттардан ашыңыз.' },
  ky: { title: '✈️ Учак билетиңиз даяр', body: 'Билет жүктөлдү. Документтерден ачыңыз.' },
  uz: { title: '✈️ Parvoz chiptangiz tayyor', body: 'Chipta yuklandi. Hujjatlardan oching.' },
  tk: { title: '✈️ Uçuş biletiniňiz taýýar', body: 'Bilet ýüklendi. Resminamalardan açyp bilersiňiz.' },
  de: { title: '✈️ Ihr Flugticket ist bereit', body: 'Ihr Ticket wurde hochgeladen. Unter Dokumente öffnen.' },
  th: { title: '✈️ ตั๋วเครื่องบินพร้อมแล้ว', body: 'อัปโหลดตั๋วแล้ว เปิดในเอกสาร' },
  fa: { title: '✈️ بلیط پرواز شما آماده است', body: 'بلیط بارگذاری شد. از مدارک باز کنید.' },
};

function applyVars(txt: Txt, vars?: Record<string, string> | null): Txt {
  if (!vars) return txt;
  let title = txt.title;
  let body = txt.body;
  for (const [k, v] of Object.entries(vars)) {
    const val = v || '';
    title = title.split(`{${k}}`).join(val);
    body = body.split(`{${k}}`).join(val);
  }
  return { title, body };
}

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

const DOC_AGENCY_RETRACTED: Partial<Record<Lang, Txt>> = {
  tr: { title: '↩ Belge geri alındı', body: 'Acenten gönderdiği bir belgeyi geri aldı. Yeni belgeyi bekleyin.' },
  en: { title: '↩ Document retracted', body: 'Your agency retracted a sent document. Please wait for the new one.' },
  ru: { title: '↩ Документ отозван', body: 'Агентство отозвало отправленный документ. Дождитесь нового.' },
  kk: { title: '↩ Құжат қайтарылды', body: 'Агенттік жіберілген құжатты қайтарды. Жаңасын күтіңіз.' },
  ky: { title: '↩ Документ кайтарылды', body: 'Агенттик жөнөтүлгөн документти кайтарды. Жаңысын күтүңүз.' },
  uz: { title: '↩ Hujjat qaytarildi', body: 'Agentlik yuborilgan hujjatni qaytarib oldi. Yangisini kuting.' },
  tk: { title: '↩ Resminama yzyna alyndy', body: 'Agentlik iberilen resminamany yzyna aldy. Täzesini garaşyň.' },
  de: { title: '↩ Dokument zurückgenommen', body: 'Ihre Agentur hat ein gesendetes Dokument zurückgenommen. Bitte warten Sie auf das neue.' },
  th: { title: '↩ ถอนเอกสารแล้ว', body: 'เอเจนซี่ถอนเอกสารที่ส่งแล้ว โปรดรอเอกสารใหม่' },
  fa: { title: '↩ مدرک پس گرفته شد', body: 'آژانس یک مدرک ارسال‌شده را پس گرفت. منتظر مدرک جدید بمانید.' },
};

const DOC_AGENCY_UPDATED: Partial<Record<Lang, Txt>> = {
  tr: { title: '📄 Belge güncellendi', body: 'Acenten bir belgenizi güncelledi. Lütfen kontrol edin.' },
  en: { title: '📄 Document updated', body: 'Your agency updated a document. Please check it.' },
  ru: { title: '📄 Документ обновлён', body: 'Агентство обновило документ. Проверьте, пожалуйста.' },
  kk: { title: '📄 Құжат жаңартылды', body: 'Агенттік құжатты жаңартты. Тексеріңіз.' },
  ky: { title: '📄 Документ жаңыртылды', body: 'Агенттик документти жаңыртты. Текшериңиз.' },
  uz: { title: '📄 Hujjat yangilandi', body: 'Agentlik hujjatni yangiladi. Tekshiring.' },
  tk: { title: '📄 Resminama täzelendi', body: 'Agentlik resminamany täzeledi. Barlaň.' },
  de: { title: '📄 Dokument aktualisiert', body: 'Ihre Agentur hat ein Dokument aktualisiert. Bitte prüfen.' },
  th: { title: '📄 อัปเดตเอกสารแล้ว', body: 'เอเจนซี่อัปเดตเอกสารแล้ว โปรดตรวจสอบ' },
  fa: { title: '📄 مدرک به‌روز شد', body: 'آژانس یک مدرک را به‌روز کرد. لطفاً بررسی کنید.' },
};

const DOC_CERT: Partial<Record<Lang, Txt>> = {
  tr: { title: '🏅 Başarı sertifikanız hazır', body: 'Turquz başarı sertifikanız e-posta adresinize gönderildi.' },
  en: { title: '🏅 Your success certificate is ready', body: 'Your Turquz success certificate was sent to your email.' },
  ru: { title: '🏅 Сертификат готов', body: 'Сертификат успеха Turquz отправлен на ваш e-mail.' },
  kk: { title: '🏅 Сертификат дайын', body: 'Turquz жетістік сертификаты e-mail поштаңызға жіберілді.' },
  de: { title: '🏅 Erfolgszertifikat bereit', body: 'Ihr Turquz-Zertifikat wurde per E-Mail gesendet.' },
};

export function docPushText(kind: string, byAgency: boolean, locale?: string | null, opts?: { when?: string | null }): Txt {
  const lang = resolveLang(locale);
  if (kind === 'success_certificate') return pick(DOC_CERT, lang);
  if (kind === 'flight_ticket') {
    const when = (opts?.when || '').trim();
    if (when) return applyVars(pick(DOC_FLIGHT, lang), { when });
    return pick(DOC_FLIGHT_PLAIN, lang);
  }
  if (kind === 'pickup') return pick(DOC_PICKUP, lang);
  if (kind === 'document_package') return pick(DOC_PACKAGE, lang);
  if (kind === 'agency_doc_retracted') return pick(DOC_AGENCY_RETRACTED, lang);
  if (kind === 'agency_doc_updated' || kind === 'flight_ticket_updated') return pick(DOC_AGENCY_UPDATED, lang);
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

const ARRIVAL_TODAY: Partial<Record<Lang, Txt>> = {
  tr: { title: '🛬 Bugün varış', body: '{code} bugün {when} iniyor.' },
  en: { title: '🛬 Arrival today', body: '{code} lands today at {when}.' },
  ru: { title: '🛬 Прилёт сегодня', body: '{code} прилетает сегодня в {when}.' },
  kk: { title: '🛬 Бүгін келеді', body: '{code} бүгін {when} келеді.' },
  ky: { title: '🛬 Бүгүн келет', body: '{code} бүгүн {when} келет.' },
  uz: { title: '🛬 Bugun keladi', body: '{code} bugun {when} keladi.' },
  tk: { title: '🛬 Şu gün gelýär', body: '{code} şu gün {when} gelýär.' },
  de: { title: '🛬 Ankunft heute', body: '{code} kommt heute um {when} an.' },
  th: { title: '🛬 มาถึงวันนี้', body: '{code} ถึงวันนี้ {when}' },
  fa: { title: '🛬 ورود امروز', body: '{code} امروز ساعت {when} می‌رسد.' },
};
const ARRIVAL_TOMORROW: Partial<Record<Lang, Txt>> = {
  tr: { title: '🛬 Yarın varış', body: '{code} yarın {when} iniyor. Karşılamayı hazırlayın.' },
  en: { title: '🛬 Arrival tomorrow', body: '{code} lands tomorrow at {when}. Prepare pickup.' },
  ru: { title: '🛬 Прилёт завтра', body: '{code} прилетает завтра в {when}. Подготовьте встречу.' },
  kk: { title: '🛬 Ертең келеді', body: '{code} ертең {when} келеді. Қарсы алуды дайындаңыз.' },
  ky: { title: '🛬 Эртең келет', body: '{code} эртең {when} келет. Тосуп алууну даярдаңыз.' },
  uz: { title: '🛬 Ertaga keladi', body: '{code} ertaga {when} keladi. Kutib olishni tayyorlang.' },
  tk: { title: '🛬 Ertir gelýär', body: '{code} ertir {when} gelýär. Garşylamany taýýarlaň.' },
  de: { title: '🛬 Ankunft morgen', body: '{code} kommt morgen um {when}. Abholung vorbereiten.' },
  th: { title: '🛬 มาถึงพรุ่งนี้', body: '{code} ถึงพรุ่งนี้ {when} เตรียมรับ' },
  fa: { title: '🛬 ورود فردا', body: '{code} فردا ساعت {when} می‌رسد. استقبال را آماده کنید.' },
};
const ARRIVAL_NODRIVER: Partial<Record<Lang, Txt>> = {
  tr: { title: '⚠️ Şoför atanmadı', body: '{code} {when} iniyor — karşılayacak kişi yok.' },
  en: { title: '⚠️ No driver assigned', body: '{code} lands at {when} — no pickup person yet.' },
  ru: { title: '⚠️ Нет водителя', body: '{code} прилетает в {when} — встречающий не назначен.' },
  kk: { title: '⚠️ Жүргізуші жоқ', body: '{code} {when} келеді — қарсы алушы жоқ.' },
  ky: { title: '⚠️ Айдоочу жок', body: '{code} {when} келет — тосуп алуучу жок.' },
  uz: { title: '⚠️ Haydovchi yo‘q', body: '{code} {when} keladi — kutib oluvchi yo‘q.' },
  tk: { title: '⚠️ Sürüji ýok', body: '{code} {when} gelýär — garşylaýjy ýok.' },
  de: { title: '⚠️ Kein Fahrer', body: '{code} kommt um {when} — niemand zur Abholung.' },
  th: { title: '⚠️ ยังไม่มีคนขับ', body: '{code} ถึง {when} — ยังไม่มีผู้รับ' },
  fa: { title: '⚠️ راننده تعیین نشده', body: '{code} ساعت {when} می‌رسد — کسی برای استقبال نیست.' },
};

export function arrivalPushText(
  kind: 'today' | 'tomorrow',
  opts: { code?: string; when?: string; missingDriver?: boolean },
  locale?: string | null,
): Txt {
  const lang = resolveLang(locale);
  const map = opts.missingDriver ? ARRIVAL_NODRIVER : (kind === 'today' ? ARRIVAL_TODAY : ARRIVAL_TOMORROW);
  const t = pick(map, lang);
  return {
    title: t.title,
    body: t.body.replace('{code}', opts.code || '—').replace('{when}', opts.when || '—'),
  };
}

const LIFECYCLE_PUSH: Record<string, Partial<Record<Lang, Txt>>> = {
  airport_check: {
    tr: { title: '🛫 Havaalanına geldiniz mi?', body: 'Uçuşunuza yaklaşık bir saat kaldı. Ana sayfadan cevaplayın.' },
    en: { title: '🛫 Are you at the airport?', body: 'Your flight is about one hour away. Answer on the home screen.' },
  },
  airport_check_confirmed: {
    tr: { title: '✓ Aday havaalanına geldi', body: 'Aday havaalanına geldiğini teyit etti. Transfer planını kontrol edin.' },
    en: { title: '✓ Candidate reached the airport', body: 'The candidate confirmed they reached the airport. Check the pickup plan.' },
  },
  airport_check_warning: {
    tr: { title: '⚠️ Aday henüz havaalanına gelmedi', body: 'Aday henüz havaalanına gelemediğini bildirdi. Bir sonraki teyidi bekleyin.' },
    en: { title: '⚠️ Candidate has not reached the airport yet', body: 'The candidate said they have not reached the airport yet. Wait for the next confirmation.' },
  },
  airport_check_late: {
    tr: { title: '⚠️ Aday uçuşa geç kaldı', body: 'Havaalanı teyidi alınamadı veya aday gelemedi. Araç göndermeden önce adayı arayın.' },
    en: { title: '⚠️ Candidate may miss the flight', body: 'No airport confirmation was received or the candidate could not arrive. Call before sending pickup.' },
  },
  boarding_check: {
    tr: { title: '🛫 Uçağa bindiniz mi?', body: 'Uçuş günündesiniz. Ana sayfadan evet / hayır cevaplayın.' },
    en: { title: '🛫 Did you board?', body: 'It is flight day. Answer yes / no on the home screen.' },
    ru: { title: '🛫 Вы вылетели?', body: 'День вылета. Ответьте да / нет на главном экране.' },
    kk: { title: '🛫 Ұшаққа отырдыңыз ба?', body: 'Ұшу күні. Басты беттен иә / жоқ деп жауап беріңіз.' },
    ky: { title: '🛫 Учакка отурдуңузбу?', body: 'Учуу күнү. Баш экрандан ооба / жок деп жооп бериңиз.' },
    uz: { title: '🛫 Samolyotga chiqdingizmi?', body: 'Parvoz kuni. Bosh ekranda ha / yo‘q deb javob bering.' },
    tk: { title: '🛫 Uçara mündüňizmi?', body: 'Uçuş güni. Baş sahypada hawa / ýok diýip jogap beriň.' },
    de: { title: '🛫 Eingestiegen?', body: 'Flugtag. Bitte ja / nein auf dem Startbildschirm.' },
    th: { title: '🛫 ขึ้นเครื่องแล้วหรือยัง?', body: 'วันบิน ตอบใช่ / ไม่ใช่ที่หน้าแรก' },
    fa: { title: '🛫 سوار شدید؟', body: 'روز پرواز است. در صفحه اصلی بله / خیر بگویید.' },
  },
  boarding_no_response: {
    tr: { title: '⏰ Uçuş cevabı yok', body: 'Aday uçuş teyidine cevap vermedi. Başlangıç tarihini kontrol edin.' },
    en: { title: '⏰ No boarding reply', body: 'Candidate did not confirm boarding. Check the start date.' },
  },
  boarding_confirmed: {
    tr: { title: '✓ Uçuş teyit edildi', body: 'Aday uçağa bindi / yola çıktı.' },
    en: { title: '✓ Boarding confirmed', body: 'The candidate boarded / is on the way.' },
  },
  boarding_missed: {
    tr: { title: '⚠️ Uçak kaçırıldı — iniş saatini güncelleyin', body: 'Aday yeni bileti kendisi alır. Yeni iniş günü/saatini girin; yoksa Varışlar listesinde görünmez, karşılama planlanamaz.' },
    en: { title: '⚠️ Flight missed — update landing time', body: 'Candidate buys the new ticket. Enter the new landing date/time or they vanish from Arrivals and pickup cannot be planned.' },
  },
  work_start_confirm: {
    tr: { title: 'İşe başladı mı?', body: 'Adayın işe başlama günü geldi. Personel olarak kaydedin veya tarihi erteleyin.' },
    en: { title: 'Did they start work?', body: 'Start date is today. Mark as staff or postpone the date.' },
    ru: { title: 'Вышел на работу?', body: 'День начала. Оформите в штат или перенесите дату.' },
    de: { title: 'Arbeitsbeginn?', body: 'Startdatum ist heute. Als Personal speichern oder Datum verschieben.' },
  },
  work_start_remind: {
    tr: { title: 'İşe başlama hatırlatması', body: 'Aday hâlâ Yolda. İşe başladı mı, kontrol edin.' },
    en: { title: 'Work-start reminder', body: 'Candidate is still in transit. Confirm whether they started.' },
  },
  employment_started: {
    tr: { title: 'İşe başlama onaylandı', body: 'Acenten sizi personel olarak kaydetti.' },
    en: { title: 'Employment started', body: 'Your agency recorded you as staff.' },
  },
  employment_end_remind: {
    tr: { title: 'Ayrılış yakında kesinleşecek', body: 'İtiraz veya geri alma için son şans.' },
    en: { title: 'Exit finalizes soon', body: 'Last chance to contest or undo.' },
  },
  employment_term_due: {
    tr: { title: 'Çalışma süresi doldu', body: 'Dönemi onaylayın veya sorunu bildirin. Otomatik sertifika yok.' },
    en: { title: 'Work term ended', body: 'Confirm completion or report a problem. No automatic certificate.' },
  },
  employment_term_remind: {
    tr: { title: 'Dönem onayı bekleniyor', body: '7 gün cevap yoksa Turquz bakar. Sertifika otomatik verilmez.' },
    en: { title: 'Term confirmation pending', body: 'After 7 days Turquz reviews. No automatic certificate.' },
  },
  employment_term_stalled: {
    tr: { title: 'Dönem onayı takıldı', body: '7 gündür cevap yok. Admin panelinden karar verin.' },
    en: { title: 'Term confirmation stalled', body: 'No reply for 7 days. Decide in the admin panel.' },
  },
  employment_term_voted: {
    tr: { title: 'Karşı taraf onayladı', body: 'Dönem onayı için sizin cevabınız da gerekir.' },
    en: { title: 'Other party confirmed', body: 'Your confirmation is still needed.' },
  },
  employment_restored: {
    tr: { title: 'İstihdam geri alındı', body: 'Personel kaydı yeniden açıldı. Belgeler yeniden yüklenmeli.' },
    en: { title: 'Employment restored', body: 'Staff record reopened. Documents must be re-uploaded.' },
  },
  rating_required: {
    tr: { title: 'Personeli puanlayın', body: 'Sezon başarıyla tamamlandı. Değerlendirme zorunludur — puan verene kadar hatırlatılır.' },
    en: { title: 'Rate your staff', body: 'The season completed successfully. Rating is required — we will remind you until you rate.' },
    ru: { title: 'Оцените сотрудника', body: 'Сезон успешно завершён. Оценка обязательна.' },
    de: { title: 'Personal bewerten', body: 'Saison erfolgreich abgeschlossen. Bewertung ist Pflicht.' },
  },
  rating_remind: {
    tr: { title: 'Puanlama bekleniyor', body: 'Tamamlanan personelinizi henüz puanlamadınız. Lütfen değerlendirin.' },
    en: { title: 'Rating still needed', body: 'You have not rated your completed staff yet. Please rate them.' },
    ru: { title: 'Нужна оценка', body: 'Вы ещё не оценили завершившего сезон сотрудника.' },
    de: { title: 'Bewertung ausstehend', body: 'Sie haben das abgeschlossene Personal noch nicht bewertet.' },
  },
  flight_ticket_ready: {
    tr: { title: '✈️ Uçak biletiniz hazır', body: 'İnişiniz {when}. Bileti belgelerden açabilirsiniz.' },
    en: { title: '✈️ Your flight ticket is ready', body: 'You land at {when}. Open the ticket in Documents.' },
    ru: { title: '✈️ Авиабилет готов', body: 'Прилёт {when}. Откройте билет в документах.' },
    kk: { title: '✈️ Ұшақ билетіңіз дайын', body: 'Қонуыңыз {when}. Билетті құжаттардан ашыңыз.' },
    ky: { title: '✈️ Учак билетиңиз даяр', body: 'Конушуңуз {when}. Билетти документтерден ачыңыз.' },
    uz: { title: '✈️ Chiptangiz tayyor', body: 'Qo‘nishingiz {when}. Chiptani hujjatlardan oching.' },
    tk: { title: '✈️ Biletiňiz taýýar', body: 'Inişiňiz {when}. Bileti resminamalardan açyp bilersiňiz.' },
    de: { title: '✈️ Flugticket bereit', body: 'Ankunft {when}. Ticket unter Dokumente öffnen.' },
    th: { title: '✈️ ตั๋วพร้อมแล้ว', body: 'ลงจอด {when} เปิดตั๋วในเอกสาร' },
    fa: { title: '✈️ بلیط آماده است', body: 'فرود شما {when}. بلیط را از مدارک باز کنید.' },
  },
  flight_ticket_sent: {
    tr: { title: 'Uçak bileti gönderildi', body: 'Adaya bilet iletildi — Yolda aşamasına geçti.' },
    en: { title: 'Flight ticket sent', body: 'Ticket sent to the candidate — now in transit.' },
  },
  transit_stalled: {
    tr: { title: 'Yolda takıldı', body: 'Aday ve acente cevap vermedi. Personeli arayıp geldi / gelmedi işaretleyin. Otomatik kayıt yok.' },
    en: { title: 'Stuck in transit', body: 'Neither candidate nor agency replied. Call them and mark arrived or not. No automatic hire.' },
  },
  employment_end_requested: {
    tr: { title: 'Ayrılış talebi', body: 'Onaylarsanız hemen biter; 7 gün içinde itiraz da edebilirsiniz.' },
    en: { title: 'Exit requested', body: 'Approve to end now, or contest within 7 days.' },
  },
  employment_end_requested_ack: {
    tr: { title: 'Ayrılış talebiniz alındı', body: 'Karşı taraf onaylarsa biter; bu sürede iptal edebilirsiniz.' },
    en: { title: 'Exit request recorded', body: 'Ends if the other party approves; you can cancel until then.' },
  },
  employment_end_undone: {
    tr: { title: 'Ayrılış iptal edildi', body: 'İstihdam ilişkisi devam ediyor.' },
    en: { title: 'Exit cancelled', body: 'Employment continues.' },
  },
  employment_completed: {
    tr: { title: 'Çalışma dönemi tamamlandı', body: 'Sezon başarıyla sona erdi.' },
    en: { title: 'Work term completed', body: 'The season ended successfully.' },
  },
  employment_early_exit: {
    tr: { title: 'Erken ayrılış', body: 'İstihdam ilişkisi erken sona erdi.' },
    en: { title: 'Early exit', body: 'Employment ended early.' },
  },
  employment_disputed: {
    tr: { title: 'Ayrılışa itiraz', body: 'Ayrılış talebine itiraz edildi. Turquz inceler.' },
    en: { title: 'Exit contested', body: 'The exit was contested. Turquz will review.' },
  },
  employment_continued: {
    tr: { title: 'İlişki devam', body: 'Ayrılış iptal / red edildi — çalışma sürüyor.' },
    en: { title: 'Employment continues', body: 'Exit was cancelled or rejected — work continues.' },
  },
  process_ended: {
    tr: { title: 'Süreç sonlandı', body: 'Acente sürecinizi sonlandırdı. Profiliniz havuza döndü.' },
    en: { title: 'Process ended', body: 'The agency ended your process. You’re back in the pool.' },
  },
  reupload: {
    tr: { title: 'Belge yeniden istendi', body: 'Bir belgeniz yeniden istendi. Lütfen tekrar yükleyin.' },
    en: { title: 'Re-upload requested', body: 'A document was requested again. Please re-upload.' },
  },
};

const LIFECYCLE_PUSH_TYPES = new Set(Object.keys(LIFECYCLE_PUSH));

export function isLifecyclePushType(type?: string | null): boolean {
  return !!type && LIFECYCLE_PUSH_TYPES.has(type);
}

export function lifecyclePushText(type: string, locale?: string | null, vars?: Record<string, string> | null): Txt {
  const map = LIFECYCLE_PUSH[type];
  if (!map) return { title: 'Turquz', body: '' };
  const txt = pick(map, resolveLang(locale));
  if (type === 'flight_ticket_ready' && !(vars?.when || '').trim()) {
    return pick(DOC_FLIGHT_PLAIN, resolveLang(locale));
  }
  return applyVars(txt, vars);
}

/** Acenteye giden istihdam/boarding türleri (tercih kapısı). Aday türleri hariç. */
export function lifecyclePushIsAgency(type: string): boolean {
  return ![
    'airport_check',
    'boarding_check',
    'employment_started',
    'flight_ticket_ready',
    'process_ended',
    'reupload',
    'employment_end_requested_ack',
  ].includes(type);
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
