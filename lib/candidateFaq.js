// Aday paneli SSS — uygulama işleyişi ve süreç hakkında.
// Her madde: q/a dil map’leri. Eksik dilde en → tr fallback.

const FAQ = [
  {
    id: 'what',
    q: {
      tr: 'Turquz nedir?',
      en: 'What is Turquz?',
      ru: 'Что такое Turquz?',
      de: 'Was ist Turquz?',
    },
    a: {
      tr: 'Turquz, yurt dışından Türkiye’deki otel ve işletmelere çalışmak isteyen adayları acentelerle buluşturan bir kariyer platformudur. Profilinizi oluşturur, teklifleri görür ve süreci uygulamadan takip edersiniz.',
      en: 'Turquz is a careers platform that connects candidates who want to work in hotels and businesses in Turkey with agencies. You build your profile, receive offers, and follow the whole process in the app.',
      ru: 'Turquz — платформа, которая соединяет кандидатов, желающих работать в отелях и компаниях Турции, с агентствами. Вы создаёте профиль, получаете предложения и ведёте процесс в приложении.',
      de: 'Turquz verbindet Bewerber, die in Hotels und Betrieben in der Türkei arbeiten möchten, mit Agenturen. Sie erstellen Ihr Profil, erhalten Angebote und begleiten den Prozess in der App.',
    },
  },
  {
    id: 'flow',
    q: {
      tr: 'Süreç nasıl ilerler?',
      en: 'How does the process work?',
      ru: 'Как проходит процесс?',
      de: 'Wie läuft der Prozess ab?',
    },
    a: {
      tr: '1) Profil ve CV’nizi tamamlayın.\n2) Acenteler sizi görür; mülakat veya doğrudan iş teklifi gelebilir.\n3) Teklifi kabul edince belge adımları açılır.\n4) Belge işlemleri tamamlanınca uçak biletiniz gönderilir ve yeni kariyerinize başlarsınız.',
      en: '1) Complete your profile and CV.\n2) Agencies see you; you may get an interview or a direct job offer.\n3) After you accept an offer, document steps unlock.\n4) When the documents are done, your flight ticket is sent and you start your new career.',
      ru: '1) Заполните профиль и резюме.\n2) Агентства видят вас; возможен собеседование или прямое предложение.\n3) После принятия предложения открываются документы.\n4) Когда документы готовы, вам отправят авиабилет — и вы начнёте новую карьеру.',
      de: '1) Profil und Lebenslauf vervollständigen.\n2) Agenturen sehen Sie; Interview oder direktes Angebot möglich.\n3) Nach Annahme öffnen sich die Dokumentenschritte.\n4) Wenn die Dokumente fertig sind, erhalten Sie Ihr Flugticket und starten Ihre neue Karriere.',
    },
  },
  {
    id: 'cv',
    q: {
      tr: 'CV ve fotoğraflar neden önemli?',
      en: 'Why do CV and photos matter?',
      ru: 'Почему важны резюме и фото?',
      de: 'Warum sind Lebenslauf und Fotos wichtig?',
    },
    a: {
      tr: 'İşverenler ve acenteler sizi CV’niz ve fotoğraflarınız üzerinden değerlendirir. Vesikalık, yakın çekim ve boydan fotoğraflar ile kısa tanıtım videosu, doğru eşleşmeyi hızlandırır.',
      en: 'Employers and agencies assess you from your CV and photos. Portrait, close-up and full-body photos plus a short intro video help matching go faster.',
      ru: 'Работодатели и агентства оценивают вас по резюме и фото. Портрет, крупный план, фото в полный рост и короткое видео ускоряют подбор.',
      de: 'Arbeitgeber und Agenturen bewerten Sie über Lebenslauf und Fotos. Porträt, Nahaufnahme, Ganzkörperfoto und ein kurzes Video beschleunigen das Matching.',
    },
  },
  {
    id: 'offer',
    q: {
      tr: 'İş teklifi gelince ne yapmalıyım?',
      en: 'What should I do when I get a job offer?',
      ru: 'Что делать при предложении о работе?',
      de: 'Was tun bei einem Jobangebot?',
    },
    a: {
      tr: 'Ana sayfadaki teklif bildirimine dokunun. Kabul ederseniz belge yükleme adımları açılır. Reddederseniz havuzda kalır, başka fırsatlar için görünür olursunuz.',
      en: 'Tap the offer alert on the home screen. If you accept, document upload steps open. If you decline, you stay in the pool and remain visible for other opportunities.',
      ru: 'Нажмите уведомление о предложении на главном экране. При принятии откроются шаги загрузки документов. При отказе вы остаётесь в пуле.',
      de: 'Tippen Sie auf den Angebots-Hinweis auf dem Startbildschirm. Bei Annahme öffnen sich die Dokumentenschritte. Bei Ablehnung bleiben Sie im Pool.',
    },
  },
  {
    id: 'interview',
    q: {
      tr: 'Mülakat nasıl yapılır?',
      en: 'How do interviews work?',
      ru: 'Как проходят собеседования?',
      de: 'Wie laufen Interviews ab?',
    },
    a: {
      tr: 'Acente size saat önerir; uygun olanı seçersiniz. Planlanan saatte ana sayfadaki geri sayım / “Görüşmeye Katıl” ile uygulamadan görüntülü mülakata girersiniz.',
      en: 'The agency proposes times; you pick one. At the scheduled time, use the countdown / “Join the call” on the home screen to enter the video interview in the app.',
      ru: 'Агентство предлагает время; вы выбираете. В назначенный час через обратный отсчёт / «Присоединиться» на главном экране входите в видеоинтервью.',
      de: 'Die Agentur schlägt Zeiten vor; Sie wählen eine. Zur Terminzeit treten Sie über Countdown / „Beitreten“ auf dem Startbildschirm dem Video-Interview bei.',
    },
  },
  {
    id: 'docs',
    q: {
      tr: 'Hangi belgeler istenir?',
      en: 'Which documents are required?',
      ru: 'Какие документы нужны?',
      de: 'Welche Dokumente werden benötigt?',
    },
    a: {
      tr: 'Tipik sıra: pasaport, diploma, adli sicil, sağlık raporu; ardından sözleşme; sonra konsolosluk referansı ve çalışma vizesi. Acente uçak biletini son adımda yükler. Belgeler güvenli saklanır ve açık rızanızla paylaşılır.',
      en: 'Typical order: passport, diploma, criminal record, health report; then the contract; then consulate reference and work visa. The agency uploads the flight ticket in the last step. Documents are stored securely and shared only with your consent.',
      ru: 'Обычно: паспорт, диплом, справка о судимости, медсправка; затем договор; затем консульская справка и рабочая виза. Билет загружает агентство. Документы хранятся безопасно и передаются с вашего согласия.',
      de: 'Typisch: Pass, Diplom, Führungszeugnis, Gesundheitsbericht; dann Vertrag; dann Konsulatsreferenz und Arbeitsvisum. Das Flugticket lädt die Agentur. Dokumente sind sicher und werden nur mit Ihrer Einwilligung geteilt.',
    },
  },
  {
    id: 'contract',
    q: {
      tr: 'Sözleşme ve ödeme nasıl işler?',
      en: 'How do the contract and payment work?',
      ru: 'Как работают договор и оплата?',
      de: 'Wie funktionieren Vertrag und Zahlung?',
    },
    a: {
      tr: 'Sözleşmeniz gönderildiğinde, hizmet bedeli ödemenizi yaparak sürece başlarsınız.',
      en: 'When your contract is sent, you start the process by paying the service fee.',
      ru: 'Когда договор отправлен, вы начинаете процесс, оплатив сервисный сбор.',
      de: 'Sobald Ihr Vertrag gesendet wurde, starten Sie den Prozess mit der Servicegebühr.',
    },
  },
  {
    id: 'pickup',
    q: {
      tr: 'Havaalanından otelime nasıl ulaşacağım?',
      en: 'How do I get from the airport to my hotel?',
      ru: 'Как добраться из аэропорта до отеля?',
      de: 'Wie komme ich vom Flughafen zum Hotel?',
    },
    a: {
      tr: 'Uçak biletiniz geldikten sonra sizi karşılayacak kişinin adı ve WhatsApp numarası uygulamada görünür. İndiğinizde bu numarayla iletişime geçersiniz; otelinize götürülürsünüz.',
      en: 'After your flight ticket arrives, the name and WhatsApp number of the person meeting you appear in the app. Contact them when you land; they take you to your hotel.',
      ru: 'После получения авиабилета в приложении появятся имя и WhatsApp встречающего. Свяжитесь после посадки — вас отвезут в отель.',
      de: 'Nach dem Flugticket erscheinen in der App Name und WhatsApp der abholenden Person. Kontaktieren Sie sie nach der Landung; Sie werden zum Hotel gebracht.',
    },
  },
  {
    id: 'lang',
    q: {
      tr: 'Uygulamayı kendi dilimde kullanabilir miyim?',
      en: 'Can I use the app in my language?',
      ru: 'Можно ли пользоваться приложением на своём языке?',
      de: 'Kann ich die App in meiner Sprache nutzen?',
    },
    a: {
      tr: 'Evet. Sağ üstteki menüden dil seçebilirsiniz. Süreç mesajları da karşı tarafın diline otomatik çevrilir.',
      en: 'Yes. Choose your language from the top-right menu. Process messages are also auto-translated for the other party.',
      ru: 'Да. Выберите язык в меню справа сверху. Сообщения процесса также переводятся автоматически.',
      de: 'Ja. Wählen Sie die Sprache im Menü oben rechts. Prozess-Nachrichten werden ebenfalls automatisch übersetzt.',
    },
  },
];

function pick(map, lang) {
  if (!map) return '';
  return map[lang] || map.en || map.tr || Object.values(map)[0] || '';
}

export function getCandidateFaq(lang) {
  const code = String(lang || 'tr').toLowerCase().slice(0, 2);
  return FAQ.map((item) => ({
    id: item.id,
    q: pick(item.q, code),
    a: pick(item.a, code),
  }));
}
