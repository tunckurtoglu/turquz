// supabase/functions/notify-interview/index.ts
// Mülakat bildirimi — alıcının dilinde.
// scheduled: acenteye aday kodu + seçilen slot ile gider.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { interviewPushText, sendExpoPush, recipientAllowsPush, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const KINDS = ['proposed', 'scheduled', 'declined'] as const;

const NATION_CODE: Record<string, string> = {
  Türkiye: 'TR', Azerbaycan: 'AZ', Belarus: 'BY', Gürcistan: 'GE', Kazakistan: 'KZ',
  Kırgızistan: 'KG', Özbekistan: 'UZ', Rusya: 'RU', Tayland: 'TH', Türkmenistan: 'TM',
  Ukrayna: 'UA', Diğer: 'XX',
};

function candidateCode(nationality?: string | null, regNo?: number | null): string {
  const cc = NATION_CODE[nationality || ''] || 'XX';
  const n = Number(regNo);
  return cc + (n ? String(n).padStart(4, '0') : '----');
}

// Slot ISO → okunabilir etiket (acente TZ bilinmez; Europe/Istanbul varsayılan — uygulama içi zil yerel saati gösterir).
function formatSlotLabel(iso: string, locale?: string | null): string {
  if (!iso) return '';
  const old = /^(\d{2})\.(\d{2})\.(\d{4})[ ](\d{2}):(\d{2})/.exec(String(iso));
  const dt = old
    ? new Date(Number(old[3]), Number(old[2]) - 1, Number(old[1]), Number(old[4]), Number(old[5]))
    : new Date(iso);
  if (isNaN(dt.getTime())) return String(iso);
  try {
    const lang = (locale || 'tr').split(/[-_]/)[0];
    return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : lang, {
      timeZone: 'Europe/Istanbul',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
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

    let recipientId: string | null = candidateUserId;
    let code = '';
    let slotIso = '';

    if (kind === 'scheduled' || kind === 'declined') {
      // declined: RPC interviews satırını silmiş olabilir → agencyUserId body'den
      const { data: iv } = await admin
        .from('interviews')
        .select('created_by, selected_slot')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      recipientId = iv?.created_by || agencyUserId || null;
      slotIso = iv?.selected_slot || '';
      const { data: prof } = await admin
        .from('profiles')
        .select('nationality, reg_no')
        .eq('user_id', candidateUserId)
        .maybeSingle();
      code = candidateCode(prof?.nationality, prof?.reg_no);
    }
    if (!recipientId) return json({ ok: true, skipped: 'no_recipient' });
    if ((kind === 'scheduled' || kind === 'declined') && !(await recipientAllowsPush(admin, recipientId, 'general'))) {
      return json({ ok: true, skipped: 'prefs_off' });
    }

    const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', recipientId);
    const tokens = (toks ?? []) as PushTokenRow[];
    if (!tokens.length) return json({ ok: true, skipped: 'no_tokens' });

    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const txt = interviewPushText(kind, locale, {
        code,
        slot: formatSlotLabel(slotIso, locale),
      });
      return {
        to,
        title: txt.title,
        body: txt.body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: 'default',
        data: { kind: `interview_${kind}`, candidateUserId, slot: slotIso, code },
      };
    });

    const result = await sendExpoPush(messages);
    return json({ ok: true, sent: messages.length, result });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
