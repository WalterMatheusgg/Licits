# NexoFiscal • Operação, backups e recuperação

> **Estado:** proteção e procedimentos implementados no repositório. A implantação no Supabase real, uma rotina externa de backup, o monitoramento e o teste de restauração de arquivos devem ser configurados e validados antes de considerar o sistema pronto para produção.

## 1. Checklist de implantação segura

1. Conectar um projeto Supabase **de homologação** distinto da produção. Conferir migrations com `supabase db push --dry-run --linked` antes de qualquer mudança.
2. Executar testes CI em banco descartável e testar login, confirmação de e-mail, recuperação de senha, convites, perfis e acesso indevido entre duas organizações reais de homologação.
3. Implantar Edge Functions autenticadas e inserir chaves privadas **somente** nos segredos do Supabase.
4. Conferir domínios autorizados de autenticação, TLS, MFA para administradores, política de sessão e buckets privados.
5. Criar mecanismo de backup independente, testar restauração do banco **e dos arquivos Storage** e medir RPO/RTO.
6. Publicar frontend estático com HTTPS, políticas de CSP e cabeçalhos defensivos no host e telemetria de erro redigida.
7. Verificar LGPD: finalidade, base legal, controle de acesso, atendimento a direitos do titular, retenção por categoria e registro de alterações.

## 2. Backup seguro

O `scripts/backup-database.sh` exige PostgreSQL client, `age`, chave pública de destinatário `age1...` e URL privada do banco na variável `NEXOFISCAL_DATABASE_URL`.

```bash
export NEXOFISCAL_DATABASE_URL="postgresql://USUARIO:SENHA@HOST:5432/postgres?sslmode=require"
export NEXOFISCAL_BACKUP_AGE_RECIPIENT="age1SUA_CHAVE_PUBLICA_AQUI"
export NEXOFISCAL_BACKUP_DIR="/local/privado/licit-backups"
bash scripts/backup-database.sh
```

A senha e a chave privada da criptografia **não devem entrar no GitHub ou no histórico do terminal**; configure as variáveis por um gerenciador de segredos. Para copiar o backup criptografado para armazenamento externo configurado com versionamento e proteção contra exclusões, utilize `NEXOFISCAL_BACKUP_S3_URI` com credenciais temporárias de privilégio mínimo. O script gera arquivo `.age` e `.sha256` e valida a estrutura do dump; **não afirma que o restore foi testado**.

**Atenção:** `pg_dump` inclui metadados Storage no PostgreSQL, **mas não os bytes dos objetos**. Configure exportação independente dos buckets privados `contracts`, `fiscal-records`, `occurrences`, `generated-documents`, `organization-assets`, mantendo identificadores/prefixos, regras LGPD e criptografia. Sem isso, a restauração é incompleta.

## 3. Restauração (homologação exclusivamente)

1. Criar banco/instância Supabase **descartável** isolada da produção. Nunca usar `--clean` contra o banco original.
2. Recuperar os objetos de Storage criptografados e o dump `.age`; validar SHA256 e descriptografar offline com chave privada `age`.
3. Verificar inventário com `pg_restore --list arquivo.dump`.
4. Restaurar somente no destino descartável com `pg_restore --exit-on-error --no-owner --no-privileges --dbname "$TEST_RESTORE_DATABASE_URL" arquivo.dump` (preparar extensões/papéis/auth/schema de acordo com o Supabase).
5. Restaurar arquivos aos buckets privados correspondentes, confrontar quantidade/hash, conferir RLS e usuários, e executar testes CRUD e isolamento.
6. Registrar data da última restauração **efetivamente concluída**, responsável, erros, tempo de restauração e testes de integridade.

Política inicial sugerida para revisão: **RPO até 24 h; RTO até 8 h**, ajustados à criticidade real e ao plano contratado. Um dump diário não entrega RPO menor que 24 h sem PITR. Se forem exigidos RPO menor ou restauração rápida, habilite recursos de backup/PITR compatíveis com o plano Supabase.

## 4. Observabilidade e resposta a incidentes

- Medir disponibilidade, latência e erros 5xx de Auth, PostgREST, Storage e Edge Functions **fora do browser**, com checagem por origem confiável.
- Observar falhas em callbacks de autenticação, convites, RPC de baixa, acessos RLS indevidos, e-mails rejeitados, IA com erro e filas/limites de serviços.
- Criar alertas para falha no backup diário, falta de backup por 26 h, crescimento de armazenamento, indisponibilidade e uso atípico de API.
- Em incidente: revogar tokens e segredos comprometidos, bloquear usuários, preservar evidências de auditoria, restaurar em ambiente separado e documentar o ocorrido.
- Não registrar CPF/CNPJ, contratos, PDFs, prompts privados nem chaves de API em logs de observabilidade.

## 5. LGPD e retenção

Contratos, documentos fiscais e atos administrativos podem ter prazos legais de guarda diferentes, conforme espécie e órgão. **Não há prazo universal que possa ser imposto automaticamente.** Formalize uma matriz de retenção, base legal e responsáveis antes de autorizar exclusão definitiva.

- Usar arquivamento lógico por RPC; não apagar fisicamente contratos e documentos em cascata a pedido do frontend.
- Registrar criação/alteração/arquivamento com usuário, horário e organização; manter trilhas de auditoria sob autorização restrita.
- Agendar revisão periódica de acessos, permissões e convites pendentes. Contas sem vínculo ativo não devem consultar dados organizacionais.
- Estabelecer retenção, expurgo seguro (inclusive backups), exportação e direitos do titular com o encarregado de dados.

## 6. Critério de aceite para produção

Somente declare *pronto para produção* após registro verificável de: testes reais de CRUD; convite e aceite; isolamento com contas reais; confirmação de políticas e filas; envios de e-mails reais; IA com custos e limites; backup **e restore de banco e Storage**; monitoramento e HTTPS; testes de regressão após deploy.
