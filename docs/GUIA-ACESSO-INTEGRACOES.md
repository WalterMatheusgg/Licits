# Licits 2.0 — acesso, IA e integrações

## Entrar no sistema (usuário final)
1. Abra o endereço do Licits fornecido pelo administrador; no GitHub Codespaces, inicie `npm run dev -- --host 0.0.0.0` e abra a porta 5173 na aba **Ports**.
2. Acesse **Login** e informe o e-mail e a senha da conta cadastrada em **Supabase → Authentication → Users**. O login no **painel do Supabase com GitHub** não é o mesmo login do Licits.
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
7. A extração documental é local no navegador e não exige chave paga. `OPENAI_API_KEY` é usada somente pelo assistente de perguntas.

## Extração documental
- Use **Contratos → Importar Documento** para PDF, JPG ou PNG de até **15 MB**; PDFs têm limite de 30 páginas.
- Texto PDF é lido com PDF.js; páginas digitalizadas e imagens passam por Tesseract.js com português, executado no navegador.
- A extração de valores, cláusulas, vigência, fornecedor e itens é heurística. Revise no documento original antes de salvar.
- A função `extract-document` antiga retorna HTTP 410 e não chama mais API externa.

## Integrações externas
A API v1 de contratos oferece listagem filtrada, sincronização incremental por `updated_since`, criação transacional, atualização e credenciais máquina-a-máquina com escopos, expiração e revogação. Consulte [API e OpenAPI](API-INTEGRACAO-V1.md). Webhooks de saída, rate limit por credencial e adaptadores específicos de importação para ERPs ainda precisam ser implementados antes de integrar sistemas externos em produção.

Para integrar outros bancos, ERPs e APIs, **não conecte PostgreSQL, Oracle ou SQL Server diretamente pelo navegador**. Use gateway autenticado no backend com adaptadores por fornecedor.

**Contrato sugerido**: `POST /integrations/v1/import/contracts`, `GET /integrations/v1/jobs/{id}`, `POST /integrations/v1/webhooks/{provider}`. Requisições devem identificar organização e usuário autenticados; tokens de terceiros ficam em cofre de segredos e nunca no frontend. Esta é uma **proposta**, não uma API já implementada.

Padrões fundamentais: autenticação e autorização multi-tenant/RLS; versionamento, paginação e esquema validado; importação idempotente com `external_id`; fila com tentativas e backoff; assinaturas HMAC para webhooks; logs de auditoria sem PII/segredos; limites por organização; testes de contrato; observabilidade e métricas. Para bancos externos, use conectores backend específicos e sincronização assíncrona em vez de consultas cross-database diretas da interface.

## Checklist de validação
- Login e recuperação de senha; membro ativo e isolamento entre organizações.
- Dashboard do fiscal e permissões por papel.
- Upload de PDF textual e digitalizado, OCR e extração revisada.
- Contrato de teste com 50% utilizado; prévia de compra, bloqueio de extrapolação, filas de alertas 80/90/100%, avisos de vencimento e entrega real por e-mail.
- Verificação dos logs das funções e testes automatizados antes de produção.
