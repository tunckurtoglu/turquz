// supabase/functions/notify-arrivals/index.ts
// Bugün / yarın varış hatırlatması (acente). Uygulama açılışında scan=true.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { arrivalPushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';
import { authorizeOpsScan, SCAN_CORS, scanJson } from '../_shared/scanAuth.ts';

const CORS = SCAN_CORS;
const json = scanJson;

const NATION_CODE: Record<string, string> = {
  Türkiye: 'TR', Azerbaycan: 'AZ', Belarus: 'BY', Gürcistan: 'GE', Kazakistan: 'KZ',
  Kırgızistan: 'KG', Özbekistan: 'UZ', Rusya: 'RU', Tayland: 'TH', Türkmenistan: 'TM',
  Ukrayna: 'UA', Diğer: 'XX',
};
const codeOf = (nat?: string, reg?: number) =>
  (NATION_CODE[nat ?? ''] || 'XX') + (reg ? String(reg).padStart(4, '0') : '----');

type AdminClient = ReturnType<typeof createClient>;

function parseArriveYmd(s?: string | null): { ymd: string; when: string } | null {
  if (!s) return null;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/.exec(String(s).trim());
  if (!m) return null;
  const d = String(m[1]).padStart(2, '0');
  const mo = String(m[2]).padStart(2, '0');
  const y = m[3];
  const time = m[4] != null ? `${String(m[4]).padStart(2, '0')}:${m[5]}` : '';
  return { ymd: `${y}-${mo}-${d}`, when: time ? `${d}.${mo}.${y} ${time}` : `${d}.${mo}.${y}` };
}

function istanbulYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
}

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

async function alreadySent(
  admin: AdminClient,
  agencyId: string,
  candidateId: string,
  type: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  const { data } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', agencyId)
    .eq('type', type)
    .eq('ref_user', candidateId)
    .gte('created_at', since)
    .limit(1);
  return !!(data && data.length);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const auth = await authorizeOpsScan(req);
    if (auth instanceof Response) return auth;

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);
    const today = istanbulYmd();
    const tomorrow = addDaysYmd(today, 1);

    let statusQ = admin
      .from('candidate_status')
      .select('user_id, accepted_by, status')
      .in('status', ['hired', 'in_transit']);
    if (!auth.cron && auth.userId) statusQ = statusQ.eq('accepted_by', auth.userId);
    const { data: statuses } = await statusQ;
    const byCand = new Map((statuses || []).map((s) => [s.user_id as string, s]));
    const ids = [...byCand.keys()];
    if (!ids.length) return json({ ok: true, sent: 0 });

    const { data: flights } = await admin
      .from('flights')
      .select('user_id, arrive_at, pickup_name')
      .in('user_id', ids);

    let sent = 0;
    for (const f of flights || []) {
      const parsed = parseArriveYmd(f.arrive_at as string);
      if (!parsed) continue;
      const kind = parsed.ymd === today ? 'today' : parsed.ymd === tomorrow ? 'tomorrow' : null;
      if (!kind) continue;
      const st = byCand.get(f.user_id as string);
      const agencyId = String(st?.accepted_by || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agencyId)) continue;

      const type = kind === 'today' ? 'arrival_today' : 'arrival_tomorrow';
      if (await alreadySent(admin, agencyId, f.user_id as string, type)) continue;

      const { data: prof } = await admin
        .from('profiles')
        .select('reg_no, nationality, data')
        .eq('user_id', f.user_id)
        .maybeSingle();
      const code = codeOf(
        (prof as { nationality?: string; data?: { nationality?: string } } | null)?.nationality
          || (prof as { data?: { nationality?: string } } | null)?.data?.nationality,
        (prof as { reg_no?: number } | null)?.reg_no,
      );
      const missingDriver = !String(f.pickup_name || '').trim();

      await admin.from('notifications').insert({
        user_id: agencyId,
        type,
        ref_user: f.user_id,
        payload: {
          candidateId: f.user_id,
          arriveDate: parsed.ymd,
          when: parsed.when,
          code,
          missingDriver,
          openArrivals: true,
        },
      });

      if (await recipientAllowsPush(admin, agencyId, 'general')) {
        const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', agencyId);
        const tokens = (toks || []) as PushTokenRow[];
        const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
          const t = arrivalPushText(kind, { code, when: parsed.when, missingDriver }, locale);
          return {
            to,
            title: t.title,
            body: t.body,
            priority: 'high',
            sound: 'notify.wav',
            channelId: 'default',
            data: { kind: type, candidateUserId: f.user_id },
          };
        });
        if (messages.length) await sendExpoPush(messages);
      }
      sent += 1;
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error('notify-arrivals', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
