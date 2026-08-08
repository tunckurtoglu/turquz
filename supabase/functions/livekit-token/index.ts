// supabase/functions/livekit-token/index.ts
// Mülakat görüntülü görüşmesi için LiveKit erişim token'ı üretir.
// Deploy: supabase functions deploy livekit-token
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@2.9.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const REJOIN_GRACE_MS = 120_000;

function slotMs(iso: string): number {
  if (!iso) return NaN;
  const old = /^(\d{2})\.(\d{2})\.(\d{4})[ ](\d{2}):(\d{2})/.exec(String(iso));
  const dt = old
    ? new Date(Number(old[3]), Number(old[2]) - 1, Number(old[1]), Number(old[4]), Number(old[5]))
    : new Date(iso);
  return dt.getTime();
}

function minutesForPeerCount(n: number) {
  if (n >= 3) return 25;
  if (n === 2) return 20;
  return 10;
}

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
    let extraSecs = 0;
    let endsAt: number | null = null;

    if (groupId) {
      const { data: g } = await admin.from('interview_groups').select('created_by, status, slot').eq('id', groupId).maybeSingle();
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
      minutes = 24;
      const base = slotMs(g.slot);
      if (Number.isFinite(base)) {
        endsAt = base + minutes * 60_000;
        const now = Date.now();
        if (now > endsAt + REJOIN_GRACE_MS) return json({ error: 'call_ended' }, 409);
        if (now < base) return json({ error: 'too_early' }, 409);
      }
    } else {
      if (!candidateUserId) return json({ error: 'bad_request' }, 400);
      const { data: iv } = await admin
        .from('interviews')
        .select('*')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      if (!iv) return json({ error: 'no_interview' }, 404);
      if (iv.status !== 'scheduled' || !iv.selected_slot) return json({ error: 'not_scheduled' }, 409);
      const isParty = user.id === iv.user_id || user.id === iv.created_by;
      if (!isParty) return json({ error: 'forbidden' }, 403);
      const slotKey = String(iv.selected_slot).replace(/[^a-z0-9]/gi, '');
      room = `iv-${iv.created_by}-${slotKey}`;
      role = user.id === iv.user_id ? 'candidate' : 'agency';

      const { count } = await admin
        .from('interviews')
        .select('user_id', { count: 'exact', head: true })
        .eq('created_by', iv.created_by)
        .eq('status', 'scheduled')
        .eq('selected_slot', iv.selected_slot);
      minutes = minutesForPeerCount(count || 1);
      extraSecs = Number(iv.call_extra_secs) || 0;

      const base = slotMs(iv.selected_slot);
      if (!Number.isFinite(base)) return json({ error: 'bad_slot' }, 400);
      endsAt = base + minutes * 60_000 + extraSecs * 1000;
      const now = Date.now();
      if (now > endsAt + REJOIN_GRACE_MS) return json({ error: 'call_ended' }, 409);
      if (now < base) return json({ error: 'too_early' }, 409);
    }

    // Token: görüşme + birkaç uzatma + reconnect payı.
    const ttlMin = Math.max(45, minutes + Math.ceil(extraSecs / 60) + 30);
    const at = new AccessToken(lkKey, lkSecret, {
      identity: user.id,
      name: role,
      ttl: `${ttlMin}m`,
      metadata: JSON.stringify({ lang: lang || 'en', role }),
    });
    at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();

    return json({
      token,
      url: lkUrl,
      room,
      role,
      minutes,
      extraSecs,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
