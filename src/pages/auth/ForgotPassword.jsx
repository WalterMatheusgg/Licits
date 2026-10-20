import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      await resetPassword(email);
      setMessage('Se a conta existir, o Supabase enviará um link de recuperação.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível solicitar a recuperação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>Informe seu e-mail para receber o link de redefinição.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar link'}
            </Button>
          </form>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login"><ArrowLeft className="w-4 h-4 mr-2" />Voltar ao login</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
