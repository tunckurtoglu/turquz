// lib/push.js
// Expo push bildirimleri: cihaz token'ını kaydet + belge yüklemede karşı tarafı uyar.
// NOT: Uzak push yalnızca DEVELOPMENT BUILD'de çalışır (Expo Go SDK 53+ desteklemez).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Uygulama açıkken bildirim gelince banner + ses göster.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android bildirim kanalları: 'calls' = yüksek sesli ZİL (aday tarafı), 'default' = normal (acente).
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Bildirimler',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Belge Bildirimi (Zil)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'ring.wav', // android raw kaynağı (app.json expo-notifications sounds ile paketlenir)
    vibrationPattern: [0, 700, 350, 700, 350, 700],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// İzin iste + Expo push token al + push_tokens'a yaz. Build dışında / izinsizde null döner.
export async function registerForPush(userId, locale) {
  try {
    if (!Device.isDevice) return null; // emülatör/simülatör push alamaz
    await ensureChannels();

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const resp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = resp?.data;
    if (token && userId) {
      await supabase.from('push_tokens').upsert(
        { user_id: userId, token, platform: Platform.OS, locale: locale || null, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' },
      );
    }
    return token;
  } catch (e) {
    console.warn('Push kaydı başarısız:', e?.message);
    return null;
  }
}

// Belge yüklenince karşı tarafa bildirim (Edge Function karar verir: zilli mi normal mi).
export async function notifyDocument(candidateUserId, kind) {
  try {
    await supabase.functions.invoke('notify-document', { body: { candidateUserId, kind } });
  } catch (e) {
    console.warn('Bildirim gönderilemedi:', e?.message);
  }
}

// Havuza yeni aday CV'si düşünce tüm acente/admin'lere bildirim (yalnızca ilk oluşturmada çağır).
export async function notifyNewCandidate() {
  try {
    await supabase.functions.invoke('notify-new-candidate', { body: {} });
  } catch (e) {
    console.warn('Yeni aday bildirimi gönderilemedi:', e?.message);
  }
}

// Mülakat: kind='proposed' (acente->aday) | 'scheduled' (aday->acente).
export async function notifyInterview(candidateUserId, kind) {
  try {
    await supabase.functions.invoke('notify-interview', { body: { candidateUserId, kind } });
  } catch (e) {
    console.warn('Mülakat bildirimi gönderilemedi:', e?.message);
  }
}

// Mülakattan 24sa / 1sa / 10dk önce CİHAZDA yerel hatırlatma kur (sunucu gerekmez).
// prefix benzersiz olmalı (aday: 'ivrem-cand', acente: 'ivrem-ag-<adayId>'). texts: { title, '24h','1h','10m' }.
const REM_OFFSETS = [['24h', 24 * 3600 * 1000], ['1h', 3600 * 1000], ['10m', 10 * 60 * 1000]];
export async function scheduleInterviewReminders(slotISO, prefix, texts) {
  try {
    const base = new Date(slotISO).getTime();
    if (isNaN(base)) return;
    const DATE = Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date';
    for (const [k, ms] of REM_OFFSETS) {
      const id = `${prefix}-${k}`;
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      const fire = base - ms;
      if (fire > Date.now() + 5000) {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title: texts.title, body: texts[k], sound: 'default' },
          trigger: { type: DATE, date: new Date(fire) },
        });
      }
    }
  } catch (e) {
    console.warn('Mülakat hatırlatması kurulamadı:', e?.message);
  }
}

export async function cancelInterviewReminders(prefix) {
  try {
    for (const [k] of REM_OFFSETS) await Notifications.cancelScheduledNotificationAsync(`${prefix}-${k}`).catch(() => {});
  } catch (e) { /* yoksay */ }
}
