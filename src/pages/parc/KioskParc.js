import { useEffect, useState } from 'react';
import axios from 'axios';
import { QrCode, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ParcMateriel from '../ParcMateriel';
import { API } from './shared';

export const KIOSK_PARC_KEY = 'kiosque:parc-materiel';

// Bouton « Parc matériel » de la tablette Régisseurs. Tant qu'une activation « iPad Régisseurs — Parc matériel » existe dans
// Administration > Maintenance, on affiche « Disponible prochainement » ; la retirer ouvre le parc sur la tablette.
export default function KioskParc() {
  const { user } = useAuth();
  const [entry, setEntry] = useState(undefined); // undefined = chargement, null = ouvert, objet = « disponible prochainement »

  useEffect(() => {
    let alive = true;
    const soon = { message: 'Disponible prochainement' };
    axios.get(`${API}/maintenance`).then(async (r) => {
      const e = (r.data?.entries || []).find((x) => x.scope === 'page' && x.page_path === KIOSK_PARC_KEY);
      const applies = e && (!e.affected_roles || e.affected_roles.length === 0 || e.affected_roles.includes(user?.niveau_acces));
      if (applies) { if (alive) setEntry(e); return; }
      // Pas de verrou : on n'ouvre le parc que si le serveur le connaît (sinon « disponible prochainement », jamais une erreur).
      try { await axios.get(`${API}/materiel-parc/stats`); if (alive) setEntry(null); } catch (err) { if (alive) setEntry(soon); }
    }).catch(() => { if (alive) setEntry(soon); });
    return () => { alive = false; };
  }, [user]);

  if (entry === undefined) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (entry) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4" data-testid="kiosk-parc-soon">
        <div className="max-w-md space-y-3 rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><QrCode className="h-8 w-8" /></div>
          <h2 className="text-xl font-bold">Parc matériel</h2>
          <p className="text-lg font-semibold text-primary">Disponible prochainement</p>
          {entry.message && entry.message !== 'Disponible prochainement' && <p className="text-sm text-muted-foreground">{entry.message}</p>}
        </div>
      </div>
    );
  }
  return <ParcMateriel embedded />;
}
