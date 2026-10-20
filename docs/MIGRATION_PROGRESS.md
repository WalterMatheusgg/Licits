# Progresso da migração

Data: 2026-07-13

## Fase 1: auditoria e correções estruturais

Status: concluída.

- [x] Identificar dependências Base44.
- [x] Remover diretório duplicado `src/componentes`.
- [x] Corrigir `User.jsx` para `Users.jsx`.
- [x] Proteger arquivos `.env`.
- [x] Typecheck, lint e build validados.

## Fase 2: fundação Supabase

Status: concluída.

- [x] Adicionar `@supabase/supabase-js`.
- [x] Criar cliente Supabase.
- [x] Criar configuração e migrations.
- [x] Vincular o CLI ao projeto remoto.

## Fase 3: banco, RLS, Storage e RPC

Status: aplicado ao projeto remoto.

- [x] 14 migrations iniciais aplicadas.
- [x] Multi-tenancy, perfis e memberships.
- [x] Tabelas operacionais.
- [x] RLS e buckets privados.
- [x] RPC transacional de retirada.
- [x] Migration adicional de hardening preparada.
- [ ] Aplicar `20260713180115_auth_security_hardening.sql`.
- [ ] Executar testes práticos de isolamento entre organizações.

## Fase 4: autenticação e organização

Status: implementada no frontend, aguardando validação integrada.

- [x] `AuthContext` com Supabase Auth.
- [x] `OrganizationContext` multi-organização.
- [x] Login, recuperação e troca de senha.
- [x] Proteção de rotas.
- [x] Tela para usuário sem organização.
- [x] Seleção de organização no TopBar.
- [x] Logout migrado no TopBar e Sidebar.
- [x] Notificações do TopBar migradas para Supabase.
- [x] `PermissionGuard` e hooks de autorização.
- [ ] Criar usuário real e membership para teste.
- [ ] Configurar URLs de recuperação no painel Supabase.

## Próxima fase

Migrar a camada de dados por módulo, começando por fornecedores e contratos. As páginas de negócio ainda contêm chamadas Base44 e não devem ser consideradas migradas.
