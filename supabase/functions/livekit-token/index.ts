// supabase/functions/livekit-token/index.ts
// Mülakat görüntülü görüşmesi için LiveKit erişim token'ı üretir.
// Yalnızca o mülakatın İKİ tarafı (aday + mülakatı kuran acente) odaya girebilir.
// Oda adı: "iv-<candidateUserId>". Çağrı: invoke('livekit-token', { body: { candidateUserId } })
// Gereken ENV (Supabase > Edge Functions > Secrets):
//   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL  (wss://...)
// Deploy: supabase functions deploy livekit-token
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@2.9.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lkKey = Deno.env.get('LIVEKIT_API_KEY');
    const lkSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const lkUrl = Deno.env.get('LIVEKIT_URL');
    if (!lkKey || !lkSecret || !lkUrl) return json({ error: 'livekit_not_configured' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const { candidateUserId, groupId, lang } = await req.json().catch(() => ({}));
    const admin = createClient(url, serviceKey);

    let room: string;
    let role: string;
    let minutes = 10;

    if (groupId) {
      // GRUP mülakatı: sahip (acente) veya davetli aday girebilir.
      const { data: g } = await admin.from('interview_groups').select('created_by, status').eq('id', groupId).maybeSingle();
      if (!g) return json({ error: 'no_group' }, 404);
      if (g.status !== 'scheduled') return json({ error: 'not_scheduled' }, 409);
      const isOwner = user.id === g.created_by;
      let isMember = false;
      if (!isOwner) {
        const { data: m } = await admin.from('interview_group_members')
          .select('status').eq('group_id', groupId).eq('candidate_user_id', user.id).maybeSingle();
        isMember = !!m && m.status !== 'declined';
      }
      if (!isOwner && !isMember) return json({ error: 'forbidden' }, 403);
      room = `grp-${groupId}`;
      role = isOwner ? 'agency' : 'candidate';
    } else {
      if (!candidateUserId) return json({ error: 'bad_request' }, 400);
      // Birleşik mülakat: oda (acente + seçilen slot)'a bağlı; aynı slotu seçen 1-3 aday aynı odada.
      const { data: iv } = await admin
        .from('interviews')
        .select('user_id, created_by, status, selected_slot')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      if (!iv) return json({ error: 'no_interview' }, 404);
      if (iv.status !== 'scheduled' || !iv.selected_slot) return json({ error: 'not_scheduled' }, 409);
      const isParty = user.id === iv.user_id || user.id === iv.created_by;
      if (!isParty) return json({ error: 'forbidden' }, 403);
      const slotKey = String(iv.selected_slot).replace(/[^a-z0-9]/gi, '');
      room = `iv-${iv.created_by}-${slotKey}`;
      role = user.id === iv.user_id ? 'candidate' : 'agency';

      // Süre: aynı acente+slot için seçen aday sayısına göre (1->10, 2->20, 3->25 dk).
      const { count } = await admin
        .from('interviews')
        .select('user_id', { count: 'exact', head: true })
        .eq('created_by', iv.created_by)
        .eq('status', 'scheduled')
        .eq('selected_slot', iv.selected_slot);
      const n = count || 1;
      minutes = n >= 3 ? 25 : n === 2 ? 20 : 10;
    }

    // metadata: çevirmen ajan her katılımcının dilini buradan okur.
    const at = new AccessToken(lkKey, lkSecret, { identity: user.id, name: role, ttl: '40m', metadata: JSON.stringify({ lang: lang || 'en', role }) });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();

    return json({ token, url: lkUrl, room, role, minutes });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
