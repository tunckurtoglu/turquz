// cv/buildCertificateHtml.js
// Turquz Success Certificate — fixed English worldwide (not localized).
// payload: { firstName, lastName, candidateNo, employerTitle, position, startAt, endAt, issuedAt? }
import { LOGO_DATA_URI } from './logoAsset';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const val = (v) => (v && String(v).trim() ? esc(v) : '—');

function fmtDate(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function buildCertificateHtml(payload = {}) {
  const p = payload || {};
  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
  const start = fmtDate(p.startAt);
  const end = fmtDate(p.endAt);
  const period = start && end ? `${start} — ${end}` : start || end || '—';
  const issued = fmtDate(p.issuedAt || p.endAt || new Date());

  // Gold-tint the brand logo for certificate chrome (header + seal).
  const logoGold = `filter: brightness(0) saturate(100%) invert(72%) sepia(28%) saturate(650%) hue-rotate(5deg) brightness(95%);`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Turquz Success Certificate</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1b2533;
    font-family: Georgia, 'Times New Roman', Times, serif;
    background: #fff;
  }
  @media screen {
    html { background: #e9ebee; }
    body { max-width: 1120px; margin: 18px auto; box-shadow: 0 0 18px rgba(0,0,0,0.12); }
  }

  .page {
    position: relative;
    min-height: 100vh;
    padding: 28px 36px 32px;
    background:
      linear-gradient(#fff, #fff) padding-box,
      linear-gradient(135deg, #e8d9a8, #c2a25a 40%, #8a7340 70%, #c2a25a) border-box;
    border: 10px solid transparent;
    border-image: none;
  }
  .page::before {
    content: '';
    position: absolute;
    inset: 14px;
    border: 1.5px solid #c2a25a;
    pointer-events: none;
  }

  .header { text-align: center; padding-top: 8px; }
  .header img.logo {
    height: 78px;
    width: auto;
    display: block;
    margin: 0 auto 4px;
    ${logoGold}
  }

  .title {
    margin: 18px 0 4px;
    text-align: center;
    font-size: 28pt;
    font-weight: 700;
    letter-spacing: 1px;
    color: #1b2533;
  }
  .subtitle {
    text-align: center;
    color: #c2a25a;
    font-size: 11pt;
    letter-spacing: 4px;
    text-transform: uppercase;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    margin-bottom: 18px;
  }

  .blurb {
    max-width: 780px;
    margin: 0 auto 22px;
    text-align: center;
    font-size: 11.5pt;
    line-height: 1.55;
    color: #3a4553;
  }

  .rule {
    width: 160px;
    height: 2px;
    background: #c2a25a;
    margin: 0 auto 26px;
  }

  .fields {
    max-width: 720px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 12px 18px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  .fields .k {
    font-size: 8.5pt;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #9aa1ac;
    padding-top: 4px;
  }
  .fields .v {
    font-size: 14pt;
    font-weight: 800;
    color: #1b2533;
    border-bottom: 1px solid #e6e8ec;
    padding-bottom: 6px;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    max-width: 860px;
    margin: 42px auto 0;
    padding: 0 20px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }

  .seal {
    text-align: center;
    width: 120px;
  }
  .seal .ring {
    width: 92px;
    height: 92px;
    margin: 0 auto;
    border-radius: 50%;
    border: 3px solid #c2a25a;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 35% 30%, #fff8e8, #f3e6c0 55%, #e8d9a8);
    box-shadow: inset 0 0 0 1.5px rgba(194,162,90,0.45);
  }
  .seal .ring img {
    width: 58px;
    height: auto;
    ${logoGold}
  }
  .seal .tag {
    margin-top: 8px;
    font-size: 8pt;
    letter-spacing: 2px;
    color: #c2a25a;
    font-weight: 800;
    text-transform: uppercase;
  }

  .sig {
    text-align: center;
    min-width: 220px;
  }
  .sig .date {
    font-size: 9pt;
    color: #9aa1ac;
    letter-spacing: 0.5px;
    margin-bottom: 28px;
  }
  .sig .line {
    width: 200px;
    border-top: 1px solid #1b2533;
    margin: 0 auto 8px;
  }
  .sig .label {
    font-size: 8pt;
    color: #9aa1ac;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .sig .name {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 14pt;
    font-weight: 700;
    color: #1b2533;
  }
</style></head>
<body>
  <div class="page">
    <div class="header">
      <img class="logo" src="${LOGO_DATA_URI}" alt="Turquz" />
    </div>

    <h1 class="title">Success Certificate</h1>
    <div class="subtitle">Certificate of Achievement</div>

    <p class="blurb">
      This document certifies that the candidate named below has successfully completed
      a full term of employment with an employer through Turquz.
    </p>
    <div class="rule"></div>

    <div class="fields">
      <div class="k">Candidate</div><div class="v">${val(name)}</div>
      <div class="k">Candidate No</div><div class="v">${val(p.candidateNo)}</div>
      <div class="k">Employer</div><div class="v">${val(p.employerTitle)}</div>
      <div class="k">Position</div><div class="v">${val(p.position)}</div>
      <div class="k">Period</div><div class="v">${val(period)}</div>
    </div>

    <div class="footer">
      <div class="seal">
        <div class="ring"><img src="${LOGO_DATA_URI}" alt="" /></div>
        <div class="tag">Verified</div>
      </div>
      <div class="sig">
        <div class="date">Issued ${esc(issued)}</div>
        <div class="label">Signature</div>
        <div class="line"></div>
        <div class="name">Doğan Altun</div>
      </div>
    </div>
  </div>
</body></html>`;
}
