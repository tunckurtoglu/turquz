# Turquz Kariyer

Landing + gizli sözleşme portalı.

| Path | Kim görür |
|------|-----------|
| `/` | Herkes — kariyer vitrin |
| `/sozlesme?t=TOKEN` | Sadece app’ten gelen aday (menüde link yok) |

## Yerel

```bash
cp ../web/.env .env   # VITE_SUPABASE_*
npm install
npm run dev           # http://localhost:5181
# sözleşme: http://localhost:5181/sozlesme?t=...
```

## Geçici public (domain yokken) — Vercel

Vite sadece derler; internetten erişim için Vercel (ücretsiz `*.vercel.app`):

```bash
npx vercel login
# repo kökünden tüm siteler:
./scripts/deploy-sites.sh
# veya sadece kariyer:
cd site-careers && npm run build && npx vercel deploy --yes --prod
```

Sonra:
```bash
supabase secrets set CONTRACT_PORTAL_URL='https://<vercel-url>/sozlesme'
supabase functions deploy contract-portal
```
