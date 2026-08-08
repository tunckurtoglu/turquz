// supabase/functions/notify-document/index.ts
// Belge gönderildiğinde karşı tarafa Expo push (alıcının dilinde).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { docPushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const AGENCY_KINDS = ['contract_unsigned', 'flight_ticket', 'pickup'];

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

    const { candidateUserId, kind } = await req.json().catch(() => ({}));
    if (!candidateUserId || !kind) return json({ error: 'bad_request' }, 400);

    const admin = createClient(url, serviceKey);
    const byAgency = AGENCY_KINDS.includes(kind);

    let recipientId: string | null = null;
    if (byAgency) {
      recipientId = candidateUserId;
    } else {
      const { data: st } = await admin
        .from('candidate_status')
        .select('accepted_by')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      recipientId = st?.accepted_by ?? null;
    }
    if (!recipientId) return json({ ok: true, skipped: 'no_recipient' });
    if (!byAgency && !(await recipientAllowsPush(admin, recipientId, 'general'))) {
      return json({ ok: true, skipped: 'prefs_off' });
    }

    const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', recipientId);
    const tokens = (toks ?? []) as PushTokenRow[];
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = docPushText(kind, byAgency, locale);
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: byAgency ? 'calls' : 'default',
        ...(byAgency ? { interruptionLevel: 'critical' } : {}),
        data: { kind, candidateUserId },
      };
    });

    const result = await sendExpoPush(messages);
    return json({ ok: true, sent: messages.length, result });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
