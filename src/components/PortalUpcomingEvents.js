import { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarDays, Loader2, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX = 5;

// Date locale AAAA-MM-JJ (pas UTC : un événement de ce soir ne doit pas disparaître à minuit UTC).
const localYmd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (ymd) => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const fmt = (ymd, opts) => parse(ymd).toLocaleDateString('fr-FR', opts);

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
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

// Événements à venir (Actualités avec une date), visibles aussi dans la vue verrouillée : le serveur les envoie à tout compte connecté.
export default function PortalUpcomingEvents() {
  const [events, setEvents] = useState(null); // null = chargement, [] = aucun, undefined = indisponible
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
  return (
    <Card className="overflow-hidden rounded-2xl border-primary/10 shadow-sm" data-testid="portal-upcoming-events">
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" />Événements à venir</CardTitle></CardHeader>
      <CardContent>
        {events === null ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="portal-no-events">Aucun événement à venir pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id || `${e.titre}-${e.date_evenement}`} className="flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5" data-testid="portal-event">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary leading-none">
                  <span className="text-lg font-bold tabular-nums">{parse(e.date_evenement).getDate()}</span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase">{fmt(e.date_evenement, { month: 'short' }).replace('.', '')}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{e.titre}</p>
                  <p className="text-xs text-muted-foreground">{whenLabel(e, today)}</p>
                  {e.invite && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      <UserRound className="h-3 w-3" />Invité{e.invite_nom ? ` : ${e.invite_nom}` : ''}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
