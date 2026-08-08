// lib/auth.js
// Supabase auth işlemleri için ince bir sarmalayıcı.
// Hatalar { data, error } biçiminde döner; ekran tarafında error.message gösterilir.
import { supabase } from './supabase';
import { getPasswordResetRedirectTo } from './authDeepLink';

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

// ÇIKIŞ
export async function signOut() {
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
