# Alertas orçamentários para fiscais

**Situação:** o PostgreSQL gera alertas de orçamento ao cruzar **80%, 90% ou 100%** e alertas de vencimento a **30, 7, 1 dia e no dia do término**. O worker verifica a fila a cada 30 minutos. O disparo real por e-mail depende da função `dispatch-budget-alerts` implantada, provedor Resend ou Gmail API configurado e secrets do agendamento.

## Funcionamento

- Cada item possui quantidade contratada, consumida e preço unitário.
- A baixa grava o histórico e aumenta o valor consumido do contrato **na mesma transação**, com bloqueio de concorrência.
- O banco bloqueia compras que excedam quantidade do item, valor global do contrato ou vigência.
- Ao cruzar um marco orçamentário, o banco insere aviso no sistema e fila durável de e-mail.
- O worker consulta diariamente vigências nas janelas de 30, 7, 1 dia e no dia final, deduplica cada aviso e cancela mensagens pendentes se o contrato for prorrogado ou deixar de estar ativo.
- O destinatário é o **fiscal atribuído ao contrato** e os administradores ativos da organização. Avisos são enviados de forma agrupada por marco atingido, com deduplicação e até cinco tentativas.
- A interface simula nova compra sem gravá-la e mostra o impacto em reais e percentual.

## Implantação (somente após validar em homologação)

1. Aplicar migrations em um **projeto Supabase de homologação**. Não use dados reais no contrato de demonstração.
2. Criar domínio remetente no Resend e definir segredos na área de Edge Functions: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_DISPATCH_SECRET` (token aleatório de 32+ caracteres). `LICITS_PUBLIC_URL` é opcional e deve ser URL HTTPS publicada.
3. Aplicar as migrations no Supabase de homologação e implantar a função: `npx supabase@latest functions deploy dispatch-budget-alerts --no-verify-jwt`.
4. No GitHub, em **Settings → Secrets and variables → Actions**, configurar:
   - `LICITS_DISPATCH_URL`: `https://SEU-PROJECT-REF.supabase.co/functions/v1/dispatch-budget-alerts`
   - `LICITS_ALERT_DISPATCH_SECRET`: exatamente o mesmo segredo da função.
5. Rodar o workflow [Enviar alertas orçamentários](../.github/workflows/budget-alerts.yml) manualmente no GitHub Actions e verificar as entregas na tabela `contract_budget_alerts`. Depois funciona a cada 30 minutos, sujeito a atraso do agendador do GitHub.
6. Testar primeiro com uma organização fictícia e caixas de e-mail autorizadas.

**Atenção:** o sistema não configura automaticamente o Supabase nem o Resend por este repositório. Sem os secrets e deploy, os alertas permanecem na fila e na interface, **mas nenhum e-mail externo será entregue**.

## Diagnóstico de implantação e critérios de aceite

**Falha observada no GitHub Actions:** a execução pode parar antes de chamar o Supabase quando faltam `LICITS_DISPATCH_URL` ou `LICITS_ALERT_DISPATCH_SECRET`. Isso não é um erro do Resend nem significa que a Edge Function foi executada. Crie os dois secrets em **Settings → Secrets and variables → Actions**; não copie seus valores para o repositório.

Use como URL do dispatcher do ambiente de homologação `https://nefimqoszcidsnqvlnnh.supabase.co/functions/v1/dispatch-budget-alerts` somente se esse for realmente o projeto correto. Gere `ALERT_DISPATCH_SECRET` aleatório com pelo menos 32 caracteres no Supabase e copie o **mesmo valor** para `LICITS_ALERT_DISPATCH_SECRET` no GitHub. Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` (remetente de domínio verificado) exclusivamente nos secrets do Supabase.

1. Verifique que `dispatch-budget-alerts` está implantada com validação interna de `X-Alert-Token`. O parâmetro `--no-verify-jwt` não elimina essa validação própria.
2. Execute **Run workflow** manualmente em ambiente de homologação.
3. Resultado `processed: 0` comprova somente que a função respondeu, **não** a entrega de mensagens.
4. Para validar envio, gere um alerta com contrato fictício, fiscal e administradores ativos com e-mails de homologação autorizados; confira `sent`/`failed`, o status no banco, o painel Resend e a caixa de entrada.
5. Se a função responder HTTP 503, examine existência dos segredos e RPCs no Supabase sem exibir valores. Se retornar HTTP 401, confira a correspondência do segredo entre GitHub e Supabase.
6. Mantenha o cadastro de recipients restrito a membros ativos e perfis ativos. A Edge Function grava `sent` após aceite da API do Resend; aceitação **não comprova entrega na caixa de entrada**, que precisa ser verificada no provedor.

Os testes Deno de políticas de destinatários e idempotência são executados pelo workflow `edge-functions-ci.yml`. Eles não substituem um teste real de envio.

## Melhoria planejada de produção

O serviço usa chave de idempotência por destinatário ao falar com o Resend, evitando reenvio ao repetir tentativas quando o provedor respeita a chave. A fila registra sucesso ou erro e faz novas tentativas. Para produção de maior escala, mover o agendamento para Supabase Cron, inserir tabela de entrega por destinatário e monitorar taxa de rejeição.


## Alternativa sem domínio próprio: Gmail API

A API Gmail aceita destinatários em outros provedores de e-mail sem comprar ou verificar domínio de remetente. A conta Google autorizada é o remetente e está sujeita a limites antispam (contas pessoais: cerca de 500 mensagens/dia, além de outras restrições). Para mensagens automáticas o OAuth precisa de refresh token e escopo mínimo gmail.send.

Configuração sem compartilhar segredos:

1. Crie/abra um projeto em https://console.cloud.google.com/apis/library/gmail.googleapis.com e ative Gmail API.
2. Configure a tela OAuth Consent e crie um OAuth Client ID do tipo Web application. Cadastre o Redirect URI: https://developers.google.com/oauthplayground
3. No navegador, abra https://developers.google.com/oauthplayground, nas configurações habilite Use your own OAuth credentials e preencha Client ID e Client Secret.
4. Autorize apenas o escopo https://www.googleapis.com/auth/gmail.send usando o Gmail remetente. Troque o código por tokens no OAuth Playground e guarde o refresh token com segurança.
5. Atenção: em OAuth Testing, refresh tokens podem expirar em sete dias; para automação contínua, revise o status de publicação e a necessidade de verificação do Google (gmail.send é escopo sensível).
6. Execute no Codespaces: bash scripts/configurar-gmail.sh; informe Gmail remetente, OAuth Client ID, Client Secret e Refresh Token. O script oculta os segredos e grava em Supabase EMAIL_PROVIDER=gmail, GMAIL_FROM_EMAIL, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN.
7. Faça deploy: npx supabase functions deploy send-email; e npx supabase functions deploy dispatch-budget-alerts --no-verify-jwt. O dispatcher continua autenticando com X-Alert-Token, mesmo com JWT desabilitado.
8. Como organization_admin/gestor ativo, teste uma mensagem real pela função autenticada send-email para um e-mail externo de teste, confira o ID de envio, a pasta Enviados do Gmail remetente e a chegada ao destinatário. Teste alertas automáticos somente com contrato fictício e destinatários autorizados.

Em EMAIL_PROVIDER=gmail, o adaptador usa Gmail API; sem EMAIL_PROVIDER, continua Resend como padrão. Para enviar e-mail manual, gestores e administradores autorizados não precisam que o destinatário pertença à organização, mas a operação continua autenticada, vinculada à organização e limitada por capacidade. Alertas de contratos continuam restritos ao fiscal atribuído e administradores ativos. Convites novos de invite-member são enviados por Supabase Auth, cujo SMTP é uma configuração independente.

Cuidado com retentativas: Gmail API não tem o mesmo mecanismo de Idempotency-Key do Resend; se uma tentativa enviar a mensagem e falhar antes do retorno, o reprocessamento pode gerar duplicata. Para produção em maior escala, implemente entrega persistida por destinatário. A API aceitar a mensagem não comprova recebimento final na caixa de entrada.

Fontes: https://developers.google.com/workspace/gmail/api/guides/sending ; https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/workspace/gmail/api/auth/scopes ; https://support.google.com/mail/answer/22839?hl=pt-br
