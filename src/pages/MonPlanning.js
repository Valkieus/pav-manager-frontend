import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Loader2, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const YEARS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040];
// Aligné sur Planning.js : pas de mois avant août 2026, pas d'année après 2040.
const MIN_YEAR = 2026;
const MIN_MONTH_IN_MIN_YEAR = 8;
const MAX_YEAR = 2040;

function todayParts() {
  const d = new Date();
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// "Mon planning" — version réduite/reformatée du planning équipe : pour
// chaque utilisateur, on liste uniquement les jours du mois où il/elle est
// de service (équipe et événements confondus, un événement étant
// structurellement lui aussi "un planning"). Copie le format tableau du
// planning équipe (mois/année en tête), mais réduit aux seuls jours
// pertinents pour la personne connectée.
export default function MonPlanning() {
  const { month: initMonth, year: initYear } = todayParts();
  const [mois, setMois] = useState(initMonth);
  const [annee, setAnnee] = useState(initYear);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMois = useCallback(async (m, y) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/planning/mois/${y}/${m}`);
      setData(res.data);
    } catch (err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMois(mois, annee); }, [mois, annee, fetchMois]);

  const atMin = annee === MIN_YEAR && mois <= MIN_MONTH_IN_MIN_YEAR;
  const atMax = annee === MAX_YEAR && mois >= 12;

  const goPrev = () => {
    if (atMin) return;
    if (mois === 1) { setMois(12); setAnnee((y) => Math.max(MIN_YEAR, y - 1)); }
    else setMois((m) => m - 1);
  };
  const goNext = () => {
    if (atMax) return;
    if (mois === 12) { setMois(1); setAnnee((y) => Math.min(MAX_YEAR, y + 1)); }
    else setMois((m) => m + 1);
  };

  const jours = data?.jours || [];
  const myNom = data?.my_nom;
  const affectations = jours.flatMap((j) =>
    j.items.map((item, idx) => ({ ...item, date: j.date, jour_semaine: j.jour_semaine, key: `${j.date}-${idx}` }))
  );
  const total = affectations.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="w-6 h-6" /> Mon planning
        </h1>
        <p className="text-muted-foreground">Tes jours de service ce mois-ci — vue réduite du planning générale.</p>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" disabled={atMin} onClick={goPrev}>
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Select value={String(mois)} onValueChange={(v) => setMois(parseInt(v))}>
                <SelectTrigger className="w-[104px] sm:w-[140px] text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOIS_NOMS.map((nom, idx) => {
                    const monthNum = idx + 1;
                    if (annee === MIN_YEAR && monthNum < MIN_MONTH_IN_MIN_YEAR) return null;
                    return <SelectItem key={idx} value={String(monthNum)}>{nom}</SelectItem>;
                  })}
                </SelectContent>
              </Select>

              <Select
                value={String(annee)}
                onValueChange={(v) => {
                  const year = parseInt(v);
                  setAnnee(year);
                  if (year === MIN_YEAR && mois < MIN_MONTH_IN_MIN_YEAR) setMois(MIN_MONTH_IN_MIN_YEAR);
                }}
              >
                <SelectTrigger className="w-[76px] sm:w-[100px] text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="icon" className="shrink-0" disabled={atMax} onClick={goNext}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : !myNom ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aucune fiche technicien liée à ton compte — rapproche-toi d'un Gestionnaire+ pour la lier.
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aucun jour de service pour toi ce mois-ci.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <p className="font-semibold">
                Tu es de service {total} fois ce mois-ci.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {affectations.map((item) => (
                <div key={item.key} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-medium capitalize">
                    {item.source_label || item.jour_semaine} {formatDateLabel(item.date)}
                  </span>
                  <span className="text-muted-foreground text-sm">en tant que {item.role_label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
