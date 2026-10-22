#!/usr/bin/env bash
# Restauracao LOCAL de configuracao do Licits (nao cria usuarios e nao toca no banco).
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [[ $# -gt 0 && "$1" == "--status" ]]; then
  for file in .env .env.local; do
    if [[ -f "$file" ]]; then
      if grep -Eq '^VITE_SUPABASE_URL=https?://' "$file" && grep -Eq '^VITE_SUPABASE_(PUBLISHABLE_KEY|ANON_KEY)=.+' "$file"; then
        echo "[PRESENTE] $file contem URL e chave publica; a validade ainda deve ser conferida."
      else
        echo "[INCOMPLETO] $file esta faltando URL ou chave publica."
      fi
    else
      echo "[AUSENTE] $file"
    fi
  done
  echo "Importante: .env.local tem precedencia sobre .env no Vite."
  exit 0
fi
if [[ -f .env ]]; then
  echo "[PRESERVADO] .env ja existe. Nenhuma credencial foi alterada."
  echo "Confira com: bash scripts/restaurar-acesso.sh --status"
  exit 0
fi
SOURCE=""
if [[ $# -ge 2 && "$1" == "--from" ]]; then
  SOURCE="$2"
elif [[ $# -eq 0 && -f .env.local ]]; then
  SOURCE=".env.local"
elif [[ $# -gt 0 ]]; then
  echo "Uso: bash scripts/restaurar-acesso.sh [--from ARQUIVO_ANTIGO] [--status]"
  exit 2
fi
if [[ -n "$SOURCE" ]]; then
  [[ -f "$SOURCE" ]] || { echo "Arquivo antigo nao localizado." >&2; exit 1; }
  if ! grep -Eq '^VITE_SUPABASE_URL=https?://' "$SOURCE" || ! grep -Eq '^VITE_SUPABASE_(PUBLISHABLE_KEY|ANON_KEY)=.+' "$SOURCE"; then
    echo "Arquivo antigo nao contem URL e chave publica Supabase. Nenhum arquivo criado." >&2
    exit 1
  fi
  cp -- "$SOURCE" .env
  chmod 600 .env
  echo "[OK] Configuracao antiga recuperada localmente, sem alterar o arquivo de origem."
else
  [[ -t 0 ]] || { echo "Execute no terminal interativo, ou informe --from ARQUIVO_ANTIGO." >&2; exit 1; }
  echo "Use a URL e a chave PUBLICA do MESMO projeto Supabase que voce usava antes."
  read -r -p "Supabase Project URL: " url
  read -r -s -p "Publishable/anon key publica: " key
  printf '\n'
  if [[ ! "$url" =~ ^https://[A-Za-z0-9._:-]+/?$ && ! "$url" =~ ^http://(127.0.0.1|localhost):[0-9]+/?$ ]]; then
    echo "URL invalida. Nada foi gravado." >&2; exit 1
  fi
  [[ -n "$key" && "$key" != "your_publishable_key_here" ]] || { echo "Chave ausente. Nada foi gravado." >&2; exit 1; }
  {
    echo "# Licits: conexao Supabase LOCAL; nunca enviar este arquivo ao GitHub"
    printf 'VITE_SUPABASE_URL=%s\n' "$url"
    printf 'VITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$key"
    echo "VITE_ENVIRONMENT=development"
  } > .env
  chmod 600 .env
  echo "[OK] .env local criado com permissao 600."
fi
if [[ -f .env.local ]]; then
  echo "[ATENCAO] .env.local tem precedencia no Vite. Confira se aponta para o mesmo projeto."
fi
echo "Execute npm ci && npm run dev. O login utiliza as contas existentes do Supabase."
