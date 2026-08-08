import { useEffect, useMemo, useState } from 'react';
import { buildContractHtml } from '../../cv/buildContractHtml.js';
import { withLatinName } from '../../lib/translit.js';
import { portalCall } from './api.js';

function tokenFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return q.get('t') || '';
}

export default function App() {
  const token = useMemo(() => tokenFromUrl(), []);
  const [phase, setPhase] = useState('landing'); // landing | preview | busy | err
  const [err, setErr] = useState('');
  const [paid, setPaid] = useState(false);
  const [html, setHtml] = useState('');
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
          // Stripe dönüşü — durumu yenile, önizlemeyi açma zorunlu değil
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
      setHtml(doc);
      setPhase('preview');
    } catch (e) {
      setErr(e.message || 'error');
      setPhase('err');
    } finally {
      setBusy(false);
    }
  };

  const printContract = async () => {
    const w = window.open('', '_blank');
    if (!w) {
      setErr('Açılır pencere engellendi. Lütfen izin verin.');
      return;
    }
    const payload = await portalCall({ action: 'payload', token });
    const printHtml = buildContractHtml(
      withLatinName(payload.data || {}),
      payload.contract || {},
      payload.signature ? { signature: payload.signature, screen: false } : { screen: false },
    );
    w.document.open();
    w.document.write(printHtml);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (_) { /* yoksay */ } }, 400);
    setPaid(true);
  };

  const onDownload = async () => {
    setBusy(true);
    setErr('');
    try {
      const st = await portalCall({ action: 'status', token });
      if (st.paid) {
        await printContract();
        return;
      }

      // Ödeme: Stripe Checkout (veya dev bypass)
      const c = await portalCall({ action: 'checkout', token });
      if (c.paid) {
        setPaid(true);
        await printContract();
        return;
      }
      if (c.checkoutUrl) {
        window.location.href = c.checkoutUrl;
        return;
      }
      setErr('Ödeme başlatılamadı.');
    } catch (e) {
      setErr(e.message === 'stripe_not_configured'
        ? 'Ödeme henüz yapılandırılmadı. Turquz ile iletişime geçin.'
        : (e.message || 'error'));
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'err' && !html) {
    return (
      <div className="shell">
        <header className="top"><span className="brand">TURQUZ</span></header>
        <main className="card">
          <h1>Sözleşme</h1>
          <p className="err">{err}</p>
        </main>
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
            {busy ? 'Yükleniyor…' : 'Sözleşmeyi görüntüle'}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="shell preview">
      <header className="top bar">
        <span className="brand">TURQUZ</span>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={() => setPhase('landing')}>Geri</button>
          <button type="button" className="btn primary" disabled={busy} onClick={onDownload}>
            {busy ? '…' : (paid ? 'İndir / Yazdır' : 'İndir')}
          </button>
        </div>
      </header>
      {err ? <p className="err banner">{err}</p> : null}
      {!paid ? (
        <p className="tip">İndir’e bastığınızda güvenli ödeme adımı açılır. Ödeme tamamlanınca sözleşmeyi indirebilirsiniz.</p>
      ) : (
        <p className="tip ok">Ödeme tamam — sözleşmeyi yazdırıp imzalayın, uygulamadan yükleyin.</p>
      )}
      <iframe title="Sözleşme" className="frame" srcDoc={html} />
    </div>
  );
}
