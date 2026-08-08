// supabase/functions/notify-activity-nudge/index.ts
// 20sa+ app açmayan adaylara günlük hatırlatma (cron: günde 1).
// body: { scan: true }
// Yerel bildirim (cihaz) ana hatırlatıcıdır; bu fonksiyon yedek uzak push.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { activityNudgePushText, sendExpoPush, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const STALE_MS = 20 * 3600 * 1000;
const NUDGE_GAP_MS = 20 * 3600 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.scan) return json({ error: 'scan_required' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);

    const { data: rows, error } = await admin
      .from('profiles')
      .select('user_id, last_seen_at, activity_nudge_at')
      .order('last_seen_at', { ascending: true, nullsFirst: true })
      .limit(500);
    if (error) throw error;

    const now = Date.now();
    const stale = (rows || []).filter((r) => {
      const seen = r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0;
      const nudged = r.activity_nudge_at ? new Date(r.activity_nudge_at).getTime() : 0;
      const isStale = !seen || (now - seen) >= STALE_MS;
      const canNudge = !nudged || (now - nudged) >= NUDGE_GAP_MS;
      return isStale && canNudge;
    });
    if (!stale.length) return json({ ok: true, sent: 0 });

    const ids = stale.map((r) => r.user_id);
    const [{ data: statuses }, { data: roles }] = await Promise.all([
      admin.from('candidate_status').select('user_id, status').in('user_id', ids),
      admin.from('user_roles').select('user_id, role').in('user_id', ids),
    ]);
    // Aday = user_roles satırı yok VEYA role=candidate. Acente/admin asla.
    const skip = new Set<string>();
    (statuses || []).forEach((s) => { if (s.status === 'hired') skip.add(s.user_id); });
    (roles || []).forEach((r) => {
      if (r.role === 'agency' || r.role === 'admin') skip.add(r.user_id);
    });
    const targetIds = ids.filter((id) => !skip.has(id));
    if (!targetIds.length) return json({ ok: true, sent: 0 });

    const { data: toks } = await admin
      .from('push_tokens')
      .select('token, locale, user_id')
      .in('user_id', targetIds);
    const tokens = (toks || []) as (PushTokenRow & { user_id: string })[];
    if (!tokens.length) return json({ ok: true, sent: 0 });

    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = activityNudgePushText(locale);
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'default',
        sound: 'notify.wav',
        channelId: 'default',
        data: { kind: 'activity_nudge' },
      };
    });
    await sendExpoPush(messages);

    const nudgedUserIds = [...new Set(tokens.map((t) => t.user_id))];
    const iso = new Date().toISOString();
    await Promise.all(nudgedUserIds.map((uid) =>
      admin.from('profiles').update({ activity_nudge_at: iso }).eq('user_id', uid)
    ));

    return json({ ok: true, sent: messages.length, users: nudgedUserIds.length });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
