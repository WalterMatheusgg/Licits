# Recuperacao do login e da conexao original — NexoFiscal

## Diagnostico do historico

O ZIP de origem do NexoFiscal tinha login pelo Supabase Auth e, em paralelo, um SDK Base44 usado em fluxos de negocio. Na migracao para Supabase, o cliente de dados Base44 foi removido. O arquivo original ZIP, examinado no historico do GitHub, **nao contem .env ou .env.local** com as credenciais originais.

O repositorio GitHub esta **publico**. Nao publique .env, senhas, service role, chaves privadas ou tokens nesse repositorio, mesmo que pretenda altera-lo para privado.

## Recuperar a conexao sem criar outro banco

1. Use exatamente o projeto Supabase anterior. Confira em Supabase Dashboard → Project Settings → API Keys a Project URL e uma chave publica publishable ou anon desse projeto.
2. Se possui .env.local/.env de uma pasta antiga do NexoFiscal, importe o arquivo com:

~~~bash
bash scripts/restaurar-acesso.sh --from "/CAMINHO/DA/INSTALACAO_ANTIGA/.env.local"
~~~

Se o .env.local atual ja possui as configuracoes, basta executar:

~~~bash
bash scripts/restaurar-acesso.sh
~~~

Caso nao tenha nenhum arquivo, execute o mesmo comando no terminal interativo e informe a URL e a chave publica. O script nao as publica no GitHub, nao imprime a chave e define permissao 600.

3. Confira a presenca das configuracoes (sem mostrar valores):

~~~bash
bash scripts/restaurar-acesso.sh --status
~~~

4. Execute **npm ci**, **npm run dev**, e acesse **/login**. O Vite usa .env.local com precedencia sobre .env; caso o projeto esteja apontando para um Supabase errado, reveja o arquivo local sem apagar sua copia de seguranca.
5. Para a conta existente, confirme **Authentication → Users** e a configuracao de recuperacao de senha em **Authentication → URL Configuration**. Uma conta autentica mas sem acesso exige vinculo em **public.profiles** e **public.organization_members** na mesma organizacao ativa. Nao recrie usuarios, bancos ou organizacoes sem conferir os registros existentes.

**Importante:** contas e senhas da Base44 nao podem ser transferidas simplesmente para Supabase. Se sua conta anterior era exclusivamente Base44, e necessario provisionar uma identidade Supabase autorizada e vincula-la a organizacao correta.

## Chaves de API

- No .env local do **React**: apenas Project URL e publishable/anon key, que sao proprias de clientes publicos.
- No gerenciador de segredos das **Supabase Edge Functions**: RESEND_API_KEY, RESEND_FROM_EMAIL, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY e ALERT_DISPATCH_SECRET. Nunca com prefixo VITE_.
- Nos **GitHub Actions Secrets**: LICITS_DISPATCH_URL e LICITS_ALERT_DISPATCH_SECRET, quando a rotina estiver implantada.

A verificacao de CI no GitHub compila o codigo, mas nao comprova que sua conta e seu banco antigos estejam disponiveis. A recuperacao precisa da configuracao real do mesmo projeto Supabase.

**O script nao muda nada no banco de dados nem reseta contas e senhas.**
