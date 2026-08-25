import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { BarChart3, Loader2, Download } from 'lucide-react';
import { downloadOrShareFile, downloadStatusMessage, reserveTabForIOSFallback } from '../utils/fileDownload';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Rapport KPI présence / absences non notées : pour chaque personne
// planifiée sur le mois, compare son nombre d'affectations au nombre
// d'absences qu'elle a déclarées sur la même période et signale les dates
// où elle est planifiée alors qu'une absence couvre ce jour — pour que les
// gestionnaires repèrent les personnes planifiées mais qui ne notent
// jamais leurs absences (ou l'inverse).
export default function PlanningKpiReport() {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);

  const fetchReport = useCallback(async (m, y) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/planning/kpi-presence`, { params: { mois: m, annee: y } });
      setRows(res.data?.rows || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du chargement du rapport');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    fetchReport(mois, annee);
  };

  const changeMonth = (delta) => {
    let m = mois + delta;
    let y = annee;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMois(m);
    setAnnee(y);
    fetchReport(m, y);
  };

  const handleDownloadCsv = async () => {
    const preOpenedWindow = reserveTabForIOSFallback();
    try {
      const header = ['Nom', 'Fois planifié(e)', 'Absences déclarées', 'Planifié malgré absence déclarée', 'Dates concernées'];
      const lines = [header.join(';')];
      for (const r of rows) {
        lines.push([
          r.full_name,
          r.times_scheduled,
          r.absences_declared,
          r.overlap_count,
          (r.dates_overlap || []).join(', '),
        ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'));
      }
      const csv = '﻿' + lines.join('\r\n'); // BOM so Excel opens accents correctly
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const filename = `rapport-presence-${annee}-${String(mois).padStart(2, '0')}.csv`;
      const status = await downloadOrShareFile(blob, filename, { title: filename, preOpenedWindow });
      if (status === 'downloaded') toast.success('Rapport téléchargé');
      else if (status === 'blocked') toast.error(downloadStatusMessage(status));
    } catch (err) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error('Erreur lors du téléchargement du rapport');
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4" /> Rapport présence
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Rapport présence / absences non notées</DialogTitle>
            <DialogDescription>
              Compare, pour chaque personne planifiée ce mois-ci, son nombre d'affectations et ses absences déclarées — utile pour repérer qui est planifié mais ne note jamais ses absences, ou dont le planning n'a pas été mis à jour après une absence déclarée.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>◀</Button>
              <span className="text-sm font-medium min-w-[120px] text-center">{MOIS_NOMS[mois - 1]} {annee}</span>
              <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>▶</Button>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadCsv} disabled={loading || rows.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger CSV
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Personne de planifié ni d'absence déclarée pour ce mois.</p>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2">Nom</th>
                    <th className="py-2 pr-2 text-center">Planifié(e)</th>
                    <th className="py-2 pr-2 text-center">Absences déclarées</th>
                    <th className="py-2 pr-2 text-center">Chevauchements</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.full_name} className="border-b border-border/50 hover:bg-muted/40">
                      <td className="py-2 pr-2 font-medium">{r.full_name}</td>
                      <td className="py-2 pr-2 text-center">{r.times_scheduled}</td>
                      <td className="py-2 pr-2 text-center">
                        {r.absences_declared === 0 && r.times_scheduled > 0 ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">0</Badge>
                        ) : r.absences_declared}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {r.overlap_count > 0 ? (
                          <Badge variant="outline" className="text-red-600 border-red-300" title={(r.dates_overlap || []).join(', ')}>
                            {r.overlap_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-3">
                "Chevauchements" = jours où la personne est planifiée alors qu'une absence déclarée couvre cette même date (planning probablement pas mis à jour). Le badge "0" en Absences déclarées signale une personne souvent planifiée mais qui n'a jamais déclaré d'absence ce mois-ci.
              </p>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
