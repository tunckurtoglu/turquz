import { useEffect, useMemo, useRef, useState } from 'react';
import { offerCandidate, withdrawCandidate, endEmployment, categoryOf, buildCvPdfServer, translateCvFields, applyCvTranslation, notifyOffer, extractCvFields, hasCvFreeText, getContract, getCandidateEmploymentEpisode, undoEmploymentEnd, contestEmploymentEnd, acceptEmploymentEnd, answerEmploymentTerm, getCandidateStatus, listCandidateWorkHistory, confirmHire, deferWorkStart, agencyAnswerBoarding } from '../lib/api';
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
import AgencyNoticeModal from '../components/AgencyNoticeModal.jsx';
import { canRateCandidate, getMyRating, listRatingStats } from '../lib/ratings';
import { isFavorited, toggleFavorite } from '../lib/favorites';
import { formatDeadlineRemain } from '../lib/deadline';
import { getFlight, msUntilArrival, msUntilYmdGate } from '../../../lib/flights';
import { formatCountdown } from '../lib/interviews';

const BADGE = { offered: 'navy', process: 'green', hired: 'teal', transit: 'navy' };
const BADGE_KEYS = { offered: 'agency_filter_offered', process: 'in_process_label', hired: 'nav_staff', transit: 'ops_transit' };

export default function Candidate({ sel, onBack, agencyUserId, onChatRead }) {
  const { lang, t } = useLang();
  const badgeTxt = (k) => t(BADGE_KEYS[k]) || k;
  const c = sel.c;
  const baseData = normalizePoolCvData(c);
  const code = candidateCode(c.nationality, c.reg_no);
  const [chatOpen, setChatOpen] = useState(!!sel?.st?._openChat);
  const [noticeOpen, setNoticeOpen] = useState(false);
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
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [hireBusy, setHireBusy] = useState(false);
  const [flightRow, setFlightRow] = useState(null);
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

  useEffect(() => {
    if (!c.user_id) { setFlightRow(null); return undefined; }
    let alive = true;
    getFlight(c.user_id).then((f) => { if (alive) setFlightRow(f); });
    return () => { alive = false; };
  }, [c.user_id]);

  useEffect(() => {
    const workStartYmd = st?.work_start_at ? String(st.work_start_at).slice(0, 10) : null;
    const arriveLeft = flightRow?.arriveAt ? msUntilArrival(flightRow.arriveAt) : 0;
    const workStartLeft = st?.status === 'in_transit' ? msUntilYmdGate(workStartYmd) : 0;
    const needTick = st?.status === 'in_transit' && (arriveLeft > 0 || workStartLeft > 0);
    if (!needTick) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [st?.status, st?.work_start_at, flightRow?.arriveAt]);

  // Override'ları yükle (her yeni aday açılınca)
  useEffect(() => {
    setOverrides({});
    setEditorOpen(false);
    setChatOpen(!!sel?.st?._openChat);
    setRateOpen(false);
    setContractPaid(false);
    setContractPayStatus(null);
    setCanRate(false);
    setHasMyRating(false);
    setRatingSummary(null);
    setIsFav(false);
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
    isFavorited(agencyUserId, c.user_id).then((on) => setIsFav(!!on));
    Promise.all([
      listRatingStats([c.user_id]),
      canRateCandidate(c.user_id),
      getMyRating(agencyUserId, c.user_id),
    ]).then(([stats, can, mine]) => {
      setRatingSummary(stats[c.user_id] || null);
      setCanRate(!!can);
      setHasMyRating(!!mine);
      if (can && sel?.st?._openRate && !mine) setRateOpen(true);
    });
  }, [c.user_id, agencyUserId, sel?.st?._openChat, sel?.st?._openRate]);

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

  const onToggleFav = async () => {
    if (!agencyUserId || !c.user_id || favBusy) return;
    setFavBusy(true);
    try {
      const nowOn = await toggleFavorite(agencyUserId, c.user_id);
      setIsFav(nowOn);
    } catch (e) {
      console.warn('fav toggle:', e?.message);
    } finally {
      setFavBusy(false);
    }
  };

  const translatedData = (!showOriginal && cvTr) ? applyCvTranslation(baseData, cvTr) : baseData;
  // Acente düzenlemeleri en son uygulanır (en yüksek öncelik) — title dahil
  const data = applyCvOverrides(translatedData, overrides);
  const cat = categoryOf(st);
  const chatOn = contractPaid;

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
    } catch (e) { alert(e?.message || t('pdf_error') || 'PDF'); }
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
    try { await offerCandidate(c.user_id); notifyOffer(c.user_id, 'offer'); setSt({ ...(st || {}), status: 'offered' }); setMsg(t('agency_offer_sent') || 'Teklif gönderildi.'); }
    catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };
  const doWithdraw = async () => {
    const inProcess = cat === 'process' || st?.status === 'accepted';
    if (!confirm(inProcess
      ? (t('process_end_confirm') || '')
      : (t('agency_withdraw_confirm') || ''))) return;
    setBusy(true); setMsg('');
    try { await withdrawCandidate(c.user_id); setSt({ ...(st || {}), status: 'new', docs_unlocked: false, hired_at: null }); }
    catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };
  const doEndEmployment = async () => {
    if (episode?.outcome === 'early_exit_pending' || episode?.outcome === 'disputed' || episode?.outcome === 'completion_pending') {
      setMsg(episode.outcome === 'disputed'
        ? (t('emp_disputed') || '')
        : episode.outcome === 'completion_pending'
          ? (t('emp_term_body') || '')
          : (t('emp_pending_agency') || ''));
      return;
    }
    if (!confirm(t('staff_end_confirm') || '')) return;
    setBusy(true); setMsg('');
    try {
      await endEmployment(c.user_id);
      const ep = await getCandidateEmploymentEpisode(c.user_id);
      setEpisode(ep);
      setMsg(t('emp_request_sent') || '');
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };

  const doUndoEnd = async () => {
    if (!episode?.id) return;
    if (!confirm(t('emp_undo_confirm') || '')) return;
    setBusy(true);
    try {
      await undoEmploymentEnd(episode.id);
      setEpisode(await getCandidateEmploymentEpisode(c.user_id));
      setMsg(t('notif_employment_end_undone') || '');
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };

  const doAcceptEnd = async () => {
    if (!episode?.id) return;
    if (!confirm(t('emp_accept_confirm') || '')) return;
    setBusy(true);
    try {
      await acceptEmploymentEnd(episode.id);
      const [ep, next] = await Promise.all([
        getCandidateEmploymentEpisode(c.user_id),
        getCandidateStatus(c.user_id),
      ]);
      setEpisode(ep);
      if (next) setSt(next);
      setMsg(t('emp_accepted_ok') || '');
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };

  const doContestEnd = async () => {
    if (!episode?.id) return;
    setBusy(true);
    try {
      await contestEmploymentEnd(episode.id);
      setEpisode(await getCandidateEmploymentEpisode(c.user_id));
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };

  const doTermAnswer = async (answer) => {
    if (!episode?.id) return;
    const ok = window.confirm(answer === 'ok'
      ? (t('emp_term_ok_confirm') || '')
      : (t('emp_term_problem_confirm') || ''));
    if (!ok) return;
    setBusy(true);
    try {
      await answerEmploymentTerm(episode.id, answer);
      const [ep, next] = await Promise.all([
        getCandidateEmploymentEpisode(c.user_id),
        getCandidateStatus(c.user_id),
      ]);
      setEpisode(ep);
      if (next) setSt(next);
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); } finally { setBusy(false); }
  };

  const doConfirmHire = async () => {
    if (!window.confirm(t('ops_start_confirm_dialog') || '')) return;
    setHireBusy(true);
    try {
      await confirmHire(c.user_id);
      const next = await getCandidateStatus(c.user_id);
      if (next) setSt(next);
      setMsg(t('hire_saved_ok') || '');
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); }
    finally { setHireBusy(false); }
  };

  const doDeferHire = async () => {
    const v = window.prompt(t('work_start_defer_prompt') || '', st?.work_start_at ? String(st.work_start_at).slice(0, 10) : '');
    if (!v) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { window.alert(t('work_start_date_format') || ''); return; }
    setHireBusy(true);
    try {
      await deferWorkStart(c.user_id, v);
      const next = await getCandidateStatus(c.user_id);
      if (next) setSt(next);
      setMsg(t('work_start_deferred', { date: v }) || '');
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); }
    finally { setHireBusy(false); }
  };

  const doAgencyBoarding = async (answer) => {
    setHireBusy(true);
    try {
      await agencyAnswerBoarding(c.user_id, answer);
      const next = await getCandidateStatus(c.user_id);
      if (next) setSt(next);
      if (answer === 'confirmed') setMsg(t('boarding_agency_yes_ok'));
      else setMsg(t('boarding_missed_next'));
    } catch (e) { setMsg(e?.message || t('err_generic') || 'Hata'); }
    finally { setHireBusy(false); }
  };

  const boardingOpen = st?.boarding_status === 'pending' || st?.boarding_status === 'no_response';
  const boardingMissed = st?.boarding_status === 'missed';
  const workStartYmd = st?.work_start_at ? String(st.work_start_at).slice(0, 10) : null;
  const arriveCountdownLeft = flightRow?.arriveAt ? msUntilArrival(flightRow.arriveAt, nowTick) : 0;
  const workStartCountdownLeft = cat === 'transit' ? msUntilYmdGate(workStartYmd, nowTick) : 0;
  const workStartDue = cat === 'transit' && workStartYmd && workStartCountdownLeft === 0;
  const boardingShort = {
    pending: t('boarding_short_pending'),
    confirmed: t('boarding_short_confirmed'),
    missed: t('boarding_short_missed'),
    no_response: t('boarding_short_no_response'),
  };

  return (
    <div className="detail">
      <button className="crumb" onClick={onBack}><Icon name="back" size={16} /> {t('web_back_candidates') || 'Adaylara dön'}</button>

      <div className="detailGrid">
        <aside className="detailSide">
          <div className="detailHead">
            <div className="detailCode">{code}</div>
            {cat !== 'pool' ? (
              <span className={`badge ${BADGE[cat]}`}>{badgeTxt(cat)}</span>
            ) : null}
          </div>
          {(cat === 'process' || cat === 'hired' || cat === 'transit') ? (
            <div className="detailSignals">
              {cat === 'transit' ? (
                <div className="detailSignal warn detailSignalStack">
                  <strong>
                    {workStartDue
                      ? (t('ops_start_confirm_hint') || '')
                      : `${t('ops_transit_signal') || ''}${st?.work_start_at ? ` · ${t('ops_start_on', { date: String(st.work_start_at).slice(0, 10) }) || ''}` : ''}`}
                  </strong>
                  {arriveCountdownLeft > 0 ? (
                    <span className="detailSignalClock">⏱ {t('arrive_countdown_title')}: {formatCountdown(arriveCountdownLeft)}</span>
                  ) : null}
                  {workStartCountdownLeft > 0 ? (
                    <span className="detailSignalClock">⏱ {t('work_start_countdown_title')}: {formatCountdown(workStartCountdownLeft)}</span>
                  ) : null}
                </div>
              ) : null}
              {contractPayStatus != null ? (
                <div className={`detailSignal ${contractPaid ? 'ok' : 'warn'}`}>
                  {contractPaid
                    ? (t('web_contract_open_chat') || '')
                    : (t('web_contract_pay_wait') || '')}
                </div>
              ) : null}
              {st?.boarding_status ? (
                <div className={`detailSignal ${st.boarding_status === 'confirmed' ? 'ok' : st.boarding_status === 'missed' ? 'hot' : 'warn'}`}>
                  {t('boarding_flight_prefix') || 'Uçuş'}: {
                    boardingShort[st.boarding_status] || st.boarding_status
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
          {cat === 'transit' && boardingOpen ? (
            <div className="hireConfirmBox">
              <div className="hireConfirmTitle">{t('boarding_agency_title')}</div>
              <p className="hireConfirmLead">
                {st?.boarding_status === 'no_response' ? t('boarding_agency_lead_silent') : t('boarding_agency_lead_pending')}
              </p>
              <div className="hireConfirmActs">
                <button type="button" className="hireConfirmYes" disabled={hireBusy} onClick={() => doAgencyBoarding('confirmed')}>
                  {hireBusy ? '…' : t('boarding_agency_yes')}
                </button>
                <button type="button" className="hireConfirmNo" disabled={hireBusy} onClick={() => doAgencyBoarding('missed')}>
                  {t('boarding_agency_no')}
                </button>
              </div>
            </div>
          ) : null}
          {cat === 'transit' && boardingMissed ? (
            <div className="hireConfirmBox">
              <div className="hireConfirmTitle">{t('notif_boarding_missed')}</div>
              <p className="hireConfirmLead">{t('boarding_missed_next')}</p>
              <div className="hireConfirmActs">
                <button type="button" className="hireConfirmYes" onClick={() => setTab('docs')}>{t('boarding_missed_dates_cta')}</button>
              </div>
            </div>
          ) : null}
          {cat === 'transit' && !boardingOpen && !boardingMissed && (workStartDue || workStartCountdownLeft > 0) ? (
            workStartDue ? (
            <div className="hireConfirmBox">
              <div className="hireConfirmTitle">{t('ops_start_confirm') || ''}</div>
              <p className="hireConfirmLead">{t('ops_start_lead') || ''}</p>
              <div className="hireConfirmActs">
                <button type="button" className="hireConfirmYes" disabled={hireBusy} onClick={doConfirmHire}>
                  {hireBusy ? '…' : (t('ops_start_yes') || '')}
                </button>
                <button type="button" className="hireConfirmNo" disabled={hireBusy} onClick={doDeferHire}>
                  {t('ops_start_no') || ''}
                </button>
              </div>
            </div>
            ) : (
            <div className="hireConfirmBox">
              <div className="hireConfirmTitle">{t('ops_start_confirm') || ''}</div>
              <p className="hireConfirmLead">⏱ {t('work_start_countdown_title')}: {formatCountdown(workStartCountdownLeft)}</p>
              <p className="hireConfirmLead">{t('work_start_countdown_sub_ag') || ''}</p>
            </div>
            )
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
              <img key={i} src={p} className="galImg" alt="" onClick={() => { setZoomIdx(i); setZoomScale(1); }} title={t('photo_tap_zoom') || ''} />
            )) : <div className="muted">{t('photo_none') || ''}</div>}
          </div>

          <div className="buyBox">
            {cat === 'offered' || cat === 'process' || cat === 'hired' || cat === 'transit' ? (
              <button type="button" className="buyNotice" onClick={() => setNoticeOpen(true)}>
                {t('agency_notice')}
              </button>
            ) : null}
            {cat === 'pool' ? (
              <button className="buyBtn" onClick={doOffer} disabled={busy}>{busy ? '…' : (t('agency_offer') || '')}</button>
            ) : cat === 'offered' ? (
              <>
                <div className="buyState navy">{t('agency_offer_sent_short') || ''}</div>
                <button className="buyGhost" onClick={doWithdraw} disabled={busy}>{busy ? '…' : (t('agency_withdraw') || '')}</button>
              </>
            ) : cat === 'process' ? (
              <button className="buyGhost" onClick={doWithdraw} disabled={busy}>{busy ? '…' : (t('process_end') || '')}</button>
            ) : (
              <>
                <div className="buyState teal">{t('nav_staff') || ''}</div>
                {episode?.outcome === 'early_exit_pending' ? (
                  <div className="buyNote">
                    {episode.end_requested_by === agencyUserId
                      ? (t('emp_pending_mine') || '')
                      : (t('emp_pending_theirs') || '')}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                      {episode.end_requested_by === agencyUserId ? (
                        <button className="buyGhost" type="button" onClick={doUndoEnd} disabled={busy}>{t('emp_undo') || ''}</button>
                      ) : (
                        <>
                          <button className="buyBtn" type="button" onClick={doAcceptEnd} disabled={busy}>{t('emp_accept') || ''}</button>
                          <button className="buyGhost" type="button" onClick={doContestEnd} disabled={busy}>{t('emp_contest') || ''}</button>
                        </>
                      )}
                    </div>
                  </div>
                ) : episode?.outcome === 'completion_pending' ? (
                  <div className="buyNote">
                    {t('emp_term_body')}
                    {episode.term_vote_agency === 'ok' ? (
                      <div style={{ marginTop: 8 }}>{t('emp_term_waiting')}</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        <button className="buyBtn" type="button" onClick={() => doTermAnswer('ok')} disabled={busy}>{t('emp_term_ok') || ''}</button>
                        <button className="buyGhost" type="button" onClick={() => doTermAnswer('problem')} disabled={busy}>{t('emp_term_problem') || ''}</button>
                      </div>
                    )}
                  </div>
                ) : episode?.outcome === 'disputed' ? (
                  <div className="buyNote">{t('emp_disputed') || ''}</div>
                ) : (
                  <button className="buyGhost" onClick={doEndEmployment} disabled={busy}>{busy ? '…' : (t('staff_end') || '')}</button>
                )}
                {workHistory.length ? (
                  <div className="buyNote" style={{ marginTop: 10 }}>
                    <strong>{t('work_history_title') || ''}</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      {workHistory.slice(0, 5).map((h) => (
                        <li key={h.episode_id}>{h.employer_title || '—'}{h.ended_at ? ` · ${new Date(h.ended_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB')}` : ''}</li>
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
              <button className={`detailTab ${tab === 'cv' ? 'on' : ''}`} onClick={() => setTab('cv')}>{t('agency_tab_cv') || 'CV'}</button>
              <button className={`detailTab ${tab === 'docs' ? 'on' : ''}`} onClick={() => setTab('docs')}>{t('agency_tab_docs') || ''}</button>
              <button className={`detailTab ${tab === 'iv' ? 'on' : ''}`} onClick={() => setTab('iv')}>{t('agency_tab_iv') || ''}</button>
            </div>
            <div className="detailActions">
              <button
                type="button"
                className={`detailAct ${isFav ? 'on' : ''}`}
                onClick={onToggleFav}
                disabled={favBusy}
              >
                {isFav ? '★' : '☆'} {t('fav_btn') || 'Favori'}
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
            {canRate && !hasMyRating ? (
              <p className="muted" style={{ margin: '8px 16px 0', fontSize: 13, color: '#9a7b1f', fontWeight: 700 }}>
                ★ {t('rate_required_hint') || 'Sezon başarıyla bitti — değerlendirme zorunlu.'}
              </p>
            ) : null}
          </div>
          {tab === 'cv'
            ? (
              <>
                <div className="cvToolbar">
                  <div className="cvZoomCtl">
                    <button onClick={() => setCvZoom((z) => Math.max(0.3, +(z - 0.08).toFixed(2)))} title={t('cv_zoom_out') || ''}>−</button>
                    <span>{Math.round(cvZoom * 100)}%</span>
                    <button onClick={() => setCvZoom((z) => Math.min(1.5, +(z + 0.08).toFixed(2)))} title={t('cv_zoom_in') || ''}>+</button>
                  </div>
                  <div className="cvBtns cvBtnsRow">
                    <button
                      className="cvPrintBtn ghost"
                      onClick={() => setEditorOpen((o) => !o)}
                      style={Object.keys(overrides).length ? { borderColor: '#c2a25a', color: '#8a6a1f', fontWeight: 800 } : {}}
                      title={t('cv_edit_hint') || ''}
                    >
                      ✏ {Object.keys(overrides).length ? (t('cv_edit_edited') || '') : (t('cv_edit_btn') || '')}
                    </button>
                    <button className="cvPrintBtn ghost" onClick={downloadCv} disabled={pdfBusy}>{pdfBusy ? `… ${t('pdf_preparing') || ''}` : `⬇ ${t('contract_download') || t('doc_download') || ''}`}</button>
                    <button className="cvPrintBtn" onClick={printCv}>🖨 {t('cv_print') || ''}</button>
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
              <button type="button" className="photoZoomNav prev" onClick={(e) => { e.stopPropagation(); slidePhoto(-1); }} aria-label={t('photo_prev') || ''}>‹</button>
              <button type="button" className="photoZoomNav next" onClick={(e) => { e.stopPropagation(); slidePhoto(1); }} aria-label={t('photo_next') || ''}>›</button>
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

      {chatOn && !chatOpen ? (
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
          onRead={onChatRead}
          onClose={() => {
            setChatOpen(false);
            onChatRead?.();
            if (sel?.st?._openChat) onBack?.();
          }}
        />
      ) : null}

      <AgencyNoticeModal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        userIds={[c.user_id]}
        peerLabel={code}
      />

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
    </div>
  );
}
