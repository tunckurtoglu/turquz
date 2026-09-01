// supabase/functions/notify-docs-deadline/index.ts
// İlk belge (14g) veya konsolosluk ref (7g) süresi dolunca acenteye tek seferlik uyarı.
// body: { candidateUserId, scope?: 'docs'|'consulate'|'all' }
// body: { scan: true }
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { docsDeadlinePushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';
import { authorizeOpsScan, SCAN_CORS, scanJson } from '../_shared/scanAuth.ts';

const CORS = SCAN_CORS;
const json = scanJson;

const STEP1_KINDS = ['passport', 'diploma', 'criminal', 'health_report'];
const DOCS_DEADLINE_DAYS = 14;

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

function isPast(iso?: string | null, fallbackDays?: number, fromIso?: string | null): boolean {
  if (iso) return new Date(iso).getTime() < Date.now();
  if (fallbackDays != null && fromIso) {
    return new Date(fromIso).getTime() + fallbackDays * 24 * 3600 * 1000 < Date.now();
  }
  return false;
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

async function consulateComplete(admin: AdminClient, candidateUserId: string): Promise<boolean> {
  const { data } = await admin
    .from('user_documents')
    .select('kind')
    .eq('user_id', candidateUserId)
    .eq('kind', 'consulate_ref')
    .not('submitted_at', 'is', null)
    .limit(1);
  return !!(data && data.length);
}

async function notifyDocs(admin: AdminClient, candidateUserId: string): Promise<'sent' | 'skipped'> {
  const { data: st } = await admin
    .from('candidate_status')
    .select('status, accepted_at, accepted_by, docs_deadline_notified_at, docs_deadline_at')
    .eq('user_id', candidateUserId)
    .maybeSingle();

  if (!st || st.status !== 'accepted' || !st.accepted_at) return 'skipped';
  if (st.docs_deadline_notified_at) return 'skipped';
  if (!isPast(st.docs_deadline_at, DOCS_DEADLINE_DAYS, st.accepted_at)) return 'skipped';
  if (await step1Complete(admin, candidateUserId)) return 'skipped';

  const agencyRaw = st.accepted_by;
  if (!agencyRaw || !/^[0-9a-f-]{36}$/i.test(agencyRaw)) return 'skipped';

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
    user_id: agencyRaw,
    type: 'docs_deadline',
    ref_user: candidateUserId,
  });

  try {
    await admin.rpc('log_deadline_notified', { p_candidate: candidateUserId, p_scope: 'docs' });
  } catch { /* migration yoksa yoksay */ }

  if (!(await recipientAllowsPush(admin, agencyRaw, 'general'))) return 'sent';

  const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', agencyRaw);
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

async function notifyConsulate(admin: AdminClient, candidateUserId: string): Promise<'sent' | 'skipped'> {
  const { data: st } = await admin
    .from('candidate_status')
    .select('status, accepted_by, consulate_deadline_at, consulate_deadline_notified_at')
    .eq('user_id', candidateUserId)
    .maybeSingle();

  if (!st || st.status !== 'accepted') return 'skipped';
  if (!st.consulate_deadline_at || st.consulate_deadline_notified_at) return 'skipped';
  if (!isPast(st.consulate_deadline_at)) return 'skipped';
  if (await consulateComplete(admin, candidateUserId)) return 'skipped';

  const agencyRaw = st.accepted_by;
  if (!agencyRaw || !/^[0-9a-f-]{36}$/i.test(agencyRaw)) return 'skipped';

  const { data: claimed } = await admin
    .from('candidate_status')
    .update({ consulate_deadline_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', candidateUserId)
    .is('consulate_deadline_notified_at', null)
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
    user_id: agencyRaw,
    type: 'consulate_deadline',
    ref_user: candidateUserId,
  });

  try {
    await admin.rpc('log_deadline_notified', { p_candidate: candidateUserId, p_scope: 'consulate' });
  } catch { /* ignore */ }

  if (!(await recipientAllowsPush(admin, agencyRaw, 'general'))) return 'sent';

  const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', agencyRaw);
  const tokens = (toks ?? []) as PushTokenRow[];
  if (tokens.length) {
    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = docsDeadlinePushText(code, locale);
      return {
        to,
        title: txt.title,
        body: (locale || '').startsWith('en')
          ? `${code} — consulate reference deadline passed`
          : `${code} — konsolosluk referans süresi doldu`,
        priority: 'high',
        sound: 'notify.wav',
        channelId: 'default',
        data: { kind: 'consulate_deadline', candidateUserId },
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
    const { candidateUserId, scan, scope } = body as {
      candidateUserId?: string; scan?: boolean; scope?: string;
    };
    const want = (scope || 'all').toLowerCase();

    if (scan) {
      if (!staff && !auth.cron) return json({ error: 'forbidden' }, 403);
      const { data: roleRow } = auth.userId && !auth.cron
        ? await admin.from('user_roles').select('role').eq('user_id', auth.userId).maybeSingle()
        : { data: { role: 'admin' } };
      const isAdmin = auth.cron || roleRow?.role === 'admin';

      let sent = 0;
      let scanned = 0;

      if (want === 'all' || want === 'docs') {
        let q = admin
          .from('candidate_status')
          .select('user_id')
          .eq('status', 'accepted')
          .not('accepted_at', 'is', null)
          .is('docs_deadline_notified_at', null);
        if (!isAdmin && auth.userId) q = q.eq('accepted_by', auth.userId);
        const { data: rows } = await q;
        scanned += (rows ?? []).length;
        for (const row of rows ?? []) {
          if ((await notifyDocs(admin, row.user_id)) === 'sent') sent += 1;
        }
      }

      if (want === 'all' || want === 'consulate') {
        let q = admin
          .from('candidate_status')
          .select('user_id')
          .eq('status', 'accepted')
          .not('consulate_deadline_at', 'is', null)
          .is('consulate_deadline_notified_at', null);
        if (!isAdmin && auth.userId) q = q.eq('accepted_by', auth.userId);
        const { data: rows } = await q;
        scanned += (rows ?? []).length;
        for (const row of rows ?? []) {
          if ((await notifyConsulate(admin, row.user_id)) === 'sent') sent += 1;
        }
      }

      return json({ ok: true, scanned, sent });
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

    const results: Record<string, string> = {};
    if (want === 'all' || want === 'docs') results.docs = await notifyDocs(admin, candidateUserId);
    if (want === 'all' || want === 'consulate') results.consulate = await notifyConsulate(admin, candidateUserId);
    return json({ ok: true, results });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
