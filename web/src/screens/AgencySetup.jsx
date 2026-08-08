import { useEffect, useState } from 'react';
import {
  completeAgencySetup, getAgencyProfile, signOut, updateMyProfile, uploadAgencyTaxPlate,
} from '../lib/api';

// Zorunlu kapı (onCancel yok) veya panelde "Bilgileri Güncelle" (onCancel var — hafif form).
export default function AgencySetup({ user, onDone, onCancel }) {
  const editMode = !!onCancel;
  const uid = user?.id;
  const meta = user?.user_metadata || {};
  const [company, setCompany] = useState('');
  const [firstName, setFirstName] = useState(meta.first_name || '');
  const [lastName, setLastName] = useState(meta.last_name || '');
  const [phoneAuth, setPhoneAuth] = useState(meta.phone || '');
  const [phoneRep, setPhoneRep] = useState(meta.phone_rep || '');
  const [taxPath, setTaxPath] = useState('');
  const [taxName, setTaxName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!uid || editMode) return;
    getAgencyProfile(uid).then((p) => {
      if (!p) return;
      if (p.companyName) setCompany(p.companyName);
      if (p.contactFirstName) setFirstName(p.contactFirstName);
      if (p.contactLastName) setLastName(p.contactLastName);
      if (p.phoneAuthorized) setPhoneAuth(p.phoneAuthorized);
      if (p.phoneRep) setPhoneRep(p.phoneRep);
      if (p.taxPlatePath) { setTaxPath(p.taxPlatePath); setTaxName('vergi_levhasi.pdf'); }
    }).catch(() => {});
  }, [uid, editMode]);

  const onTaxFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setErr('Yalnızca PDF yükleyin.'); return; }
    setErr(''); setBusy(true);
    try {
      const path = await uploadAgencyTaxPlate(uid, file);
      setTaxPath(path);
      setTaxName(file.name || 'vergi_levhasi.pdf');
    } catch (e2) { setErr(e2?.message || 'PDF yüklenemedi'); }
    finally { setBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (editMode) {
      const f = firstName.trim(), l = lastName.trim(), p = phoneAuth.trim();
      if (!f || !l || !p) { setErr('Ad, soyad ve telefon zorunludur.'); return; }
      setErr(''); setBusy(true);
      try { const u = await updateMyProfile({ firstName: f, lastName: l, phone: p }); onDone?.(u); }
      catch (e2) { setErr(e2?.message || 'Kaydedilemedi'); }
      finally { setBusy(false); }
      return;
    }

    const f = firstName.trim(), l = lastName.trim(), p1 = phoneAuth.trim(), p2 = phoneRep.trim();
    if (!f || !l) { setErr('Yetkili ad ve soyad zorunludur.'); return; }
    if (p1.replace(/\D/g, '').length < 10) { setErr('Geçerli yetkili telefon girin.'); return; }
    if (p2.replace(/\D/g, '').length < 10) { setErr('Geçerli temsilci telefon girin.'); return; }
    if (!taxPath) { setErr('Vergi levhasını PDF olarak yükleyin.'); return; }
    setErr(''); setBusy(true);
    try {
      const u = await completeAgencySetup(uid, {
        companyName: company,
        contactFirstName: f,
        contactLastName: l,
        phoneAuthorized: p1,
        phoneRep: p2,
        taxPlatePath: taxPath,
      });
      onDone?.(u);
    } catch (e2) {
      setErr(e2?.message === 'incomplete' ? 'Tüm zorunlu alanları doldurun.' : (e2?.message || 'Kaydedilemedi'));
    } finally { setBusy(false); }
  };

  return (
    <div className={editMode ? 'modalOverlay' : 'center full loginBg'}>
      <div className="loginCard" style={editMode ? undefined : { maxWidth: 440 }}>
        <img src="/turquz-logo.png" alt="Turquz" className="loginLogo" onError={(ev) => { ev.target.style.display = 'none'; }} />
        <div className="loginKicker">{editMode ? 'BİLGİLERİ GÜNCELLE' : 'ACENTE KAYIT'}</div>
        <h1 className="loginTitle">{editMode ? 'Bilgilerinizi güncelleyin' : 'Kurulumu tamamlayın'}</h1>
        {!editMode ? (
          <p className="setupNote">CV havuzu için vergi levhası (PDF), yetkili ad/soyad ve iki telefon zorunludur.</p>
        ) : null}
        <form onSubmit={submit} className="loginForm">
          {!editMode ? (
            <>
              <label className="fieldLbl">Şirket / işletme adı (isteğe bağlı)</label>
              <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="ABC Turizm Ltd." />
            </>
          ) : null}
          <label className="fieldLbl">Yetkili ad *</label>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ad" required />
          <label className="fieldLbl">Yetkili soyad *</label>
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Soyad" required />
          <label className="fieldLbl">{editMode ? 'Telefon *' : 'Yetkili telefon *'}</label>
          <input className="input" type="tel" value={phoneAuth} onChange={(e) => setPhoneAuth(e.target.value)} placeholder="+90 5xx…" required />
          {!editMode ? (
            <>
              <label className="fieldLbl">Temsilci telefon *</label>
              <input className="input" type="tel" value={phoneRep} onChange={(e) => setPhoneRep(e.target.value)} placeholder="+90 5xx…" required />
              <label className="fieldLbl">Vergi levhası (PDF) *</label>
              <input className="input" type="file" accept="application/pdf" onChange={onTaxFile} />
              {taxPath ? <p className="setupNote">✓ {taxName || 'PDF yüklendi'}</p> : null}
            </>
          ) : null}
          {err ? <p className="loginErr">{err}</p> : null}
          <button className="goldBtn" type="submit" disabled={busy}>{busy ? '…' : (editMode ? 'Kaydet' : 'Kaydet ve Devam Et')}</button>
        </form>
        {editMode
          ? <button className="setupLogout" onClick={onCancel}>İptal</button>
          : <button className="setupLogout" onClick={() => signOut()}>Çıkış</button>}
      </div>
    </div>
  );
}
