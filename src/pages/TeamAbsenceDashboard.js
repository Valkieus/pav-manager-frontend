import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { CalendarOff, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                     'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Tâche #295 : dashboard des absences d'équipe — un Responsable ne voit que
// son (ses) équipe(s) (branches partagées avec son compte), un Gestionnaire+
// voit tout le monde. Ce filtrage est déjà fait côté serveur par
// GET /absences (voir server.py) : il suffit d'afficher ce que l'API
// renvoie, sans logique de scope supplémentaire ici.
//
// Tâche #489 : en plus du navigateur mois par mois (déjà là pour le
// planning), on ajoute un bandeau "Prochains congés de l'équipe" qui
// récupère TOUTES les absences (sans filtre mois/annee) et ne garde que
// celles qui ne sont pas encore terminées (date_fin >= aujourd'hui), triées
// par date de début. Ça donne une vraie visibilité sur le futur, sans avoir
// à cliquer mois après mois.
export default function TeamAbsenceDashboard({ scopeLabel }) {
    const now = new Date();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mois, setMois] = useState(now.getMonth() + 1);
    const [annee, setAnnee] = useState(now.getFullYear());
    const [absences, setAbsences] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  const fetchAbsences = useCallback(async (m, y) => {
        setLoading(true);
        try {
                const res = await axios.get(`${API}/absences`, { params: { mois: m, annee: y } });
                const sorted = [...(res.data || [])].sort((a, b) => a.date_debut.localeCompare(b.date_debut));
                setAbsences(sorted);
        } catch (err) {
                toast.error(err.response?.data?.detail || "Erreur lors du chargement des absences");
                setAbsences([]);
        } finally {
                setLoading(false);
        }
  }, []);

  const fetchUpcoming = useCallback(async () => {
        setLoadingUpcoming(true);
        try {
                const res = await axios.get(`${API}/absences`);
                const todayIso = new Date().toISOString().slice(0, 10);
                const futures = (res.data || [])
                  .filter((a) => a.date_fin >= todayIso)
                  .sort((a, b) => a.date_debut.localeCompare(b.date_debut))
                  .slice(0, 15);
                setUpcoming(futures);
        } catch (err) {
                setUpcoming([]);
        } finally {
                setLoadingUpcoming(false);
        }
  }, []);

  const handleOpen = () => {
        setOpen(true);
        fetchAbsences(mois, annee);
        fetchUpcoming();
  };

  const changeMonth = (delta) => {
        let m = mois + delta;
        let y = annee;
        if (m < 1) { m = 12; y -= 1; }
        if (m > 12) { m = 1; y += 1; }
        setMois(m);
        setAnnee(y);
        fetchAbsences(m, y);
  };

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const todayStr = new Date().toISOString().slice(0, 10);

  return (
        <>
          <Button variant="outline" size="sm" onClick={handleOpen} className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4" /> Absences d'équipe
    </Button>

      <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Absences d'équipe</DialogTitle>
                <DialogDescription>
  {scopeLabel || "Absences déclarées par les membres de votre périmètre, pour le mois sélectionné."}
</DialogDescription>
  </DialogHeader>

{!loadingUpcoming && upcoming.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Prochains congés de l'équipe
  </p>
               <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1">
{upcoming.map((a) => {
                    const isOngoing = a.date_debut <= todayStr && todayStr <= a.date_fin;
                    return (
                                          <div key={`up-${a.id}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{a.full_name}</span>
                       <span className="flex items-center gap-1.5 shrink-0">
                          <span className="whitespace-nowrap text-muted-foreground">
{a.date_debut === a.date_fin ? formatDate(a.date_debut) : `${formatDate(a.date_debut)} → ${formatDate(a.date_fin)}`}
</span>
                        <Badge
                          variant="outline"
                          className={isOngoing
                                                                 ? "text-amber-600 border-amber-300 text-[10px] px-1.5 py-0"
                                                        : "text-blue-600 border-blue-300 text-[10px] px-1.5 py-0"}
                        >
{isOngoing ? "En cours" : "À venir"}
</Badge>
  </span>
  </div>
                  );
})}
</div>
  </div>
          )}

          <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>◀</Button>
            <span className="text-sm font-medium min-w-[120px] text-center">{MOIS_NOMS[mois - 1]} {annee}</span>
            <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>▶</Button>
            </div>

{loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
  </div>
            ) : absences.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune absence déclarée sur ce mois.</p>
           ) : (
                         <ScrollArea className="h-[400px] pr-4">
                           <div className="space-y-2">
           {absences.map((a) => {
                               const isOngoing = a.date_debut <= todayStr && todayStr <= a.date_fin;
                               return (
                                                     <div key={a.id} className="flex items-start justify-between gap-3 border rounded-lg px-3 py-2">
                                   <div className="min-w-0">
                                     <p className="font-medium text-sm truncate">{a.full_name}</p>
                         <p className="text-xs text-muted-foreground truncate">{a.raison || 'Sans motif précisé'}</p>
  </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs font-medium whitespace-nowrap">
{a.date_debut === a.date_fin ? formatDate(a.date_debut) : `${formatDate(a.date_debut)} → ${formatDate(a.date_fin)}`}
</span>
{isOngoing && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
                              En cours
  </Badge>
                         )}
</div>
  </div>
                  );
})}
  </div>
  </ScrollArea>
          )}
</DialogContent>
            </Dialog>
            </>
  );
}
