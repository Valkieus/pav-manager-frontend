import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Globe, KeyRound, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import PasswordRules from './PasswordRules';
import { isStrongPassword } from '../lib/passwordPolicy';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { PortalLinkItem } from '../pages/dashboard/PortalLinkItem';
import PortalUpcomingEvents from './PortalUpcomingEvents';
import { mergeLinks } from '../pages/dashboard/portalLinks';
import { openSongsSite } from '../lib/songs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
// Vue verrouillée (compte « portail seul ») : uniquement le portail de première connexion. Les liens proposés se règlent dans
// Administration > Maintenance (par défaut : CEC Songs, Recherche Biblique, PAV LED).
const DEFAULT_SHOWN = ['songs', 'bible', 'led'];

export default function PortalOnlyShell() {
  const { user, logout, mustChangePassword, changePassword } = useAuth();
  const [ledLoading, setLedLoading] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [saving, setSaving] = useState(false);
  const [ids, setIds] = useState(DEFAULT_SHOWN);
  const [stored, setStored] = useState(null);
  useEffect(() => {
    axios.get(`${API}/maintenance/portal-lock/links`).then((r) => { if (Array.isArray(r.data?.ids)) setIds(r.data.ids); }).catch(() => {});
    axios.get(`${API}/dashboard/portal-links`).then((r) => setStored(r.data?.links ?? null)).catch(() => {});
  }, []);
  // Liens choisis par un Super Admin, dans l'ordre et avec le libellé / l'adresse de la barre « Portail Charisma ».
  const links = mergeLinks(stored).filter((l) => ids.includes(l.id) && l.kind !== 'academy').map((l) => ({ ...l, roles: [], enabled: true }));

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
    if (!isStrongPassword(pwd, { username: user?.username, fullName: user?.full_name })) { toast.error('Mot de passe trop faible : suivez les critères affichés sous le champ'); return; }
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
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="gradient-primary rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Bonjour, {user?.full_name?.split(' ')[0]}</h1>
          <p className="mt-2 text-white/90" data-testid="coming-soon">PAV Manager sera disponible prochainement pour vous.</p>
          <p className="mt-1 text-sm text-white/75">{links.length > 0 ? `En attendant, vous avez accès à ${links.map((l) => l.label).join(', ')} ci-dessous.` : 'Revenez bientôt : vos accès seront ajoutés ici.'}</p>
        </div>
        {/* PC : les événements (avec leurs affiches) à gauche, le portail à droite ; téléphone : l'un sous l'autre */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <PortalUpcomingEvents />
        <Card className="overflow-hidden rounded-2xl border-primary/10 shadow-sm lg:sticky lg:top-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" />Portail Charisma</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {links.map((l) => <PortalLinkItem key={l.id} link={l} onOpen={open} busy={l.kind === 'led' && ledLoading} fullWidth />)}
            </div>
          </CardContent>
        </Card>
        </div>
      </main>

      <Dialog open={!!mustChangePassword} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Changement de mot de passe obligatoire</DialogTitle>
            <DialogDescription>Pour ta première connexion, choisis un nouveau mot de passe (recommandation CNIL : 12 caractères avec minuscules, majuscules, chiffres et caractères spéciaux, ou 14 sans spécial).</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPassword} className="space-y-3">
            <div className="space-y-1.5"><Label>Nouveau mot de passe *</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" required data-testid="po-pwd" /></div>
            <PasswordRules value={pwd} username={user?.username} fullName={user?.full_name} always />
            <div className="space-y-1.5"><Label>Confirmer *</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} autoComplete="new-password" required data-testid="po-pwd2" /></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
