// lib/agencyNotifPrefs.js — acente genel / mesaj push tercihleri
import { supabase } from './supabase';

async function call(body) {
  const { data, error } = await supabase.functions.invoke('process-chat', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getAgencyNotifPrefs() {
  try {
    const d = await call({ action: 'prefs_get' });
    return {
      generalPush: d?.generalPush !== false,
      chatPush: d?.chatPush !== false,
      preferredLang: d?.preferredLang || null,
    };
  } catch (e) {
    console.warn('notif prefs get:', e?.message);
    return { generalPush: true, chatPush: true, preferredLang: null };
  }
}

export async function setAgencyNotifPrefs(patch) {
  return call({
    action: 'prefs_set',
    generalPush: patch.generalPush,
    chatPush: patch.chatPush,
    preferredLang: patch.preferredLang,
  });
}
