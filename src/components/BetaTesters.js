import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { FlaskConical, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DURATIONS = [
  { value: "7", label: "1 semaine" },
  { value: "14", label: "2 semaines" },
  { value: "21", label: "3 semaines" },
  { value: "30", label: "1 mois" },
  { value: "60", label: "2 mois" },
  { value: "90", label: "3 mois" },
  { value: "date", label: "Jusqu'à une date…" },
];

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");
const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

// Groupe « Bêta testeurs » : comptes qui travaillent sur une copie de la base
// (rien n'atteint la production), pendant une durée choisie.
export default function BetaTesters({ users = [] }) {
  const [data, setData] = useState({ testers: [], sandbox: {} });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [duration, setDuration] = useState("14");
  const [untilDate, setUntilDate] = useState("");
  const [deactivate, setDeactivate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/beta/testers`);
      setData(res.data);
    } catch (e) {
      /* silencieux : la carte reste vide */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!data.sandbox?.building) return undefined;
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [data, load]);

  const testerIds = new Set(data.testers.map((t) => t.id));
  const candidates = users.filter((u) => u.is_active !== false && u.niveau_acces !== "Super Admin" && !u.kiosk_mode && !testerIds.has(u.id));

  const payload = () => (duration === "date" ? { until: untilDate, deactivate_on_expiry: deactivate } : { days: Number(duration), deactivate_on_expiry: deactivate });

  const add = async () => {
    if (!userId) { toast.error("Choisissez un utilisateur"); return; }
    if (duration === "date" && !untilDate) { toast.error("Choisissez une date de fin"); return; }
    setBusy(true);
    try {
      await axios.put(`${API}/admin/beta/testers/${userId}`, payload());
      toast.success("Bêta testeur ajouté");
      setUserId("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const extend = async (t, days) => {
    try {
      await axios.put(`${API}/admin/beta/testers/${t.id}`, { days, deactivate_on_expiry: t.deactivate_on_expiry });
      toast.success(`Période bêta de ${t.full_name} prolongée`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Retirer ${t.full_name} des bêta testeurs ?`)) return;
    try {
      await axios.delete(`${API}/admin/beta/testers/${t.id}`);
      toast.success("Retiré");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const reset = async () => {
    if (!window.confirm("Recopier la production dans le bac à sable ? Tout ce que les bêta testeurs y ont fait sera effacé.")) return;
    try {
      await axios.post(`${API}/admin/beta/sandbox/reset`);
      toast.success("Copie de la production lancée");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const sb = data.sandbox || {};

  return (
    <Card data-testid="beta-testers-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-violet-600" />
          Groupe Bêta testeurs
        </CardTitle>
        <CardDescription>
          Ces comptes voient et font tout, mais sur une copie de test : rien de ce qu'ils font n'atteint la production.
          Une bannière le leur rappelle sur chaque page. À la fin de la période, le compte redevient normal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
          <select className={selectCls} value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Utilisateur">
            <option value="">Choisir un utilisateur…</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name} ({u.niveau_acces})</option>
            ))}
          </select>
          <select className={selectCls} value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Durée">
            {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <Button onClick={add} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Ajouter
          </Button>
        </div>
        {duration === "date" && (
          <Input type="date" value={untilDate} onChange={(e) => setUntilDate(e.target.value)} className="max-w-[12rem]" />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={deactivate} onChange={(e) => setDeactivate(e.target.checked)} />
          Désactiver le compte à la fin de la période (pour un testeur externe)
        </label>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : data.testers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun bêta testeur pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {data.testers.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{t.full_name} <span className="text-xs text-muted-foreground">({t.niveau_acces})</span></p>
                  <p className="text-xs text-muted-foreground">
                    Jusqu'au {fmt(t.beta_until)}{t.deactivate_on_expiry ? " · compte désactivé ensuite" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {t.active
                    ? <Badge className="bg-violet-100 text-violet-800">Actif · {t.remaining_days} j</Badge>
                    : <Badge variant="outline">Terminé</Badge>}
                  <Button size="sm" variant="outline" onClick={() => extend(t, 7)}>+1 sem.</Button>
                  <Button size="sm" variant="outline" onClick={() => extend(t, 30)}>+1 mois</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(t)} title="Retirer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
          <span>
            {sb.building
              ? "Copie de la production en cours…"
              : sb.ready
                ? `Copie de test prête (faite le ${fmt(sb.built_at)})`
                : "Copie de test pas encore créée : elle se prépare à l'ajout du premier testeur."}
            {sb.error ? ` — erreur : ${sb.error}` : ""}
          </span>
          <Button size="sm" variant="outline" onClick={reset} disabled={sb.building}>
            <RefreshCw className="mr-2 h-4 w-4" /> Réinitialiser la copie
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
