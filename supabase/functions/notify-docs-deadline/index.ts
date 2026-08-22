// supabase/functions/notify-docs-deadline/index.ts
// İlk belge paketi (10 gün) süresi dolunca acenteye tek seferlik push + uygulama içi bildirim.
// body: { candidateUserId } — tek aday (aday kendi ekranından veya ilgili acente)
// body: { scan: true } — acentenin süreçteki adaylarını tara (panel açılışında)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { docsDeadlinePushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';
import { authorizeOpsScan, SCAN_CORS, scanJson } from '../_shared/scanAuth.ts';

const CORS = SCAN_CORS;
const json = scanJson;

const STEP1_KINDS = ['passport', 'diploma', 'criminal', 'health_report'];
const DEADLINE_DAYS = 10;

const NATION_CODE: Record<string, string> = {
  'Türkiye': 'TR', 'Azerbaycan': 'AZ', 'Belarus': 'BY', 'Gürcistan': 'GE', 'Kazakistan': 'KZ',
  'Kırgızistan': 'KG', 'Özbekistan': 'UZ', 'Rusya': 'RU', 'Tayland': 'TH', 'Türkmenistan': 'TM',
  'Ukrayna': 'UA', 'Diğer': 'XX',
};
const codeOf = (nat?: string, reg?: number) =>
  (NATION_CODE[nat ?? ''] || 'XX') + (reg ? String(reg).padStart(4, '0') : '----');

type AdminClient = ReturnType<typeof createClient>;

async function isStaff(admin: AdminClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role === 'agency' || data?.role === 'admin';
}

function isOverdue(st: { accepted_at?: string; docs_deadline_at?: string | null }): boolean {
  const end = st.docs_deadline_at
    ? new Date(st.docs_deadline_at)
    : new Date(new Date(st.accepted_at!).getTime() + DEADLINE_DAYS * 24 * 3600 * 1000);
  return end.getTime() < Date.now();
}

async function step1Complete(admin: AdminClient, candidateUserId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_documents')
    .select('kind')
    .eq('user_id', candidateUserId)
    .in('kind', STEP1_KINDS)
    .not('submitted_at', 'is', null);
  const done = new Set((data ?? []).map((r: { kind: string }) => r.kind));
  return STEP1_KINDS.every((k) => done.has(k));
}

async function notifyOne(
  admin: AdminClient,
  candidateUserId: string,
): Promise<'sent' | 'skipped'> {
  const { data: st } = await admin
    .from('candidate_status')
    .select('status, accepted_at, accepted_by, docs_deadline_notified_at, docs_deadline_at')
    .eq('user_id', candidateUserId)
    .maybeSingle();

  if (!st || st.status !== 'accepted' || !st.accepted_at) return 'skipped';
  if (st.docs_deadline_notified_at) return 'skipped';
  if (!isOverdue(st)) return 'skipped';
  if (await step1Complete(admin, candidateUserId)) return 'skipped';

  const agencyRaw = st.accepted_by;
  if (!agencyRaw || !/^[0-9a-f-]{36}$/i.test(agencyRaw)) return 'skipped';
  const agencyId = agencyRaw;

  // Tek seferlik: yarış koşulunda yalnızca ilk çağrı bildirim gönderir.
  const { data: claimed } = await admin
    .from('candidate_status')
    .update({ docs_deadline_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', candidateUserId)
    .is('docs_deadline_notified_at', null)
    .select('user_id')
    .maybeSingle();
  if (!claimed) return 'skipped';

  const { data: prof } = await admin
    .from('profiles')
    .select('reg_no, data')
    .eq('user_id', candidateUserId)
    .maybeSingle();
  const code = prof ? codeOf(prof?.data?.nationality, prof?.reg_no) : '';

  await admin.from('notifications').insert({
    user_id: agencyId,
    type: 'docs_deadline',
    ref_user: candidateUserId,
  });

  if (!(await recipientAllowsPush(admin, agencyId, 'general'))) return 'prefs_off';

  const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', agencyId);
  const tokens = (toks ?? []) as PushTokenRow[];
  if (tokens.length) {
    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = docsDeadlinePushText(code, locale);
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: 'default',
        data: { kind: 'docs_deadline', candidateUserId },
      };
    });
    await sendExpoPush(messages);
  }

  return 'sent';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const auth = await authorizeOpsScan(req);
    if (auth instanceof Response) return auth;

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);
    const staff = auth.cron || (auth.userId ? await isStaff(admin, auth.userId) : false);
    const body = await req.json().catch(() => ({}));
    const { candidateUserId, scan } = body as { candidateUserId?: string; scan?: boolean };

    if (scan) {
      if (!staff && !auth.cron) return json({ error: 'forbidden' }, 403);
      const { data: roleRow } = auth.userId && !auth.cron
        ? await admin.from('user_roles').select('role').eq('user_id', auth.userId).maybeSingle()
        : { data: { role: 'admin' } };
      const isAdmin = auth.cron || roleRow?.role === 'admin';
      let q = admin
        .from('candidate_status')
        .select('user_id')
        .eq('status', 'accepted')
        .not('accepted_at', 'is', null)
        .is('docs_deadline_notified_at', null);
      if (!isAdmin && auth.userId) q = q.eq('accepted_by', auth.userId);
      const { data: rows } = await q;
      let sent = 0;
      for (const row of rows ?? []) {
        const r = await notifyOne(admin, row.user_id);
        if (r === 'sent') sent += 1;
      }
      return json({ ok: true, scanned: (rows ?? []).length, sent });
    }

    if (!candidateUserId) return json({ error: 'bad_request' }, 400);

    const uid = auth.userId || '';
    const isCandidate = uid === candidateUserId;
    if (!auth.cron && !isCandidate && !staff) return json({ error: 'forbidden' }, 403);

    if (!auth.cron && staff && !isCandidate) {
      const { data: st } = await admin
        .from('candidate_status')
        .select('accepted_by')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', uid).maybeSingle();
      const isAdmin = roleRow?.role === 'admin';
      if (!isAdmin && st?.accepted_by !== uid) return json({ error: 'forbidden' }, 403);
    }

    const result = await notifyOne(admin, candidateUserId);
    return json({ ok: true, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
