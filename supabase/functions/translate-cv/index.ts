// supabase/functions/translate-cv/index.ts
// Adayın serbest CV metinlerini hedef dile çevirir (Gemini).
// body: { candidateUserId, target } — acente/aday profilden (önbellekli)
// body: { target, fields, candidateUserId? } — aday önizleme (bellekteki veri)
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

type ExpItem = { company: string; position: string; date: string };
type EduItem = { description: string; date: string };
type CertItem = { name: string; institution: string };
type Src = { title: string; profile: string; experience: ExpItem[]; education: EduItem[]; certificates: CertItem[] };

function normalize(raw: Partial<Src> | null | undefined, fallback: Src): Src {
  return {
    title: typeof raw?.title === 'string' ? raw.title : fallback.title,
    profile: typeof raw?.profile === 'string' ? raw.profile : fallback.profile,
    experience: Array.isArray(raw?.experience) && raw!.experience.length === fallback.experience.length
      ? raw!.experience.map((e, i) => ({
        company: typeof (e as ExpItem)?.company === 'string' ? (e as ExpItem).company : fallback.experience[i]?.company || '',
        position: typeof (e as ExpItem)?.position === 'string' ? (e as ExpItem).position : fallback.experience[i]?.position || '',
        date: typeof (e as ExpItem)?.date === 'string' ? (e as ExpItem).date : fallback.experience[i]?.date || '',
      }))
      : fallback.experience,
    education: Array.isArray(raw?.education) && raw!.education.length === fallback.education.length
      ? raw!.education.map((e, i) => ({
        description: typeof (e as EduItem)?.description === 'string' ? (e as EduItem).description : fallback.education[i]?.description || '',
        date: typeof (e as EduItem)?.date === 'string' ? (e as EduItem).date : fallback.education[i]?.date || '',
      }))
      : fallback.education,
    certificates: Array.isArray(raw?.certificates) && raw!.certificates.length === fallback.certificates.length
      ? raw!.certificates.map((c, i) => ({
        name: typeof (c as CertItem)?.name === 'string' ? (c as CertItem).name : fallback.certificates[i]?.name || '',
        institution: typeof (c as CertItem)?.institution === 'string' ? (c as CertItem).institution : fallback.certificates[i]?.institution || '',
      }))
      : fallback.certificates,
  };
}

function extract(d: Record<string, unknown>): Src {
  return {
    title: (d?.title as string) || '',
    profile: (d?.profile as string) || '',
    experience: Array.isArray(d?.experience)
      ? (d.experience as Record<string, unknown>[]).map((e) => ({
        company: (e?.company as string) || '',
        position: (e?.position as string) || '',
        date: (e?.date as string) || '',
      }))
      : [],
    education: Array.isArray(d?.education)
      ? (d.education as Record<string, unknown>[]).map((e) => ({
        description: (e?.description as string) || '',
        date: (e?.date as string) || '',
      }))
      : [],
    certificates: Array.isArray(d?.certificates)
      ? (d.certificates as unknown[]).map((c) => {
        if (typeof c === 'string') return { name: c, institution: '' };
        const o = c as Record<string, unknown>;
        return { name: (o?.name as string) || '', institution: (o?.institution as string) || '' };
      })
      : [],
  };
}

function hasText(s: Src): boolean {
  return !!(
    s.title || s.profile
    || s.experience.some((e) => e.company || e.position || e.date)
    || s.education.some((e) => e.description || e.date)
    || s.certificates.some((c) => c.name || c.institution)
  );
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function translateWithGemini(src: Src, target: string, geminiKey: string, model: string): Promise<Partial<Src>> {
  const targetName = LANG_NAMES[target];
  const prompt =
    `You are a professional CV translator. Translate ONLY the string values in the JSON below into ${targetName}.\n` +
    `Keep the JSON structure, keys, and array order IDENTICAL.\n` +
    `Do NOT translate or alter: people names, place/city/country names, emails, phone numbers.\n` +
    `Company names (experience.company) are PROPER NAMES — never translate their meaning ` +
    `(e.g. keep "Golden" as "Golden", do NOT turn it into "Altın"/"Gold").\n` +
    `If a company name is in a non-Latin script (e.g. Cyrillic), ONLY transliterate it into Latin letters ` +
    `(readable romanization); do not translate the meaning into ${targetName}.\n` +
    `If a company name is already in Latin script, leave it unchanged.\n` +
    `DO translate: job titles, profile summaries, education descriptions, certificate names, date labels like "Devam"/"Present" into ${targetName}.\n` +
    `If a value is empty or already in ${targetName}, return it unchanged. Keep it natural and professional.\n` +
    `Return ONLY the JSON object, no extra text.\n\nJSON:\n${JSON.stringify(src)}`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  });
  const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
  const RETRY = new Set([429, 500, 502, 503, 504]);
  let gres: Response | null = null;
  for (const m of MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
    let ok = false;
    for (let i = 0; i < 2; i++) {
      gres = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (gres.ok) { ok = true; break; }
      if (!RETRY.has(gres.status)) break;
      await new Promise((r) => setTimeout(r, 500 * (i + 1) + Math.floor(Math.random() * 300)));
    }
    if (ok) break;
  }
  if (!gres || !gres.ok) {
    console.error('translate-cv ai_unavailable', gres?.status);
    throw new Error('ai_unavailable');
  }
  const gjson = await gres.json();
  const text = gjson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  try { return JSON.parse(text); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const isStaff = !!roleRow && ['agency', 'admin'].includes(roleRow.role);

    const body = await req.json().catch(() => ({}));
    const target = String(body?.target || '').slice(0, 5);
    const inlineFields = body?.fields as Partial<Src> | undefined;
    const candidateUserId = body?.candidateUserId as string | undefined;
    if (!LANG_NAMES[target]) return json({ error: 'bad_request' }, 400);

    let src: Src;
    let cacheUserId: string | null = null;

    if (inlineFields && candidateUserId && isStaff) {
      // Acente ekranı: ekranda görünen CV metinlerini çevir.
      src = extract(inlineFields as Record<string, unknown>);
      cacheUserId = candidateUserId;
    } else if (inlineFields) {
      if (!isStaff && candidateUserId && candidateUserId !== user.id) return json({ error: 'forbidden' }, 403);
      src = extract(inlineFields as Record<string, unknown>);
      cacheUserId = candidateUserId || user.id;
    } else {
      if (!candidateUserId) return json({ error: 'bad_request' }, 400);
      const isSelf = user.id === candidateUserId;
      if (!isStaff && !isSelf) return json({ error: 'forbidden' }, 403);
      const { data: prof } = await admin
        .from('profiles').select('data').eq('user_id', candidateUserId).maybeSingle();
      if (!prof?.data) return json({ error: 'profile_not_found' }, 404);
      src = extract(prof.data as Record<string, unknown>);
      cacheUserId = candidateUserId;
    }

    if (!hasText(src)) return json({ fields: src, cached: false }, 200);

    const hash = await sha256(JSON.stringify(src) + '|' + target + '|cvtr-v4');

    if (cacheUserId) {
      const { data: cacheRow } = await admin
        .from('cv_translations').select('source_hash, data').eq('user_id', cacheUserId).eq('lang', target).maybeSingle();
      if (cacheRow && cacheRow.source_hash === hash) {
        return json({ fields: cacheRow.data, cached: true }, 200);
      }
    }

    if (!geminiKey) return json({ error: 'missing_gemini_key' }, 500);

    let fields: Src;
    try {
      const parsed = await translateWithGemini(src, target, geminiKey, model);
      fields = normalize(parsed, src);
    } catch {
      return json({ error: 'ai_unavailable' }, 502);
    }

    if (cacheUserId) {
      await admin.from('cv_translations').upsert(
        { user_id: cacheUserId, lang: target, source_hash: hash, data: fields, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,lang' },
      );
    }

    return json({ fields, cached: false }, 200);
  } catch (e) {
    console.error('translate-cv exception', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
