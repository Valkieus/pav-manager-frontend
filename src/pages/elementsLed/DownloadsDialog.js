import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ChevronDown, DownloadCloud, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { API } from '../administration/constants';

const time = (iso) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const dayKey = (iso) => { try { return new Date(iso).toLocaleDateString('fr-CA'); } catch (e) { return ''; } };
const dayLabel = (key) => {
  const today = new Date().toLocaleDateString('fr-CA');
  const yest = new Date(Date.now() - 86400000).toLocaleDateString('fr-CA');
  if (key === today) return "Aujourd'hui";
  if (key === yest) return 'Hier';
  try { return new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return key; }
};
const PAGE_DAYS = 4;

function Tile({ label, value }) {
  return (
    <div className="rounded-xl border bg-muted/40 px-3 py-2 text-center">
      <p className="text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// Une personne, un jour : « Laura · 4 fichiers » ; un clic déplie la liste des fichiers.
function PersonRow({ person, files, last }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-3 py-2 text-left" aria-expanded={open}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{(person || '?').charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{person}</span>
          <span className="block text-xs text-muted-foreground">{files.length} fichier{files.length > 1 ? 's' : ''} · dernier à {time(last)}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="space-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
          {files.map((r) => (
            <li key={`${r.element_id}-${r.filename}-${r.at}`} className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate"><span className="text-foreground">{r.titre}</span>{r.filename && r.filename !== r.titre ? ` · ${r.filename}` : ''}{r.categorie ? ` · ${r.categorie}` : ''}</span>
              <span className="shrink-0">{time(r.at)}{r.count > 1 ? ` · ${r.count}×` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Journal : qui a téléchargé quoi — résumé en haut, regroupé par jour puis par personne (rien d'infini : 4 jours à la fois).
export function DownloadsDialog({ open, onOpenChange }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('jour');
  const [q, setQ] = useState('');
  const [days, setDays] = useState(PAGE_DAYS);
  const [people, setPeople] = useState(8);
  useEffect(() => {
    if (!open) return;
    setData(null); setDays(PAGE_DAYS); setPeople(8);
    axios.get(`${API}/led/downloads`).then((r) => setData(r.data)).catch((e) => { toast.error(e.response?.data?.detail || 'Lecture impossible'); setData({ rows: [], par_personne: [] }); });
  }, [open]);

  const s = q.trim().toLowerCase();
  const rows = useMemo(() => (data?.rows || []).filter((r) => !s || [r.nom, r.titre, r.filename, r.categorie].some((x) => (x || '').toLowerCase().includes(s))), [data, s]);
  const stats = useMemo(() => {
    const all = data?.rows || [];
    const today = new Date().toLocaleDateString('fr-CA');
    const week = Date.now() - 7 * 86400000;
    return { today: all.filter((r) => dayKey(r.at) === today).length, week: all.filter((r) => new Date(r.at).getTime() >= week).length, total: all.length };
  }, [data]);
  const byDay = useMemo(() => {
    const map = new Map();
    [...rows].sort((a, b) => String(b.at).localeCompare(String(a.at))).forEach((r) => {
      const k = dayKey(r.at);
      if (!map.has(k)) map.set(k, new Map());
      const persons = map.get(k);
      if (!persons.has(r.nom)) persons.set(r.nom, { files: [], last: r.at });
      persons.get(r.nom).files.push(r);
    });
    return [...map.entries()];
  }, [rows]);
  const persons = (data?.par_personne || []).filter((u) => !s || (u.nom || '').toLowerCase().includes(s));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><DownloadCloud className="h-5 w-5" /> Téléchargements</DialogTitle></DialogHeader>
        {!data ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
          <>
            <div className="grid grid-cols-3 gap-2" data-testid="downloads-stats">
              <Tile label="Aujourd'hui" value={stats.today} />
              <Tile label="7 derniers jours" value={stats.week} />
              <Tile label="Au total" value={stats.total} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md border p-0.5 text-sm">
                {[['jour', 'Par jour'], ['personne', 'Par personne']].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded px-3 py-1 ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{l}</button>
                ))}
              </div>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="min-w-32 flex-1" />
            </div>

            {tab === 'jour' ? (
              byDay.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Aucun téléchargement{s ? ' pour cette recherche' : " pour l'instant"}.</p> : (
                <div className="space-y-4" data-testid="downloads-by-day">
                  {byDay.slice(0, days).map(([k, personsMap]) => (
                    <section key={k} className="space-y-1.5">
                      <h3 className="flex items-baseline justify-between text-sm font-semibold"><span className="first-letter:uppercase">{dayLabel(k)}</span><span className="text-xs font-normal normal-case text-muted-foreground">{[...personsMap.values()].reduce((n, p) => n + p.files.length, 0)} téléchargement(s)</span></h3>
                      <ul className="space-y-1.5">
                        {[...personsMap.entries()].map(([nom, p]) => <PersonRow key={nom} person={nom} files={p.files} last={p.last} />)}
                      </ul>
                    </section>
                  ))}
                  {byDay.length > days && (
                    <button onClick={() => setDays((d) => d + PAGE_DAYS)} className="w-full rounded-lg border py-2 text-sm text-muted-foreground hover:bg-muted" data-testid="downloads-more">
                      Jours précédents ({byDay.length - days} de plus)
                    </button>
                  )}
                </div>
              )
            ) : (
              <>
                <ul className="divide-y rounded-lg border">
                  {persons.slice(0, people).map((u, i) => (
                    <li key={u.user_id || u.nom} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.nom}</span><span className="block text-xs text-muted-foreground">dernier : {dayLabel(dayKey(u.dernier))} à {time(u.dernier)}</span></span>
                      <span className="text-right text-xs text-muted-foreground"><strong className="text-sm text-foreground">{u.telechargements}</strong> téléch.<br />{u.fichiers} fichier{u.fichiers > 1 ? 's' : ''}</span>
                    </li>
                  ))}
                  {persons.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Personne.</li>}
                </ul>
                {persons.length > people && <button onClick={() => setPeople((n) => n + 10)} className="w-full rounded-lg border py-2 text-sm text-muted-foreground hover:bg-muted">Voir plus ({persons.length - people})</button>}
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
