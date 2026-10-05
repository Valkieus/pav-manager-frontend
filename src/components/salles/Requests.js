import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const longDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const BADGE = { "En attente": "bg-amber-500 text-white", "Validée": "bg-emerald-600 text-white", "Refusée": "bg-red-600 text-white", "Annulée": "bg-slate-500 text-white" };

// ---- Mes demandes (tout Responsable+) ----
export function MyRequests({ onChanged }) {
  const [items, setItems] = useState(null);
  const load = useCallback(async () => { try { setItems((await axios.get(`${API}/room-booking/requests/mine`)).data); } catch (e) { setItems([]); } }, []);
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(t); }, [load]);
  const cancel = async (r) => {
    if (!window.confirm("Annuler cette demande ?")) return;
    try { await axios.put(`${API}/room-booking/requests/${r.id}/cancel-mine`); toast.success("Demande annulée"); load(); onChanged && onChanged(); } catch (err) { toast.error(err.response?.data?.detail || "Annulation impossible"); }
  };
  if (!items) return <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">Vous n'avez fait aucune demande. Touchez un créneau libre dans le planning.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      {items.map((r) => (
        <Card key={r.id} className={r.date < today ? "opacity-70" : ""}>
          <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{r.salle_nom} <span className="font-normal capitalize text-muted-foreground">· {longDate(r.date)}</span></p>
              <p className="text-sm text-muted-foreground">{r.creneau_nom} ({r.heure_debut}–{r.heure_fin}) · {r.raison}</p>
              {r.statut === "Refusée" && r.raison_refus && <p className="text-sm text-red-600">Motif du refus : {r.raison_refus}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={BADGE[r.statut] || ""}>{r.statut}</Badge>
              {(r.statut === "En attente" || r.statut === "Validée") && r.date >= today && <Button size="sm" variant="outline" onClick={() => cancel(r)}>Annuler</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- À valider (gestionnaires) ----
export function ToValidate({ onChanged }) {
  const [items, setItems] = useState(null);
  const [reject, setReject] = useState(null);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/reservations`, { params: { statut: "En attente" } });
      setItems([...res.data].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e) { setItems([]); }
  }, []);
  useEffect(() => { load(); const t = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(t); }, [load]);

  const validate = async (r) => {
    setBusy(r.id);
    try { await axios.put(`${API}/reservations/${r.id}/validate`); toast.success("Réservation validée"); await load(); onChanged && onChanged(); }
    catch (err) { toast.error(err.response?.data?.detail || "Validation impossible"); } finally { setBusy(null); }
  };
  const doReject = async () => {
    setBusy(reject.id);
    try { await axios.put(`${API}/reservations/${reject.id}/reject`, { raison_refus: motif }); toast.success("Demande refusée"); setReject(null); setMotif(""); await load(); onChanged && onChanged(); }
    catch (err) { toast.error(err.response?.data?.detail || "Refus impossible"); } finally { setBusy(null); }
  };

  if (!items) return <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">Aucune demande en attente. 🎉</p>;
  return (
    <>
      <div className="space-y-3">
        {items.map((r) => (
          <Card key={r.id} className="border-amber-400">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="font-semibold">{r.salle_nom} <span className="font-normal capitalize text-muted-foreground">· {longDate(r.date)}</span></p>
                <p className="text-sm text-muted-foreground">{r.creneau_nom} ({r.heure_debut}–{r.heure_fin})</p>
              </div>
              <p className="text-sm"><span className="font-semibold">{r.nom_demandeur}</span>{r.email || r.telephone ? <span className="text-muted-foreground"> · {[r.telephone, r.email].filter(Boolean).join(" · ")}</span> : <Badge variant="outline" className="ml-2">interne</Badge>}</p>
              <p className="rounded-md bg-muted/50 p-2 text-sm">{r.raison}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy === r.id} onClick={() => validate(r)}>{busy === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Valider</Button>
                <Button variant="outline" className="text-destructive" onClick={() => { setReject(r); setMotif(""); }}><X className="mr-2 h-4 w-4" />Refuser</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Refuser la demande</DialogTitle><DialogDescription>{reject?.salle_nom} · {reject && longDate(reject.date)}</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>Motif (envoyé au demandeur)</Label><Textarea rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} /></div>
          <Button variant="destructive" disabled={!motif.trim() || busy === reject?.id} onClick={doReject}>Confirmer le refus</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
