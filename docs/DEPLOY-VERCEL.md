# Publicar Licits na Vercel

## Fonte e build

- Repositório privado: `WalterMatheusgg/Licits`
- Branch de produção: `main`
- Framework: Vite / React
- Diretório raiz: `.`
- Install: `npm ci`
- Build: `npm run build`
- Output: `dist`
- Rotas SPA: fallback já configurado em `vercel.json`.

A Vercel precisa estar autorizada a importar esse repositório GitHub. Não pressupor subdomínio `.vercel.app` antes de criar o projeto e confirmar a URL real.

## Variáveis do frontend

Configurar no projeto Vercel, ambiente Production:

```dotenv
VITE_SUPABASE_URL=https://nefimqoszcidsnqvlnnh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<chave_publishable_ativa_no_Supabase>
VITE_ENVIRONMENT=production
```

Obter a chave publishable ativa no painel **Supabase → Project Settings → API Keys**. Não usar `sb_secret_...`, `service_role`, refresh tokens, senhas, chaves privadas ou segredos em `VITE_*`: essas variáveis são incorporadas ao JavaScript servido aos visitantes. Reimplantar após alterações.

## Permitir acesso por dispositivos externos

Confirmar em janela anônima ou celular que o domínio público Vercel abre `/login` sem autenticação do GitHub ou da própria Vercel. Revisar **Settings → Deployment Protection**: produção deve ser acessível ao público; autenticação e autorizações continuam exclusivamente no **Licits/Supabase Auth**. Os previews podem permanecer protegidos.

## Supabase Auth — domínio real obrigatório

Depois do primeiro deploy e da confirmação do domínio real:

1. Abrir **Supabase → Authentication → URL Configuration** do projeto `nefimqoszcidsnqvlnnh`.
2. Alterar **Site URL** para `https://<DOMINIO-VERCEL-REAL>` (sem caminho).
3. Adicionar **Redirect URLs** `https://<DOMINIO-VERCEL-REAL>/**`.
4. Opcional para desenvolvimento: manter `http://localhost:5173/**`, mas não manter `localhost` como Site URL.
5. Conferir os templates de convite, recuperação e confirmação: o link de verificação recomendado usa `{{ .ConfirmationURL }}`; templates customizados que apontam diretamente para `{{ .SiteURL }}` podem divergir do `redirectTo`.
6. Reenviar convites emitidos com URL antiga ou expirados.

### Edge Function de convites

A função `invite-member` suporta a variável **somente no Supabase Edge Functions** `PUBLIC_APP_URL`, configurada com a **origem exata** `https://<DOMINIO-VERCEL-REAL>`. Quando preenchida, a função solicita ao Supabase Auth o redirecionamento explícito tanto para convites novos quanto para magic links de contas existentes.

- Configurar `PUBLIC_APP_URL` nas **Edge Function Secrets** do Supabase somente após publicar e verificar o domínio.
- O valor deve corresponder a um dos **Redirect URLs** permitidos no Supabase Auth; URLs não permitidas podem fazer o Supabase usar o Site URL como fallback.
- Nunca usar um endereço fornecido pelo cliente, `Origin` ou `Host` como fonte do redirect.
- Caso `PUBLIC_APP_URL` ainda não esteja configurada, o Supabase Auth utiliza a configuração de **Site URL** hospedada. Não deixar essa configuração apontando para `localhost:3000`.
- Não adicionar `PUBLIC_APP_URL` como segredo em `VITE_*` nem confiar em domínios de preview como URL de produção.

A confirmação de e-mail do **Supabase Auth** não é a mesma coisa que aceitar o convite da organização. Após confirmar e efetuar login, o convidado aceita o vínculo `invited` no Licits; só então seu status muda para `active`.

## Checklist de verificação

- `https://<DOMINIO-VERCEL-REAL>/login` abre em celular, com GitHub desconectado.
- Rotas `/users`, `/forgot-password` e `/update-password` não devolvem 404 ao recarregar.
- Login regular e isolamento por organização seguem funcionando, usando RLS.
- Convite novo: entrega de e-mail, clique, confirmação do endereço, autenticação e aceite.
- Convite para conta existente: e-mail de acesso e aceite da nova associação organizacional.
- Bloquear / desbloquear / excluir vínculo e convidar novamente preservam histórico.
- Os testes CI passam e nenhuma credencial privilegiada foi publicada.

**Critério de conclusão:** confirmar tanto o deploy público como os redirecionamentos de autenticação; o arquivo de configuração, sozinho, não publica o site nem altera as opções do Supabase hospedado.
