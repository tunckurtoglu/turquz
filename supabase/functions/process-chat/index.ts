// supabase/functions/process-chat/index.ts
// Sözleşme ödemesi sonrası acente ↔ aday metin sohbeti + AI çeviri + push.
// body.action: open | list | send | sync_lang | prefs_get | prefs_set
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  LANGS, resolveLang, chatPushText, recipientAllowsPush, sendExpoPush, type PushTokenRow, type Lang,
} from '../_shared/pushTexts.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const LANG_NAMES: Record<string, string> = {
  tr: 'Turkish', en: 'English', ru: 'Russian', kk: 'Kazakh', ky: 'Kyrgyz',
  uz: 'Uzbek', tk: 'Turkmen', de: 'German', th: 'Thai', fa: 'Persian',
};

const MAX_BODY = 2000;

async function translateText(text: string, target: Lang, geminiKey: string, model: string): Promise<string> {
  const targetName = LANG_NAMES[target] || 'English';
  const prompt =
    `Translate the following chat message into ${targetName}.\n` +
    `Keep meaning natural and concise. Do NOT translate person names, company names, dates, codes, emails, or phone numbers.\n` +
    `Return ONLY the translated text, no quotes or commentary.\n\n` +
    text;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  });
  const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
  for (const m of MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
    const gres = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    if (!gres.ok) continue;
    const gjson = await gres.json();
    const out = (gjson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (out) return out.slice(0, MAX_BODY);
  }
  return text;
}

async function peerLang(
  admin: ReturnType<typeof createClient>,
  peerId: string,
  fallback: Lang,
): Promise<Lang> {
  const { data: pref } = await admin.from('agency_notif_prefs').select('preferred_lang').eq('user_id', peerId).maybeSingle();
  if (pref?.preferred_lang && (LANGS as readonly string[]).includes(pref.preferred_lang)) {
    return pref.preferred_lang as Lang;
  }
  const { data: toks } = await admin.from('push_tokens').select('locale').eq('user_id', peerId).limit(5);
  for (const t of toks || []) {
    const l = resolveLang(t.locale);
    if (l) return l;
  }
  return fallback;
}

function displayBody(row: { body: string; source_lang?: string | null; translations?: Record<string, string> }, viewLang: Lang) {
  const tr = row.translations || {};
  if (tr[viewLang]) return tr[viewLang];
  if (row.source_lang === viewLang) return row.body;
  return row.body;
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
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    // ---- prefs ----
    if (action === 'prefs_get') {
      const { data } = await admin.from('agency_notif_prefs').select('*').eq('user_id', user.id).maybeSingle();
      return json({
        generalPush: data?.general_push !== false,
        chatPush: data?.chat_push !== false,
        preferredLang: data?.preferred_lang || null,
      });
    }

    if (action === 'prefs_set') {
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (!roleRow || !['agency', 'admin'].includes(roleRow.role)) return json({ error: 'forbidden' }, 403);
      const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
      if (typeof body.generalPush === 'boolean') patch.general_push = body.generalPush;
      if (typeof body.chatPush === 'boolean') patch.chat_push = body.chatPush;
      if (typeof body.preferredLang === 'string') patch.preferred_lang = resolveLang(body.preferredLang);
      const { error } = await admin.from('agency_notif_prefs').upsert(patch, { onConflict: 'user_id' });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === 'sync_lang') {
      const lang = resolveLang(body?.lang);
      const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (roleRow && ['agency', 'admin'].includes(roleRow.role)) {
        await admin.from('agency_notif_prefs').upsert(
          { user_id: user.id, preferred_lang: lang, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      }
      return json({ ok: true, lang });
    }

    const candidateId = body?.candidateId as string | undefined;
    const viewLang = resolveLang(body?.lang);
    if (!candidateId) return json({ error: 'bad_request' }, 400);

    // open / ensure
    if (action === 'open') {
      const { data: chatId, error } = await userClient.rpc('ensure_process_chat', { p_candidate: candidateId });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('chat_locked')) return json({ error: 'chat_locked' }, 403);
        if (msg.includes('not_allowed')) return json({ error: 'forbidden' }, 403);
        return json({ error: msg }, 400);
      }
      const { data: chat } = await admin.from('process_chats').select('*').eq('id', chatId).maybeSingle();
      return json({ chatId, chat, unlocked: true });
    }

    if (action === 'list') {
      const { data: chatId, error } = await userClient.rpc('ensure_process_chat', { p_candidate: candidateId });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('chat_locked')) return json({ error: 'chat_locked', messages: [] }, 403);
        return json({ error: msg }, 400);
      }
      const { data: rows, error: mErr } = await admin
        .from('process_chat_messages')
        .select('id, sender_id, body, source_lang, translations, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (mErr) return json({ error: mErr.message }, 500);
      const messages = (rows || []).map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        body: displayBody(r, viewLang),
        original: r.body,
        sourceLang: r.source_lang,
        createdAt: r.created_at,
        mine: r.sender_id === user.id,
      }));
      return json({ chatId, messages });
    }

    if (action === 'send') {
      const text = String(body?.text || '').trim().slice(0, MAX_BODY);
      if (!text) return json({ error: 'empty' }, 400);
      const sourceLang = resolveLang(body?.lang);

      const { data: chatId, error } = await userClient.rpc('ensure_process_chat', { p_candidate: candidateId });
      if (error) {
        const msg = error.message || '';
        if (msg.includes('chat_locked')) return json({ error: 'chat_locked' }, 403);
        return json({ error: msg }, 400);
      }

      const { data: chat } = await admin.from('process_chats').select('*').eq('id', chatId).maybeSingle();
      if (!chat || chat.closed_at) return json({ error: 'chat_closed' }, 403);
      if (user.id !== chat.candidate_id && user.id !== chat.agency_id) return json({ error: 'forbidden' }, 403);

      const peerId = user.id === chat.candidate_id ? chat.agency_id : chat.candidate_id;
      const targetLang = await peerLang(admin, peerId, sourceLang === 'tr' ? 'en' : 'tr');

      const translations: Record<string, string> = {};
      if (targetLang !== sourceLang && geminiKey) {
        try {
          translations[targetLang] = await translateText(text, targetLang, geminiKey, model);
        } catch (e) {
          console.warn('chat translate fail', String(e));
        }
      }
      translations[sourceLang] = text;

      const { data: inserted, error: iErr } = await admin.from('process_chat_messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        body: text,
        source_lang: sourceLang,
        translations,
      }).select('id, sender_id, body, source_lang, translations, created_at').single();
      if (iErr) return json({ error: iErr.message }, 500);

      await admin.from('process_chats').update({ last_message_at: new Date().toISOString() }).eq('id', chatId);

      // In-app notification row
      await admin.from('notifications').insert({
        user_id: peerId,
        type: 'chat_message',
        ref_user: user.id,
        payload: { candidateId, chatId },
      });

      // Push (acente tercihine saygı)
      const allow = await recipientAllowsPush(admin, peerId, 'chat');
      if (allow) {
        const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', peerId);
        const tokens = (toks || []) as PushTokenRow[];
        const preview = translations[resolveLang(tokens[0]?.locale)] || text;
        const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
          const txt = chatPushText(locale, translations[resolveLang(locale)] || text);
          return {
            to,
            title: txt.title,
            body: txt.body || preview,
            priority: 'high',
            sound: 'notify.wav',
            channelId: 'default',
            data: { kind: 'chat_message', candidateUserId: candidateId, chatId },
          };
        });
        if (messages.length) await sendExpoPush(messages);
      }

      return json({
        message: {
          id: inserted.id,
          senderId: inserted.sender_id,
          body: displayBody(inserted, viewLang),
          original: inserted.body,
          sourceLang: inserted.source_lang,
          createdAt: inserted.created_at,
          mine: true,
        },
      });
    }

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    console.error('process-chat', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
