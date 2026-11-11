import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { API } from './constants';
import { mergeLinks } from '../dashboard/portalLinks';

const NIVEAUX = ['Technicien', 'Responsable', 'Coordination'];

// Vue PAV Manager verrouillée (portail de première connexion seul) : pilotage en lot depuis la Maintenance.
export function PortalLockCard({ users = [], canEdit }) {
  const [locked, setLocked] = useState([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [autoLock, setAutoLock] = useState(true);
  // Liens proposés dans la vue verrouillée (même liste que la barre « Portail Charisma » : libellés et adresses modifiables là-bas).
  const [allLinks, setAllLinks] = useState([]);
  const [shownIds, setShownIds] = useState(['songs', 'bible', 'led']);
  const [linksDirty, setLinksDirty] = useState(false);
  const [linksError, setLinksError] = useState('');
  const loadLinks = useCallback(async () => {
    try {
      const [stored, ids] = await Promise.all([axios.get(`${API}/dashboard/portal-links`), axios.get(`${API}/maintenance/portal-lock/links`)]);
      setAllLinks(mergeLinks(stored.data?.links ?? null).filter((l) => l.kind !== 'academy'));
      if (Array.isArray(ids.data?.ids)) setShownIds(ids.data.ids);
      setLinksDirty(false); setLinksError('');
    } catch (e) {
      setLinksError(e.response?.status === 404 ? "Cette fonction n'est pas encore active sur le serveur (redéploiement de Render à faire)." : (e.response?.data?.detail || 'Liste indisponible pour le moment.'));
    }
  }, []);
  useEffect(() => { loadLinks(); }, [loadLinks]);
  const toggleLink = (id) => { setShownIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])); setLinksDirty(true); };
  const saveLinks = async () => {
    setBusy(true);
    try {
      const res = await axios.put(`${API}/maintenance/portal-lock/links`, { ids: shownIds });
      setShownIds(res.data.ids); setLinksDirty(false);
      toast.success('Liens de la vue verrouillée enregistrés');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Enregistrement impossible');
    } finally { setBusy(false); }
  };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/maintenance/portal-lock`);
      setLocked(res.data.users || []);
      if (typeof res.data.auto_lock_new_technicians === 'boolean') setAutoLock(res.data.auto_lock_new_technicians);
    } catch (e) {
      setLocked([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleAuto = async (enabled) => {
    setBusy(true);
    try {
      await axios.put(`${API}/maintenance/portal-lock/auto`, { enabled });
      setAutoLock(enabled);
      toast.success(enabled ? 'Les nouveaux techniciens seront verrouillés' : 'Les nouveaux techniciens verront PAV Manager tout de suite');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action impossible');
    } finally { setBusy(false); }
  };

  const apply = async (body, okMsg) => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/maintenance/portal-lock`, body);
      toast.success(`${okMsg} (${res.data.modified} compte(s))`);
      setPicked([]);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  const lockedIds = new Set(locked.map((u) => u.id));
  const q = query.trim().toLowerCase();
  const matches = q
    ? users.filter((u) => u.is_active !== false && !['Admin', 'Super Admin'].includes(u.niveau_acces) && (u.full_name || '').toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <Card data-testid="portal-lock-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Vue PAV Manager verrouillée</CardTitle>
        <CardDescription>
          Une personne verrouillée ne voit que le portail de première connexion (les liens que vous choisissez plus bas)
          avec le message « PAV Manager sera disponible prochainement pour vous ». Les Admin et Super Admin ne sont jamais verrouillés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3" data-testid="portal-auto-lock">
          <div className="space-y-1">
            <Label className="text-sm">Verrouiller automatiquement les nouveaux techniciens</Label>
            <p className="text-xs text-muted-foreground">
              Chaque technicien qui s'inscrit lui-même (auto-inscription) ou dont un Admin crée le compte démarre « verrouillé » : il ne voit que le portail
              (les liens choisis ci-dessus). Vous le déverrouillez ensuite ci-dessous, personne par personne ou tous les Techniciens d'un coup.
            </p>
          </div>
          <Switch checked={autoLock} disabled={!canEdit || busy} onCheckedChange={toggleAuto} aria-label="Verrouillage automatique des nouveaux techniciens" data-testid="portal-auto-lock-switch" />
        </div>
        <div className="space-y-2 rounded-lg border p-3" data-testid="portal-lock-links">
          <Label className="text-sm">Liens proposés dans la vue verrouillée</Label>
          <p className="text-xs text-muted-foreground">
            Cochez ce que les personnes verrouillées peuvent ouvrir (par exemple SongSpot pour les techniciens). Le libellé et l'adresse d'un lien se modifient dans
            la barre « Portail Charisma » du tableau de bord ; un lien désactivé ou limité à certains niveaux là-bas reste proposé ici s'il est coché.
          </p>
          {linksError && (
            <p className="text-sm rounded-md border border-amber-500/50 bg-amber-500/10 p-2" role="alert" data-testid="lock-links-error">
              {linksError} <button type="button" className="underline" onClick={loadLinks}>Réessayer</button>
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {allLinks.map((l) => (
              <label key={l.id} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <input type="checkbox" className="mt-1" checked={shownIds.includes(l.id)} disabled={!canEdit || busy} onChange={() => toggleLink(l.id)} data-testid={`lock-link-${l.id}`} />
                <span><span className="font-medium">{l.label}</span><span className="block text-xs text-muted-foreground">{l.subtitle || l.url}</span></span>
              </label>
            ))}
          </div>
          {canEdit && (
            <Button size="sm" disabled={busy || !linksDirty} onClick={saveLinks} data-testid="lock-links-save">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Enregistrer les liens
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label>Comptes verrouillés ({locked.length})</Label>
          {locked.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 border rounded-lg border-dashed">Aucun compte verrouillé.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {locked.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                  {u.full_name} <span className="text-xs text-muted-foreground">· {u.niveau_acces}</span>
                  {canEdit && (
                    <button type="button" disabled={busy} title="Déverrouiller" onClick={() => apply({ locked: false, user_ids: [u.id] }, 'Déverrouillé')}
                      className="ml-1 text-muted-foreground hover:text-foreground"><LockOpen className="w-3.5 h-3.5" /></button>
                  )}
                </span>
              ))}
            </div>
          )}
          {canEdit && locked.length > 0 && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => apply({ locked: false, user_ids: locked.map((u) => u.id) }, 'Tout déverrouillé')}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LockOpen className="w-4 h-4 mr-2" />}Tout déverrouiller
            </Button>
          )}
        </div>

        {canEdit && (
          <div className="border-t pt-4 space-y-3">
            <Label>Verrouiller / déverrouiller par niveau</Label>
            <div className="flex flex-wrap gap-2">
              {NIVEAUX.map((n) => (
                <span key={n} className="inline-flex gap-1">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => apply({ locked: true, niveaux: [n] }, `${n}s verrouillés`)}><Lock className="w-3.5 h-3.5 mr-1" />{n}s</Button>
                  <Button size="sm" variant="ghost" disabled={busy} title={`Déverrouiller tous les ${n}s`} onClick={() => apply({ locked: false, niveaux: [n] }, `${n}s déverrouillés`)}><LockOpen className="w-3.5 h-3.5" /></Button>
                </span>
              ))}
            </div>

            <Label>Verrouiller des personnes précises</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un nom…" data-testid="portal-lock-search" />
            {matches.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {matches.map((u) => (
                  <Button key={u.id} size="sm" variant={picked.includes(u.id) ? 'default' : 'outline'}
                    onClick={() => setPicked((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]))}>
                    {u.full_name}{lockedIds.has(u.id) ? ' 🔒' : ''}
                  </Button>
                ))}
              </div>
            )}
            {picked.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => apply({ locked: true, user_ids: picked }, 'Verrouillé')}><Lock className="w-4 h-4 mr-2" />Verrouiller ({picked.length})</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => apply({ locked: false, user_ids: picked }, 'Déverrouillé')}><LockOpen className="w-4 h-4 mr-2" />Déverrouiller ({picked.length})</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
