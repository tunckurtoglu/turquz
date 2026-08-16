# Turquz — Sözleşme portalı

Aday uygulamada **Sözleşmeyi aç** deyince bu siteye gelir.

1. Landing (ödeme yok) → **Sözleşmeyi görüntüle**
2. Önizleme → **İndir** → Stripe Checkout
3. Ödeme sonrası PDF yazdır / kaydet
4. Uygulamada imzalı sözleşmeyi yüklemeye devam

## Yerel

```bash
cd site-contract
cp .env.example .env   # VITE_SUPABASE_* doldur
npm install
npm run dev            # http://localhost:5183
```

## Canlıya alma

1. SQL: `supabase/migrations/0055_contract_payment.sql`
2. Secrets (Supabase Edge):
   - `CONTRACT_PORTAL_URL` = `https://contract.turquz.app` (bu sitenin adresi)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - isteğe bağlı: `CONTRACT_FEE_AMOUNT` (kuruş, varsayılan 9900), `CONTRACT_FEE_CURRENCY` (try), `STRIPE_PRICE_ID`
   - test (Stripe yokken): `CONTRACT_PAYMENT_DEV_BYPASS=true` → portalda «Ödeme yap» DB’de paid yapar
3. Deploy functions:
   ```bash
   supabase functions deploy contract-portal
   supabase functions deploy contract-stripe-webhook --no-verify-jwt
   ```
4. Stripe webhook → `.../functions/v1/contract-stripe-webhook` (`checkout.session.completed`)
5. Bu klasörü `npm run build` → `dist/` host et
6. App: `lib/features.js` → `CONTRACT_WEB_PAYMENT_ENABLED = true`
7. `EXPO_PUBLIC_CONTRACT_PORTAL_URL` / `lib/config.js` portal URL
