#!/usr/bin/env bash
# Configure Gmail API for Supabase. Never commits, prints, or stores credentials.
set -euo pipefail
umask 077
PROJECT_REF="nefimqoszcidsnqvlnnh"

echo "Gmail API: autorize antes uma conta Google no OAuth Playground."
read -r -p "E-mail remetente autorizado no Google (ex.: usuario@gmail.com): " GMAIL_FROM_EMAIL
if [[ ! "$GMAIL_FROM_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "E-mail remetente inválido." >&2
  exit 1
fi
read -r -p "Google OAuth Client ID: " GMAIL_CLIENT_ID
read -r -s -p "Google OAuth Client Secret (oculto): " GMAIL_CLIENT_SECRET
printf '\n'
read -r -s -p "Google OAuth Refresh Token (oculto): " GMAIL_REFRESH_TOKEN
printf '\n'
if [[ -z "$GMAIL_CLIENT_ID" || -z "$GMAIL_CLIENT_SECRET" || -z "$GMAIL_REFRESH_TOKEN" ]]; then
  echo "Credenciais incompletas: nenhuma alteração realizada." >&2
  exit 1
fi

TEMP_FILE="$(mktemp)"
trap 'rm -f "$TEMP_FILE"; unset GMAIL_CLIENT_SECRET GMAIL_REFRESH_TOKEN' EXIT
{
  printf 'EMAIL_PROVIDER=gmail\n'
  printf 'GMAIL_FROM_EMAIL=%s\n' "$GMAIL_FROM_EMAIL"
  printf 'GMAIL_CLIENT_ID=%s\n' "$GMAIL_CLIENT_ID"
  printf 'GMAIL_CLIENT_SECRET=%s\n' "$GMAIL_CLIENT_SECRET"
  printf 'GMAIL_REFRESH_TOKEN=%s\n' "$GMAIL_REFRESH_TOKEN"
} > "$TEMP_FILE"
npx --yes supabase secrets set --project-ref "$PROJECT_REF" --env-file "$TEMP_FILE"
echo "Configuração Gmail gravada com segurança no Supabase."
echo "Próximo passo: implantar send-email e dispatch-budget-alerts e testar mensagem real."
