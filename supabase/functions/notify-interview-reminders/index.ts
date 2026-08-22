// supabase/functions/notify-interview-reminders/index.ts
// Planlanmış mülakatlardan 24sa / 15dk / 5dk önce aday + acenteye push (tek seferlik, idempotent).
// body: { scan: true } — tüm vadesi gelen hatırlatmaları işle (cron veya uygulama açılışı).
// body: { candidateUserId } — yalnızca o adayın mülakatını kontrol et.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { interviewReminderPushText, sendExpoPush, type PushTokenRow } from '../_shared/pushTexts.ts';
import { authorizeOpsScan, SCAN_CORS, scanJson } from '../_shared/scanAuth.ts';

const CORS = SCAN_CORS;
const json = scanJson;

type RemKind = '24h' | '15m' | '5m';
type AdminClient = ReturnType<typeof createClient>;

const REMINDERS: { kind: RemKind; offsetMs: number; col: string }[] = [
  { kind: '24h', offsetMs: 24 * 3600 * 1000, col: 'reminder_24h_sent_at' },
  { kind: '15m', offsetMs: 15 * 60 * 1000, col: 'reminder_15m_sent_at' },
  { kind: '5m', offsetMs: 5 * 60 * 1000, col: 'reminder_5m_sent_at' },
];
// Fire penceresi: yalnızca bu süre içinde push at. Daha eski vade sessizce "sent" işaretlenir
// (yakın saatli mülakatta 24sa+15dk+5dk patlamasını engeller).
const FIRE_GRACE: Record<RemKind, number> = {
  '24h': 12 * 3600 * 1000,
  '15m': 12 * 60 * 1000,
  '5m': 5 * 60 * 1000,
};

function parseSlot(iso: string): number | null {
  const old = /^(\d{2})\.(\d{2})\.(\d{4})[ ](\d{2}):(\d{2})/.exec(String(iso));
  const dt = old
    ? new Date(Number(old[3]), Number(old[2]) - 1, Number(old[1]), Number(old[4]), Number(old[5]))
    : new Date(iso);
  const t = dt.getTime();
  return isNaN(t) ? null : t;
}

async function pushToUsers(
  admin: AdminClient,
  userIds: string[],
  kind: RemKind,
  candidateUserId: string,
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  const { data: toks } = await admin.from('push_tokens').select('token, locale, user_id').in('user_id', ids);
  const tokens = (toks ?? []) as (PushTokenRow & { user_id?: string })[];
  if (!tokens.length) return;

  const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
    const txt = interviewReminderPushText(kind, locale);
    return {
      to,
      title: txt.title,
      body: txt.body,
      priority: 'high',
      sound: 'notify.wav',
      channelId: 'calls',
      interruptionLevel: 'critical',
      data: { kind: `interview_reminder_${kind}`, candidateUserId },
    };
  });
  await sendExpoPush(messages);
}

async function claimReminder(
  admin: AdminClient,
  candidateUserId: string,
  col: string,
): Promise<boolean> {
  const { data: claimed } = await admin
    .from('interviews')
    .update({ [col]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', candidateUserId)
    .eq('status', 'scheduled')
    .is(col, null)
    .select('user_id')
    .maybeSingle();
  return !!claimed;
}

async function sendReminder(
  admin: AdminClient,
  candidateUserId: string,
  agencyUserId: string | null,
  kind: RemKind,
  col: string,
): Promise<boolean> {
  const claimed = await claimReminder(admin, candidateUserId, col);
  if (!claimed) return false;

  await pushToUsers(admin, [candidateUserId, agencyUserId || ''], kind, candidateUserId);
  return true;
}

async function processInterview(admin: AdminClient, row: Record<string, unknown>): Promise<number> {
  const candidateUserId = row.user_id as string;
  const agencyUserId = (row.created_by as string) || null;
  const slotRaw = row.selected_slot as string;
  const slotMs = parseSlot(slotRaw);
  if (!slotMs) return 0;

  const now = Date.now();
  // Mülakat başladıktan sonra: kalan bayrakları sessizce kapat, push yok.
  if (now >= slotMs) {
    for (const { col } of REMINDERS) {
      if (!row[col]) await claimReminder(admin, candidateUserId, col);
    }
    return 0;
  }

  let sent = 0;
  for (const { kind, offsetMs, col } of REMINDERS) {
    if (row[col]) continue;
    const fireAt = slotMs - offsetMs;
    if (now < fireAt) continue;
    if (now <= fireAt + FIRE_GRACE[kind]) {
      const ok = await sendReminder(admin, candidateUserId, agencyUserId, kind, col);
      if (ok) sent += 1;
    } else {
      // Vadesi geçmiş (ör. yakın saatli mülakat) — push atma, tekrar denemesin.
      await claimReminder(admin, candidateUserId, col);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const auth = await authorizeOpsScan(req);
    if (auth instanceof Response) return auth;

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const { candidateUserId, scan } = body as { candidateUserId?: string; scan?: boolean };

    const cols = 'user_id, created_by, selected_slot, reminder_24h_sent_at, reminder_15m_sent_at, reminder_5m_sent_at';

    if (scan) {
      const { data: rows } = await admin
        .from('interviews')
        .select(cols)
        .eq('status', 'scheduled')
        .not('selected_slot', 'is', null);
      let sent = 0;
      for (const row of rows ?? []) sent += await processInterview(admin, row as Record<string, unknown>);
      return json({ ok: true, scanned: (rows ?? []).length, sent });
    }

    if (!candidateUserId) return json({ error: 'bad_request' }, 400);

    const isSelf = auth.userId === candidateUserId;
    if (!auth.cron && !isSelf) {
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', auth.userId).maybeSingle();
      const staff = roleRow?.role === 'agency' || roleRow?.role === 'admin';
      if (!staff) return json({ error: 'forbidden' }, 403);
    }

    const { data: row } = await admin
      .from('interviews')
      .select(cols)
      .eq('user_id', candidateUserId)
      .eq('status', 'scheduled')
      .maybeSingle();
    if (!row) return json({ ok: true, result: 'skipped' });

    const sent = await processInterview(admin, row as Record<string, unknown>);
    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
