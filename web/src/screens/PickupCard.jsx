import { useEffect, useState } from 'react';
import { getPickup, savePickup, sendPickup, notifyDocument } from '../lib/api';
import { useLang } from '../i18n.jsx';

// Acente: havaalanı karşılama kişisi (ad + WhatsApp) — kaydet / adaya gönder. Hep açık.
export default function PickupCard({ userId, agencyId, embedded }) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let a = true;
    getPickup(userId).then((p) => { if (!a) return; setName(p.pickupName); setPhone(p.pickupPhone); setSent(p.pickupSent); setLoading(false); }).catch(() => a && setLoading(false));
    return () => { a = false; };
  }, [userId]);

  const save = async () => {
    if (!name.trim() || !phone.trim()) { alert(t('pickup_agency_need')); return; }
    setBusy(true);
    try { await savePickup(userId, { pickupName: name.trim(), pickupPhone: phone.trim() }, agencyId); alert(t('hotels_saved')); }
    catch (e) { alert(e?.message || t('err_title')); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!name.trim() || !phone.trim()) { alert(t('pickup_agency_need')); return; }
    if (!confirm(t('pickup_agency_confirm'))) return;
    setBusy(true);
    try {
      await savePickup(userId, { pickupName: name.trim(), pickupPhone: phone.trim() }, agencyId);
      await sendPickup(userId);
      notifyDocument(userId, 'pickup');
      setSent(true); alert(t('arr_driver_sent'));
    } catch (e) { alert(e?.message || t('err_title')); } finally { setBusy(false); }
  };

  if (loading) return <div className={embedded ? '' : 'pickupCard'}><div className="spinner" /></div>;

  return (
    <div className={embedded ? 'pickupEmbed' : 'pickupCard'}>
      {embedded ? (
        sent ? <div className="pickupHead"><span className="signedTag">✓ {t('pickup_agency_sent_tag')}</span></div> : null
      ) : (
        <div className="pickupHead">
          <h3>🤝 {t('pickup_title')}</h3>
          {sent ? <span className="signedTag">✓ {t('pickup_agency_sent_tag')}</span> : null}
        </div>
      )}
      <p className="pickupHint">{t('pickup_agency_hint')}</p>
      <div className="pickupGrid">
        <div className="cField"><label className="fieldLbl">{t('pickup_agency_name')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pickup_agency_name_ph')} /></div>
        <div className="cField"><label className="fieldLbl">{t('pickup_agency_phone')}</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" /></div>
      </div>
      <div className="pickupFoot">
        <button className="ghostBtn" onClick={save} disabled={busy}>{t('save')}</button>
        <button className="goldBtn sm" onClick={send} disabled={busy}>{busy ? '…' : sent ? t('pickup_agency_resend') : t('pickup_agency_send')}</button>
      </div>
    </div>
  );
}
