import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import {
  Loader2, Plus, Trash2, PartyPopper, Pencil, Archive, ArrowLeft, Printer,
  ImageDown, Ban, Columns3, Save, Copy, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { downloadOrShareFile, downloadStatusMessage, reserveTabForIOSFallback } from '../utils/fileDownload';
import {
  EVENT_TEMPLATES, CATEGORIES, buildStructure, structureFromMainPlanning, emptyStructure,
  groupRoles, colsToIds, idsToCols, slugify, todayIso, fmtDateLong,
} from './evenementTemplates';
import { buildEvenementExportSVG, svgToPngDataUrl, PEACH, PEACH_BAND, PEACH_TEXT } from './evenementExport';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function shortDate(iso) {
  return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR');
}

// Bannière flottante en haut de l'écran : rappelle qu'on travaille sur un
// planning événement (et non sur le planning vendredi/dimanche).
function FloatingBanner({ children, tone = 'amber' }) {
  const cls = tone === 'amber'
    ? 'bg-amber-400 text-amber-950 border-amber-600'
    : 'bg-[#FCE4D6] text-[#7a3a0c] border-[#C55A11]';
  return (
    <div
      className={`fixed top-0 inset-x-0 z-[100] border-b-2 px-3 py-2 text-sm font-medium shadow-lg print:hidden ${cls}`}
      role="status"
      data-testid="evenement-banner"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

const apiToCurrent = (d) => ({
  id: d.id,
  titre: d.titre,
  rdv: d.rdv || '',
  modele: d.modele || null,
  notes: d.notes || '',
  cols: idsToCols(d.dates, d.col_labels),
  roles: d.roles || [],
  sections: d.sections || [],
  affectations: d.affectations || {},
  blocked_cells: d.blocked_cells || {},
});

const currentToPayload = (c) => {
  const n = c.cols.length;
  const ids = colsToIds(c.cols);
  const fill = (obj, empty) => Object.fromEntries(
    Object.entries(obj || {}).map(([k, arr]) => [k, Array.from({ length: n }, (_, i) => (arr || [])[i] ?? empty)]),
  );
  const sortedDates = c.cols.map((x) => x.date).sort();
  return {
    titre: c.titre,
    date_debut: sortedDates[0],
    date_fin: sortedDates[sortedDates.length - 1],
    dates: ids,
    roles: c.roles,
    affectations: fill(c.affectations, ''),
    blocked_cells: Object.fromEntries(Object.entries(fill(c.blocked_cells, false)).map(([k, a]) => [k, a.map(Boolean)])),
    notes: c.notes || null,
    sections: c.sections,
    col_labels: Object.fromEntries(c.cols.map((x, i) => [ids[i], x.label || '']).filter(([, l]) => l)),
    rdv: c.rdv || null,
    modele: c.modele || null,
  };
};

// ---------------------------------------------------------------------
// Popup de création : choix du modèle + sélections avant de générer la grille
// ---------------------------------------------------------------------
function NewEvenementWizard({ open, onClose, onCreated, defaultSections }) {
  const [modelKey, setModelKey] = useState(EVENT_TEMPLATES[0].key);
  const [titre, setTitre] = useState(EVENT_TEMPLATES[0].titre);
  const [rdv, setRdv] = useState(EVENT_TEMPLATES[0].rdv);
  const [cols, setCols] = useState([{ date: todayIso(), label: '' }]);
  const [cats, setCats] = useState({ regie: true, cadreurs: true, regisseurs: true, diffusion: true });
  const [cameras, setCameras] = useState(7);
  const [camDouble, setCamDouble] = useState(7);
  const [postes, setPostes] = useState(6);
  const [mainSections, setMainSections] = useState(null);
  const [creating, setCreating] = useState(false);

  const isMain = modelKey === 'main_vendredi' || modelKey === 'main_dimanche';
  const isBlank = modelKey === 'blank';
  const tpl = EVENT_TEMPLATES.find((t) => t.key === modelKey);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const now = new Date();
    axios.get(`${API}/planning/${now.getFullYear()}/${now.getMonth() + 1}`)
      .then((r) => { if (alive) setMainSections(r.data?.sections || {}); })
      .catch(() => { if (alive) setMainSections({}); });
    return () => { alive = false; };
  }, [open]);

  const pick = (key) => {
    setModelKey(key);
    const t = EVENT_TEMPLATES.find((x) => x.key === key);
    if (t) {
      setTitre(t.titre);
      setRdv(t.rdv);
      setCols((prev) => t.colonnes.map((c, i) => ({ date: prev[i]?.date || prev[0]?.date || todayIso(), label: c.label })));
      setCameras(t.cameras.count);
      setCamDouble(t.cameras.doubleUntil);
      setPostes(t.postes);
    } else if (key === 'main_vendredi') {
      setTitre('PLANNING VENDREDI');
      setRdv('');
      setCols((prev) => [{ date: prev[0]?.date || todayIso(), label: '' }]);
    } else if (key === 'main_dimanche') {
      setTitre('PLANNING DIMANCHE');
      setRdv('');
      setCols((prev) => [{ date: prev[0]?.date || todayIso(), label: '' }]);
    } else {
      setTitre('');
      setRdv('');
      setCols((prev) => [{ date: prev[0]?.date || todayIso(), label: '' }]);
    }
  };

  const setColCount = (n) => {
    const count = Math.max(1, Math.min(8, parseInt(n, 10) || 1));
    setCols((prev) => Array.from({ length: count }, (_, i) => prev[i] || { date: prev[prev.length - 1]?.date || todayIso(), label: '' }));
  };
  const setCol = (i, patch) => setCols((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const structure = () => {
    if (isMain) {
      const day = modelKey === 'main_vendredi' ? 'vendredi' : 'dimanche';
      const sec = (mainSections && mainSections[day]) || (defaultSections && defaultSections[day]);
      return sec ? structureFromMainPlanning(sec) : emptyStructure();
    }
    if (isBlank) return emptyStructure();
    return buildStructure(tpl, { categories: cats, cameras, camerasDoubles: camDouble, postes });
  };

  const summary = `${isBlank ? 'Planning vierge' : isMain ? (modelKey === 'main_vendredi' ? 'Copie du planning vendredi' : 'Copie du planning dimanche') : `Modèle « ${tpl.nom} »`} · ${cols.length} colonne${cols.length > 1 ? 's' : ''}`;

  const handleCreate = async () => {
    if (!titre.trim()) { toast.error('Titre requis'); return; }
    if (cols.some((c) => !c.date)) { toast.error('Chaque colonne a besoin d\'une date'); return; }
    setCreating(true);
    try {
      const { sections, roles } = structure();
      const draft = {
        titre: titre.trim(), rdv: rdv.trim(), modele: modelKey, notes: '',
        cols, roles, sections, affectations: {}, blocked_cells: {},
      };
      const res = await axios.post(`${API}/planning-evenements`, currentToPayload(draft));
      toast.success('Planning événement créé');
      onCreated(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const modelCards = [
    ...EVENT_TEMPLATES.map((t) => ({ key: t.key, nom: t.nom, desc: t.description })),
    { key: 'main_vendredi', nom: 'Copie du planning vendredi', desc: 'Reprend les catégories et postes du planning du vendredi.' },
    { key: 'main_dimanche', nom: 'Copie du planning dimanche', desc: 'Reprend les catégories et postes du planning du dimanche.' },
    { key: 'blank', nom: 'Planning vierge', desc: 'Vous ajoutez vous-même les catégories et les postes.' },
  ];

  return (
    <>
      {open && (
        <FloatingBanner>
          <strong>Attention :</strong> vous êtes en train de créer un <strong>planning événement</strong> ({summary}).
          Il est indépendant du planning vendredi/dimanche : aucune modification ne touchera le planning habituel.
        </FloatingBanner>
      )}
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-3xl top-[54%] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Nouveau planning événement</DialogTitle>
            <DialogDescription>
              Choisissez un modèle puis ajustez les colonnes et les catégories : la grille est générée telle que dans le classeur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="evenement-models">
              {modelCards.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => pick(m.key)}
                  className={`rounded-lg border-2 p-3 text-left transition ${modelKey === m.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  data-testid={`evenement-model-${m.key}`}
                >
                  <p className="font-semibold text-sm">{m.nom}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Titre du planning</Label>
                <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex : FESTIVAL DES JEUNES" />
              </div>
              <div className="space-y-1.5">
                <Label>Rendez-vous (optionnel)</Label>
                <Input value={rdv} onChange={(e) => setRdv(e.target.value)} placeholder="Ex : RDV à 13h00 en salle 114" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Label>Colonnes (dates / moments)</Label>
                <Input type="number" min={1} max={8} value={cols.length} onChange={(e) => setColCount(e.target.value)} className="w-20 h-8" />
              </div>
              {cols.map((c, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-2 items-start rounded-md border p-2">
                  <Input type="date" value={c.date} onChange={(e) => setCol(i, { date: e.target.value })} />
                  <Textarea
                    rows={2}
                    value={c.label}
                    onChange={(e) => setCol(i, { label: e.target.value })}
                    placeholder={`Texte sous la date (ex : Concert) — colonne ${i + 1}`}
                    className="min-h-0"
                  />
                </div>
              ))}
            </div>

            {!isMain && !isBlank && (
              <div className="space-y-3">
                <Label>Catégories à inclure</Label>
                <div className="flex flex-wrap gap-4">
                  {CATEGORIES.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!cats[c.id]} onChange={(e) => setCats((p) => ({ ...p, [c.id]: e.target.checked }))} />
                      {c.name}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre de caméras</Label>
                    <Input type="number" min={0} max={12} value={cameras} onChange={(e) => setCameras(Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0)))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Caméras avec assistant (jusqu'à la n°)</Label>
                    <Input type="number" min={0} max={12} value={camDouble} onChange={(e) => setCamDouble(Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0)))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Postes régisseurs</Label>
                    <Input type="number" min={0} max={8} value={postes} onChange={(e) => setPostes(Math.max(0, Math.min(8, parseInt(e.target.value, 10) || 0)))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={creating}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating} data-testid="evenement-create">
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer le planning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Plannings événements : plannings ponctuels/exceptionnels, accessibles
// depuis le bouton "Planning événement" du planning général. Reprend les
// trois modèles du classeur (ONE SOUND, Festival des enfants, Festival des
// jeunes) avec la même mise en page que le planning vendredi/dimanche, en
// plus compact : une colonne de postes et une ou plusieurs colonnes de dates.
export default function PlanningEvenementSection({ onBack, technicienNames = [], isSuperAdmin, defaultSections }) {
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [events, setEvents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const [current, setCurrent] = useState(null);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [newPoste, setNewPoste] = useState({});
  const [newCategorie, setNewCategorie] = useState('');

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
    setWizardOpen(false);
    setView('editor');
    setLoadingEditor(true);
    try {
      const res = await axios.get(`${API}/planning-evenements/${id}`);
      setCurrent(apiToCurrent(res.data));
    } catch (err) {
      toast.error("Erreur lors du chargement de l'événement");
      setView('list');
    } finally {
      setLoadingEditor(false);
    }
  };

  const handleArchive = async (ev) => {
    if (!window.confirm(`Archiver le planning événement "${ev.titre}" ?`)) return;
    try {
      await axios.put(`${API}/planning-evenements/${ev.id}/archive`);
      toast.success('Archivé');
      if (view === 'editor') setView('list'); else fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'archivage");
    }
  };

  // Duplique un planning événement existant (même grille, mêmes affectations).
  const duplicatePayload = async (payload) => {
    try {
      const res = await axios.post(`${API}/planning-evenements`, { ...payload, titre: `${payload.titre} (copie)` });
      toast.success('Planning dupliqué');
      openEditor(res.data.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la duplication');
    }
  };

  // ---- Éditeur ----
  const update = (patch) => setCurrent((p) => ({ ...p, ...patch }));

  const setCell = (affKey, ci, value) => {
    setCurrent((prev) => {
      const arr = [...(prev.affectations[affKey] || [])];
      arr[ci] = value;
      return { ...prev, affectations: { ...prev.affectations, [affKey]: arr } };
    });
  };
  const cellClick = (affKey, ci) => {
    if (!blockMode) return;
    setCurrent((prev) => {
      const arr = [...(prev.blocked_cells[affKey] || [])];
      arr[ci] = !arr[ci];
      return { ...prev, blocked_cells: { ...prev.blocked_cells, [affKey]: arr } };
    });
  };

  const addPoste = (sectionKey) => {
    const label = (newPoste[sectionKey] || '').trim();
    if (!label) return;
    setCurrent((prev) => {
      let key = slugify(label);
      const taken = new Set(prev.roles.map((r) => r.key));
      let n = 1;
      const base = key;
      while (taken.has(key)) { n += 1; key = `${base}_${n}`; }
      const role = { key, label, slots: 1, ...(sectionKey && sectionKey !== '__legacy' ? { section: sectionKey } : {}) };
      // insère à la fin de sa catégorie pour garder l'ordre d'affichage
      let at = -1;
      prev.roles.forEach((r, i) => { if ((r.section || '__legacy') === (sectionKey || '__legacy')) at = i; });
      const roles = [...prev.roles];
      roles.splice(at === -1 ? roles.length : at + 1, 0, role);
      return { ...prev, roles };
    });
    setNewPoste((p) => ({ ...p, [sectionKey]: '' }));
  };
  const removeRole = (key) => setCurrent((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.key !== key) }));
  const renameRole = (key, label) => setCurrent((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.key === key ? { ...r, label } : r)) }));
  const setSlots = (key, slots) => {
    const n = Math.max(1, Math.min(10, parseInt(slots, 10) || 1));
    setCurrent((prev) => ({ ...prev, roles: prev.roles.map((r) => (r.key === key ? { ...r, slots: n } : r)) }));
  };
  const addCategorie = () => {
    const name = newCategorie.trim();
    if (!name) return;
    setCurrent((prev) => {
      const base = slugify(name);
      let key = base;
      let n = 1;
      const taken = new Set((prev.sections || []).map((s) => s.key));
      while (taken.has(key)) { n += 1; key = `${base}_${n}`; }
      // les rôles d'un ancien planning (sans catégorie) restent dans une catégorie sans titre
      const hadSections = (prev.sections || []).length > 0;
      const sections = hadSections ? [...prev.sections] : [{ key: '__legacy', name: '', standalone: true }];
      const roles = hadSections ? prev.roles : prev.roles.map((r) => ({ ...r, section: '__legacy' }));
      return { ...prev, sections: [...sections, { key, name }], roles };
    });
    setNewCategorie('');
  };

  // Colonnes (positions alignées sur les tableaux d'affectations)
  const mapArrays = (obj, fn) => Object.fromEntries(Object.entries(obj || {}).map(([k, a]) => [k, fn([...(a || [])])]));
  const addCol = () => setCurrent((p) => ({ ...p, cols: [...p.cols, { date: p.cols[p.cols.length - 1]?.date || todayIso(), label: '' }] }));
  const duplicateCol = (i) => setCurrent((p) => {
    const dup = (a) => { a.splice(i + 1, 0, a[i] ?? ''); return a; };
    const dupB = (a) => { a.splice(i + 1, 0, !!a[i]); return a; };
    const cols = [...p.cols];
    cols.splice(i + 1, 0, { ...p.cols[i] });
    return { ...p, cols, affectations: mapArrays(p.affectations, dup), blocked_cells: mapArrays(p.blocked_cells, dupB) };
  });
  const removeCol = (i) => {
    if (current.cols.length <= 1) { toast.error('Il faut au moins une colonne'); return; }
    setCurrent((p) => {
      const cut = (a) => { a.splice(i, 1); return a; };
      return { ...p, cols: p.cols.filter((_, idx) => idx !== i), affectations: mapArrays(p.affectations, cut), blocked_cells: mapArrays(p.blocked_cells, cut) };
    });
  };
  const moveCol = (i, dir) => setCurrent((p) => {
    const j = i + dir;
    if (j < 0 || j >= p.cols.length) return p;
    const swap = (a) => { const n = Math.max(a.length, p.cols.length); while (a.length < n) a.push(''); [a[i], a[j]] = [a[j], a[i]]; return a; };
    const cols = [...p.cols];
    [cols[i], cols[j]] = [cols[j], cols[i]];
    return { ...p, cols, affectations: mapArrays(p.affectations, swap), blocked_cells: mapArrays(p.blocked_cells, swap) };
  });
  const setColField = (i, patch) => setCurrent((p) => ({ ...p, cols: p.cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

  const handleSave = async () => {
    if (!current.titre.trim()) { toast.error('Titre requis'); return; }
    setSaving(true);
    try {
      const res = await axios.put(`${API}/planning-evenements/${current.id}`, currentToPayload(current));
      setCurrent(apiToCurrent(res.data));
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
        rdv: current.rdv,
        cols: current.cols,
        sections: current.sections,
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

  const groups = useMemo(() => (current ? groupRoles(current.sections, current.roles) : []), [current]);

  // ==================== VUE LISTE ====================
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={onBack} className="mb-1 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour au planning général
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PartyPopper className="w-6 h-6" /> Plannings événements
            </h1>
            <p className="text-muted-foreground">Plannings ponctuels en dehors du rythme habituel (vendredi/dimanche).</p>
          </div>
          <Button onClick={() => setWizardOpen(true)} data-testid="evenement-new">
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
                      {ev.date_debut === ev.date_fin ? shortDate(ev.date_debut) : `${shortDate(ev.date_debut)} → ${shortDate(ev.date_fin)}`}
                      {' · '}{(ev.dates || []).length} colonne(s) · {(ev.roles || []).length} poste(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEditor(ev.id)} title="Ouvrir">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Dupliquer"
                      onClick={() => duplicatePayload({
                        titre: ev.titre, date_debut: ev.date_debut, date_fin: ev.date_fin, dates: ev.dates,
                        roles: ev.roles, affectations: ev.affectations, blocked_cells: ev.blocked_cells, notes: ev.notes,
                        sections: ev.sections, col_labels: ev.col_labels, rdv: ev.rdv, modele: ev.modele,
                      })}
                    >
                      <Copy className="w-4 h-4" />
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

        <NewEvenementWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreated={openEditor}
          defaultSections={defaultSections}
        />
      </div>
    );
  }

  // ==================== VUE ÉDITEUR ====================
  if (loadingEditor || !current) {
    return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;
  }

  const colCount = current.cols.length;
  const cellBorder = 'border border-black';

  const headerRow = (key) => (
    <tr key={key}>
      <th
        className={`${cellBorder} border-b-2 p-2 text-left font-bold text-black`}
        style={{ background: PEACH }}
      >
        AFFECTATION
      </th>
      {current.cols.map((c, ci) => (
        <th
          key={ci}
          className={`${cellBorder} border-b-2 p-1.5 text-center font-bold text-black align-top`}
          style={{ background: PEACH }}
        >
          <div>{fmtDateLong(c.date)}</div>
          {c.label ? <div className="font-normal text-xs whitespace-pre-line leading-tight mt-0.5">{c.label}</div> : null}
        </th>
      ))}
    </tr>
  );

  return (
    <div className="space-y-4 pt-24 sm:pt-14" data-testid="planning-evenement-editor">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #evenement-print-area, #evenement-print-area * { visibility: visible; }
          #evenement-print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <FloatingBanner tone="peach">
        <strong>Planning événement</strong> — « {current.titre || 'sans titre'} » · {colCount} colonne{colCount > 1 ? 's' : ''}.
        Ce planning est indépendant du planning vendredi/dimanche.
      </FloatingBanner>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setView('list')} className="mb-1 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Retour à la liste
          </Button>
          <Input
            value={current.titre}
            onChange={(e) => update({ titre: e.target.value })}
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
          <Button variant="outline" onClick={() => setColsOpen(true)} className="flex-1 sm:flex-none" data-testid="evenement-columns">
            <Columns3 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Colonnes</span>
          </Button>
          <Button variant={blockMode ? 'default' : 'outline'} onClick={() => setBlockMode((v) => !v)} className="flex-1 sm:flex-none">
            <Ban className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">{blockMode ? 'Terminer' : 'Griser une case'}</span>
          </Button>
          <Button variant="outline" onClick={() => duplicatePayload(currentToPayload(current))} className="flex-1 sm:flex-none">
            <Copy className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Dupliquer</span>
          </Button>
          {isSuperAdmin && isSuperAdmin() && (
            <Button variant="outline" className="flex-1 sm:flex-none text-destructive hover:text-destructive" onClick={() => handleArchive(current)}>
              <Archive className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Archiver</span>
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none" data-testid="evenement-save">
            {saving ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Save className="w-4 h-4 sm:mr-2" />}
            <span className="hidden sm:inline">Enregistrer</span>
          </Button>
        </div>
      </div>

      {blockMode && (
        <p className="text-sm text-muted-foreground print:hidden">Clique sur une case pour la griser / dégriser.</p>
      )}

      <div className="flex items-center gap-2 print:hidden">
        <Label className="shrink-0">Rendez-vous</Label>
        <Input value={current.rdv} onChange={(e) => update({ rdv: e.target.value })} placeholder="Ex : RDV à 13h00 en salle 114" className="max-w-md" />
      </div>

      <div id="evenement-print-area" className="max-w-5xl">
        <h2 className="text-center text-3xl font-bold mb-1" style={{ color: PEACH_TEXT }}>{current.titre}</h2>
        {current.rdv ? (
          <div className="border border-black text-center text-lg py-1 mb-2 text-black" style={{ background: PEACH }}>{current.rdv}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm border-2 border-black" style={{ tableLayout: 'fixed', minWidth: `${250 + colCount * 150}px` }}>
            <colgroup>
              <col style={{ width: '250px' }} />
              {current.cols.map((_, i) => <col key={i} />)}
            </colgroup>
            <thead>{current.cols.length > 0 && headerRow('head-0')}</thead>
            <tbody>
              {groups.map((g, gi) => (
                <React.Fragment key={g.key}>
                  {g.repeat_header && gi > 0 && (
                    <>
                      <tr><td colSpan={colCount + 1} className="h-3 border-0 bg-transparent" /></tr>
                      {headerRow(`head-${g.key}`)}
                    </>
                  )}
                  {g.name && !g.standalone && (
                    <tr>
                      <td
                        colSpan={colCount + 1}
                        className={`${cellBorder} border-b-2 p-1 text-center font-bold text-xl`}
                        style={{ background: PEACH_BAND, color: PEACH_TEXT }}
                      >
                        {g.name}
                      </td>
                    </tr>
                  )}
                  {g.roles.map((role) => (
                    Array.from({ length: role.slots || 1 }).map((_, slotIdx) => {
                      const affKey = `${role.key}_${slotIdx}`;
                      return (
                        <tr key={affKey}>
                          {slotIdx === 0 && (
                            <td
                              rowSpan={role.slots || 1}
                              className={`${cellBorder} group relative p-1.5 font-bold text-black`}
                              style={{ background: PEACH }}
                            >
                              <div className="flex items-center gap-1.5">
                                <input
                                  value={role.label}
                                  onChange={(e) => renameRole(role.key, e.target.value)}
                                  className="flex-1 min-w-0 bg-transparent font-bold focus:outline-none focus:ring-1 focus:ring-black/40 rounded px-1 print:hidden"
                                  aria-label="Nom du poste"
                                />
                                <span className="hidden print:inline flex-1">{role.label}</span>
                                <span
                                  className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-1 rounded px-1 group-hover:flex group-focus-within:flex print:!hidden"
                                  style={{ background: PEACH }}
                                >
                                  <Input
                                    type="number" min={1} max={10} value={role.slots || 1}
                                    onChange={(e) => setSlots(role.key, e.target.value)}
                                    className="w-12 h-6 text-xs px-1 bg-white text-black"
                                    title="Nombre de lignes (principal + assistants…)"
                                  />
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-destructive hover:bg-black/10" onClick={() => removeRole(role.key)} title="Supprimer ce poste">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </span>
                              </div>
                            </td>
                          )}
                          {current.cols.map((_, ci) => {
                            const blocked = !!(current.blocked_cells[affKey] || [])[ci];
                            return (
                              <td
                                key={ci}
                                className={`${cellBorder} p-0.5 text-center ${blocked ? 'bg-gray-300' : 'bg-white'} ${blockMode ? 'cursor-pointer' : ''}`}
                                onClick={() => cellClick(affKey, ci)}
                              >
                                {blocked ? (
                                  <span className="w-full h-7 block bg-gray-300" />
                                ) : (
                                  <input
                                    list="evenement-tech-list"
                                    disabled={blockMode}
                                    value={current.affectations[affKey]?.[ci] || ''}
                                    onChange={(e) => setCell(affKey, ci, e.target.value)}
                                    className="w-full text-xs uppercase text-black bg-transparent text-center px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
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
                  {(!g.standalone || !g.name) && (
                  <tr className="print:hidden">
                    <td colSpan={colCount + 1} className="border border-dashed border-border bg-background p-1">
                      <div className="flex items-center gap-2">
                        <Input
                          value={newPoste[g.key] || ''}
                          onChange={(e) => setNewPoste((p) => ({ ...p, [g.key]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPoste(g.key); } }}
                          placeholder={`Ajouter un poste${g.name && !g.standalone ? ` à ${g.name}` : ''}…`}
                          className="h-7 text-xs max-w-xs"
                        />
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => addPoste(g.key)}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Poste
                        </Button>
                      </div>
                    </td>
                  </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <datalist id="evenement-tech-list">
            {technicienNames.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
      </div>

      <div className="flex items-center gap-2 print:hidden">
        <Input
          value={newCategorie}
          onChange={(e) => setNewCategorie(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategorie(); } }}
          placeholder="Nouvelle catégorie (ex : LUMIÈRE)"
          className="max-w-xs"
        />
        <Button variant="outline" onClick={addCategorie}><Plus className="w-4 h-4 mr-2" /> Ajouter une catégorie</Button>
      </div>

      <Dialog open={colsOpen} onOpenChange={setColsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Colonnes du planning</DialogTitle>
            <DialogDescription>
              Modifiez la date et le texte de chaque colonne, ou dupliquez-la (avec ses noms) pour créer un autre jour — vendredi, dimanche…
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {current.cols.map((c, i) => (
              <div key={i} className="rounded-md border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground w-6">#{i + 1}</span>
                  <Input type="date" value={c.date} onChange={(e) => setColField(i, { date: e.target.value })} className="w-44" />
                  <span className="text-xs text-muted-foreground hidden sm:inline">{c.date ? fmtDateLong(c.date) : ''}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => moveCol(i, -1)} title="Déplacer à gauche"><ChevronLeft className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === colCount - 1} onClick={() => moveCol(i, 1)} title="Déplacer à droite"><ChevronRight className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateCol(i)} title="Dupliquer cette colonne"><Copy className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeCol(i)} title="Supprimer cette colonne"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <Textarea rows={2} value={c.label} onChange={(e) => setColField(i, { label: e.target.value })} placeholder="Texte sous la date (ex : Concert, Ouverture : …)" className="min-h-0" />
              </div>
            ))}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={addCol}><Plus className="w-4 h-4 mr-2" /> Ajouter une colonne</Button>
            <Button onClick={() => setColsOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
