import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

function ConfigError({ heading, details }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <section className="max-w-xl w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-lg space-y-4">
        <h1 className="text-2xl font-bold text-blue-800">Licits — {heading}</h1>
        <p className="text-slate-700">{details}</p>
        <pre className="rounded-lg bg-slate-900 text-slate-50 p-4 text-sm overflow-x-auto">bash scripts/restaurar-acesso.sh</pre>
        <p className="text-sm text-slate-600">
          O sistema nao excluiu seus usuarios. Use o MESMO projeto Supabase que tinha antes
          e consulte docs/RECUPERAR-ACESSO.md no GitHub.
        </p>
      </section>
    </main>
  );
}
if (!url || !key || url.includes('your-project') || key.includes('your_publishable_key_here')) {
  root.render(<ConfigError
    heading="Conexao nao configurada"
    details="A URL ou a chave publica Supabase estao ausentes. Recupere seu .env local para acessar os usuarios e dados anteriores."
  />);
} else {
  import('@/App.jsx')
    .then(({ default: App }) => root.render(<App />))
    .catch(() => root.render(<ConfigError
      heading="Falha ao iniciar"
      details="Verifique se .env ou .env.local apontam para o projeto Supabase correto. Confira o console do navegador para diagnosticar."
    />));
}
