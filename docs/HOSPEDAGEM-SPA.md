# Publicação SPA — Licits

O Licits usa React Router e precisa responder com `index.html` a rotas como `/login`, `/contracts/:id` e `/fiscal` quando o usuário recarrega a página. Sem o fallback, links diretos retornam 404 embora a aplicação compile.

- **Vercel:** `vercel.json` define o build para `dist` e reescrita das rotas de frontend, preservando os arquivos de `assets/`.
- **Netlify:** `public/_redirects` é copiado ao diretório `dist` e encaminha rotas do React Router para `index.html`.
- **Outros hosts:** configure o fallback equivalente e HTTPS.

Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` **no ambiente de build** do host. Nunca insira `service_role` ou chaves secretas em `VITE_`. Confirme `Site URL` e `Redirect URLs` em Supabase Auth para o domínio publicado, especialmente redefinição de senha e convites.

Antes de liberar produção, abra `/login` e `/contracts/id` diretamente no navegador e confirme que a página carrega, os assets recebem HTTP 200 e o Supabase usa o projeto correto.
