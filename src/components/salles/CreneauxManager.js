import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent } from "../ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DAY_START = 7 * 60; // frise de 07:00 à 23:00
const DAY_END = 23 * 60;
const PRESETS = [
  ["Matin", "08:00", "12:00"],
  ["Après-midi", "14:00", "18:00"],
  ["Journée", "09:00", "18:00"],
  ["Soirée", "18:00", "22:00"],
];
const toMin = (t) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const fmtDur = (a, b) => { const d = toMin(b) - toMin(a); const h = Math.floor(d / 60); const m = d % 60; return `${h ? `${h} h` : ""}${m ? ` ${m} min` : ""}`.trim(); };
const autoName = (a, b) => {
  const s = toMin(a), e = toMin(b), d = e - s;
  if (d >= 7 * 60) return "Journée";
  if (s < 12 * 60 && e <= 13 * 60) return "Matin";
  if (s >= 12 * 60 && e <= 18 * 60 + 30) return "Après-midi";
  if (s >= 17 * 60) return "Soirée";
  return `${a}–${b}`;
};

// Horaires de réservation : frise de la journée, ajout en un clic (matin, après-midi…), modification en ligne.
export default function CreneauxManager({ creneaux, canEdit, onChanged }) {
  const sorted = useMemo(() => [...creneaux].sort((a, b) => a.heure_debut.localeCompare(b.heure_debut)), [creneaux]);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState({ heure_debut: "09:00", heure_fin: "10:00", nom: "" });
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ nom: "", heure_debut: "", heure_fin: "" });

  const overlaps = (c) => sorted.some((o) => o.id !== c.id && toMin(o.heure_debut) < toMin(c.heure_fin) && toMin(c.heure_debut) < toMin(o.heure_fin));
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await onChanged(); } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); } finally { setBusy(false); }
  };
  const valid = (a, b) => a && b && toMin(b) > toMin(a);
  const addPreset = ([nom, a, b]) => {
    if (sorted.some((c) => c.heure_debut === a && c.heure_fin === b)) { toast.info("Ce créneau existe déjà"); return; }
    run(() => axios.post(`${API}/creneaux`, { nom, heure_debut: a, heure_fin: b }), `Créneau « ${nom} » ajouté`);
  };
  const addCustom = () => {
    if (!valid(draft.heure_debut, draft.heure_fin)) { toast.error("L'heure de fin doit être après le début"); return; }
    run(async () => {
      await axios.post(`${API}/creneaux`, { nom: draft.nom.trim() || autoName(draft.heure_debut, draft.heure_fin), heure_debut: draft.heure_debut, heure_fin: draft.heure_fin });
      setCustom(false);
    }, "Créneau ajouté");
  };
  const saveEdit = () => {
    if (!valid(edit.heure_debut, edit.heure_fin)) { toast.error("L'heure de fin doit être après le début"); return; }
    run(async () => { await axios.put(`${API}/creneaux/${editId}`, { nom: edit.nom.trim() || autoName(edit.heure_debut, edit.heure_fin), heure_debut: edit.heure_debut, heure_fin: edit.heure_fin }); setEditId(null); }, "Créneau modifié");
  };
  const remove = (c) => {
    if (!window.confirm(`Supprimer le créneau « ${c.nom} » ? Les réservations passées sont conservées.`)) return;
    run(() => axios.delete(`${API}/creneaux/${c.id}`), "Créneau supprimé");
  };

  return (
    <div className="space-y-4" data-testid="creneaux-manager">
      <p className="text-sm text-muted-foreground">
        Les horaires proposés pour réserver une salle. Ajoutez-en en un clic ou créez le vôtre ; la frise montre la journée de 7 h à 23 h.
      </p>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button key={p[0]} type="button" size="sm" variant="outline" disabled={busy} onClick={() => addPreset(p)}>
              <Plus className="mr-1 h-3.5 w-3.5" />{p[0]} <span className="ml-1 text-muted-foreground">{p[1]}–{p[2]}</span>
            </Button>
          ))}
          <Button type="button" size="sm" variant={custom ? "secondary" : "ghost"} onClick={() => setCustom((v) => !v)}>Personnalisé…</Button>
        </div>
      )}

      {canEdit && custom && (
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-3">
          <label className="text-xs text-muted-foreground">Début<Input type="time" value={draft.heure_debut} onChange={(e) => setDraft({ ...draft, heure_debut: e.target.value })} className="mt-1 w-32" /></label>
          <label className="text-xs text-muted-foreground">Fin<Input type="time" value={draft.heure_fin} onChange={(e) => setDraft({ ...draft, heure_fin: e.target.value })} className="mt-1 w-32" /></label>
          <label className="min-w-40 flex-1 text-xs text-muted-foreground">Nom (facultatif)
            <Input value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} placeholder={valid(draft.heure_debut, draft.heure_fin) ? autoName(draft.heure_debut, draft.heure_fin) : "Ex : Matin"} className="mt-1" />
          </label>
          <Button type="button" onClick={addCustom} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter</Button>
        </CardContent></Card>
      )}

      {sorted.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">Aucun créneau : ajoutez « Matin » et « Après-midi » en un clic.</CardContent></Card>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {sorted.map((c) => {
            const left = Math.max(0, ((toMin(c.heure_debut) - DAY_START) / (DAY_END - DAY_START)) * 100);
            const width = Math.max(2, ((toMin(c.heure_fin) - toMin(c.heure_debut)) / (DAY_END - DAY_START)) * 100);
            const bad = overlaps(c);
            return (
              <div key={c.id} className="space-y-2 p-3" data-testid={`creneau-${c.id}`}>
                {editId === c.id ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <Input value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} className="w-40" placeholder="Nom" />
                    <Input type="time" value={edit.heure_debut} onChange={(e) => setEdit({ ...edit, heure_debut: e.target.value })} className="w-32" />
                    <Input type="time" value={edit.heure_fin} onChange={(e) => setEdit({ ...edit, heure_fin: e.target.value })} className="w-32" />
                    <Button size="sm" onClick={saveEdit} disabled={busy}><Check className="mr-1 h-4 w-4" />Enregistrer</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Clock className="h-4 w-4 text-primary" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.nom} <span className="font-normal text-muted-foreground">· {c.heure_debut}–{c.heure_fin} ({fmtDur(c.heure_debut, c.heure_fin)})</span></p>
                      {bad && <p className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3 w-3" />Chevauche un autre créneau</p>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditId(c.id); setEdit({ nom: c.nom, heure_debut: c.heure_debut, heure_fin: c.heure_fin }); }} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(c)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                )}
                <div className="relative h-2 rounded-full bg-muted">
                  <div className={`absolute top-0 h-2 rounded-full ${bad ? "bg-amber-500" : "bg-primary"}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
                </div>
              </div>
            );
          })}
          <div className="flex justify-between px-3 py-1.5 text-[10px] text-muted-foreground"><span>7 h</span><span>11 h</span><span>15 h</span><span>19 h</span><span>23 h</span></div>
        </div>
      )}
    </div>
  );
}
