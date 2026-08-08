import { supabase } from './supabase';

async function call(body) {
  const { data, error } = await supabase.functions.invoke('process-chat', { body });
  if (error) throw error;
  if (data?.error) {
    const err = new Error(data.error);
    err.code = data.error;
    throw err;
  }
  return data;
}

export async function listProcessMessages(candidateId, lang) {
  return call({ action: 'list', candidateId, lang });
}

export async function sendProcessMessage(candidateId, text, lang) {
  return call({ action: 'send', candidateId, text, lang });
}

export async function syncChatLang(lang) {
  try { await call({ action: 'sync_lang', lang }); } catch { /* ignore */ }
}

export function subscribeProcessMessages(chatId, onChange) {
  if (!chatId) return () => {};
  const ch = supabase
    .channel(`web_process_chat_${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'process_chat_messages', filter: `chat_id=eq.${chatId}` },
      () => { try { onChange(); } catch { /* */ } },
    )
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch { /* */ } };
}

export async function getAgencyNotifPrefs() {
  try {
    const d = await call({ action: 'prefs_get' });
    return {
      generalPush: d?.generalPush !== false,
      chatPush: d?.chatPush !== false,
      preferredLang: d?.preferredLang || null,
    };
  } catch {
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
