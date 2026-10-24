#!/usr/bin/env bash
# Configure one shared dispatcher secret in Supabase and GitHub Actions.
# Run from an authenticated Codespace. Never print or commit the secret.
set -euo pipefail
umask 077

REPO="WalterMatheusgg/Licits"
PROJECT_REF="nefimqoszcidsnqvlnnh"
DISPATCH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/dispatch-budget-alerts"

for cmd in gh openssl; do
  command -v "$cmd" >/dev/null || { echo "Ferramenta ausente: $cmd"; exit 1; }
done

# Codespaces may supply a GH_TOKEN/GITHUB_TOKEN without repository secrets permission.
# gh auth status may succeed even when the integration cannot manage secrets.
if ! gh api "repos/${REPO}/actions/secrets/public-key" --jq '.key_id' >/dev/null 2>&1; then
  cat >&2 <<'ERROR'
O GitHub CLI não tem permissão Actions: secrets (HTTP 403).
Nenhum segredo será gerado ou alterado por esta execução.
No terminal do Codespaces, faça:
  unset GH_TOKEN GITHUB_TOKEN
  gh auth login --hostname github.com --web --scopes repo
  gh api repos/WalterMatheusgg/Licits/actions/secrets/public-key --jq .key_id
Depois execute bash scripts/configurar-alertas.sh novamente.
ERROR
  exit 1
fi

# Authenticate CLI to Supabase before running this script (npx supabase login).
npx --yes supabase --version >/dev/null

TEMP_FILE="$(mktemp)"
trap 'rm -f "$TEMP_FILE"; unset ALERT_TOKEN' EXIT
ALERT_TOKEN="$(openssl rand -hex 32)"
printf 'ALERT_DISPATCH_SECRET=%s\n' "$ALERT_TOKEN" > "$TEMP_FILE"

echo "Configurando ALERT_DISPATCH_SECRET no Supabase..."
npx --yes supabase secrets set --project-ref "$PROJECT_REF" --env-file "$TEMP_FILE"

echo "Configurando GitHub repository secrets..."
printf '%s' "$ALERT_TOKEN" | gh secret set LICITS_ALERT_DISPATCH_SECRET --repo "$REPO"
printf '%s' "$DISPATCH_URL" | gh secret set LICITS_DISPATCH_URL --repo "$REPO"

echo "Segredo compartilhado configurado no Supabase e GitHub. Valor não exibido."
echo "Para concluir o envio, confirme RESEND_FROM_EMAIL com remetente autorizado no Resend."
echo "Depois teste com um destinatário de homologação autorizado e valide o resultado no Resend."
