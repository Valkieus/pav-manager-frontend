import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { POST_LOGIN_KEY } from './SsoLed';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SSO_ACADEMY_PATH = '/sso-academy';

// Page d'entrée SSO de PAV Academy (même flux de redirection que le site LED) :
// PAV Academy renvoie ici un visiteur non connecté. Si une session PAV Manager
// existe déjà, on obtient un jeton à usage unique et on repart tout de suite
// vers PAV Academy (aucun clic, aucune ressaisie). Sinon : écran de connexion
// PAV Manager, puis retour automatique ici.
export default function SsoAcademy() {
  const { isAuthenticated, loading } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated || started.current) return;
    started.current = true;
    sessionStorage.removeItem(POST_LOGIN_KEY);
    axios.post(`${API}/academy/sso-handoff`)
      .then((res) => { window.location.replace(res.data.redirect_url); })
      .catch((err) => setError(err.response?.data?.detail || "Impossible d'ouvrir PAV Academy"));
  }, [loading, isAuthenticated]);

  if (loading) return null;
  if (!isAuthenticated) {
    sessionStorage.setItem(POST_LOGIN_KEY, SSO_ACADEMY_PATH);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
            <p className="font-medium mb-1">Accès à PAV Academy impossible</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <a href="/" className="text-sm text-primary underline">Retour à PAV Manager</a>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Ouverture de PAV Academy...</p>
          </>
        )}
      </div>
    </div>
  );
}
