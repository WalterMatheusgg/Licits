# Validação da Fase 4

Data: 2026-07-13

## Implementado

- Supabase Auth substituiu a autenticação Base44 no núcleo da aplicação.
- Organização ativa e papéis são carregados de `organization_members`.
- Rotas privadas exigem sessão, perfil ativo e membership ativo.
- Login, recuperação e troca de senha foram adicionados.
- TopBar e Sidebar usam o novo contexto de autenticação.
- Notificações do TopBar usam Supabase e Realtime.
- Permissões administrativas ocultam Usuários, Auditoria e Solicitações Admin.
- Migration de hardening restringe atualizações de perfil e notificações.

## Validação local

```text
npm run typecheck: aprovado
npm run lint: aprovado
npm run build: aprovado
```

O build ainda mostra o aviso do plugin Base44 porque os módulos de negócio não
foram migrados completamente.

## Validação remota pendente

1. aplicar `20260713180115_auth_security_hardening.sql`;
2. criar usuário no Supabase Auth;
3. criar organização e membership ativo;
4. configurar Redirect URLs do Supabase Auth;
5. testar login, logout, recuperação e troca de organização;
6. testar usuário sem membership e perfil bloqueado;
7. executar os testes de isolamento RLS.

## Limite desta fase

As páginas de negócio ainda usam Base44. A autenticação e o shell da aplicação
estão migrados, mas o CRUD principal será substituído na fase seguinte.
