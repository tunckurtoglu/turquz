const key = (portal) => `turquz.rememberLogin.${portal || 'agency'}`;

export function loadRememberedLogin(portal) {
  try {
    const raw = localStorage.getItem(key(portal));
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

export function saveRememberedLogin(portal, { email, password }) {
  const e = String(email || '').trim();
  if (!e) {
    clearRememberedLogin(portal);
    return;
  }
  localStorage.setItem(key(portal), JSON.stringify({ email: e, password: String(password || '') }));
}

export function clearRememberedLogin(portal) {
  localStorage.removeItem(key(portal));
}
