# API de Integração — NexoFiscal v1

## Status
Endpoint **implementado no repositório, mas ainda não implantado nem homologado** no projeto Supabase.

### Função
`POST https://nefimqoszcidsnqvlnnh.supabase.co/functions/v1/integration-contracts`

A API lê contratos da organização associada ao usuário autenticado, com dados financeiros básicos. Ela não executa compras, altera contratos ou concede acesso a outros usuários.

**Autorização:** envie `Authorization: Bearer <access_token_do_supabase_auth>` e `apikey: <publishable_key>`. A função usa `authorize` e `member`, recusando usuários sem perfil ativo ou sem vínculo ativo com a organização informada. Nunca coloque a chave administrativa do Supabase no aplicativo integrador.

**Corpo de exemplo:**
```json
{
  "organization_id": "UUID_DA_ORGANIZACAO",
  "page": 1,
  "per_page": 25
}
```

**Resposta:** `api_version`, `organization_id`, `data` (contratos) e `pagination`. Limite: 100 por página.

### Implantação
No Codespaces com Supabase CLI vinculado:
```bash
npx supabase db push --dry-run
# Aplique migrações após revisão e backup:
npx supabase db push
npx supabase functions deploy integration-contracts --use-api
npx supabase functions list
```

### Limitações e requisitos antes de clientes externos
- OAuth / credenciais máquina-a-máquina dedicadas, rotação, limites de taxa, revogação e logs de acesso;
- gestão explícita de quais campos cada parceiro pode consultar;
- testes de isolamento de organizações, paginação, expiracão do JWT e volume de consultas;
- testes de integração reais no Supabase.

Não exponha o endpoint publicamente sem o gateway de autorização e o controle de taxa apropriados.
