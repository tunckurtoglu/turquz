#!/usr/bin/env node
/** Gerçek buildCertificateHtml + edge function e-posta metnini önizleme HTML'ine yazar. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCertificateHtml } from '../cv/buildCertificateHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../docs/previews');
fs.mkdirSync(outDir, { recursive: true });

const sample = {
  firstName: 'Ayse',
  lastName: 'Yilmaz',
  candidateNo: 'TR-0042',
  employerTitle: 'Grand Azure Hotel & Spa',
  position: 'Waitress',
  startAt: '2025-06-01',
  endAt: '2025-09-30',
  issuedAt: '2025-09-30',
};

const candidateName = `${sample.firstName} ${sample.lastName}`;
const certHtml = buildCertificateHtml(sample);

const emailBodyHtml = `<p>Dear ${candidateName},</p>
<p>Congratulations on successfully completing your season with Turquz.</p>
<p>Your personalized Turquz Success Certificate is attached to this email.</p>
<p>You can also download it anytime from the Documents section in the Turquz app.</p>
<p>Best regards,<br/>Turquz Team</p>`;

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Turquz — Certificate delivery preview (from code)</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f0f2f5;
    color: #202124;
    padding: 24px 16px 48px;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1.page-title {
    font-size: 15px;
    font-weight: 600;
    color: #5f6368;
    margin: 0 0 16px;
    letter-spacing: 0.2px;
  }
  .inbox {
    background: #fff;
    border: 1px solid #dadce0;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 28px;
  }
  .inbox-toolbar {
    background: #f8f9fa;
    border-bottom: 1px solid #e8eaed;
    padding: 10px 16px;
    font-size: 13px;
    color: #5f6368;
  }
  .inbox-head {
    padding: 20px 24px 12px;
    border-bottom: 1px solid #f1f3f4;
  }
  .subject {
    font-size: 22px;
    font-weight: 400;
    margin: 0 0 14px;
    color: #202124;
  }
  .meta { display: flex; gap: 12px; align-items: flex-start; }
  .avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #c2a25a, #8a7340);
    color: #fff; font-weight: 700; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .meta-text { font-size: 13px; line-height: 1.45; }
  .from { font-weight: 600; color: #202124; }
  .to { color: #5f6368; }
  .inbox-body {
    padding: 8px 24px 20px 76px;
    font-size: 14px;
    line-height: 1.6;
    color: #3c4043;
  }
  .inbox-body p { margin: 0 0 14px; }
  .attachment {
    margin: 8px 24px 24px 76px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: 1px solid #dadce0;
    border-radius: 8px;
    background: #f8f9fa;
    font-size: 13px;
    color: #202124;
  }
  .attachment .icon {
    width: 32px; height: 32px; border-radius: 4px;
    background: #d93025; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 700;
  }
  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: #5f6368;
    margin: 0 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .cert-frame {
    border: 1px solid #dadce0;
    border-radius: 8px;
    overflow: hidden;
    background: #e9ebee;
  }
  .cert-frame iframe {
    display: block;
    width: 100%;
    height: 640px;
    border: 0;
  }
  @media (min-width: 900px) {
    .cert-frame iframe { height: 720px; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <h1 class="page-title">Önizleme — kodun ürettiği gerçek çıktı (örnek aday: ${candidateName})</h1>

    <div class="section-label">1 · Gelen e-posta (admin-issue-certificate/index.ts)</div>
    <div class="inbox">
      <div class="inbox-toolbar">Gmail · Gelen Kutusu</div>
      <div class="inbox-head">
        <h2 class="subject">Your Turquz Success Certificate</h2>
        <div class="meta">
          <div class="avatar">T</div>
          <div class="meta-text">
            <div class="from">Turquz &lt;certificates@turquz.com&gt;</div>
            <div class="to">Kime: ayse.yilmaz@example.com</div>
          </div>
        </div>
      </div>
      <div class="inbox-body">${emailBodyHtml}</div>
      <div class="attachment">
        <div class="icon">PDF</div>
        <div>
          <div><strong>Turquz-Success-Certificate.pdf</strong></div>
          <div style="color:#5f6368;font-size:12px;">application/pdf · ek</div>
        </div>
      </div>
    </div>

    <div class="section-label">2 · Ekteki PDF (cv/buildCertificateHtml.js → html2pdf)</div>
    <div class="cert-frame">
      <iframe title="Certificate" src="certificate-sample.html"></iframe>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'certificate-sample.html'), certHtml);
fs.writeFileSync(path.join(outDir, 'certificate-delivery-preview.html'), page);
console.log('Wrote:', path.join(outDir, 'certificate-delivery-preview.html'));
