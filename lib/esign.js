// lib/esign.js
// Acente/otel "gelişmiş elektronik imza" (A planı) yardımcıları:
//  - İşletmenin kayıtlı imza+kaşesi (business_signatures)
//  - Her imzalamanın denetim kaydı (contract_signature_log) + belge hash'i (tamper-evidence)
// Native paket YOK: SHA-256 saf JS ile hesaplanır (mevcut build'de çalışır).
import { supabase } from './supabase';

// ---- Kayıtlı imza/kaşe (oturum sahibinin) ----

export async function getMySignature() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('business_signatures')
    .select('image_data, signer_name, signer_title')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) { console.warn('imza okunamadı:', error.message); return null; }
  if (!data) return null;
  return { image: data.image_data, signerName: data.signer_name, signerTitle: data.signer_title || '' };
}

export async function saveMySignature({ image, signerName, signerTitle }) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error('Oturum yok');
  const row = {
    user_id: uid,
    image_data: image,
    signer_name: (signerName || '').trim(),
    signer_title: (signerTitle || '').trim() || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('business_signatures').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function removeMySignature() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return;
  await supabase.from('business_signatures').delete().eq('user_id', uid).catch(() => {});
}

// ---- Denetim kaydı ----
// İmzasız sözleşme hash'i + imzalayan bilgisi DB'ye yazılır. Döner: { id, signed_at }.
export async function logContractSignature({ candidateUserId, signerName, signerTitle, docNo, docHash, platform }) {
  const { data, error } = await supabase
    .from('contract_signature_log')
    .insert({
      candidate_user_id: candidateUserId,
      signer_name: signerName,
      signer_title: signerTitle || null,
      doc_no: docNo || null,
      doc_hash: docHash,
      platform: platform || null,
    })
    .select('id, signed_at')
    .single();
  if (error) throw error;
  return data;
}

// Bir adayın sözleşmesi için EN SON imza kaydı (önizlemeyi imzalı çizmek için).
export async function getLatestContractSignature(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase
    .from('contract_signature_log')
    .select('id, signed_at, doc_hash, signer_name, signer_title')
    .eq('candidate_user_id', candidateUserId)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.warn('imza kaydı okunamadı:', error.message); return null; }
  return data || null;
}

// İmza denetim satırı (PDF + önizleme aynı biçim). log: {id, signed_at, doc_hash}
export function buildAuditLine(log) {
  if (!log) return '';
  const p = (n) => String(n).padStart(2, '0');
  const w = log.signed_at ? new Date(log.signed_at) : new Date();
  const dateStr = `${p(w.getDate())}/${p(w.getMonth() + 1)}/${w.getFullYear()} ${p(w.getHours())}:${p(w.getMinutes())}`;
  const ref = (log.id || '').slice(0, 8).toUpperCase();
  return `E-imza / E-signed · ${dateStr} · Ref: ${ref} · SHA-256: ${log.doc_hash || ''}`;
}

// ---- Saf JS SHA-256 (UTF-8 string -> hex). Belge bütünlüğü kanıtı için. ----
export async function sha256Hex(str) {
  return sha256(utf8Bytes(str));
}

function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else if (c >= 0xd800 && c <= 0xdbff) { // surrogate pair
      const c2 = str.charCodeAt(++i);
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }
  return out;
}

function sha256(bytes) {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;

  const l = bytes.length;
  const withOne = bytes.slice();
  withOne.push(0x80);
  while (withOne.length % 64 !== 56) withOne.push(0);
  const bitLen = l * 8;
  for (let i = 7; i >= 0; i--) withOne.push((bitLen / Math.pow(2, i * 8)) & 0xff);

  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const w = new Array(64);

  for (let off = 0; off < withOne.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = (withOne[off+i*4] << 24) | (withOne[off+i*4+1] << 16) | (withOne[off+i*4+2] << 8) | (withOne[off+i*4+3]);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h=g; g=f; f=e; e=(d + t1)|0; d=c; c=b; b=a; a=(t1 + t2)|0;
    }
    h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
  }
  const toHex = (x) => (x >>> 0).toString(16).padStart(8, '0');
  return toHex(h0)+toHex(h1)+toHex(h2)+toHex(h3)+toHex(h4)+toHex(h5)+toHex(h6)+toHex(h7);
}
