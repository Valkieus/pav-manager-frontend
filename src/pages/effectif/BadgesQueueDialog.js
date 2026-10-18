import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { IdCard, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { API } from './constants';

const GROUPS = [
  { key: 'en_attente_validation', title: 'À valider', color: 'bg-amber-500' },
  { key: 'pret_a_recuperer', title: 'Prêts à récupérer', color: 'bg-blue-500' },
  { key: 'non_conforme', title: 'Photo refusée', color: 'bg-red-500' },
  { key: 'recupere', title: 'Remis', color: 'bg-emerald-500' },
];

// Vue « Gestion des badges » : toutes les demandes par statut ; un clic ouvre validation + badge.
export function BadgesQueueDialog({ onOpenRequest }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  const load = useCallback(() => {
    axios.get(`${API}/admin/badges`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { load(); }, [load]); // pastille du bouton
  const pending = (rows || []).filter((r) => r.badge_status === 'en_attente_validation').length;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="badges-queue-btn">
        <IdCard className="w-4 h-4 mr-2" /> Badges
        {pending > 0 && <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">{pending}</Badge>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gestion des badges</DialogTitle>
            <DialogDescription>Clique sur une demande pour valider la photo et fabriquer le badge.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-5">
            {rows === null && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}
            {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande de badge.</p>}
            {rows && GROUPS.map((g) => {
              const list = rows.filter((r) => r.badge_status === g.key);
              if (!list.length) return null;
              return (
                <section key={g.key}>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${g.color}`} /> {g.title} ({list.length})
                  </p>
                  <div className="space-y-2">
                    {list.map((r) => (
                      <button key={r.id} type="button" onClick={() => { setOpen(false); onOpenRequest(r); }}
                        className="w-full flex items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted/50" data-testid="badge-queue-row">
                        {r.badge_photo_url
                          ? <img src={`${process.env.REACT_APP_BACKEND_URL}${r.badge_photo_url}`} alt="" className="w-12 h-12 rounded-md object-cover border" />
                          : <div className="w-12 h-12 rounded-md border border-dashed" />}
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium truncate">{r.full_name}</span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {r.badge_is_renewal ? 'Renouvellement · ' : ''}{r.badge_motif || '—'}
                            {r.badge_requested_at ? ` · ${new Date(r.badge_requested_at).toLocaleDateString('fr-FR')}` : ''}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
