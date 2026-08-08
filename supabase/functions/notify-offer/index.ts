// supabase/functions/notify-offer/index.ts
// Teklif akışı push: offer (acente->aday) | offer_accepted / offer_rejected (aday->acente).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { offerPushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const KINDS = ['offer', 'offer_accepted', 'offer_rejected'] as const;

const NATION_CODE: Record<string, string> = {
  'Türkiye': 'TR', 'Azerbaycan': 'AZ', 'Belarus': 'BY', 'Gürcistan': 'GE', 'Kazakistan': 'KZ',
  'Kırgızistan': 'KG', 'Özbekistan': 'UZ', 'Rusya': 'RU', 'Tayland': 'TH', 'Türkmenistan': 'TM',
  'Ukrayna': 'UA', 'Diğer': 'XX',
};
const codeOf = (nat?: string, reg?: number) =>
  (NATION_CODE[nat ?? ''] || 'XX') + (reg ? String(reg).padStart(4, '0') : '----');

function parseAgencyId(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw)) return null;
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const { candidateUserId, kind, agencyUserId } = await req.json().catch(() => ({}));
    if (!candidateUserId || !kind || !KINDS.includes(kind)) return json({ error: 'bad_request' }, 400);

    const admin = createClient(url, serviceKey);

    let recipientId: string | null = null;
    if (kind === 'offer') {
      recipientId = candidateUserId;
    } else {
      recipientId = parseAgencyId(agencyUserId);
      if (!recipientId) {
        const { data: st } = await admin
          .from('candidate_status')
          .select('accepted_by')
          .eq('user_id', candidateUserId)
          .maybeSingle();
        recipientId = parseAgencyId(st?.accepted_by);
      }
    }
    if (!recipientId) return json({ ok: true, skipped: 'no_recipient' });
    if (kind !== 'offer' && !(await recipientAllowsPush(admin, recipientId, 'general'))) {
      return json({ ok: true, skipped: 'prefs_off' });
    }

    const { data: prof } = await admin
      .from('profiles')
      .select('reg_no, data')
      .eq('user_id', candidateUserId)
      .maybeSingle();
    const code = prof ? codeOf(prof?.data?.nationality, prof?.reg_no) : '';

    const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', recipientId);
    const tokens = (toks ?? []) as PushTokenRow[];
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const toCandidate = kind === 'offer';
    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = offerPushText(kind, code, locale);
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: toCandidate ? 'calls' : 'default',
        ...(toCandidate ? { interruptionLevel: 'critical' } : {}),
        data: { kind, candidateUserId },
      };
    });

    const result = await sendExpoPush(messages);
    return json({ ok: true, sent: messages.length, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
