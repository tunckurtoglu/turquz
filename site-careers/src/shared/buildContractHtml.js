// cv/buildContractHtml.js
// Belirli Süreli İş Sözleşmesi (TR/EN) + Konsolosluk başvuru yazısı — PDF'in birebir HTML'i.
// Alanlar veriye bağlı; imza/kaşe boş bırakılır.
//
// data     : adayın CV verisi (firstName, lastName, family, birthDate, nationality, location, passportNo, birthPlace)
// contract : acentenin doldurduğu alanlar:
//   { title, address, phone, email,            // A) İŞVEREN
//     contactPhone, contactEmail,              // B) tablodaki yazışma iletişimi (acente)
//     position, salary,                        // md.3 / md.6
//     consulate,                               // konsolosluk/büyükelçilik adı
//     issueDate }                              // tanzim tarihi (teklif günü, "dd/mm/yyyy")

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const val = (v) => (v && String(v).trim() ? esc(v) : '&nbsp;');

// opts.signature: işveren (acente/otel) e-imzası -> { image (PNG data URI), name, subtitle, auditLine }
// Verilirse işveren imza alanlarına görsel + e-imza denetim satırı basılır; aday kutusu boş kalır.
export function buildContractHtml(data = {}, contract = {}, opts = {}) {
  const sig = opts.signature || null;
  const screen = opts.screen !== false; // false -> PDF (web html2pdf) için ekran stillerini atla
  const employerArea = sig
    ? `<div class="area filled"><img class="sigimg" src="${sig.image}" alt="" /></div>
       <div class="esign">✓ ${esc(sig.name || '')}${sig.subtitle ? ' · ' + esc(sig.subtitle) : ''}</div>
       <div class="esignmeta">${esc(sig.auditLine || '')}</div>`
    : `<div class="area"></div>`;
  const fam = data.family || {};
  const father = fam.father || {};
  const mother = fam.mother || {};

  const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  const fatherName = `${father.name || ''} ${father.lastName || ''}`.trim();
  const motherName = `${mother.name || ''} ${mother.lastName || ''}`.trim();
  const birthLine = [data.birthPlace, data.birthDate].filter(Boolean).join(' / ');

  const c = contract || {};

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  /* PDF kenar boşluğu: YAN boşluklar body padding ile (expo-print @page yatay margin'i
     güvenilir uygulamıyor -> yazılar taşıyordu). ÜST/ALT @page ile (her sayfada). */
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #111; font-size: 9.5pt; line-height: 1.18; margin: 0; padding: 12mm 12mm; }
  /* Önizleme (ekran): PDF'ten BAĞIMSIZ — daha büyük, okunaklı font + ferah kenar boşluğu.
     PDF çıktısı (@page + 9.5pt) etkilenmez. opts.screen=false ise (web PDF) bu blok atlanır. */
  ${screen ? `@media screen {
    html { background: #e9ebee; -webkit-text-size-adjust: 100%; }
    body {
      font-size: 13.5px; line-height: 1.55; color: #1b2533;
      padding: 18px 20px; max-width: 820px; margin: 14px auto; background: #fff;
      border-radius: 8px; box-shadow: 0 4px 18px rgba(0,0,0,0.10);
    }
    h1 { font-size: 18px; margin-bottom: 8px; }
    h1 .en { font-size: 14px; }
    .sec { margin-top: 18px; }
    p { margin: 8px 0; }
    table.party td { padding: 8px 10px; }
    .signbox .sub { font-size: 11.5px; }
    .signbox .esign { font-size: 11.5px; }
    .signbox .esignmeta { font-size: 10px; }
  }` : ''}
  .en { font-style: italic; color: #1a1a1a; }
  h1 { text-align: center; font-size: 12pt; margin: 0 0 4px; }
  h1 .en { font-size: 10.5pt; display: block; }
  p { margin: 6px 0; text-align: justify; }
  .num { font-weight: bold; }
  .sec { font-weight: bold; margin-top: 14px; }
  table.party { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
  table.party td { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
  table.party td.lbl { width: 32%; }
  table.party td.lbl .en { display: block; }
  .strong { font-weight: bold; }
  .page-break { page-break-before: always; padding-top: 12mm; }
  .signs { display: flex; gap: 24px; margin-top: 22px; }
  .signbox { flex: 1; text-align: center; }
  .signbox .head { font-weight: bold; }
  .signbox .sub { font-size: 9.5pt; }
  .signbox .area { height: 110px; border: 1px dashed #bbb; border-radius: 4px; margin-top: 8px; }
  .signbox .area.filled { border: 1px solid #cfcfcf; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 4px; }
  .signbox .area.filled .sigimg { max-width: 100%; max-height: 102px; object-fit: contain; }
  .signbox .esign { margin-top: 5px; font-size: 8.5pt; font-weight: bold; color: #1a5c2a; }
  .signbox .esignmeta { font-size: 7pt; color: #555; line-height: 1.2; margin-top: 2px; word-break: break-word; }
  .datecenter { text-align: center; margin-top: 18px; text-decoration: underline; }
  /* Konsolosluk yazısı */
  .letter .date { text-align: right; font-weight: bold; }
  .letter .to { text-align: center; margin: 26px 0; font-weight: bold; line-height: 1.7; }
  .letter .info { margin-top: 30px; }
  .letter .info .row { margin: 4px 0; }
  .letter .info .k { display: inline-block; min-width: 230px; font-weight: bold; }
</style></head>
<body>

<!-- ===================== SAYFA 1-2: İŞ SÖZLEŞMESİ ===================== -->
<h1>BELİRLİ SÜRELİ İŞ SÖZLEŞMESİ<span class="en">FIXED-TERM EMPLOYMENT CONTRACT</span></h1>

<p>Aşağıda isim ve adresleri yazılı bulunan işveren ile işçi (yabancı şahıs) arasında, tamamen kendi istek ve serbest iradeleri ile aşağıda belirtilen şartlarla işbu "BELİRLİ SÜRELİ İŞ SÖZLEŞMESİ" yapılmıştır. Taraflar bundan sonra "işveren" ve "işçi" olarak anılacaktır.</p>
<p class="en">This "FIXED-TERM EMPLOYMENT CONTRACT" has been made between the employer and the employee (foreign person), whose names and addresses are written below, entirely of their own free will and with the conditions stated below. The parties will hereinafter be referred to as "employer" and "employee".</p>

<div class="sec">1. TARAFLAR / <span class="en">PARTIES</span></div>

<div class="sec">A) İŞVERENİN / <span class="en">EMPLOYER'S</span></div>
<table class="party">
  <tr><td class="lbl">Unvanı<span class="en">Title</span></td><td>: ${val(c.title)}</td></tr>
  <tr><td class="lbl">İşyeri Adresi<span class="en">Work Address</span></td><td>: ${val(c.address)}</td></tr>
  <tr><td class="lbl">Telefon no. ve E-posta Adresi<span class="en">Phone no. and E-mail</span></td><td>: ${val(c.phone)}<br/>${val(c.email)}</td></tr>
</table>

<div class="sec">B) İŞÇİNİN (YABANCI ŞAHSIN) / <span class="en">EMPLOYEE'S (FOREIGN PERSON'S)</span></div>
<table class="party">
  <tr><td class="lbl">Adı Soyadı<span class="en">Name Surname</span></td><td>: ${val(fullName)}</td></tr>
  <tr><td class="lbl">Baba Adı<span class="en">Father's Name</span></td><td>: ${val(fatherName)}</td></tr>
  <tr><td class="lbl">Doğum Yeri ve Tarihi<span class="en">Place and Date of Birth</span></td><td>: ${val(birthLine)}</td></tr>
  <tr><td class="lbl">Uyruğu<span class="en">Nationality</span></td><td>: ${val(data.nationality)}</td></tr>
  <tr><td class="lbl">Pasaport no.<span class="en">Passport no.</span></td><td>: ${val(data.passportNo)}</td></tr>
  <tr><td class="lbl">Yurtdışı İkamet Adresi<span class="en">Abroad Residence Address</span></td><td>: ${val(data.location)}</td></tr>
  <tr><td class="lbl">Telefon no. ve E-posta Adresi<span class="en">Phone no. and E-mail Address</span></td><td>: ${val(c.contactPhone)}<br/>${val(c.contactEmail)}</td></tr>
</table>

<p><span class="num">2.</span> İŞÇİNİN ÇALIŞMA YERİ: Çalışma izni başvurusu esnasında işveren tarafından Çalışma ve Sosyal Güvenlik Bakanlığına beyan edilen işyeri adresidir. Yabancı şahıs bu işyeri adresi dışında çalışamaz/çalıştırılamaz.</p>
<p class="en">EMPLOYEE'S PLACE OF WORK: It is the workplace address declared by the employer to the Ministry of Labour and Social Security during the work permit application. The foreign person cannot work / be employed outside of this workplace address.</p>

<p><span class="num">3.</span> YAPILACAK İŞ VEYA GÖREV: <span class="strong">${val(c.position)}</span></p>
<p class="en">JOB OR DUTY TO BE DONE: <span class="strong">${val(c.position)}</span></p>

<p><span class="num">4.</span> SÖZLEŞMENİN SÜRESİ: İşbu iş sözleşmesi Çalışma ve Sosyal Güvenlik Bakanlığından çalışma izni alınması halinde, çalışma izin belgesinde belirtilen tarihten itibaren 1(BİR) YIL sürelidir. Sözleşme, bitim tarihinde herhangi bir bildirim yapmaksızın kendiliğinden sona erer. İşçinin iş sözleşmesi sonunda da bu işyerinde çalışacak olması halinde iş sözleşmesinin yenilenerek Çalışma ve Sosyal Güvenlik Bakanlığına çalışma izni süre uzatım başvurusu yapılması ve izin alınması zorunludur.</p>
<p class="en">DURATION OF THE CONTRACT: This employment contract is for 1 year, starting from the date specified in the work permit, in case the work permit is obtained from the Ministry of Labour and Social Security. The contract is terminated automatically on the expiry date without any notice. In the event that the employee will continue to work in this workplace after the end of the employment contract, it is obligatory to renew the employment contract and apply for a work permit extension to the Ministry of Labour and Social Security and obtain work permit.</p>

<p><span class="num">5.</span> İŞE BAŞLAMA TARİHİ: Çalışma izni belgesinde belirtilen başlangıç tarihidir.</p>
<p class="en">STARTING DATE OF EMPLOYMENT: It is the starting date specified in the work permit document.</p>

<p><span class="num">6.</span> ÜCRET: İşçinin aylık BRÜT ücreti <span class="strong">${val(c.salary)} TL</span>'dir. İşçinin ücreti imza karşılığında kendisine ödenir.</p>
<p class="en">SALARY: The monthly GROSS salary of the employee is <span class="strong">${val(c.salary)} TRY</span>. It is paid to him/her upon the signature.</p>

<p><span class="num">7.</span> İşçinin ve işverenin hak ve ödevleri ile işbu sözleşmede yer almayan hususlarda 6735 sayılı Uluslararası İşgücü Kanunu, yürürlükteki İş Kanunu ve diğer ilgili mevzuat hükümleri uygulanır.</p>
<p class="en">Regarding the rights and obligations of the employee and the employer as well as the matters not included in this contract, the provisions of the International Labour Force Law numbered 6735, the Labour Law in force and other relevant legislation shall apply.</p>

<p><span class="num">8.</span> 6735 sayılı Kanunun 23/9. maddesi uyarınca; İşveren veya işveren vekili, çalışma izni bulunmayan yabancının ve varsa eş ve çocuklarının konaklama giderlerini, ülkelerine dönmeleri için gerekli masrafları ve gerektiğinde sağlık harcamalarını karşılamak zorundadır.</p>
<p class="en">According to the Article 23/9 of the Law numbered 6735, the employer or employer's representative is obliged to cover the accommodation expenses of the foreigner who does not have a work permit and, if any, his/her spouse and children, the expenses necessary for their return to their country and, if necessary, health expenses.</p>

<p><span class="num">9.</span> Çalışma izni geçerli olduğu süre zarfında (Geçici Koruma Altındakiler ve Uluslararası Koruma Başvuru Sahipleri hariç) ikamet izni yerine de geçer. İşveren yabancı şahsın sosyal güvenlik yükümlülüklerinin yerine getirilmesinden sorumludur.</p>
<p class="en">During the validity period of the work permit (Except for those Under Temporary Protection and International Protection applicants), it also stands for the residence permit. The employer is responsible for fulfilling the social security obligations of the foreign person.</p>

<p><span class="num">10.</span> İşbu belirli süreli iş sözleşmesi taraflarca okunarak 2 nüsha olarak imzalanmış olup, işveren işçiye iş ve ücret vermeyi, işçi de belirtilen şartlarla iş görmeyi karşılıklı olarak kabul, beyan ve taahhüt etmişlerdir.</p>
<p class="en">This fixed-term employment contract has been read and signed by the parties as 2 copies, and it has mutually been accepted, declared and committed that the employer gives work and salary to the employee and the employee works under the specified conditions.</p>

<div class="datecenter">Tanzim tarihi / <span class="en">Issue date:</span> ${val(c.issueDate)}</div>

<div class="signs">
  <div class="signbox">
    <div class="head">İŞVEREN / <span class="en">EMPLOYER</span></div>
    <div class="sub">Ad Soyad – Kaşe – İmza / <span class="en">Name Surname – Stamp – Signature</span></div>
    ${employerArea}
  </div>
  <div class="signbox">
    <div class="head">YABANCI İŞÇİ / <span class="en">FOREIGN EMPLOYEE</span></div>
    <div class="sub">Ad Soyad – İmza / <span class="en">Name Surname – Signature</span></div>
    <div class="area"></div>
  </div>
</div>

<!-- ===================== SAYFA 3: KONSOLOSLUK BAŞVURU YAZISI ===================== -->
<div class="page-break letter">
  <div class="date">${val(c.issueDate)}</div>
  <div class="to">T.C<br/>DIŞ İŞLERİ BAKANLIĞI<br/>${val(c.consulate)}<br/>BÜYÜKELÇİLİĞİ'NE</div>

  <p>${val(c.address)} adresinde bulunan işyerime aşağıda adı yazılı ${val(data.nationality)} uyruklu vatandaşa süreli çalışma izni almak istiyoruz.</p>
  <p class="en">We would like to obtain a temporary work permit for the ${val(data.nationality)} national whose name is written below, for my workplace located at ${val(c.address)}.</p>

  <p>Aşağıda adı geçen ${val(data.nationality)} vatandaşının müracaatlarının kabul edilmesi hususunu takdirlerinize sunar; gereğini bilgilerinize arz ederiz.</p>
  <p class="en">We hereby submit to your discretion the acceptance of the applications of the ${val(data.nationality)} citizens mentioned below; we would like to inform you what is necessary.</p>

  <p>Saygılarımızla,<br/><span class="en">Best Regards</span></p>

  <div class="signbox" style="max-width:280px;margin-top:6px;">
    <div class="sub">Kaşe / İmza – <span class="en">Stamp / Signature</span></div>
    ${employerArea}
  </div>

  <div class="info">
    <div class="row"><span class="k">İsim Soyisim / <span class="en">Name Surname</span></span>: ${val(fullName)}</div>
    <div class="row"><span class="k">Doğum Tarihi / <span class="en">Date of Birth</span></span>: ${val(data.birthDate)}</div>
    <div class="row"><span class="k">Baba Adı / <span class="en">Father's Name</span></span>: ${val(fatherName)}</div>
    <div class="row"><span class="k">Ana Adı / <span class="en">Mother's Name</span></span>: ${val(motherName)}</div>
    <div class="row"><span class="k">Pasaport No / <span class="en">Passport Number</span></span>: ${val(data.passportNo)}</div>
  </div>
</div>

</body></html>`;
}
