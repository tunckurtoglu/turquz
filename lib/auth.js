// lib/auth.js
// Supabase auth işlemleri için ince bir sarmalayıcı.
// Hatalar { data, error } biçiminde döner; ekran tarafında error.message gösterilir.
import { supabase } from './supabase';

// E-posta + şifre ile KAYIT
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
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

// ŞİFREMİ UNUTTUM — sıfırlama e-postası gönder.
// redirectTo: kullanıcı linke tıklayınca dönecek adres (deep link / web sayfası).
export async function sendPasswordReset(email, redirectTo) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo, // örn. 'turquz://reset' veya bir web sayfası; şimdilik boş geçilebilir
  });
  return { data, error };
}

// Mevcut oturumu getir (uygulama açılışında)
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data?.session ?? null, error };
}

// Oturum değişimini dinle (giriş/çıkış olunca tetiklenir).
// Dönen aboneliği bileşen kapanırken iptal et: sub.subscription.unsubscribe()
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data;
}
