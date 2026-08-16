// lib/processChat.js — süreç sohbeti (ödeme sonrası acente ↔ aday)
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

export async function isChatUnlocked(candidateId) {
  if (!candidateId) return false;
  const { data, error } = await supabase.rpc('contract_chat_unlocked', { p_candidate: candidateId });
  if (error) { console.warn('chat unlock:', error.message); return false; }
  return !!data;
}

export async function openProcessChat(candidateId, lang) {
  return call({ action: 'open', candidateId, lang });
}

export async function listProcessMessages(candidateId, lang) {
  return call({ action: 'list', candidateId, lang });
}

export async function sendProcessMessage(candidateId, text, lang) {
  return call({ action: 'send', candidateId, text, lang });
}

export async function syncChatLang(lang) {
  try { await call({ action: 'sync_lang', lang }); } catch (e) { /* yoksay */ }
}

export function subscribeProcessMessages(chatId, onChange) {
  if (!chatId) return () => {};
  let timer = null;
  const fire = () => {
    // INSERT (orijinal) + kısa sonra UPDATE (çeviri) çift yüklemeyi yumuşat.
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try { onChange(); } catch (_) { /* */ }
    }, 280);
  };
  const ch = supabase
    .channel(`process_chat_${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'process_chat_messages', filter: `chat_id=eq.${chatId}` },
      fire,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'process_chat_messages', filter: `chat_id=eq.${chatId}` },
      fire,
    )
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    try { supabase.removeChannel(ch); } catch (_) { /* */ }
  };
}
