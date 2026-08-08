import { useState } from 'react';
import { signOut, updatePassword } from '../lib/api';
import { useLang } from '../i18n.jsx';

export default function ResetPassword({ onDone }) {
  const { t } = useLang();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (pass.length < 6) { setErr(t('auth_err_pass_short') || 'Şifre en az 6 karakter'); return; }
    if (pass !== pass2) { setErr(t('auth_err_pass_match') || 'Şifreler eşleşmiyor'); return; }
    setBusy(true);
    try {
      await updatePassword(pass);
      setOk(t('auth_password_updated') || 'Şifren güncellendi.');
      onDone?.();
    } catch (e2) {
      setErr(e2?.message || 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center full loginBg">
      <div className="loginCard">
        <img src="/turquz-logo.png" alt="Turquz" className="loginLogo" onError={(ev) => { ev.target.style.display = 'none'; }} />
        <div className="loginKicker">{t('auth_reset_title') || 'ŞİFRE SIFIRLAMA'}</div>
        <h1 className="loginTitle">{t('auth_new_password_title') || 'Yeni şifre belirle'}</h1>
        <p className="setupNote">{t('auth_new_password_desc') || 'Hesabın için yeni bir şifre gir.'}</p>
        <form onSubmit={submit} className="loginForm">
          <label className="fieldLbl">{t('auth_new_password') || 'Yeni şifre'}</label>
          <input className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
          <label className="fieldLbl">{t('auth_new_password2') || 'Yeni şifre (tekrar)'}</label>
          <input className="input" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} required />
          {err ? <p className="loginErr">{err}</p> : null}
          {ok ? <p className="setupNote">{ok}</p> : null}
          <button className="goldBtn" type="submit" disabled={busy}>{busy ? '…' : (t('auth_save_password') || 'Şifreyi Kaydet')}</button>
        </form>
        <button className="setupLogout" type="button" onClick={() => signOut()}>{t('auth_cancel') || 'Vazgeç'}</button>
      </div>
    </div>
  );
}
