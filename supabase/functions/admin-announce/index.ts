// supabase/functions/admin-announce/index.ts
// Admin duyurusu: 10 dile çeviri + notifications + Expo push (aday / acente / hepsi).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { LANGS, resolveLang, sendExpoPush, type Lang, type PushTokenRow } from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type Audience = 'all' | 'candidates' | 'agencies' | 'pool' | 'offered' | 'process' | 'hired' | 'selected';
type Pack = { title: string; body: string };

const AUDIENCES: Audience[] = ['all', 'candidates', 'agencies', 'pool', 'offered', 'process', 'hired', 'selected'];
const MAX_SELECTED = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function categoryOf(st: { status?: string | null; docs_unlocked?: boolean | null } | null | undefined) {
  if (!st) return 'pool';
  if (st.status === 'hired') return 'hired';
  if (st.docs_unlocked || st.status === 'accepted') return 'process';
  if (st.status === 'offered') return 'offered';
  return 'pool';
}

async function fetchAll<T>(
  admin: ReturnType<typeof createClient>,
  table: string,
  columns: string,
): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

async function resolveUserIds(
  admin: ReturnType<typeof createClient>,
  audience: Audience,
  selected: string[],
): Promise<string[]> {
  if (audience === 'selected') {
    const ids = [...new Set(selected.filter((id) => UUID_RE.test(id)))].slice(0, MAX_SELECTED);
    if (!ids.length) return [];
    const found: string[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data } = await admin.from('user_roles').select('user_id').eq('role', 'candidate').in('user_id', slice);
      for (const r of data || []) found.push((r as { user_id: string }).user_id);
    }
    return [...new Set(found)];
  }

  if (audience === 'all' || audience === 'candidates' || audience === 'agencies') {
    const roles = audience === 'all' ? ['candidate', 'agency'] : audience === 'candidates' ? ['candidate'] : ['agency'];
    const rows = await fetchAll<{ user_id: string; role: string }>(admin, 'user_roles', 'user_id, role');
    return [...new Set(rows.filter((r) => roles.includes(r.role)).map((r) => r.user_id))];
  }

  const roles = await fetchAll<{ user_id: string; role: string }>(admin, 'user_roles', 'user_id, role');
  const cand = new Set(roles.filter((r) => r.role === 'candidate').map((r) => r.user_id));
  const sts = await fetchAll<{ user_id: string; status: string | null; docs_unlocked: boolean | null }>(
    admin,
    'candidate_status',
    'user_id, status, docs_unlocked',
  );
  const stMap = new Map(sts.map((s) => [s.user_id, s]));
  return [...cand].filter((id) => categoryOf(stMap.get(id) || null) === audience);
}

const LANG_NAMES: Record<Lang, string> = {
  tr: 'Turkish', en: 'English', ru: 'Russian', kk: 'Kazakh', ky: 'Kyrgyz',
  uz: 'Uzbek', tk: 'Turkmen', de: 'German', th: 'Thai', fa: 'Persian',
};

function clip(s: string, n: number) {
  const t = String(s || '').trim();
  return t.length > n ? t.slice(0, n) : t;
}

async function translateAnnouncementAll(
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
    `You translate product announcements for a hospitality recruitment app (Turquz).\n` +
    `Detect the source language of the text below, then translate title and body into ALL of these languages: ${langList}.\n` +
    `Keep meaning natural and clear. Do NOT translate brand names (Turquz), emails, phone numbers, URLs, or codes.\n` +
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
        console.warn('announce translate model fail', m, gres.status);
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
      // Kaynak dilde orijinali koru (AI sapması olmasın).
      out[src] = { title: clip(title, 160), body: clip(body, 2500) };
      return { sourceLang: src, i18n: out };
    } catch (e) {
      console.warn('announce translate parse', m, String(e));
    }
  }
  return { sourceLang: 'tr', i18n: fallback };
}

function packFor(i18n: Record<string, Pack>, lang: Lang, fallbackTitle: string, fallbackBody: string): Pack {
  return i18n[lang] || i18n.en || i18n.tr || { title: fallbackTitle, body: fallbackBody };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleRow?.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const text = String(body?.body || '').trim();
    const audience = (String(body?.audience || 'all') as Audience);
    const selectedRaw = Array.isArray(body?.userIds) ? body.userIds : [];
    const selected = selectedRaw.map((x: unknown) => String(x || '')).filter(Boolean);
    if (!title || !text) return json({ error: 'title_body_required' }, 400);
    if (!AUDIENCES.includes(audience)) return json({ error: 'bad_audience' }, 400);
    if (title.length > 120) return json({ error: 'title_too_long' }, 400);
    if (text.length > 2000) return json({ error: 'body_too_long' }, 400);

    const userIds = await resolveUserIds(admin, audience, selected);
    if (audience === 'selected' && !userIds.length) return json({ error: 'selected_required' }, 400);

    const { sourceLang, i18n } = await translateAnnouncementAll(title, text, geminiKey, model);

    const targetIds = audience === 'selected' ? userIds : [];
    let ann: { id: string; created_at: string } | null = null;
    const withI18n = await admin.from('announcements').insert({
      title,
      body: text,
      audience,
      created_by: user.id,
      source_lang: sourceLang,
      i18n,
      target_ids: targetIds,
    }).select('id, created_at').single();
    if (!withI18n.error && withI18n.data) {
      ann = withI18n.data;
    } else {
      console.warn('announcements i18n insert', withI18n.error);
      const bare = await admin.from('announcements').insert({
        title,
        body: text,
        audience,
        created_by: user.id,
        target_ids: targetIds,
      }).select('id, created_at').single();
      if (bare.error || !bare.data) {
        const oldest = await admin.from('announcements').insert({
          title,
          body: text,
          audience: ['pool', 'offered', 'process', 'hired', 'selected'].includes(audience) ? 'candidates' : audience,
          created_by: user.id,
        }).select('id, created_at').single();
        if (oldest.error || !oldest.data) {
          console.error(bare.error || oldest.error);
          return json({ error: 'insert_failed' }, 500);
        }
        ann = oldest.data;
      } else {
        ann = bare.data;
      }
    }

    return await fanOut(admin, user.id, ann, userIds, title, text, i18n);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

async function fanOut(
  admin: ReturnType<typeof createClient>,
  adminUserId: string,
  ann: { id: string; created_at: string },
  userIds: string[],
  title: string,
  text: string,
  i18n: Record<string, Pack>,
) {
  if (!userIds.length) {
    return json({ ok: true, announcementId: ann.id, notified: 0, pushed: 0, translated: Object.keys(i18n).length });
  }

  const payload = {
    title,
    body: text,
    announcement_id: ann.id,
    i18n,
  };
  const CHUNK = 200;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const slice = userIds.slice(i, i + CHUNK);
    const rows = slice.map((uid) => ({
      user_id: uid,
      type: 'announcement',
      ref_user: adminUserId,
      payload,
    }));
    const { error: nErr } = await admin.from('notifications').insert(rows);
    if (nErr) console.error('notifications insert', nErr);
  }

  const { data: offPrefs } = await admin
    .from('agency_notif_prefs')
    .select('user_id')
    .eq('general_push', false);
  const muted = new Set((offPrefs || []).map((r: { user_id: string }) => r.user_id));
  const allowed = userIds.filter((id) => !muted.has(id));

  const PUSH_CHUNK = 100;
  let pushed = 0;
  for (let i = 0; i < allowed.length; i += CHUNK) {
    const slice = allowed.slice(i, i + CHUNK);
    const { data: toks } = await admin.from('push_tokens').select('token, locale, user_id').in('user_id', slice);
    const tokens = (toks || []) as (PushTokenRow & { user_id?: string })[];
    const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
      const lang = resolveLang(locale);
      const pack = packFor(i18n, lang, title, text);
      const body = pack.body.length > 160 ? `${pack.body.slice(0, 157)}…` : pack.body;
      return {
        to,
        title: `📢 ${pack.title}`,
        body,
        priority: 'high',
        sound: 'notify.wav',
        channelId: 'default',
        data: { kind: 'announcement', announcementId: ann.id },
      };
    });
    for (let j = 0; j < messages.length; j += PUSH_CHUNK) {
      const batch = messages.slice(j, j + PUSH_CHUNK);
      await sendExpoPush(batch);
      pushed += batch.length;
    }
  }

  return json({
    ok: true,
    announcementId: ann.id,
    notified: userIds.length,
    pushed,
    translated: Object.keys(i18n).length,
    createdAt: ann.created_at,
  });
}
