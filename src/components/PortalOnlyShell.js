import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Globe, KeyRound, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { PortalLinkItem } from '../pages/dashboard/PortalLinkItem';
import { DEFAULT_LINKS } from '../pages/dashboard/portalLinks';
import { openSongsSite } from '../lib/songs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
// Vue verrouillée (compte « portail seul ») : uniquement le portail de première connexion, avec LED, CEC Songs et la Recherche Biblique.
const SHOWN = ['songs', 'bible', 'led'];

export default function PortalOnlyShell() {
  const { user, logout, mustChangePassword, changePassword } = useAuth();
  const [ledLoading, setLedLoading] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [saving, setSaving] = useState(false);
  const links = SHOWN.map((id) => ({ ...DEFAULT_LINKS.find((l) => l.id === id), roles: [], enabled: true }));

  const openLed = async () => {
    const win = window.open('', '_blank');
    setLedLoading(true);
    try {
      const res = await axios.post(`${API}/led/sso-handoff`);
      if (win) win.location.href = res.data.redirect_url; else window.location.href = res.data.redirect_url;
    } catch (err) {
      if (win) win.close();
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir PAV LED");
    } finally { setLedLoading(false); }
  };
  const open = (link) => { if (link.kind === 'led') openLed(); else if (link.kind === 'songs') openSongsSite(); };

  const submitPassword = async (e) => {
    e.preventDefault();
    if (pwd.length < 8) { toast.error('Le mot de passe doit faire au moins 8 caractères'); return; }
    if (pwd !== pwd2) { toast.error('Les deux mots de passe sont différents'); return; }
    setSaving(true);
    try { await changePassword(pwd); toast.success('Mot de passe modifié : tu peux ouvrir PAV LED'); setPwd(''); setPwd2(''); }
    catch (err) { toast.error(err.response?.data?.detail || 'Échec'); } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="portal-only-shell">
      <header className="border-b bg-background/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src="/logo.png" alt="PAV" className="h-9 w-9 rounded-lg object-contain" />
          <div className="leading-tight"><p className="font-semibold">PAV Manager</p><p className="text-xs text-muted-foreground">Gestion Technique</p></div>
          <div className="flex-1" />
          <span className="hidden text-sm sm:inline">{user?.full_name}</span>
          <button type="button" onClick={logout} aria-label="Se déconnecter" className="h-9 w-9 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="gradient-primary rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Bonjour, {user?.full_name?.split(' ')[0]}</h1>
          <p className="mt-2 text-white/90" data-testid="coming-soon">PAV Manager sera disponible prochainement pour vous.</p>
          <p className="mt-1 text-sm text-white/75">En attendant, vous avez accès à PAV LED, à CEC Songs et à la Recherche Biblique ci-dessous.</p>
        </div>
        <Card className="overflow-hidden rounded-2xl border-primary/10 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" />Portail Charisma</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {links.map((l) => <PortalLinkItem key={l.id} link={l} onOpen={open} busy={l.kind === 'led' && ledLoading} fullWidth />)}
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!mustChangePassword} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Changement de mot de passe obligatoire</DialogTitle>
            <DialogDescription>Pour ta première connexion, choisis un nouveau mot de passe (8 caractères minimum).</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPassword} className="space-y-3">
            <div className="space-y-1.5"><Label>Nouveau mot de passe *</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" required data-testid="po-pwd" /></div>
            <div className="space-y-1.5"><Label>Confirmer *</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" required data-testid="po-pwd2" /></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
