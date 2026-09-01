// lib/theme.js
// AURORA tasarım sistemi — lüks otelcilik (altın + lacivert, editorial).
// Tüm ekranlar bu token'ları kullanır: renk, boşluk, yarıçap, gölge, tipografi.

export const C = {
  // Lacivert (ink) skalası
  navy: '#16202e',     // en koyu (header zemini)
  navySoft: '#1b2533', // marka laciverti
  ink: '#1b2533',      // birincil metin
  ink2: '#566072',     // ikincil metin
  muted: '#9aa1ac',    // soluk metin

  // Altın skalası
  gold: '#c2a25a',
  goldLight: '#dcc187',
  goldDeep: '#a8842f',
  goldText: '#9a7b1f', // altın metin (açık zeminde okunur)
  goldSoft: '#f3ecdc',  // altın hafif zemin (rozet/iz)

  // Yüzeyler — sıcak kâğıt tonu (saf gri DEĞİL → premium his)
  bg: '#f6f3ec',
  card: '#ffffff',
  cardAlt: '#fbf9f4',
  hair: '#ece7db',     // sıcak kıl-payı çizgi
  hairDark: 'rgba(255,255,255,0.10)',

  // Durum renkleri (rafine)
  ok: '#1f8a4c', okSoft: '#e7f3ec',
  warn: '#c98a1e', warnSoft: '#fbf0db',
  danger: '#b5413a', dangerSoft: '#fbeae8',
  offer: '#7c54d6', offerSoft: '#f1ebfb', // teklifli (mor)
};

// Koyu premium yüzeyler — açık içerik ekranlarıyla aynı sistemde kullanılabilir.
export const D = {
  bg: '#0a1121',
  card: '#121b2e',
  cardAlt: '#1a2536',
  ink: '#f0ece4',
  ink2: '#8e98a8',
  muted: '#687487',
  gold: '#c8b88e',
  goldDeep: '#a89468',
  hair: 'rgba(168,148,104,0.28)',
};

// Köşe yarıçapı
export const R = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, pill: 999 };

// Boşluk (4-pt tabanlı ritim)
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 };

// Katmanlı yumuşak gölgeler (premium = büyük yarıçap, düşük opaklık)
export const SHADOW = {
  card: { shadowColor: '#16202e', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  soft: { shadowColor: '#16202e', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  header: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  gold: { shadowColor: '#a8842f', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
};

// Tipografi — serif YALNIZ sabit Latin başlıklarda (Playfair); dinamik isimler güvenli sans.
export const FONT = { serif: 'PlayfairDisplay_700Bold' };
export const TYPE = {
  display: { fontSize: 27, fontWeight: '800', color: C.ink, letterSpacing: 0.2 },
  h1: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: 0.2 },
  h2: { fontSize: 18, fontWeight: '800', color: C.ink },
  body: { fontSize: 15, fontWeight: '500', color: C.ink },
  label: { fontSize: 13, fontWeight: '700', color: C.ink2 },
  kicker: { fontSize: 11.5, fontWeight: '800', color: C.goldText, letterSpacing: 1.4, textTransform: 'uppercase' },
  caption: { fontSize: 12, fontWeight: '600', color: C.muted },
};
