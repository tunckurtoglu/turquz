// lib/authDeepLink.js — e-posta linklerinden (şifre sıfırlama / magic) oturum açma.
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from './supabase';

/** Supabase Auth → Additional Redirect URLs: turquz://**  ve  turquz://reset-password */
export function getPasswordResetRedirectTo() {
  return makeRedirectUri({ scheme: 'turquz', path: 'reset-password' });
}

/** OAuth dönüşü — Additional Redirect URLs: turquz://auth/callback  ve  turquz://** */
export function getOAuthRedirectTo() {
  return makeRedirectUri({ scheme: 'turquz', path: 'auth/callback' });
}

export function isAuthCallbackUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('access_token=')
    || url.includes('refresh_token=')
    || url.includes('code=')
    || url.includes('type=recovery')
    || url.includes('type%3Drecovery')
  );
}

/**
 * E-posta / OAuth redirect URL'inden session kur.
 * Implicit: access_token + refresh_token | PKCE: code
 * @returns {{ session, type } | null}
 */
export async function createSessionFromUrl(url) {
  if (!url) return null;
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  const code = params.code;
  const type = params.type || null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(String(code));
    if (error) throw error;
    return { session: data.session, type };
  }

  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: String(access_token),
    refresh_token: String(refresh_token),
  });
  if (error) throw error;
  return { session: data.session, type };
}

export async function getInitialAuthUrl() {
  return Linking.getInitialURL();
}

export function subscribeAuthUrls(handler) {
  const sub = Linking.addEventListener('url', ({ url }) => handler(url));
  return () => sub.remove();
}
