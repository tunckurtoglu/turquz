import { useEffect, useState } from 'react';
import { getPickup, savePickup, sendPickup, notifyDocument } from '../lib/api';

// Acente: havaalanı karşılama kişisi (ad + WhatsApp) — kaydet / adaya gönder. Hep açık.
export default function PickupCard({ userId, agencyId, embedded }) {
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
    if (!name.trim() || !phone.trim()) { alert('Ad ve telefon girin.'); return; }
    setBusy(true);
    try { await savePickup(userId, { pickupName: name.trim(), pickupPhone: phone.trim() }, agencyId); alert('Kaydedildi.'); }
    catch (e) { alert(e?.message || 'Hata'); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!name.trim() || !phone.trim()) { alert('Ad ve telefon girin.'); return; }
    if (!confirm('Karşılama bilgileri adaya gönderilsin mi?')) return;
    setBusy(true);
    try {
      await savePickup(userId, { pickupName: name.trim(), pickupPhone: phone.trim() }, agencyId);
      await sendPickup(userId);
      notifyDocument(userId, 'pickup');
      setSent(true); alert('Adaya iletildi.');
    } catch (e) { alert(e?.message || 'Hata'); } finally { setBusy(false); }
  };

  if (loading) return <div className={embedded ? '' : 'pickupCard'}><div className="spinner" /></div>;

  return (
    <div className={embedded ? 'pickupEmbed' : 'pickupCard'}>
      {embedded ? (
        sent ? <div className="pickupHead"><span className="signedTag">✓ İletildi</span></div> : null
      ) : (
        <div className="pickupHead">
          <h3>🤝 Havaalanı Karşılama</h3>
          {sent ? <span className="signedTag">✓ İletildi</span> : null}
        </div>
      )}
      <p className="pickupHint">Adayı havaalanında karşılayacak kişinin bilgileri. Hazır olduğunuzda "Adaya Gönder" deyin (sonradan da güncelleyebilirsiniz).</p>
      <div className="pickupGrid">
        <div className="cField"><label className="fieldLbl">Karşılayacak kişi (ad soyad)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ahmet Yılmaz" /></div>
        <div className="cField"><label className="fieldLbl">Telefon (WhatsApp)</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" /></div>
      </div>
      <div className="pickupFoot">
        <button className="ghostBtn" onClick={save} disabled={busy}>Kaydet</button>
        <button className="goldBtn sm" onClick={send} disabled={busy}>{busy ? '…' : sent ? 'Tekrar Gönder' : 'Adaya Gönder →'}</button>
      </div>
    </div>
  );
}
