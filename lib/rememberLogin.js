// Giriş formu için e-posta + şifre (bu cihaz). Oturum değil; çıkış sonrası formu doldurur.
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (portal) => `turquz.rememberLogin.${portal || 'candidate'}`;

export async function loadRememberedLogin(portal) {
  try {
    const raw = await AsyncStorage.getItem(key(portal));
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

export async function saveRememberedLogin(portal, { email, password }) {
  const e = String(email || '').trim();
  if (!e) return clearRememberedLogin(portal);
  await AsyncStorage.setItem(key(portal), JSON.stringify({ email: e, password: String(password || '') }));
}

export async function clearRememberedLogin(portal) {
  await AsyncStorage.removeItem(key(portal));
}
