# Auditoria de migração Base44 → Supabase

Data: 2026-07-13

## Estado recebido

- React 18 + Vite 6.
- UI baseada em Radix UI / shadcn.
- TanStack Query, React Hook Form e Zod presentes.
- O frontend ainda usa `@base44/sdk` e `@base44/vite-plugin`.
- Não havia `package-lock.json` no ZIP.
- A pasta `src/componentes` era uma cópia exata de `src/components`.
- `App.jsx` importava `src/pages/Users.jsx`, mas o arquivo recebido se chamava `User.jsx`.
- O ZIP continha um arquivo acidental chamado `git show --name-status 430227d`.
- Os diretórios `docs`, `supabase/migrations` e `supabase/functions` estavam vazios.
- `@supabase/supabase-js` não estava listado em `package.json`.

## Dependências Base44 ainda existentes

- Autenticação: `base44.auth.me`, `logout`, `redirectToLogin`.
- CRUD: contratos, itens, retiradas, documentos, ocorrências, fiscalizações,
  registros de preços, usuários, notificações, auditoria e solicitações administrativas.
- Integrações: upload, extração de arquivos, LLM e envio de e-mail.
- Realtime: assinatura de notificações.
- Vite: `@base44/vite-plugin`.

A Base44 não foi removida nesta etapa. A remoção só deve ocorrer depois que cada módulo possuir um substituto funcional.

## Correções seguras aplicadas

- Removida a cópia duplicada `src/componentes`.
- Renomeado `src/pages/User.jsx` para `src/pages/Users.jsx`.
- Removido o arquivo acidental de saída do Git.
- Adicionado `@supabase/supabase-js`.
- Criado `src/lib/supabaseClient.js`.
- Recriados os documentos de migração.
- Criadas 14 migrations de schema, RLS, Storage, auditoria e RPC transacional.

## Riscos que continuam abertos

1. O frontend ainda depende da Base44.
2. As migrations precisam ser aplicadas em um projeto Supabase de desenvolvimento.
3. O RLS precisa de testes com dois usuários e duas organizações reais.
4. O build não foi executado neste ambiente porque a instalação de dependências excedeu o tempo disponível.
5. As funções de IA com OpenAI ainda não foram implementadas.
6. O fluxo de autenticação e seleção de organização ainda não foi migrado.
