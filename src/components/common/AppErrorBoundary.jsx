import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // No user data, tokens or document contents should be logged.
    console.error('Falha ao renderizar módulo do Licits:', error?.name || 'Erro desconhecido',
      info?.componentStack?.slice(0, 500) || '');
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" className="min-h-[60vh] flex items-center justify-center p-6">
          <section className="max-w-lg w-full rounded-xl border bg-card p-7 space-y-4">
            <h1 className="text-xl font-bold">Não foi possível abrir este módulo</h1>
            <p className="text-sm text-muted-foreground">
              Pode ter ocorrido uma atualização da aplicação ou falha de rede.
              Suas alterações já gravadas no banco não serão modificadas ao atualizar a página.
              Revise operações ainda não confirmadas antes de repeti-las.
            </p>
            <button
              type="button"
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 font-semibold"
              onClick={() => window.location.reload()}
            >Recarregar Licits</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
