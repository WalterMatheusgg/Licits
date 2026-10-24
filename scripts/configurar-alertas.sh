#!/usr/bin/env bash
# Execute in an authenticated Codespace. Creates one secret on both services.
# Never echoes the token, stores it in git, or prints existing private keys.
set -euo pipefail
umask 077

PROJECT_REF="nefimqoszcidsnqvlnnh"
DISPATCH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/dispatch-budget-alerts"

for cmd in gh openssl; do
  command -v "$cmd" >/dev/null || { echo "Ferramenta ausente: $cmd"; exit 1; }
done
gh auth status >/dev/null 2>&1 || { echo "Autentique GitHub CLI (gh auth login)."; exit 1; }
# The Supabase CLI session/project must already be linked and authenticated.
npx --yes supabase --version >/dev/null

TEMP_FILE="$(mktemp)"
trap 'rm -f "$TEMP_FILE"; unset ALERT_TOKEN' EXIT
ALERT_TOKEN="$(openssl rand -hex 32)"
printf 'ALERT_DISPATCH_SECRET=%s\n' "$ALERT_TOKEN" > "$TEMP_FILE"

echo "Configurando ALERT_DISPATCH_SECRET no Supabase..."
npx --yes supabase secrets set --project-ref "$PROJECT_REF" --env-file "$TEMP_FILE"

echo "Configurando GitHub repository secrets..."
printf '%s' "$ALERT_TOKEN" | gh secret set LICITS_ALERT_DISPATCH_SECRET --repo WalterMatheusgg/Licits
printf '%s' "$DISPATCH_URL" | gh secret set LICITS_DISPATCH_URL --repo WalterMatheusgg/Licits

echo "Segredo configurado nos dois serviços, sem imprimir o valor."
echo "Ainda é necessário configurar e verificar RESEND_FROM_EMAIL e RESEND_API_KEY no Supabase."
echo "Confira o remetente verificado e execute o workflow de homologação com uma fila de teste autorizada."
