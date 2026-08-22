// supabase/functions/scan-ops/index.ts
// Dakikalık tarama: boarding/işe başlama, mülakat, belge süresi, varış + kilit ekranı push.
// Cron: x-cron-secret veya service role. Yedek: giriş yapmış kullanıcı (uygulama açılışı).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authorizeOpsScan, SCAN_CORS, scanJson } from '../_shared/scanAuth.ts';
import {
  isLifecyclePushType,
  lifecyclePushIsAgency,
  lifecyclePushText,
  recipientAllowsPush,
  sendExpoPush,
  type PushTokenRow,
} from '../_shared/pushTexts.ts';

const LIFECYCLE_TYPES = [
  'boarding_check', 'boarding_no_response', 'boarding_confirmed', 'boarding_missed',
  'work_start_confirm', 'work_start_remind', 'employment_started', 'employment_end_remind',
  'flight_ticket_ready', 'flight_ticket_sent', 'transit_stalled',
  'employment_term_due', 'employment_term_remind', 'employment_term_stalled', 'employment_term_voted', 'employment_restored',
  'rating_required', 'rating_remind',
];

type Admin = ReturnType<typeof createClient>;

async function invokeFn(name: string, body: unknown): Promise<unknown> {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cron = Deno.env.get('CRON_SECRET') || '';
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      apikey: key,
      ...(cron ? { 'x-cron-secret': cron } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: `http_${res.status}` }));
  if (!res.ok) return { error: json?.error || `http_${res.status}` };
  return json;
}

async function pushLifecycleNotifs(admin: Admin): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: rows } = await admin
    .from('notifications')
    .select('id, user_id, type, ref_user, payload')
    .in('type', LIFECYCLE_TYPES)
    .gte('created_at', since)
    .limit(80);
  const pending = (rows || []).filter((n) => {
    if (!isLifecyclePushType(n.type)) return false;
    return String((n.payload as Record<string, unknown> | null)?.pushed || '') !== '1';
  });
  let sent = 0;
  for (const n of pending) {
    const payload = { ...((n.payload as Record<string, unknown>) || {}), pushed: '1' };
    const { data: claimed } = await admin
      .from('notifications')
      .update({ payload })
      .eq('id', n.id)
      .limit(1)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const type = n.type as string;
    if (lifecyclePushIsAgency(type) && !(await recipientAllowsPush(admin, n.user_id, 'general'))) continue;

    const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', n.user_id);
    const tokens = (toks || []) as PushTokenRow[];
    const candidateUserId = (n.payload as { candidateId?: string } | null)?.candidateId
      || (lifecyclePushIsAgency(type) ? n.ref_user : n.user_id);
    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const when = String((n.payload as { arriveAt?: string; when?: string } | null)?.arriveAt
        || (n.payload as { when?: string } | null)?.when
        || '').trim();
      const txt = lifecyclePushText(type, locale, when ? { when } : undefined);
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: type === 'boarding_check' ? 'high' : 'default',
        sound: 'notify.wav',
        channelId: 'default',
        data: {
          kind: type,
          candidateUserId,
          scrollToStep: type === 'flight_ticket_ready' ? 5 : undefined,
        },
      };
    });
    if (messages.length) {
      await sendExpoPush(messages);
      sent += 1;
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: SCAN_CORS });
  try {
    const auth = await authorizeOpsScan(req);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({}));
    const jobs = Array.isArray(body?.jobs) && body.jobs.length
      ? (body.jobs as string[])
      : ['lifecycle', 'lifecycle_push', 'interviews', 'sla', 'docs', 'arrivals'];
    const want = new Set(jobs);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const out: Record<string, unknown> = { ok: true, cron: auth.cron };

    if (want.has('lifecycle')) {
      const { data, error } = await admin.rpc('scan_employment_lifecycle');
      out.lifecycle = error ? { error: error.message } : data;
      const { data: missedRemind, error: mErr } = await admin.rpc('scan_boarding_missed_remind');
      out.boardingMissedRemind = mErr ? { error: mErr.message } : { count: missedRemind };
      const { data: ratings, error: rErr } = await admin.rpc('scan_pending_ratings');
      out.ratings = rErr ? { error: rErr.message } : ratings;
    }
    if (want.has('lifecycle_push')) {
      out.lifecyclePush = { sent: await pushLifecycleNotifs(admin) };
    }
    if (want.has('interviews')) {
      out.interviews = await invokeFn('notify-interview-reminders', { scan: true });
    }
    if (want.has('sla')) {
      out.sla = await invokeFn('notify-interview-sla', { scan: true });
    }
    if (want.has('docs')) {
      out.docs = await invokeFn('notify-docs-deadline', { scan: true });
    }
    if (want.has('arrivals')) {
      out.arrivals = await invokeFn('notify-arrivals', { scan: true });
    }
    return scanJson(out);
  } catch (e) {
    console.error('scan-ops', String((e as Error)?.message ?? e));
    return scanJson({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
