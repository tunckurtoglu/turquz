import html2pdf from 'html2pdf.js';
import { buildCertificateHtml } from '../../../cv/buildCertificateHtml';
import { withLatinName } from '../../../lib/translit';
import { candidateCode } from '../../../lib/candidateCode';

export function completedEpisodeFromDetail(detail) {
  if (!detail) return null;
  const eps = Array.isArray(detail.episodes) ? detail.episodes : [];
  const hit = eps.find((e) => e.outcome === 'completed');
  if (hit) return hit;
  if (detail.episode?.outcome === 'completed') return detail.episode;
  return null;
}

export function buildSuccessCertificateHtml(detail, episode = null) {
  const ep = episode || completedEpisodeFromDetail(detail);
  if (!ep || !detail) throw new Error('completed_episode_required');
  const cv = withLatinName(detail.data || {});
  const code = candidateCode(detail.nationality || cv.nationality, detail.reg_no);
  return buildCertificateHtml({
    firstName: cv.firstName,
    lastName: cv.lastName,
    candidateNo: code,
    employerTitle: ep.employer_title || ep.employer_name,
    position: ep.position,
    startAt: ep.work_start_at || ep.hired_at,
    endAt: ep.ended_at,
    issuedAt: ep.ended_at,
  });
}

export async function certificatePdfBlobFromHtml(html) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1120px;background:#fff;';
  document.body.appendChild(host);
  host.innerHTML = html;
  const page = host.querySelector('.page') || host;
  try {
    return await html2pdf().set({
      margin: 0,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    }).from(page).outputPdf('blob');
  } finally {
    document.body.removeChild(host);
  }
}

export async function certificatePdfBlobFromDetail(detail) {
  const html = buildSuccessCertificateHtml(detail);
  return certificatePdfBlobFromHtml(html);
}
