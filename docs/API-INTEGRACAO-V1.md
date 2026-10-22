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

## Criar contrato via API própria (sem OpenAI)
A função `integration-contracts` também recebe `operation: "create"` para usuários autenticados que sejam gestores ou administradores ativos. Todos os novos contratos entram no status **em_analise**; não há autorização automática para gastos.

```bash
curl -X POST 'https://nefimqoszcidsnqvlnnh.supabase.co/functions/v1/integration-contracts' \
  -H 'apikey: SUA_CHAVE_PUBLICAVEL' \
  -H 'Authorization: Bearer TOKEN_DE_USUARIO_AUTENTICADO' \
  -H 'Content-Type: application/json' \
  --data '{
    "operation": "create",
    "organization_id": "UUID_DA_ORGANIZACAO",
    "contract": {
      "contract_number": "CT-001/2026",
      "object": "Fornecimento de materiais de expediente",
      "supplier_name": "Fornecedor de Exemplo",
      "total_value": 100000.00
    }
  }'
```

A criação utiliza a identidade do usuário autenticado e o `organization_id` validado no backend, nunca uma chave da OpenAI. A resposta bem-sucedida tem HTTP 201. Contratos com mesmo número são recusados com HTTP 409 (verificação preliminar e índice único no banco).

**Atenção:** esse fluxo executa duas inserções (fornecedor e contrato), portanto não é atômico e ainda precisa de teste de concorrência, auditoria de erros e de um adaptador de identidade máquina-a-máquina antes do uso por integrações de produção. Nunca compartilhe tokens de usuários em código-fonte. A função depende de deploy no Supabase.
