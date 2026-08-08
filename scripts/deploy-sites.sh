#!/usr/bin/env bash
# Geçici Vercel URL'lerine tüm siteleri deploy eder (domain bağlanana kadar).
# Önkoşul: npx vercel login  (bir kez)
# web/web-admin: prebuild sync-shared → _shared (parent monorepo kopyası) gerekir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export VERCEL_TELEMETRY_DISABLED=1

if [[ -f "$ROOT/web/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/web/.env"
  set +a
fi

deploy_one() {
  local dir="$1"
  local name="$2"
  echo ""
  echo "======== Deploy: $name ($dir) ========"
  cd "$ROOT/$dir"
  if [[ ! -d node_modules ]]; then npm install; fi
  # lokal sync (Vercel'e _shared yüklensin)
  if [[ -f scripts/sync-shared.js ]]; then node scripts/sync-shared.js; fi
  npx --yes vercel@latest deploy --yes --prod --name "turquz-$name" \
    --build-env VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-}" \
    --build-env VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-}" \
    ${VITE_PDF_URL:+--build-env VITE_PDF_URL="$VITE_PDF_URL"} \
    ${VITE_PDF_TOKEN:+--build-env VITE_PDF_TOKEN="$VITE_PDF_TOKEN"}
}

deploy_one site main
deploy_one site-careers careers
deploy_one site-medical medical
deploy_one web agency-panel
deploy_one web-admin admin-panel

echo ""
echo "Bitti. Production URL'ler:"
echo "  https://turquz-main.vercel.app"
echo "  https://turquz-careers.vercel.app"
echo "  https://turquz-medical.vercel.app"
echo "  https://turquz-agency-panel.vercel.app"
echo "  https://turquz-admin-panel.vercel.app"
echo "Sözleşme: https://turquz-careers.vercel.app/sozlesme"
echo "Sonra:"
echo "  supabase secrets set CONTRACT_PORTAL_URL='https://turquz-careers.vercel.app/sozlesme'"
echo "  supabase functions deploy contract-portal"
