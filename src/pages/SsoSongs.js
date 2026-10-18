import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POST_LOGIN_KEY = 'post_login_next';
const SSO_SONGS_PATH = '/sso-songs';

// Page d'entrée SSO du site CEC Songs (flux de redirection type Okta) :
// le site CEC Songs renvoie ici un visiteur non connecté. Si une session PAV Manager
// existe déjà, on obtient un jeton à usage unique et on repart tout de suite
// vers le site CEC Songs (aucun clic, aucune ressaisie). Sinon : écran de connexion
// PAV Manager, puis retour automatique ici.
export default function SsoSongs() {
  const { isAuthenticated, loading } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated || started.current) return;
    started.current = true;
    sessionStorage.removeItem(POST_LOGIN_KEY);
    axios.post(`${API}/songs/sso-handoff`)
      .then((res) => { window.location.replace(res.data.redirect_url); })
      .catch((err) => setError(err.response?.data?.detail || "Impossible d'ouvrir le site CEC Songs"));
  }, [loading, isAuthenticated]);

  if (loading) return null;
  if (!isAuthenticated) {
    sessionStorage.setItem(POST_LOGIN_KEY, SSO_SONGS_PATH);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-medium mb-1">Accès à CEC Songs impossible</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <a href="/" className="text-sm text-primary underline">Retour à PAV Manager</a>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ouverture de CEC Songs...</p>
          </>
        )}
      </div>
    </div>
  );
}
