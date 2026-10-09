import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Minus, Plus, Users } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

// Types d'espaces : un clic préremplit la capacité et les équipements habituels (tout reste modifiable).
export const SALLE_TYPES = [
  { id: "reunion", label: "Salle de réunion", cap: 8, eq: ["Écran", "Visioconférence"], hint: "Salle de réunion 1" },
  { id: "studio", label: "Studio / plateau", cap: 15, eq: ["Sono", "Éclairage", "Caméras"], hint: "Studio A" },
  { id: "formation", label: "Salle de formation", cap: 20, eq: ["Vidéoprojecteur", "Tableau blanc"], hint: "Salle de formation" },
  { id: "regie", label: "Régie", cap: 4, eq: ["Console", "Retours vidéo"], hint: "Régie 1" },
  { id: "autre", label: "Autre espace", cap: null, eq: [], hint: "Nom de l'espace" },
];
const COMMON_EQ = ["Écran", "Vidéoprojecteur", "Sono", "Visioconférence", "Tableau blanc", "Wifi", "Éclairage", "Caméras", "Climatisation", "Accès PMR"];
const QUICK_CAP = [4, 8, 12, 20, 30];

const empty = { type: "reunion", nom: "", capacite: 8, equipements: ["Écran", "Visioconférence"], description: "" };

function fromSalle(s) {
  if (!s) return { ...empty };
  return {
    type: s.type || "autre",
    nom: s.nom || "",
    capacite: s.capacite ?? null,
    equipements: (s.equipements || "").split(",").map((x) => x.trim()).filter(Boolean),
    description: s.description || "",
  };
}

export default function SalleEditor({ open, onOpenChange, salle, onSave, submitting }) {
  const [f, setF] = useState(empty);
  const [custom, setCustom] = useState("");
  const [showNote, setShowNote] = useState(false);
  useEffect(() => {
    if (open) { const v = fromSalle(salle); setF(v); setShowNote(!!v.description); setCustom(""); }
  }, [open, salle]);

  const type = SALLE_TYPES.find((t) => t.id === f.type) || SALLE_TYPES[4];
  const pickType = (t) => setF((p) => (salle ? { ...p, type: t.id } : { ...p, type: t.id, capacite: t.cap, equipements: [...t.eq] }));
  const toggleEq = (e) => setF((p) => ({ ...p, equipements: p.equipements.includes(e) ? p.equipements.filter((x) => x !== e) : [...p.equipements, e] }));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !f.equipements.includes(v)) setF((p) => ({ ...p, equipements: [...p.equipements, v] }));
    setCustom("");
  };
  const cap = f.capacite ?? 0;
  const submit = (e) => {
    e.preventDefault();
    onSave({ nom: f.nom.trim() || type.hint, capacite: f.capacite || null, equipements: f.equipements.join(", "), description: f.description.trim() || null, type: f.type });
  };
  const eqAll = [...COMMON_EQ, ...f.equipements.filter((e) => !COMMON_EQ.includes(e))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{salle ? "Modifier l'espace" : "Nouvel espace"}</DialogTitle>
          <DialogDescription>{salle ? "Ajustez les informations de cet espace." : "Choisissez un type : la capacité et les équipements habituels sont préremplis."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <section className="space-y-2">
            <p className="text-sm font-semibold">Type d'espace</p>
            <div className="flex flex-wrap gap-2">
              {SALLE_TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => pickType(t)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${f.type === t.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold">Nom</p>
            <Input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder={type.hint} autoFocus />
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold">Combien de personnes ?</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border">
                <button type="button" className="px-3 py-2 hover:bg-muted" onClick={() => setF({ ...f, capacite: Math.max(1, cap - 1) })} aria-label="Moins"><Minus className="h-4 w-4" /></button>
                <input type="number" min="1" value={f.capacite ?? ""} onChange={(e) => setF({ ...f, capacite: e.target.value ? parseInt(e.target.value, 10) : null })}
                  className="w-16 border-x bg-transparent py-2 text-center font-semibold outline-none" aria-label="Capacité" />
                <button type="button" className="px-3 py-2 hover:bg-muted" onClick={() => setF({ ...f, capacite: cap + 1 })} aria-label="Plus"><Plus className="h-4 w-4" /></button>
              </div>
              {QUICK_CAP.map((n) => (
                <button key={n} type="button" onClick={() => setF({ ...f, capacite: n })}
                  className={`rounded-full border px-3 py-1 text-sm ${f.capacite === n ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{n}</button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-semibold">Équipements</p>
            <div className="flex flex-wrap gap-2">
              {eqAll.map((e) => {
                const on = f.equipements.includes(e);
                return (
                  <button key={e} type="button" onClick={() => toggleEq(e)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
                    {on && <Check className="h-3 w-3" />}{e}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Autre équipement…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
              <Button type="button" variant="outline" onClick={addCustom}>Ajouter</Button>
            </div>
          </section>

          {showNote ? (
            <section className="space-y-2">
              <p className="text-sm font-semibold">Note</p>
              <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Accès, consignes, étage…" />
            </section>
          ) : (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowNote(true)}>+ Ajouter une note</button>
          )}

          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3" aria-label="Aperçu">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{f.nom.trim() || type.hint}</p>
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                {f.capacite ? <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{f.capacite} personnes</span> : null}
                <span className="truncate">{f.equipements.join(" · ") || "Aucun équipement"}</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {salle ? "Enregistrer" : "Créer l'espace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
