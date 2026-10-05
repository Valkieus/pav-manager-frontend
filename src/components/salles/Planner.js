import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(`${s}T00:00:00`);
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const longDate = (s) => parse(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const todayIso = () => iso(new Date());

const STYLE = {
  libre: "border-dashed border-border bg-background hover:border-primary hover:bg-primary/5",
  attente: "border-amber-400 bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
  validee: "border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
  passe: "border-transparent bg-muted/40 text-muted-foreground",
};

function Cell({ res, past, onClick, compact }) {
  if (!res) {
    if (past) return <div className={`flex h-full min-h-[64px] items-center justify-center rounded-lg border ${STYLE.passe} text-xs`}>—</div>;
    return (
      <button type="button" onClick={onClick} aria-label="Libre — toucher pour réserver" className={`group flex h-full min-h-[64px] w-full touch-manipulation items-center justify-center rounded-lg border-2 text-xs text-muted-foreground transition-colors ${STYLE.libre}`}>
        <span className="flex items-center gap-1 opacity-60 group-hover:text-primary group-hover:opacity-100"><Plus className="h-4 w-4" />{compact ? "" : "Libre"}</span>
      </button>
    );
  }
  const attente = res.statut === "En attente";
  return (
    <button type="button" onClick={onClick} className={`flex h-full min-h-[64px] w-full touch-manipulation flex-col items-start justify-between gap-0.5 rounded-lg border-2 p-1.5 text-left text-xs ${attente ? STYLE.attente : STYLE.validee} ${res.mine ? "ring-2 ring-primary ring-offset-1" : ""} ${past ? "opacity-60" : ""}`}>
      <span className="flex w-full items-center justify-between gap-1">
        <span className="truncate font-bold">{attente ? "En attente" : "Réservée"}</span>{res.mine && <span className="rounded bg-primary px-1 text-[9px] font-bold uppercase text-primary-foreground">moi</span>}
      </span>
      <span className="w-full truncate font-medium">{res.nom_demandeur}</span>
      <span className="w-full truncate opacity-80">{res.raison}</span>
    </button>
  );
}

export default function Planner({ me, onChanged }) {
  const [mode, setMode] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "jour" : "semaine"));
  const [anchor, setAnchor] = useState(() => new Date());
  const [salleId, setSalleId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(null); // { kind: 'book'|'detail', salle, date, creneau, res }
  const [form, setForm] = useState({ raison: "", participants: "", direct: true });
  const [busy, setBusy] = useState(false);
  const [refuse, setRefuse] = useState(null); // motif en cours de saisie

  const range = useMemo(() => {
    if (mode === "semaine") { const m = mondayOf(anchor); return [iso(m), iso(addDays(m, 6))]; }
    return [iso(anchor), iso(anchor)];
  }, [mode, anchor]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/room-booking/planner`, { params: { date_from: range[0], date_to: range[1] } });
      setData(res.data);
      setSalleId((cur) => cur || res.data.salles[0]?.id || null);
    } catch (e) {
      toast.error("Planning indisponible");
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { setLoading(true); load(); const t = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(t); }, [load]);

  const byKey = useMemo(() => {
    const m = {};
    (data?.reservations || []).forEach((r) => { m[`${r.salle_id}|${r.date}|${r.creneau_id}`] = r; });
    return m;
  }, [data]);

  const days = mode === "semaine" ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(anchor), i)) : [anchor];
  const shift = (n) => setAnchor(addDays(anchor, mode === "semaine" ? 7 * n : n));
  const salle = data?.salles.find((s) => s.id === salleId);
  const today = todayIso();

  const openBook = (s, date, c) => { setForm({ raison: "", participants: "", direct: me.can_manage }); setDlg({ kind: "book", salle: s, date, creneau: c }); };
  const openDetail = (s, date, c, res) => { setRefuse(null); setDlg({ kind: "detail", salle: s, date, creneau: c, res }); };
  const close = () => { setDlg(null); setRefuse(null); };
  const done = async (msg) => { toast.success(msg); close(); await load(); onChanged && onChanged(); };
  const fail = (err, fallback) => toast.error(err.response?.data?.detail || fallback);

  const submitBook = async () => {
    if (form.raison.trim().length < 2) { toast.error("Indiquez le motif de la réunion"); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/room-booking/requests`, {
        salle_id: dlg.salle.id, date: dlg.date, creneau_id: dlg.creneau.id, raison: form.raison,
        participants: form.participants ? Number(form.participants) : null, direct: !!(me.can_manage && form.direct),
      });
      await done(me.can_manage && form.direct ? "Salle réservée" : "Demande envoyée aux gestionnaires");
    } catch (err) { fail(err, "Réservation impossible"); } finally { setBusy(false); }
  };
  const act = async (fn, okMsg, failMsg) => { setBusy(true); try { await fn(); await done(okMsg); } catch (err) { fail(err, failMsg); } finally { setBusy(false); } };

  const res = dlg?.res;
  const isActive = res && (res.statut === "En attente" || res.statut === "Validée");

  const grid = () => {
    if (!data) return null;
    if (mode === "semaine") {
      if (!salle) return <p className="p-6 text-center text-muted-foreground">Aucune salle configurée.</p>;
      return (
        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] gap-1.5" style={{ gridTemplateColumns: `90px repeat(7, minmax(0, 1fr))` }}>
            <div />
            {days.map((d) => (
              <div key={iso(d)} className={`rounded-lg p-1.5 text-center text-sm font-bold ${iso(d) === today ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>
                <span className="capitalize">{d.toLocaleDateString("fr-FR", { weekday: "short" })}</span>
                <span className="block text-xs font-medium opacity-80">{d.getDate()}/{pad(d.getMonth() + 1)}</span>
              </div>
            ))}
            {data.creneaux.map((c) => (
              <div key={c.id} className="contents">
                <div className="flex flex-col justify-center rounded-lg bg-muted/60 p-1.5 text-center text-xs"><span className="font-bold">{c.nom}</span><span className="text-muted-foreground">{c.heure_debut}–{c.heure_fin}</span></div>
                {days.map((d) => {
                  const r = byKey[`${salle.id}|${iso(d)}|${c.id}`];
                  const past = iso(d) < today;
                  return <Cell key={iso(d) + c.id} res={r} past={past} compact onClick={() => (r ? openDetail(salle, iso(d), c, r) : me.can_book && openBook(salle, iso(d), c))} />;
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }
    const d = iso(anchor);
    return (
      <div className="overflow-x-auto">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `90px repeat(${Math.max(data.salles.length, 1)}, minmax(130px, 1fr))` }}>
          <div />
          {data.salles.map((s) => <div key={s.id} className="rounded-lg bg-muted/60 p-1.5 text-center text-sm font-bold"><span className="block truncate">{s.nom}</span>{s.capacite ? <span className="text-xs font-medium text-muted-foreground">{s.capacite} pl.</span> : null}</div>)}
          {data.creneaux.map((c) => (
            <div key={c.id} className="contents">
              <div className="flex flex-col justify-center rounded-lg bg-muted/60 p-1.5 text-center text-xs"><span className="font-bold">{c.nom}</span><span className="text-muted-foreground">{c.heure_debut}–{c.heure_fin}</span></div>
              {data.salles.map((s) => {
                const r = byKey[`${s.id}|${d}|${c.id}`];
                return <Cell key={s.id + c.id} res={r} past={d < today} onClick={() => (r ? openDetail(s, d, c, r) : me.can_book && openBook(s, d, c))} />;
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="salles-planner">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border">
          {[["semaine", "Semaine par salle"], ["jour", "Jour, toutes les salles"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMode(id)} className={`touch-manipulation px-3 py-2 text-sm font-semibold ${mode === id ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>{label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Précédent"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Aujourd'hui</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Suivant"><ChevronRight className="h-4 w-4" /></Button>
          <Input type="date" className="h-9 w-40" value={iso(anchor)} onChange={(e) => e.target.value && setAnchor(parse(e.target.value))} />
        </div>
      </div>

      <p className="flex items-center gap-2 text-lg font-semibold">
        <CalendarDays className="h-5 w-5 text-primary" />
        {mode === "semaine"
          ? `Semaine du ${days[0].getDate()} ${days[0].toLocaleDateString("fr-FR", { month: "long" })} au ${days[6].getDate()} ${days[6].toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
          : <span className="capitalize">{longDate(iso(anchor))}</span>}
      </p>

      {mode === "semaine" && data && (
        <div className="flex flex-wrap gap-2">
          {data.salles.map((s) => (
            <button key={s.id} type="button" onClick={() => setSalleId(s.id)} className={`touch-manipulation rounded-full border-2 px-4 py-2 text-sm font-semibold ${s.id === salleId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}>
              {s.nom}{s.capacite ? <span className="ml-1 text-xs opacity-80">({s.capacite})</span> : null}
            </button>
          ))}
        </div>
      )}

      {loading && !data ? <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : grid()}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-dashed" />Libre</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-amber-400 bg-amber-100" />En attente de validation</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-100" />Réservée</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded ring-2 ring-primary" />Mes demandes</span>
        {me.can_book && <span>· Touchez un créneau libre pour {me.can_manage ? "réserver" : "faire une demande"}.</span>}
      </div>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md">
          {dlg?.kind === "book" && (
            <>
              <DialogHeader>
                <DialogTitle>{me.can_manage ? "Réserver" : "Demander"} {dlg.salle.nom}</DialogTitle>
                <DialogDescription className="capitalize">{longDate(dlg.date)} · {dlg.creneau.nom} ({dlg.creneau.heure_debut}–{dlg.creneau.heure_fin})</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Motif de la réunion</Label><Textarea rows={3} value={form.raison} maxLength={300} onChange={(e) => setForm({ ...form, raison: e.target.value })} placeholder="Ex : Réunion responsables régie" autoFocus /></div>
                <div className="space-y-1.5"><Label>Nombre de personnes (facultatif)</Label><Input type="number" min={1} value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} /></div>
                {me.can_manage && (
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium">
                    <input type="checkbox" className="h-5 w-5 accent-primary" checked={form.direct} onChange={(e) => setForm({ ...form, direct: e.target.checked })} />
                    Réserver directement (sans validation)
                  </label>
                )}
                {!me.can_manage && <p className="text-xs text-muted-foreground">Votre demande est envoyée aux gestionnaires des salles, qui la valident ou la refusent. Vous êtes prévenu de leur décision.</p>}
                <Button className="h-11 w-full" onClick={submitBook} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{me.can_manage && form.direct ? "Réserver" : "Envoyer la demande"}</Button>
              </div>
            </>
          )}
          {dlg?.kind === "detail" && res && (
            <>
              <DialogHeader>
                <DialogTitle>{dlg.salle.nom}</DialogTitle>
                <DialogDescription className="capitalize">{longDate(dlg.date)} · {dlg.creneau.nom} ({dlg.creneau.heure_debut}–{dlg.creneau.heure_fin})</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Badge className={res.statut === "En attente" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"}>{res.statut === "En attente" ? "En attente de validation" : "Réservée"}</Badge>
                <p className="text-sm"><span className="font-semibold">{res.nom_demandeur}</span> — {res.raison}</p>
                <div className="flex flex-wrap gap-2">
                  {isActive && res.mine && (
                    <Button variant="outline" disabled={busy} onClick={() => act(() => axios.put(`${API}/room-booking/requests/${res.id}/cancel-mine`), "Demande annulée", "Annulation impossible")}>Annuler ma demande</Button>
                  )}
                  {me.can_manage && res.statut === "En attente" && refuse === null && (
                    <>
                      <Button disabled={busy} onClick={() => act(() => axios.put(`${API}/reservations/${res.id}/validate`), "Réservation validée", "Validation impossible")}>Valider</Button>
                      <Button variant="outline" className="text-destructive" onClick={() => setRefuse("")}>Refuser</Button>
                    </>
                  )}
                  {me.can_manage && res.statut === "Validée" && !res.mine && (
                    <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => window.confirm("Annuler cette réservation ?") && act(() => axios.put(`${API}/reservations/${res.id}/cancel`), "Réservation annulée", "Annulation impossible")}>Annuler la réservation</Button>
                  )}
                </div>
                {refuse !== null && (
                  <div className="space-y-2">
                    <Label>Motif du refus</Label>
                    <Textarea rows={2} value={refuse} onChange={(e) => setRefuse(e.target.value)} />
                    <Button variant="destructive" disabled={busy || !refuse.trim()} onClick={() => act(() => axios.put(`${API}/reservations/${res.id}/reject`, { raison_refus: refuse }), "Demande refusée", "Refus impossible")}>Confirmer le refus</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
