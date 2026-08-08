// supabase/functions/notify-new-candidate/index.ts
// Havuza yeni aday — tüm acente/admin'lere, her birinin dilinde.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { newCandidatePushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const NATION_CODE: Record<string, string> = {
  'Türkiye': 'TR', 'Azerbaycan': 'AZ', 'Belarus': 'BY', 'Gürcistan': 'GE', 'Kazakistan': 'KZ',
  'Kırgızistan': 'KG', 'Özbekistan': 'UZ', 'Rusya': 'RU', 'Tayland': 'TH', 'Türkmenistan': 'TM',
  'Ukrayna': 'UA', 'Diğer': 'XX',
};
const codeOf = (nat?: string, reg?: number) =>
  (NATION_CODE[nat ?? ''] || 'XX') + (reg ? String(reg).padStart(4, '0') : '----');

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

    const admin = createClient(url, serviceKey);

    const { data: prof } = await admin.from('profiles').select('reg_no, data').eq('user_id', user.id).maybeSingle();
    const code = prof ? codeOf(prof?.data?.nationality, prof?.reg_no) : '';

    const { data: staff } = await admin.from('user_roles').select('user_id').in('role', ['agency', 'admin']);
    const staffIds = (staff ?? []).map((r: { user_id: string }) => r.user_id);
    if (!staffIds.length) return json({ ok: true, skipped: 'no_staff' });

    const allowed: string[] = [];
    for (const id of staffIds) {
      if (await recipientAllowsPush(admin, id, 'general')) allowed.push(id);
    }
    if (!allowed.length) return json({ ok: true, skipped: 'prefs_off' });

    const { data: toks } = await admin.from('push_tokens').select('token, locale, user_id').in('user_id', allowed);
    const tokens = (toks ?? []) as PushTokenRow[];
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = newCandidatePushText(code, locale);
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: 'default',
        data: { kind: 'new_candidate', candidateUserId: user.id },
      };
    });

    const result = await sendExpoPush(messages);
    return json({ ok: true, sent: messages.length, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
