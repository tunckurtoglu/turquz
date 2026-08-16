import { useEffect, useMemo, useRef, useState } from 'react';
import { buildContractHtml } from '../../cv/buildContractHtml.js';
import { withLatinName } from '../../lib/translit.js';
import { portalCall } from './api.js';
import './styles.css';

function tokenFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return q.get('t') || '';
}

function fitFrame(iframe) {
  try {
    const doc = iframe?.contentDocument;
    const h = doc?.documentElement?.scrollHeight || doc?.body?.scrollHeight;
    if (h) iframe.style.height = `${Math.max(h + 24, 480)}px`;
  } catch (_) { /* yoksay */ }
}

/** App’ten gelen token’lı sözleşme sayfası — kariyer landing’de menüde yok. */
export default function ContractPortal() {
  const token = useMemo(() => tokenFromUrl(), []);
  const frameRef = useRef(null);
  const [phase, setPhase] = useState('landing');
  const [err, setErr] = useState('');
  const [paid, setPaid] = useState(false);
  const [html, setHtml] = useState('');
  const [screenHtml, setScreenHtml] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshStatus = async () => {
    if (!token) return;
    const s = await portalCall({ action: 'status', token });
    setPaid(!!s.paid);
  };

  useEffect(() => {
    if (!token) {
      setErr('Geçersiz veya eksik bağlantı. Lütfen uygulamadan yeniden açın.');
      setPhase('err');
      return;
    }
    const q = new URLSearchParams(window.location.search);
    refreshStatus()
      .then(() => {
        if (q.get('paid') === '1') {
          // Stripe / test dönüşü
        }
      })
      .catch((e) => {
        setErr(e.message === 'invalid_token' ? 'Bağlantının süresi dolmuş. Uygulamadan yeniden açın.' : e.message);
        setPhase('err');
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPreview = async () => {
    setBusy(true);
    setErr('');
    try {
      const p = await portalCall({ action: 'payload', token });
      setPaid(!!p.paid);
      const doc = buildContractHtml(
        withLatinName(p.data || {}),
        p.contract || {},
        p.signature ? { signature: p.signature, screen: true } : { screen: true },
      );
      setScreenHtml(doc);
      setHtml(doc);
      setPhase('preview');
    } catch (e) {
      setErr(e.message || 'error');
      setPhase('err');
    } finally {
      setBusy(false);
    }
  };

  /** Görünür iframe üzerinden yazdır — yeni pencere / gizli iframe yok (in-app Safari uyumlu). */
  const printContract = async () => {
    const payload = await portalCall({ action: 'payload', token });
    const printHtml = buildContractHtml(
      withLatinName(payload.data || {}),
      payload.contract || {},
      payload.signature ? { signature: payload.signature, screen: false } : { screen: false },
    );

    const iframe = frameRef.current;
    if (!iframe) throw new Error('print_unavailable');

    await new Promise((resolve, reject) => {
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        iframe.removeEventListener('load', onLoad);
        if (err) reject(err);
        else resolve();
      };
      const onLoad = () => {
        fitFrame(iframe);
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            finish();
          } catch (e) {
            finish(e);
          } finally {
            // Önizlemeyi geri yükle
            setTimeout(() => {
              if (screenHtml) setHtml(screenHtml);
            }, 800);
          }
        }, 350);
      };
      iframe.addEventListener('load', onLoad);
      setHtml(printHtml);
      // srcDoc aynı kalırsa load tetiklenmeyebilir
      setTimeout(() => {
        if (!done && iframe.contentDocument?.readyState === 'complete') onLoad();
      }, 600);
    });
  };

  const onPay = async () => {
    setBusy(true);
    setErr('');
    try {
      const st = await portalCall({ action: 'status', token });
      if (st.paid) {
        setPaid(true);
        return;
      }
      const c = await portalCall({ action: 'simulate_pay', token });
      if (c.paid) {
        setPaid(true);
        return;
      }
      if (c.checkoutUrl) {
        window.location.href = c.checkoutUrl;
        return;
      }
      setErr('Ödeme başlatılamadı.');
    } catch (e) {
      if (e.message === 'simulate_pay_disabled' || e.message === 'stripe_not_configured') {
        try {
          const c = await portalCall({ action: 'checkout', token });
          if (c.paid) {
            setPaid(true);
            return;
          }
          if (c.checkoutUrl) {
            window.location.href = c.checkoutUrl;
            return;
          }
        } catch (e2) {
          setErr(e2.message === 'stripe_not_configured'
            ? 'Ödeme henüz yapılandırılmadı. Turquz ile iletişime geçin.'
            : (e2.message || 'error'));
          return;
        }
      }
      setErr(e.message || 'error');
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    setBusy(true);
    setErr('');
    try {
      const st = await portalCall({ action: 'status', token });
      if (!st.paid) {
        setErr('Önce ödemeyi tamamlayın.');
        return;
      }
      setPaid(true);
      await printContract();
    } catch (e) {
      setErr(e.message === 'print_unavailable'
        ? 'Yazdırma açılamadı. Lütfen tekrar deneyin.'
        : (e.message || 'error'));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'err' && !html) {
    return (
      <div className="shell">
        <header className="top"><span className="brand">TURQUZ</span></header>
        <main className="card"><h1>Sözleşme</h1><p className="err">{err}</p></main>
      </div>
    );
  }

  if (phase === 'landing') {
    return (
      <div className="shell">
        <header className="top"><span className="brand">TURQUZ</span></header>
        <main className="card">
          <p className="kicker">İş sözleşmesi</p>
          <h1>Sözleşmenizi buradan görüntüleyebilirsiniz</h1>
          <p className="lead">
            Önce sözleşmeyi inceleyin. İndirmek için sonraki adımda işlem ücreti tahsil edilir;
            ardından uygulamadan imzalı belgenizi yüklemeye devam edebilirsiniz.
          </p>
          {paid ? <p className="ok">✓ İşlem ücreti alındı — indirebilirsiniz.</p> : null}
          {err ? <p className="err">{err}</p> : null}
          <button type="button" className="btn primary" disabled={busy} onClick={openPreview}>
            {busy ? 'Yükleniyor…' : 'Sözleşmeyi incele'}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="shell preview">
      <header className="top bar">
        <span className="brand">TURQUZ</span>
        <button type="button" className="btn ghost" onClick={() => setPhase('landing')}>Geri</button>
      </header>
      {err ? <p className="err banner">{err}</p> : null}
      {!paid ? (
        <p className="tip">İnceledikten sonra ödemeyi tamamlayın. (Test: kart yok.)</p>
      ) : (
        <p className="tip ok">Ödeme tamam — yazdırıp imzalayın, uygulamadan yükleyin.</p>
      )}
      <div className="ctaBar">
        {!paid ? (
          <button type="button" className="btn primary" disabled={busy} onClick={onPay}>
            {busy ? 'İşleniyor…' : 'Ödeme yap'}
          </button>
        ) : (
          <button type="button" className="btn primary" disabled={busy} onClick={onDownload}>
            {busy ? 'Hazırlanıyor…' : 'İndir / Yazdır'}
          </button>
        )}
      </div>
      <div className="frameWrap">
        <iframe
          ref={frameRef}
          title="Sözleşme"
          className="frame"
          srcDoc={html}
          onLoad={(e) => fitFrame(e.currentTarget)}
        />
      </div>
    </div>
  );
}
