# Validação da Fase 3

Data: 2026-07-13

## Validações concluídas

- `package.json` analisado como JSON válido.
- Todos os imports internos `@/` e relativos apontam para arquivos existentes.
- A duplicação `src/componentes` foi removida após comparação byte a byte com `src/components`.
- As 14 migrations foram analisadas por parser PostgreSQL (`pglast`) sem erro de sintaxe.
- Busca por segredos conhecidos não encontrou chaves reais.
- A pasta de páginas agora contém `Users.jsx`, compatível com o import em `App.jsx`.

## Validações não concluídas

- `npm install` excedeu o tempo disponível neste ambiente.
- Por consequência, `npm run lint`, `npm run typecheck` e `npm run build` não foram executados.
- As migrations ainda não foram executadas contra um Postgres/Supabase real.
- O RLS ainda precisa de testes com JWTs e usuários reais.
- As políticas de Storage precisam ser confirmadas no projeto Supabase vinculado.

## Comandos para validar no Codespaces

```bash
npm install
npm run lint
npm run typecheck
npm run build

npx supabase@latest login
npx supabase@latest link --project-ref SEU_PROJECT_REF
npx supabase@latest db push
```

Depois, execute `supabase/tests/schema_smoke.sql` no SQL Editor e use o
Database Advisor para revisar RLS e índices.
