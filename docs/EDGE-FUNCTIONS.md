# Funções seguras do Supabase

Implementadas no diretório `supabase/functions/`: `invite-member` (convite restrito ao administrador), `send-email` (Resend para membros da mesma organização), `analyze-contract` (OpenAI para assistência, sem escrita no banco).

**Requer configuração de servidor e validação integrada.** Implante em projeto Supabase de desenvolvimento:

```bash
npx supabase@latest functions deploy invite-member
npx supabase@latest functions deploy send-email
npx supabase@latest functions deploy analyze-contract
```

Mantenha **apenas no servidor** os segredos `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OPENAI_API_KEY` e as credenciais administrativas Supabase. Não os adicione a `VITE_` nem ao GitHub. Um domínio remetente verificado é necessário para o Resend.
