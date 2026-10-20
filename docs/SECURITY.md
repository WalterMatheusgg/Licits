# Segurança

## Princípios aplicados

- RLS ativo em todas as tabelas públicas do sistema.
- `organization_id` não pode ser trocado em atualizações.
- Usuários não podem inserir auditorias diretamente.
- Retiradas de itens são feitas por RPC transacional.
- Buckets são privados.
- O primeiro segmento do caminho do arquivo deve ser o UUID da organização.
- A chave administrativa do Supabase e a chave da OpenAI nunca entram no frontend.
- `platform_admin` fica em uma tabela separada, não em metadata editável pelo usuário.

## Papéis de organização

- `organization_admin`
- `gestor`
- `fiscal`
- `operacional`
- `visualizador`

`platform_admin` é um privilégio da plataforma e não um papel comum da organização.

## Segredos

Permitidos no frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Somente backend / Edge Functions:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
```

## Testes obrigatórios antes de produção

- Usuário A não lê dados da organização B.
- Usuário A não troca `organization_id`.
- Visualizador não cria nem altera dados.
- Fiscal cria fiscalização e ocorrência.
- Operacional não gerencia membros.
- Usuário não muda a própria role.
- Usuário não insere `audit_logs`.
- Usuário não altera o conteúdo de uma notificação, apenas `read_at`.
- Retirada acima do saldo é rejeitada.
- Duas retiradas concorrentes não ultrapassam o saldo.
- Arquivo de outra organização não gera signed URL.
