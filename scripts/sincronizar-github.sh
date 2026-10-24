#!/usr/bin/env bash
# Sincroniza a branch main do Codespaces e do GitHub sem force push ou reset.
set -euo pipefail

fail() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
say() { printf '\n==> %s\n' "$*"; }
ask() {
  local answer
  read -r -p "$1 [s/N]: " answer </dev/tty || fail "Terminal interativo necessario."
  [[ "$answer" == [sS] ]]
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Execute dentro de um repositorio Git."
cd "$(git rev-parse --show-toplevel)"
[[ "$(git branch --show-current)" == "main" ]] || fail "Voce nao esta na main. Integre a branch atual antes de sincronizar a main."
remote="$(git remote get-url origin 2>/dev/null)" || fail "Remote origin nao encontrado."
case "$remote" in
  https://github.com/WalterMatheusgg/Licits|https://github.com/WalterMatheusgg/Licits.git|git@github.com:WalterMatheusgg/Licits|git@github.com:WalterMatheusgg/Licits.git|ssh://git@github.com/WalterMatheusgg/Licits|ssh://git@github.com/WalterMatheusgg/Licits.git) ;;
  *) fail "O remote origin nao aponta para WalterMatheusgg/Licits; nenhum comando executado." ;;
esac

if [[ -n "$(git ls-files -u)" ]] || [[ -f "$(git rev-parse --git-path MERGE_HEAD)" ]] ||
   [[ -d "$(git rev-parse --git-path rebase-merge)" ]] ||
   [[ -d "$(git rev-parse --git-path rebase-apply)" ]]; then
  fail "Existe merge/rebase/conflito pendente. Resolva com git status antes de sincronizar."
fi

say "1/4 - Consultando a main remota..."
git fetch origin main

if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
  say "2/4 - Alteracoes locais detectadas:"
  git status --short --untracked-files=all
  printf '\nConfira se nao ha senhas, tokens ou arquivos confidenciais acima.\n'
  if ! ask "Deseja adicionar TODOS os arquivos listados e criar um commit local?"; then
    fail "Cancelado. Suas alteracoes nao foram descartadas."
  fi
  git add -A
  suspicious=()
  while IFS= read -r -d '' file; do
    base="${file##*/}"
    case "$base" in
      .env.example|.env.sample) ;;
      .env|.env.*|*.pem|*.p12|*.pfx|*.key|id_rsa|id_ed25519|*secret*.json|*token*.json|*credential*.json)
        suspicious+=("$file") ;;
    esac
  done < <(git diff --cached --name-only -z)
  if (( ${#suspicious[@]} > 0 )); then
    printf 'Arquivos possivelmente confidenciais no stage:\n'
    printf '  %s\n' "${suspicious[@]}"
    fail "Revise e remova estes arquivos do stage com git restore --staged CAMINHO; depois execute o script novamente."
  fi
  git diff --cached --check || fail "Corrija os erros apontados no diff staged."
  git diff --cached --stat
  if ! git diff --cached --quiet; then
    if ! ask "Confirmar commit dessas alteracoes no Codespaces?"; then
      fail "Cancelado. O stage foi mantido e nada foi perdido."
    fi
    git commit -m "chore(sync): integrar alteracoes do Codespaces"
  fi
else
  say "2/4 - Sem alteracoes locais pendentes."
fi

say "3/4 - Integrando as atualizacoes do GitHub na main local..."
if ! git merge --no-edit origin/main; then
  printf '\nConflito encontrado. Nenhum push foi executado.\n'
  printf 'Execute: git status && git diff --name-only --diff-filter=U\n'
  printf 'Resolva cada conflito, git add os arquivos e git commit; depois rode este script novamente.\n'
  exit 1
fi

count="$(git rev-list --count origin/main..HEAD)"
if [[ "$count" == "0" ]]; then
  say "4/4 - GitHub e Codespaces ja estao sincronizados."
  git status -sb
  exit 0
fi

say "4/4 - Commits locais que serao enviados ao GitHub:"
git log --oneline origin/main..HEAD
if ! ask "Enviar esses $count commit(s) para origin/main?"; then
  printf 'Envio cancelado; os commits permanecem salvos no Codespaces.\n'
  exit 0
fi

if ! git push origin main; then
  fail "O push nao foi aceito. Rode o script de novo; nao use --force."
fi
git fetch origin main >/dev/null
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] ||
  fail "GitHub mudou durante a sincronizacao. Rode novamente para conferir."
say "Sincronizacao concluida: main do Codespaces e origin/main no mesmo commit."
git status -sb
