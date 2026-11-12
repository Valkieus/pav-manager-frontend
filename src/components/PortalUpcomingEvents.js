import { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays, Loader2, Maximize2, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND}/api`;
const MAX = 6;

// Date locale AAAA-MM-JJ (pas UTC : un événement de ce soir ne doit pas disparaître à minuit UTC).
const localYmd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (ymd) => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const fmt = (ymd, opts) => parse(ymd).toLocaleDateString('fr-FR', opts);
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const imgSrc = (u) => (!u ? '' : /^https?:/i.test(u) ? u : `${BACKEND}${u}`);

function whenLabel(e, today) {
  const start = e.date_evenement; const end = e.date_fin_evenement;
  if (end && end !== start) {
    if (start <= today && today <= end) return `En cours · jusqu'au ${fmt(end, { day: 'numeric', month: 'long' })}`;
    return `Du ${fmt(start, { day: 'numeric', month: 'long' })} au ${fmt(end, { day: 'numeric', month: 'long' })}`;
  }
  const diff = Math.round((parse(start) - parse(today)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  return cap(fmt(start, { weekday: 'long', day: 'numeric', month: 'long' }));
}

// Pastille de date : jour + mois.
function DateChip({ ymd, className = '' }) {
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary leading-none ${className}`}>
      <span className="text-lg font-bold tabular-nums">{parse(ymd).getDate()}</span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase">{fmt(ymd, { month: 'short' }).replace('.', '')}</span>
    </div>
  );
}

// Ligne compacte pour un événement sans affiche (pas de grande carte vide).
function EventRow({ e, today }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5" data-testid="portal-event">
      <DateChip ymd={e.date_evenement} className="h-12 w-12" />
      <div className="min-w-0">
        <p className="font-medium leading-snug">{e.titre}</p>
        <p className="text-xs text-muted-foreground">{whenLabel(e, today)}</p>
        {e.invite && (
          <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
            <UserRound className="h-3 w-3 shrink-0" /><span className="truncate">Invité{e.invite_nom ? ` : ${e.invite_nom}` : ''}</span>
          </p>
        )}
      </div>
    </li>
  );
}

function EventCard({ e, today, onZoom }) {
  const [broken, setBroken] = useState(false);
  const poster = !broken ? imgSrc(e.image_url) : '';
  return (
    <li className="group flex overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md sm:flex-col" data-testid="portal-event">
      {poster ? (
        <button type="button" onClick={() => onZoom(e)} aria-label={`Voir l'affiche : ${e.titre}`}
          className="relative block w-28 shrink-0 self-stretch overflow-hidden bg-muted sm:w-full sm:self-auto sm:aspect-[4/5]" data-testid="portal-event-poster">
          <img src={poster} alt={`Affiche : ${e.titre}`} loading="lazy" onError={() => setBroken(true)}
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03] aspect-[3/4] sm:aspect-auto" />
          <span className="absolute left-2 top-2 flex flex-col items-center rounded-lg bg-background/95 px-2 py-1 leading-none text-primary shadow">
            <span className="text-base font-bold tabular-nums">{parse(e.date_evenement).getDate()}</span>
            <span className="text-[9px] font-semibold uppercase">{fmt(e.date_evenement, { month: 'short' }).replace('.', '')}</span>
          </span>
          <span className="absolute bottom-2 right-2 hidden rounded-full bg-black/55 p-1.5 text-white sm:inline-flex"><Maximize2 className="h-3.5 w-3.5" /></span>
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-start gap-3 p-3 sm:p-4">
        {!poster && <DateChip ymd={e.date_evenement} className="h-12 w-12" />}
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{e.titre}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{whenLabel(e, today)}</p>
          {e.invite && (
            <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
              <UserRound className="h-3 w-3 shrink-0" /><span className="truncate">Invité{e.invite_nom ? ` : ${e.invite_nom}` : ''}</span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

// Événements à venir (Actualités avec une date), avec leur affiche, visibles aussi dans la vue verrouillée : le serveur les envoie à tout compte connecté.
export default function PortalUpcomingEvents() {
  const [events, setEvents] = useState(null); // null = chargement, [] = aucun, undefined = indisponible
  const [zoom, setZoom] = useState(null);
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/actualites`).then((r) => {
      const today = localYmd();
      const list = (r.data || [])
        .filter((a) => a.is_active !== false && a.date_evenement && (a.date_fin_evenement || a.date_evenement) >= today)
        .sort((a, b) => String(a.date_evenement).localeCompare(String(b.date_evenement)))
        .slice(0, MAX);
      if (alive) setEvents(list);
    }).catch(() => { if (alive) setEvents(undefined); });
    return () => { alive = false; };
  }, []);

  if (events === undefined) return null; // indisponible : on n'affiche rien plutôt qu'une erreur
  const today = localYmd();
  const withPoster = (events || []).filter((e) => !!e.image_url);
  const plain = (events || []).filter((e) => !e.image_url);
  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl border-primary/10 shadow-sm" data-testid="portal-upcoming-events">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-primary" />Événements à venir</CardTitle></CardHeader>
      <CardContent>
        {events === null ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="portal-no-events">Aucun événement à venir pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {withPoster.length > 0 && (
              <ul className="grid items-start gap-3 sm:grid-cols-2" data-testid="portal-events-posters">
                {withPoster.map((e) => <EventCard key={e.id || `${e.titre}-${e.date_evenement}`} e={e} today={today} onZoom={setZoom} />)}
              </ul>
            )}
            {plain.length > 0 && (
              <div>
                {withPoster.length > 0 && <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Aussi à venir</p>}
                <ul className="grid gap-2 sm:grid-cols-2" data-testid="portal-events-plain">
                  {plain.map((e) => <EventRow key={e.id || `${e.titre}-${e.date_evenement}`} e={e} today={today} />)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={!!zoom} onOpenChange={(o) => { if (!o) setZoom(null); }}>
        <DialogContent className="max-h-[94vh] w-[min(94vw,640px)] max-w-none overflow-y-auto p-3 sm:p-5">
          {zoom && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6 leading-snug">{zoom.titre}</DialogTitle>
                <DialogDescription>{whenLabel(zoom, today)}{zoom.invite ? ` · Invité${zoom.invite_nom ? ` : ${zoom.invite_nom}` : ''}` : ''}</DialogDescription>
              </DialogHeader>
              <img src={imgSrc(zoom.image_url)} alt={`Affiche : ${zoom.titre}`} className="mx-auto max-h-[72vh] w-auto max-w-full rounded-lg object-contain" />
              {zoom.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{zoom.description}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
