import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { HardDrive, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { API } from '../constants';

const fmtBytes = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} Go` : `${Math.round((n || 0) / 1024 ** 2)} Mo`);

// Retour des fichiers LED de Cloudinary vers B2 : copie vérifiée avant bascule, rien n'est supprimé chez Cloudinary.
export function SupB2Return({ isSuperAdmin }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [freeCloud, setFreeCloud] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/led/b2-return/plan`);
      setPlan(res.data);
    } catch {
      setPlan(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!plan?.running) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [plan?.running, load]);

  const start = async (limit) => {
    setBusy(true);
    try {
      await axios.post(`${API}/led/b2-return/start`, { limit, free_cloudinary: freeCloud });
      toast.success(limit ? `Copie de ${limit} fichiers lancée` : 'Copie lancée');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Impossible de lancer la copie');
    } finally {
      setBusy(false);
    }
  };
  const freeCloudinary = async () => {
    if (!window.confirm("Supprimer chez Cloudinary les originaux des fichiers déjà copiés et vérifiés sur B2 ?\n\nC'est définitif : le retour arrière ne sera plus possible pour eux.")) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/led/b2-return/free-cloudinary`, {});
      toast.success(`${res.data.freed} original(aux) supprimé(s) chez Cloudinary${res.data.skipped ? ` · ${res.data.skipped} ignoré(s)` : ''}`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec');
    } finally { setBusy(false); }
  };
  const rollback = async () => {
    if (!window.confirm('Remettre sur Cloudinary tous les fichiers déjà copiés vers B2 ?')) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/led/b2-return/rollback`, {});
      toast.success(`${res.data.restored} fichier(s) remis sur Cloudinary`);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec du retour arrière');
    } finally {
      setBusy(false);
    }
  };
  const setMode = async (mode) => {
    try {
      await axios.put(`${API}/led/storage-mode`, { mode });
      toast.success(mode === 'b2' ? 'Mode B2 seul : plus de copie automatique vers Cloudinary' : 'Mode historique rétabli');
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Échec');
    }
  };

  if (!plan) return null;
  const st = plan.status || {};
  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="w-5 h-5" /> Retour des fichiers LED vers B2
        </CardTitle>
        <CardDescription>
          Chaque fichier est copié UNE SEULE fois sur B2 (sans copie vers les autres stockages) et vérifié avant d'être basculé : le site LED reste
          utilisable pendant toute l'opération. Sans la case ci-dessous, l'original reste chez Cloudinary et l'opération peut être annulée.
          Conseil : lancer d'abord un essai de 5 fichiers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {plan.on_cloudinary} fichier(s) sur Cloudinary ({fmtBytes(plan.on_cloudinary_bytes)}) · {plan.on_b2} sur B2 · mode actuel :{' '}
          <strong>{plan.mode === 'b2' ? 'B2 seul' : 'B2 puis Cloudinary'}</strong>
        </p>
        {plan.running && (
          <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> En cours : {st.done ?? 0} copié(s) sur {st.total ?? '?'}</p>
        )}
        {!plan.running && st.finished_at && (
          <p className="text-xs text-muted-foreground">Dernière copie : {st.done ?? 0} réussi(s), {st.failed ?? 0} en échec ({fmtBytes(st.bytes || 0)}).</p>
        )}
        {st.errors?.length > 0 && (
          <ul className="text-[11px] text-amber-600 dark:text-amber-500 list-disc pl-4 space-y-0.5">
            {st.errors.slice(0, 5).map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        )}
        {isSuperAdmin() && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 w-4 h-4" checked={freeCloud} onChange={(e) => setFreeCloud(e.target.checked)} />
            <span>Supprimer l'original chez Cloudinary dès que la copie sur B2 est vérifiée <span className="text-muted-foreground">(une seule copie, pas de doublon ; le retour arrière n'est alors plus possible pour ces fichiers)</span></span>
          </label>
        )}
        {isSuperAdmin() && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || plan.running || !plan.b2_enabled || plan.on_cloudinary === 0} onClick={() => start(5)}>Essai : 5 fichiers</Button>
            <Button size="sm" disabled={busy || plan.running || !plan.b2_enabled || plan.on_cloudinary === 0} onClick={() => start(0)}>Tout copier vers B2</Button>
            <Button size="sm" variant="outline" disabled={busy || plan.running} onClick={freeCloudinary}>Libérer Cloudinary (fichiers déjà copiés)</Button>
            <Button size="sm" variant="outline" disabled={busy || plan.running} onClick={rollback}>Annuler (remettre sur Cloudinary)</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(plan.mode === 'b2' ? 'cloudinary' : 'b2')}>
              {plan.mode === 'b2' ? 'Réactiver la copie vers Cloudinary' : 'Passer en « B2 seul »'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
