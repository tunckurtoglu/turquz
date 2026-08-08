// supabase/functions/contract-portal/index.ts
// Sözleşme web portalı API:
//   create_link (auth) → portal URL + ödeme durumu
//   payload / status / checkout (token) → önizleme verisi / Stripe Checkout
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isPaid(status?: string | null) {
  return status === 'paid' || status === 'waived';
}

function randomToken() {
  const u = new Uint8Array(24);
  crypto.getRandomValues(u);
  return Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** CONTRACT_PORTAL_URL örn. https://xxx.vercel.app/sozlesme — token query olarak eklenir. */
function portalUrl(token: string, extra: Record<string, string> = {}) {
  const raw = (Deno.env.get('CONTRACT_PORTAL_URL') || 'https://contract.turquz.app/sozlesme').trim();
  const base = raw.includes('://') ? raw : `https://${raw}`;
  const u = new URL(base);
  u.searchParams.set('t', token);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return u.toString();
}

function contractFields(row: Record<string, unknown>) {
  return {
    title: row.title || '',
    address: row.address || '',
    phone: row.phone || '',
    email: row.email || '',
    contactPhone: row.contact_phone || '',
    contactEmail: row.contact_email || '',
    position: row.position || '',
    salary: row.salary || '',
    consulate: row.consulate || '',
    issueDate: row.issue_date || '',
  };
}

async function loadSignature(admin: ReturnType<typeof createClient>, candidateId: string, createdBy: string | null) {
  const { data: log } = await admin
    .from('contract_signature_log')
    .select('id, signed_at, doc_hash, signer_name, signer_title, signer_user_id')
    .eq('candidate_user_id', candidateId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!log) return null;

  const signerId = log.signer_user_id || createdBy;
  let image: string | null = null;
  if (signerId) {
    const { data: sig } = await admin
      .from('business_signatures')
      .select('image_data')
      .eq('user_id', signerId)
      .maybeSingle();
    image = sig?.image_data || null;
  }
  if (!image) return null;

  const p = (n: number) => String(n).padStart(2, '0');
  const w = log.signed_at ? new Date(log.signed_at) : new Date();
  const dateStr = `${p(w.getDate())}/${p(w.getMonth() + 1)}/${w.getFullYear()} ${p(w.getHours())}:${p(w.getMinutes())}`;
  const ref = String(log.id || '').slice(0, 8).toUpperCase();
  const auditLine = `E-imza / E-signed · ${dateStr} · Ref: ${ref} · SHA-256: ${log.doc_hash || ''}`;

  return {
    image,
    name: log.signer_name || '',
    subtitle: log.signer_title || '',
    auditLine,
  };
}

async function rowByToken(admin: ReturnType<typeof createClient>, token: string) {
  if (!token || token.length < 16) return null;
  const { data } = await admin
    .from('contracts')
    .select('*')
    .eq('portal_token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.portal_token_expires_at && new Date(data.portal_token_expires_at).getTime() < Date.now()) {
    return null;
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    // ---- create_link (aday oturumu) ----
    if (action === 'create_link') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) return json({ error: 'unauthorized' }, 401);

      const { data: row, error: cErr } = await admin
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cErr || !row) return json({ error: 'no_contract' }, 404);

      const token = randomToken();
      const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      await admin.from('contracts').update({
        portal_token: token,
        portal_token_expires_at: expires,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);

      const paid = isPaid(row.payment_status);
      return json({
        url: portalUrl(token),
        paid,
        paymentStatus: row.payment_status || 'unpaid',
      });
    }

    // ---- token gerektiren işlemler ----
    const token = String(body?.token || '');
    const row = await rowByToken(admin, token);
    if (!row) return json({ error: 'invalid_token' }, 401);

    if (action === 'status') {
      return json({ paid: isPaid(row.payment_status), paymentStatus: row.payment_status || 'unpaid' });
    }

    if (action === 'payload') {
      const { data: prof } = await admin
        .from('profiles')
        .select('data')
        .eq('user_id', row.user_id)
        .maybeSingle();
      const data = (prof?.data && typeof prof.data === 'object') ? prof.data : {};
      const signature = await loadSignature(admin, row.user_id, row.created_by);
      return json({
        paid: isPaid(row.payment_status),
        paymentStatus: row.payment_status || 'unpaid',
        data,
        contract: contractFields(row),
        signature,
      });
    }

    if (action === 'checkout') {
      if (isPaid(row.payment_status)) {
        return json({ paid: true, paymentStatus: row.payment_status });
      }

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
      const successBase = portalUrl(token, { paid: '1' });
      const cancelBase = portalUrl(token);

      // Geliştirme: Stripe yoksa ve bypass açıksa tek tıkla paid işaretle.
      if (!stripeKey) {
        if (Deno.env.get('CONTRACT_PAYMENT_DEV_BYPASS') === 'true') {
          await admin.from('contracts').update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('user_id', row.user_id);
          return json({ paid: true, paymentStatus: 'paid', checkoutUrl: successBase });
        }
        return json({ error: 'stripe_not_configured' }, 503);
      }

      const amount = parseInt(Deno.env.get('CONTRACT_FEE_AMOUNT') || '9900', 10); // kuruş / cents
      const currency = (Deno.env.get('CONTRACT_FEE_CURRENCY') || 'try').toLowerCase();
      const label = Deno.env.get('CONTRACT_FEE_LABEL') || 'Sözleşme işlem ücreti / Contract processing fee';
      const priceId = Deno.env.get('STRIPE_PRICE_ID') || '';

      const params = new URLSearchParams();
      params.set('mode', 'payment');
      params.set('success_url', successBase);
      params.set('cancel_url', cancelBase);
      params.set('client_reference_id', row.user_id);
      params.set('metadata[candidate_user_id]', row.user_id);
      params.set('metadata[portal_token]', token);
      if (priceId) {
        params.set('line_items[0][price]', priceId);
        params.set('line_items[0][quantity]', '1');
      } else {
        params.set('line_items[0][price_data][currency]', currency);
        params.set('line_items[0][price_data][unit_amount]', String(amount));
        params.set('line_items[0][price_data][product_data][name]', label);
        params.set('line_items[0][quantity]', '1');
      }

      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const session = await stripeRes.json();
      if (!stripeRes.ok || !session?.url) {
        console.error('stripe checkout error', session);
        return json({ error: 'checkout_failed', detail: session?.error?.message }, 502);
      }

      await admin.from('contracts').update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      }).eq('user_id', row.user_id);

      return json({ checkoutUrl: session.url, paid: false });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'server_error', message: String((e as Error)?.message || e) }, 500);
  }
});
