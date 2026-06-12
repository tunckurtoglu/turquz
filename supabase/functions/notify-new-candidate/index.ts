// supabase/functions/notify-new-candidate/index.ts
// Havuza YENİ bir aday CV'si düştüğünde tüm acente/admin'lere normal push gönderir.
// Çağrı (istemci): supabase.functions.invoke('notify-new-candidate', { body: {} })
//   -> çağıran adayın kendisidir; alıcı = user_roles'ta agency/admin olan herkes.
// Deploy:  supabase functions deploy notify-new-candidate
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

    // Çağıranı doğrula (aday).
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(url, serviceKey);

    // Aday kodunu (varsa) bildirime ekle.
    const { data: prof } = await admin.from('profiles').select('reg_no, data').eq('user_id', user.id).maybeSingle();
    const code = prof ? codeOf(prof?.data?.nationality, prof?.reg_no) : '';

    // Tüm acente/admin kullanıcıları.
    const { data: staff } = await admin.from('user_roles').select('user_id').in('role', ['agency', 'admin']);
    const staffIds = (staff ?? []).map((r: { user_id: string }) => r.user_id);
    if (!staffIds.length) return json({ ok: true, skipped: 'no_staff' });

    // Onların push token'ları.
    const { data: toks } = await admin.from('push_tokens').select('token').in('user_id', staffIds);
    const tokens = (toks ?? []).map((t: { token: string }) => t.token).filter(Boolean);
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const messages = tokens.map((to) => ({
      to,
      title: '🆕 Yeni aday',
      body: code ? `Havuza yeni aday eklendi: ${code}` : 'Havuza yeni bir aday CV’si eklendi.',
      priority: 'high',
      sound: 'default',
      channelId: 'default',
      data: { kind: 'new_candidate', candidateUserId: user.id },
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
