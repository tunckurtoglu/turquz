// lib/contractPortal.js
// Aday sözleşmeyi web portalında görüntüler; PDF indirme ödemeye bağlı.
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { CONTRACT_PORTAL_URL } from './config';

/** Oturum açmış aday için portal linki üretir / yeniler. */
export async function createContractPortalLink() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('not_signed_in');

  const { data, error } = await supabase.functions.invoke('contract-portal', {
    body: { action: 'create_link' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data; // { url, paid, paymentStatus }
}

/** Sözleşme portalını sistem tarayıcısında açar (SFSafariView / Chrome Custom Tab).
 *  lang: adayın app dili — portal UI aynı dilde gösterilir (?lang=). */
export async function openContractPortal(lang) {
  const { url, paid, paymentStatus } = await createContractPortalLink();
  let portal = url || `${CONTRACT_PORTAL_URL.replace(/\/$/, '')}/?t=missing`;
  if (lang) {
    try {
      const u = new URL(portal);
      u.searchParams.set('lang', String(lang).slice(0, 2).toLowerCase());
      portal = u.toString();
    } catch (_) { /* ignore */ }
  }
  await WebBrowser.openBrowserAsync(portal, {
    dismissButtonStyle: 'done',
    enableDefaultShareMenuItem: false,
    showTitle: true,
  });
  return { paid: !!paid, paymentStatus: paymentStatus || (paid ? 'paid' : 'unpaid') };
}
