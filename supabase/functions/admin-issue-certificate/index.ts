// supabase/functions/admin-issue-certificate/index.ts
// Admin: İngilizce başarı sertifikası PDF yükle, kalıcı kayıt + e-posta + push.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function decodeBase64Pdf(raw: string): Uint8Array {
  const b64 = raw.includes(',') ? raw.split(',').pop()! : raw;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sendResendEmail(opts: {
  to: string;
  candidateName: string;
  pdfBase64: string;
}): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY')?.trim();
  const from = Deno.env.get('CERT_FROM_EMAIL')?.trim() || 'Turquz <certificates@turquz.com>';
  if (!key) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: 'Your Turquz Success Certificate',
      html: `<p>Dear ${opts.candidateName || 'Candidate'},</p>
<p>Congratulations on successfully completing your season with Turquz.</p>
<p>Your personalized Turquz Success Certificate is attached to this email.</p>
<p>You can also download it anytime from the Documents section in the Turquz app.</p>
<p>Best regards,<br/>Turquz Team</p>`,
      attachments: [{
        filename: 'Turquz-Success-Certificate.pdf',
        content: opts.pdfBase64.includes(',') ? opts.pdfBase64.split(',').pop() : opts.pdfBase64,
      }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.warn('Resend failed:', res.status, txt);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(url, serviceKey);
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
    if (roleRow?.role !== 'admin') return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const episodeId = String(body.episodeId || '').trim();
    const candidateUserId = String(body.candidateUserId || '').trim();
    const pdfBase64 = String(body.pdfBase64 || '').trim();
    const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {};
    if (!episodeId || !candidateUserId || !pdfBase64) return json({ error: 'bad_request' }, 400);

    const admin = createClient(url, serviceKey);
    const pdfBytes = decodeBase64Pdf(pdfBase64);
    const storagePath = `${candidateUserId}/${episodeId}_${Date.now()}.pdf`;

    const { error: upErr } = await admin.storage
      .from('certificate-awards')
      .upload(storagePath, pdfBytes, { contentType: 'application/pdf', upsert: false });
    if (upErr) return json({ error: upErr.message }, 500);

    const { data: awardId, error: issueErr } = await userClient.rpc('admin_issue_certificate', {
      p_episode: episodeId,
      p_storage_path: storagePath,
      p_snapshot: snapshot,
    });
    if (issueErr) {
      await admin.storage.from('certificate-awards').remove([storagePath]).catch(() => {});
      return json({ error: issueErr.message }, 500);
    }

    const { data: authUser } = await admin.auth.admin.getUserById(candidateUserId);
    const email = authUser?.user?.email?.trim() || '';
    const candidateName = String(snapshot.candidateName || snapshot.fullName || 'Candidate');

    let emailed = false;
    if (email) {
      emailed = await sendResendEmail({ to: email, candidateName, pdfBase64 });
      if (emailed) {
        await userClient.rpc('admin_mark_certificate_emailed', { p_award: awardId, p_email: email });
      }
    }

    try {
      await userClient.functions.invoke('notify-document', {
        body: { candidateUserId, kind: 'success_certificate' },
      });
    } catch {
      /* push isteğe bağlı */
    }

    return json({ ok: true, awardId, storagePath, emailed, emailTo: email || null });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
