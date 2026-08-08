// cv/buildFlightHtml.js
// "Uçuş Bilgileri" PDF'i (TR/EN) — Turquz markalı, lacivert başlık + logo + uçak ikonu.
// NOT: Şu an devre dışı (lib/features.js → FLIGHT_INFO_CARD_ENABLED). Dosya silinmedi; tekrar açılabilir.
// data   : adayın CV verisi (firstName, lastName, passportNo, nationality)
// flight : acentenin doldurduğu uçuş alanları
//   { fromCity, fromAirport, toCity, toAirport, departAt, arriveAt, flightNo, airline }
import { LOGO_DATA_URI } from './logoAsset';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const val = (v) => (v && String(v).trim() ? esc(v) : '—');

export function buildFlightHtml(data = {}, flight = {}) {
  const f = flight || {};
  const passenger = `${data.firstName || ''} ${data.lastName || ''}`.trim();

  // Uçak ikonu (gold) — yatay uçak
  const planeSvg = `<svg viewBox="0 0 24 24" width="34" height="34" fill="none">
    <path d="M2 12h20M14.5 8.5L21 12l-6.5 3.5M3 9l2 3-2 3" stroke="#c2a25a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3.5 12l5.5-.0M11 12l3 .0" stroke="#c2a25a" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;

  // Üst başlıktaki küçük uçak amblemi
  const planeBadge = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" fill="#c2a25a"/>
  </svg>`;

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1b2533; margin: 0; background: #fff; }
  @media screen { html { background: #e9ebee; } body { max-width: 820px; margin: 0 auto; box-shadow: 0 0 18px rgba(0,0,0,0.12); } }

  .header { background: #1b2533; padding: 26px 34px 22px; text-align: center; position: relative; }
  .header img.logo { height: 82px; width: auto; display: block; margin: 0 auto 6px; }
  .header .titleRow { display: flex; align-items: center; justify-content: center; gap: 9px; margin-top: 6px; }
  .header h1 { color: #c2a25a; font-size: 19pt; letter-spacing: 3px; margin: 0; font-weight: 800; }
  .header .sub { color: #9aa4b1; font-size: 9.5pt; letter-spacing: 4px; margin-top: 3px; text-transform: uppercase; }
  .accent { height: 4px; background: #c2a25a; }

  .body { padding: 30px 38px 40px; }

  .pax { display: flex; justify-content: space-between; gap: 16px; border: 1px solid #e6e8ec; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; background: #faf9f6; }
  .pax .item .k { font-size: 8.5pt; color: #9aa1ac; text-transform: uppercase; letter-spacing: 1px; }
  .pax .item .v { font-size: 12.5pt; font-weight: 800; color: #1b2533; margin-top: 2px; }

  .route { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid #e6e8ec; border-radius: 16px; padding: 26px 22px; margin-bottom: 24px; }
  .route .end { flex: 1; text-align: center; }
  .route .end .city { font-size: 18pt; font-weight: 800; color: #1b2533; }
  .route .end .air { font-size: 10pt; color: #6b7280; margin-top: 4px; }
  .route .end .tag { font-size: 8pt; color: #2a9db8; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
  .route .mid { flex: 0 0 auto; text-align: center; padding: 0 6px; }
  .route .mid .line { height: 1px; background: #d6c79a; width: 90px; margin: 6px auto 0; position: relative; }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .cell { border: 1px solid #e6e8ec; border-radius: 12px; padding: 14px 16px; }
  .cell .k { font-size: 8.5pt; color: #9aa1ac; text-transform: uppercase; letter-spacing: 1px; }
  .cell .k .en { color: #b9c0c9; font-style: italic; }
  .cell .v { font-size: 13pt; font-weight: 800; color: #1b2533; margin-top: 4px; }

  .foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid #eef0f2; text-align: center; color: #9aa1ac; font-size: 8.5pt; letter-spacing: 0.5px; }
</style></head>
<body>
  <div class="header">
    <img class="logo" src="${LOGO_DATA_URI}" alt="Turquz" />
    <div class="titleRow">${planeBadge}<h1>UÇUŞ BİLGİLERİ</h1></div>
    <div class="sub">Flight Information</div>
  </div>
  <div class="accent"></div>

  <div class="body">
    <div class="pax">
      <div class="item"><div class="k">Yolcu / Passenger</div><div class="v">${val(passenger)}</div></div>
      <div class="item"><div class="k">Pasaport / Passport</div><div class="v">${val(data.passportNo)}</div></div>
      <div class="item"><div class="k">Uyruk / Nationality</div><div class="v">${val(data.nationality)}</div></div>
    </div>

    <div class="route">
      <div class="end">
        <div class="tag">Kalkış / From</div>
        <div class="city">${val(f.fromCity)}</div>
        <div class="air">${val(f.fromAirport)}</div>
      </div>
      <div class="mid">
        ${planeSvg}
        <div class="line"></div>
      </div>
      <div class="end">
        <div class="tag">Varış / To</div>
        <div class="city">${val(f.toCity)}</div>
        <div class="air">${val(f.toAirport)}</div>
      </div>
    </div>

    <div class="grid">
      <div class="cell"><div class="k">Kalkış Zamanı <span class="en">/ Departure</span></div><div class="v">${val(f.departAt)}</div></div>
      <div class="cell"><div class="k">Varış Zamanı <span class="en">/ Arrival</span></div><div class="v">${val(f.arriveAt)}</div></div>
      <div class="cell"><div class="k">Uçuş No <span class="en">/ Flight No</span></div><div class="v">${val(f.flightNo)}</div></div>
      <div class="cell"><div class="k">Terminal <span class="en">/ Terminal</span></div><div class="v">${val(f.terminal)}</div></div>
      <div class="cell" style="grid-column: 1 / -1;"><div class="k">Havayolu <span class="en">/ Airline</span></div><div class="v">${val(f.airline)}</div></div>
    </div>

    <div class="foot">TURQUZ · Sınırların Ötesinde Başlangıçlar — Beginnings Beyond Borders</div>
  </div>
</body></html>`;
}
