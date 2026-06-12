// supabase/functions/notify-interview/index.ts
// Mülakat planlama bildirimi.
//   kind='proposed'  -> acente slot önerdi -> ADAYI uyar.
//   kind='scheduled' -> aday slot seçti    -> ACENTEYİ (created_by) uyar.
// Çağrı: supabase.functions.invoke('notify-interview', { body: { candidateUserId, kind } })
// Deploy: supabase functions deploy notify-interview
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TEXT: Record<string, { title: string; body: string }> = {
  proposed: { title: '🎥 Mülakat zamanı seç', body: 'Acenten görüntülü mülakat için saatler önerdi. Uygun olanı seç.' },
  scheduled: { title: '🎥 Mülakat planlandı', body: 'Aday mülakat saatini seçti.' },
};

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
    if (!candidateUserId || !kind || !TEXT[kind]) return json({ error: 'bad_request' }, 400);

    const admin = createClient(url, serviceKey);

    // Alıcı: proposed -> aday; scheduled -> mülakatı kuran acente.
    let recipientId: string | null = candidateUserId;
    if (kind === 'scheduled') {
      const { data: iv } = await admin.from('interviews').select('created_by').eq('user_id', candidateUserId).maybeSingle();
      recipientId = iv?.created_by ?? null;
    }
    if (!recipientId) return json({ ok: true, skipped: 'no_recipient' });

    const { data: toks } = await admin.from('push_tokens').select('token').eq('user_id', recipientId);
    const tokens = (toks ?? []).map((t: { token: string }) => t.token).filter(Boolean);
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const txt = TEXT[kind];
    const messages = tokens.map((to) => ({
      to, title: txt.title, body: txt.body, priority: 'high', sound: 'default', channelId: 'default',
      data: { kind: `interview_${kind}`, candidateUserId },
    }));
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await resp.json().catch(() => null);
    return json({ ok: true, sent: tokens.length, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
