import { useEffect, useState } from 'react';
import { getRole, signIn, signOut } from '../lib/api';
import { clearRememberedLogin, loadRememberedLogin, saveRememberedLogin } from '../lib/rememberLogin';

export default function Login({ wrongRole, onLogout }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const saved = loadRememberedLogin();
    if (saved.remember) {
      setEmail(saved.email);
      setPass(saved.password);
      setRememberMe(true);
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const data = await signIn(email, pass);
      if (data?.session) {
        if (rememberMe) saveRememberedLogin({ email, password: pass });
        else clearRememberedLogin();
      }
      const role = await getRole(data.session.user.id);
      if (role !== 'admin') {
        await signOut();
        setErr('Bu panel yalnızca admin hesapları içindir.');
      }
    } catch (e2) {
      setErr(e2?.message || 'Giriş başarısız');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center full loginBg">
      <div className="loginCard">
        <img src="/turquz-logo.png" alt="Turquz" className="loginLogo" />
        <div className="loginKicker">ADMIN PANEL</div>
        <h1 className="loginTitle">Yönetim Girişi</h1>
        {wrongRole ? (
          <>
            <p className="loginErr">Oturum açık ama admin değil. Admin hesabıyla giriş yapın.</p>
            <button className="goldBtn" type="button" onClick={onLogout}>Çıkış</button>
          </>
        ) : (
          <form onSubmit={submit} className="loginForm">
            <label className="fieldLbl">E-posta</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            <label className="fieldLbl">Şifre</label>
            <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
            <label className="rememberLbl">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Beni hatırla
            </label>
            {err ? <p className="loginErr">{err}</p> : null}
            <button className="goldBtn" type="submit" disabled={busy}>{busy ? '…' : 'Giriş Yap'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
