import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  Loader2, Plus, Trash2, PartyPopper, Pencil, Archive, ArrowLeft, Printer,
  ImageDown, Ban, CalendarPlus, X, Save,
} from 'lucide-react';
import { downloadOrShareFile, downloadStatusMessage, reserveTabForIOSFallback } from '../utils/fileDownload';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const EXPORT_FONT = 'Arial, Helvetica, sans-serif';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slugify(label) {
  return (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `role_${Math.random().toString(36).slice(2, 7)}`;
}

function dateRangeInclusive(debut, fin) {
  if (!debut || !fin || fin < debut) return [];
  const out = [];
  let [y, m, d] = debut.split('-').map(Number);
  let cur = new Date(y, m - 1, d);
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  let guard = 0;
  while (fmt(cur) <= fin && guard < 400) {
    out.push(fmt(cur));
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

function fmtDateShort(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

async function svgToPngDataUrl(svgString, width, height, scale = 2) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png') };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Exporteur SVG dédié, léger, pour un planning événement (grille libre
// rôle x date) — même esprit que l'export du planning équipe (SVG généré
// depuis les données, jamais une capture d'écran) mais volontairement plus
// simple puisqu'il n'y a ni sections ni table1/table2 à gérer ici.
function buildEvenementExportSVG({ titre, dates, roles, affectations, blockedCells }) {
  const LABEL_W = 210;
  const COL_W = 130;
  const ROW_H = 34;
  const HEADER_H = 46;
  const TITLE_H = 52;
  const rows = [];
  roles.forEach((role) => {
    for (let slot = 0; slot < (role.slots || 1); slot++) {
      rows.push({ key: `${role.key}_${slot}`, label: role.slots > 1 ? `${role.label} #${slot + 1}` : role.label });
    }
  });
  const width = LABEL_W + COL_W * Math.max(dates.length, 1);
  const height = TITLE_H + HEADER_H + ROW_H * Math.max(rows.length, 1) + 30;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${TITLE_H}" fill="#1e3a8a" />`);
  parts.push(`<text x="${width / 2}" y="${TITLE_H / 2 + 6}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(titre)}</text>`);

  // Header row (dates)
  const headerY = TITLE_H;
  parts.push(`<rect x="0" y="${headerY}" width="${LABEL_W}" height="${HEADER_H}" fill="#dbeafe" stroke="#1e3a8a" />`);
  dates.forEach((d, i) => {
    const x = LABEL_W + i * COL_W;
    parts.push(`<rect x="${x}" y="${headerY}" width="${COL_W}" height="${HEADER_H}" fill="#dbeafe" stroke="#1e3a8a" />`);
    parts.push(`<text x="${x + COL_W / 2}" y="${headerY + HEADER_H / 2 + 5}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="13" font-weight="600" fill="#1e3a8a">${escapeXml(fmtDateShort(d))}</text>`);
  });

  rows.forEach((row, ri) => {
    const y = headerY + HEADER_H + ri * ROW_H;
    parts.push(`<rect x="0" y="${y}" width="${LABEL_W}" height="${ROW_H}" fill="#f8fafc" stroke="#1e3a8a" />`);
    parts.push(`<text x="10" y="${y + ROW_H / 2 + 5}" font-family="${EXPORT_FONT}" font-size="13" font-weight="600" fill="#111827">${escapeXml(row.label)}</text>`);
    dates.forEach((d, ci) => {
      const x = LABEL_W + ci * COL_W;
      const blocked = !!(blockedCells[row.key] || [])[ci];
      const nom = (affectations[row.key] || [])[ci];
      parts.push(`<rect x="${x}" y="${y}" width="${COL_W}" height="${ROW_H}" fill="${blocked ? '#d1d5db' : '#ffffff'}" stroke="#1e3a8a" />`);
      if (!blocked && nom) {
        parts.push(`<text x="${x + COL_W / 2}" y="${y + ROW_H / 2 + 5}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="12" font-weight="500" fill="#111827">${escapeXml(nom)}</text>`);
      }
    });
  });

  parts.push(`<text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-family="${EXPORT_FONT}" font-size="10" font-style="italic" fill="#6b7280">Planning événement — PAV Manager</text>`);
  parts.push('</svg>');
  return { svg: parts.join(''), width, height };
}

const emptyCreateForm = () => ({ titre: '', date_debut: todayIso(), date_fin: todayIso() });

// Plannings événements : plannings ponctuels/exceptionnels (dates libres, pas
// forcément vendredi/dimanche), accessibles depuis un bouton "Planning
// événement" dans Planning générale plutôt qu'un onglet séparé. Reprend les
// mêmes options annexes que le planning équipe : grille rôle x date,
// case grisée/indisponible, export PNG, impression, édition libre du nombre
// de colonnes (dates).
export default function PlanningEvenementSection({ onBack, technicienNames = [], isSuperAdmin }) {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [events, setEvents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [creating, setCreating] = useState(false);

  const [current, setCurrent] = useState(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [newDateInput, setNewDateInput] = useState(todayIso());

  const fetchEvents = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await axios.get(`${API}/planning-evenements`);
      setEvents(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement des plannings événements');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { if (view === 'list') fetchEvents(); }, [view, fetchEvents]);

  const openEditor = async (id) => {
    setView('editor');
    setLoadingEditor(true);
    try {
      const res = await axios.get(`${API}/planning-evenements/${id}`);
      setCurrent({ ...res.data, roles: res.data.roles || [], affectations: res.data.affectations || {}, blocked_cells: res.data.blocked_cells || {}, dates: res.data.dates || [] });
    } catch (err) {
      toast.error("Erreur lors du chargement de l'événement");
      setView('list');
    } finally {
      setLoadingEditor(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.titre.trim()) { toast.error('Titre requis'); return; }
    if (!createForm.date_debut || !createForm.date_fin || createForm.date_fin < createForm.date_debut) {
      toast.error('Plage de dates invalide'); return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${API}/planning-evenements`, {
        titre: createForm.titre.trim(),
        date_debut: createForm.date_debut,
        date_fin: createForm.date_fin,
        dates: dateRangeInclusive(createForm.date_debut, createForm.date_fin),
        roles: [],
        affectations: {},
        blocked_cells: {},
      });
      toast.success('Planning événement créé');
      setCreateOpen(false);
      setCreateForm(emptyCreateForm());
      openEditor(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (ev) => {
    if (!window.confirm(`Archiver le planning événement "${ev.titre}" ?`)) return;
    try {
      await axios.put(`${API}/planning-evenements/${ev.id}/archive`);
      toast.success('Archivé');
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'archivage");
    }
  };

  // ---- Editor helpers ----
  const addRole = () => {
    if (!newRoleLabel.trim()) return;
    const key = slugify(newRoleLabel);
    if (current.roles.some((r) => r.key === key)) { toast.error('Un rôle avec ce nom existe déjà'); return; }
    setCurrent((prev) => ({ ...prev, roles: [...prev.roles, { key, label: newRoleLabel.trim(), slots: 1 }] }));
    setNewRoleLabel('');
  };
  const removeRole = (key) => setCurrent((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.key !== key) }));
  const setSlots = (key, slots) => {
    const n = Math.max(1, Math.min(10, parseInt(slots, 10) || 1));
    setCurrent((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.key === key ? { ...r, slots: n } : r)) }));
  };
  const setCell = (affKey, dateIdx, value) => {
    setCurrent((prev) => {
      const arr = [...(prev.affectations[affKey] || [])];
      arr[dateIdx] = value;
      return { ...prev, affectations: { ...prev.affectations, [affKey]: arr } };
    });
  };
  const cellClick = (affKey, dateIdx) => {
    if (!blockMode) return;
    setCurrent((prev) => {
      const arr = [...(prev.blocked_cells[affKey] || [])];
      arr[dateIdx] = !arr[dateIdx];
      return { ...prev, blocked_cells: { ...prev.blocked_cells, [affKey]: arr } };
    });
  };
  const addDate = () => {
    if (!newDateInput) return;
    setCurrent((prev) => {
      if (prev.dates.includes(newDateInput)) { toast.error('Cette date existe déjà'); return prev; }
      return { ...prev, dates: [...prev.dates, newDateInput].sort() };
    });
  };
  const removeDate = (idx) => {
    setCurrent((prev) => {
      const dates = prev.dates.filter((_, i) => i !== idx);
      const strip = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, arr]) => [k, (arr || []).filter((_, i) => i !== idx)]));
      return { ...prev, dates, affectations: strip(prev.affectations), blocked_cells: strip(prev.blocked_cells) };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        titre: current.titre,
        date_debut: current.date_debut,
        date_fin: current.date_fin,
        dates: current.dates,
        roles: current.roles,
        affectations: current.affectations,
        blocked_cells: current.blocked_cells,
        notes: current.notes || null,
      };
      const res = await axios.put(`${API}/planning-evenements/${current.id}`, payload);
      setCurrent({ ...res.data, roles: res.data.roles || [], affectations: res.data.affectations || {}, blocked_cells: res.data.blocked_cells || {}, dates: res.data.dates || [] });
      toast.success('Enregistré');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => setTimeout(() => window.print(), 50);

  const handleExportPng = async () => {
    // Must happen synchronously, before any `await` below, or Safari on iOS
    // silently blocks the fallback tab (see utils/fileDownload.js).
    const preOpenedWindow = reserveTabForIOSFallback();
    setExportingPng(true);
    try {
      const { svg, width, height } = buildEvenementExportSVG({
        titre: current.titre,
        dates: current.dates,
        roles: current.roles,
        affectations: current.affectations,
        blockedCells: current.blocked_cells,
      });
      const { dataUrl } = await svgToPngDataUrl(svg, width, height, 2);
      const filename = `planning-evenement-${slugify(current.titre)}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const status = await downloadOrShareFile(blob, filename, { title: filename, preOpenedWindow });
      const msg = downloadStatusMessage(status);
      if (status === 'blocked') toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export PNG");
    } finally {
      setExportingPng(false);
    }
  };

  const statusBadge = (ev) => {
    const today = todayIso();
    if (ev.date_fin < today) return <Badge variant="outline">Terminé</Badge>;
    if (ev.date_debut > today) return <Badge className="bg-blue-100 text-blue-800">À venir</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-800">En cours</Badge>;
  };

  // ==================== VUE LISTE ====================
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-1 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour au planning générale
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PartyPopper className="w-6 h-6" /> Plannings événements
            </h1>
            <p className="text-muted-foreground">Plannings ponctuels en dehors du rythme habituel (vendredi/dimanche).</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau planning événement
          </Button>
        </div>

        {loadingList ? (
          <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : events.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Aucun planning événement pour le moment.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <Card key={ev.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{ev.titre}</p>
                      {statusBadge(ev)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ev.date_debut === ev.date_fin
                        ? new Date(`${ev.date_debut}T00:00:00`).toLocaleDateString('fr-FR')
                        : `${new Date(`${ev.date_debut}T00:00:00`).toLocaleDateString('fr-FR')} → ${new Date(`${ev.date_fin}T00:00:00`).toLocaleDateString('fr-FR')}`}
                      {' · '}{(ev.dates || []).length} date(s) · {(ev.roles || []).length} rôle(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEditor(ev.id)} title="Ouvrir">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {isSuperAdmin && isSuperAdmin() && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleArchive(ev)} title="Archiver">
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau planning événement</DialogTitle>
              <DialogDescription>Donne un titre et une plage de dates de départ — tu pourras ajouter/retirer des dates précises ensuite.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Titre</Label>
                <Input value={createForm.titre} onChange={(e) => setCreateForm((p) => ({ ...p, titre: e.target.value }))} placeholder="Ex: Soirée spéciale" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date de début</Label>
                  <Input type="date" value={createForm.date_debut} onChange={(e) => setCreateForm((p) => ({ ...p, date_debut: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Date de fin</Label>
                  <Input type="date" value={createForm.date_fin} onChange={(e) => setCreateForm((p) => ({ ...p, date_fin: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== VUE ÉDITEUR ====================
  if (loadingEditor || !current) {
    return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
  }

  return (
    <div className="space-y-4" data-testid="planning-evenement-editor">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #evenement-print-area, #evenement-print-area * { visibility: visible; }
          #evenement-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setView('list')} className="mb-1 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour à la liste
          </Button>
          <Input
            value={current.titre}
            onChange={(e) => setCurrent((p) => ({ ...p, titre: e.target.value }))}
            className="text-xl font-bold h-auto py-1 px-2 max-w-md"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none">
            <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Imprimer</span>
          </Button>
          <Button variant="outline" onClick={handleExportPng} disabled={exportingPng} className="flex-1 sm:flex-none">
            {exportingPng ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 sm:mr-2" />}
            <span className="hidden sm:inline">Enregistrer en PNG</span>
          </Button>
          <Button variant="outline" onClick={() => setEditDatesOpen(true)} className="flex-1 sm:flex-none">
            <CalendarPlus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Éditer dates</span>
          </Button>
          <Button
            variant={blockMode ? 'default' : 'outline'}
            onClick={() => setBlockMode((v) => !v)}
            className="flex-1 sm:flex-none"
          >
            <Ban className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">{blockMode ? 'Terminer' : 'Griser une case'}</span>
          </Button>
          {isSuperAdmin && isSuperAdmin() && (
            <Button variant="outline" className="flex-1 sm:flex-none text-destructive hover:text-destructive" onClick={() => handleArchive(current)}>
              <Archive className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Archiver</span>
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
            {saving ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Save className="w-4 h-4 sm:mr-2" />}
            <span className="hidden sm:inline">Enregistrer</span>
          </Button>
        </div>
      </div>

      {blockMode && (
        <p className="text-sm text-muted-foreground print:hidden">Clique sur une case pour la griser / dégriser.</p>
      )}

      <div id="evenement-print-area">
        <div className="flex items-end gap-2 print:hidden mb-2">
          <div className="flex-1 space-y-1.5">
            <Label>Ajouter un rôle</Label>
            <Input
              value={newRoleLabel}
              onChange={(e) => setNewRoleLabel(e.target.value)}
              placeholder="Ex: Régisseur, Caméra, Accueil..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
            />
          </div>
          <Button variant="outline" onClick={addRole}><Plus className="w-4 h-4 mr-2" /> Ajouter un rôle</Button>
        </div>

        {current.roles.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Ajoute un rôle pour commencer à remplir ce planning.</CardContent></Card>
        ) : current.dates.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Ajoute au moins une date via "Éditer dates" pour voir la grille.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="text-sm w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-left font-medium sticky left-0 bg-muted/50 border border-border">Rôle</th>
                    {current.dates.map((d) => (
                      <th key={d} className="p-2 text-center font-medium whitespace-nowrap border border-border">
                        {fmtDateShort(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.roles.map((role) => (
                    Array.from({ length: role.slots }).map((_, slotIdx) => {
                      const affKey = `${role.key}_${slotIdx}`;
                      return (
                        <tr key={affKey}>
                          <td className="p-2 sticky left-0 bg-background border border-border">
                            <div className="flex items-center gap-1.5 print:block">
                              <span className="font-medium">{role.label}{role.slots > 1 ? ` #${slotIdx + 1}` : ''}</span>
                              {slotIdx === 0 && (
                                <span className="flex items-center gap-1 print:hidden">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={role.slots}
                                    onChange={(e) => setSlots(role.key, e.target.value)}
                                    className="w-14 h-7 text-xs"
                                    title="Nombre de postes"
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeRole(role.key)} title="Supprimer ce rôle">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </span>
                              )}
                            </div>
                          </td>
                          {current.dates.map((d, dateIdx) => {
                            const blocked = !!(current.blocked_cells[affKey] || [])[dateIdx];
                            return (
                              <td
                                key={d}
                                className={`p-1 text-center border border-border ${blockMode ? 'cursor-pointer' : ''}`}
                                onClick={() => cellClick(affKey, dateIdx)}
                              >
                                {blocked ? (
                                  <span className="w-full h-7 block bg-gray-300 dark:bg-gray-600 print:bg-gray-300 rounded" />
                                ) : (
                                  <input
                                    list="evenement-tech-list"
                                    disabled={blockMode}
                                    value={current.affectations[affKey]?.[dateIdx] || ''}
                                    onChange={(e) => setCell(affKey, dateIdx, e.target.value)}
                                    className="w-28 text-xs border border-transparent rounded px-1.5 py-1 bg-transparent focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
                                    placeholder="—"
                                  />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ))}
                </tbody>
              </table>
              <datalist id="evenement-tech-list">
                {technicienNames.map((n) => <option key={n} value={n} />)}
              </datalist>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editDatesOpen} onOpenChange={setEditDatesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Éditer les dates</DialogTitle>
            <DialogDescription>Ajoute ou retire librement des colonnes de dates — elles n'ont pas besoin de se suivre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>Ajouter une date</Label>
                <Input type="date" value={newDateInput} onChange={(e) => setNewDateInput(e.target.value)} />
              </div>
              <Button variant="outline" onClick={addDate}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {current.dates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune date pour le moment.</p>
              ) : current.dates.map((d, idx) => (
                <div key={d} className="flex items-center justify-between gap-2 border rounded-md px-3 py-1.5">
                  <span className="text-sm capitalize">{fmtDateShort(d)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeDate(idx)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setEditDatesOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
