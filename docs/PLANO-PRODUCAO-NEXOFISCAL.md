# NexoFiscal — evolução e validação antes da produção

Nome de interface proposto: **NexoFiscal**. Nome do repositório e identificadores técnicos antigos permanecem para evitar quebra de URLs e integrações.

## Correções iniciais aplicadas
- Dashboard: valores monetários somados numericamente, tratamento explícito de falha de consulta e filtro de vencimentos validado.
- Mapa: ícones Leaflet locais, marcadores estáveis por UF, filtro somente para siglas conhecidas. Coordenadas representam capitais aproximadas por UF e **não a localização exata de fornecedores**. É necessária geocodificação autorizada para posicionamento por endereço.
- Solicitações administrativas: identificação por requester_id, resolved_by UUID e falha de arquivamento interrompendo a aprovação. Verificar permissões RLS com testes de papéis e ações concorrentes antes de produção.
- Assistente: consultas determinísticas sobre contratos visíveis para saldo, vencimentos, risco de teto e fiscalização funcionam sem chave OpenAI. Perguntas não cobertas ainda dependem de analyze-contract; não é um modelo treinado localmente. Respostas não substituem verificações transacionais.

## Pendências de produção (não declarar prontidão antes de concluir)
1. Rodar `npm ci && npm run build && npm run lint && npm run typecheck` e corrigir eventuais falhas.
2. Testar cada rota: Dashboard, Contratos, Detalhes, Documentos, Fiscalização, ARPs, Solicitações, Usuários, Mapa, IA, Alertas, Auditoria e Notificações.
3. Validar RLS de leitura e escrita entre organizações; testar criar, revisar, aprovar e arquivar solicitações como fiscal, gestor e admin. Exclusão/arquivamento exige operação atômica no backend para aprovação confiável.
4. Configurar `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e agendador dos alertas exclusivamente no ambiente seguro; conferir logs, status e idempotência.
5. Testar o cenário 50% de uso, compras até 80%, 90%, 100% e bloqueio de ultrapassagem do teto, incluindo concorrência.
6. Implantar CI, monitoramento, restauração de backup, controle de acesso, políticas LGPD, limites de upload e testes e2e antes do lançamento.
7. Para integrações externas, implementar gateway backend versionado com credenciais em cofre, autorização multi-tenant, filas, auditoria, timeouts e adaptação por ERP/DB. A proposta consta em GUIA-ACESSO-INTEGRACOES.md; não está implementada.

## Atualização no Codespaces
```bash
git pull origin main
npm ci
npm run build
npm run lint
npm run typecheck
```
Não publicar até corrigir erros retornados pelos comandos e concluir testes de permissões e fluxos críticos.
