// supabase/functions/_shared/scanAuth.ts
// Cron (x-cron-secret / service role) veya giriş yapmış kullanıcı.
import { createClient } from 'jsr:@supabase/supabase-js@2';

export const SCAN_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

export const scanJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...SCAN_CORS, 'Content-Type': 'application/json' },
  });

export type ScanAuth = { cron: boolean; userId?: string };

export async function authorizeOpsScan(req: Request): Promise<ScanAuth | Response> {
  const cronSecret = Deno.env.get('CRON_SECRET') || '';
  const given = req.headers.get('x-cron-secret') || '';
  if (cronSecret && given && given === cronSecret) return { cron: true };

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (serviceKey && token && token === serviceKey) return { cron: true };

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return scanJson({ error: 'unauthorized' }, 401);
  return { cron: false, userId: user.id };
}
