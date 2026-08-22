// supabase/functions/agency-notice/index.ts
// Acente bilgilendirmesi: sahiplik kontrolü + 10 dil çeviri + notifications + Expo push.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { LANGS, resolveLang, sendExpoPush, type Lang, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Pack = { title: string; body: string };
type Tone = 'info' | 'action' | 'urgent';

const TONES: Tone[] = ['info', 'action', 'urgent'];
const MAX_SELECTED = 1000;
const DAILY_LIMIT = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LANG_NAMES: Record<Lang, string> = {
  tr: 'Turkish', en: 'English', ru: 'Russian', kk: 'Kazakh', ky: 'Kyrgyz',
  uz: 'Uzbek', tk: 'Turkmen', de: 'German', th: 'Thai', fa: 'Persian',
};

function clip(s: string, n: number) {
  const t = String(s || '').trim();
  return t.length > n ? t.slice(0, n) : t;
}

function tonePrefix(tone: Tone) {
  if (tone === 'urgent') return '🚨 ';
  if (tone === 'action') return '☑️ ';
  return '📌 ';
}

async function translateNoticeAll(
  title: string,
  body: string,
  geminiKey: string,
  model: string,
): Promise<{ sourceLang: Lang; i18n: Record<string, Pack> }> {
  const fallback: Record<string, Pack> = {};
  for (const l of LANGS) fallback[l] = { title, body };
  if (!geminiKey) return { sourceLang: 'tr', i18n: fallback };

  const langList = LANGS.map((l) => `${l} (${LANG_NAMES[l]})`).join(', ');
  const prompt =
    `You translate operational briefings from a hospitality recruitment agency to candidates on the Turquz app.\n` +
    `Detect the source language of the text below, then translate title and body into ALL of these languages: ${langList}.\n` +
    `Keep meaning natural, clear, and professional. Do NOT translate brand names (Turquz), emails, phone numbers, URLs, dates, or codes.\n` +
    `Return ONLY valid JSON (no markdown) with this exact shape:\n` +
    `{"source_lang":"tr","i18n":{"tr":{"title":"...","body":"..."},"en":{"title":"...","body":"..."}}}\n` +
    `Include every language key: ${LANGS.join(', ')}.\n\n` +
    `TITLE:\n${title}\n\nBODY:\n${body}`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
  for (const m of MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      const gres = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!gres.ok) {
        console.warn('notice translate model fail', m, gres.status);
        continue;
      }
      const gjson = await gres.json();
      const raw = (gjson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
      const src = resolveLang(parsed?.source_lang);
      const out: Record<string, Pack> = {};
      for (const l of LANGS) {
        const pack = parsed?.i18n?.[l];
        out[l] = {
          title: clip(pack?.title || title, 160),
          body: clip(pack?.body || body, 2500),
        };
      }
      out[src] = { title: clip(title, 160), body: clip(body, 2500) };
      return { sourceLang: src, i18n: out };
    } catch (e) {
      console.warn('notice translate parse', m, String(e));
    }
  }
  return { sourceLang: 'tr', i18n: fallback };
}

function packFor(i18n: Record<string, Pack>, lang: Lang, fallbackTitle: string, fallbackBody: string): Pack {
  return i18n[lang] || i18n.en || i18n.tr || { title: fallbackTitle, body: fallbackBody };
}

async function allowedRecipientIds(
  admin: ReturnType<typeof createClient>,
  agencyId: string,
  requested: string[],
): Promise<string[]> {
  const ids = [...new Set(requested.filter((id) => UUID_RE.test(id)))];
  if (!ids.length) return [];
  if (ids.length > MAX_SELECTED) return [];
  const aid = String(agencyId || '').trim().toLowerCase();
  const allowed = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const [{ data: profs, error: pErr }, { data: st, error: sErr }, { data: roles, error: rErr }] = await Promise.all([
      admin.from('profiles').select('user_id').in('user_id', slice),
      admin.from('candidate_status').select('user_id, status, accepted_by').in('user_id', slice),
      admin.from('user_roles').select('user_id, role').in('user_id', slice),
    ]);
    if (pErr) console.error('allow profiles', pErr.message);
    if (sErr) console.error('allow status', sErr.message);
    if (rErr) console.error('allow roles', rErr.message);
    const exists = new Set((profs || []).map((r: { user_id: string }) => r.user_id));
    const staff = new Set(
      (roles || [])
        .filter((r: { role?: string }) => r.role === 'agency' || r.role === 'admin')
        .map((r: { user_id: string }) => r.user_id),
    );
    const byId: Record<string, { status?: string | null; accepted_by?: string | null }> = {};
    for (const r of st || []) {
      const row = r as { user_id: string; status?: string | null; accepted_by?: string | null };
      if (row.user_id) byId[row.user_id] = row;
    }
    for (const id of slice) {
      if (!exists.has(id) || staff.has(id)) continue;
      const row = byId[id];
      const status = String(row?.status || '');
      const owner = String(row?.accepted_by || '').trim().toLowerCase();
      const owned = !!aid && owner === aid && ['offered', 'accepted', 'hired', 'in_transit'].includes(status);
      const inPool = status !== 'hired' && status !== 'in_transit';
      if (owned || inPool) allowed.add(id);
    }
  }
  return ids.filter((id) => allowed.has(id));
}

function bearerToken(req: Request): string {
  const h = req.headers.get('Authorization')
    || req.headers.get('authorization')
    || req.headers.get('x-forwarded-authorization')
    || '';
  return h.replace(/^Bearer\s+/i, '').trim();
}

async function verifyJwtUser(url: string, anonKey: string, jwt: string): Promise<{ id: string } | null> {
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: anonKey },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null) as { id?: string } | null;
  const id = data?.id;
  return typeof id === 'string' && UUID_RE.test(id) ? { id } : null;
}

async function callerUser(
  req: Request,
  url: string,
  anonKey: string,
  serviceKey: string,
  bodyJwt: string,
): Promise<{ user: { id: string } | null; detail: string }> {
  const seen = new Set<string>();
  const tokens = [bearerToken(req), String(bodyJwt || '').trim()].filter(Boolean);
  let last = 'missing_jwt';
  for (const jwt of tokens) {
    if (seen.has(jwt)) continue;
    seen.add(jwt);
    if (jwt === anonKey || jwt === serviceKey) {
      last = 'anon_jwt';
      continue;
    }
    try {
      const user = await verifyJwtUser(url, anonKey, jwt);
      if (user) return { user, detail: '' };
      last = 'auth_rejected';
    } catch (e) {
      last = String((e as Error)?.message || e);
    }
  }
  return { user: null, detail: last };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'insert_failed', detail: 'missing_env' }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const { user, detail: authDetail } = await callerUser(
      req, url, anonKey, serviceKey, String(body?.accessToken || ''),
    );
    if (!user) return json({ error: 'unauthorized', detail: authDetail }, 200);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const role = (roleRow as { role?: string } | null)?.role;
    if (role !== 'agency' && role !== 'admin') return json({ error: 'forbidden' }, 200);
    const title = String(body?.title || '').trim();
    const text = String(body?.body || '').trim();
    const toneRaw = String(body?.tone || 'info') as Tone;
    const tone: Tone = TONES.includes(toneRaw) ? toneRaw : 'info';
    const targetKind = String(body?.targetKind || 'selected') === 'focus' ? 'focus' : 'selected';
    const selectedRaw = Array.isArray(body?.userIds) ? body.userIds : [];
    const selected = selectedRaw.map((x: unknown) => String(x || '')).filter(Boolean);
    const uniqueSelected = [...new Set(selected.filter((id: string) => UUID_RE.test(id)))];
    if (uniqueSelected.length > MAX_SELECTED) return json({ error: 'too_many' }, 200);

    if (!title || !text) return json({ error: 'title_body_required' }, 200);
    if (title.length > 120) return json({ error: 'title_too_long' }, 200);
    if (text.length > 2000) return json({ error: 'body_too_long' }, 200);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dayCount } = await admin
      .from('agency_notices')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', user.id)
      .gte('created_at', since);
    if ((dayCount || 0) >= DAILY_LIMIT) return json({ error: 'daily_limit' }, 200);

    const userIds = await allowedRecipientIds(admin, user.id, selected);
    if (!userIds.length) {
      console.warn('agency-notice no recipients', { asked: uniqueSelected.length, agency: user.id });
      return json({ error: 'selected_required' }, 200);
    }

    const { data: agencyProf } = await admin
      .from('agency_profiles')
      .select('company_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const agencyName = String((agencyProf as { company_name?: string } | null)?.company_name || '').trim();

    const fallbackI18n = (): { sourceLang: Lang; i18n: Record<string, Pack> } => {
      const pack: Record<string, Pack> = {};
      for (const l of LANGS) pack[l] = { title, body: text };
      return { sourceLang: 'tr', i18n: pack };
    };
    // Önce kaydet; çeviri takılırsa yine gönderilmiş olsun.
    let { sourceLang, i18n } = fallbackI18n();

    const noticeId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { error: nErr } = await admin.from('agency_notices').insert({
      id: noticeId,
      agency_id: user.id,
      tone,
      title,
      body: text,
      source_lang: sourceLang,
      i18n,
      target_kind: targetKind,
      created_at: createdAt,
    });
    if (nErr) {
      console.error('agency_notices insert', nErr.code, nErr.message);
      return json({ error: 'insert_failed', detail: nErr.message }, 200);
    }

    const recRows = userIds.map((uid) => ({ notice_id: noticeId, candidate_id: uid }));
    const CHUNK = 200;
    for (let i = 0; i < recRows.length; i += CHUNK) {
      const { error: rErr } = await admin.from('agency_notice_recipients').insert(recRows.slice(i, i + CHUNK));
      if (rErr) console.error('recipients insert', rErr);
    }

    try {
      const translated = await Promise.race([
        translateNoticeAll(title, text, geminiKey, model),
        new Promise<{ sourceLang: Lang; i18n: Record<string, Pack> }>((resolve) => {
          setTimeout(() => resolve(fallbackI18n()), 8000);
        }),
      ]);
      sourceLang = translated.sourceLang;
      i18n = translated.i18n;
      await admin.from('agency_notices').update({ source_lang: sourceLang, i18n }).eq('id', noticeId);
    } catch (e) {
      console.warn('notice translate skipped', String(e));
    }

    const payload = {
      title,
      body: text,
      notice_id: noticeId,
      tone,
      from: 'agency',
      agencyId: user.id,
      agencyName,
      i18n,
    };
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const slice = userIds.slice(i, i + CHUNK);
      const rows = slice.map((uid) => ({
        user_id: uid,
        type: 'agency_notice',
        ref_user: user.id,
        payload,
      }));
      const { error: notifErr } = await admin.from('notifications').insert(rows);
      if (notifErr) console.error('notifications insert', notifErr);
    }

    const { data: offPrefs } = await admin
      .from('agency_notif_prefs')
      .select('user_id')
      .eq('general_push', false);
    const muted = new Set((offPrefs || []).map((r: { user_id: string }) => r.user_id));
    const allowed = userIds.filter((id) => !muted.has(id));

    const PUSH_CHUNK = 100;
    let pushed = 0;
    const prefix = tonePrefix(tone);
    for (let i = 0; i < allowed.length; i += CHUNK) {
      const slice = allowed.slice(i, i + CHUNK);
      const { data: toks } = await admin.from('push_tokens').select('token, locale, user_id').in('user_id', slice);
      const tokens = (toks || []) as (PushTokenRow & { user_id?: string })[];
      const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
        const lang = resolveLang(locale);
        const pack = packFor(i18n, lang, title, text);
        const bodyPush = pack.body.length > 160 ? `${pack.body.slice(0, 157)}…` : pack.body;
        const pushBody = agencyName
          ? `${agencyName}\n${bodyPush}`.slice(0, 180)
          : bodyPush;
        return {
          to,
          title: `${prefix}${pack.title}`,
          body: pushBody,
          priority: tone === 'urgent' ? 'high' : 'default',
          sound: 'notify.wav',
          channelId: 'default',
          data: { kind: 'agency_notice', noticeId, tone, agencyName },
        };
      });
      for (let j = 0; j < messages.length; j += PUSH_CHUNK) {
        await sendExpoPush(messages.slice(j, j + PUSH_CHUNK));
        pushed += Math.min(PUSH_CHUNK, messages.length - j);
      }
    }

    return json({
      ok: true,
      noticeId,
      notified: userIds.length,
      pushed,
      translated: Object.keys(i18n).length,
      createdAt,
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'agency_notice_err', detail: String((e as Error)?.message ?? e) }, 200);
  }
});
