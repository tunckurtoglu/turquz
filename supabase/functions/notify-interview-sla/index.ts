// supabase/functions/notify-interview-sla/index.ts
// Mülakat daveti SLA: 24s adaya hatırlatma, 48s acenteye "cevap yok" (+ ignore/pasif).
// body: { scan: true }
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  interviewRespondRemindPushText,
  interviewNoResponsePushText,
  poolPassivePushText,
  sendExpoPush,
  recipientAllowsPush,
  type PushTokenRow,
} from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const NATION_CODE: Record<string, string> = {
  Türkiye: 'TR', Azerbaycan: 'AZ', Belarus: 'BY', Gürcistan: 'GE', Kazakistan: 'KZ',
  Kırgızistan: 'KG', Özbekistan: 'UZ', Rusya: 'RU', Tayland: 'TH', Türkmenistan: 'TM',
  Ukrayna: 'UA', Diğer: 'XX',
};
const codeOf = (nat?: string | null, reg?: number | null) =>
  (NATION_CODE[nat || ''] || 'XX') + (reg ? String(reg).padStart(4, '0') : '----');

const REMIND_MS = 24 * 3600 * 1000;
const IGNORE_LIMIT = 3;
const PASSIVE_DAYS = 7;

type Admin = ReturnType<typeof createClient>;

async function pushTo(
  admin: Admin,
  userId: string,
  build: (locale?: string | null) => { title: string; body: string },
  data: Record<string, unknown>,
  opts?: { respectAgencyGeneral?: boolean },
) {
  if (opts?.respectAgencyGeneral && !(await recipientAllowsPush(admin, userId, 'general'))) return 0;
  const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', userId);
  const tokens = (toks || []) as PushTokenRow[];
  if (!tokens.length) return 0;
  const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
    const txt = build(locale);
    return {
      to,
      title: txt.title,
      body: txt.body,
      priority: 'high',
      sound: 'notify.wav',
      channelId: 'default',
      data,
    };
  });
  await sendExpoPush(messages);
  return messages.length;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.scan) return json({ error: 'scan_required' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);
    const now = Date.now();

    const { data: rows, error } = await admin
      .from('interviews')
      .select('user_id, created_by, created_at, respond_by, response_reminded_at, no_response_notified_at, status')
      .eq('status', 'proposed')
      .limit(400);
    if (error) throw error;

    let reminded = 0;
    let noResp = 0;
    let passived = 0;

    for (const r of rows || []) {
      const created = r.created_at ? new Date(r.created_at).getTime() : 0;
      const respondBy = r.respond_by
        ? new Date(r.respond_by).getTime()
        : (created ? created + 48 * 3600 * 1000 : 0);
      if (!created || !respondBy) continue;

      // 24s: adaya hatırlat (henüz süre dolmadan)
      if (!r.response_reminded_at && now >= created + REMIND_MS && now < respondBy) {
        const { data: claimed } = await admin
          .from('interviews')
          .update({ response_reminded_at: new Date().toISOString() })
          .eq('user_id', r.user_id)
          .eq('status', 'proposed')
          .is('response_reminded_at', null)
          .select('user_id')
          .maybeSingle();
        if (claimed) {
          await admin.from('notifications').insert({
            user_id: r.user_id,
            type: 'interview_respond_remind',
            ref_user: r.created_by,
            payload: {},
          });
          await pushTo(
            admin,
            r.user_id,
            (locale) => interviewRespondRemindPushText(locale),
            { kind: 'interview_respond_remind', candidateUserId: r.user_id },
          );
          reminded += 1;
        }
      }

      // 48s: acenteye cevap yok + ignore streak
      if (!r.no_response_notified_at && now >= respondBy && r.created_by) {
        const { data: claimed } = await admin
          .from('interviews')
          .update({ no_response_notified_at: new Date().toISOString() })
          .eq('user_id', r.user_id)
          .eq('status', 'proposed')
          .is('no_response_notified_at', null)
          .select('user_id')
          .maybeSingle();
        if (!claimed) continue;

        const { data: prof } = await admin
          .from('profiles')
          .select('nationality, reg_no, iv_ignore_streak')
          .eq('user_id', r.user_id)
          .maybeSingle();
        const code = codeOf(prof?.nationality, prof?.reg_no);
        const hours = Math.max(1, Math.round((now - created) / 3600000));

        await admin.from('notifications').insert({
          user_id: r.created_by,
          type: 'interview_no_response',
          ref_user: r.user_id,
          payload: {
            nationality: prof?.nationality || '',
            reg_no: prof?.reg_no,
            hours,
          },
        });
        await pushTo(
          admin,
          r.created_by,
          (locale) => interviewNoResponsePushText(code, hours, locale),
          { kind: 'interview_no_response', candidateUserId: r.user_id, code, hours },
          { respectAgencyGeneral: true },
        );
        noResp += 1;

        const streak = (Number(prof?.iv_ignore_streak) || 0) + 1;
        if (streak >= IGNORE_LIMIT) {
          const until = new Date(now + PASSIVE_DAYS * 24 * 3600 * 1000).toISOString();
          await admin
            .from('profiles')
            .update({ iv_ignore_streak: 0, pool_passive_until: until })
            .eq('user_id', r.user_id);
          await admin.from('notifications').insert({
            user_id: r.user_id,
            type: 'pool_passive',
            ref_user: r.created_by,
            payload: { until, days: PASSIVE_DAYS },
          });
          await pushTo(
            admin,
            r.user_id,
            (locale) => poolPassivePushText(PASSIVE_DAYS, locale),
            { kind: 'pool_passive', until },
          );
          // Açık daveti kapat — pasifken bekleyen teklif kalmasın
          await admin.from('interviews').delete().eq('user_id', r.user_id).eq('status', 'proposed');
          passived += 1;
        } else {
          await admin
            .from('profiles')
            .update({ iv_ignore_streak: streak })
            .eq('user_id', r.user_id);
        }
      }
    }

    return json({ ok: true, reminded, no_response: noResp, passived });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
