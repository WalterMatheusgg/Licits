# Extração de documentos com IA

A função extract-document requer usuário autenticado com papel administrador/gestor e recebe apenas um caminho no bucket privado da organização, nunca uma URL externa. Limite de 6 MB; PDF, JPG ou PNG. O arquivo é enviado a um modelo multimodal da OpenAI **somente após o usuário clicar para analisar**.

Faça deploy: `npx supabase@latest functions deploy extract-document`, depois configure `OPENAI_API_KEY` **no Supabase Edge**, jamais no navegador. O resultado exige revisão humana e não constitui interpretação jurídica.
