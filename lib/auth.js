// lib/auth.js
// Supabase auth işlemleri için ince bir sarmalayıcı.
// Hatalar { data, error } biçiminde döner; ekran tarafında error.message gösterilir.
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { createSessionFromUrl, getOAuthRedirectTo, getPasswordResetRedirectTo } from './authDeepLink';

// Web / AuthSession popup kapanışı (native'de no-op).
WebBrowser.maybeCompleteAuthSession();

// E-posta + şifre ile KAYIT
// portal: 'candidate' | 'agency' — auth.users metadata; DB tetikleyicisi rolü bundan yazar.
export async function signUpWithEmail(email, password, { portal = 'candidate' } = {}) {
  const p = portal === 'agency' ? 'agency' : 'candidate';
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { portal: p } },
  });
  return { data, error };
}

// E-posta + şifre ile GİRİŞ
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  return { data, error };
}

/**
 * Google / Apple OAuth (Supabase + in-app tarayıcı).
 * Yeni kullanıcıda portal metadata OAuth ile gelmez → 0067 sonrası rol app'te
 * register_as_* ile yazılır. Dönüş: { session, error, cancelled }.
 */
export async function signInWithOAuth(provider) {
  const redirectTo = getOAuthRedirectTo();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      ...(provider === 'google'
        ? { queryParams: { prompt: 'select_account' } }
        : {}),
    },
  });
  if (error) return { session: null, error, cancelled: false };
  if (!data?.url) {
    return { session: null, error: new Error('oauth_no_url'), cancelled: false };
  }

  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success' || !res.url) {
    return { session: null, error: null, cancelled: true };
  }

  try {
    const result = await createSessionFromUrl(res.url);
    return { session: result?.session ?? null, error: null, cancelled: false };
  } catch (e) {
    return { session: null, error: e, cancelled: false };
  }
}

// ÇIKIŞ — önce bu cihazın push token'ını düş (hesap değişiminde yanlış push gelmesin).
export async function signOut() {
  try {
    const { unregisterPush } = await import('./push');
    await unregisterPush();
  } catch (e) {
    console.warn('Push temizliği:', e?.message);
  }
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Acentenin kendi ad/soyad/telefon bilgisini auth metadata'sına yazar (web ile aynı alanlar).
export async function updateMyProfile({ firstName, lastName, phone }) {
  const fullName = `${firstName} ${lastName}`.trim();
  const { data, error } = await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName, phone, full_name: fullName },
  });
  return { user: data?.user ?? null, error };
}

// ŞİFREMİ UNUTTUM — sıfırlama e-postası (deep link: turquz://reset-password)
export async function sendPasswordReset(email, redirectTo) {
  const to = redirectTo || getPasswordResetRedirectTo();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: to,
  });
  return { data, error };
}

// Recovery oturumundayken yeni şifre kaydet
export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  return { data, error };
}

// Mevcut oturumu getir (uygulama açılışında)
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session ?? null, error };
}

// Oturum değişimini dinle. callback(session, event)
// event örn: SIGNED_IN | SIGNED_OUT | PASSWORD_RECOVERY | TOKEN_REFRESHED
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event);
  });
  return data;
}
