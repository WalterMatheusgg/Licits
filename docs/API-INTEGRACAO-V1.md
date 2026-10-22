# API de Integração — Licits v1

## Status
Endpoint **implementado no repositório, mas ainda não implantado nem homologado** no projeto Supabase.

### Função
`POST https://nefimqoszcidsnqvlnnh.supabase.co/functions/v1/integration-contracts`

A API lista, filtra, cria e atualiza contratos dentro da organização autorizada. Ela não executa compras. O contrato OpenAPI está em [openapi-integration-v1.json](openapi-integration-v1.json).

**Autorização de usuário:** envie `Authorization: Bearer <access_token_do_supabase_auth>` e `apikey: <publishable_key>`. A função recusa usuários sem perfil ativo ou sem vínculo ativo com a organização. Para ERP e integrações servidor-a-servidor, gestores podem emitir credencial própria com escopos `contracts:read` e/ou `contracts:write`; apenas o hash SHA-256 é armazenado, o segredo é mostrado uma única vez e pode ser revogado.

**Corpo de exemplo:**
```json
{
  "organization_id": "UUID_DA_ORGANIZACAO",
  "operation": "list",
  "status": "ativo",
  "supplier_id": "UUID_DO_FORNECEDOR",
  "end_date_from": "2026-01-01",
  "end_date_to": "2026-12-31",
  "contract_number": "CT-001",
  "updated_since": "2026-01-01T00:00:00Z",
  "page": 1,
  "per_page": 25
}
```

Filtros são opcionais; `operation` omisso equivale a `list`. A resposta de listagem contém `api_version`, `organization_id`, `data` e `pagination`. Limite: 100 por página.

### Atualizar contrato
Somente `organization_admin` e `gestor` podem atualizar. Envie `operation: "update"`, `contract_id` e um objeto `updates` com pelo menos um campo permitido. Valores usados, vínculo do fornecedor, organização e ID não são editáveis por esta operação.

```json
{
  "operation": "update",
  "organization_id": "UUID_DA_ORGANIZACAO",
  "contract_id": "UUID_DO_CONTRATO",
  "updates": {
    "end_date": "2027-12-31",
    "total_value": 125000
  }
}
```

Campos permitidos: `contract_number`, `sei_number`, `auction_number`, `object`, `status`, `start_date`, `end_date`, `total_value`, `modality`, `contract_type`, `responsible_sector`, `can_extend`, `extensions_done`, `max_extensions`, `fiscal_status` e `notes`. O valor total não pode ficar abaixo do valor já utilizado; datas devem ser coerentes; números duplicados retornam HTTP 409.

### Credenciais máquina-a-máquina
Crie a credencial com JWT de usuário gestor/administrador. `expires_at` é opcional; quando informado, deve vencer em até um ano.

```json
{
  "operation": "create_credential",
  "organization_id": "UUID_DA_ORGANIZACAO",
  "name": "ERP de compras",
  "scopes": ["contracts:read", "contracts:write"],
  "expires_at": "2027-10-22T00:00:00Z"
}
```

A resposta HTTP 201 inclui `data.token`; armazene-o em um cofre de segredos, pois ele não será exibido novamente. Envie-o como `Authorization: Bearer lct_...` nas consultas seguintes. O gateway da função deve ser implantado com `--no-verify-jwt`: a função verifica o JWT Supabase ou consulta a credencial hasheada em todas as requisições. Nunca use `SUPABASE_SERVICE_ROLE_KEY` como credencial externa.

Para revogar, envie `operation: "revoke_credential"`, o `organization_id` e o `credential_id`, autenticando com JWT de gestor/administrador. A credencial é invalidada imediatamente.

### Implantação
No Codespaces com Supabase CLI vinculado:
```bash
npx supabase db push --dry-run
# Aplique migrações após revisão e backup:
npx supabase db push
npx supabase functions deploy integration-contracts --use-api --no-verify-jwt
npx supabase functions list
```

### Limitações e requisitos antes de clientes externos
- A sincronização pode consultar deltas com `updated_since`; webhooks de saída e adaptadores específicos de ERP ainda não estão implementados;
- as credenciais podem ser revogadas e expiram, mas ainda não há limites de taxa individuais por credencial;
- validar isolamento de organizações, escopos, paginação, expiração, revogação e volume em homologação;
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

O fornecedor e o contrato são criados na mesma RPC transacional; número duplicado reverte a operação inteira. Testes automatizados cobrem rollback, escopos e auditoria, mas a concorrência e o isolamento ainda precisam ser homologados no projeto Supabase de destino.


## Ingestão de contratos recebidos de ERP (entrada autenticada)
A operação `ingest` aceita um payload JSON de integração com campos padronizados de contratos. Não é um conector homologado para SAP, TOTVS ou outro fornecedor específico: os formatos `generic` e `br_publico` são adaptadores genéricos de campos.

```json
{
  "operation": "ingest",
  "organization_id": "UUID_DA_ORGANIZACAO",
  "provider": "br_publico",
  "payload": {
    "numero_contrato": "123/2026",
    "objeto": "Materiais de consumo",
    "fornecedor": {
      "razao_social": "Fornecedor Exemplo Ltda",
      "cnpj": "12.345.678/0001-90"
    },
    "valor_total": "R$ 12.345,67"
  }
}
```

Envie via POST para a Edge Function `integration-contracts` com `Authorization: Bearer lct_...` e o header `apikey` publicável do projeto. A credencial deve possuir `contracts:write`. A criação é transacional; números repetidos com os mesmos dados retornam HTTP 200 (`already_exists:true`), e dados conflitantes retornam HTTP 409. O token deve ficar no cofre de segredos do integrador.

A API controla até **60 chamadas por minuto por credencial**, com HTTP 429 quando o limite for excedido. O contador é persistido no PostgreSQL e cada chamada remove os registros antigos da própria credencial (mais de um dia).

Este é um **endpoint de recebimento autenticado**, que pode ser chamado por automações externas. Ele não implementa assinaturas HMAC de webhooks específicos de fornecedores, webhooks de saída nem sincronização automática por polling. Para um ERP específico, é necessário mapear seus campos e validar seu protocolo. Os formatos JSON, datas e ações disponíveis estão no [OpenAPI](openapi-integration-v1.json).

## Importação documental transacional
A partir da migração `20261022150000_atomic_contract_document_import.sql`, o Licits utiliza `import_contract_document_atomic` para registrar contrato, documento e itens em **uma transação no banco**, depois que o arquivo é carregado no Storage privado `contracts`. A função exige usuário gestor/administrador ativo da organização e arquivo pertencente ao autor do upload. Caso o banco rejeite qualquer item, a transação de metadados é revertida. O arquivo carregado no Storage permanece para possível limpeza posterior.

## Pré-requisitos de implantação da versão atual
- Revisar backup e aplicar migrations novas, inclusive `20261022150000_atomic_contract_document_import.sql` e `20261022151000_integration_rate_limit.sql`.
- Implantar `integration-contracts` com `--no-verify-jwt`, mantendo a autenticação própria dentro do código.
- Executar testes locais SQL e testes das Edge Functions no CI.
- Confirmar envios reais com Resend configurado e agendador de alertas autenticado.

Não declare ambiente de produção homologado sem comprovação de cada passo.
