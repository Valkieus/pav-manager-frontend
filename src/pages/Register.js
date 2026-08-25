import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Loader2, UserPlus, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Register() {
  const [techniciens, setTechniciens] = useState([]);
  const [loadingTechniciens, setLoadingTechniciens] = useState(true);
  const [technicienId, setTechnicienId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/techniciens/unclaimed`)
      .then((res) => setTechniciens(res.data))
      .catch(() => setError("Impossible de charger la liste des techniciens"))
      .finally(() => setLoadingTechniciens(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!technicienId) {
      setError('Choisissez votre nom dans la liste');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, {
        technicien_id: technicienId,
        username,
        password,
      });
      const { access_token } = res.data;
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      // Full reload so AuthProvider picks up the fresh token/user cleanly.
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de la création du compte");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative animate-fadeIn" data-testid="register-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-black flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/logo.png" alt="PAV" className="w-16 h-16 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl">Créer mon compte</CardTitle>
            <CardDescription className="mt-2">
              Réservé aux techniciens déjà enregistrés dans l'Effectif
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="animate-fadeIn">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Mon nom</Label>
              <Select value={technicienId} onValueChange={setTechnicienId} disabled={loadingTechniciens || loading}>
                <SelectTrigger data-testid="register-technicien">
                  <SelectValue placeholder={loadingTechniciens ? "Chargement..." : "Choisissez votre nom"} />
                </SelectTrigger>
                <SelectContent>
                  {techniciens.length === 0 && !loadingTechniciens ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Tous les techniciens ont déjà un compte
                    </div>
                  ) : (
                    techniciens.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {[t.prenom, t.nom].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vous ne vous trouvez pas dans la liste ? Contactez un responsable pour être ajouté à l'Effectif.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-username">Identifiant souhaité</Label>
              <Input
                id="reg-username"
                type="text"
                placeholder="Choisissez un identifiant"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                data-testid="register-username"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="register-password"
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

            <div className="space-y-2">
              <Label htmlFor="reg-confirm">Confirmer le mot de passe</Label>
              <Input
                id="reg-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="Répétez le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 btn-press shadow-lg shadow-primary/20"
              disabled={loading || loadingTechniciens}
              data-testid="register-submit"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création du compte...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Créer mon compte
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm mt-6">
            <Link to="/login" className="text-primary hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Retour à la connexion
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
