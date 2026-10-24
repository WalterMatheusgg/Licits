# Homologação remota somente leitura — Licits

A verificação automática local **não equivale** à homologação do Supabase real. O workflow [Licits - Homologação remota](../.github/workflows/remote-smoke.yml) oferece uma verificação de **somente leitura** e execução manual, sem mudar dados, usuários ou schema.

## Configurar no GitHub (Settings → Secrets and variables → Actions)

- `LICITS_SMOKE_SUPABASE_URL`: URL HTTPS **da homologação**, sem caminho final.
- `LICITS_SMOKE_PUBLISHABLE_KEY`: chave pública publishable/anon do mesmo projeto.

Não configure senha do banco, service_role nem tokens administrativos para esse teste. As chaves não são mostradas nos logs. Em Actions, execute manualmente o workflow **Licits - Homologacao remota somente leitura**.

O script verifica conectividade de Supabase Auth e se requisições **anônimas** não revelam contratos, vínculos de usuários ou credenciais de integração. Ele não autentica usuários reais nem envia e-mails, portanto não deve ser apresentado como teste de produção concluído.

## Aceite obrigatório antes de colocar usuários reais

1. Verificar o projeto vinculado, backup íntegro e correspondência de todas as migrations no destino;
2. Testar login, recuperação de senha, expiração de sessão e aceite de convite **com duas contas reais de homologação em organizações distintas**;
3. Validar visualmente CRUD de contratos, atas, arquivos, ocorrências e permissões; exigir bloqueio de acesso indevido;
4. Simular compra até 80, 90 e 100% e bloqueio de compras acima de limite;
5. Implantar Edge Functions, enviar convites reais e comprovar e-mails de alertas no Resend;
6. Verificar backup criptografado do PostgreSQL **e bytes do Supabase Storage**, restaurar ambos em ambiente isolado;
7. Configurar alertas de indisponibilidade, backlog de e-mails, backups e incidentes; aprovar retenção/LGPD.

**Não aplique `supabase db push` na produção sem backup e homologação.**

## Conferência de auditoria no banco vinculado

A migration `20261022220000_deduplicate_safe_audit.sql` deve constar como aplicada no remoto **antes** de executar a verificação abaixo. Ela remove triggers antigos, mas não remove registros históricos que possam conter dados sensíveis.

A consulta de `scripts/verify-audit-readonly.sql` **não altera registros**: verifica os gatilhos seguros, a ausência dos gatilhos antigos e imprime apenas a contagem de registros históricos com chaves potencialmente sensíveis, nunca seus valores.

Use o SQL Editor do projeto de **homologação** para executar o script, depois confira `npx supabase migration list` e as versões em `npx supabase functions list` no terminal autenticado. O sucesso no GitHub Actions significa somente que a migração passou no banco descartável da CI, não que foi implantada no Supabase real.

Se a contagem histórica for positiva, trate a retenção/expurgo com o responsável por LGPD e o administrador do banco; não apague a trilha de auditoria indiscriminadamente.
