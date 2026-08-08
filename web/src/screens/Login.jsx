import { useState } from 'react';
import { getRole, registerAsAgency, sendPasswordReset, signIn, signOut, signUp } from '../lib/api';
import { useLang } from '../i18n.jsx';

export default function Login({ loggedInButNotStaff, onLogout }) {
  const { t } = useLang();
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const finishAgency = async (session) => {
    try {
      await registerAsAgency();
    } catch (e) {
      if (String(e?.message || '').includes('already_candidate')) {
        await signOut();
        throw new Error('Bu e-posta aday hesabı. Acente için farklı e-posta kullanın.');
      }
      console.warn(e);
    }
    const role = await getRole(session.user.id);
    if (role !== 'agency' && role !== 'admin') {
      await signOut();
      throw new Error('Acente hesabı oluşturulamadı. Destek ile iletişime geçin.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(''); setBusy(true);
    try {
      if (mode === 'forgot') {
        if (!email.trim()) throw new Error(t('auth_err_email') || 'Geçerli bir e-posta gir.');
        await sendPasswordReset(email);
        setOk(t('auth_reset_sent') || 'Sıfırlama bağlantısı e-postana gönderildi.');
      } else if (mode === 'signup') {
        if (pass.length < 6) throw new Error(t('auth_err_pass_short') || 'Şifre en az 6 karakter olmalı');
        if (pass !== pass2) throw new Error(t('auth_err_pass_match') || 'Şifreler eşleşmiyor');
        const data = await signUp(email, pass, { portal: 'agency' });
        if (data?.session) await finishAgency(data.session);
        else setOk(t('auth_check_email') || 'E-posta onayınızı kontrol edin, ardından giriş yapın.');
      } else {
        const data = await signIn(email, pass);
        if (data?.session) await finishAgency(data.session);
      }
    } catch (e2) { setErr(e2?.message || 'İşlem başarısız'); }
    finally { setBusy(false); }
  };

  const title = mode === 'signup'
    ? (t('auth_tab_signup') || 'Kayıt Ol')
    : mode === 'forgot'
      ? (t('auth_reset_title') || 'Şifre Sıfırlama')
      : (t('auth_login') || t('auth_tab_signin') || 'Giriş Yap');

  return (
    <div className="center full loginBg">
      <div className="loginCard">
        <img src="/turquz-logo.png" alt="Turquz" className="loginLogo" onError={(ev) => { ev.target.style.display = 'none'; }} />
        <div className="loginKicker">ACENTE PANELİ</div>
        <h1 className="loginTitle">{title}</h1>

        {loggedInButNotStaff ? (
          <>
            <p className="loginErr">Bu hesap acente/yönetici değil. Acente hesabıyla giriş yapın.</p>
            <button className="goldBtn" onClick={onLogout}>Çıkış</button>
          </>
        ) : (
          <>
            {mode !== 'forgot' ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button type="button" className="ghostBtn" style={{ flex: 1, opacity: mode === 'signin' ? 1 : 0.55 }} onClick={() => { setMode('signin'); setErr(''); setOk(''); }}>Giriş</button>
                <button type="button" className="ghostBtn" style={{ flex: 1, opacity: mode === 'signup' ? 1 : 0.55 }} onClick={() => { setMode('signup'); setErr(''); setOk(''); }}>Kayıt</button>
              </div>
            ) : (
              <p className="setupNote">{t('auth_reset_desc') || 'E-posta adresini gir, sana sıfırlama bağlantısı gönderelim.'}</p>
            )}
            <form onSubmit={submit} className="loginForm">
              <label className="fieldLbl">{t('auth_email') || 'E-posta'}</label>
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="acente@..." required />
              {mode !== 'forgot' ? (
                <>
                  <label className="fieldLbl">{t('auth_password') || 'Şifre'}</label>
                  <input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" required />
                </>
              ) : null}
              {mode === 'signup' ? (
                <>
                  <label className="fieldLbl">Şifre tekrar</label>
                  <input className="input" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="••••••••" required />
                </>
              ) : null}
              {err ? <p className="loginErr">{err}</p> : null}
              {ok ? <p className="setupNote">{ok}</p> : null}
              <button className="goldBtn" type="submit" disabled={busy}>
                {busy ? '…' : (
                  mode === 'forgot'
                    ? (t('auth_send_reset') || 'Sıfırlama Bağlantısı Gönder')
                    : mode === 'signup'
                      ? (t('auth_tab_signup') || 'Kayıt Ol')
                      : (t('auth_login') || 'Giriş Yap')
                )}
              </button>
            </form>
            {mode === 'signin' ? (
              <button type="button" className="setupLogout" onClick={() => { setMode('forgot'); setErr(''); setOk(''); }}>
                {t('auth_forgot') || 'Şifremi unuttum'}
              </button>
            ) : null}
            {mode === 'forgot' ? (
              <button type="button" className="setupLogout" onClick={() => { setMode('signin'); setErr(''); setOk(''); }}>
                {t('auth_cancel') || 'Vazgeç'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
