# Banco de dados

## Arquitetura

O schema é multi-tenant. Dados operacionais carregam `organization_id`, e o RLS
confirma uma membership ativa antes de permitir acesso.

### Identidade e organizações

- `organizations`
- `profiles`
- `platform_admins`
- `organization_members`

### Contratos

- `suppliers`
- `contracts`
- `contract_items`
- `item_withdrawals`

### Documentos e fiscalização

- `documents`
- `fiscal_records`
- `occurrences`

### Registro de preços

- `price_registrations`
- `price_registration_groups`

### Operação e governança

- `admin_requests`
- `notifications`
- `audit_logs`
- `ai_analysis_jobs`
- `ai_analysis_results`

## Convenções

- IDs: UUID.
- Dinheiro: `numeric`, nunca ponto flutuante.
- Datas: `date`.
- Eventos: `timestamptz`.
- Exclusão administrativa: `deleted_at` / `deleted_by`.
- Arquivos: bucket + caminho, não URL pública persistente.
- Dados de IA: resultado preliminar separado do contrato e sujeito a revisão humana.

## Ordem das migrations

1. Extensões e tipos.
2. Organizações, perfis e memberships.
3. Fornecedores e contratos.
4. Itens e retiradas.
5. Documentos, fiscalização e ocorrências.
6. Registro de preços e solicitações.
7. Notificações e IA.
8. Auditoria e triggers.
9. Funções de autorização.
10. RLS.
11. Storage.
12. RPCs e triggers de auditoria.
13. Índices adicionais.
14. Instrução de bootstrap, sem dados reais.

## Aplicação

Com Supabase CLI configurado:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Para desenvolvimento local:

```bash
supabase start
supabase db reset
```

Não aplique primeiro em produção. Use um projeto de desenvolvimento ou staging.
