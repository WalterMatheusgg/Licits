import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Explicit confirmation prevents link-preview bots from consuming one-time
// Supabase tokens simply by requesting the URL. Never log or store token hashes.
export default function ConfirmAccess() {
  const [invitation] = useState(() => {
    // Fragment values are never sent to Vercel. Query params remain supported
    // so previously-issued invitation links continue to work.
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    const type = params.get('type');
    const tokenHash = params.get('token_hash');
    return {
      type,
      tokenHash,
      valid: Boolean(tokenHash && /^[0-9a-f]+$/i.test(tokenHash) && ['invite', 'magiclink'].includes(type)),
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Keep the one-time token out of browser history and accidental referrers.
    window.history.replaceState(window.history.state, '', '/auth/confirm');
  }, []);

  const confirm = async () => {
    if (!invitation.valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: invitation.tokenHash,
        type: invitation.type,
      });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error('Não foi possível iniciar sua sessão.');
      navigate(invitation.type === 'invite' ? '/update-password?source=invite' : '/', { replace: true });
    } catch (requestError) {
      setError(/expired|invalid|not found|otp/i.test(requestError.message || '')
        ? 'Este convite expirou ou já foi utilizado. Peça ao administrador para reenviar o convite.'
        : 'Não foi possível confirmar o convite. Solicite um novo link ao administrador.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirmar convite do Licits</CardTitle>
          <CardDescription>
            Confirme o acesso usando o link pessoal recebido por e-mail.
            A organização só será liberada depois que você aceitar o convite no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!invitation.valid && (
            <Alert variant="destructive">
              <AlertDescription>Link inválido ou incompleto. Solicite um novo convite.</AlertDescription>
            </Alert>
          )}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button className="w-full" onClick={confirm} disabled={!invitation.valid || busy}>
            {busy ? 'Confirmando acesso...' : 'Confirmar meu e-mail e continuar'}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Voltar ao login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
