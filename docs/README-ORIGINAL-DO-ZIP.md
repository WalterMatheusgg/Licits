# Licits

Aplicação React/Vite para gestão de contratos, documentos, fiscalização,
ocorrências e registros de preços.

## Estado da migração

O projeto está em migração da Base44 para Supabase.

Concluído:

- banco PostgreSQL, RLS, Storage e RPC transacional;
- Supabase Auth no frontend;
- contexto multi-organização;
- login, recuperação e alteração de senha;
- proteção de rotas e permissões de interface;
- seleção da organização atual;
- notificações do TopBar via Supabase Realtime.

Ainda em migração:

- CRUD de contratos, fornecedores, documentos e fiscalizações;
- página completa de notificações;
- administração de usuários;
- IA e extração documental com OpenAI;
- envio de e-mail;
- remoção final do SDK e plugin Base44.

Não remova `@base44/sdk` enquanto os módulos de negócio restantes não forem
substituídos.

## Requisitos

- Node.js 20 ou superior;
- npm;
- projeto Supabase;
- Supabase CLI para migrations.

## Instalação

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure em `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

Nunca use `VITE_` para chaves secretas.

## Autenticação

Consulte `docs/AUTHENTICATION.md` para:

- criar o primeiro usuário;
- vincular o usuário a uma organização;
- configurar recuperação de senha;
- entender papéis e permissões.

## Banco

```bash
npx supabase@latest migration list
npx supabase@latest db push --dry-run --linked
npx supabase@latest db push --linked
```

A migration mais recente desta fase é:

```text
20260713180115_auth_security_hardening.sql
```

## Documentação

- `docs/AUTHENTICATION.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/MIGRATION_AUDIT.md`
- `docs/MIGRATION_PROGRESS.md`

## Verificação

```bash
npm run typecheck
npm run lint
npm run build
```
