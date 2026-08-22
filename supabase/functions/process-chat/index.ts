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

/** Tek dil çeviri (eski mesajları iyileştirmek için). */
async function translateText(text: string, target: Lang, geminiKey: string, model: string): Promise<string> {
  const targetName = LANG_NAMES[target] || 'English';
  const prompt =
    `Translate the following chat message into ${targetName}.\n` +
    `Keep meaning natural and concise. Do NOT translate person names, company names, dates, codes, emails, or phone numbers.\n` +
    `Return ONLY the translated text, no quotes or commentary.\n\n` +
    text;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0 },
  });
  const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
  for (const m of MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      const gres = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (!gres.ok) continue;
      const gjson = await gres.json();
      const out = (gjson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (out) return out.slice(0, MAX_BODY);
    } catch {
      /* next model */
    }
  }
  return text;
}

/**
 * Metnin gerçek dilini algılayıp 10 dile çevir.
 * Kural: her alıcı kendi app dilinde görür; yazılan dil ve gönderenin UI dili önemsiz.
 */
async function translateChatAll(
  text: string,
  claimedSource: Lang,
  geminiKey: string,
  model: string,
): Promise<{ translations: Record<string, string>; ok: boolean; source: Lang }> {
  if (!geminiKey) {
    return { translations: { [claimedSource]: text }, ok: false, source: claimedSource };
  }

  const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.0-flash'])];
  let detected: Lang = claimedSource;
  const out: Record<string, string> = {};

  const langList = LANGS.map((l) => `${l} (${LANG_NAMES[l]})`).join(', ');
  const prompt =
    `You translate short chat messages for a hospitality recruitment app (Turquz).\n` +
    `Detect the ACTUAL written language of the message (ignore UI language), then translate into ALL of: ${langList}.\n` +
    `Every target language MUST differ from the source when the languages differ ` +
    `(e.g. English message must become real Turkish for "tr", not stay English).\n` +
    `Keep meaning natural and concise. Do NOT translate person names, brand names (Turquz), dates, codes, emails, phones, or URLs.\n` +
    `Return ONLY valid JSON (no markdown):\n` +
    `{"source_lang":"en","i18n":{"tr":"...","en":"...","ru":"..."}}\n` +
    `Include every key: ${LANGS.join(', ')}.\n\n` +
    `MESSAGE:\n${text}`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  let bulkOk = false;
  for (const m of MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      const gres = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (!gres.ok) {
        const errTxt = await gres.text().catch(() => '');
        console.warn('chat translateAll fail', m, gres.status, errTxt.slice(0, 200));
        continue;
      }
      const gjson = await gres.json();
      const raw = (gjson?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));
      detected = resolveLang(parsed?.source_lang || claimedSource);
      for (const l of LANGS) {
        const v = String(parsed?.i18n?.[l] || '').trim();
        if (v) out[l] = v.slice(0, MAX_BODY);
      }
      bulkOk = true;
      break;
    } catch (e) {
      console.warn('chat translateAll parse', m, String(e));
    }
  }

  // Kaynak dilde her zaman orijinal.
  out[detected] = text;

  // Eksik veya "çeviri = orijinal" kalan dilleri tek tek doldur (en→tr gibi Latin çiftleri).
  const missing = LANGS.filter((l) => l !== detected && (!out[l] || out[l] === text));
  if (missing.length) {
    await Promise.all(missing.map(async (l) => {
      try {
        const v = await translateText(text, l, geminiKey, model);
        if (v) out[l] = v.slice(0, MAX_BODY);
      } catch { /* skip */ }
    }));
  }

  const translatedCount = LANGS.filter((l) => l !== detected && out[l] && out[l] !== text).length;
  return {
    translations: out,
    ok: bulkOk || translatedCount > 0,
    source: detected,
  };
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
  const { data: prof } = await admin.from('profiles').select('source_lang').eq('user_id', peerId).maybeSingle();
  if (prof?.source_lang && (LANGS as readonly string[]).includes(prof.source_lang)) {
    return prof.source_lang as Lang;
  }
  const { data: toks } = await admin.from('push_tokens').select('locale').eq('user_id', peerId).limit(5);
  for (const t of toks || []) {
    if (!t?.locale) continue;
    return resolveLang(t.locale);
  }
  return fallback;
}

function displayBody(row: { body: string; source_lang?: string | null; translations?: Record<string, string> }, viewLang: Lang) {
  const tr = row.translations || {};
  if (tr[viewLang]) return tr[viewLang];
  if (row.source_lang === viewLang) return row.body;
  return row.body;
}

/** Metin, hedef dilde değil gibi mi? (Latin→Latin dahil) */
function likelyForeignFor(body: string, viewLang: Lang) {
  const hasCyr = /[\u0400-\u04FF]/.test(body);
  const hasArabic = /[\u0600-\u06FF]/.test(body);
  const hasThai = /[\u0E00-\u0E7F]/.test(body);
  const hasTr = /[çğıöşüÇĞİÖŞÜ]/.test(body);
  if (['ru', 'kk', 'ky'].includes(viewLang)) return !hasCyr;
  if (viewLang === 'fa') return !hasArabic;
  if (viewLang === 'th') return !hasThai;
  if (viewLang === 'tr') {
    if (hasCyr || hasArabic || hasThai) return true;
    // İngilizce kalıplar, Türkçe karakter yok
    if (/\b(the|and|you|are|is|this|that|hello|hi|how|what|please|thanks|thank|okay|ok|yes|no|good|morning|evening|help|need|want|can|will|with|from|have|has|was|were|my|your|me|we|they)\b/i.test(body) && !hasTr) {
      return true;
    }
    return false;
  }
  if (viewLang === 'en') {
    if (hasCyr || hasArabic || hasThai || hasTr) return true;
    return false;
  }
  // de/uz/tk vb.: farklı yazı sistemi varsa çevir
  return hasCyr || hasArabic || hasThai;
}

/** Çeviri eksik / yanlış (Rusça OK ama İngilizce kalmış) */
function needsViewHeal(
  body: string,
  viewLang: Lang,
  tr: Record<string, string>,
  sourceLang?: string | null,
) {
  const cur = tr[viewLang];
  if (!cur) return true;
  if (cur !== body) return false;
  // cur === body → belki çevrilmemiş
  const src = sourceLang ? resolveLang(sourceLang) : null;
  if (src && src !== viewLang) return true;
  for (const [k, v] of Object.entries(tr)) {
    if (k !== viewLang && typeof v === 'string' && v.length && v !== body) return true;
  }
  return likelyForeignFor(body, viewLang);
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

    /** Aktif sohbet (ensure) veya taraf olduğu geçmiş sohbet (salt okunur). */
    const resolveChat = async (): Promise<{
      chatId: string | null;
      chat: Record<string, unknown> | null;
      readOnly: boolean;
      closed: boolean;
    }> => {
      const { data: ensured, error } = await userClient.rpc('ensure_process_chat', { p_candidate: candidateId });
      if (!error && ensured) {
        const { data: chat } = await admin.from('process_chats').select('*').eq('id', ensured).maybeSingle();
        const closed = !!(chat as { closed_at?: string } | null)?.closed_at;
        return { chatId: ensured as string, chat: chat || null, readOnly: closed, closed };
      }

      // Geçmiş: sözleşme/ödeme yoksa ensure başarısız; mevcut thread'i tarafa göre bul.
      let q = admin
        .from('process_chats')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);
      if (user.id === candidateId) {
        q = q.eq('candidate_id', user.id);
      } else {
        q = q.eq('agency_id', user.id);
      }
      const { data: existing } = await q.maybeSingle();
      if (!existing) {
        return { chatId: null, chat: null, readOnly: true, closed: true };
      }
      if (user.id !== existing.candidate_id && user.id !== existing.agency_id) {
        return { chatId: null, chat: null, readOnly: true, closed: true };
      }
      return {
        chatId: existing.id as string,
        chat: existing,
        readOnly: true,
        closed: !!existing.closed_at,
      };
    };

    // open / ensure (+ geçmiş salt okunur)
    if (action === 'open') {
      const resolved = await resolveChat();
      if (!resolved.chatId) {
        return json({ error: 'chat_locked', unlocked: false, closed: true, readOnly: true }, 200);
      }
      return json({
        chatId: resolved.chatId,
        chat: resolved.chat,
        unlocked: !resolved.readOnly,
        closed: resolved.closed,
        readOnly: resolved.readOnly,
      });
    }

    if (action === 'list') {
      const resolved = await resolveChat();
      if (!resolved.chatId) {
        return json({ chatId: null, messages: [], closed: true, readOnly: true });
      }
      const chatId = resolved.chatId;
      const { data: rows, error: mErr } = await admin
        .from('process_chat_messages')
        .select('id, sender_id, body, source_lang, translations, created_at, read_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (mErr) return json({ error: mErr.message }, 500);

      const readAt = new Date().toISOString();
      await admin.from('process_chat_messages')
        .update({ read_at: readAt })
        .eq('chat_id', chatId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      // Rozet / zil: sohbet açılınca chat_message bildirimlerini de okundu yap
      // (mesaj satırı ile bildirim ayrı tablolarda; sadece message read_at yetmez).
      await admin.from('notifications')
        .update({ read_at: readAt })
        .eq('user_id', user.id)
        .eq('type', 'chat_message')
        .is('read_at', null)
        .or(`ref_user.eq.${candidateId},payload->>candidateId.eq.${candidateId}`);

      const list = rows || [];
      const messages = list.map((r) => {
        const mine = r.sender_id === user.id;
        return {
          id: r.id,
          senderId: r.sender_id,
          body: mine ? r.body : displayBody(r, viewLang),
          original: r.body,
          sourceLang: r.source_lang,
          createdAt: r.created_at,
          readAt: r.read_at || null,
          mine,
        };
      });

      const toHeal = geminiKey
        ? list.filter((r) => (
          r.sender_id !== user.id
          && needsViewHeal(r.body, viewLang, (r.translations || {}) as Record<string, string>, r.source_lang)
        )).slice(0, 12)
        : [];
      if (toHeal.length) {
        const healJob = async () => {
          for (const r of toHeal) {
            try {
              const tr = { ...(r.translations || {}) } as Record<string, string>;
              const translated = await translateText(r.body, viewLang, geminiKey, model);
              if (translated && translated !== r.body) {
                tr[viewLang] = translated;
                await admin.from('process_chat_messages').update({ translations: tr }).eq('id', r.id);
              }
            } catch (e) {
              console.warn('heal translate', String(e));
            }
          }
        };
        const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
        if (rt?.waitUntil) rt.waitUntil(healJob());
      }

      return json({
        chatId,
        messages,
        closed: resolved.closed,
        readOnly: resolved.readOnly,
      });
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
      const peerPreferred = await peerLang(admin, peerId, viewLang === 'tr' ? 'en' : 'tr');

      // Hız: önce orijinali kaydet + cevap ver; çeviri/push arka planda.
      const { data: inserted, error: iErr } = await admin.from('process_chat_messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        body: text,
        source_lang: sourceLang,
        translations: { [sourceLang]: text },
      }).select('id, sender_id, body, source_lang, translations, created_at, read_at').single();
      if (iErr) return json({ error: iErr.message }, 500);

      await admin.from('process_chats').update({ last_message_at: new Date().toISOString() }).eq('id', chatId);

      // Bildirim mesajla aynı anda — çeviri gecikince rozet/sohbet tutarsız kalmasın.
      await admin.from('notifications').insert({
        user_id: peerId,
        type: 'chat_message',
        ref_user: user.id,
        payload: { candidateId, chatId },
      });

      const finishTranslateNotify = async () => {
        try {
          const { translations, ok: translatedOk, source: detectedSource } = await translateChatAll(
            text,
            sourceLang,
            geminiKey,
            model,
          );
          if (!translatedOk) console.warn('chat send translate weak/fail', { sourceLang, detectedSource });

          const finalTr = { ...translations, [detectedSource || sourceLang]: text };
          await admin.from('process_chat_messages').update({
            source_lang: detectedSource || sourceLang,
            translations: finalTr,
          }).eq('id', inserted.id);

          const allow = await recipientAllowsPush(admin, peerId, 'chat');
          if (allow) {
            const { data: toks } = await admin.from('push_tokens').select('token, locale').eq('user_id', peerId);
            const tokens = (toks || []) as PushTokenRow[];
            const messages = tokens.filter((t) => t.token).map(({ token: to, locale }) => {
              const loc = locale ? resolveLang(locale) : peerPreferred;
              const preview = finalTr[loc] || finalTr[peerPreferred] || text;
              const txt = chatPushText(locale || peerPreferred, preview);
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
        } catch (e) {
          console.warn('chat send bg translate/push', String((e as Error)?.message ?? e));
        }
      };

      const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(finishTranslateNotify());
      else void finishTranslateNotify();

      return json({
        message: {
          id: inserted.id,
          senderId: inserted.sender_id,
          body: text, // gönderen kendi yazdığı orijinali görür
          original: inserted.body,
          sourceLang: inserted.source_lang,
          createdAt: inserted.created_at,
          readAt: inserted.read_at || null,
          mine: true,
        },
        translated: false,
        translating: true,
      });
    }

    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    console.error('process-chat', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
