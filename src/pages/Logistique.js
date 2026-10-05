import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import SignaturePad from '../components/SignaturePad';
import RegisseurNotes from '../components/RegisseurNotes';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Plus,
  Package,
  Loader2,
  Edit,
  Archive,
  Trash2,
  Search,
  Settings,
  Tag,
  LayoutDashboard,
  ArrowRightLeft,
  StickyNote,
  Boxes,
  Contact2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ImagePlus,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  CheckSquare,
  ArchiveRestore,
  PenLine,
  X,
  Circle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  downloadOrShareFile,
  downloadStatusMessage,
  reserveTabForIOSFallback,
} from '../utils/fileDownload';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CONTACT_TYPES = ['Fournisseur', 'Location', 'Réparation'];
const POSTES_CAM = ['Caméra 1', 'Caméra 2', 'Caméra 3', 'Caméra 4', 'Caméra 5', 'Caméra 6', 'Caméra 7'];
const FREQUENCE_OPTIONS = ['Ponctuel', 'Récurrent'];

// Format des noms : toujours « Prénom Nom » propre, quelle que soit la façon
// dont le nom a été saisi dans le planning (« elder » -> « Elder »,
// « jean  wisler » -> « Jean Wisler », « Victor e » -> « Victor E. »,
// « marc-arthur » -> « Marc-Arthur »). Particules (de, du, van…) en minuscules.
const NOM_PARTICULES = new Set(['de', 'du', 'des', 'da', 'di', 'van', 'von', 'le', 'la', 'el']);
const nomKey = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const formatNom = (raw) => {
  const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((tok, i) => {
      const lower = tok.toLowerCase();
      if (i > 0 && NOM_PARTICULES.has(lower)) return lower;
      // Lettre isolée = initiale : « e » -> « E. »
      if (/^\p{L}\.?$/u.test(tok)) return `${tok[0].toUpperCase()}.`;
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
};

// Couleur d'une fiche = couleur de sa CAMÉRA (1 rouge, 2 jaune, 3 vert, 4 bleu,
// 5 gris, 6 mauve, 7 violet foncé).
const CAMERA_COULEURS = {
  1: { edge: 'border-red-500', nom: 'rouge', solid: 'bg-red-500 text-white', soft: 'bg-red-500/10', border: 'border-l-red-500', dot: 'bg-red-500' },
  2: { edge: 'border-yellow-400', nom: 'jaune', solid: 'bg-yellow-400 text-yellow-950', soft: 'bg-yellow-400/15', border: 'border-l-yellow-400', dot: 'bg-yellow-400' },
  3: { edge: 'border-green-500', nom: 'vert', solid: 'bg-green-500 text-white', soft: 'bg-green-500/10', border: 'border-l-green-500', dot: 'bg-green-500' },
  4: { edge: 'border-blue-500', nom: 'bleu', solid: 'bg-blue-500 text-white', soft: 'bg-blue-500/10', border: 'border-l-blue-500', dot: 'bg-blue-500' },
  5: { edge: 'border-gray-500', nom: 'gris', solid: 'bg-gray-500 text-white', soft: 'bg-gray-500/10', border: 'border-l-gray-500', dot: 'bg-gray-500' },
  6: { edge: 'border-purple-300', nom: 'mauve', solid: 'bg-purple-300 text-purple-950', soft: 'bg-purple-300/20', border: 'border-l-purple-300', dot: 'bg-purple-300' },
  7: { edge: 'border-violet-800', nom: 'violet foncé', solid: 'bg-violet-800 text-white', soft: 'bg-violet-800/10', border: 'border-l-violet-800', dot: 'bg-violet-800' },
};
const cameraCouleur = (poste) => {
  const n = parseInt((String(poste || '').match(/\d+/) || [''])[0], 10);
  return CAMERA_COULEURS[n] || null;
};
// Week-end : un week-end blanc, le suivant gris (alternance). Le vendredi et le
// dimanche d'un même week-end ont le même fond. Retourne 0 (blanc), 1 (gris)
// ou null pour un jour qui n'est ni vendredi ni dimanche.
const weekendParite = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const wd = new Date(y, m - 1, d).getDay();
  if (wd !== 5 && wd !== 0) return null;
  // Jour (époque) du VENDREDI du week-end : le dimanche remonte de 2 jours.
  const fridayEpochDay = Math.floor(Date.UTC(y, m - 1, d) / 86400000) - (wd === 0 ? 2 : 0);
  return Math.floor(fridayEpochDay / 7) % 2;
};

// Couleurs du Planning PAV : vendredi = bleu planning, dimanche = orange.
const jourCouleurStyle = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const wd = new Date(y, m - 1, d).getDay();
  if (wd === 5) return { background: '#A6C8EB', color: '#1F4E78', borderColor: '#1F4E78' };
  if (wd === 0) return { background: '#FCE4D6', color: '#C55A11', borderColor: '#C55A11' };
  return null;
};

// Signatures (sortie / entrée) : initiales (texte) ou dessin (image PNG).
const isDrawnSig = (v) => typeof v === 'string' && v.startsWith('data:image');
const sigText = (v) => (!v ? '' : isDrawnSig(v) ? '(signature dessinée)' : v);
const sigSummary = (s) => {
  const parts = [
    s.signature_entree && `Retour matériel : ${sigText(s.signature_entree)}`,
  ].filter(Boolean);
  if (parts.length === 0 && s.signature) return sigText(s.signature);
  return parts.join(' / ');
};

// Heures de la fiche d'un culte : saisie avec un vrai sélecteur d'heure
// (<input type="time">, "HH:MM"), enregistrée au format français déjà utilisé
// partout (« 8h30 », « 15h12 »). Les anciennes saisies libres lisibles
// (« 8h30 », « 8h », « 15:12 ») sont reprises ; une saisie illisible est
// conservée telle quelle tant qu'on ne choisit pas une nouvelle heure.
const heureToInput = (raw) => {
  const m = String(raw || '').trim().toLowerCase().match(/^(\d{1,2})\s*(?:h|:)\s*(\d{0,2})$/);
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = m[2] === '' ? 0 : parseInt(m[2], 10);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};
const heureFromInput = (value) => {
  if (!value) return '';
  const [h, m] = value.split(':');
  return `${parseInt(h, 10)}h${m}`;
};

// Photo / logo d'une fiche : si l'image ne charge pas (fichier manquant), on
// affiche une pastille avec l'icône plutôt qu'une image cassée avec son texte.
function PhotoTile({ url, alt, contain, Icon }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url || failed) {
    return (
      <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center" title={url ? `${alt} : image indisponible` : undefined}>
        <Icon className="w-5 h-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={`${process.env.REACT_APP_BACKEND_URL}${url}`}
      alt={alt}
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-12 h-12 rounded border ${contain ? 'object-contain bg-white' : 'object-cover'}`}
    />
  );
}

// Cadreurs prévus au planning pour une date : [{ label, num, names: [{ slot, nom }] }].
const extractPlanned = (pl, date) => {
  const out = [];
  ['dimanche', 'vendredi'].forEach((day) => {
    const dateIdx = ((pl.dates || {})[day] || []).indexOf(date);
    if (dateIdx < 0) return;
    const tables = (pl.sections || {})[day] || {};
    Object.values(tables).forEach((secs) =>
      (Array.isArray(secs) ? secs : []).forEach((sec) => {
        if (sec?.name !== 'CADREURS') return;
        (sec.roles || []).forEach((role) => {
          const num = parseInt((role.label || '').replace(/\D+/g, ''), 10);
          const names = [];
          for (let slot = 0; slot < (role.slots || 1); slot++) {
            const raw = (pl.affectations || {})[`${role.key}_${slot}`];
            const val = Array.isArray(raw) ? raw[dateIdx] : raw && raw[dateIdx];
            if (val && String(val).trim()) names.push({ slot, nom: String(val).trim() });
          }
          if (names.length) out.push({ label: role.label, num: Number.isNaN(num) ? null : num, names });
        });
      })
    );
  });
  out.sort((a, b) => (a.num ?? 99) - (b.num ?? 99));
  return out;
};

// Clé du week-end (date du dimanche) pour un vendredi ou un dimanche ; null sinon.
const weekendKey = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  const wd = d.getDay();
  if (wd !== 5 && wd !== 0) return null;
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (wd === 5 ? 2 : 0));
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
};

// Date de référence du week-end en cours : aujourd'hui si vendredi/samedi/dimanche, sinon le
// vendredi à venir (lundi à jeudi → le week-end qui arrive).
const nextWeekendRefDate = () => {
  const t = new Date();
  const wd = t.getDay();
  const add = wd === 6 ? -1 : wd >= 1 && wd <= 4 ? 5 - wd : 0; // samedi → vendredi
  const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Lignes d'office de l'équipe : Cadreur, Assistant, Régisseur (jamais à ajouter à la main).
const defaultEquipe = () => ['C', 'A', 'R'].map((role) => ({ role, nom: '' }));
const withDefaultEquipe = (equipe) => {
  const eq = (equipe || []).map((m) => ({ ...m }));
  ['C', 'A', 'R'].forEach((r) => {
    if (!eq.some((m) => (m.role || '').trim().toUpperCase() === r)) eq.push({ role: r, nom: '' });
  });
  return eq;
};

// Cadreurs principaux d'office par numéro de caméra (prénoms, résolus dans l'effectif).
const DEFAULT_PRINCIPAUX = { 5: ['Marc-Arthur', 'Camille'] };

// Champ nom avec suggestions filtrées par les lettres tapées (accents/casse ignorés).
// Au focus le texte est sélectionné : taper remplace le nom et la liste repart de zéro.
function NameCombobox({ value, options, labelFor, onChange, onCommit }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const q = nomKey(value);
  const shown = (options || []).filter((n) => !typed || !q || nomKey(n).includes(q)).slice(0, 40);
  return (
    <div className="relative flex-1 min-w-[140px]">
      <Input
        value={value}
        placeholder="Nom (taper pour chercher dans la liste)"
        autoComplete="off"
        onFocus={(e) => { setOpen(true); setTyped(false); e.target.select(); }}
        onChange={(e) => { setTyped(true); setOpen(true); onChange(e.target.value); }}
        onBlur={() => { setOpen(false); onCommit(value); }}
      />
      {open && shown.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {shown.map((n) => (
            <li key={n}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(n); onCommit(n); setOpen(false); setTyped(false); }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <span>{n}</span>
                {labelFor && labelFor(n) ? <span className="text-[10px] text-primary">{labelFor(n)}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Logistique({ kioskMode = false }) {
  const { canManage, isAdmin, isSuperAdmin, user } = useAuth();
  const [subTab, setSubTab] = useState(kioskMode ? 'entrees-sorties' : 'dashboard');
  const [exportingXlsx, setExportingXlsx] = useState(false); // #578
  const [exportingPdf, setExportingPdf] = useState(false); // #578
  // Export avec sélection : quoi exporter (sections) et quelle période pour les Entrées/Sorties.
  const exportScopeRef = useRef(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSel, setExportSel] = useState({
    format: 'xlsx', year: 'all', month: 'all', poste: 'all',
    sections: { seances: true, materiel: false, contact: false, incidents: false },
  });

  // ---------- Shared / Materiel state ----------
  const [materiel, setMateriel] = useState([]);
  const [enums, setEnums] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('all');
  // Vue « Archivés » de l'inventaire : liste séparée, chargée à la demande.
  const [showArchivedMat, setShowArchivedMat] = useState(false);
  const [archivedMateriel, setArchivedMateriel] = useState([]);
  const [form, setForm] = useState({
    nom: '',
    categorie: '',
    quantite: 1,
    numero_serie: '',
    marque: '',
    modele: '',
    statut: 'Disponible',
    notes: '',
    salle: '',
    groupe: '',
    date_achat: '',
    etat: '',
    reference: '',
    photo_url: ''
  });
  const [uploadingMatPhoto, setUploadingMatPhoto] = useState(false);
  const [uploadingContactPhoto, setUploadingContactPhoto] = useState(false);

  // ---------- Seances (Entrees / Sorties) state ----------
  const [seances, setSeances] = useState([]);
  const [seanceDialogOpen, setSeanceDialogOpen] = useState(false);
  const [seanceEditingId, setSeanceEditingId] = useState(null);
  const [seanceSubmitting, setSeanceSubmitting] = useState(false);
  const [expandedSeance, setExpandedSeance] = useState(null);
  // Recherche + regroupement par année (demande 28/09/2026) : avec des
  // centaines de fiches pré-remplies par poste, une liste plate est
  // illisible. On regroupe par année (repliable, année en cours ouverte
  // par défaut) et on ajoute une recherche libre (date, superviseur, nom
  // d'équipe, signature) qui traverse tous les postes/années d'un coup.
  const [seanceSearch, setSeanceSearch] = useState('');
  // Ouverture/fermeture explicite par clé (true/false) ; sans entrée, valeur par défaut.
  const [yearOv, setYearOv] = useState({});
  // Garde-fou : après la fermeture d'une fenêtre (Radix), le <body> peut rester
  // en pointer-events:none et ignorer les touches « de temps en temps » (iPad).
  useEffect(() => {
    const unlock = () => {
      if (document.body.style.pointerEvents === 'none' && !document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
        document.body.style.pointerEvents = '';
      }
    };
    document.addEventListener('pointerdown', unlock, true);
    return () => document.removeEventListener('pointerdown', unlock, true);
  }, []);
  const CURRENT_YEAR_STR = String(new Date().getFullYear());
  const isYearOpen = (key, year) =>
    key in yearOv ? yearOv[key] : year === CURRENT_YEAR_STR;
  // Un clic ouvre/ferme l'année ; en ouvrant, les autres années du même poste
  // se referment (accordéon).
  // Quand l'ouverture d'un titre referme d'autres blocs situés au-dessus, la page
  // se décale et le titre touché « file » sous le doigt : on le garde à l'écran.
  const keepInView = (el) => {
    if (!el || !el.scrollIntoView) return;
    requestAnimationFrame(() => requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' })));
  };
  // Le clic donne l'état voulu (« ouvrir » ou « fermer ») calculé à partir de ce
  // qui est affiché, au lieu d'inverser un état interne : plus de décalage possible
  // entre l'affichage et le basculement. Un 2e clic reçu dans les 350 ms sur le
  // même titre (double événement tactile) est ignoré.
  const lastToggleRef = useRef({ key: '', t: 0 });
  const dedupe = (key) => {
    const now = Date.now();
    if (lastToggleRef.current.key === key && now - lastToggleRef.current.t < 350) return true;
    lastToggleRef.current = { key, t: now };
    return false;
  };
  const setYearOpen = (poste, year, nextOpen, el) => {
    const key = `${poste}__${year}`;
    if (dedupe(`y:${key}`)) return;
    keepInView(el);
    const siblings = (yearsByPoste.get(poste) || []).filter((y) => y !== year);
    setYearOv((prev) => {
      const next = { ...prev, [key]: nextOpen };
      if (nextOpen) siblings.forEach((y) => { next[`${poste}__${y}`] = false; });
      return next;
    });
  };
  // Fix 28/09/2026 (retour utilisateur : "pas user friendly", "je ne vois
  // plus le contenu") : un 2e niveau de regroupement par MOIS sous chaque
  // année (mois en cours ouvert par défaut, comme l'année), pour retrouver
  // une fiche en 3 clics (année → mois → jour) au lieu de scroller une
  // longue liste. + un repère visuel "Vide"/"Rempli" par fiche pour que les
  // dizaines de fiches auto-générées encore vides ne donnent plus
  // l'impression que les vraies données (import Excel) ont disparu.
  const MOIS_NOMS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  // Mois affiché par (caméra, année) : un seul à la fois, choisi avec les pastilles.
  const [monthSel, setMonthSel] = useState({});
  // Cartes « Caméra N » repliables d'un clic sur leur titre.
  const [collapsedPostes, setCollapsedPostes] = useState(new Set());
  const togglePoste = (poste) =>
    setCollapsedPostes((prev) => {
      const next = new Set(prev);
      if (next.has(poste)) next.delete(poste);
      else next.add(poste);
      return next;
    });
  const CURRENT_MONTH_STR = String(new Date().getMonth() + 1).padStart(2, '0');
  // Seul le mois en cours (de l'année en cours) est ouvert par défaut : tous les
  // autres mois sont repliés et s'ouvrent d'un clic sur leur titre.
  const monthDefaultOpenFor = (year, month) => year === CURRENT_YEAR_STR && month === CURRENT_MONTH_STR;
  // Mois affiché : celui choisi, sinon le mois en cours, sinon le plus récent.
  const selectedMonthFor = (poste, year) => {
    const months = (monthsByPosteYear.get(`${poste}__${year}`) || []).map((d) => d.month);
    const chosen = monthSel[`${poste}__${year}`];
    if (chosen && months.includes(chosen)) return chosen;
    if (monthDefaultOpenFor(year, CURRENT_MONTH_STR) && months.includes(CURRENT_MONTH_STR)) return CURRENT_MONTH_STR;
    return months[months.length - 1] || '';
  };
  const isSeanceVide = (s) => {
    const hasEquipe = (s.equipe || []).some((m) => (m.nom || '').trim());
    const hasChecks = (s.equipements || []).some((e) => e.sortie || e.entree || (e.checks && Object.values(e.checks).some((c) => c.sortie || c.entree)));
    return !s.superviseur && !s.signature && !s.signature_sortie && !s.signature_entree && !hasEquipe && !hasChecks && !s.observations && !s.interventions;
  };
  const ROLE_CODES = ['C', 'A', 'R'];
  // « Tout cocher / décocher » ne concerne que Cadreur et Assistant, jamais Régisseur.
  const AUTO_ROLE_CODES = ['C', 'A'];
  const ROLE_LABELS_FULL = { C: 'Cadreur', A: 'Assistant', R: 'Régisseur' };
  const emptyChecks = () => ({ C: { sortie: false, entree: false }, A: { sortie: false, entree: false }, R: { sortie: false, entree: false } });
  const [seanceForm, setSeanceForm] = useState({
    date: '',
    poste: '',
    superviseur: '',
    horaire_debut: '',
    horaire_fin: '',
    observations: '',
    interventions: '',
    signature: '',
    signature_sortie: '',
    signature_entree: '',
    signature_sortie_par: '',
    signature_entree_par: '',
    regisseur_signataire: '',
    equipements: [],
    equipe: defaultEquipe()
  });

  // Cadreurs prévus au planning pour la date du culte, par poste (Caméra N) :
  // [{ label: 'Caméra 1', num: 1, names: [{ slot: 0, nom }, { slot: 1, nom }] }].
  // Alimente la liste « par postes » et les suggestions de la fiche.
  const [plannedRaw, setPlannedRaw] = useState([]);
  useEffect(() => {
    const date = seanceForm.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      setPlannedRaw([]);
      return undefined;
    }
    let cancelled = false;
    const [y, m] = date.split('-').map(Number);
    axios
      .get(`${API}/planning/${y}/${m}`)
      .then((res) => {
        if (cancelled) return;
        setPlannedRaw(extractPlanned(res.data || {}, date));
      })
      .catch(() => !cancelled && setPlannedRaw([]));
    return () => {
      cancelled = true;
    };
  }, [seanceForm.date]);

  // ---------- Contacts state ----------
  const [contacts, setContacts] = useState([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactEditingId, setContactEditingId] = useState(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [filterContactType, setFilterContactType] = useState('all');
  const [contactForm, setContactForm] = useState({
    nom: '',
    type_contact: 'Fournisseur',
    contact: '',
    email: '',
    telephone: '',
    contacts_secondaires: [],
    adresse: '',
    categorie: '',
    notation: '',
    site: '',
    n_siret: '',
    n_client: '',
    notes: '',
    photo_url: ''
  });

  // ---------- Incidents state ----------
  const [incidents, setIncidents] = useState([]);
  // Vue « Archivés » des incidents : liste séparée, chargée à la demande.
  const [showArchivedInc, setShowArchivedInc] = useState(false);
  const [archivedIncidents, setArchivedIncidents] = useState([]);
  // Roster (utilisé pour les suggestions de signature ci-dessous).
  const [regisseursRoster, setRegisseursRoster] = useState([]);
  // Effectif complet (nom + poste) : les cadreurs ne sont pas dans la branche
  // « Régisseurs », la liste des cadreurs doit donc venir de tout l'effectif.
  const [fullRoster, setFullRoster] = useState([]);
  // Orthographe officielle de l'effectif (clé sans accents/casse/ponctuation).
  const rosterNameIndex = useMemo(() => {
    const idx = {};
    fullRoster.forEach((t) => {
      const n = (t.nom || '').trim();
      if (n) idx[nomKey(n)] = n;
    });
    return idx;
  }, [fullRoster]);
  // Nom au bon format, avec l'orthographe de l'effectif quand il correspond.
  const canonName = (raw) => {
    const f = formatNom(raw);
    return rosterNameIndex[nomKey(f)] || f;
  };
  // Cadreurs prévus au planning, noms remis au bon format.
  const plannedCadreurs = useMemo(
    () =>
      plannedRaw.map((p) => ({
        ...p,
        names: p.names.map((n) => ({ ...n, nom: canonName(n.nom) })),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plannedRaw, rosterNameIndex]
  );
  // Sous-liste des cadreurs (ceux qui signent réellement les fiches
  // Entrées/Sorties, demande 28/09/2026) pour les boutons "1 clic".
  const cadreursRoster = useMemo(
    () =>
      fullRoster.filter((t) => {
        const hay = [t.poste_principal, t.organigramme_label, ...(t.sous_branches || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes('cadreur');
      }),
    [fullRoster]
  );
  // Régisseurs uniquement (poste principal / libellé d'organigramme) : la
  // branche « Régisseurs » contient aussi des cadreurs, elle ne suffit pas.
  const regisseursOnly = useMemo(() => {
    const list = fullRoster.filter((t) =>
      nomKey([t.poste_principal, t.organigramme_label].filter(Boolean).join(' ')).includes('regisseur')
    );
    return list.length > 0 ? list : regisseursRoster;
  }, [fullRoster, regisseursRoster]);
  const namesForRole = (role, roleCode) => {
    // Rôle normalisé sans accents : « Régisseur » / « RÉGISSEUR » / « R » -> REG / R.
    const r = nomKey(role || roleCode).toUpperCase();
    const isRegisseurRole = r === 'R' || r.startsWith('REG');
    const isCadreurRole = r === 'C' || r === 'A' || r.startsWith('CAD') || r.startsWith('ASS');
    const base = isRegisseurRole
      ? regisseursOnly
      : isCadreurRole
        ? cadreursRoster
        : fullRoster;
    const sorted = Array.from(new Set(base.map((t) => (t.nom || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'fr')
    );
    if (!isCadreurRole || plannedCadreurs.length === 0) return sorted;
    // Cadreurs prévus au planning ce jour-là en premier : ceux du poste du
    // culte (Caméra N), puis ceux des autres postes, puis le reste de l'effectif.
    const camNum = parseInt((seanceForm.poste || '').replace(/\D+/g, ''), 10);
    const planned = [
      ...plannedCadreurs.filter((p) => p.num === camNum),
      ...plannedCadreurs.filter((p) => p.num !== camNum),
    ].flatMap((p) => p.names.map((n) => n.nom));
    return Array.from(new Set([...planned, ...sorted]));
  };
  // Numéro de caméra prévu au planning pour chaque cadreur (date du culte).
  const cameraByName = useMemo(() => {
    const map = {};
    plannedCadreurs.forEach((p) =>
      p.names.forEach((n) => {
        const key = n.nom.toLowerCase();
        map[key] = [...(map[key] || []), p.num != null ? `Cam ${p.num}` : p.label];
      })
    );
    return map;
  }, [plannedCadreurs]);
  const camLabelFor = (nom) => (cameraByName[(nom || '').trim().toLowerCase()] || []).join(' / ');
  const addPlannedToEquipe = (role, nom) => {
    const clean = canonName(nom);
    if (seanceForm.equipe.some((m) => nomKey(m.nom) === nomKey(clean))) return;
    setSeanceForm({ ...seanceForm, equipe: [...seanceForm.equipe, { role, nom: clean }] });
  };
  // Observations : écrites par les régisseurs (+ Admin / Super Admin).
  const canWriteObservations =
    isAdmin() || isSuperAdmin() || (user?.branches || []).includes('Régisseurs');
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentEditingId, setIncidentEditingId] = useState(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [filterIncidentPoste, setFilterIncidentPoste] = useState('all');
  const [filterSeancePoste, setFilterSeancePoste] = useState('all');
  const [incidentForm, setIncidentForm] = useState({
    poste: 'CAM 1',
    date: '',
    cadreur_regisseur: '',
    equipement_concerne: '',
    frequence: 'Ponctuel',
    description_probleme: '',
    resolution: '',
    date_fin: '',
    responsable_suivi: '',
    commentaire: ''
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    if (kioskMode) {
      // Compte tablette : seules les fiches Entrées/Sorties et l'effectif
      // allégé sont accessibles (le reste est refusé par le serveur).
      try {
        const [seancesRes, rosterRes] = await Promise.all([
          axios.get(`${API}/regisseur-seances`),
          axios.get(`${API}/techniciens/roster`).catch(() => ({ data: [] })),
        ]);
        setSeances(seancesRes.data || []);
        setFullRoster(rosterRes.data || []);
        setRegisseursRoster((rosterRes.data || []).filter((t) => (t.branches || []).includes('Régisseurs')));
      } catch (err) {
        toast.error('Erreur lors du chargement — vérifiez la connexion');
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      const [matRes, enumsRes, catRes, seancesRes, contactsRes, incidentsRes, rosterRes] = await Promise.all([
        axios.get(`${API}/materiel`),
        axios.get(`${API}/enums`),
        axios.get(`${API}/materiel/categories`),
        axios.get(`${API}/regisseur-seances`).catch(() => ({ data: [] })),
        axios.get(`${API}/regisseur-contacts`).catch(() => ({ data: [] })),
        axios.get(`${API}/regisseur-incidents`).catch(() => ({ data: [] })),
        axios.get(`${API}/techniciens/roster`).catch(() => ({ data: [] })),
      ]);
      setMateriel(matRes.data);
      setEnums(enumsRes.data);
      setCategories(catRes.data.categories || []);
      setSeances(seancesRes.data || []);
      setContacts(contactsRes.data || []);
      setIncidents(incidentsRes.data || []);
      setFullRoster(rosterRes.data || []);
      setRegisseursRoster(
        (rosterRes.data || []).filter((t) => (t.branches || []).includes('Régisseurs')),
      );
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // ================= MATERIEL (Stock & Inventaire) =================
  const resetForm = () => {
    setForm({
      nom: '', categorie: '', quantite: 1, numero_serie: '', marque: '', modele: '',
      statut: 'Disponible', notes: '', salle: '', groupe: '', date_achat: '', etat: '', reference: '', photo_url: ''
    });
    setEditingId(null);
  };

  const handleMatPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 MB)');
      return;
    }
    if (!['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error("Format d'image non supporté");
      return;
    }
    setUploadingMatPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((f) => ({ ...f, photo_url: res.data.url }));
      toast.success('Photo uploadée');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploadingMatPhoto(false);
      e.target.value = '';
    }
  };

  const handleEdit = (mat) => {
    setForm({
      nom: mat.nom,
      categorie: mat.categorie,
      quantite: mat.quantite || 1,
      numero_serie: mat.numero_serie || '',
      marque: mat.marque || '',
      modele: mat.modele || '',
      statut: mat.statut,
      notes: mat.notes || '',
      salle: mat.salle || '',
      groupe: mat.groupe || '',
      date_achat: mat.date_achat || '',
      etat: mat.etat || '',
      reference: mat.reference || '',
      photo_url: mat.photo_url || ''
    });
    setEditingId(mat.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await axios.put(`${API}/materiel/${editingId}`, form);
        toast.success('Matériel modifié');
      } else {
        await axios.post(`${API}/materiel`, form);
        toast.success('Matériel ajouté');
      }
      setDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchArchivedMateriel = async () => {
    try {
      const res = await axios.get(`${API}/materiel`, { params: { include_archived: true } });
      setArchivedMateriel((res.data || []).filter((m) => m.is_archived));
    } catch (err) {
      setArchivedMateriel([]);
    }
  };
  useEffect(() => {
    if (showArchivedMat) fetchArchivedMateriel();
  }, [showArchivedMat]);

  const handleArchive = async (id) => {
    if (!window.confirm("Archiver ce matériel ? Il disparaît de l'inventaire mais reste récupérable dans « Archivés ».")) return;
    try {
      await axios.put(`${API}/materiel/${id}/archive`);
      toast.success('Matériel archivé');
      fetchAll();
      if (showArchivedMat) fetchArchivedMateriel();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await axios.put(`${API}/materiel/${id}/unarchive`);
      toast.success("Matériel remis dans l'inventaire");
      fetchAll();
      fetchArchivedMateriel();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer définitivement ce matériel ? Cette action est irréversible (pour le conserver, utilisez plutôt « Archiver »).')) return;
    try {
      await axios.delete(`${API}/materiel/${id}`);
      toast.success('Matériel supprimé');
      fetchAll();
      if (showArchivedMat) fetchArchivedMateriel();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Nom de catégorie requis');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/materiel/categories`, { nom: newCategoryName.trim() });
      toast.success('Catégorie créée');
      setNewCategoryName('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (catName) => {
    if (!window.confirm(`Supprimer la catégorie "${catName}" ?`)) return;
    try {
      await axios.delete(`${API}/materiel/categories/${encodeURIComponent(catName)}`);
      toast.success('Catégorie supprimée');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const getStatutBadge = (statut) => {
    const colors = {
      // Vocabulaire du fichier Excel INVENTAIRE original (valeurs réellement
      // présentes dans les données importées), + le vocabulaire "propre"
      // proposé par l'app pour la saisie manuelle.
      'EN FONCTION': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Disponible': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'EN STOCK': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'EN RESERVE': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'EN SPARE': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'En utilisation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'EN PHASE DE TEST': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'En maintenance': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'A ACHETTER': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'HORS SERVICE': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Hors service': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'COLLECTOR': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'Archivé': 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'
    };
    const key = (statut || '').trim();
    return <Badge className={colors[key] || 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300'}>{statut || '-'}</Badge>;
  };

  const [materielSortKey, setMaterielSortKey] = useState(null);
  const [materielSortDir, setMaterielSortDir] = useState('asc');
  const toggleMaterielSort = (key) => {
    if (materielSortKey === key) {
      setMaterielSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setMaterielSortKey(key);
      setMaterielSortDir('asc');
    }
  };
  const SortableHead = ({ sortKey, className, children }) => (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground select-none"
        onClick={() => toggleMaterielSort(sortKey)}
      >
        {children}
        {materielSortKey === sortKey ? (
          materielSortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 opacity-20" />
        )}
      </button>
    </TableHead>
  );

  const filteredMateriel = (showArchivedMat ? archivedMateriel : materiel).filter(m => {
    const matchSearch = m.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.numero_serie && m.numero_serie.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategorie = filterCategorie === 'all' || m.categorie === filterCategorie;
    return matchSearch && matchCategorie;
  });

  const materielSortAccessors = {
    nom: (m) => (m.nom || '').toLowerCase(),
    categorie: (m) => (m.categorie || '').toLowerCase(),
    quantite: (m) => m.quantite || 0,
    marque: (m) => `${m.marque || ''} ${m.modele || ''}`.trim().toLowerCase(),
    salle: (m) => `${m.salle || ''} ${m.groupe || ''}`.trim().toLowerCase(),
    etat: (m) => (m.etat || '').toLowerCase(),
    statut: (m) => (m.statut || '').toLowerCase(),
  };
  const sortedMateriel = materielSortKey
    ? [...filteredMateriel].sort((a, b) => {
        const acc = materielSortAccessors[materielSortKey];
        const va = acc(a), vb = acc(b);
        if (va < vb) return materielSortDir === 'asc' ? -1 : 1;
        if (va > vb) return materielSortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredMateriel;

  const stats = {
    total: materiel.length,
    disponible: materiel.filter(m => m.statut === 'Disponible').length,
    enUtilisation: materiel.filter(m => m.statut === 'En utilisation').length,
    maintenance: materiel.filter(m => m.statut === 'En maintenance').length,
    incidentsOuverts: incidents.filter(i => !i.is_archived && !i.date_fin).length
  };

  // ================= SEANCES (Entrees / Sorties) =================
  const resetSeanceForm = () => {
    setSeanceForm({ date: '', poste: '', superviseur: '', horaire_debut: '', horaire_fin: '', observations: '', interventions: '', signature: '', signature_sortie: '', signature_entree: '', signature_sortie_par: '', signature_entree_par: '', regisseur_signataire: '', equipements: [], equipe: defaultEquipe() });
    setSeanceEditingId(null);
  };

  // Depuis la liste : ouvre la fiche directement sur la zone « Retour matériel »
  // (signature + nom du signataire).
  const openSeanceToSign = (s) => {
    handleEditSeance(s);
    [350, 800].forEach((d) => setTimeout(() => {
      const el = document.querySelector('[data-testid="signature-entree"]');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, d));
  };
  const handleEditSeance = (s) => {
    const form = {
      date: s.date || '',
      poste: s.poste || '',
      superviseur: s.superviseur || '',
      horaire_debut: s.horaire_debut || '',
      horaire_fin: s.horaire_fin || '',
      observations: s.observations || '',
      interventions: s.interventions || '',
      signature: s.signature || '',
      signature_sortie: s.signature_sortie || '',
      signature_entree: s.signature_entree || '',
      signature_sortie_par: s.signature_sortie_par || '',
      signature_entree_par: s.signature_entree_par || '',
      regisseur_signataire: s.regisseur_signataire || '',
      equipements: (s.equipements || []).map((eq) => ({ nom: eq.nom || '', checks: { ...emptyChecks(), ...(eq.checks || {}) } })),
      equipe: withDefaultEquipe(s.equipe)
    };
    lastSavedRef.current = JSON.stringify(form);
    setAutoSaveState('');
    setSeanceForm(form);
    setSeanceEditingId(s.id);
    setSeanceDialogOpen(true);
  };

  const addEquipeMembre = () => {
    setSeanceForm({ ...seanceForm, equipe: [...seanceForm.equipe, { role: '', nom: '' }] });
  };

  const updateEquipeMembre = (idx, field, value) => {
    const eq = [...seanceForm.equipe];
    eq[idx] = { ...eq[idx], [field]: value };
    setSeanceForm({ ...seanceForm, equipe: eq });
  };

  const addEquipementLigne = () => {
    setSeanceForm({
      ...seanceForm,
      equipements: [...seanceForm.equipements, { nom: '', checks: emptyChecks() }]
    });
  };

  const updateEquipementNom = (idx, value) => {
    const eqs = [...seanceForm.equipements];
    eqs[idx] = { ...eqs[idx], nom: value };
    setSeanceForm({ ...seanceForm, equipements: eqs });
  };

  const updateEquipementCheck = (idx, roleCode, field, value) => {
    const eqs = [...seanceForm.equipements];
    const current = eqs[idx] || { nom: '', checks: emptyChecks() };
    const checks = { ...emptyChecks(), ...current.checks };
    checks[roleCode] = { ...checks[roleCode], [field]: value };
    eqs[idx] = { ...current, checks };
    setSeanceForm({ ...seanceForm, equipements: eqs });
  };

  // Lignes que le « Tout cocher » ne doit JAMAIS cocher, selon la caméra :
  //  - Caméras 1, 2, 5 : pas de carte SD ;
  //  - Caméras 3, 4    : pas de disque dur (à la place de la carte SD) ni de ventilateur ;
  //  - Caméras 6, 7    : rien du tout.
  // (Les cases restent cochables à la main une par une.)
  const camNumForm = parseInt((seanceForm.poste || '').replace(/\D+/g, ''), 10);
  const isAutoCheckExcluded = (eqNom) => {
    const n = (eqNom || '').toLowerCase();
    if ([6, 7].includes(camNumForm)) return true;
    if ([1, 2, 5].includes(camNumForm)) return /cartes?\s*sd/.test(n);
    if ([3, 4].includes(camNumForm)) return /disque\s*dur|ventilat|ventilo/.test(n);
    return false;
  };
  // Lignes disque dur / carte SD : surlignées en rouge pâle dans les fiches.
  const isStorageLine = (eqNom) => /disque\s*dur|cartes?\s*sd/i.test(eqNom || '');
  const STORAGE_ROW = 'bg-red-100 hover:bg-red-100 dark:bg-red-950/30';
  const eligibleEquipements = () => seanceForm.equipements.filter((eq) => !isAutoCheckExcluded(eq.nom));
  const hasEligible = eligibleEquipements().length > 0;

  // 1 clic : coche (ou décoche si déjà tout coché) la case Sortie — ou Entrée —
  // des cadreurs et assistants (C / A, pas les régisseurs) sur les lignes d'équipement concernées.
  const allChecked = (field) => {
    const eligible = eligibleEquipements();
    return (
      eligible.length > 0 &&
      eligible.every((eq) => AUTO_ROLE_CODES.every((rc) => !!eq.checks?.[rc]?.[field]))
    );
  };
  const toggleAllChecks = (field) => {
    if (!hasEligible) {
      toast.info('Rien à cocher automatiquement pour ce poste.');
      return;
    }
    const value = !allChecked(field);
    const eqs = seanceForm.equipements.map((eq) => {
      if (isAutoCheckExcluded(eq.nom)) return eq;
      const checks = { ...emptyChecks(), ...eq.checks };
      AUTO_ROLE_CODES.forEach((rc) => {
        checks[rc] = { ...checks[rc], [field]: value };
      });
      return { ...eq, checks };
    });
    setSeanceForm({ ...seanceForm, equipements: eqs });
  };

  // Colonne du tableau : coche / décoche Sortie ou Entrée d'un rôle (C / A / R)
  // sur les lignes d'équipement concernées (mêmes exclusions).
  const toggleColumnChecks = (rc, field) => {
    const eligible = eligibleEquipements();
    if (eligible.length === 0) {
      toast.info('Rien à cocher automatiquement pour ce poste.');
      return;
    }
    const value = !eligible.every((eq) => !!eq.checks?.[rc]?.[field]);
    const eqs = seanceForm.equipements.map((eq) => {
      if (isAutoCheckExcluded(eq.nom)) return eq;
      const checks = { ...emptyChecks(), ...eq.checks };
      checks[rc] = { ...checks[rc], [field]: value };
      return { ...eq, checks };
    });
    setSeanceForm({ ...seanceForm, equipements: eqs });
  };

  // Noms toujours au bon format à l'enregistrement.
  const buildSeancePayload = (f) => ({
    ...f,
    superviseur: canonName(f.superviseur),
    equipe: (f.equipe || []).map((m) => ({
      ...m,
      role: (m.role || '').trim().toUpperCase().slice(0, 1) === (m.role || '').trim().toUpperCase() ? (m.role || '').trim().toUpperCase() : m.role,
      nom: canonName(m.nom),
    })),
  });

  // Enregistrement automatique d'une fiche existante (1,5 s après la dernière modification).
  const lastSavedRef = useRef('');
  const [autoSaveState, setAutoSaveState] = useState('');
  const [autoSavedAt, setAutoSavedAt] = useState(null);
  const autoSaveSeance = async (f, id) => {
    if (!f.date || !f.poste) return;
    const snap = JSON.stringify(f);
    setAutoSaveState('saving');
    try {
      const res = await axios.put(`${API}/regisseur-seances/${id}`, buildSeancePayload(f), { headers: { 'X-Autosave': '1' } });
      lastSavedRef.current = snap;
      setSeances((prev) => prev.map((x) => (x.id === id ? res.data : x)));
      setAutoSavedAt(new Date());
      setAutoSaveState('saved');
    } catch (err) {
      setAutoSaveState('error');
    }
  };
  useEffect(() => {
    if (!seanceDialogOpen || !seanceEditingId) return undefined;
    if (JSON.stringify(seanceForm) === lastSavedRef.current) return undefined;
    const t = setTimeout(() => autoSaveSeance(seanceForm, seanceEditingId), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seanceForm, seanceDialogOpen, seanceEditingId]);
  // Fermeture : on enregistre d'abord ce qui n'est pas encore parti.
  const closeFiche = async () => {
    if (seanceEditingId && JSON.stringify(seanceForm) !== lastSavedRef.current) {
      await autoSaveSeance(seanceForm, seanceEditingId);
    }
    setSeanceDialogOpen(false);
    resetSeanceForm();
    setAutoSaveState('');
  };

  const handleSeanceSubmit = async (e) => {
    e.preventDefault();
    if (!seanceForm.date || !seanceForm.poste) {
      toast.error('Date et poste requis');
      return;
    }
    setSeanceSubmitting(true);
    try {
      const payload = buildSeancePayload(seanceForm);
      if (seanceEditingId) {
        await axios.put(`${API}/regisseur-seances/${seanceEditingId}`, payload);
        toast.success('Culte modifié');
      } else {
        await axios.post(`${API}/regisseur-seances`, payload);
        toast.success('Culte enregistré');
      }
      setSeanceDialogOpen(false);
      resetSeanceForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSeanceSubmitting(false);
    }
  };

  const seanceMatchesSearch = (s, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const haystack = [
      s.date,
      s.poste,
      s.jour_label,
      s.superviseur,
      s.signature,
      sigText(s.signature_entree),
      s.observations,
      s.interventions,
      ...(s.equipe || []).map((m) => m.nom),
      ...(s.equipements || []).map((e) => e.nom),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  };
  const sortedSeances = [...seances]
    .filter((s) => seanceMatchesSearch(s, seanceSearch))
    // Ordre chronologique croissant (années, mois puis jours) ; les fiches sans date à la fin.
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

  // Index poste -> années présentes, et poste+année -> mois présents (avec
  // leur "ouvert par défaut"), utilisé pour l'accordéon (toggleYear/
  // toggleMonth) et les boutons Tout ouvrir/Tout fermer ci-dessous.
  const yearsByPoste = new Map();
  const monthsByPosteYear = new Map();
  Array.from(new Set(sortedSeances.map((s) => s.poste))).forEach((poste) => {
    const g = sortedSeances.filter((s) => s.poste === poste);
    const years = Array.from(new Set(g.map((s) => (s.date || '').slice(0, 4) || 'Sans date')));
    yearsByPoste.set(poste, years);
    years.forEach((year) => {
      const gy = g.filter((s) => (s.date || '').slice(0, 4) === year);
      const months = Array.from(new Set(gy.map((s) => (s.date || '').slice(5, 7) || '00')));
      const monthDefs = months.map((month) => ({ month }));
      monthsByPosteYear.set(`${poste}__${year}`, monthDefs);
    });
  });
  const setAllSeanceYearsOpen = (open) => {
    setYearOv((prev) => {
      const next = { ...prev };
      yearsByPoste.forEach((years, poste) => {
        years.forEach((year) => { next[`${poste}__${year}`] = open ? true : false; });
      });
      return next;
    });
  };
  const expandAllSeances = () => {
    setCollapsedPostes(new Set());
    setAllSeanceYearsOpen(true);
  };
  const collapseAllSeances = () => {
    setAllSeanceYearsOpen(false);
  };

  // Planning des mois affichés (pour retrouver automatiquement les cadreurs principaux).
  const [planningCache, setPlanningCache] = useState({});
  const planningAsked = useRef(new Set());
  useEffect(() => {
    if (!seances.length) return;
    const need = new Set();
    yearsByPoste.forEach((years, poste) => years.forEach((year) => {
      const m = selectedMonthFor(poste, year);
      if (/^\d{4}$/.test(year) && m && m !== '00') need.add(`${year}-${parseInt(m, 10)}`);
    }));
    need.forEach((k) => {
      if (planningAsked.current.has(k)) return;
      planningAsked.current.add(k);
      const [y, m] = k.split('-');
      axios.get(`${API}/planning/${y}/${m}`)
        .then((r) => setPlanningCache((prev) => ({ ...prev, [k]: r.data || {} })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seances, monthSel]);

  // Prénom -> nom officiel de l'effectif (cadreurs d'abord).
  const resolveFirstName = (prenom) => {
    const key = nomKey(prenom);
    const pool = [...cadreursRoster, ...fullRoster];
    const hit = pool.find((t) => {
      const full = nomKey(t.nom || '');
      return full.startsWith(key) || String(t.nom || '').split(/\s+/).map(nomKey).includes(key);
    });
    return hit ? canonName(hit.nom) : formatNom(prenom);
  };
  // Cadreurs principaux d'une fiche : ceux saisis (rôle C), sinon d'office
  // (ex. Caméra 5), sinon le titulaire du poste au planning de la date.
  const principauxFor = (sc) => {
    const saisis = (sc.equipe || []).filter((m) => (m.nom || '').trim() && (m.role || '').trim().toUpperCase() === 'C').map((m) => canonName(m.nom));
    if (saisis.length) return { names: saisis, auto: false };
    const camNum = parseInt(((sc.poste || '').match(/\d+/) || [''])[0], 10);
    if (DEFAULT_PRINCIPAUX[camNum]) return { names: DEFAULT_PRINCIPAUX[camNum].map(resolveFirstName), auto: true };
    const [y, mo] = (sc.date || '').split('-');
    const pl = planningCache[`${y}-${parseInt(mo, 10)}`];
    if (pl && sc.date) {
      const hit = extractPlanned(pl, sc.date).find((p) => p.num === camNum);
      const nom = hit && hit.names.find((n) => n.slot === 0);
      if (nom) return { names: [canonName(nom.nom)], auto: true };
    }
    return { names: [], auto: true };
  };
  // À l'ouverture d'une fiche vide : cadreur et assistant du planning ajoutés d'office
  // (Caméra 5 : Marc-Arthur / Camille en cadreurs). Les autres cadreurs restent proposés
  // dans la liste déroulante du nom, selon les lettres tapées.
  const autoFillRef = useRef({});
  useEffect(() => {
    if (!seanceDialogOpen || !seanceForm.poste) return;
    const key = `${seanceEditingId || 'new'}|${seanceForm.date}|${seanceForm.poste}`;
    const done = autoFillRef.current[key] || (autoFillRef.current[key] = { C: false, A: false });
    const eqNow = seanceForm.equipe || [];
    const named = (r) => eqNow.some((m) => (m.nom || '').trim() && (!r || (m.role || '').trim().toUpperCase() === r));
    // Fiche déjà remplie à la main : on n'y touche pas.
    if (named() && !(done.C || done.A)) return;
    const camNum = parseInt(((seanceForm.poste || '').match(/\d+/) || [''])[0], 10);
    const planned = plannedCadreurs.find((p) => p.num === camNum);
    const cNames = DEFAULT_PRINCIPAUX[camNum]
      ? DEFAULT_PRINCIPAUX[camNum].map(resolveFirstName)
      : (planned ? planned.names.filter((n) => n.slot === 0).map((n) => n.nom) : []);
    const aNames = planned ? planned.names.filter((n) => n.slot === 1).map((n) => n.nom) : [];
    const needC = !done.C && cNames.length > 0 && !named('C');
    const needA = !done.A && aNames.length > 0 && !named('A');
    if (!needC && !needA) return;
    if (needC) done.C = true;
    if (needA) done.A = true;
    // On garde les lignes d'office existantes (Cadreur / Assistant / Régisseur) : les noms
    // remplissent les lignes vides du bon rôle, et C / A / R sont ajoutées si absentes.
    setSeanceForm((f) => {
      const eq = (f.equipe || []).map((m) => ({ ...m }));
      const fill = (role, names) => names.forEach((nom) => {
        const idx = eq.findIndex((m) => (m.role || '').trim().toUpperCase() === role && !(m.nom || '').trim());
        if (idx >= 0) eq[idx].nom = nom; else eq.push({ role, nom });
      });
      if (needC) fill('C', cNames);
      if (needA) fill('A', aNames);
      ['C', 'A', 'R'].forEach((r) => {
        if (!eq.some((m) => (m.role || '').trim().toUpperCase() === r)) eq.push({ role: r, nom: '' });
      });
      return { ...f, equipe: eq };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seanceDialogOpen, seanceForm.poste, seanceForm.date, seanceEditingId, plannedRaw, fullRoster]);

  // ================= CONTACTS =================
  const resetContactForm = () => {
    setContactForm({ nom: '', type_contact: 'Fournisseur', contact: '', email: '', telephone: '', contacts_secondaires: [], adresse: '', categorie: '', notation: '', site: '', n_siret: '', n_client: '', notes: '', photo_url: '' });
    setContactEditingId(null);
  };

  const handleEditContact = (c) => {
    setContactForm({
      nom: c.nom || '',
      type_contact: c.type_contact || 'Fournisseur',
      contact: c.contact || '',
      email: c.email || '',
      telephone: c.telephone || '',
      contacts_secondaires: (c.contacts_secondaires && c.contacts_secondaires.length > 0) ? c.contacts_secondaires : [],
      adresse: c.adresse || '',
      categorie: c.categorie || '',
      notation: c.notation || '',
      site: c.site || '',
      n_siret: c.n_siret || '',
      n_client: c.n_client || '',
      notes: c.notes || '',
      photo_url: c.photo_url || ''
    });
    setContactEditingId(c.id);
    setContactDialogOpen(true);
  };

  const addContactSecondaire = () => {
    setContactForm((f) => ({ ...f, contacts_secondaires: [...f.contacts_secondaires, { contact: '', telephone: '' }] }));
  };
  const updateContactSecondaire = (idx, field, value) => {
    setContactForm((f) => ({
      ...f,
      contacts_secondaires: f.contacts_secondaires.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    }));
  };
  const removeContactSecondaire = (idx) => {
    setContactForm((f) => ({ ...f, contacts_secondaires: f.contacts_secondaires.filter((_, i) => i !== idx) }));
  };

  const handleContactPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 MB)');
      return;
    }
    if (!['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error("Format d'image non supporté");
      return;
    }
    setUploadingContactPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setContactForm((f) => ({ ...f, photo_url: res.data.url }));
      toast.success('Photo uploadée');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploadingContactPhoto(false);
      e.target.value = '';
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    try {
      if (contactEditingId) {
        await axios.put(`${API}/regisseur-contacts/${contactEditingId}`, contactForm);
        toast.success('Contact modifié');
      } else {
        await axios.post(`${API}/regisseur-contacts`, contactForm);
        toast.success('Contact ajouté');
      }
      setContactDialogOpen(false);
      resetContactForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Supprimer ce contact définitivement ? Cette action est irréversible.')) return;
    try {
      await axios.delete(`${API}/regisseur-contacts/${id}`);
      toast.success('Contact supprimé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // "Classeur" (demande 28/09/2026) : recherche libre + sections repliables
  // par type (Fournisseur/Location/Réparation), comme Entrées/Sorties.
  const [contactSearch, setContactSearch] = useState('');
  const [collapsedContactTypes, setCollapsedContactTypes] = useState(new Set());
  const toggleContactType = (t) =>
    setCollapsedContactTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  const contactMatchesSearch = (c, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const haystack = [
      c.nom,
      c.contact,
      c.telephone,
      c.email,
      c.notes,
      ...(c.contacts_secondaires || []).flatMap((p) => [p.contact, p.telephone]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  };
  const filteredContacts = contacts
    .filter(c => filterContactType === 'all' || c.type_contact === filterContactType)
    .filter(c => contactMatchesSearch(c, contactSearch));

  // ================= INCIDENTS =================
  const resetIncidentForm = () => {
    setIncidentForm({
      poste: 'CAM 1', date: '', cadreur_regisseur: '', equipement_concerne: '',
      frequence: 'Ponctuel', description_probleme: '', resolution: '', date_fin: '',
      responsable_suivi: '', commentaire: ''
    });
    setIncidentEditingId(null);
  };

  const handleEditIncident = (i) => {
    setIncidentForm({
      poste: i.poste || 'CAM 1',
      date: i.date || '',
      cadreur_regisseur: i.cadreur_regisseur || '',
      equipement_concerne: i.equipement_concerne || '',
      frequence: i.frequence || 'Ponctuel',
      description_probleme: i.description_probleme || '',
      resolution: i.resolution || '',
      date_fin: i.date_fin || '',
      responsable_suivi: i.responsable_suivi || '',
      commentaire: i.commentaire || ''
    });
    setIncidentEditingId(i.id);
    setIncidentDialogOpen(true);
  };

  const handleIncidentSubmit = async (e) => {
    e.preventDefault();
    setIncidentSubmitting(true);
    try {
      if (incidentEditingId) {
        await axios.put(`${API}/regisseur-incidents/${incidentEditingId}`, incidentForm);
        toast.success('Incident modifié');
      } else {
        await axios.post(`${API}/regisseur-incidents`, incidentForm);
        toast.success('Incident ajouté');
      }
      setIncidentDialogOpen(false);
      resetIncidentForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const fetchArchivedIncidents = async () => {
    try {
      const res = await axios.get(`${API}/regisseur-incidents`, { params: { include_archived: true } });
      setArchivedIncidents((res.data || []).filter((i) => i.is_archived));
    } catch (err) {
      setArchivedIncidents([]);
    }
  };
  useEffect(() => {
    if (showArchivedInc) fetchArchivedIncidents();
  }, [showArchivedInc]);

  const handleArchiveIncident = async (id) => {
    if (!window.confirm("Archiver cet incident ? Il disparaît de la liste mais reste récupérable dans « Archivés ».")) return;
    try {
      await axios.put(`${API}/regisseur-incidents/${id}/archive`);
      toast.success('Incident archivé');
      fetchAll();
      if (showArchivedInc) fetchArchivedIncidents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleUnarchiveIncident = async (id) => {
    try {
      await axios.put(`${API}/regisseur-incidents/${id}/unarchive`);
      toast.success('Incident remis dans la liste');
      fetchAll();
      fetchArchivedIncidents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDeleteIncident = async (id) => {
    if (!window.confirm("Supprimer cet incident définitivement ? Cette action est irréversible (pour le conserver, utilisez plutôt « Archiver »).")) return;
    try {
      await axios.delete(`${API}/regisseur-incidents/${id}`);
      toast.success('Incident supprimé');
      fetchAll();
      if (showArchivedInc) fetchArchivedIncidents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };


  const [incidentSearch, setIncidentSearch] = useState('');
  const incidentMatchesSearch = (i, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const haystack = [
      i.date,
      i.poste,
      i.cadreur_regisseur,
      i.equipement_concerne,
      i.description_probleme,
      i.resolution,
      i.responsable_suivi,
      i.commentaire,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  };
  const filteredIncidents = (showArchivedInc ? archivedIncidents : incidents)
    .filter(i => filterIncidentPoste === 'all' || i.poste === filterIncidentPoste)
    .filter(i => incidentMatchesSearch(i, incidentSearch))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // ---------------------------------------------------------------------
  // Export XLSX (classeur multi-feuilles, une feuille par section) + PDF
  // (résumé combiné, une table par section) — tâche #578. Réutilise
  // xlsx-js-style (comme Planning.js) et html2canvas + jsPDF (comme
  // Devis.js / Effectif.js) plutôt que d'introduire de nouvelles
  // dépendances. Les sections réelles du module sont Stock & Inventaire
  // (matériel), Contact, Incidents et Entrées/Sorties (pas de section
  // "Matériel" distincte : le sous-onglet "Stock & Inventaire" EST la
  // gestion du matériel).
  const groupByKey = (list, keyFn) => {
    const map = new Map();
    (list || []).forEach((item) => {
      const key = keyFn(item) || 'Non classé';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  };

  const HEADER_HEX = '1F4E78';
  const BAND_HEX = 'BDD7EE';

  const styleHeaderRow = (ws, rowIdx, nCols) => {
    for (let c = 0; c < nCols; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: HEADER_HEX } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
    }
  };

  const styleBandRow = (ws, rowIdx, nCols) => {
    for (let c = 0; c < nCols; c++) {
      const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].s = {
        font: { bold: true, color: { rgb: HEADER_HEX } },
        fill: { fgColor: { rgb: BAND_HEX } },
      };
    }
  };

  const buildMaterielSheet = () => {
    const headers = ['Nom', 'Quantité', 'Statut', 'Marque', 'Modèle', 'N° série', 'Référence', 'Salle', 'Groupe'];
    const aoa = [];
    const merges = [];
    const bandRows = [];
    const grouped = groupByKey(materiel, (m) => m.categorie);
    [...grouped.keys()].sort().forEach((cat) => {
      bandRows.push(aoa.length);
      aoa.push([cat, ...Array(headers.length - 1).fill(null)]);
      merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headers.length - 1 } });
      aoa.push(headers);
      const headerRowIdx = aoa.length - 1;
      grouped.get(cat).forEach((m) => {
        aoa.push([m.nom || '', m.quantite ?? '', m.statut || '', m.marque || '', m.modele || '', m.numero_serie || '', m.reference || '', m.salle || '', m.groupe || '']);
      });
      bandRows.push({ header: headerRowIdx });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    bandRows.forEach((r) => {
      if (typeof r === 'number') styleBandRow(ws, r, headers.length);
      else styleHeaderRow(ws, r.header, headers.length);
    });
    return ws;
  };

  const buildContactSheet = () => {
    const headers = ['Nom', 'Contact', 'Email', 'Téléphone', 'Adresse', 'Catégorie', 'Site', 'N° SIRET', 'N° client'];
    const aoa = [];
    const merges = [];
    const bandRows = [];
    const grouped = groupByKey(contacts, (c) => c.type_contact);
    CONTACT_TYPES.forEach((type) => {
      const list = grouped.get(type) || [];
      if (!list.length) return;
      bandRows.push(aoa.length);
      aoa.push([type, ...Array(headers.length - 1).fill(null)]);
      merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headers.length - 1 } });
      aoa.push(headers);
      bandRows.push({ header: aoa.length - 1 });
      list.forEach((c) => {
        aoa.push([c.nom || '', c.contact || '', c.email || '', c.telephone || '', c.adresse || '', c.categorie || '', c.site || '', c.n_siret || '', c.n_client || '']);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    bandRows.forEach((r) => {
      if (typeof r === 'number') styleBandRow(ws, r, headers.length);
      else styleHeaderRow(ws, r.header, headers.length);
    });
    return ws;
  };

  const buildIncidentsSheet = () => {
    const headers = ['Date', 'Fréquence', 'Cadreur/Régisseur', 'Équipement', 'Problème', 'Résolution', 'Date fin', 'Responsable suivi'];
    const aoa = [];
    const merges = [];
    const bandRows = [];
    const grouped = groupByKey(incidents, (i) => i.poste);
    [...grouped.keys()].sort().forEach((poste) => {
      bandRows.push(aoa.length);
      aoa.push([poste, ...Array(headers.length - 1).fill(null)]);
      merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headers.length - 1 } });
      aoa.push(headers);
      bandRows.push({ header: aoa.length - 1 });
      grouped.get(poste)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .forEach((i) => {
          aoa.push([i.date || '', i.frequence || '', i.cadreur_regisseur || '', i.equipement_concerne || '', i.description_probleme || '', i.resolution || '', i.date_fin || '', i.responsable_suivi || '']);
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    bandRows.forEach((r) => {
      if (typeof r === 'number') styleBandRow(ws, r, headers.length);
      else styleHeaderRow(ws, r.header, headers.length);
    });
    return ws;
  };

  const exportSeancesList = () => {
    const sc = exportScopeRef.current;
    if (!sc) return seances;
    return seances.filter((x) =>
      (sc.year === 'all' || (x.date || '').slice(0, 4) === sc.year) &&
      (sc.month === 'all' || (x.date || '').slice(5, 7) === sc.month) &&
      (sc.poste === 'all' || x.poste === sc.poste));
  };
  const wantSection = (name) => !exportScopeRef.current || !!exportScopeRef.current.sections[name];
  const exportSuffix = () => {
    const sc = exportScopeRef.current;
    if (!sc) return '';
    const parts = [];
    if (sc.sections.seances) {
      if (sc.year !== 'all') parts.push(sc.year);
      if (sc.month !== 'all') parts.push(sc.month);
    }
    return parts.length ? `-${parts.join('-')}` : '-selection';
  };

  const buildSeancesSheet = () => {
    const headers = ['Date', 'Superviseur', 'Horaire début', 'Horaire fin', 'Équipe', 'Signature', 'Observations'];
    const aoa = [];
    const merges = [];
    const bandRows = [];
    const grouped = groupByKey(exportSeancesList(), (s) => s.poste);
    [...grouped.keys()].sort().forEach((poste) => {
      bandRows.push(aoa.length);
      aoa.push([poste, ...Array(headers.length - 1).fill(null)]);
      merges.push({ s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: headers.length - 1 } });
      aoa.push(headers);
      bandRows.push({ header: aoa.length - 1 });
      grouped.get(poste)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .forEach((s) => {
          const equipe = (s.equipe || []).filter((m) => (m.nom || '').trim()).map((m) => `${m.role ? m.role + ': ' : ''}${m.nom}`).join(', ');
          aoa.push([s.date || '', s.superviseur || '', s.horaire_debut || '', s.horaire_fin || '', equipe, sigSummary(s), s.observations || '']);
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    bandRows.forEach((r) => {
      if (typeof r === 'number') styleBandRow(ws, r, headers.length);
      else styleHeaderRow(ws, r.header, headers.length);
    });
    return ws;
  };

  const handleExportRegisseursXlsx = async () => {
    setExportingXlsx(true);
    try {
      const wb = XLSX.utils.book_new();
      if (wantSection('materiel')) XLSX.utils.book_append_sheet(wb, buildMaterielSheet(), 'Stock & Matériel');
      if (wantSection('contact')) XLSX.utils.book_append_sheet(wb, buildContactSheet(), 'Contact');
      if (wantSection('incidents')) XLSX.utils.book_append_sheet(wb, buildIncidentsSheet(), 'Incidents');
      if (wantSection('seances')) XLSX.utils.book_append_sheet(wb, buildSeancesSheet(), 'Entrées-Sorties');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `regisseurs${exportSuffix()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const status = await downloadOrShareFile(blob, filename, { title: filename });
      const msg = status === 'blocked'
        ? "Impossible d'enregistrer le fichier — réessaie"
        : status === 'downloaded'
          ? 'Le fichier Excel a été téléchargé'
          : downloadStatusMessage(status);
      if (status === 'blocked') toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExportingXlsx(false);
    }
  };

  // PDF : rendu HTML hors-écran (tables simples par section) converti en
  // image puis paginé dans un jsPDF multi-pages — même méthode que
  // Devis.js/Effectif.js (html2canvas + jsPDF), en découpant le long
  // visuel sur plusieurs pages A4.
  const buildSectionTableHtml = (title, headers, rows) => {
    const headHtml = headers.map((h) => `<th style="text-align:left;padding:6px 8px;background:#eef2ff;color:#1e3a8a;font-size:11px;border:1px solid #d1d5db;">${h}</th>`).join('');
    const bodyHtml = rows.length
      ? rows.map((r) => `<tr>${r.map((c) => `<td style="padding:5px 8px;font-size:11px;border:1px solid #e5e7eb;">${(c ?? '').toString().replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headers.length}" style="padding:8px;font-size:11px;color:#999;">Aucune donnée</td></tr>`;
    return `
      <div style="margin-bottom: 28px;">
        <div style="font-size: 16px; font-weight: bold; color: #2563eb; margin-bottom: 10px; border-bottom: 2px solid #2563eb; padding-bottom: 4px;">${title}</div>
        <table style="width:100%; border-collapse: collapse;">
          <thead><tr>${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `;
  };

  const handleExportRegisseursPdf = async () => {
    const preOpenedWindow = reserveTabForIOSFallback();
    setExportingPdf(true);
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-99999px';
    container.style.width = '900px';
    container.style.background = '#ffffff';

    const matRows = (materiel || []).map((m) => [m.categorie || '', m.nom || '', m.quantite ?? '', m.statut || '']);
    const contactRows = (contacts || []).map((c) => [c.type_contact || '', c.nom || '', c.contact || '', c.telephone || '', c.email || '']);
    const incidentRows = (incidents || []).map((i) => [i.poste || '', i.date || '', i.cadreur_regisseur || '', i.description_probleme || '']);
    const seanceRows = exportSeancesList().map((s) => [s.poste || '', s.date || '', s.superviseur || '', sigSummary(s)]);

    container.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #333; box-sizing: border-box; width: 900px;">
        <div style="display:flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <div style="font-size: 28px; font-weight: bold; color: #2563eb;">PAV Manager</div>
            <div style="font-size: 12px; color: #666;">Régisseurs — ${exportScopeRef.current ? 'Export sélectionné' : 'Export complet'}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: #1e40af;">RÉGISSEURS</div>
            <div style="color: #666; margin-top: 5px;">Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
        ${wantSection('materiel') ? buildSectionTableHtml('Stock & Matériel', ['Catégorie', 'Nom', 'Quantité', 'Statut'], matRows) : ''}
        ${wantSection('contact') ? buildSectionTableHtml('Contact', ['Type', 'Nom', 'Contact', 'Téléphone', 'Email'], contactRows) : ''}
        ${wantSection('incidents') ? buildSectionTableHtml('Incidents', ['Poste', 'Date', 'Cadreur/Régisseur', 'Problème'], incidentRows) : ''}
        ${wantSection('seances') ? buildSectionTableHtml('Entrées / Sorties', ['Poste', 'Date', 'Superviseur', 'Signature'], seanceRows) : ''}
      </div>
    `;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const filename = `regisseurs${exportSuffix()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const blob = pdf.output('blob');
      const status = await downloadOrShareFile(blob, filename, { title: filename, preOpenedWindow });
      const msg = status === 'blocked'
        ? "Impossible d'enregistrer le fichier — réessaie"
        : status === 'downloaded'
          ? 'Le PDF a été téléchargé'
          : downloadStatusMessage(status);
      if (status === 'blocked') toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error('Erreur lors de la génération du PDF');
    } finally {
      document.body.removeChild(container);
      setExportingPdf(false);
    }
  };

  const runSelectedExport = async () => {
    const sel = exportSel;
    if (!Object.values(sel.sections).some(Boolean)) {
      toast.error('Choisissez au moins un élément à exporter');
      return;
    }
    exportScopeRef.current = sel;
    setExportDialogOpen(false);
    try {
      if (sel.format === 'pdf') await handleExportRegisseursPdf();
      else await handleExportRegisseursXlsx();
    } finally {
      exportScopeRef.current = null;
    }
  };
  const seanceYears = Array.from(new Set(seances.map((x) => (x.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();

  const SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'entrees-sorties', label: 'Entrées / Sorties', icon: ArrowRightLeft },
    { id: 'stock', label: 'Stock & Inventaire', icon: Boxes },
    { id: 'contact', label: 'Contact', icon: Contact2 },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'notes', label: 'Notes', icon: StickyNote }
  ];

  return (
    <div className="space-y-6" data-testid="logistique-page">
      {!kioskMode && (
      <>
      <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Régisseurs</h1>
        <p className="text-muted-foreground">Gestion du matériel, des entrées/sorties et des contacts du département</p>
      </div>
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="regisseurs-export-menu-btn">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Exporter</span>
              <ChevronDown className="w-3.5 h-3.5 ml-1 hidden sm:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setExportDialogOpen(true)} data-testid="regisseurs-export-select-btn">
              <CheckSquare className="w-4 h-4 mr-2" />
              Exporter une sélection…
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportRegisseursXlsx}
              disabled={exportingXlsx}
              data-testid="regisseurs-export-xlsx-btn"
            >
              {exportingXlsx ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Exporter tout (XLSX)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportRegisseursPdf}
              disabled={exportingPdf}
              data-testid="regisseurs-export-pdf-btn"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Exporter tout (PDF)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
          <img
    className="hidden md:block h-20 object-contain shrink-0"                  src="data:image/png;base64,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"
                  alt="Branche Régisseur"
                            />
                    </div>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Exporter une sélection</DialogTitle>
            <DialogDescription>Choisissez le format, ce qu'il faut exporter et la période des Entrées / Sorties.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {[['xlsx', 'Excel (.xlsx)', FileSpreadsheet], ['pdf', 'PDF', FileText]].map(([id, label, Icon]) => (
                <Button key={id} type="button" variant={exportSel.format === id ? 'default' : 'outline'} className="flex-1" onClick={() => setExportSel((x) => ({ ...x, format: id }))}>
                  <Icon className="w-4 h-4 mr-2" />{label}
                </Button>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              {[['seances', 'Entrées / Sorties (fiches)'], ['materiel', 'Inventaire (stock & matériel)'], ['contact', 'Contacts'], ['incidents', 'Incidents']].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm font-medium">
                  <input type="checkbox" className="h-5 w-5 accent-primary" checked={!!exportSel.sections[key]}
                    onChange={(e) => { const v = e.target.checked; setExportSel((x) => ({ ...x, sections: { ...x.sections, [key]: v } })); }} />
                  {label}
                </label>
              ))}
            </div>
            {exportSel.sections.seances && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Année</Label>
                  <select value={exportSel.year} onChange={(e) => { const v = e.target.value; setExportSel((x) => ({ ...x, year: v })); }} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="all">Toutes</option>
                    {seanceYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mois</Label>
                  <select value={exportSel.month} onChange={(e) => { const v = e.target.value; setExportSel((x) => ({ ...x, month: v })); }} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="all">Tous</option>
                    {MOIS_NOMS_FR.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Caméra</Label>
                  <select value={exportSel.poste} onChange={(e) => { const v = e.target.value; setExportSel((x) => ({ ...x, poste: v })); }} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="all">Toutes</option>
                    {POSTES_CAM.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={runSelectedExport}>
              <Download className="w-4 h-4 mr-2" />Exporter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              variant={subTab === t.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubTab(t.id)}
              data-testid={`regisseur-tab-${t.id}`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {t.label}
            </Button>
          );
        })}
      </div>
      </>
      )}

      {kioskMode && (
        <div className="flex gap-2 border-b pb-2">
          {[['entrees-sorties', 'Entrées / Sorties', ArrowRightLeft], ['notes', 'Notes', StickyNote]].map(([id, label, Icon]) => (
            <Button key={id} variant={subTab === id ? 'default' : 'outline'} className="h-12 flex-1 text-base" onClick={() => setSubTab(id)} data-testid={`kiosk-tab-${id}`}>
              <Icon className="mr-2 h-5 w-5" />{label}
            </Button>
          ))}
        </div>
      )}

      {subTab === 'notes' && <RegisseurNotes kioskMode={kioskMode} />}

      {subTab === 'notes' ? null : loading ? (
        <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : (
        <>
          {subTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Matériel total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats.disponible}</p>
                    <p className="text-xs text-muted-foreground">Disponible</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.enUtilisation}</p>
                    <p className="text-xs text-muted-foreground">En utilisation</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
                    <p className="text-xs text-muted-foreground">Maintenance</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer" onClick={() => setSubTab('incidents')}>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-rose-600">{stats.incidentsOuverts}</p>
                    <p className="text-xs text-muted-foreground">Incidents ouverts</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  // Fiches du jour : celles du jour de culte d'aujourd'hui, sinon du
                  // prochain (à défaut, du dernier). Couleur = celle de la caméra.
                  const now = new Date();
                  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const dated = sortedSeances.filter((s) => s.date);
                  const targetDate =
                    (dated.find((s) => s.date >= todayStr) || dated[dated.length - 1] || {}).date || null;
                  const dayFiches = dated
                    .filter((s) => s.date === targetDate)
                    .sort((a, b) => (parseInt((a.poste.match(/\d+/) || [99])[0], 10)) - (parseInt((b.poste.match(/\d+/) || [99])[0], 10)));
                  const label =
                    targetDate === todayStr ? "Fiches d'aujourd'hui" : targetDate && targetDate > todayStr ? 'Fiches du prochain culte' : 'Fiches du dernier culte';
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {label}
                          {targetDate && (
                            <span className="ml-2 text-sm font-normal capitalize text-muted-foreground">
                              {new Date(`${targetDate}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1.5">
                        {dayFiches.length === 0 && <p className="text-sm text-muted-foreground">Aucun culte enregistré</p>}
                        {dayFiches.map((s) => {
                          const cam = cameraCouleur(s.poste);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSubTab('entrees-sorties');
                                if (canManage()) handleEditSeance(s);
                              }}
                              className={`flex w-full items-center gap-3 rounded-md border-l-8 px-3 py-2 text-left text-sm transition-colors hover:brightness-95 ${cam?.border || 'border-l-transparent'} ${cam?.soft || 'bg-muted/30'}`}
                            >
                              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-black ${cam?.solid || 'bg-muted'}`}>
                                {parseInt((s.poste.match(/\d+/) || ['•'])[0], 10) || '•'}
                              </span>
                              <span className="flex-1 font-medium">{s.poste}</span>
                              <span className="truncate text-muted-foreground">{s.superviseur ? canonName(s.superviseur) : '—'}</span>
                              {isSeanceVide(s) && (
                                <Badge variant="outline" className="font-normal text-muted-foreground">Vide</Badge>
                              )}
                            </button>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })()}
                <Card>
                  <CardHeader><CardTitle className="text-base">Contacts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {CONTACT_TYPES.map((t) => (
                      <div key={t} className="flex justify-between text-sm border-b pb-1">
                        <span>{t}</span>
                        <span className="font-semibold">{contacts.filter(c => c.type_contact === t).length}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {subTab === 'entrees-sorties' && (
            <div className="space-y-4">
              {/* Fiche(s) du jour — accès direct sans fouiller le classeur
(demande 28/09/2026) : la ou les fiches du jour de service en cours
(aujourd'hui si Vendredi/Dimanche, sinon la prochaine), un clic pour
l'ouvrir. Si aujourd'hui n'est pas un jour de service, propose de
créer une fiche "événement" pour la date du jour. */}
              {(() => {
                const nowLocal = new Date();
                const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
                const todayDow = nowLocal.getDay(); // 0=dim, 5=ven
                const isServiceDay = todayDow === 0 || todayDow === 5;
                const todaysFiches = sortedSeances.filter((s) => s.date === todayStr);
                if (isServiceDay) {
                  return (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          Fiches du jour — {todayStr}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4 flex flex-wrap gap-2">
                        {POSTES_CAM.map((poste) => {
                          const fiche = todaysFiches.find((s) => s.poste === poste);
                          const cam = cameraCouleur(poste);
                          return (
                            <button
                              key={poste}
                              type="button"
                              title={fiche ? `Ouvrir la fiche de ${poste}` : `Créer la fiche de ${poste}`}
                              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition hover:brightness-95 ${
                                fiche
                                  ? cam?.solid || 'bg-primary text-primary-foreground'
                                  : `border-2 bg-background text-foreground ${cam?.edge || 'border-border'}`
                              }`}
                              onClick={() => {
                                if (fiche) {
                                  handleEditSeance(fiche);
                                } else if (canManage()) {
                                  resetSeanceForm();
                                  setSeanceForm((f) => ({ ...f, date: todayStr, poste }));
                                  setSeanceDialogOpen(true);
                                }
                              }}
                            >
                              {poste}
                            </button>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                }
                if (canManage()) {
                  return (
                    <Card className="border-dashed">
                      <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
                        <p className="text-sm text-muted-foreground">
                          Aujourd'hui n'est pas un jour de culte (Vendredi/Dimanche) — pas de fiche pré-remplie.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            resetSeanceForm();
                            setSeanceForm((f) => ({ ...f, date: todayStr }));
                            setSeanceDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          Créer une fiche événement pour aujourd'hui
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }
                return null;
              })()}

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-md flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={seanceSearch}
                    onChange={(e) => setSeanceSearch(e.target.value)}
                    placeholder="Rechercher (date, nom, superviseur, équipement...)"
                    className="pl-8"
                  />
                </div>
                {/* Demande 28/09/2026 : possibilité de tout ouvrir/fermer en
un clic, en plus de l'accordéon année/mois ci-dessous. */}
                <Button type="button" variant="outline" size="sm" onClick={expandAllSeances}>
                  Tout ouvrir
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={collapseAllSeances}>
                  Tout fermer
                </Button>
                {/* Légende : couleur = caméra ; fond blanc / gris en alternance = week-end */}
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                  {Object.entries(CAMERA_COULEURS).map(([n, c]) => (
                    <span
                      key={n}
                      title={`Caméra ${n} : ${c.nom}`}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${c.solid}`}
                    >
                      {n}
                    </span>
                  ))}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <span className="h-3.5 w-5 rounded border bg-background" />
                  <span className="h-3.5 w-5 rounded border bg-muted-foreground/25" />
                  week-ends en alternance
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex overflow-x-auto border-b -mb-px">
                  <button
                    type="button"
                    onClick={() => setFilterSeancePoste('all')}
                    className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      filterSeancePoste === 'all'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    Toutes les caméras
                  </button>
                  {POSTES_CAM.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFilterSeancePoste(p)}
                      className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        filterSeancePoste === p
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {cameraCouleur(p) && <span className={`h-2.5 w-2.5 rounded-full ${cameraCouleur(p).dot}`} />}
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
                {canManage() && (
                  <Dialog open={seanceDialogOpen} onOpenChange={(open) => { if (open) setSeanceDialogOpen(true); else closeFiche(); }}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-seance-btn"><Plus className="w-4 h-4 mr-2" />Nouveau culte</Button>
                    </DialogTrigger>
                    {/* onOpenAutoFocus : sur iPad, le focus automatique sur le champ date
                        ouvrait le sélecteur de date dès l'ouverture de la fiche. */}
                    <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                      {/* Bandeau collé en haut de la fiche : numéro de caméra en
                          très grand, toujours visible pendant le défilement, pour
                          ne pas se tromper de fiche. */}
                      {seanceForm.poste && (() => {
                        const camNum = (seanceForm.poste.match(/\d+/) || [null])[0];
                        const camCouleur = cameraCouleur(seanceForm.poste);
                        const jour = seanceForm.date
                          ? new Date(`${seanceForm.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                          : '';
                        return (
                          <div
                            className="sticky top-0 z-20 -mx-6 -mt-6 flex items-center gap-4 border-b bg-background px-6 py-3 pr-20 shadow-sm"
                            data-testid="fiche-camera-banner"
                          >
                            <div className={`flex h-20 min-w-[5rem] flex-col items-center justify-center rounded-xl px-3 shadow ${camCouleur?.solid || 'bg-primary text-primary-foreground'}`}>
                              <span className="text-[10px] font-semibold uppercase leading-none tracking-widest opacity-80">Caméra</span>
                              <span className="text-5xl font-black leading-none">{camNum || '•'}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xl font-bold">{seanceForm.poste}</p>
                              {jour && (
                                <p className="w-fit max-w-full truncate rounded-md border px-2 py-0.5 text-sm font-bold capitalize text-muted-foreground" style={jourCouleurStyle(seanceForm.date) || undefined}>{jour}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              aria-label="Fermer la fiche"
                              onClick={closeFiche}
                              className="touch-manipulation absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-background text-foreground shadow hover:bg-muted"
                              data-testid="fiche-close-btn"
                            >
                              <X className="h-7 w-7" />
                            </button>
                          </div>
                        );
                      })()}
                      <DialogHeader>
                        <DialogTitle>{seanceEditingId ? 'Modifier le culte' : 'Nouveau culte'}</DialogTitle>
                        <DialogDescription>Enregistrer les entrées/sorties d'équipement</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSeanceSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input type="date" value={seanceForm.date} onChange={(e) => setSeanceForm({ ...seanceForm, date: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Poste *</Label>
                            <Input value={seanceForm.poste} onChange={(e) => setSeanceForm({ ...seanceForm, poste: e.target.value })} required placeholder="ex: CAM 1" />
                          </div>
                          <div className="space-y-2">
                            <Label>Superviseur</Label>
                            <Input value={seanceForm.superviseur} onChange={(e) => setSeanceForm({ ...seanceForm, superviseur: e.target.value })} />
                          </div>
                        </div>
                        {plannedCadreurs.length > 0 && (
                          <div className="rounded-lg border overflow-hidden" data-testid="planned-cadreurs">
                            <div className="bg-muted px-3 py-1.5 text-xs font-semibold text-foreground">
                              Cadreurs prévus au planning ce jour-là — cliquer sur un nom pour l'ajouter à l'équipe
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-32 h-8">Poste</TableHead>
                                  <TableHead className="h-8">Cadreur (C)</TableHead>
                                  <TableHead className="h-8">Assistant (A)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {plannedCadreurs.map((p) => {
                                  const isCurrent =
                                    p.num != null &&
                                    p.num === parseInt((seanceForm.poste || '').replace(/\D+/g, ''), 10);
                                  const nameBtn = (slot, role) => {
                                    const n = p.names.find((x) => x.slot === slot);
                                    if (!n) return <span className="text-muted-foreground">—</span>;
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => addPlannedToEquipe(role, n.nom)}
                                        className="px-2 py-0.5 rounded-md border border-border bg-background hover:bg-primary/10 hover:border-primary/50 text-xs font-medium transition-colors"
                                      >
                                        {n.nom}
                                      </button>
                                    );
                                  };
                                  return (
                                    <TableRow key={p.label} className={isCurrent ? `${cameraCouleur(p.label)?.soft || 'bg-muted'} hover:brightness-95` : ''}>
                                      <TableCell className="py-1.5">
                                        <span className="inline-flex items-center gap-2 font-medium text-sm">
                                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cameraCouleur(p.label)?.solid || 'bg-primary text-primary-foreground'}`}>
                                            {p.num ?? '•'}
                                          </span>
                                          {p.label}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-1.5">{nameBtn(0, 'C')}</TableCell>
                                      <TableCell className="py-1.5">{nameBtn(1, 'A')}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Heure sortie</Label>
                            <Input
                              type="time"
                              step={60}
                              value={heureToInput(seanceForm.horaire_debut)}
                              onChange={(e) => setSeanceForm({ ...seanceForm, horaire_debut: heureFromInput(e.target.value) })}
                              className="max-w-[160px]"
                              data-testid="heure-sortie"
                            />
                            {seanceForm.horaire_debut && !heureToInput(seanceForm.horaire_debut) && (
                              <p className="text-xs text-muted-foreground">Ancienne saisie : « {seanceForm.horaire_debut} » — choisissez l'heure pour la remplacer.</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Équipe (Cadreur / Assistant / Régisseur...)</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addEquipeMembre}>
                              <Plus className="w-3 h-3 mr-1" />Ajouter
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {seanceForm.equipe.map((m, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-2 border rounded p-2">
                                <Input
                                  className="w-28"
                                  placeholder="Rôle (C/A/R)"
                                  value={m.role}
                                  onChange={(e) => updateEquipeMembre(idx, 'role', e.target.value)}
                                />
                                {ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] && (
                                  <span className="text-sm font-bold">
                                    {(m.role || '').trim().toUpperCase()} - {ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()]}
                                  </span>
                                )}
                                {/* Liste selon le rôle de la ligne : C / A = cadreurs (ceux du planning
                                    d'abord), R = régisseurs, autre = tout l'effectif ; filtrée par les
                                    lettres tapées. */}
                                <NameCombobox
                                  value={m.nom}
                                  options={namesForRole(m.role, m.role_code)}
                                  labelFor={camLabelFor}
                                  onChange={(v) => updateEquipeMembre(idx, 'nom', v)}
                                  onCommit={(v) => v && updateEquipeMembre(idx, 'nom', canonName(v))}
                                />
                                {camLabelFor(m.nom) && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/40">
                                    {camLabelFor(m.nom)}
                                  </Badge>
                                )}
                              </div>
                            ))}
                            {seanceForm.equipe.length === 0 && (
                              <p className="text-xs text-muted-foreground">Aucun membre d'équipe ajouté</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Équipements — case Entrée/Sortie par membre (comme la fiche papier)</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addEquipementLigne}>
                              <Plus className="w-3 h-3 mr-1" />Ajouter une ligne
                            </Button>
                          </div>
                          {seanceForm.equipements.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={allChecked('sortie') ? 'secondary' : 'outline'}
                                onClick={() => toggleAllChecks('sortie')}
                                data-testid="check-all-sorties"
                              >
                                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                                {allChecked('sortie') ? 'Décocher toutes les sorties' : 'Tout cocher : sorties'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={allChecked('entree') ? 'secondary' : 'outline'}
                                onClick={() => toggleAllChecks('entree')}
                                data-testid="check-all-entrees"
                              >
                                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                                {allChecked('entree') ? 'Décocher toutes les entrées' : 'Tout cocher : entrées'}
                              </Button>
                            </div>
                          )}
                          <div className="border rounded-lg overflow-auto max-h-[380px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead rowSpan={2} className="min-w-[170px] align-middle">Équipement</TableHead>
                                  {ROLE_CODES.map((rc) => (
                                    <TableHead key={rc} colSpan={2} className="text-center border-l h-8">
                                      <span className="font-bold">{rc} - {ROLE_LABELS_FULL[rc]}</span>
                                    </TableHead>
                                  ))}
                                  <TableHead rowSpan={2} className="w-10" />
                                </TableRow>
                                <TableRow>
                                  {ROLE_CODES.flatMap((rc) =>
                                    ['sortie', 'entree'].map((field) => (
                                      <TableHead key={`${rc}-${field}`} className={`text-center p-1 h-8 ${field === 'sortie' ? 'border-l' : ''}`}>
                                        <button
                                          type="button"
                                          onClick={() => toggleColumnChecks(rc, field)}
                                          title="Cliquer pour tout cocher / décocher cette colonne"
                                          className={`text-[11px] font-semibold px-2 py-0.5 rounded transition-colors ${
                                            field === 'sortie'
                                              ? 'bg-blue-800/20 text-blue-900 dark:text-blue-300 hover:bg-blue-800/30'
                                              : 'bg-sky-300/30 text-sky-800 dark:text-sky-300 hover:bg-sky-300/45'
                                          }`}
                                        >
                                          {field === 'sortie' ? 'Sortie' : 'Entrée'}
                                        </button>
                                      </TableHead>
                                    ))
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {seanceForm.equipements.map((eq, idx) => (
                                  <TableRow key={idx} className={isStorageLine(eq.nom) ? STORAGE_ROW : ''}>
                                    <TableCell className="p-1">
                                      <Input
                                        className="h-8"
                                        placeholder="Équipement (ex: JVC GY HM 750)"
                                        value={eq.nom}
                                        onChange={(e) => updateEquipementNom(idx, e.target.value)}
                                      />
                                      {isAutoCheckExcluded(eq.nom) && (
                                        <span className="block text-[10px] text-muted-foreground px-1 pt-0.5">
                                          pas coché par « Tout cocher »
                                        </span>
                                      )}
                                    </TableCell>
                                    {ROLE_CODES.flatMap((rc) =>
                                      ['sortie', 'entree'].map((field) => {
                                        const checked = !!eq.checks?.[rc]?.[field];
                                        return (
                                          <TableCell
                                            key={`${rc}-${field}`}
                                            className={`text-center p-2 ${field === 'sortie' ? 'border-l' : ''} ${
                                              checked ? (field === 'sortie' ? 'bg-blue-800/15' : 'bg-sky-300/25') : ''
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              className="w-7 h-7 cursor-pointer accent-primary"
                                              checked={checked}
                                              onChange={(e) => updateEquipementCheck(idx, rc, field, e.target.checked)}
                                              aria-label={`${rc} ${field === 'sortie' ? 'sortie' : 'entrée'}`}
                                            />
                                          </TableCell>
                                        );
                                      })
                                    )}
                                    <TableCell className="p-1" />
                                  </TableRow>
                                ))}
                                {seanceForm.equipements.length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                                      Aucune ligne d'équipement — cliquez sur "Ajouter une ligne"
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observations (rédigées par les régisseurs)</Label>
                          <Textarea
                            value={seanceForm.observations}
                            onChange={(e) => setSeanceForm({ ...seanceForm, observations: e.target.value })}
                            rows={2}
                            disabled={!canWriteObservations}
                            placeholder={canWriteObservations ? '' : 'Réservé aux régisseurs'}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Interventions</Label>
                          <Textarea value={seanceForm.interventions} onChange={(e) => setSeanceForm({ ...seanceForm, interventions: e.target.value })} rows={2} />
                        </div>
                          <div className="space-y-2">
                            <Label>Heure entrée</Label>
                            <Input
                              type="time"
                              step={60}
                              value={heureToInput(seanceForm.horaire_fin)}
                              onChange={(e) => setSeanceForm({ ...seanceForm, horaire_fin: heureFromInput(e.target.value) })}
                              className="max-w-[160px]"
                              data-testid="heure-entree"
                            />
                            {seanceForm.horaire_fin && !heureToInput(seanceForm.horaire_fin) && (
                              <p className="text-xs text-muted-foreground">Ancienne saisie : « {seanceForm.horaire_fin} » — choisissez l'heure pour la remplacer.</p>
                            )}
                          </div>
                        {/* Signature unique « Retour matériel » : uniquement au doigt (ou à la
                            souris), grandes zones l'une sous l'autre. */}
                        <div className="space-y-4">
                          {[
                            ['entree', 'Signature — Retour matériel', 'signature_entree'],
                          ].map(([key, label, field]) => {
                            const value = seanceForm[field] || '';
                            return (
                              <div key={key} className="space-y-2 rounded-lg border p-3" data-testid={`signature-${key}`}>
                                <Label className="text-base font-semibold">{label}</Label>
                                {value && !isDrawnSig(value) && (
                                  <p className="text-xs text-muted-foreground">
                                    Ancienne signature (initiales) : « {value} » — signez ci-dessous pour la remplacer.
                                  </p>
                                )}
                                <SignaturePad
                                  value={isDrawnSig(value) ? value : ''}
                                  onChange={(v) => setSeanceForm((f) => ({ ...f, [field]: v }))}
                                />
                                {(() => {
                                  const parField = `${field}_par`;
                                  const parVal = seanceForm[parField] || '';
                                  const suggestions = Array.from(new Set([
                                    ...(seanceForm.equipe || []).map((m) => canonName(m.nom)),
                                    canonName(seanceForm.superviseur),
                                  ].filter(Boolean)));
                                  return (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Cadreur signataire</Label>
                                      <Input
                                        value={parVal}
                                        onChange={(e) => setSeanceForm((f) => ({ ...f, [parField]: e.target.value }))}
                                        placeholder="Nom du signataire"
                                        data-testid={`signataire-${key}`}
                                      />
                                      {suggestions.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                          {suggestions.map((n) => (
                                            <button
                                              key={n}
                                              type="button"
                                              onClick={() => setSeanceForm((f) => ({ ...f, [parField]: n }))}
                                              className={`rounded-full border px-3 py-1 text-sm ${parVal === n ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                                            >
                                              {n}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Régisseur</Label>
                                      <select
                                        value={seanceForm.regisseur_signataire || ''}
                                        onChange={(e) => { const v = e.target.value; setSeanceForm((f) => ({ ...f, regisseur_signataire: v })); }}
                                        className="h-11 w-full rounded-md border bg-background px-3 text-base"
                                        data-testid="regisseur-signataire"
                                      >
                                        <option value="">— Choisir un régisseur —</option>
                                        {Array.from(new Set([
                                          ...regisseursRoster.map((t) => canonName(t.nom)),
                                          seanceForm.regisseur_signataire,
                                        ].filter(Boolean))).sort((x, y) => x.localeCompare(y, 'fr')).map((n) => (
                                          <option key={n} value={n}>{n}</option>
                                        ))}
                                      </select>
                                    </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                        {seanceForm.signature && !seanceForm.signature_entree && (
                          <p className="text-xs text-muted-foreground">
                            Ancienne signature enregistrée : « {sigText(seanceForm.signature)} » — signez ci-dessus (Retour matériel) pour la remplacer.
                          </p>
                        )}
                        <Button type="submit" className="w-full" disabled={seanceSubmitting}>
                          {seanceSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Enregistrer
                        </Button>
                        {seanceEditingId && autoSaveState && (
                          <p className="text-center text-xs text-muted-foreground" data-testid="autosave-state">
                            {autoSaveState === 'saving' ? 'Enregistrement automatique…' : autoSaveState === 'error' ? 'Enregistrement automatique impossible — vérifiez la connexion' : `Enregistré automatiquement${autoSavedAt ? ` à ${autoSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                          </p>
                        )}
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {sortedSeances.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Aucun culte enregistré</p>
                  </CardContent>
                </Card>
              ) : (() => {
                const knownPostes = new Set(POSTES_CAM);
                const groupsOrder = [...POSTES_CAM, ...Array.from(new Set(sortedSeances.map(s => s.poste).filter(p => !knownPostes.has(p))))];
                const visibleGroups = groupsOrder.filter((p) => filterSeancePoste === 'all' || filterSeancePoste === p);
                return visibleGroups.map((poste) => {
                  const group = sortedSeances.filter((s) => s.poste === poste);
                  if (group.length === 0 && filterSeancePoste === 'all') return null;
                  return (
                    <Card key={poste}>
                      <CardHeader
                        className={`py-3 border-b cursor-pointer select-none hover:bg-muted/40 transition-colors ${cameraCouleur(poste)?.soft || ''}`}
                        onClick={() => togglePoste(poste)}
                        role="button"
                        aria-expanded={!collapsedPostes.has(poste)}
                        data-testid={`poste-header-${poste}`}
                      >
                        <CardTitle className="text-xl flex items-center gap-2">
                          {collapsedPostes.has(poste) ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                          {cameraCouleur(poste) && (
                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-black ${cameraCouleur(poste).solid}`}>
                              {parseInt((poste.match(/\d+/) || [''])[0], 10)}
                            </span>
                          )}
                          {poste || 'Non classé'}
                          <Badge variant="secondary" className="font-normal">{group.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      {!collapsedPostes.has(poste) && (
                      <CardContent className="p-0">
                        {group.length === 0 ? (
                          <div className="p-6 text-center">
                            <p className="text-sm text-muted-foreground">Aucun culte enregistré sur ce poste</p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="whitespace-nowrap">Date</TableHead>
                                <TableHead>Superviseur</TableHead>
                                <TableHead>Cadreurs</TableHead>
                                <TableHead className="min-w-[200px]">Commentaire</TableHead>
                                <TableHead className="whitespace-nowrap">Horaires</TableHead>
                                <TableHead className="text-center">Éq.</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const rows = [];
                                const pillsDone = new Set();
                                let currentYear = null;
                                group.forEach((s) => {
                                  const year = (s.date || '').slice(0, 4) || 'Sans date';
                                  const monthNum = (s.date || '').slice(5, 7) || '00';
                                  if (year !== currentYear) {
                                    currentYear = year;
                                    const yearKey = `${poste}__${year}`;
                                    const yearCount = group.filter((g) => (g.date || '').slice(0, 4) === year).length;
                                    const open = isYearOpen(yearKey, year);
                                    rows.push(
                                      <TableRow key={`year-${yearKey}`} className="bg-muted/50 hover:bg-muted cursor-pointer touch-manipulation" onClick={(e) => setYearOpen(poste, year, !open, e.currentTarget)}>
                                        <TableCell colSpan={7} className="p-0 cursor-pointer">
                                          {/* Vrai bouton (et non clic sur la ligne) : fiable au toucher sur iPad. */}
                                          <button
                                            type="button"
                                            aria-expanded={open}
                                            className="flex w-full touch-manipulation items-center gap-2 px-4 py-4 text-left text-lg font-bold"
                                          >
                                            {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            {year}
                                            <Badge variant="outline" className="font-normal text-sm">{yearCount}</Badge>
                                          </button>
                                        </TableCell>
                                      </TableRow>,
                                    );
                                  }
                                  const yearKey = `${poste}__${currentYear}`;
                                  if (!isYearOpen(yearKey, currentYear)) return;
                                  // Fix 28/09/2026 : 2e niveau de regroupement par mois sous
                                  // l'année (mois en cours ouvert par défaut) pour retrouver
                                  // une fiche en année → mois → jour au lieu d'une longue liste.
                                  // Pastilles des mois (une seule fois par année) : un seul mois
                                  // est affiché à la fois, choisi d'un toucher sur sa pastille.
                                  const selMonth = selectedMonthFor(poste, currentYear);
                                  if (!pillsDone.has(currentYear)) {
                                    pillsDone.add(currentYear);
                                    const yearMonths = monthsByPosteYear.get(`${poste}__${currentYear}`) || [];
                                    // Copie figée : currentYear change à chaque tour de boucle, un
                                    // gestionnaire qui l'utiliserait au clic verrait la dernière année.
                                    const pillKey = `${poste}__${currentYear}`;
                                    rows.push(
                                      <TableRow key={`pills-${poste}-${currentYear}`} className="hover:bg-transparent">
                                        <TableCell colSpan={7} className="p-3">
                                          <div className="flex flex-wrap items-center gap-2" data-testid="month-pills">
                                            {/* Liste déroulante native : fiable au toucher, même choix que les pastilles. */}
                                            <select
                                              aria-label="Choisir le mois"
                                              value={selMonth}
                                              onChange={(e) => { const v = e.target.value; setMonthSel((prev) => ({ ...prev, [pillKey]: v })); }}
                                              className="h-11 rounded-md border-2 border-blue-600 bg-background px-3 text-base font-semibold"
                                              data-testid="month-select"
                                            >
                                              {yearMonths.map(({ month }) => (
                                                <option key={month} value={month}>{MOIS_NOMS_FR[parseInt(month, 10) - 1] || month}</option>
                                              ))}
                                            </select>
                                            {yearMonths.map(({ month }) => {
                                              const n = group.filter((g) => (g.date || '').slice(0, 4) === currentYear && (g.date || '').slice(5, 7) === month).length;
                                              const active = month === selMonth;
                                              return (
                                                <button
                                                  key={month}
                                                  type="button"
                                                  onClick={() => setMonthSel((prev) => ({ ...prev, [pillKey]: month }))}
                                                  onPointerUp={() => setMonthSel((prev) => ({ ...prev, [pillKey]: month }))}
                                                  className={`touch-manipulation inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold ${active ? 'border-blue-600 bg-blue-600 text-white shadow' : 'border-border bg-background hover:bg-muted'}`}
                                                >
                                                  {MOIS_NOMS_FR[parseInt(month, 10) - 1] || month}
                                                  <span className={`rounded-full px-2 text-sm ${active ? 'bg-white/25' : 'bg-muted text-muted-foreground'}`}>{n}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </TableCell>
                                      </TableRow>,
                                    );
                                  }
                                  if (monthNum !== selMonth) return;
                                  const vide = isSeanceVide(s);
                                  // Zone bleue entourant les fiches d'un même week-end (vendredi + dimanche).
                                  const monthList = group.filter((g) => (g.date || '').slice(0, 4) === currentYear && (g.date || '').slice(5, 7) === selMonth);
                                  const mIdx = monthList.indexOf(s);
                                  const wk = weekendKey(s.date);
                                  const wkFirst = !!wk && (mIdx <= 0 || weekendKey(monthList[mIdx - 1].date) !== wk);
                                  const wkLast = !!wk && (mIdx >= monthList.length - 1 || weekendKey(monthList[mIdx + 1].date) !== wk);
                                  const isExpanded = expandedSeance === s.id;
                                  // Seul le week-end en cours (le prochain vendredi/dimanche, ou celui d'aujourd'hui) est entouré.
                                  const thisWe = !!wk && wk === weekendKey(nextWeekendRefDate());
                                  const boxClass = thisWe
                                    ? `[&>td:last-child]:border-r-2 [&>td:last-child]:border-r-blue-600 ${wkFirst ? '[&>td]:border-t-2 [&>td]:border-t-blue-600' : ''} ${wkLast && !isExpanded ? '[&>td]:border-b-2 [&>td]:border-b-blue-600' : ''}`
                                    : '';
                                  const boxDetailClass = thisWe
                                    ? `[&>td:last-child]:border-r-2 [&>td:last-child]:border-r-blue-600 ${wkLast ? '[&>td]:border-b-2 [&>td]:border-b-blue-600' : ''}`
                                    : '';
                                  rows.push(
                                <Fragment key={s.id}>
                                  <TableRow
                                    onClick={() => canManage() && handleEditSeance(s)}
                                    className={`${weekendParite(s.date) === 1 ? 'bg-slate-300 hover:bg-slate-400/80 dark:bg-slate-700 dark:hover:bg-slate-600' : 'bg-background hover:bg-muted/40'} ${canManage() ? 'cursor-pointer' : ''} ${boxClass}`}
                                  >
                                    <TableCell className={`font-medium align-top border-l-8 ${cameraCouleur(s.poste)?.border || 'border-l-transparent'}`}>
                                      <div className="flex flex-col gap-1">
                                        <span className="w-fit whitespace-nowrap rounded-md border px-2 py-1 font-bold" style={jourCouleurStyle(s.date) || undefined}>
                                          {s.date
                                            ? new Date(`${s.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
                                            : '-'}
                                        </span>
                                        {vide && (
                                          <Badge variant="outline" className="font-normal text-muted-foreground w-fit">Vide</Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="align-top">{s.superviseur ? canonName(s.superviseur) : <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell className="align-top">
                                      {(() => {
                                        const pr = principauxFor(s);
                                        if (!pr.names.length) return null;
                                        return (
                                          <div className="mb-1 flex flex-wrap gap-1" title={pr.auto ? 'Cadreur principal prévu' : 'Cadreur principal'}>
                                            {pr.names.map((n) => (
                                              <span key={n} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                                ★ {n}
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      })()}
                                      {(s.equipe || []).filter((m) => (m.nom || '').trim()).length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                          {(s.equipe || [])
                                            .filter((m) => (m.nom || '').trim())
                                            .map((m, i) => (
                                              <span
                                                key={i}
                                                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                                                title={ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] || m.role || ''}
                                              >
                                                {m.role && (
                                                  <span className="font-bold text-primary">{(m.role || '').trim().toUpperCase().slice(0, 1)}</span>
                                                )}
                                                {canonName(m.nom)}
                                              </span>
                                            ))}
                                        </div>
                                      ) : principauxFor(s).names.length === 0 ? (
                                        <span className="text-muted-foreground">—</span>
                                      ) : null}
                                    </TableCell>
                                    <TableCell className="align-top">
                                      {s.observations ? (
                                        <p className="text-sm whitespace-pre-wrap break-words line-clamp-3" title={s.observations}>
                                          {s.observations}
                                        </p>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="align-top whitespace-nowrap text-sm">
                                      {[['Sortie', s.horaire_debut, null, null], ['Entrée', s.horaire_fin, s.signature_entree, s.signature_entree_par]].map(([lab, h, sig, par]) => {
                                        const signed = !!sig;
                                        const hasSig = lab === 'Entrée';
                                        return (
                                          <div key={lab} className="flex items-center gap-1.5" title={!hasSig ? undefined : signed ? `Retour matériel signé${par ? ` par ${par}` : ''}` : 'Retour matériel non signé'}>
                                            <span className="w-11 text-xs text-muted-foreground">{lab}</span>
                                            <span className="font-medium tabular-nums">{h || '—'}</span>
                                            {hasSig && (signed ? (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-sm font-bold text-white shadow-sm">
                                                <PenLine className="w-5 h-5" /> Signé
                                              </span>
                                            ) : canManage() ? (
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openSeanceToSign(s); }}
                                                className="touch-manipulation inline-flex items-center gap-1 rounded-full border-2 border-dashed border-amber-500 px-2.5 py-1 text-sm font-semibold text-amber-600 hover:bg-amber-50"
                                                data-testid="open-sign-btn"
                                              >
                                                <Circle className="w-5 h-5" /> À signer
                                              </button>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-amber-500 px-2.5 py-1 text-sm font-semibold text-amber-600">
                                                <Circle className="w-5 h-5" /> À signer
                                              </span>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </TableCell>
                                    <TableCell className="text-center align-top text-muted-foreground">{(s.equipements || []).length}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpandedSeance(expandedSeance === s.id ? null : s.id); }}>
                                          {expandedSeance === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </Button>
                                        {canManage() && (
                                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditSeance(s); }}>
                                            <Edit className="w-4 h-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {expandedSeance === s.id && (
                                    <TableRow key={`${s.id}-detail`} className={boxDetailClass}>
                                      <TableCell colSpan={7} className="bg-muted/30">
                                        <div className="space-y-1 py-2">
                                          {(s.equipe || []).length > 0 && (
                                            <div className="flex flex-wrap gap-3 mb-2">
                                              {(s.equipe || []).map((m, i) => (
                                                <span key={i} className="text-sm"><span className="font-bold">{ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()] ? `${(m.role || '').trim().toUpperCase()} - ${ROLE_LABELS_FULL[(m.role || '').trim().toUpperCase()]}` : m.role}</span> : {m.nom}</span>
                                              ))}
                                            </div>
                                          )}
                                          {(s.horaire_debut || s.horaire_fin) && (
                                            <p className="text-xs text-muted-foreground mb-2">Horaires: {s.horaire_debut || '-'} → {s.horaire_fin || '-'}</p>
                                          )}
                                          {(s.equipements || []).length > 0 && (s.equipements[0].checks) ? (
                                            <div className="overflow-x-auto">
                                              <table className="text-xs border-collapse">
                                                <thead>
                                                  <tr>
                                                    <th className="text-left pr-3 pb-1">Équipement</th>
                                                    {['C', 'A', 'R'].map((rc) => (
                                                      <th key={rc} className="px-2 pb-1 text-center font-bold" colSpan={2}>{rc} - {ROLE_LABELS_FULL[rc]}</th>
                                                    ))}
                                                  </tr>
                                                  <tr className="text-muted-foreground">
                                                    <th></th>
                                                    {['C', 'A', 'R'].map((rc) => (
                                                      <>
                                                        <th key={rc + '-s'} className="px-1 font-normal">Sortie</th>
                                                        <th key={rc + '-e'} className="px-1 font-normal">Entrée</th>
                                                      </>
                                                    ))}
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {(s.equipements || []).map((eq, i) => (
                                                    <tr key={i} className={`border-t ${isStorageLine(eq.nom) ? STORAGE_ROW : ''}`}>
                                                      <td className="pr-3 py-1 font-medium">{eq.nom}</td>
                                                      {['C', 'A', 'R'].map((rc) => (
                                                        <>
                                                          <td key={rc + '-s'} className="px-1 text-center">{eq.checks?.[rc]?.sortie ? '✓' : '—'}</td>
                                                          <td key={rc + '-e'} className="px-1 text-center">{eq.checks?.[rc]?.entree ? '✓' : '—'}</td>
                                                        </>
                                                      ))}
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          ) : (
                                            (s.equipements || []).map((eq, i) => (
                                              <div key={i} className={`flex gap-4 text-sm ${isStorageLine(eq.nom) ? `${STORAGE_ROW} rounded px-1` : ''}`}>
                                                <span className="font-medium">{eq.nom}</span>
                                                <span className="text-muted-foreground">{eq.personne}</span>
                                                {eq.entree && <Badge variant="outline">Entrée</Badge>}
                                                {eq.sortie && <Badge variant="outline">Sortie</Badge>}
                                              </div>
                                            ))
                                          )}
                                          {s.derniere_modif_par && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                              Dernière modification par <span className="font-medium text-foreground">{s.derniere_modif_par}</span>
                                              {s.updated_at ? ` · ${new Date(s.updated_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                                            </p>
                                          )}
                                          {s.observations && <p className="text-xs text-muted-foreground italic mt-2">Obs: {s.observations}</p>}
                                          {s.interventions && <p className="text-xs text-muted-foreground italic mt-2">Interventions: {s.interventions}</p>}
                                          {!s.signature_entree && !s.signature && canManage() && (
                                            <button
                                              type="button"
                                              onClick={() => openSeanceToSign(s)}
                                              className="touch-manipulation mt-2 inline-flex items-center gap-1 rounded-full border-2 border-dashed border-amber-500 px-3 py-1.5 text-sm font-semibold text-amber-600 hover:bg-amber-50"
                                            >
                                              <PenLine className="w-5 h-5" /> À signer — Retour matériel
                                            </button>
                                          )}
                                          {(s.signature_entree || s.signature) && (
                                            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                              {[['Retour matériel', s.signature_entree]].map(([lab, v]) =>
                                                v ? (
                                                  <div key={lab} className="flex items-center gap-2">
                                                    <span>Signature {lab.toLowerCase()} :</span>
                                                    {isDrawnSig(v) ? (
                                                      <img src={v} alt={`Signature ${lab.toLowerCase()}`} className="h-10 rounded border bg-white" />
                                                    ) : (
                                                      <span className="font-medium text-foreground">{v}</span>
                                                    )}
                                                    {s.signature_entree_par && (
                                                      <span className="font-medium text-foreground">— {s.signature_entree_par}</span>
                                                    )}
                                                  </div>
                                                ) : null
                                              )}
                                              {!s.signature_entree && s.signature && (
                                                <span>Signature : <span className="font-medium text-foreground">{sigText(s.signature)}</span></span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Fragment>,
                                  );
                                });
                                return rows;
                              })()}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                      )}
                    </Card>
                  );
                });
              })()}
            </div>
          )}

          {subTab === 'stock' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {isAdmin() && (
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid="manage-categories-btn">
                          <Tag className="w-4 h-4 mr-2" />Catégories
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Gérer les catégories</DialogTitle>
                          <DialogDescription>Ajoutez ou supprimez des catégories de matériel</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nouvelle catégorie..." />
                            <Button onClick={handleAddCategory} disabled={submitting}>
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </Button>
                          </div>
                          <div className="border rounded-lg p-2 max-h-[300px] overflow-y-auto">
                            {categories.map((cat) => (
                              <div key={cat} className="flex items-center justify-between py-2 px-2 hover:bg-muted rounded">
                                <span className="text-sm">{cat}</span>
                                {isSuperAdmin() && !['Caméras', 'Trépied', 'Batterie', 'Câbles', 'Micro', 'Lumière', 'Moniteur', 'Enregistreur', 'Accessoire', 'Autres'].includes(cat) && (
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(cat)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {canManage() && (
                  <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                      <Button className="shadow-lg shadow-primary/20" data-testid="add-mat-btn">
                        <Plus className="w-4 h-4 mr-2" />Ajouter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} du matériel</DialogTitle>
                        <DialogDescription>Remplissez les informations</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Photo</Label>
                          <div className="flex items-center gap-3">
                            {form.photo_url ? (
                              <img src={`${process.env.REACT_APP_BACKEND_URL}${form.photo_url}`} alt="aperçu" className="w-16 h-16 object-cover rounded border" />
                            ) : (
                              <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                                <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <label className="cursor-pointer">
                                <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                                  {uploadingMatPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  {form.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleMatPhotoUpload} disabled={uploadingMatPhoto} />
                              </label>
                              {form.photo_url && (
                                <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}>
                                  Retirer la photo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nom *</Label>
                            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Catégorie *</Label>
                            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
                              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Référence / sous-catégorie</Label>
                          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="ex: CAM 1, HDMI..." />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Quantité *</Label>
                            <Input type="number" min="1" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: parseInt(e.target.value) || 1 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Marque</Label>
                            <Input value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Modèle</Label>
                            <Input value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>N° Série</Label>
                            <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Statut</Label>
                            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {enums.statuts_materiel?.filter(s => s !== 'Archivé').map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Salle</Label>
                            <Input value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Groupe</Label>
                            <Input value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date d'achat</Label>
                            <Input type="date" value={form.date_achat} onChange={(e) => setForm({ ...form, date_achat: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>État</Label>
                            <Input value={form.etat} onChange={(e) => setForm({ ...form, etat: e.target.value })} placeholder="Neuf, bon, usé..." />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={submitting}>
                          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {editingId ? 'Modifier' : 'Ajouter'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Button
                  type="button"
                  variant={showArchivedMat ? 'default' : 'outline'}
                  onClick={() => setShowArchivedMat((v) => !v)}
                  data-testid="toggle-archived-materiel"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {showArchivedMat ? "Retour à l'inventaire" : 'Archivés'}
                </Button>
              </div>
              {showArchivedMat && (
                <p className="text-sm text-muted-foreground">
                  Matériel archivé : retiré de l'inventaire courant. Vous pouvez le remettre en service ou le supprimer définitivement.
                </p>
              )}

              {/* Onglets "feuilles" façon Excel : un onglet par catégorie (CAMÉRAS,
                  CONNECTIQUES, CÂBLES, SON, ... comme dans le fichier INVENTAIRE
                  d'origine), pour cliquer directement sur le titre plutôt que
                  passer par un menu déroulant. */}
              <div className="flex gap-1 overflow-x-auto pb-1 border-b -mb-px">
                <button
                  type="button"
                  onClick={() => setFilterCategorie('all')}
                  className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    filterCategorie === 'all'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  Toutes catégories
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilterCategorie(c)}
                    className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      filterCategorie === c
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <Card>
                <CardContent className="p-0">
                  {sortedMateriel.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucun matériel trouvé</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Photo</TableHead>
                          <SortableHead sortKey="nom">Nom</SortableHead>
                          <SortableHead sortKey="categorie">Catégorie</SortableHead>
                          <SortableHead sortKey="quantite" className="text-center">Qté</SortableHead>
                          <SortableHead sortKey="marque">Marque / Modèle</SortableHead>
                          <SortableHead sortKey="salle">Salle / Groupe</SortableHead>
                          <SortableHead sortKey="etat">État</SortableHead>
                          <SortableHead sortKey="statut">Statut</SortableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedMateriel.map((m) => (
                          <TableRow key={m.id} onClick={() => !m.is_archived && handleEdit(m)} className={m.is_archived ? 'opacity-80' : 'cursor-pointer hover:bg-muted/50'}>
                            <TableCell>
                              <PhotoTile url={m.photo_url} alt={m.nom} Icon={Package} />
                            </TableCell>
                            <TableCell className="font-medium">{m.nom}</TableCell>
                            <TableCell><Badge variant="outline">{m.categorie}</Badge></TableCell>
                            <TableCell className="text-center font-semibold">{m.quantite || 1}</TableCell>
                            <TableCell className="text-muted-foreground">{m.marque} {m.modele}</TableCell>
                            <TableCell className="text-muted-foreground">{m.salle}{m.salle && m.groupe ? ' / ' : ''}{m.groupe}</TableCell>
                            <TableCell className="text-muted-foreground">{m.etat || '-'}</TableCell>
                            <TableCell>{getStatutBadge(m.statut)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canManage() && !m.is_archived && (
                                  <Button size="sm" variant="ghost" title="Modifier" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}><Edit className="w-4 h-4" /></Button>
                                )}
                                {canManage() && !m.is_archived && (
                                  <Button size="sm" variant="ghost" title="Archiver" onClick={(e) => { e.stopPropagation(); handleArchive(m.id); }}><Archive className="w-4 h-4" /></Button>
                                )}
                                {canManage() && m.is_archived && (
                                  <Button size="sm" variant="outline" title="Remettre dans l'inventaire" onClick={(e) => { e.stopPropagation(); handleUnarchive(m.id); }}>
                                    <ArchiveRestore className="w-4 h-4 mr-1" />Restaurer
                                  </Button>
                                )}
                                {canManage() && (
                                  <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer définitivement" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}><Trash2 className="w-4 h-4" /></Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {subTab === 'contact' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Rechercher (nom, contact, téléphone, email...)"
                  className="pl-8"
                />
              </div>
              {/* Demande 28/09/2026 ("sous forme de classeur") : barre
d'onglets façon intercalaires de classeur (même style que les onglets
caméra ailleurs dans l'app) au lieu d'un menu déroulant — on feuillette
les catégories Fournisseur/Location/Réparation comme des sections d'un
classeur plutôt que de choisir dans une liste. */}
              <div className="flex overflow-x-auto border-b -mb-px">
                <button
                  type="button"
                  onClick={() => setFilterContactType('all')}
                  className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    filterContactType === 'all'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                  }`}
                >
                  Tous les types
                </button>
                {CONTACT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterContactType(t)}
                    className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      filterContactType === t
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {t}
                    <Badge variant="secondary" className="ml-1.5 font-normal">{contacts.filter((c) => c.type_contact === t).length}</Badge>
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
                {canManage() && (
                  <Dialog open={contactDialogOpen} onOpenChange={(open) => { setContactDialogOpen(open); if (!open) resetContactForm(); }}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-contact-btn"><Plus className="w-4 h-4 mr-2" />Ajouter un contact</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{contactEditingId ? 'Modifier' : 'Ajouter'} un contact</DialogTitle>
                        <DialogDescription>Fournisseur, location ou réparation</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleContactSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Logo / Photo</Label>
                          <div className="flex items-center gap-3">
                            {contactForm.photo_url ? (
                              <img src={`${process.env.REACT_APP_BACKEND_URL}${contactForm.photo_url}`} alt="aperçu" className="w-16 h-16 object-contain rounded border bg-white" />
                            ) : (
                              <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                                <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <label className="cursor-pointer">
                                <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                                  {uploadingContactPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  {contactForm.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleContactPhotoUpload} disabled={uploadingContactPhoto} />
                              </label>
                              {contactForm.photo_url && (
                                <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={() => setContactForm((f) => ({ ...f, photo_url: '' }))}>
                                  Retirer la photo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nom *</Label>
                            <Input value={contactForm.nom} onChange={(e) => setContactForm({ ...contactForm, nom: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Type *</Label>
                            <Select value={contactForm.type_contact} onValueChange={(v) => setContactForm({ ...contactForm, type_contact: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CONTACT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Contact (personne)</Label>
                              <Input value={contactForm.contact} onChange={(e) => setContactForm({ ...contactForm, contact: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Téléphone</Label>
                              <Input value={contactForm.telephone} onChange={(e) => setContactForm({ ...contactForm, telephone: e.target.value })} />
                            </div>
                          </div>
                          {contactForm.contacts_secondaires.map((p, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                              <div className="space-y-2">
                                <Input placeholder="Autre contact (personne)" value={p.contact} onChange={(e) => updateContactSecondaire(idx, 'contact', e.target.value)} />
                              </div>
                              <div className="flex gap-2 items-center">
                                <Input placeholder="Téléphone" value={p.telephone} onChange={(e) => updateContactSecondaire(idx, 'telephone', e.target.value)} />
                                <Button type="button" size="icon" variant="ghost" onClick={() => removeContactSecondaire(idx)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="outline" onClick={addContactSecondaire}>
                            <Plus className="w-3.5 h-3.5 mr-1" />Ajouter une autre personne à contacter
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Adresse</Label>
                          <Input value={contactForm.adresse} onChange={(e) => setContactForm({ ...contactForm, adresse: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Catégorie</Label>
                            <Input value={contactForm.categorie} onChange={(e) => setContactForm({ ...contactForm, categorie: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Site web</Label>
                            <Input value={contactForm.site} onChange={(e) => setContactForm({ ...contactForm, site: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>N° SIRET</Label>
                            <Input value={contactForm.n_siret} onChange={(e) => setContactForm({ ...contactForm, n_siret: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>N° Client</Label>
                            <Input value={contactForm.n_client} onChange={(e) => setContactForm({ ...contactForm, n_client: e.target.value })} />
                          </div>
                        </div>
                        {contactForm.type_contact === 'Réparation' && (
                          <div className="space-y-2">
                            <Label>Notation</Label>
                            <Input value={contactForm.notation} onChange={(e) => setContactForm({ ...contactForm, notation: e.target.value })} />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Notes / Commentaire</Label>
                          <Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={contactSubmitting}>
                          {contactSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {contactEditingId ? 'Modifier' : 'Ajouter'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {CONTACT_TYPES.filter((t) => filterContactType === 'all' || filterContactType === t).map((t) => {
                const group = filteredContacts.filter((c) => c.type_contact === t);
                const isCollapsed = collapsedContactTypes.has(t);
                return (
                  <Card key={t}>
                    <CardHeader
                      className="py-3 border-b cursor-pointer select-none"
                      onClick={() => toggleContactType(t)}
                    >
                      <CardTitle className="text-base flex items-center gap-2">
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        {t}
                        <Badge variant="secondary" className="font-normal">{group.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    {!isCollapsed && (
                    <CardContent className="p-0">
                      {group.length === 0 ? (
                        <div className="p-6 text-center">
                          <p className="text-sm text-muted-foreground">Aucun contact dans cette catégorie</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">Logo</TableHead>
                              <TableHead>Nom</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Téléphone</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.map((c) => (
                              <TableRow key={c.id} onClick={() => handleEditContact(c)} className="cursor-pointer hover:bg-muted/50">
                                <TableCell>
                                  <PhotoTile url={c.photo_url} alt={c.nom} contain Icon={Contact2} />
                                </TableCell>
                                <TableCell className="font-medium">{c.nom}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {c.contact ? (
                                    <div>{c.contact}{c.telephone ? ` : ${c.telephone}` : ''}</div>
                                  ) : (!c.contacts_secondaires || c.contacts_secondaires.length === 0) ? '-' : null}
                                  {(c.contacts_secondaires || []).map((p, idx) => (
                                    <div key={idx}>{p.contact || '-'}{p.telephone ? ` : ${p.telephone}` : ''}</div>
                                  ))}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{c.telephone || '-'}</TableCell>
                                <TableCell className="text-muted-foreground">{c.email || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    {canManage() && (
                                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditContact(c); }}><Edit className="w-4 h-4" /></Button>
                                    )}
                                    {canManage() && (
                                      <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer ce contact" onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id); }}><Trash2 className="w-4 h-4" /></Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {subTab === 'incidents' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={incidentSearch}
                  onChange={(e) => setIncidentSearch(e.target.value)}
                  placeholder="Rechercher (date, description, équipement, personne...)"
                  className="pl-8"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant={showArchivedInc ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowArchivedInc((v) => !v)}
                  data-testid="toggle-archived-incidents"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {showArchivedInc ? 'Retour aux incidents' : 'Archivés'}
                </Button>
                {showArchivedInc && (
                  <p className="text-sm text-muted-foreground">
                    Incidents archivés : vous pouvez les remettre dans la liste ou les supprimer définitivement.
                  </p>
                )}
              </div>
              {/* Onglets "feuilles" façon Excel : un onglet cliquable par caméra,
                  comme les feuilles CAMERA 1 / CAMERA 2 / ... du classeur d'origine. */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex gap-1 overflow-x-auto pb-1 border-b -mb-px flex-1">
                  <button
                    type="button"
                    onClick={() => setFilterIncidentPoste('all')}
                    className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      filterIncidentPoste === 'all'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    Toutes les caméras
                  </button>
                  {POSTES_CAM.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFilterIncidentPoste(p)}
                      className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        filterIncidentPoste === p
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {cameraCouleur(p) && <span className={`h-2.5 w-2.5 rounded-full ${cameraCouleur(p).dot}`} />}
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
                {canManage() && (
                  <Dialog open={incidentDialogOpen} onOpenChange={(open) => { setIncidentDialogOpen(open); if (!open) resetIncidentForm(); }}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-incident-btn"><Plus className="w-4 h-4 mr-2" />Signaler un incident</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{incidentEditingId ? 'Modifier' : 'Signaler'} un incident</DialogTitle>
                        <DialogDescription>Problème matériel ou technique rencontré sur un poste caméra</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleIncidentSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Poste *</Label>
                            <Select value={incidentForm.poste} onValueChange={(v) => setIncidentForm({ ...incidentForm, poste: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {POSTES_CAM.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={incidentForm.date} onChange={(e) => setIncidentForm({ ...incidentForm, date: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Fréquence</Label>
                            <Select value={incidentForm.frequence} onValueChange={(v) => setIncidentForm({ ...incidentForm, frequence: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FREQUENCE_OPTIONS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Cadreur / Régisseur</Label>
                            <Input value={incidentForm.cadreur_regisseur} onChange={(e) => setIncidentForm({ ...incidentForm, cadreur_regisseur: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Équipement concerné</Label>
                            <Input value={incidentForm.equipement_concerne} onChange={(e) => setIncidentForm({ ...incidentForm, equipement_concerne: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description du problème *</Label>
                          <Textarea value={incidentForm.description_probleme} onChange={(e) => setIncidentForm({ ...incidentForm, description_probleme: e.target.value })} rows={2} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Résolution</Label>
                          <Textarea value={incidentForm.resolution} onChange={(e) => setIncidentForm({ ...incidentForm, resolution: e.target.value })} rows={2} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date de fin</Label>
                            <Input type="date" value={incidentForm.date_fin} onChange={(e) => setIncidentForm({ ...incidentForm, date_fin: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Responsable du suivi</Label>
                            <Input value={incidentForm.responsable_suivi} onChange={(e) => setIncidentForm({ ...incidentForm, responsable_suivi: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Commentaire</Label>
                          <Textarea value={incidentForm.commentaire} onChange={(e) => setIncidentForm({ ...incidentForm, commentaire: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={incidentSubmitting}>
                          {incidentSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {incidentEditingId ? 'Modifier' : 'Signaler'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {(() => {
                const knownPostes = new Set(POSTES_CAM);
                const groupsOrder = [...POSTES_CAM, ...Array.from(new Set(filteredIncidents.map(i => i.poste).filter(p => !knownPostes.has(p))))];
                const visibleGroups = groupsOrder.filter((p) => filterIncidentPoste === 'all' || filterIncidentPoste === p);
                return visibleGroups.map((poste) => {
                  const group = filteredIncidents.filter((i) => i.poste === poste);
                  if (group.length === 0 && filterIncidentPoste === 'all') return null;
                  return (
                    <Card key={poste}>
                      <CardHeader className={`py-3 border-b ${cameraCouleur(poste)?.soft || ''}`}>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {cameraCouleur(poste) && (
                            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-black ${cameraCouleur(poste).solid}`}>
                              {parseInt((poste.match(/\d+/) || [''])[0], 10)}
                            </span>
                          )}
                          {poste || 'Non classé'}
                          <Badge variant="secondary" className="font-normal">{group.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {group.length === 0 ? (
                          <div className="p-6 text-center">
                            <p className="text-sm text-muted-foreground">Aucun incident signalé sur ce poste</p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Cadreur / Régisseur</TableHead>
                                <TableHead>Équipement</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.map((i) => (
                                <TableRow key={i.id} onClick={() => !i.is_archived && handleEditIncident(i)} className={i.is_archived ? 'opacity-80' : 'cursor-pointer hover:bg-muted/50'}>
                                  <TableCell className={`text-muted-foreground border-l-8 ${cameraCouleur(i.poste)?.border || 'border-l-transparent'}`}>{i.date || '-'}</TableCell>
                                  <TableCell className="text-muted-foreground">{i.cadreur_regisseur || '-'}</TableCell>
                                  <TableCell className="text-muted-foreground">{i.equipement_concerne || '-'}</TableCell>
                                  <TableCell className="max-w-[280px] truncate" title={i.description_probleme}>{i.description_probleme}</TableCell>
                                  <TableCell>
                                    {i.date_fin ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Résolu</Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">En cours</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{i.responsable_suivi || '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      {canManage() && !i.is_archived && (
                                        <Button size="sm" variant="ghost" title="Modifier" onClick={(e) => { e.stopPropagation(); handleEditIncident(i); }}><Edit className="w-4 h-4" /></Button>
                                      )}
                                      {canManage() && !i.is_archived && (
                                        <Button size="sm" variant="ghost" title="Archiver" onClick={(e) => { e.stopPropagation(); handleArchiveIncident(i.id); }}><Archive className="w-4 h-4" /></Button>
                                      )}
                                      {canManage() && i.is_archived && (
                                        <Button size="sm" variant="outline" title="Remettre dans la liste" onClick={(e) => { e.stopPropagation(); handleUnarchiveIncident(i.id); }}>
                                          <ArchiveRestore className="w-4 h-4 mr-1" />Restaurer
                                        </Button>
                                      )}
                                      {canManage() && (
                                        <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer définitivement" onClick={(e) => { e.stopPropagation(); handleDeleteIncident(i.id); }}><Trash2 className="w-4 h-4" /></Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
