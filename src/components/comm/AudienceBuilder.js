import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Loader2, X, Users } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

let optionsCache = null;
export async function loadAudienceOptions() {
  if (optionsCache) return optionsCache;
  const res = await axios.get(`${API}/comm/audience/options`);
  optionsCache = res.data;
  return optionsCache;
}

export const EMPTY_AUDIENCE = {
  tous: false, niveaux: [], branches: [], postes: [], group_ids: [], user_ids: [], exclure_user_ids: [], mode: "ou",
};

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`touch-manipulation rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"
    }`}
  >
    {children}
  </button>
);

const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// Construit une audience (qui est visé) et affiche en direct la liste exacte des personnes concernées.
export default function AudienceBuilder({ value, onChange }) {
  const [opts, setOpts] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showList, setShowList] = useState(false);
  const [personQ, setPersonQ] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    loadAudienceOptions().then(setOpts).catch(() => setOpts({ niveaux: [], branches: [], postes: [], groups: [], users: [] }));
  }, []);

  const set = (patch) => onChange({ ...value, ...patch });
  const criteriaCount = [value.niveaux, value.branches, value.postes, value.group_ids].filter((a) => a.length > 0).length;

  const sig = JSON.stringify(value);
  useEffect(() => {
    clearTimeout(timer.current);
    const empty = !value.tous && !criteriaCount && !value.user_ids.length;
    if (empty) { setPreview({ count: 0, users: [] }); return undefined; }
    setLoadingPreview(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await axios.post(`${API}/comm/audience/preview`, value);
        setPreview(res.data);
      } catch (e) {
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const matches = useMemo(() => {
    const q = personQ.trim().toLowerCase();
    if (!q || !opts) return [];
    return opts.users.filter((u) => u.nom.toLowerCase().includes(q) && !value.user_ids.includes(u.id)).slice(0, 8);
  }, [personQ, opts, value.user_ids]);
  const nameOf = (id) => opts?.users.find((u) => u.id === id)?.nom || id;

  if (!opts) return <div className="p-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;

  const Section = ({ title, children }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="audience-builder">
      <label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-semibold">
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={value.tous} onChange={(e) => set({ tous: e.target.checked })} />
        Toute l'équipe
      </label>

      {!value.tous && (
        <>
          <Section title="Niveau d'accès">
            {opts.niveaux.map((n) => <Chip key={n} active={value.niveaux.includes(n)} onClick={() => set({ niveaux: toggle(value.niveaux, n) })}>{n}</Chip>)}
          </Section>
          <Section title="Pôle (branche)">
            {opts.branches.map((b) => <Chip key={b} active={value.branches.includes(b)} onClick={() => set({ branches: toggle(value.branches, b) })}>{b}</Chip>)}
          </Section>
          <Section title="Poste">
            {opts.postes.map((p) => <Chip key={p} active={value.postes.includes(p)} onClick={() => set({ postes: toggle(value.postes, p) })}>{p}</Chip>)}
          </Section>
          {opts.groups.length > 0 && (
            <Section title="Groupe de droits">
              {opts.groups.map((g) => <Chip key={g.id} active={value.group_ids.includes(g.id)} onClick={() => set({ group_ids: toggle(value.group_ids, g.id) })}>{g.nom}</Chip>)}
            </Section>
          )}

          {criteriaCount >= 2 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2 text-sm">
              <span className="font-medium">Combiner les critères :</span>
              <Chip active={value.mode === "ou"} onClick={() => set({ mode: "ou" })}>L'un OU l'autre</Chip>
              <Chip active={value.mode === "et"} onClick={() => set({ mode: "et" })}>Tous à la fois (ET)</Chip>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personnes en particulier</p>
            <div className="relative">
              <Input value={personQ} onChange={(e) => setPersonQ(e.target.value)} placeholder="Taper un nom pour l'ajouter…" autoComplete="off" />
              {matches.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 shadow-md">
                  {matches.map((u) => (
                    <li key={u.id}>
                      <button type="button" className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => { set({ user_ids: [...value.user_ids, u.id] }); setPersonQ(""); }}>
                        <span>{u.nom}</span><span className="text-xs text-muted-foreground">{u.niveau}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {value.user_ids.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {value.user_ids.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 py-1 text-sm">
                    {nameOf(id)}
                    <button type="button" aria-label="Retirer" onClick={() => set({ user_ids: value.user_ids.filter((x) => x !== id) })}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3" data-testid="audience-preview">
        <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowList((v) => !v)}>
          <span className="flex items-center gap-2 text-sm font-bold">
            <Users className="h-4 w-4 text-primary" />
            {loadingPreview ? "Calcul…" : preview ? `${preview.count} personne${preview.count > 1 ? "s" : ""} ciblée${preview.count > 1 ? "s" : ""}` : "—"}
          </span>
          <span className="text-xs text-primary">{showList ? "Masquer la liste" : "Voir qui"}</span>
        </button>
        {showList && preview && (
          <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-sm">
            {preview.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1">
                <span className="min-w-0 truncate"><span className="font-medium">{u.nom}</span> <span className="text-xs text-muted-foreground">{u.niveau}{u.branches.length ? ` · ${u.branches.join(", ")}` : ""}</span></span>
                <button type="button" className="shrink-0 text-xs text-destructive" onClick={() => set({ exclure_user_ids: [...value.exclure_user_ids, u.id] })}>Exclure</button>
              </li>
            ))}
            {preview.users.length === 0 && <li className="text-muted-foreground">Personne pour l'instant.</li>}
          </ul>
        )}
        {value.exclure_user_ids.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Exclus : {value.exclure_user_ids.map(nameOf).join(", ")}{" "}
            <button type="button" className="text-primary underline" onClick={() => set({ exclure_user_ids: [] })}>Tout réinclure</button>
          </p>
        )}
      </div>
    </div>
  );
}
