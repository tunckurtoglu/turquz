// supabase/functions/contract-stripe-webhook/index.ts
// Stripe Checkout tamamlanınca contracts.payment_status = paid.
// Dashboard → Webhooks → endpoint: .../functions/v1/contract-stripe-webhook
// Event: checkout.session.completed
// Secret: STRIPE_WEBHOOK_SECRET
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enc = new TextEncoder();

function secretKeyBytes(secret: string) {
  if (secret.startsWith('whsec_')) {
    const b64 = secret.slice(6);
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return enc.encode(secret);
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const raw = await req.text();
  const sigHeader = req.headers.get('stripe-signature') || '';

  if (secret) {
    // Stripe-Signature: t=...,v1=...
    const parts = Object.fromEntries(
      sigHeader.split(',').map((p) => {
        const [k, ...rest] = p.split('=');
        return [k.trim(), rest.join('=')];
      }),
    );
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return new Response('bad sig', { status: 400 });
    const expected = await hmacSha256Hex(secret, `${t}.${raw}`);
    if (!timingSafeEqual(expected, v1)) return new Response('invalid sig', { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ ok: true, skipped: event.type }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = event.data?.object || {};
  const meta = (session.metadata || {}) as Record<string, string>;
  const userId = meta.candidate_user_id || (session.client_reference_id as string) || '';
  const sessionId = session.id as string | undefined;

  if (!userId) return new Response('no user', { status: 400 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey);

  const patch: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (sessionId) patch.stripe_session_id = sessionId;

  const { error } = await admin.from('contracts').update(patch).eq('user_id', userId);
  if (error) {
    console.error(error);
    return new Response('db error', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
