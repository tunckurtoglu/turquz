const KEY = 'turquz.rememberLogin.admin';

export function loadRememberedLogin() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { remember: false, email: '', password: '' };
    const o = JSON.parse(raw);
    const email = String(o?.email || '').trim();
    const password = String(o?.password || '');
    if (!email) return { remember: false, email: '', password: '' };
    return { remember: true, email, password };
  } catch {
    return { remember: false, email: '', password: '' };
  }
}

export function saveRememberedLogin({ email, password }) {
  const e = String(email || '').trim();
  if (!e) {
    clearRememberedLogin();
    return;
  }
  localStorage.setItem(KEY, JSON.stringify({ email: e, password: String(password || '') }));
}

export function clearRememberedLogin() {
  localStorage.removeItem(KEY);
}
