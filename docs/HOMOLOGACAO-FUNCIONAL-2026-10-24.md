# Homologação funcional dos módulos — 24/10/2026

## Escopo da tarefa crítica 2
Contratos, fornecedores, itens e baixas, compras/orçamento, atas/registro de preços, documentos, fiscalização e ocorrências. Regressão do isolamento de organizações e dos controles de autorização.

## Evidências automatizadas
A suíte PostgreSQL isolada em `.github/workflows/supabase-db-ci.yml` executa, sem usar o banco de produção:
- `tenant_isolation_integration.sql`: cadastro e alteração de contrato, itens e ARP, movimentação via RPC, documentos, fiscalização, ocorrências, solicitações, exclusão lógica e trilha de auditoria; novos testes de entradas inválidas (datas, valores, quantidade, saldo, referência de outra organização, vínculos de item e baixa com quantidade zero)
- `budget_alerts_integration.sql`: consumo, teto orçamentário, alertas de 80%/90%/100%
- `concurrent_item_withdrawal.sh`: concorrência nas baixas de estoque
- `atomic_document_import_integration.sql`: importação atômica, falha e rollback
- `integration_contract_create.sql`: integração de cadastro atômico e prevenção de duplicidade
- `contract_expiry_alerts_integration.sql`: vencimentos, deduplicação e fila
- `organization_membership_removal_integration.sql` e `tenant_role_matrix_integration.sql`: perfis, organização e acesso
- `audit_deduplication_integration.sql`: auditoria
- `invitations_quotas_integration.sql`: convites e cotas

Os testes SQL criam usuários e organizações **fictícios, apenas em uma instância temporária do CI**, com transações revertidas. Não comprovam que todos os fluxos do navegador, upload real, entrega de e-mails ou integrações externas funcionem.

## Ambiente real: constatações somente leitura
Na inspeção de 24/10/2026, o projeto Supabase Licits2.0 tinha **uma organização** e **zero** contratos, itens, documentos, fiscalizações, ocorrências e registros de preços. Isso impede validar a jornada funcional real nessas telas sem cadastrar dados de homologação. **Nenhum dado real foi criado ou modificado nesta tarefa.**

A implantação Vercel `licits.vercel.app` estava READY para o commit da primeira tarefa crítica (`cb3e3eb`) antes desta PR.

## Critérios para o aceite formal (ainda exigem teste manual)
1. Abrir cada módulo com sessão real em ambiente de homologação e testar criação, edição, busca, filtros, detalhes, erros e exclusão lógica.
2. Conferir upload, visualização, versão e download de documentos reais no Supabase Storage.
3. Validar compras/baixas, valor gasto, saldo disponível e alertas depois de operações pela interface, inclusive simultâneas.
4. Testar registro de preços, vínculo de itens/fornecedores, fiscalização e ocorrências por usuário com papéis permitidos/não permitidos.
5. Verificar e-mail transacional, notificações, Edge Functions, logs e falhas de serviços externos.
6. Registrar evidências da execução e aceite do responsável, inclusive versões desktop e mobile.

**Status da tarefa crítica 2:** automação/regressão do banco em ampliação; homologação funcional ponta a ponta depende de dados e sessões num ambiente isolado. Não declarar aprovado apenas pelo CI.
