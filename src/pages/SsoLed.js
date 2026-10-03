import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const POST_LOGIN_KEY = 'post_login_next';
const SSO_LED_PATH = '/sso-led';

// Page d'entrée SSO du site Éléments LED (flux de redirection type Okta) :
// le site LED renvoie ici un visiteur non connecté. Si une session PAV Manager
// existe déjà, on obtient un jeton à usage unique et on repart tout de suite
// vers le site LED (aucun clic, aucune ressaisie). Sinon : écran de connexion
// PAV Manager, puis retour automatique ici.
export default function SsoLed() {
  const { isAuthenticated, loading } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated || started.current) return;
    started.current = true;
    sessionStorage.removeItem(POST_LOGIN_KEY);
    axios.post(`${API}/led/sso-handoff`)
      .then((res) => { window.location.replace(res.data.redirect_url); })
      .catch((err) => setError(err.response?.data?.detail || "Impossible d'ouvrir le site LED"));
  }, [loading, isAuthenticated]);

  if (loading) return null;
  if (!isAuthenticated) {
    sessionStorage.setItem(POST_LOGIN_KEY, SSO_LED_PATH);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-medium mb-1">Accès au site LED impossible</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <a href="/" className="text-sm text-primary underline">Retour à PAV Manager</a>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ouverture du site Éléments LED...</p>
          </>
        )}
      </div>
    </div>
  );
}
