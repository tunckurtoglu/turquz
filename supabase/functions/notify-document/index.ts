// supabase/functions/notify-document/index.ts
// Belge yüklendiğinde karşı tarafa Expo push gönderir.
//   - Acente belgesi (contract_unsigned / flight_ticket) yüklendi  -> ADAYI "zilli" uyar.
//   - Aday belgesi yüklendi                                        -> ACENTEYİ normal uyar
//     (acente aynı anda onlarca bildirim alabileceği için çaldırmıyoruz).
//
// Çağrı (istemci): supabase.functions.invoke('notify-document', { body: { candidateUserId, kind } })
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY otomatik enjekte edilir.
// Deploy:  supabase functions deploy notify-document
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const AGENCY_KINDS = ['contract_unsigned', 'flight_ticket'];

// Bildirim metinleri (alıcıya göre). Şimdilik TR; alıcı diline göre genişletilebilir.
const TEXT = {
  ring: { title: '📄 Yeni belge — Acente', body: 'Acenten senin için bir belge yükledi. Hemen incele.' },
  normal: { title: '📄 Aday belge yükledi', body: 'Bir aday yeni belge yükledi.' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Çağıranı doğrula (yetkisiz çağrıyı engelle).
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const { candidateUserId, kind } = await req.json().catch(() => ({}));
    if (!candidateUserId || !kind) return json({ error: 'bad_request' }, 400);

    const admin = createClient(url, serviceKey);
    const byAgency = AGENCY_KINDS.includes(kind);

    // Alıcıyı belirle
    let recipientId: string | null = null;
    if (byAgency) {
      recipientId = candidateUserId; // adayı çaldır
    } else {
      const { data: st } = await admin
        .from('candidate_status')
        .select('accepted_by')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      recipientId = st?.accepted_by ?? null; // adayı kabul eden acente
    }
    if (!recipientId) return json({ ok: true, skipped: 'no_recipient' });

    // Alıcının token'ları
    const { data: toks } = await admin.from('push_tokens').select('token').eq('user_id', recipientId);
    const tokens = (toks ?? []).map((t: { token: string }) => t.token).filter(Boolean);
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const txt = byAgency ? TEXT.ring : TEXT.normal;
    const messages = tokens.map((to) => ({
      to,
      title: txt.title,
      body: txt.body,
      priority: 'high',
      sound: byAgency ? 'ring.wav' : 'default',     // iOS özel ses / Android default
      channelId: byAgency ? 'calls' : 'default',     // Android: zil kanalı vs normal
      ...(byAgency ? { interruptionLevel: 'critical' } : {}),
      data: { kind, candidateUserId },
    }));

    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await resp.json().catch(() => null);
    return json({ ok: true, sent: tokens.length, result });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
