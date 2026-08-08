import { useEffect, useMemo, useRef, useState } from 'react';
import { offerCandidate, withdrawCandidate, endEmployment, categoryOf, buildCvPdfServer, translateCvFields, applyCvTranslation, notifyOffer, extractCvFields, hasCvFreeText, getContract } from '../lib/api';
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

const BADGE = { offered: 'navy', process: 'green', hired: 'teal' };
const BADGE_TXT = { offered: 'Teklifli', process: 'Süreçte', hired: 'Personel' };

export default function Candidate({ sel, onBack, agencyUserId }) {
  const { lang, t } = useLang();
  const c = sel.c;
  const baseData = normalizePoolCvData(c);
  const code = candidateCode(c.nationality, c.reg_no);
  const [chatOpen, setChatOpen] = useState(false);
  const [contractPaid, setContractPaid] = useState(false);
  const [st, setSt] = useState(sel.st);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState('cv');
  const [zoom, setZoom] = useState(null); // büyütülen fotoğraf
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

  // Override'ları yükle (her yeni aday açılınca)
  useEffect(() => {
    setOverrides({});
    setEditorOpen(false);
    setChatOpen(false);
    setRateOpen(false);
    setFavOpen(false);
    setContractPaid(false);
    setCanRate(false);
    setHasMyRating(false);
    setRatingSummary(null);
    setFavEmployerIds([]);
    if (!agencyUserId || !c.user_id) return;
    loadOverride(agencyUserId, c.user_id).then(setOverrides);
    getContract(c.user_id).then((con) => setContractPaid(!!con?.isPaid));
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
  }, [c.user_id, agencyUserId]);

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
    if (!confirm('Emin misiniz? Bu işlem geri alınamaz. Aday personelden çıkarılıp havuza döner; belgeler ve sözleşme sıfırlanır.')) return;
    setBusy(true); setMsg('');
    try {
      await endEmployment(c.user_id);
      setSt({ status: 'new', docs_unlocked: false });
      setCanRate(true);
      setMsg('Süreç sonlandırıldı; aday havuza döndü.');
      setRateOpen(true);
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
              <img key={i} src={p} className="galImg" alt="" onClick={() => setZoom(p)} title="Büyütmek için tıkla" />
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
                <button className="buyGhost" onClick={doEndEmployment} disabled={busy}>{busy ? '…' : 'Süreci Sonlandır'}</button>
              </>
            )}
            {msg ? <div className="buyMsg">{msg}</div> : null}
            {contractPaid && (cat === 'process' || cat === 'hired') ? (
              <button type="button" className="buyBtn" onClick={() => setChatOpen(true)}>
                💬 {t('chat_open') || 'Mesajlar'}
              </button>
            ) : null}
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

      {zoom ? (
        <div className="photoZoom" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="photoZoomX" onClick={() => setZoom(null)}>✕</button>
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

      {chatOpen ? (
        <ProcessChat
          candidateId={c.user_id}
          peerLabel={code}
          onClose={() => setChatOpen(false)}
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
