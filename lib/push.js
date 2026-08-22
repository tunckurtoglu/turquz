// lib/push.js
// Expo push bildirimleri: cihaz token'ını kaydet + belge yüklemede karşı tarafı uyar.
// NOT: Uzak push yalnızca DEVELOPMENT BUILD'de çalışır (Expo Go SDK 53+ desteklemez).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { slotMs } from './interviews';

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
    sound: 'notify.wav', // app.json expo-notifications "sounds" ile paketlenir (assets/sounds/notify.wav)
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Belge Bildirimi (Zil)',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'notify.wav',
    vibrationPattern: [0, 700, 350, 700, 350, 700],
    enableVibrate: true,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// İzin iste + Expo push token al + yalnızca AKTİF kullanıcıya bağla.
// Aynı cihaz token'ı eski hesaplarda kalırsa push yanlış kişiye gider — claim ile tek sahiplik.
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
      const { error } = await supabase.rpc('claim_push_token', {
        p_token: token,
        p_platform: Platform.OS,
        p_locale: locale || null,
      });
      if (error) {
        // RPC henüz yoksa (migration bekleniyor) eski davranış + mümkünse kendi satırını yaz.
        console.warn('claim_push_token:', error.message);
        await supabase.from('push_tokens').upsert(
          { user_id: userId, token, platform: Platform.OS, locale: locale || null, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,token' },
        );
      }
    }
    return token;
  } catch (e) {
    console.warn('Push kaydı başarısız:', e?.message);
    return null;
  }
}

/** Çıkışta bu cihazın token'ını aktif kullanıcıdan kaldır — sonraki hesap eski push'ları almasın. */
export async function unregisterPush() {
  try {
    if (!Device.isDevice) return;
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const resp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = resp?.data;
    if (!token) return;
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) console.warn('Push token silinemedi:', error.message);
  } catch (e) {
    console.warn('Push çıkışı başarısız:', e?.message);
  }
}

// Belge adımı gönderildi: çoklu belge = tek bildirim (paket).
export async function notifyDocumentSubmit(candidateUserId, kinds) {
  if (!kinds?.length) return;
  const kind = kinds.length > 1 ? 'document_package' : kinds[0];
  await notifyDocument(candidateUserId, kind);
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

// Teklif: kind='offer' (acente->aday) | 'offer_accepted' | 'offer_rejected' (aday->acente).
export async function notifyOffer(candidateUserId, kind, agencyUserId) {
  try {
    await supabase.functions.invoke('notify-offer', { body: { candidateUserId, kind, agencyUserId } });
  } catch (e) {
    console.warn('Teklif bildirimi gönderilemedi:', e?.message);
  }
}

// Mülakat: proposed | scheduled | declined (declined için agencyUserId önerilir — satır silinmiş olabilir).
export async function notifyInterview(candidateUserId, kind, agencyUserId) {
  try {
    await supabase.functions.invoke('notify-interview', {
      body: { candidateUserId, kind, agencyUserId: agencyUserId || undefined },
    });
  } catch (e) {
    console.warn('Mülakat bildirimi gönderilemedi:', e?.message);
  }
}

/** 24s aday hatırlatma + 48s acente "cevap yok" / pasif taraması. */
export async function scanInterviewSla() {
  try {
    await supabase.functions.invoke('notify-interview-sla', { body: { scan: true } });
  } catch (e) {
    console.warn('Mülakat SLA taraması başarısız:', e?.message);
  }
}

// İlk belge paketi süresi doldu: acenteye tek seferlik bildirim (Edge Function idempotent).
export async function notifyDocsDeadline(candidateUserId) {
  try {
    await supabase.functions.invoke('notify-docs-deadline', { body: { candidateUserId } });
  } catch (e) {
    console.warn('Belge süresi bildirimi gönderilemedi:', e?.message);
  }
}

// Acente paneli açılışında süresi dolmuş adayları tara.
export async function scanDocsDeadline() {
  try {
    await supabase.functions.invoke('notify-docs-deadline', { body: { scan: true } });
  } catch (e) {
    console.warn('Belge süresi taraması başarısız:', e?.message);
  }
}

// Mülakat hatırlatmaları (24sa / 1sa / 15dk önce adaya push). scan=true: tüm vadesi gelenler.
export async function scanOps() {
  try {
    await supabase.functions.invoke('scan-ops', { body: { scan: true } });
  } catch (e) {
    console.warn('Operasyon taraması:', e?.message);
  }
}

export async function scanInterviewReminders() {
  try {
    await supabase.functions.invoke('notify-interview-reminders', { body: { scan: true } });
  } catch (e) {
    console.warn('Mülakat hatırlatma taraması başarısız:', e?.message);
  }
}

export async function scanArrivalsReminders() {
  try {
    await supabase.functions.invoke('notify-arrivals', { body: { scan: true } });
  } catch (e) {
    console.warn('Varış hatırlatma taraması başarısız:', e?.message);
  }
}

export async function checkInterviewReminders(candidateUserId) {
  if (!candidateUserId) return;
  try {
    await supabase.functions.invoke('notify-interview-reminders', { body: { candidateUserId } });
  } catch (e) {
    console.warn('Mülakat hatırlatması gönderilemedi:', e?.message);
  }
}

// Yerel cihaz hatırlatması KAPALI — çift bildirim olmasın diye yalnızca sunucu
// (notify-interview-reminders) gönderir. Eski planlanmış yerel bildirimleri temizler.
const REM_OFFSETS = [['24h', 24 * 3600 * 1000], ['15m', 15 * 60 * 1000], ['5m', 5 * 60 * 1000]];
export async function scheduleInterviewReminders(_slotISO, prefix, _texts) {
  await cancelInterviewReminders(prefix);
}

export async function cancelInterviewReminders(prefix) {
  try {
    for (const [k] of REM_OFFSETS) await Notifications.cancelScheduledNotificationAsync(`${prefix}-${k}`).catch(() => {});
  } catch (e) { /* yoksay */ }
}

const ACTIVITY_NUDGE_ID = 'turquz-daily-activity';

/**
 * Adaya günde bir yerel hatırlatma: app'e gir → last_seen güncellenir → havuzda öne çıkarsın.
 * hourLocal: yerel saat (varsayılan 11:00).
 */
export async function scheduleDailyActivityNudge(texts, hourLocal = 11) {
  try {
    if (!Device.isDevice) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.cancelScheduledNotificationAsync(ACTIVITY_NUDGE_ID).catch(() => {});
    const title = texts?.title || 'Turquz';
    const body = texts?.body || 'Bugün uygulamaya bir kez gir; profilin havuzda daha görünür olur.';
    const Daily = Notifications.SchedulableTriggerInputTypes?.DAILY;
    await Notifications.scheduleNotificationAsync({
      identifier: ACTIVITY_NUDGE_ID,
      content: {
        title,
        body,
        sound: 'notify.wav',
        data: { kind: 'activity_nudge' },
      },
      trigger: Daily
        ? { type: Daily, hour: hourLocal, minute: 0 }
        : { hour: hourLocal, minute: 0, repeats: true },
    });
  } catch (e) {
    console.warn('Günlük hatırlatma planlanamadı:', e?.message);
  }
}

export async function cancelDailyActivityNudge() {
  try {
    await Notifications.cancelScheduledNotificationAsync(ACTIVITY_NUDGE_ID);
  } catch (e) { /* yoksay */ }
}
