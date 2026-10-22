# Contrato demonstrativo para fiscal — 50% utilizado

Este roteiro se refere a dados **100% fictícios**, **não constitui licitação real**.

| Identificação | Valor |
| --- | --- |
| Número do contrato | `014/2026-NEXOFISCAL-DEMO` |
| Pregão fictício | `PE-DEMO-014/2026` |
| Valor contratado | R$ 100.000,00 |
| Valor já utilizado | R$ 50.000,00 (50%) |
| Saldo disponível | R$ 50.000,00 |
| Item | 100 kits × R$ 1.000,00 |
| Utilizado | 50 kits |
| Fiscal | Conta ativa da organização de demonstração |

## Inserir no banco de desenvolvimento

O PDF entregue na conversa contém a minuta e roteiro de testes. Para inserir os dados de fato, crie uma organização de **homologação** que tenha `DEMO` ou `TESTE` no nome. Cadastre um fiscal ativo e identifique os UUIDs. O script **recusa** organizações sem a marca de demonstração e não modifica um contrato demo já existente.

```bash
psql "$DATABASE_URL" -v org_id=UUID_DA_ORGANIZACAO_DEMO \
  -v fiscal_id=UUID_DO_FISCAL \
  -f supabase/demo/contrato_50_porcento.sql
```

Não execute no ambiente de produção. Use conexão TLS e gerenciador de segredos para a URL do banco.

## Testar a tela de contrato

1. Entre com o fiscal e abra **Contratos → 014/2026-NEXOFISCAL-DEMO → Estoque**.
2. Em **Baixar**, informe 30 kits e uma ordem de fornecimento. A prévia deve mostrar R$ 30 mil adicionais e utilização projetada de **80%**. Confirme. O aviso ficará na fila.
3. Registre mais 10 kits, atingindo **90%** e um segundo aviso.
4. Registre mais 10 kits, atingindo **100%**, sem saldo restante.
5. Tente mais 1 kit: a operação deve ser **bloqueada no PostgreSQL**, sem movimento parcial.
6. Para receber os e-mails externos, é necessário configurar a [fila de notificações](ALERTAS-FISCAL.md), o Resend e o agendamento do GitHub Actions.

**Observação:** o PDF sozinho não cria registros no Supabase. É necessário cadastrar manualmente ou usar o script SQL acima.
