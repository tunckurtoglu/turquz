// supabase/functions/verify-passport/index.ts
// Pasaport doğrulama. Akış:
//   1) Çağıran kullanıcıyı JWT ile doğrula
//   2) user_documents'tan dosya yolunu al, storage'dan (service role) indir
//   3) Gemini'ye gönder -> JSON: { isPassport, readable, expiryDate, mrz, confidence }
//   4) Kural: son kullanma < 1 yıl -> reddet; okunaksız -> tekrar; düşük güven -> insan incelemesi
//   5) user_documents.status / expiry_date / note güncelle, sonucu döndür
//
// Gerekli secret: GEMINI_API_KEY  (opsiyonel: GEMINI_MODEL, vars. gemini-2.0-flash)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY otomatik enjekte edilir.
//
// Deploy:  supabase functions deploy verify-passport
// Secret:  supabase secrets set GEMINI_API_KEY=...
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROMPT = `You are verifying a passport document (photo scan or PDF) submitted for a job application.
The file may be a JPEG/PNG photo of the passport data page OR a PDF scan of that page.
Read the document carefully and return ONLY a JSON object with EXACTLY this shape:
{
  "isPassport": boolean,        // true only if this is a passport data/photo page (with MRZ)
  "readable": boolean,          // true only if the text and MRZ are clearly legible (not blurry, cropped, or glared)
  "expiryDate": string|null,    // expiry date "YYYY-MM-DD"; from MRZ when possible; null if not legible
  "passportNumber": string|null,// passport/document number (latin/digits, no spaces)
  "surname": string|null,       // surname in LATIN letters (from MRZ/visual)
  "givenNames": string|null,    // given names in LATIN letters
  "birthDate": string|null,     // date of birth "YYYY-MM-DD"
  "placeOfBirth": string|null,  // ONLY "Place of birth" / "Doğum yeri" field (city or city+country). NOT place of issue, NOT address, NOT nationality alone.
  "placeOfIssue": string|null,  // issuing authority / place of issue if printed — never copy into placeOfBirth
  "nationality": string|null,   // nationality / country (latin), else null
  "sex": string|null,           // "M" or "F" if legible, else null
  "mrz": string|null,           // machine-readable zone lines exactly as seen, else null
  "confidence": number          // 0..1 overall extraction confidence
}
Return only the JSON, no extra text.

Rules for placeOfBirth:
- Read ONLY the visual field labeled "Place of birth", "Doğum yeri", or equivalent.
- NEVER use: place of issue, issuing authority, holder address, residence, registration address, or nationality alone.
- If the place of birth field is missing or illegible, set placeOfBirth to null (do not guess from other fields).`;

type Parsed = {
  isPassport?: boolean;
  readable?: boolean;
  expiryDate?: string | null;
  passportNumber?: string | null;
  surname?: string | null;
  givenNames?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  placeOfIssue?: string | null;
  nationality?: string | null;
  sex?: string | null;
  mrz?: string | null;
  confidence?: number;
};

// Kural motoru: status user_documents CHECK ile uyumlu ('valid'|'invalid'|'unreadable'|'review')
function decide(p: Parsed): { status: string; expiryDate: string | null; note: string | null } {
  if (p.isPassport === false) return { status: 'invalid', expiryDate: null, note: 'not_passport' };
  if (!p.readable || !p.expiryDate) return { status: 'unreadable', expiryDate: null, note: 'unreadable' };

  const exp = new Date(`${p.expiryDate}T00:00:00Z`);
  if (isNaN(exp.getTime())) return { status: 'unreadable', expiryDate: null, note: 'bad_date' };

  const now = new Date();
  const oneYear = new Date(now);
  oneYear.setUTCFullYear(now.getUTCFullYear() + 1);

  if (exp.getTime() < now.getTime()) return { status: 'invalid', expiryDate: p.expiryDate, note: 'expired' };
  if (exp.getTime() < oneYear.getTime()) return { status: 'invalid', expiryDate: p.expiryDate, note: 'expiring_soon' };

  // Geçerli ama güven düşükse insan incelemesine bırak
  if (typeof p.confidence === 'number' && p.confidence < 0.6) {
    return { status: 'review', expiryDate: p.expiryDate, note: 'low_confidence' };
  }
  return { status: 'valid', expiryDate: p.expiryDate, note: null };
}

function norm(s: string | null | undefined): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// AI bazen ikamet adresini veya veriliş yerini doğum yeri sanıyor — süz.
function sanitizePlaceOfBirth(
  placeOfBirth: string | null | undefined,
  profile: { location?: string; nationality?: string } | null,
): string | null {
  const pob = String(placeOfBirth || '').trim();
  if (!pob) return null;
  const pobN = norm(pob);
  const locN = norm(profile?.location);
  const natN = norm(profile?.nationality);
  if (locN && pobN === locN) return null;
  if (locN && locN.length > 8 && pobN.length > 8 && (locN.includes(pobN) || pobN.includes(locN))) return null;
  if (natN && pobN === natN) return null;
  return pob;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
    if (!geminiKey) { console.error('missing_gemini_key'); return json({ error: 'missing_gemini_key' }, 500); }

    // 1) Kullanıcıyı doğrula
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind ?? 'passport';

    // 2) Dosya yolunu al + indir (service role)
    const admin = createClient(url, serviceKey);
    const { data: docRow } = await admin
      .from('user_documents')
      .select('storage_path, mime_type')
      .eq('user_id', user.id)
      .eq('kind', kind)
      .maybeSingle();
    if (!docRow) return json({ error: 'document_not_found' }, 404);

    const { data: file, error: dlErr } = await admin.storage.from('documents').download(docRow.storage_path);
    if (dlErr || !file) return json({ error: 'download_failed' }, 500);

    const base64 = encodeBase64(new Uint8Array(await file.arrayBuffer()));
    const mimeType = docRow.mime_type ?? 'image/jpeg';
    if (!/^image\/(jpeg|png|webp)|application\/pdf$/.test(mimeType)) {
      return json({ error: 'unsupported_mime' }, 400);
    }

    // 3) Gemini çağrısı — YÜKSEK HACİM için dayanıklı:
    //    her model için 2 deneme (jitter'lı backoff); model yoğun/yoksa SIRADAKİ yedek modele düş.
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      // thinkingBudget: 0 -> 2.5-flash "düşünme" modunu kapatır; OCR çok daha HIZLI biter.
      generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    });
    const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
    const RETRY = new Set([429, 500, 502, 503, 504]);
    let gres: Response | null = null;
    for (const m of MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      let okThisModel = false;
      for (let i = 0; i < 2; i++) {
        gres = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
        if (gres.ok) { okThisModel = true; break; }
        if (!RETRY.has(gres.status)) break; // 404/400 vb -> bu modelde tekrar deneme, sıradakine geç
        console.warn('gemini retry', m, i + 1, gres.status);
        await new Promise((r) => setTimeout(r, 500 * (i + 1) + Math.floor(Math.random() * 300)));
      }
      if (okThisModel) break;
      console.warn('gemini model fallback ->', m, 'başarısız');
    }
    if (!gres || !gres.ok) {
      // AI geçici olarak ulaşılamıyor (ör. 503 yoğunluk). Adayı ASLA hata ile bloklama:
      // belgeyi 'review'a al (acente/insan kontrol eder), 200 ile olumlu dön.
      const detail = gres ? await gres.text() : 'no_response';
      console.error('ai_unavailable', gres?.status, detail.slice(0, 300));
      await admin
        .from('user_documents')
        .update({ status: 'review', note: 'ai_unavailable', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('kind', kind);
      return json({ status: 'review', expiryDate: null, note: 'ai_unavailable', fields: null }, 200);
    }
    const gjson = await gres.json();
    const text = gjson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let parsed: Parsed = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    // 4) Kural + 5) güncelle
    const result = decide(parsed);
    // Teşhis logu (gizli veri yok: yalnızca bayraklar + karar). Sorun çözülünce kaldırılabilir.
    console.log('verify-passport verdict', JSON.stringify({
      isPassport: parsed.isPassport,
      readable: parsed.readable,
      hasExpiry: !!parsed.expiryDate,
      confidence: parsed.confidence,
      status: result.status,
      note: result.note,
    }));
    await admin
      .from('user_documents')
      .update({ status: result.status, expiry_date: result.expiryDate, note: result.note, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('kind', kind);

    // Çıkarılan alanlar (yalnız geçerli/incelemede): formu otomatik doldurmak için.
    let fields: Record<string, string | null> | null = null;
    if (result.status === 'valid' || result.status === 'review') {
      const { data: prof } = await admin.from('profiles').select('data').eq('user_id', user.id).maybeSingle();
      const pdata = (prof?.data ?? {}) as { location?: string; nationality?: string };
      fields = {
        passportNumber: parsed.passportNumber ?? null,
        surname: parsed.surname ?? null,
        givenNames: parsed.givenNames ?? null,
        birthDate: parsed.birthDate ?? null,
        placeOfBirth: sanitizePlaceOfBirth(parsed.placeOfBirth, pdata),
        nationality: parsed.nationality ?? null,
        sex: parsed.sex ?? null,
      };
    }

    return json({ status: result.status, expiryDate: result.expiryDate, note: result.note, fields }, 200);
  } catch (e) {
    console.error('verify-passport exception', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
