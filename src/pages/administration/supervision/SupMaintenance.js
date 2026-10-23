import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { API } from '../constants';

const fmt = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} Go` : `${Math.round((n || 0) / 1024 ** 2)} Mo`);

// Maintenance quotidienne du stockage (≈ 4 h, heure de Paris) : lancer / simuler à la demande et voir le dernier résultat.
export function SupMaintenance({ isSuperAdmin }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { axios.get(`${API}/admin/maintenance`).then((r) => setData(r.data)).catch(() => setData(null)); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data?.running) return undefined;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [data?.running, load]);

  const run = async (dry) => {
    if (!dry && !window.confirm("Lancer le nettoyage RÉEL maintenant ?\n\n• anciennes sauvegardes retirées de R2/Oracle/secours (si les copies Europe + États-Unis existent)\n• fichiers Cloudinary inutilisés supprimés (garde-fous : plus de 48 h, 300 max par compte)\n• doublons de fichiers LED supprimés (2 copies conservées)\n\nUn rapport vous est envoyé ensuite.")) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/maintenance/run`, null, { params: { dry_run: dry } });
      toast.success(dry ? 'Simulation lancée : rien ne sera supprimé' : 'Nettoyage lancé');
      setTimeout(load, 3000);
    } catch (e) { toast.error(e.response?.data?.detail || 'Échec'); } finally { setBusy(false); }
  };
  const report = async () => {
    setBusy(true);
    try { await axios.post(`${API}/admin/maintenance/report`); toast.success('Rapport envoyé (notification)'); } catch (e) { toast.error(e.response?.data?.detail || 'Échec'); } finally { setBusy(false); }
  };
  const last = data?.last || {};
  const cl = last.cloudinary || {};
  const sn = last.snapshots || {};
  return (
    <Card data-testid="maintenance-card">
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="w-5 h-5" /> Maintenance quotidienne du stockage</CardTitle>
        <CardDescription>
          Chaque nuit : anciennes sauvegardes retirées de R2/Oracle/secours (les sauvegardes importantes sont en une copie Europe + une copie États-Unis, 3 fois par jour),
          fichiers Cloudinary inutilisés supprimés, doublons LED supprimés, puis un rapport clair vous est envoyé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.running && <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> En cours…</p>}
        {last.finished_at ? (
          <div className="text-sm space-y-1">
            <p>Dernier passage : {new Date(last.finished_at).toLocaleString('fr-FR')} ({last.reason}{last.apply === false ? ', simulation' : ''}) — état {last.level || '?'}</p>
            {sn.removed != null && <p className="text-xs text-muted-foreground">Sauvegardes retirées : {sn.removed} fichier(s), {fmt(sn.freed_bytes)} libérés</p>}
            {sn.skipped && <p className="text-xs text-amber-600">Sauvegardes : {sn.skipped}</p>}
            {cl.deleted != null && <p className="text-xs text-muted-foreground">Cloudinary : {cl.deleted} fichier(s) supprimé(s) ({fmt(cl.freed_bytes)})</p>}
            {(cl.accounts || []).map((a) => (
              <div key={a.cloud} className="text-xs text-muted-foreground">
                <p>
                  <strong>{a.cloud}</strong> : {a.error ? `injoignable (${a.error})` : a.skipped ? a.skipped : `${a.files} fichier(s) · ${a.unused} non utilisé(s) par l'application →`}
                  {!a.error && !a.skipped && (
                    <> <span className="text-emerald-600">{a.copies_verifiees ?? 0} copie(s) vérifiée(s) (même nom ET même taille qu'un fichier utilisé : supprimables)</span>, <span className="text-amber-600">{a.meme_nom_a_verifier ?? 0} de même nom, taille différente (à vérifier)</span>, <span className="text-red-500">{a.sans_equivalent ?? 0} sans équivalent (jamais supprimés)</span></>
                  )}
                </p>
                {a.warning && <p className="text-amber-600">{a.warning}</p>}
                {["meme_nom", "aucun"].map((k) => ((a.echantillon || {})[k] || []).length > 0 && (
                  <p key={k} className="pl-3">{k === "aucun" ? "Sans équivalent" : "Même nom"} (exemples) : {a.echantillon[k].join(" · ")}</p>
                ))}
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Aucun passage enregistré pour l'instant.</p>}
        {isSuperAdmin() && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy || data?.running} onClick={() => run(true)}>Simuler (rien supprimé)</Button>
            <Button size="sm" disabled={busy || data?.running} onClick={() => run(false)} data-testid="maintenance-run">Lancer le nettoyage maintenant</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={report}>Envoyer le rapport maintenant</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
