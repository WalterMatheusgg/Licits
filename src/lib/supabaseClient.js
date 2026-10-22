import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
// Compatibilidade com arquivos .env antigos que utilizavam a chave anon.
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabasePublishableKey ||
    supabaseUrl.includes('your-project') ||
    supabasePublishableKey.includes('your_publishable_key_here')) {
  throw new Error(
    'Configuracao Supabase ausente. Recupere o .env original com scripts/restaurar-acesso.sh ' +
    'e reinicie o servidor Vite.'
  );
}
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
