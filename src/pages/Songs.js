import axios from 'axios';
import { toast } from 'sonner';
import { Music, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Ouvre le site CEC Songs, déjà connecté (SSO : jeton à usage unique, 2 min). La fenêtre est ouverte tout de suite
// (clic utilisateur) pour éviter le blocage des fenêtres surgissantes.
export default function Songs() {
  const open = async () => {
    const win = window.open('', '_blank');
    try {
      const res = await axios.post(`${API}/songs/sso-handoff`);
      if (win) win.location.href = res.data.redirect_url;
      else window.location.href = res.data.redirect_url;
    } catch (err) {
      if (win) win.close();
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir CEC Songs");
    }
  };
  return (
    <div className="space-y-6" data-testid="songs-page">
      <div>
        <h1 className="text-2xl font-bold">CEC Songs</h1>
        <p className="text-muted-foreground">Répertoire de chants : recherche dans les paroles. Connexion avec votre compte PAV Manager.</p>
      </div>
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-primary text-white flex items-center justify-center shrink-0"><Music className="w-6 h-6" /></div>
          <div className="flex-1">
            <p className="font-medium">Ouvrir le répertoire CEC Songs</p>
            <p className="text-sm text-muted-foreground">Vous êtes connecté automatiquement, sans ressaisir de mot de passe.</p>
          </div>
          <Button onClick={open} data-testid="open-songs"><ExternalLink className="w-4 h-4 mr-2" /> Ouvrir CEC Songs</Button>
        </CardContent>
      </Card>
    </div>
  );
}
