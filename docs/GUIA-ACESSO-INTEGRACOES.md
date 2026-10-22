# NexoFiscal 2.0 — acesso, IA e integrações

## Entrar no sistema (usuário final)
1. Abra o endereço do NexoFiscal fornecido pelo administrador; no GitHub Codespaces, inicie `npm run dev -- --host 0.0.0.0` e abra a porta 5173 na aba **Ports**.
2. Acesse **Login** e informe o e-mail e a senha da conta cadastrada em **Supabase → Authentication → Users**. O login no **painel do Supabase com GitHub** não é o mesmo login do NexoFiscal.
3. A conta precisa ter perfil ativo em `public.profiles`, vínculo `active` em `public.organization_members` e organização `active`.
4. Caso apareça ausência de organização, peça ao administrador para enviar um convite ou associá-lo à organização correta. Não crie organização duplicada por conta própria.
5. Para redefinir senha, use **Esqueci minha senha**. O administrador deve configurar a URL da aplicação em Supabase Auth → URL Configuration.

## Instalação em novo ambiente (administrador)
1. Configure `.env.local` no Codespaces (fora do Git) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca coloque `sb_secret_`, credenciais de banco ou `OPENAI_API_KEY` em variáveis `VITE_`.
2. `npx supabase login` e `npx supabase link --project-ref nefimqoszcidsnqvlnnh`.
3. Verifique `npx supabase migration list` e `npx supabase db push --dry-run`. Só execute `npx supabase db push` quando houver migrations pendentes e após revisar o impacto.
4. Implante com `npx supabase functions deploy --use-api` (útil quando o bundler local falha por DNS). Confirme com `npx supabase functions list`.
5. Configure segredos com `npx supabase secrets set OPENAI_API_KEY=...` **digitando o valor apenas no terminal privado**, ou de preferência pelo painel **Edge Functions → Secrets**. Não cole chaves em chats, tickets, commits ou logs.
6. Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` (domínio verificado) para e-mails. O dispatcher exige `ALERT_DISPATCH_SECRET` (valor aleatório com no mínimo 32 caracteres), e o acionamento cron autenticado por `X-Alert-Token`. Implante `dispatch-budget-alerts` conforme exigências de JWT/cron do código, sem torná-lo público por engano.
7. Para extração de documentos, é necessário `OPENAI_API_KEY` com faturamento/créditos válidos na API. A assinatura do ChatGPT não configura automaticamente a API.

## Diagnóstico da IA documental
- A função `extract-document` aceita somente PDF, JPG e PNG de até **6 MB**, já enviados ao bucket privado `contracts` no caminho iniciado por `organization_id/`.
- Somente perfis com vínculo ativo de `organization_admin` ou `gestor` podem executá-la. O papel `platform_admin` isolado não substitui o vínculo na organização.
- A função utiliza `OPENAI_API_KEY` e opcionalmente `OPENAI_DOCUMENT_MODEL` (padrão `gpt-4.1-mini`).
- Um erro HTTP não-2xx pode significar falta de segredo, permissão, arquivo, limite de tamanho ou rejeição da API externa. **Não é possível concluir a causa exata sem os logs.**
- Consulte Supabase → Edge Functions → `extract-document` → Logs. Identifique código HTTP e mensagem sanitizada, sem compartilhar tokens ou conteúdo confidencial do contrato. Verifique também `analyze-contract`.
- Depois de corrigir, reimplante com `npx supabase functions deploy extract-document --use-api` se houve mudança de código. Segredos configurados não exigem commit no GitHub.
- A extração deve ser revisada por pessoa responsável antes de salvar informações contratuais.

## Arquitetura proposta para integrações externas
Para integrar outros bancos, ERPs e APIs, **não conecte PostgreSQL, Oracle ou SQL Server diretamente pelo navegador**. Crie um gateway de integrações autenticado no backend (Supabase Edge Functions ou serviço dedicado) com adaptadores por fornecedor.

**Contrato sugerido**: `POST /integrations/v1/import/contracts`, `GET /integrations/v1/jobs/{id}`, `POST /integrations/v1/webhooks/{provider}`. Requisições devem identificar organização e usuário autenticados; tokens de terceiros ficam em cofre de segredos e nunca no frontend. Esta é uma **proposta**, não uma API já implementada.

Padrões fundamentais: autenticação e autorização multi-tenant/RLS; versionamento, paginação e esquema validado; importação idempotente com `external_id`; fila com tentativas e backoff; assinaturas HMAC para webhooks; logs de auditoria sem PII/segredos; limites por organização; testes de contrato; observabilidade e métricas. Para bancos externos, use conectores backend específicos e sincronização assíncrona em vez de consultas cross-database diretas da interface.

## Checklist de validação
- Login e recuperação de senha; membro ativo e isolamento entre organizações.
- Dashboard do fiscal e permissões por papel.
- Upload de PDF válido, erro amigável por falta de chave e extração revisada.
- Contrato de teste com 50% utilizado; prévia de compra, bloqueio de extrapolação, filas de alertas 80/90/100% e entrega real por e-mail.
- Verificação dos logs das funções e testes automatizados antes de produção.
