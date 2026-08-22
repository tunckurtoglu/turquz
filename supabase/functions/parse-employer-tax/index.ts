// supabase/functions/parse-employer-tax/index.ts
// Vergi levhası → yalnızca sözleşmede levhaya karşılık gelen alanlar:
//   title (ticaret unvanı), address (işyeri adresi), tax_no, tax_office, name (liste adı).
// Telefon / e-posta levhada yok → dokunulmaz, elle kalır.
// 1) GİB PDF metninden yerel parse  2) Eksik (özellikle VKN) için Gemini
// Body: { employerId }  Secret: GEMINI_API_KEY
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding/base64';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PROMPT = `You extract ONLY the fields we need for a Turkish employment contract from a GİB Vergi Levhası.

Map plate → our fields:
- title ← TİCARET ÜNVANI (full legal company name)
- address ← İŞYERİ ADRESİ
- taxNo ← VERGİ KİMLİK NO (VKN, 10 digits; often near barcode)
- taxOffice ← VERGİ DAİRESİ (e.g. ANTALYA KURUMLAR)
- name ← short list/hotel name if obvious (else shortened title)

Do NOT extract phone or email (they are not on the plate; agencies fill those manually).
Ignore tax history table, activity codes, barcodes text except VKN digits.

Return ONLY JSON:
{
  "isTaxPlate": boolean,
  "readable": boolean,
  "name": string|null,
  "title": string|null,
  "address": string|null,
  "taxNo": string|null,
  "taxOffice": string|null,
  "confidence": number
}

isTaxPlate true for GİB vergi levhası. readable true if title OR address OR taxNo is readable.
taxNo digits only. Do not invent missing fields — use null.
Return only the JSON.`;

type Parsed = {
  isTaxPlate?: boolean;
  readable?: boolean;
  name?: string | null;
  title?: string | null;
  address?: string | null;
  taxNo?: string | null;
  taxOffice?: string | null;
  confidence?: number;
};

function clean(s: unknown): string | null {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t || null;
}

/** GİB PDF'lerde sık görülen MacTurkish/Win-1254 → Latin-1 bozuk karakterleri. */
function fixTr(s: string): string {
  return s
    .replace(/Ý/g, 'İ').replace(/ý/g, 'ı')
    .replace(/Þ/g, 'Ş').replace(/þ/g, 'ş')
    .replace(/Ð/g, 'Ğ').replace(/ð/g, 'ğ')
    .replace(/Ø/g, 'Ö').replace(/ø/g, 'ö');
}

/** PDF FlateDecode içerisinden literal string'leri çek (GİB metin levhaları için). */
async function inflateBytes(raw: Uint8Array): Promise<Uint8Array | null> {
  let start = 0;
  while (start < raw.length && (raw[start] === 0x0a || raw[start] === 0x0d || raw[start] === 0x20)) start++;
  const sliced = raw.subarray(start);
  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(format);
      const stream = new Blob([sliced]).stream().pipeThrough(ds);
      const ab = await new Response(stream).arrayBuffer();
      return new Uint8Array(ab);
    } catch { /* next */ }
  }
  return null;
}

async function extractPdfTextAsync(bytes: Uint8Array): Promise<string> {
  const data = new TextDecoder('latin1').decode(bytes);
  const outs: string[] = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(data))) {
    const raw = new TextEncoder().encode(m[1]);
    const dec = await inflateBytes(raw);
    if (!dec) continue;
    const chunk = new TextDecoder('latin1').decode(dec);
    const lit = /\((?:\\.|[^\\)])*\)/g;
    let lm: RegExpExecArray | null;
    while ((lm = lit.exec(chunk))) {
      let t = lm[0].slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      t = fixTr(t).trim();
      if (t.length >= 2 && /[A-Za-zÀ-ÿİıŞşĞğÜüÖöÇç0-9]/.test(t)) outs.push(t);
    }
  }
  return outs.join('\n');
}

function looksLikeGibPlate(text: string): boolean {
  const u = text.toLocaleUpperCase('tr-TR');
  return /VERG[İI]\s*LEVHASI/.test(u)
    || /T[İI]CARET\s+[ÜU]NVANI/.test(u)
    || /VERG[İI]\s*K[İI]ML[İI]K/.test(u)
    || /GEL[İI]R\s+[İI]DARES[İI]/.test(u);
}

function shortNameFrom(title: string | null, address: string | null): string | null {
  if (address) {
    const hotel = address.match(/\b([A-ZÇĞİÖŞÜ0-9][A-ZÇĞİÖŞÜa-zçğıöşü0-9' ]{1,40}\s+HOTEL)\b/u);
    if (hotel) return clean(hotel[1]);
  }
  if (!title) return null;
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length <= 3) return title;
  // İlk anlamlı kelimeler (İNŞAAT/TURİZM vb. sektör kelimesinden önce)
  const stop = new Set(['İNŞAAT', 'KOZMETİK', 'TURİZM', 'SANAYİ', 'TİCARET', 'LİMİTED', 'ŞİRKETİ', 'ANONİM', 'A.Ş.', 'AŞ']);
  const keep: string[] = [];
  for (const p of parts) {
    if (stop.has(p.toLocaleUpperCase('tr-TR'))) break;
    keep.push(p);
    if (keep.length >= 3) break;
  }
  return clean(keep.join(' ')) || clean(parts.slice(0, 2).join(' '));
}

/** GİB metin levhasından alan çıkar. */
function parseGibText(text: string): Parsed {
  const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const blob = lines.join('\n');
  const upper = blob.toLocaleUpperCase('tr-TR');

  if (!looksLikeGibPlate(blob)) {
    return { isTaxPlate: false, readable: false, confidence: 0 };
  }

  let title: string | null = null;
  const titleIdx = lines.findIndex((l) => /LİMİTED\s+ŞİRKETİ|ANONİM\s+ŞİRKETİ|\bA\.?\s*Ş\.?\b|ŞİRKETİ$/i.test(l) && l.length > 20);
  if (titleIdx >= 0) title = clean(lines[titleIdx]);
  if (!title) {
    const m = blob.match(/MÜKELLEFİN\s*\n?\s*([^\n]{10,180})/i);
    if (m) title = clean(m[1]);
  }

  let address: string | null = null;
  const addrIdx = lines.findIndex((l) => /\b(MAH\.|MAHALLES[İI]|CAD\.|SK\.|SOK\.|NO:)/i.test(l));
  if (addrIdx >= 0) {
    let a = lines[addrIdx];
    if (addrIdx + 1 < lines.length && /\/|\bANTALYA\b|\bİSTANBUL\b|\bANKARA\b|\bİZMİR\b|\bMUĞLA\b|\bAYDIN\b/i.test(lines[addrIdx + 1]) && lines[addrIdx + 1].length < 60) {
      a = `${a} ${lines[addrIdx + 1]}`;
    }
    address = clean(a);
  }

  let taxOffice: string | null = null;
  const officeLine = lines.find((l) => /KURUMLAR|VERG[İI]\s*DA[İI]RES[İI]/i.test(l) && !/VERG[İI]\s*T[ÜU]R[ÜU]/i.test(l) && l.length < 80);
  if (officeLine) {
    if (/KURUMLAR\s*VERG/i.test(officeLine) && !/KURUMLAR$/i.test(officeLine)) {
      // "KURUMLAR VERGİSİ" is tax type, not office — look for "ANTALYA KURUMLAR"
      const off2 = lines.find((l) => /^[A-ZÇĞİÖŞÜ\s]{3,40}KURUMLAR$/i.test(l.trim()));
      taxOffice = clean(off2 || null);
    } else {
      taxOffice = clean(officeLine);
    }
  }
  if (!taxOffice) {
    const m = blob.match(/\b([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s]{2,40}KURUMLAR)\b/);
    taxOffice = clean(m?.[1] || null);
  }

  // VKN: 10 hane; TC 11 haneyi ele. Barkod bazen metinde yok.
  let taxNo: string | null = null;
  const tens = [...blob.matchAll(/\b(\d{10})\b/g)].map((x) => x[1]);
  const elevens = new Set([...blob.matchAll(/\b(\d{11})\b/g)].map((x) => x[1]));
  for (const n of tens) {
    if (![...elevens].some((e) => e.includes(n))) {
      taxNo = n;
      break;
    }
  }

  const name = shortNameFrom(title, address);
  const hasCore = !!(title || address || taxNo);
  return {
    isTaxPlate: true,
    readable: hasCore,
    name,
    title,
    address,
    taxNo,
    taxOffice,
    confidence: hasCore ? (taxNo ? 0.92 : 0.8) : 0.4,
  };
}

function mergeParsed(a: Parsed, b: Parsed): Parsed {
  const pick = (x: string | null | undefined, y: string | null | undefined) => clean(x) || clean(y) || null;
  const title = pick(a.title, b.title);
  const address = pick(a.address, b.address);
  const taxNo = (clean(a.taxNo) || clean(b.taxNo) || '')?.replace(/\D/g, '') || null;
  const taxOffice = pick(a.taxOffice, b.taxOffice);
  const name = pick(a.name, b.name) || shortNameFrom(title, address);
  const isTaxPlate = a.isTaxPlate === true || b.isTaxPlate === true;
  const hasCore = !!(title || address || taxNo);
  return {
    isTaxPlate,
    readable: a.readable === true || b.readable === true || hasCore,
    name,
    title,
    address,
    taxNo: taxNo && taxNo.length >= 10 ? taxNo.slice(0, 11) : taxNo,
    taxOffice,
    confidence: Math.max(a.confidence || 0, b.confidence || 0),
  };
}

async function callGemini(
  geminiKey: string,
  model: string,
  mimeType: string,
  base64: string,
): Promise<Parsed | null> {
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
  });
  const MODELS = [...new Set([model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'])];
  const RETRY = new Set([429, 500, 502, 503, 504]);
  let gres: Response | null = null;
  for (const m of MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
    for (let i = 0; i < 2; i++) {
      gres = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      if (gres.ok) break;
      if (!RETRY.has(gres.status)) break;
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    }
    if (gres?.ok) break;
  }
  if (!gres?.ok) {
    const errText = await gres?.text().catch(() => '');
    console.error('gemini_fail', gres?.status, errText?.slice(0, 400));
    return null;
  }
  const gj = await gres.json();
  const text = gj?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try {
    return JSON.parse(text) as Parsed;
  } catch {
    console.error('gemini_json_fail', text?.slice(0, 200));
    return null;
  }
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

    const body = await req.json().catch(() => ({}));
    const employerId = String(body?.employerId || '').trim();
    if (!employerId) return json({ error: 'employer_id_required' }, 400);

    const admin = createClient(url, serviceKey);
    const { data: emp, error: empErr } = await admin
      .from('agency_employers')
      .select('id, agency_id, tax_plate_path, tax_plate_mime, name, title, address, phone, email, tax_no, tax_office')
      .eq('id', employerId)
      .maybeSingle();
    if (empErr || !emp) return json({ error: 'employer_not_found' }, 404);
    if (emp.agency_id !== user.id) return json({ error: 'forbidden' }, 403);
    if (!emp.tax_plate_path) return json({ error: 'tax_plate_missing' }, 400);

    const { data: file, error: dlErr } = await admin.storage.from('agency-docs').download(emp.tax_plate_path);
    if (dlErr || !file) return json({ error: 'download_failed' }, 500);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = encodeBase64(bytes);
    const mimeType = emp.tax_plate_mime || 'application/pdf';
    if (!/^image\/(jpeg|png|webp)|application\/pdf$/.test(mimeType)) {
      return json({ error: 'unsupported_mime' }, 400);
    }

    let local: Parsed = { isTaxPlate: false, readable: false, confidence: 0 };
    if (mimeType === 'application/pdf') {
      try {
        const pdfText = await extractPdfTextAsync(bytes);
        if (pdfText.length > 40) local = parseGibText(pdfText);
        console.log('pdf_text_len', pdfText.length, 'local_ok', !!local.title, !!local.taxNo);
      } catch (e) {
        console.warn('pdf_text_extract', String(e));
      }
    }

    let ai: Parsed | null = null;
    const needAi = !local.taxNo || !local.title || !local.address || local.confidence! < 0.75;
    if (geminiKey && needAi) {
      ai = await callGemini(geminiKey, model, mimeType, base64);
    } else if (!geminiKey && !local.readable) {
      return json({ error: 'missing_gemini_key' }, 500);
    }

    let parsed = ai ? mergeParsed(local, ai) : local;

    // Yerel GİB metni güçlüyse Gemini'nin yanlış "değil / okunamadı" bayrağını ezer.
    if (local.isTaxPlate && (local.title || local.address || local.taxNo)) {
      parsed = mergeParsed(local, ai || {});
      parsed.isTaxPlate = true;
      parsed.readable = true;
    }

    if (parsed.isTaxPlate === false && !parsed.title && !parsed.taxNo) {
      return json({ error: 'not_tax_plate', parsed }, 422);
    }
    if (!parsed.title && !parsed.address && !parsed.taxNo) {
      return json({ error: 'unreadable', parsed }, 422);
    }

    // Yalnızca sözleşmede levhaya karşılık gelen alanlar; telefon/e-posta elle kalır.
    const patch = {
      name: clean(parsed.name) || emp.name,
      title: clean(parsed.title) || emp.title,
      address: clean(parsed.address) || emp.address,
      tax_no: clean(parsed.taxNo)?.replace(/\D/g, '') || emp.tax_no,
      tax_office: clean(parsed.taxOffice) || emp.tax_office,
      tax_plate_parsed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: upErr } = await admin
      .from('agency_employers')
      .update(patch)
      .eq('id', employerId)
      .eq('agency_id', user.id)
      .select('*')
      .single();
    if (upErr) return json({ error: upErr.message }, 500);

    return json({
      ok: true,
      confidence: parsed.confidence ?? null,
      source: local.readable && ai ? 'pdf+ai' : local.readable ? 'pdf' : 'ai',
      employer: updated,
      fields: {
        name: patch.name,
        title: patch.title,
        address: patch.address,
        taxNo: patch.tax_no,
        taxOffice: patch.tax_office,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error)?.message || 'error' }, 500);
  }
});
