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

export async function unreadCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) { console.warn('Okunmamış sayısı alınamadı:', error.message); return 0; }
  return count || 0;
}

export async function markAllRead(userId) {
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) console.warn('Bildirimler okundu işaretlenemedi:', error.message);
}
