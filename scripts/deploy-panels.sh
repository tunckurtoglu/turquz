#!/usr/bin/env bash
# Acente + admin panellerini Vercel production'a deploy eder.
# Uzak "vite build" kuyruğunda takılmamak için: lokal build → statik upload.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export VERCEL_TELEMETRY_DISABLED=1
export CI=1

if [[ -f "$ROOT/web/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/web/.env"
  set +a
fi

deploy_static() {
  local dir="$1"
  local stage="/tmp/turquz-${dir}-static-deploy"
  echo ""
  echo "======== $dir ========"
  cd "$ROOT/$dir"
  if [[ -f .env ]]; then set -a && # shellcheck disable=SC1091
    source .env && set +a; fi
  if [[ -f scripts/sync-shared.js ]]; then node scripts/sync-shared.js; fi
  npm run build
  rm -rf "$stage"
  mkdir -p "$stage/.vercel"
  cp -R dist/. "$stage/"
  cp .vercel/project.json "$stage/.vercel/project.json"
  cat > "$stage/vercel.json" <<'EOF'
{
  "version": 2,
  "framework": null,
  "installCommand": null,
  "buildCommand": null,
  "outputDirectory": ".",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
EOF
  printf '%s\n' '{ "name": "turquz-'"$dir"'-static", "private": true }' > "$stage/package.json"
  cd "$stage"
  npx --yes vercel@latest deploy --yes --prod --scope turquz --force --archive=tgz
}

deploy_static web
deploy_static web-admin

echo ""
echo "Ready:"
echo "  https://turquz-agency-panel.vercel.app"
echo "  https://turquz-admin-panel.vercel.app"
