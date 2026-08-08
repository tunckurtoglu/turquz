// cv/buildArrivalsHtml.js
// Karşılama / varış raporu (A4 yatay tablo). Acentenin havaalanı karşılaması için.
// Saf fonksiyon (import yok); web yazdır/PDF ve mobil paylaşımda kullanılabilir.
// rows: [{ no, code, name, nationality, arrival, terminal, date, time, flightNo, airline }]

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function buildArrivalsHtml(rows = [], opts = {}) {
  const title = opts.title || 'Karşılama / Varış Raporu';
  const subtitle = opts.subtitle || '';
  const generated = opts.generatedAt || '';
  const screen = opts.screen !== false;

  const body = rows.length
    ? rows.map((r, i) => `
      <tr>
        <td class="c">${esc(r.no ?? i + 1)}</td>
        <td class="b">${esc(r.code)}</td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.nationality)}</td>
        <td>${esc(r.arrival)}${r.terminal ? ` <span class="muted">/ ${esc(r.terminal)}</span>` : ''}</td>
        <td class="c b">${esc(r.date)}</td>
        <td class="c b">${esc(r.time)}</td>
        <td class="c">${esc(r.flightNo)}</td>
        <td>${esc(r.airline)}</td>
      </tr>`).join('')
    : `<tr><td colspan="9" class="empty">Bu aralıkta varış kaydı yok.</td></tr>`;

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #16202e; margin: 0; padding: 0; }
  .head { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 3px solid #c2a25a; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: .5px; }
  .brand .g { color: #c2a25a; }
  h1 { font-size: 16px; margin: 0; font-weight: 800; }
  .sub { font-size: 11px; color: #5a6473; margin-top: 3px; }
  .gen { font-size: 10.5px; color: #8a93a1; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #16202e; color: #fff; text-align: left; padding: 8px 9px; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; }
  tbody td { padding: 8px 9px; border-bottom: 1px solid #e6e8ec; }
  tbody tr:nth-child(even) td { background: #faf8f2; }
  td.c { text-align: center; }
  td.b { font-weight: 800; }
  .muted { color: #8a93a1; }
  .empty { text-align: center; color: #8a93a1; padding: 30px; }
  .foot { margin-top: 16px; font-size: 10px; color: #8a93a1; display: flex; justify-content: space-between; }
  ${screen ? `@media screen { body { background: #e9ebee; padding: 20px; } .sheet { background: #fff; max-width: 1180px; margin: 0 auto; padding: 22px; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.12); } }` : ''}
</style></head>
<body><div class="sheet">
  <div class="head">
    <div>
      <div class="brand">TURQU<span class="g">Z</span></div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
    </div>
    <div class="gen">${generated ? `Oluşturma: ${esc(generated)}<br/>` : ''}Toplam: ${rows.length} kişi</div>
  </div>
  <table>
    <thead><tr>
      <th>#</th><th>Kod</th><th>Ad Soyad</th><th>Uyruk</th><th>Varış Havalimanı</th><th>Tarih</th><th>Saat</th><th>Uçuş No</th><th>Havayolu</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="foot"><span>Turquz — Karşılama Planı</span><span>Bu belge bilgilendirme amaçlıdır.</span></div>
</div></body></html>`;
}
