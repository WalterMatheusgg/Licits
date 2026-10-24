# Estado da homologação — Licits — 24/10/2026

> Documento operacional. Não equivale à aprovação formal de produção.

## Ambientes e base de evidências
- GitHub: [WalterMatheusgg/Licits](https://github.com/WalterMatheusgg/Licits), branch `main`.
- Supabase ativo: projeto **Licits2.0** (ref. `nefimqoszcidsnqvlnnh`).
- Vercel: projeto **licits**, domínio [licits.vercel.app](https://licits.vercel.app). O deploy do commit `0acc7a1` estava **READY** na inspeção de 24/10/2026.
- CI da referência `0acc7a1`: [frontend](https://github.com/WalterMatheusgg/Licits/actions/runs/40079054152), [Supabase SQL](https://github.com/WalterMatheusgg/Licits/actions/runs/40079054148) e [Edge Functions](https://github.com/WalterMatheusgg/Licits/actions/runs/40079054146), todos concluídos com sucesso.
- Testes manuais de autenticação, convite, confirmação, recuperação e bloqueio/desbloqueio: reportados como concluídos. Exigem regressão após as mudanças de segurança e interface.

## Segurança e auditoria
- Papel `anon` não executa as funções `SECURITY DEFINER` do esquema `public` no banco examinado.
- 20 alertas `auth_rls_initplan` removidos após otimização do uso de `auth.uid()`; migração remota versionada como `20261024084913` e correspondente SQL incluído no repositório.
- 17 funções `SECURITY DEFINER` continuam acessíveis ao papel `authenticated`. Foram inspecionadas suas definições; **não** equivalem a prova de isolamento adversarial para todos os papéis. Revisão com usuários reais permanece necessária.
- Três tabelas internas de integração mantêm RLS sem política e não permitem SELECT para `anon` ou `authenticated`; comportamento intencional até revisão de arquitetura.
- Supabase Advisor ainda sinaliza proteção contra senhas vazadas **desabilitada**, 52 chaves estrangeiras sem índice de cobertura, 24 índices sem uso detectado e uma ocorrência de políticas permissivas múltiplas. Índices e alterações de permissão exigem revisão de custo e de regressão.

## Responsividade
- Corrigidos componentes comuns de abas, tabelas, formulários, diálogos, barra superior e navegação mobile.
- **Falta** teste manual em 320, 360, 375, 390, 430 e 768 px nas rotas autenticadas, com diferentes perfis e organizações; confirmar sem rolagem horizontal do documento e sem ações inacessíveis.

## Bloqueios para homologação formal
1. Executar regressão autenticada completa entre pelo menos duas organizações (administrador, gestor, fiscal, operacional e visualizador), com tentativas de leitura e escrita fora de escopo.
2. Executar cenários positivos e negativos de cadastro/edição/exclusão de contratos, itens, baixas, compras, orçamento, registros de preços, fiscalização, ocorrências, documentos, Storage e integrações.
3. Validar envio **automático** de e-mail e recebimento final, incluindo filas, retries, destinatários e OAuth de longa duração.
4. Revisar Advisor de segurança do Supabase e habilitar proteção contra senhas vazadas no Auth, se suportada pelo plano; avaliar funções privilegiadas restantes.
5. Inspecionar logs de Vercel, Supabase e Edge Functions sob carga e erro; configurar alertas operacionais.
6. Testar backup **e restauração** real de Postgres e Storage num ambiente isolado, incluindo RPO/RTO e verificação de integridade.
7. Revisar performance de índices, políticas permissivas, testes de carga e controles de custo.
8. Obter aceite funcional das telas mobile, desktop, acessibilidade, comportamento offline/erros e termo de homologação assinado.

## Codespaces, GitHub e sincronização
Somente commits enviados ao repositório remoto são visíveis pela integração GitHub. Alterações **não commitadas** em um Codespace não estão comprovadamente incluídas; para conciliá-las execute `git status`, revise o diff e crie commit/push numa branch antes de mesclar. Nunca use `git push --force` nem faça upload de secrets. Siga [scripts/sincronizar-github.sh](../scripts/sincronizar-github.sh).

**Conclusão: projeto publicado, mas homologação final pendente.**
