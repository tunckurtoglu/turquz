// lib/notifications.js
// Uygulama içi bildirimler (zil). Satırlar DB trigger'larıyla otomatik oluşur (bkz. 0022).
import { supabase } from './supabase';

export async function listNotifications(userId, limit = 40) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('Bildirimler okunamadı:', error.message); return []; }
  return data || [];
}

export async function unreadCount(userId, { excludeTypes = [] } = {}) {
  if (!userId) return 0;
  let q = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (excludeTypes.length) {
    q = q.not('type', 'in', `(${excludeTypes.map((t) => `"${t}"`).join(',')})`);
  }
  const { count, error } = await q;
  if (error) { console.warn('Okunmamış sayısı alınamadı:', error.message); return 0; }
  return count || 0;
}

export async function unreadChatCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .is('read_at', null);
  if (error) { console.warn('Okunmamış mesaj sayısı alınamadı:', error.message); return 0; }
  return count || 0;
}

export async function unreadAnnouncementCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'announcement')
    .is('read_at', null);
  if (error) { console.warn('Okunmamış duyuru sayısı alınamadı:', error.message); return 0; }
  return count || 0;
}

export async function listAnnouncementNotifications(userId, limit = 50) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'announcement')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('Duyurular okunamadı:', error.message); return []; }
  return data || [];
}

export async function markAnnouncementsRead(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'announcement')
    .is('read_at', null);
  if (error) console.warn('Duyurular okundu işaretlenemedi:', error.message);
}

export async function markAllRead(userId, { excludeTypes = [] } = {}) {
  if (!userId) return;
  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (excludeTypes.length) {
    q = q.not('type', 'in', `(${excludeTypes.map((t) => `"${t}"`).join(',')})`);
  }
  const { error } = await q;
  if (error) console.warn('Bildirimler okundu işaretlenemedi:', error.message);
}

export async function markChatMessagesRead(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .is('read_at', null);
  if (error) console.warn('Mesaj bildirimleri okundu işaretlenemedi:', error.message);
}

/** Belirli adayın süreç sohbeti bildirimlerini okundu yap (footer rozeti için). */
export async function markChatMessagesReadForCandidate(userId, candidateId) {
  if (!userId || !candidateId) return;
  const { data, error } = await supabase
    .from('notifications')
    .select('id, payload, ref_user')
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .is('read_at', null)
    .limit(120);
  if (error) { console.warn('Mesaj bildirimleri okunamadı:', error.message); return; }
  const ids = (data || [])
    .filter((n) => (n.payload?.candidateId || n.ref_user) === candidateId)
    .map((n) => n.id);
  if (!ids.length) return;
  const { error: upErr } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids);
  if (upErr) console.warn('Aday mesajları okundu işaretlenemedi:', upErr.message);
}
