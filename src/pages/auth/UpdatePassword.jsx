import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { updatePassword, authUser, isLoadingAuth } = useAuth();
  const [params] = useSearchParams();
  const isInvitation = params.get('source') === 'invite';
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!authUser) {
      setError('Sua sessão não está ativa. Confirme o convite pelo link enviado ao e-mail.');
      return;
    }

    if (password.length < 8) {
      setError('Use uma senha com pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível alterar a senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isInvitation ? 'Crie sua senha de acesso' : 'Definir nova senha'}</CardTitle>
          <CardDescription>{isInvitation ? 'Seu endereço foi confirmado. Crie a senha para acessar o Licits e aceitar o convite da organização.' : 'Escolha uma nova senha para sua conta.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoadingAuth && !authUser && (
              <Alert variant="destructive"><AlertDescription>
                Não há sessão de confirmação ativa. <Link to="/login" className="underline">Voltar ao login</Link> ou abra novamente o link recebido.
              </AlertDescription></Alert>
            )}
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirmar senha</Label>
              <Input
                id="confirmation"
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || !authUser || isLoadingAuth}>
              {submitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
