import { useEffect, useMemo, useRef, useState } from 'react';
import { offerCandidate, withdrawCandidate, endEmployment, categoryOf, buildCvPdfServer, translateCvFields, applyCvTranslation, notifyOffer, extractCvFields, hasCvFreeText, getContract, getCandidateEmploymentEpisode, undoEmploymentEnd, contestEmploymentEnd, acceptEmploymentEnd, getCandidateStatus, listCandidateWorkHistory, confirmHire, deferWorkStart } from '../lib/api';
import { useLang } from '../i18n.jsx';
import { candidateCode, maskCandidate } from '../../../lib/candidateCode';
import { buildCvHtml } from '../../../cv/buildCvHtml';
import { Icon } from '../components/Icon.jsx';
import Documents from './Documents.jsx';
import InterviewPanel from './InterviewPanel.jsx';
import ProcessChat from './ProcessChat.jsx';
import CvOverrideEditor from '../components/CvOverrideEditor.jsx';
import { loadOverride, saveOverride, clearOverride, normalizePoolCvData, applyCvOverrides } from '../lib/cvOverride.js';
import RateCandidateModal from '../components/RateCandidateModal.jsx';
import FavoriteEmployerModal from '../components/FavoriteEmployerModal.jsx';
import { canRateCandidate, getMyRating, listRatingStats } from '../lib/ratings';
import { listFavoriteMap } from '../lib/favorites';
import { formatDeadlineRemain } from '../lib/deadline';

const BADGE = { offered: 'navy', process: 'green', hired: 'teal', transit: 'navy' };
const BADGE_TXT = { offered: 'Teklifli', process: 'Süreçte', hired: 'Personel', transit: 'Yolda' };

export default function Candidate({ sel, onBack, agencyUserId }) {
  const { lang, t } = useLang();
  const c = sel.c;
  const baseData = normalizePoolCvData(c);
  const code = candidateCode(c.nationality, c.reg_no);
  const [chatOpen, setChatOpen] = useState(!!sel?.st?._openChat);
  const [contractPaid, setContractPaid] = useState(false);
  const [contractPayStatus, setContractPayStatus] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [workHistory, setWorkHistory] = useState([]);
  const [st, setSt] = useState(sel.st);
  const [nowTick, setNowTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('cv');
  const [zoomIdx, setZoomIdx] = useState(null); // büyütülen fotoğraf indeksi
  const [zoomScale, setZoomScale] = useState(1);
  const zoomScaleRef = useRef(1);
  const swipeX = useRef(null);
  zoomScaleRef.current = zoomScale;
  const [cvZoom, setCvZoom] = useState(0.58); // CV önizleme yakınlaştırma
  const [pdfBusy, setPdfBusy] = useState(false); // İndir: sunucuda PDF üretiliyor
  const [overrides, setOverrides] = useState({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [hasMyRating, setHasMyRating] = useState(false);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [favOpen, setFavOpen] = useState(false);
  const [favEmployerIds, setFavEmployerIds] = useState([]);
  const [hireBusy, setHireBusy] = useState(false);
  const saveTimer = useRef(null);

  // Adayın serbest CV metinlerini acentenin diline çevir (Gemini, DB önbellekli).
  const [cvTr, setCvTr] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => {
    let alive = true;
    setShowOriginal(false); setCvTr(null);
    const hasFree = hasCvFreeText(extractCvFields(baseData));
    if (!c.user_id || !hasFree) return undefined;
    translateCvFields(c.user_id, lang, baseData).then((tr) => { if (alive) setCvTr(tr); });
    return () => { alive = false; };
  }, [c.user_id, lang, baseData]);

  useEffect(() => {
    if (!st?.docs_deadline_at || st?.status !== 'accepted') return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [st?.docs_deadline_at, st?.status]);

  // Override'ları yükle (her yeni aday açılınca)
  useEffect(() => {
    setOverrides({});
    setEditorOpen(false);
    setChatOpen(!!sel?.st?._openChat);
    setRateOpen(false);
    setFavOpen(false);
    setContractPaid(false);
    setContractPayStatus(null);
    setCanRate(false);
    setHasMyRating(false);
    setRatingSummary(null);
    setFavEmployerIds([]);
    if (!agencyUserId || !c.user_id) return;
    loadOverride(agencyUserId, c.user_id).then(setOverrides);
    getContract(c.user_id).then((con) => {
      setContractPaid(!!con?.isPaid);
      setContractPayStatus(con?.paymentStatus || null);
    });
    getCandidateStatus(c.user_id).then((fresh) => {
      if (fresh) setSt((prev) => ({ ...(prev || {}), ...fresh }));
    });
    getCandidateEmploymentEpisode(c.user_id).then(setEpisode);
    listCandidateWorkHistory(c.user_id).then((h) => setWorkHistory((h || []).filter((x) => x.outcome === 'completed')));
    listFavoriteMap(agencyUserId).then((m) => setFavEmployerIds(m[c.user_id] || []));
    Promise.all([
      listRatingStats([c.user_id]),
      canRateCandidate(c.user_id),
      getMyRating(agencyUserId, c.user_id),
    ]).then(([stats, can, mine]) => {
      setRatingSummary(stats[c.user_id] || null);
      setCanRate(!!can);
      setHasMyRating(!!mine);
    });
  }, [c.user_id, agencyUserId, sel?.st?._openChat]);

  // Debounced kaydet (her override değişikliğinde 800ms bekle)
  const handleOverrideChange = (next) => {
    setOverrides(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveOverride(agencyUserId, c.user_id, next).catch((e) => console.warn('CV override:', e?.message));
    }, 800);
  };

  const handleClearOverride = async () => {
    setOverrides({});
    await clearOverride(agencyUserId, c.user_id);
  };

  const translatedData = (!showOriginal && cvTr) ? applyCvTranslation(baseData, cvTr) : baseData;
  // Acente düzenlemeleri en son uygulanır (en yüksek öncelik) — title dahil
  const data = applyCvOverrides(translatedData, overrides);
  const cat = categoryOf(st);

  // Yazdırma/PDF için kesin-2-sayfa CSS'i: her .page SABİT A4 (297mm) kutuya sarılır, taşması gizli;
  // 900px tasarım 0.882 ile A4'e ölçeklenir. Sayfa sayısı yalnız kutu sayısına bağlı -> her zaman 2 sayfa.
  // (zoom!important: buildCvHtml'in kendi @media print zoom kuralını ezer.)
  const PRINT_CSS = `@media print{
    @page{size:A4;margin:0;}
    html,body{margin:0;background:#fff;}
    .psheet{width:210mm;height:297mm;overflow:hidden;page-break-after:always;break-after:page;}
    .psheet:last-child{page-break-after:auto;break-after:auto;}
    .psheet>.page{zoom:1!important;transform:scale(0.882);transform-origin:top left;width:900px!important;height:1273px!important;min-height:0!important;overflow:hidden!important;margin:0!important;box-shadow:none!important;}
    .photos-page{page-break-before:auto!important;break-before:auto!important;}
  }`;

  // CV HTML'ini al, her üst düzey .page'i A4 kutusuna (.psheet) sar ve PRINT_CSS'i ekle -> yazdırılabilir HTML stringi.
  // Hem yerel yazdırma (iframe) hem sunucu PDF'i (cv-pdf, use_print) bunu kullanır; ikisi de aynı 2 sayfayı verir.
  const buildPrintableHtml = () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('body > .page').forEach((p) => {
      const s = doc.createElement('div');
      s.className = 'psheet';
      p.parentNode.insertBefore(s, p);
      s.appendChild(p);
    });
    const style = doc.createElement('style');
    style.textContent = PRINT_CSS;
    doc.head.appendChild(style);
    return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
  };

  // Yazdır: yazdırılabilir HTML'i gizli iframe'e basıp tarayıcının yazdırma penceresini aç (Safari + Chrome).
  const printCv = () => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open(); doc.write(buildPrintableHtml()); doc.close();
    const run = async () => {
      try { if (doc.fonts) await doc.fonts.ready; } catch {}
      await Promise.all([...doc.images].map((img) =>
        img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    };
    if (doc.readyState === 'complete') run(); else iframe.onload = run;
  };

  // İndir: PDF'i SUNUCUDA (cv-pdf -> gerçek Chromium) üret, dönen dosyayı diske kaydet. Her tarayıcıda tek tık.
  const downloadCv = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const blob = await buildCvPdfServer(buildPrintableHtml(), `Turquz-CV-${code}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Turquz-CV-${code}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { alert(e?.message || 'PDF üretilemedi'); }
    finally { setPdfBusy(false); }
  };

  const html = useMemo(() => buildCvHtml(maskCandidate(data, code), lang, { withLogo: true, masked: true }), [data, code, lang]);
  // title-only override değişiminde iframe kesin yenilensin
  const cvFrameKey = useMemo(
    () => `${lang}|${data?.title || ''}|${JSON.stringify(overrides)}`,
    [lang, data?.title, overrides],
  );
  const photos = [data.photoClose, data.photoFull, data.photo].filter(Boolean);
  const slidePhoto = (dir) => {
    if (zoomScaleRef.current > 1.08) return;
    setZoomIdx((i) => {
      if (i == null || !photos.length) return i;
      return (i + dir + photos.length) % photos.length;
    });
    setZoomScale(1);
  };
  useEffect(() => {
    if (zoomIdx === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { setZoomIdx(null); setZoomScale(1); return; }
      if (e.key === 'ArrowRight') slidePhoto(1);
      if (e.key === 'ArrowLeft') slidePhoto(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomIdx, photos.length]);

  const doOffer = async () => {
    setBusy(true); setMsg('');
    try { await offerCandidate(c.user_id); notifyOffer(c.user_id, 'offer'); setSt({ ...(st || {}), status: 'offered' }); setMsg('Teklif gönderildi.'); }
    catch (e) { setMsg(e?.message || 'Hata'); } finally { setBusy(false); }
  };
  const doWithdraw = async () => {
    if (!confirm('Teklif geri çekilecek; belgeler silinir ve aday havuza döner. Onaylıyor musunuz?')) return;
    setBusy(true); setMsg('');
    try { await withdrawCandidate(c.user_id); setSt({ ...(st || {}), status: 'new', docs_unlocked: false, hired_at: null }); }
    catch (e) { setMsg(e?.message || 'Hata'); } finally { setBusy(false); }
  };
  const doEndEmployment = async () => {
    if (episode?.outcome === 'early_exit_pending' || episode?.outcome === 'disputed') {
      setMsg(episode.outcome === 'disputed'
        ? 'Ayrılış itirazı Turquz incelemesinde.'
        : 'Ayrılış talebi zaten açık.');
      return;
    }
    if (!confirm('Personelden çıkarma talebi gönderilir. Karşı taraf onaylarsa hemen biter; itiraz da edebilir. 7 gün sessizlik = kabul. Bu sürede talebi iptal edebilirsiniz. Sertifika verilmez.')) return;
    setBusy(true); setMsg('');
    try {
      await endEmployment(c.user_id);
      const ep = await getCandidateEmploymentEpisode(c.user_id);
      setEpisode(ep);
      setMsg('Ayrılış talebi gönderildi. Aday hâlâ personelde (geri alınabilir).');
    } catch (e) { setMsg(e?.message || 'Hata'); } finally { setBusy(false); }
  };

  const doUndoEnd = async () => {
    if (!episode?.id) return;
    if (!confirm('Ayrılış talebi iptal edilir, çalışma devam eder.')) return;
    setBusy(true);
    try {
      await undoEmploymentEnd(episode.id);
      setEpisode(await getCandidateEmploymentEpisode(c.user_id));
      setMsg('Ayrılış talebi iptal edildi.');
    } catch (e) { setMsg(e?.message || 'Hata'); } finally { setBusy(false); }
  };

  const doAcceptEnd = async () => {
    if (!episode?.id) return;
    if (!confirm('Onaylarsanız süreç hemen sonlanır. Aday havuza döner; başarı sertifikası verilmez. Emin misiniz?')) return;
    setBusy(true);
    try {
      await acceptEmploymentEnd(episode.id);
      const [ep, next] = await Promise.all([
        getCandidateEmploymentEpisode(c.user_id),
        getCandidateStatus(c.user_id),
      ]);
      setEpisode(ep);
      if (next) setSt(next);
      setMsg('Ayrılış onaylandı — aday havuza döndü.');
    } catch (e) { setMsg(e?.message || 'Hata'); } finally { setBusy(false); }
  };

  const doConfirmHire = async () => {
    if (!window.confirm('Aday işe başladı olarak işaretlensin ve Personel listesine eklensin mi?')) return;
    setHireBusy(true);
    try {
      await confirmHire(c.user_id);
      const next = await getCandidateStatus(c.user_id);
      if (next) setSt(next);
      setMsg('Personel olarak kaydedildi.');
    } catch (e) { setMsg(e?.message || 'Hata'); }
    finally { setHireBusy(false); }
  };

  const doDeferHire = async () => {
    const v = window.prompt('Yeni işe başlama tarihi (YYYY-MM-DD)', st?.work_start_at ? String(st.work_start_at).slice(0, 10) : '');
    if (!v) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { window.alert('Tarih formatı YYYY-MM-DD olmalı'); return; }
    setHireBusy(true);
    try {
      await deferWorkStart(c.user_id, v);
      const next = await getCandidateStatus(c.user_id);
      if (next) setSt(next);
      setMsg(`Başlangıç tarihi ${v} olarak ertelendi.`);
    } catch (e) { setMsg(e?.message || 'Hata'); }
    finally { setHireBusy(false); }
  };

  const doContestEnd = async () => {
    if (!episode?.id) return;
    setBusy(true);
    try {
      await contestEmploymentEnd(episode.id);
      setEpisode(await getCandidateEmploymentEpisode(c.user_id));
      setMsg('İtiraz iletildi — Turquz inceliyor.');
    } catch (e) { setMsg(e?.message || 'Hata'); } finally { setBusy(false); }
  };

  return (
    <div className="detail">
      <button className="crumb" onClick={onBack}><Icon name="back" size={16} /> Adaylara dön</button>

      <div className="detailGrid">
        <aside className="detailSide">
          <div className="detailHead">
            <div className="detailCode">{code}</div>
            {cat !== 'pool' ? (
              <span className={`badge ${BADGE[cat]}`}>{BADGE_TXT[cat]}</span>
            ) : null}
          </div>
          {(cat === 'process' || cat === 'hired' || cat === 'transit') ? (
            <div className="detailSignals">
              {cat === 'transit' ? (
                <div className="detailSignal warn">
                  Yolda / başlangıç bekliyor
                  {st?.work_start_at ? ` · başlangıç ${String(st.work_start_at).slice(0, 10)}` : ''}
                </div>
              ) : null}
              {contractPayStatus != null ? (
                <div className={`detailSignal ${contractPaid ? 'ok' : 'warn'}`}>
                  {contractPaid ? 'Sözleşme adımı açık' : 'Aday sözleşme adımında (Turquz) — sohbet henüz kapalı'}
                </div>
              ) : null}
              {st?.boarding_status ? (
                <div className={`detailSignal ${st.boarding_status === 'confirmed' ? 'ok' : st.boarding_status === 'missed' ? 'hot' : 'warn'}`}>
                  Uçuş: {
                    ({ pending: 'teyit bekleniyor', confirmed: 'onaylandı', missed: 'kaçırıldı', no_response: 'cevap yok' })[st.boarding_status]
                    || st.boarding_status
                  }
                  {st.flight_depart_on ? ` · ${String(st.flight_depart_on).slice(0, 10)}` : ''}
                </div>
              ) : null}
              {st?.docs_deadline_at && cat === 'process' ? (() => {
                const end = new Date(st.docs_deadline_at);
                const left = end.getTime() - nowTick;
                const when = end.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                });
                return (
                  <div className={`detailSignal ${left < 0 ? 'hot' : 'muted'} detailSignalStack`}>
                    <strong>{t('docs_deadline_signal') || 'İlk belge paketi süresi'}</strong>
                    <span className={`detailSignalClock ${left < 0 ? 'hot' : ''}`}>
                      {left < 0
                        ? (t('deadline_overdue_short') || 'Süre doldu')
                        : formatDeadlineRemain(left, t)}
                    </span>
                    <small>{t('docs_deadline_until', { when }) || `Son tarih: ${when}`}</small>
                  </div>
                );
              })() : null}
            </div>
          ) : null}
          {cat === 'transit' ? (
            <div className="hireConfirmBox">
              <div className="hireConfirmTitle">İşe başladı mı?</div>
              <p className="hireConfirmLead">Evet derseniz Personel listesine eklenir. Hayır derseniz yeni başlangıç tarihi girersiniz.</p>
              <div className="hireConfirmActs">
                <button type="button" className="hireConfirmYes" disabled={hireBusy} onClick={doConfirmHire}>
                  {hireBusy ? '…' : 'Evet — Personel kaydet'}
                </button>
                <button type="button" className="hireConfirmNo" disabled={hireBusy} onClick={doDeferHire}>
                  Hayır — tarihi ertele
                </button>
              </div>
            </div>
          ) : null}
          {ratingSummary ? (
            <div className="detailRateCard">
              <div className="detailRateHead">
                <div className="detailRateTitle">{t('rate_breakdown_title') || 'İşveren değerlendirmeleri'}</div>
                <div className="detailRate">
                  <span className="pcardRateStar">★</span>
                  <strong>{Number(ratingSummary.avg).toFixed(1)}</strong>
                  <span>({ratingSummary.count})</span>
                </div>
              </div>
              <div className="detailRateRows">
                {[
                  { label: t('rate_discipline') || 'İş disiplini', value: ratingSummary.discipline },
                  { label: t('rate_communication') || 'Performans', value: ratingSummary.communication },
                  { label: t('rate_rehire') || 'Tekrar çalışır mıyım?', value: ratingSummary.rehire },
                ].map((row) => {
                  const n = Math.max(0, Math.min(5, Math.round(Number(row.value) || 0)));
                  return (
                    <div key={row.label} className="detailRateRow">
                      <span className="detailRateLbl">{row.label}</span>
                      <span className="detailRateStars">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
                      <span className="detailRateNum">{Number(row.value || 0).toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="detailNat">{c.nationality || '—'}</div>

          <div className="gallery">
            {photos.length ? photos.map((p, i) => (
              <img key={i} src={p} className="galImg" alt="" onClick={() => { setZoomIdx(i); setZoomScale(1); }} title="Büyütmek için tıkla" />
            )) : <div className="muted">Fotoğraf yok</div>}
          </div>

          <div className="buyBox">
            {cat === 'pool' ? (
              <button className="buyBtn" onClick={doOffer} disabled={busy}>{busy ? '…' : 'Teklif Gönder'}</button>
            ) : cat === 'offered' ? (
              <>
                <div className="buyState navy">Teklif gönderildi</div>
                <button className="buyGhost" onClick={doWithdraw} disabled={busy}>{busy ? '…' : 'Teklifi Geri Çek'}</button>
              </>
            ) : cat === 'process' ? (
              <button className="buyGhost" onClick={doWithdraw} disabled={busy}>{busy ? '…' : 'Süreci Geri Çek'}</button>
            ) : (
              <>
                <div className="buyState teal">Personel</div>
                {episode?.outcome === 'early_exit_pending' ? (
                  <div className="buyNote">
                    {episode.end_requested_by === agencyUserId
                      ? 'Ayrılış talebiniz açık. Karşı taraf onaylarsa hemen biter; 7 gün cevap yoksa da kabul sayılır. Bu sürede talebi iptal edebilirsiniz.'
                      : 'Karşı taraf ayrılış istedi. Onaylarsanız süreç hemen biter; itiraz da edebilirsiniz. 7 gün sessizlik de kabul sayılır.'}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {episode.end_requested_by === agencyUserId ? (
                        <button className="buyGhost" type="button" onClick={doUndoEnd} disabled={busy}>Talebi iptal et</button>
                      ) : (
                        <>
                          <button className="buyBtn" type="button" onClick={doAcceptEnd} disabled={busy}>Onayla</button>
                          <button className="buyGhost" type="button" onClick={doContestEnd} disabled={busy}>İtiraz et</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : episode?.outcome === 'disputed' ? (
                  <div className="buyNote">Ayrılış itirazı — Turquz incelemesinde.</div>
                ) : (
                  <button className="buyGhost" onClick={doEndEmployment} disabled={busy}>{busy ? '…' : 'Personelden çıkar'}</button>
                )}
                {workHistory.length ? (
                  <div className="buyNote" style={{ marginTop: 10 }}>
                    <strong>Çalıştığı oteller</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {workHistory.slice(0, 5).map((h) => (
                        <li key={h.episode_id}>{h.employer_title || '—'}{h.ended_at ? ` · ${new Date(h.ended_at).toLocaleDateString('tr-TR')}` : ''}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
            {msg ? <div className="buyMsg">{msg}</div> : null}
          </div>
        </aside>

        <section className="detailMain">
          <div className="detailTop">
            <div className="detailTabs">
              <button className={`detailTab ${tab === 'cv' ? 'on' : ''}`} onClick={() => setTab('cv')}>CV</button>
              <button className={`detailTab ${tab === 'docs' ? 'on' : ''}`} onClick={() => setTab('docs')}>Belgeler</button>
              <button className={`detailTab ${tab === 'iv' ? 'on' : ''}`} onClick={() => setTab('iv')}>Mülakat</button>
            </div>
            <div className="detailActions">
              <button
                type="button"
                className={`detailAct ${favEmployerIds.length ? 'on' : ''}`}
                onClick={() => setFavOpen(true)}
              >
                {favEmployerIds.length ? '★' : '☆'} {t('fav_btn') || 'Favori'}
              </button>
              {canRate ? (
                <button
                  type="button"
                  className={`detailAct ${hasMyRating ? 'on' : ''}`}
                  onClick={() => setRateOpen(true)}
                >
                  ★ {hasMyRating ? (t('rate_btn_edit') || 'Puan') : (t('rate_btn') || 'Değerlendir')}
                </button>
              ) : null}
            </div>
          </div>
          {tab === 'cv'
            ? (
              <>
                <div className="cvToolbar">
                  <div className="cvZoomCtl">
                    <button onClick={() => setCvZoom((z) => Math.max(0.3, +(z - 0.08).toFixed(2)))} title="Uzaklaştır">−</button>
                    <span>{Math.round(cvZoom * 100)}%</span>
                    <button onClick={() => setCvZoom((z) => Math.min(1.5, +(z + 0.08).toFixed(2)))} title="Yakınlaştır">+</button>
                  </div>
                  <div className="cvBtns cvBtnsRow">
                    <button
                      className="cvPrintBtn ghost"
                      onClick={() => setEditorOpen((o) => !o)}
                      style={Object.keys(overrides).length ? { borderColor: '#c2a25a', color: '#8a6a1f', fontWeight: 800 } : {}}
                      title="CV'yi düzenle (yalnızca sizin görünümünüzü etkiler)"
                    >
                      ✏ {Object.keys(overrides).length ? 'Düzenlendi' : 'Düzenle'}
                    </button>
                    <button className="cvPrintBtn ghost" onClick={downloadCv} disabled={pdfBusy}>{pdfBusy ? '… Hazırlanıyor' : '⬇ İndir'}</button>
                    <button className="cvPrintBtn" onClick={printCv}>🖨 Yazdır</button>
                  </div>
                </div>
                {cvTr ? (
                  <div className="cvTrBar">
                    <span>🌐 {showOriginal ? (t('cv_show_original') || 'Orijinal') : (t('cv_ai_translated') || 'AI çeviri')}</span>
                    <button type="button" onClick={() => setShowOriginal((o) => !o)}>
                      {showOriginal ? (t('cv_show_translation') || 'Çeviriyi göster') : (t('cv_show_original') || 'Orijinali göster')}
                    </button>
                  </div>
                ) : null}
                <div className="detailCv">
                  <div className="cvScaleOuter" style={{ width: 900 * cvZoom, height: 2680 * cvZoom }}>
                    <div className="cvScaleInner" style={{ transform: `scale(${cvZoom})` }}>
                      <iframe key={cvFrameKey} title="cv" className="cvFrame" srcDoc={html} />
                    </div>
                  </div>
                </div>
              </>
            )
            : tab === 'docs'
            ? <Documents candidate={c} agencyUserId={agencyUserId} />
            : <InterviewPanel candidate={{ ...c, code }} agencyUserId={agencyUserId} />}
        </section>
      </div>

      {zoomIdx !== null && photos[zoomIdx] ? (
        <div
          className="photoZoom"
          onClick={() => { setZoomIdx(null); setZoomScale(1); }}
          onWheel={(e) => {
            e.preventDefault();
            const next = Math.min(4, Math.max(1, zoomScale + (e.deltaY < 0 ? 0.18 : -0.18)));
            setZoomScale(next);
          }}
          onTouchStart={(e) => { swipeX.current = e.changedTouches[0].clientX; }}
          onTouchEnd={(e) => {
            const start = swipeX.current;
            swipeX.current = null;
            if (start == null) return;
            const dx = e.changedTouches[0].clientX - start;
            if (Math.abs(dx) > 56) slidePhoto(dx < 0 ? 1 : -1);
          }}
        >
          <img
            src={photos[zoomIdx]}
            alt=""
            style={{ transform: `scale(${zoomScale})` }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); setZoomScale((s) => (s > 1.2 ? 1 : 2.2)); }}
          />
          {photos.length > 1 ? (
            <>
              <button type="button" className="photoZoomNav prev" onClick={(e) => { e.stopPropagation(); slidePhoto(-1); }} aria-label="Önceki">‹</button>
              <button type="button" className="photoZoomNav next" onClick={(e) => { e.stopPropagation(); slidePhoto(1); }} aria-label="Sonraki">›</button>
              <div className="photoZoomMeta">{zoomIdx + 1} / {photos.length}</div>
            </>
          ) : null}
          <button className="photoZoomX" onClick={() => { setZoomIdx(null); setZoomScale(1); }}>✕</button>
        </div>
      ) : null}

      {editorOpen ? (
        <>
          {/* Karartma */}
          <div onClick={() => setEditorOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 299 }} />
          <CvOverrideEditor
            base={translatedData}
            overrides={overrides}
            onChange={handleOverrideChange}
            onClear={handleClearOverride}
            onClose={() => setEditorOpen(false)}
            hasOverrides={Object.keys(overrides).length > 0}
          />
        </>
      ) : null}

      {contractPaid && (cat === 'process' || cat === 'hired' || cat === 'transit') && !chatOpen ? (
        <button
          type="button"
          className="processChatFab"
          onClick={() => setChatOpen(true)}
          title={t('chat_open') || 'Mesajlar'}
          aria-label={t('chat_open') || 'Mesajlar'}
        >
          💬
        </button>
      ) : null}

      {chatOpen ? (
        <ProcessChat
          candidateId={c.user_id}
          peerLabel={code}
          onClose={() => {
            setChatOpen(false);
            if (sel?.st?._openChat) onBack?.();
          }}
        />
      ) : null}

      <RateCandidateModal
        open={rateOpen}
        agencyId={agencyUserId}
        candidateId={c.user_id}
        peerLabel={code}
        t={t}
        onClose={() => setRateOpen(false)}
        onSaved={async () => {
          setHasMyRating(true);
          const stats = await listRatingStats([c.user_id]);
          setRatingSummary(stats[c.user_id] || null);
        }}
      />

      <FavoriteEmployerModal
        open={favOpen}
        mode="toggle"
        agencyId={agencyUserId}
        candidateId={c.user_id}
        activeEmployerIds={favEmployerIds}
        onChanged={(_candId, empId, nowOn) => {
          setFavEmployerIds((prev) => {
            const s = new Set(prev);
            if (nowOn) s.add(empId);
            else s.delete(empId);
            return [...s];
          });
        }}
        onClose={() => setFavOpen(false)}
      />
    </div>
  );
}
