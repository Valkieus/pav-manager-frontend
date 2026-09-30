import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {
  CalendarOff,
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  UserRound,
  X,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmt = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });

const dayCount = (a, b) =>
  Math.round(
    (new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000,
  ) + 1;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

// Absence d'équipe : nom — motif — durée.
// - les absences déclarées par les personnes elles-mêmes (Mon espace) restent
//   affichées automatiquement ;
// - un Responsable+ peut en ajouter pour n'importe quelle fiche de l'effectif
//   (liste déroulante compacte, motif libre, dates) : même système qu'une
//   déclaration personnelle, sans notification ;
// - les lignes de texte libre déjà saisies dans le planning sont conservées et
//   affichées dans le même style (elles continuent d'être enregistrées avec le
//   planning).
export default function PlanningTeamAbsences({
  techniciens,
  declared,
  text,
  onTextChange,
  onCreated,
}) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [motif, setMotif] = useState("");
  const [debut, setDebut] = useState(todayIso());
  const [fin, setFin] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [freeLine, setFreeLine] = useState("");

  const people = useMemo(() => {
    const seen = new Set();
    return (techniciens || [])
      .filter((t) => t.id && !seen.has(t.id) && seen.add(t.id))
      .map((t) => ({
        id: t.id,
        label: [t.prenom, t.nom].filter(Boolean).join(" ") || t.nom || "?",
        poste: t.poste_principal || "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [techniciens]);

  const person = people.find((p) => p.id === personId);

  const lines = useMemo(
    () =>
      (text || "")
        .split("\n")
        .map((l, index) => ({ l: l.trim(), index }))
        .filter((x) => x.l),
    [text],
  );

  // Les lignes inscrites automatiquement pour une absence déclarée sont déjà
  // représentées par sa carte : on ne les répète pas dans les lignes libres.
  const autoMarkers = useMemo(
    () =>
      (declared || []).map(
        (a) => `${a.full_name} — absent du ${a.date_debut} au ${a.date_fin}`,
      ),
    [declared],
  );
  const freeLines = lines.filter(
    (x) => !autoMarkers.some((m) => x.l.startsWith(m)),
  );

  const submit = async () => {
    if (!personId) return toast.error("Choisissez une personne");
    if (!motif.trim()) return toast.error("Indiquez le motif de l'absence");
    if (!debut || !fin) return toast.error("Indiquez les dates");
    if (fin < debut)
      return toast.error("La date de fin doit être après la date de début");
    setSaving(true);
    try {
      await axios.post(`${API}/absences/for-person`, {
        technicien_id: personId,
        date_debut: debut,
        date_fin: fin,
        raison: motif.trim(),
      });
      toast.success(`Absence enregistrée pour ${person?.label || "la personne"}`);
      setMotif("");
      setPersonId("");
      await onCreated?.();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de l'enregistrement",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeDeclared = async (a) => {
    try {
      await axios.delete(`${API}/absences/${a.id}`);
      toast.success("Absence supprimée");
      await onCreated?.({ removed: a });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Suppression impossible");
    }
  };

  const removeLine = (index) => {
    const all = (text || "").split("\n");
    all.splice(index, 1);
    onTextChange(all.join("\n"));
  };

  const addFreeLine = () => {
    const v = freeLine.trim();
    if (!v) return;
    onTextChange(text ? `${text.replace(/\s+$/, "")}\n${v}` : v);
    setFreeLine("");
  };

  return (
    <div className="space-y-2" data-testid="team-absences">
      <div className="flex items-center gap-2">
        <CalendarOff className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Absences de l'équipe</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {declared.length + freeLines.length}
        </Badge>
      </div>

      {/* Ajout : personne (liste compacte) — motif libre — durée */}
      <div className="rounded-lg border bg-muted/30 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                role="combobox"
                aria-expanded={open}
                className="h-8 w-[190px] justify-between font-normal"
                data-testid="absence-person-select"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <UserRound className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {person ? person.label : "Choisir une personne"}
                  </span>
                </span>
                <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un nom…" />
                <CommandList className="max-h-[240px]">
                  <CommandEmpty>Aucune fiche trouvée.</CommandEmpty>
                  <CommandGroup>
                    {people.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`${p.label} ${p.poste}`}
                        onSelect={() => {
                          setPersonId(p.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${personId === p.id ? "opacity-100" : "opacity-0"}`}
                        />
                        <span className="truncate">{p.label}</span>
                        {p.poste && (
                          <span className="ml-auto pl-2 text-[10px] text-muted-foreground truncate">
                            {p.poste}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Motif (saisie libre)"
            className="h-8 flex-1 min-w-[150px] text-sm"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            data-testid="absence-motif"
          />
          <span className="text-xs text-muted-foreground">du</span>
          <Input
            type="date"
            value={debut}
            onChange={(e) => {
              setDebut(e.target.value);
              if (!fin || fin < e.target.value) setFin(e.target.value);
            }}
            className="h-8 w-[140px] text-sm"
          />
          <span className="text-xs text-muted-foreground">au</span>
          <Input
            type="date"
            value={fin}
            min={debut}
            onChange={(e) => setFin(e.target.value)}
            className="h-8 w-[140px] text-sm"
          />
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={submit}
            disabled={saving}
            data-testid="absence-add-btn"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5 mr-1" />
            )}
            Ajouter
          </Button>
        </div>
      </div>

      {/* Absences déclarées + lignes libres déjà saisies : pastilles compactes,
          sur plusieurs colonnes, hauteur limitée avec défilement */}
      <div className="flex flex-wrap gap-1.5 max-h-[104px] overflow-y-auto pr-1">
        {declared.map((a) => {
          const manual = !!a.technicien_id;
          return (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2.5 py-0.5 text-xs text-amber-900 dark:text-amber-200"
              title={
                manual
                  ? `Saisie par ${a.created_by_name || "un responsable"}`
                  : "Déclarée par la personne (Mon espace)"
              }
            >
              <span className="font-semibold">{a.full_name}</span>
              <span className="opacity-80">
                {a.raison} ·{" "}
                {a.date_debut === a.date_fin
                  ? fmt(a.date_debut)
                  : `${fmt(a.date_debut)}→${fmt(a.date_fin)}`}{" "}
                · {dayCount(a.date_debut, a.date_fin)} j
              </span>
              {manual && (
                <button
                  type="button"
                  className="text-amber-700/70 hover:text-destructive"
                  onClick={() => removeDeclared(a)}
                  aria-label="Supprimer l'absence"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
        {freeLines.map((x) => (
          <span
            key={`${x.index}-${x.l}`}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs"
          >
            <span className="break-words">{x.l}</span>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => removeLine(x.index)}
              aria-label="Retirer la ligne"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={freeLine}
          onChange={(e) => setFreeLine(e.target.value)}
          placeholder="Ajouter une note libre (ex. : Jean — matin seulement)"
          className="h-7 text-xs"
          onKeyDown={(e) => e.key === "Enter" && addFreeLine()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={addFreeLine}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
