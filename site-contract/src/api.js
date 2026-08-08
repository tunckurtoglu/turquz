const URL = import.meta.env.VITE_SUPABASE_URL || '';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export async function portalCall(body) {
  if (!URL || !KEY) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY eksik');
  const res = await fetch(`${URL}/functions/v1/contract-portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `http_${res.status}`);
  if (data.error) throw new Error(data.error);
  return data;
}
