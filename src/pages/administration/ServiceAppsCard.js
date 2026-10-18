import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AppWindow } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { API } from './constants';

// Comptes qui n'ouvrent que certaines applications (aujourd'hui : CEC Songs).
// Ex. « incrustation ». Super Admin uniquement. Pour de futurs accès : cocher
// l'application sur le compte (ou en ajouter une côté serveur).
export function ServiceAppsCard() {
  const [data, setData] = useState({ apps: [], accounts: [] });
  const [username, setUsername] = useState('incrustation');
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get(`${API}/admin/service-accounts`).then((r) => setData(r.data)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.data?.generated_password) setSecret({ username: res.data.username, password: res.data.generated_password });
      toast.success(okMsg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const toggleApp = (acc, key) => {
    const apps = acc.apps.includes(key) ? acc.apps.filter((a) => a !== key) : [...acc.apps, key];
    run(() => axios.put(`${API}/admin/service-accounts/${acc.id}`, { apps }), 'Accès mis à jour');
  };

  return (
    <Card data-testid="service-apps-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AppWindow className="w-5 h-5" /> Comptes d'accès aux applications
        </CardTitle>
        <CardDescription>
          Un compte qui n'ouvre que les applications cochées (pas PAV Manager). Ex. « incrustation » : CEC Songs uniquement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {secret && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Identifiant : <b>{secret.username}</b> — mot de passe : <b>{secret.password}</b>
            <p className="text-xs text-muted-foreground mt-1">Affiché une seule fois : note-le maintenant.</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setSecret(null)}>OK, noté</Button>
          </div>
        )}
        {data.accounts.map((a) => (
          <div key={a.id} className="rounded-md border p-3 space-y-2" data-testid="service-app-account">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.username}</span>
              <Badge variant={a.is_active ? 'secondary' : 'destructive'}>{a.is_active ? 'Actif' : 'Désactivé'}</Badge>
              <span className="flex-1" />
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => axios.put(`${API}/admin/service-accounts/${a.id}`, { password: 'generate' }), 'Nouveau mot de passe généré')}>
                Nouveau mot de passe
              </Button>
              <Button size="sm" variant="outline" disabled={busy}
                onClick={() => run(() => axios.put(`${API}/admin/service-accounts/${a.id}`, { is_active: !a.is_active }), a.is_active ? 'Compte désactivé' : 'Compte activé')}>
                {a.is_active ? 'Désactiver' : 'Activer'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-4">
              {data.apps.map((app) => (
                <label key={app.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={a.apps.includes(app.key)} disabled={busy} onChange={() => toggleApp(a, app.key)} />
                  {app.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Input className="w-48" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Identifiant" />
          <Input className="w-56" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe (vide = généré)" />
          <Button disabled={busy || username.trim().length < 3}
            onClick={() => run(() => axios.post(`${API}/admin/service-accounts`, { username, password: password || null, apps: ['songs'] }), 'Compte créé').then(() => setPassword(''))}>
            Créer le compte
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
