import { useState } from 'react';
import { getRole, registerAsAgency, sendPasswordReset, signIn, signOut, signUp } from '../lib/api';
import { useLang } from '../i18n.jsx';

/** Sol panelde hafif dünya haritası filigranı — mockup’taki atmosphere. */
function BrandMapWatermark() {
  return (
    <svg className="authBrandMap" viewBox="0 0 800 500" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.15">
        <ellipse cx="400" cy="250" rx="280" ry="170" />
        <ellipse cx="400" cy="250" rx="200" ry="170" />
        <ellipse cx="400" cy="250" rx="120" ry="170" />
        <path d="M120 250h560M400 80v340" />
        <path d="M150 160c80 20 160 30 250 30s170-10 250-30" />
        <path d="M150 340c80-20 160-30 250-30s170 10 250 30" />
        <path d="M220 120c40 60 60 120 60 180s-20 120-60 180" />
        <path d="M580 120c-40 60-60 120-60 180s20 120 60 180" />
        <path d="M280 200c30-40 70-55 120-50 55 6 95 35 130 80" />
        <path d="M300 300c45 35 95 50 150 40 50-8 90-35 120-70" />
      </g>
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconEye({ off }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.9 9.9A3 3 0 0 0 14 14M10.7 5.5A10.5 10.5 0 0 1 12 5.3c5.2 0 9.2 3.5 10.7 6.7a11.4 11.4 0 0 1-4.1 4.6M6.1 6.1A11.3 11.3 0 0 0 1.3 12C2.8 15.2 6.8 18.7 12 18.7c1.3 0 2.5-.2 3.6-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12C4 8.8 7.8 5.3 12 5.3S20 8.8 21.5 12C20 15.2 16.2 18.7 12 18.7S4 15.2 2.5 12Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function Login({ loggedInButNotStaff, onLogout }) {
  const { t } = useLang();
  const [mode, setMode] = useState('signin'); // signin | signup | forgot
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [showPass, setShowPass] = useState(false);

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
    <div className="authShell">
      <aside className="authBrand">
        <BrandMapWatermark />
        <div className="authBrandVeil" aria-hidden="true" />
        <div className="authBrandGlow" aria-hidden="true" />
        <div className="authBrandInner">
          <div className="authBrandMark">
            <img src="/turquz-logo.png" alt="Turquz" className="authBrandLogo" />
            <p className="authBrandSlogan">{t('portal_slogan') || 'SINIRLARIN ÖTESİNDE BAŞLANGIÇLAR'}</p>
          </div>
          <h2 className="authBrandLead">
            {t('auth_panel_lead') || 'Personellerinizi seçin, görüntülü mülakatlarını yapın ve evrak alışverişini tek yerden yönetin.'}
          </h2>
          <p className="authBrandTrust">
            <svg className="authBrandShield" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9.5C7.5 20.5 4 17 4 12V6l8-3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            {t('auth_trust') || 'Güvenli bağlantı · KVKK uyumlu'}
          </p>
        </div>
        <div className="authBrandAccent" aria-hidden="true" />
      </aside>

      <main className="authMain">
        <div className="authPanel">
          <div className="authPanelHead">
            <p className="authPanelKicker">{t('auth_panel_kicker') || 'Acente paneli'}</p>
            <h1 className="authPanelTitle">{title}</h1>
            {mode === 'forgot' ? (
              <p className="authPanelSub">{t('auth_reset_desc')}</p>
            ) : null}
          </div>

          {loggedInButNotStaff ? (
            <>
              <p className="loginErr">Bu hesap acente/yönetici değil. Acente hesabıyla giriş yapın.</p>
              <button className="authCta" type="button" onClick={onLogout}>Çıkış</button>
            </>
          ) : (
            <>
              {mode !== 'forgot' ? (
                <div className="authTabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signin'}
                    className={`authTab ${mode === 'signin' ? 'on' : ''}`}
                    onClick={() => { setMode('signin'); setErr(''); setOk(''); }}
                  >
                    {t('auth_tab_signin') || 'Giriş'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signup'}
                    className={`authTab ${mode === 'signup' ? 'on' : ''}`}
                    onClick={() => { setMode('signup'); setErr(''); setOk(''); }}
                  >
                    {t('auth_tab_signup') || 'Kayıt'}
                  </button>
                </div>
              ) : null}

              <form onSubmit={submit} className="authForm">
                <label className="authLbl" htmlFor="auth-email">{t('auth_email') || 'E-posta'}</label>
                <div className="authInputWrap">
                  <span className="authInputIcon"><IconMail /></span>
                  <input
                    id="auth-email"
                    className="authInput hasIcon"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth_email_ph') || 'ornek@turquz.com'}
                    required
                  />
                </div>
                {mode !== 'forgot' ? (
                  <>
                    <label className="authLbl" htmlFor="auth-pass">{t('auth_password') || 'Şifre'}</label>
                    <div className="authInputWrap">
                      <span className="authInputIcon"><IconLock /></span>
                      <input
                        id="auth-pass"
                        className="authInput hasIcon hasTrail"
                        type={showPass ? 'text' : 'password'}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        className="authInputTrail"
                        onClick={() => setShowPass((v) => !v)}
                        aria-label={showPass ? 'Gizle' : 'Göster'}
                      >
                        <IconEye off={showPass} />
                      </button>
                    </div>
                  </>
                ) : null}
                {mode === 'signup' ? (
                  <>
                    <label className="authLbl" htmlFor="auth-pass2">{t('auth_password2') || 'Şifre tekrar'}</label>
                    <div className="authInputWrap">
                      <span className="authInputIcon"><IconLock /></span>
                      <input
                        id="auth-pass2"
                        className="authInput hasIcon"
                        type="password"
                        autoComplete="new-password"
                        value={pass2}
                        onChange={(e) => setPass2(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </>
                ) : null}
                {mode === 'signin' ? (
                  <button type="button" className="authLink" onClick={() => { setMode('forgot'); setErr(''); setOk(''); }}>
                    {t('auth_forgot') || 'Şifremi unuttum'}
                  </button>
                ) : null}
                {err ? <p className="loginErr" role="alert">{err}</p> : null}
                {ok ? <p className="authOk">{ok}</p> : null}
                <button className="authCta" type="submit" disabled={busy}>
                  {busy ? '…' : (
                    mode === 'forgot'
                      ? (t('auth_send_reset') || 'Sıfırlama Bağlantısı Gönder')
                      : mode === 'signup'
                        ? (t('auth_signup_btn') || t('auth_tab_signup') || 'Kayıt Ol')
                        : (t('auth_signin_btn') || t('auth_login') || 'Giriş Yap')
                  )}
                </button>
              </form>

              {mode === 'forgot' ? (
                <button type="button" className="authLinkCenter" onClick={() => { setMode('signin'); setErr(''); setOk(''); }}>
                  {t('auth_cancel') || 'Vazgeç'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
