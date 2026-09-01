import { useEffect, useState } from 'react';
import {
  completeAgencySetup, getAgencyProfile, getAgencyTaxPlateUrl, saveAgencyTaxPlate, signOut,
  updateAgencyCompanyName, updateMyProfile, uploadAgencyTaxPlate,
} from '../lib/api';
import { useLang } from '../i18n.jsx';

// Zorunlu kapı (onCancel yok) veya panelde "Bilgileri Güncelle" (onCancel var — hafif form).
export default function AgencySetup({ user, onDone, onCancel }) {
  const { t } = useLang();
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
    if (!uid) return;
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
    if (file.type !== 'application/pdf') { setErr(t('agency_tax_pdf_only')); return; }
    setErr(''); setBusy(true);
    try {
      const path = editMode
        ? await saveAgencyTaxPlate(uid, file)
        : await uploadAgencyTaxPlate(uid, file);
      setTaxPath(path);
      setTaxName(file.name || 'vergi_levhasi.pdf');
    } catch (e2) { setErr(e2?.message || t('agency_setup_err_pdf')); }
    finally { setBusy(false); }
  };

  const onTaxView = async () => {
    setErr(''); setBusy(true);
    try {
      const url = await getAgencyTaxPlateUrl(uid);
      if (!url) { setErr(t('agency_tax_missing')); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e2) { setErr(e2?.message || t('open_failed')); }
    finally { setBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (editMode) {
      const f = firstName.trim(), l = lastName.trim(), p = phoneAuth.trim(), c = company.trim();
      if (!c || !f || !l || !p) { setErr(t('agency_setup_err_incomplete')); return; }
      setErr(''); setBusy(true);
      try {
        const [u] = await Promise.all([
          updateMyProfile({ firstName: f, lastName: l, phone: p }),
          updateAgencyCompanyName(uid, c),
        ]);
        onDone?.(u);
      }
      catch (e2) { setErr(e2?.message || t('agency_setup_err_save')); }
      finally { setBusy(false); }
      return;
    }

    const f = firstName.trim(), l = lastName.trim(), p1 = phoneAuth.trim(), p2 = phoneRep.trim(), c = company.trim();
    if (!c) { setErr(t('agency_setup_err_incomplete')); return; }
    if (!f || !l) { setErr(t('agency_setup_err_name')); return; }
    if (p1.replace(/\D/g, '').length < 10) { setErr(t('agency_setup_err_phone_auth')); return; }
    if (p2.replace(/\D/g, '').length < 10) { setErr(t('agency_setup_err_phone_rep')); return; }
    if (!taxPath) { setErr(t('agency_setup_err_tax')); return; }
    setErr(''); setBusy(true);
    try {
      const u = await completeAgencySetup(uid, {
        companyName: c,
        contactFirstName: f,
        contactLastName: l,
        phoneAuthorized: p1,
        phoneRep: p2,
        taxPlatePath: taxPath,
      });
      onDone?.(u);
    } catch (e2) {
      setErr(e2?.message === 'incomplete' ? t('agency_setup_err_incomplete') : (e2?.message || t('agency_setup_err_save')));
    } finally { setBusy(false); }
  };

  return (
    <div className={editMode ? 'modalOverlay' : 'center full loginBg'}>
      <div className="loginCard" style={editMode ? undefined : { maxWidth: 440 }}>
        <img src="/turquz-logo.png" alt="Turquz" className="loginLogo" onError={(ev) => { ev.target.style.display = 'none'; }} />
        <div className="loginKicker">{editMode ? t('agency_setup_update_kicker') : t('agency_setup_kicker')}</div>
        <h1 className="loginTitle">{editMode ? t('agency_setup_update_title') : t('agency_setup_title')}</h1>
        {!editMode ? (
          <p className="setupNote">{t('agency_setup_note')}</p>
        ) : null}
        <form onSubmit={submit} className="loginForm">
          <label className="fieldLbl">{t('agency_company_name')} *</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('agency_company_ph')} required />
          <label className="fieldLbl">{editMode ? `${t('f_firstName')} *` : `${t('agency_setup_auth_first')} *`}</label>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('f_firstName')} required />
          <label className="fieldLbl">{editMode ? `${t('f_lastName')} *` : `${t('agency_setup_auth_last')} *`}</label>
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('f_lastName')} required />
          <label className="fieldLbl">{editMode ? `${t('f_phone')} *` : `${t('agency_setup_auth_phone')} *`}</label>
          <input className="input" type="tel" value={phoneAuth} onChange={(e) => setPhoneAuth(e.target.value)} placeholder="+90 5xx…" required />
          {!editMode ? (
            <>
              <label className="fieldLbl">{t('agency_setup_rep_phone')} *</label>
              <input className="input" type="tel" value={phoneRep} onChange={(e) => setPhoneRep(e.target.value)} placeholder="+90 5xx…" required />
            </>
          ) : null}
          <label className="fieldLbl">{t('agency_setup_tax_lbl')} {!editMode ? '*' : ''}</label>
          <p className="ecTaxStatus">
            {taxPath ? (t('agency_tax_ready') || 'PDF yüklü') : (t('agency_tax_missing') || 'Henüz yüklenmedi')}
          </p>
          <div className="ecTaxActions">
            {taxPath ? (
              <button type="button" className="ecTaxGhost" onClick={onTaxView} disabled={busy}>
                {t('agency_tax_view') || 'Görüntüle'}
              </button>
            ) : null}
            <label className={`ecTaxUpload ${busy ? 'busy' : ''}`}>
              {busy ? '…' : (taxPath
                ? (t('agency_tax_replace') || 'Yeniden yükle')
                : (t('agency_tax_upload') || 'PDF yükle'))}
              <input className="input" type="file" accept="application/pdf" hidden onChange={onTaxFile} disabled={busy} />
            </label>
          </div>
          {taxPath ? <p className="setupNote">✓ {taxName || t('agency_setup_pdf_ok')}</p> : null}
          {err ? <p className="loginErr">{err}</p> : null}
          <button className="goldBtn" type="submit" disabled={busy}>{busy ? '…' : (editMode ? t('save') : t('agency_setup_save'))}</button>
        </form>
        {editMode
          ? <button className="setupLogout" onClick={onCancel}>{t('agency_cancel')}</button>
          : <button className="setupLogout" onClick={() => signOut()}>{t('set_logout')}</button>}
      </div>
    </div>
  );
}
