import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { API } from './constants';

const NIVEAUX = ['Technicien', 'Responsable', 'Coordination'];

// Vue PAV Manager verrouillée (portail de première connexion seul) : pilotage en lot depuis la Maintenance.
export function PortalLockCard({ users = [], canEdit }) {
  const [locked, setLocked] = useState([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/maintenance/portal-lock`);
      setLocked(res.data.users || []);
    } catch (e) {
      setLocked([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

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
          Une personne verrouillée ne voit que le portail de première connexion (CEC Songs, Recherche Biblique, PAV LED)
          avec le message « PAV Manager sera disponible prochainement pour vous ». Les Admin et Super Admin ne sont jamais verrouillés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
