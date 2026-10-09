import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, LogIn, AlertCircle, Eye, EyeOff, ScanFace } from 'lucide-react';
import { passkeyLogin, passkeySupported, passkeyEnrolledHere } from '../lib/passkey';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithData } = useAuth();
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { passkeySupported().then((ok) => setBioOk(ok && passkeyEnrolledHere())); }, []);

  const handleBiometric = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await passkeyLogin();
      await loginWithData(data);
      const next = sessionStorage.getItem('post_login_next');
      navigate(['/sso-led', '/sso-academy'].includes(next) ? next : '/');
    } catch (err) {
      if (err?.name !== 'NotAllowedError') setError(err.response?.data?.detail || 'Face ID / empreinte indisponible : utilisez votre mot de passe');
    } finally {
      setLoading(false);
    }
  };
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      const next = sessionStorage.getItem('post_login_next');
      navigate(['/sso-led', '/sso-academy'].includes(next) ? next : '/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative animate-fadeIn" data-testid="login-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-black flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/logo.png" alt="PAV" className="w-16 h-16 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl">PAV Manager</CardTitle>
            <CardDescription className="mt-2">
              Système de gestion du département PAV
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {bioOk && (
            <div className="mb-4 space-y-3">
              <Button type="button" onClick={handleBiometric} disabled={loading} className="w-full h-12 btn-press shadow-lg shadow-primary/20" data-testid="login-biometric">
                <ScanFace className="w-5 h-5 mr-2" /> Se connecter avec Face ID / empreinte
              </Button>
              <p className="text-center text-xs text-muted-foreground">ou avec votre mot de passe :</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-fadeIn">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Identifiant</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Entrez votre identifiant"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                data-testid="login-username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="login-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 btn-press shadow-lg shadow-primary/20" 
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link to="/inscription" className="text-primary hover:underline">
              Vous êtes technicien et n'avez pas encore de compte ? Créer mon compte
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Production Audiovisuelle - Gestion Technique
          </p>
          <p className="text-center text-xs text-muted-foreground mt-1">
            <Link to="/confidentialite" className="hover:underline">Politique de confidentialité (RGPD)</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
