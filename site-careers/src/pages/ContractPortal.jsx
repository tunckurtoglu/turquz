import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildContractHtml } from '../shared/buildContractHtml.js';
import { withLatinName } from '../shared/translit.js';
import { portalCall } from '../lib/contractApi.js';
import { dirOf, resolveLang, t } from '../lib/portalI18n.js';
import '../contract.css';

const A4_W = 794;
const LANG_KEY = 'turquz_portal_lang';

function tokenFromUrl() {
  return new URLSearchParams(window.location.search).get('t') || '';
}

function langFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('lang');
  if (raw) {
    const code = resolveLang(raw);
    try { localStorage.setItem(LANG_KEY, code); } catch (_) { /* ignore */ }
    return code;
  }
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved) return resolveLang(saved);
  } catch (_) { /* ignore */ }
  return resolveLang(navigator.language);
}

/** Landing → görüntüle → İndir (ödenmemişse POS; ödendiyse gerçek PDF). Ödemesiz indirme yok. */
export default function ContractPortal() {
  const token = useMemo(() => tokenFromUrl(), []);
  const lang = useMemo(() => langFromUrl(), []);
  const dir = dirOf(lang);
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const [phase, setPhase] = useState('landing');
  const [err, setErr] = useState('');
  const [paid, setPaid] = useState(false);
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [pageH, setPageH] = useState(1123);

  const backChevron = dir === 'rtl' ? '›' : '‹';

  const refreshStatus = async () => {
    if (!token) return;
    const s = await portalCall({ action: 'status', token });
    setPaid(!!s.paid);
  };

  const measurePage = useCallback(() => {
    const stage = stageRef.current;
    const iframe = frameRef.current;
    if (!stage) return;
    const avail = Math.max(stage.clientWidth - 16, 280);
    setScale(Math.min(1, avail / A4_W));
    try {
      const doc = iframe?.contentDocument;
      const h = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight;
      if (h) {
        setPageH(h);
        if (iframe) iframe.style.height = `${h}px`;
      }
    } catch (_) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!token) {
      setErr(t(lang, 'err_token'));
      setPhase('err');
      return;
    }
    refreshStatus().catch((e) => {
      setErr(e.message === 'invalid_token' ? t(lang, 'err_expired') : e.message);
      setPhase('err');
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'preview') return undefined;
    measurePage();
    const onResize = () => measurePage();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phase, html, measurePage]);

  const buildDoc = (p, forScreen) => buildContractHtml(
    withLatinName(p.data || {}),
    p.contract || {},
    p.signature
      ? { signature: p.signature, screen: forScreen }
      : { screen: forScreen },
  );

  const openPreview = async () => {
    setBusy(true);
    setErr('');
    try {
      const p = await portalCall({ action: 'payload', token });
      setPaid(!!p.paid);
      setHtml(buildDoc(p, false));
      setPhase('preview');
    } catch (e) {
      setErr(e.message || 'error');
      setPhase('err');
    } finally {
      setBusy(false);
    }
  };

  /** Sanal POS / checkout. */
  const startCheckout = async () => {
    try {
      const c = await portalCall({ action: 'simulate_pay', token });
      if (c.paid) {
        setPaid(true);
        return 'paid';
      }
      if (c.checkoutUrl) {
        window.location.href = c.checkoutUrl;
        return 'redirect';
      }
    } catch (e) {
      if (e.message !== 'simulate_pay_disabled' && e.message !== 'stripe_not_configured') {
        throw e;
      }
    }

    const c = await portalCall({ action: 'checkout', token });
    if (c.paid) {
      setPaid(true);
      return 'paid';
    }
    if (c.checkoutUrl) {
      window.location.href = c.checkoutUrl;
      return 'redirect';
    }
    throw new Error('checkout_failed');
  };

  /** Acente’nin yüklediği gerçek PDF (storage signed URL). */
  const openPaidPdf = async () => {
    const r = await portalCall({ action: 'download', token });
    if (!r?.downloadUrl) throw new Error('pdf_url_failed');
    // Gerçek application/pdf — iPhone’da Share / Dosyalara Kaydet çıkar
    window.location.assign(r.downloadUrl);
  };

  const onDownload = async () => {
    setErr('');
    if (!paid) {
      setPayOpen(true);
      return;
    }
    setBusy(true);
    try {
      await openPaidPdf();
    } catch (e) {
      const msg = e.message || 'error';
      if (msg === 'payment_required') {
        setPaid(false);
        setErr(t(lang, 'err_pay_first'));
      } else if (msg === 'pdf_missing') {
        setErr(t(lang, 'err_pdf_missing'));
      } else {
        setErr(t(lang, 'err_pdf'));
      }
      setBusy(false);
    }
  };

  /** Test ödemesi — ödeme sonrası doğrudan gerçek PDF’i aç. */
  const onConfirmPay = async () => {
    setBusy(true);
    setErr('');
    try {
      const result = await startCheckout();
      if (result === 'redirect') return;
      if (result === 'paid') {
        setPaid(true);
        setPayOpen(false);
        await openPaidPdf();
        return;
      }
    } catch (e) {
      if (e.message === 'simulate_pay_disabled' || e.message === 'stripe_not_configured' || e.message === 'checkout_failed') {
        setErr(t(lang, 'err_pay_config'));
      } else if (e.message === 'pdf_missing') {
        setErr(t(lang, 'err_pdf_missing'));
      } else {
        setErr(e.message || 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'err' && !html) {
    return (
      <div className="shell" dir={dir} lang={lang}>
        <header className="top">
          <img className="portalLogo" src="/brand/turquz-logo-trim.png" alt="TURQUZ" />
        </header>
        <main className="card"><h1>{t(lang, 'title')}</h1><p className="err">{err}</p></main>
      </div>
    );
  }

  if (phase === 'landing') {
    return (
      <div className="shell" dir={dir} lang={lang}>
        <header className="top">
          <img className="portalLogo" src="/brand/turquz-logo-trim.png" alt="TURQUZ" />
        </header>
        <main className="card">
          <p className="kicker">{t(lang, 'kicker')}</p>
          <h1>{t(lang, 'landing_title')}</h1>
          <p className="lead">{t(lang, 'landing_lead')}</p>
          {err ? <p className="err">{err}</p> : null}
          <div className="ctaRow">
            <button type="button" className="btn primary cardBtn" disabled={busy} onClick={openPreview}>
              {busy ? t(lang, 'loading') : t(lang, 'review')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="shell preview" dir={dir} lang={lang}>
      <header className="headApp">
        <button type="button" className="btn ghost back" aria-label={t(lang, 'back')} onClick={() => setPhase('landing')}>
          {backChevron}
        </button>
        <h1 className="title">{t(lang, 'title')}</h1>
        <span className="pad" aria-hidden="true" />
      </header>
      <div className="accent" />

      {err ? <p className="err banner">{err}</p> : null}

      <div className="pdfStage" ref={stageRef}>
        <div
          className="pdfClip"
          style={{
            width: A4_W * scale,
            height: pageH * scale,
            margin: '0 auto',
            overflow: 'hidden',
          }}
        >
          <div
            className="pdfTrack"
            style={{
              width: A4_W,
              height: pageH,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <iframe
              ref={frameRef}
              title={t(lang, 'title')}
              className="pdfFrame"
              srcDoc={html}
              onLoad={measurePage}
            />
          </div>
        </div>
      </div>

      <footer className="footApp">
        <p className={`footTip${paid ? ' ok' : ''}`}>
          {paid ? t(lang, 'tip_paid') : t(lang, 'tip_pay')}
        </p>
        <button
          type="button"
          className={`btn primary footBtn${paid ? '' : ' pendingPay'}`}
          disabled={busy}
          onClick={onDownload}
        >
          {busy ? t(lang, paid ? 'preparing' : 'paying') : t(lang, 'download')}
        </button>
      </footer>

      {payOpen ? (
        <div className="payOverlay" role="dialog" aria-modal="true" aria-labelledby="payTitle">
          <div className="paySheet">
            <p className="payBadge">TEST</p>
            <h2 id="payTitle">{t(lang, 'test_pay_title')}</h2>
            <p className="payBody">{t(lang, 'test_pay_body')}</p>
            {err ? <p className="err">{err}</p> : null}
            <button type="button" className="btn primary cardBtn" disabled={busy} onClick={onConfirmPay}>
              {busy ? t(lang, 'paying') : t(lang, 'test_pay_confirm')}
            </button>
            <button type="button" className="btn payCancel" disabled={busy} onClick={() => { setPayOpen(false); setErr(''); }}>
              {t(lang, 'test_pay_cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
