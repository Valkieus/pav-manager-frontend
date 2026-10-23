import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { API } from '../constants';

const fmtBytes = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} Go` : `${Math.round((n || 0) / 1024 ** 2)} Mo`);

// Libère de la place : au plus 1 ou 2 copies de chaque fichier LED sur l'ensemble des stockages (R2 et extras supprimés en premier).
export function SupDedupe({ isSuperAdmin }) {
  const [st, setSt] = useState(null);
  const [max, setMax] = useState(1);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setSt((await axios.get(`${API}/led/storage/dedupe/status`)).data); } catch { setSt(null); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!st?.running) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [st?.running, load]);

  const run = async (dry) => {
    if (!dry && !window.confirm(`Supprimer les copies en trop et ne garder que ${max} copie${max > 1 ? 's' : ''} de chaque fichier LED ?\n\nAvant toute suppression, Planning, Régisseurs et Communication sont sauvegardés ; si une sauvegarde échoue, rien n'est supprimé. La dernière copie d'un fichier n'est jamais supprimée.`)) return;
    setBusy(true);
    try {
      await axios.post(`${API}/led/storage/dedupe`, { max_copies: max, dry_run: dry });
      toast.success(dry ? 'Analyse lancée' : 'Nettoyage lancé');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Impossible de lancer');
    } finally { setBusy(false); }
  };

  const stop = async () => {
    try { await axios.post(`${API}/led/storage/dedupe/stop`); toast.success("Arrêt demandé"); } catch (e) { toast.error(e.response?.data?.detail || "Impossible d'arrêter"); }
  };
  if (!st) return null;
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Copy className="w-5 h-5" /> Libérer de la place (doublons des fichiers LED)</CardTitle>
        <CardDescription>
          Garde au plus 1 ou 2 copies de chaque fichier LED sur l'ensemble des stockages (B2 principal en priorité ; R2 et stockages supplémentaires
          supprimés en premier). Les sauvegardes Planning / Régisseurs / Communication ne sont jamais touchées et sont refaites avant toute suppression.
          Commencez par « Analyser » : rien n'est supprimé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Stockages : {(st.targets || []).join(' · ') || '—'}</p>
        {st.running && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {st.dry_run ? 'Analyse' : 'Nettoyage'} en cours : {st.checked ?? 0} / {st.total ?? '?'}</p>
            {isSuperAdmin() && <Button size="sm" variant="destructive" onClick={stop}>Arrêter</Button>}
          </div>
        )}
        {!st.running && st.finished_at && !st.error && (
          <p className="text-sm">
            {st.dry_run ? 'Analyse' : 'Nettoyage'} terminé : <strong>{st.excess ?? 0}</strong> copie(s) en trop ({fmtBytes(st.excess_bytes)})
            {st.dry_run ? ' à supprimer' : ' supprimée(s)'}{st.missing ? ` · ${st.missing} fichier(s) introuvable(s) (non touchés)` : ''}.
          </p>
        )}
        {st.error && <p className="text-sm text-destructive">{st.error}</p>}
        {isSuperAdmin() && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Nombre de copies à garder">
              <option value={1}>Garder 1 copie</option>
              <option value={2}>Garder 2 copies</option>
            </select>
            <Button size="sm" variant="outline" disabled={busy || st.running} onClick={() => run(true)}>Analyser</Button>
            <Button size="sm" disabled={busy || st.running} onClick={() => run(false)}>Supprimer les copies en trop</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
