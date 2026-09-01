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

const AGENCY_KINDS = ['contract_unsigned', 'flight_ticket', 'pickup', 'agency_doc_retracted', 'agency_doc_updated', 'flight_ticket_updated', 'success_certificate'];

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

    let when = '';
    if (kind === 'flight_ticket') {
      const { data: fl } = await admin.from('flights').select('arrive_at').eq('user_id', candidateUserId).maybeSingle();
      when = String(fl?.arrive_at || '').trim();
    }

    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = docPushText(kind, byAgency, locale, { when });
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: byAgency ? 'calls' : 'default',
        ...(byAgency ? { interruptionLevel: 'critical' } : {}),
        data: { kind, candidateUserId, scrollToStep: kind === 'pickup' ? 6 : kind === 'flight_ticket' ? 5 : kind === 'success_certificate' ? 9 : undefined },
      };
    });

    const result = await sendExpoPush(messages);

    if (kind === 'flight_ticket') {
      const { data: n } = await admin
        .from('notifications')
        .select('id, payload')
        .eq('user_id', recipientId)
        .eq('type', 'flight_ticket_ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (n?.id) {
        const prev = (n.payload && typeof n.payload === 'object') ? n.payload as Record<string, unknown> : {};
        await admin.from('notifications').update({
          payload: { ...prev, arriveAt: when || prev.arriveAt || null, pushed: '1' },
        }).eq('id', n.id);
      }
    }

    return json({ ok: true, sent: messages.length, result });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
