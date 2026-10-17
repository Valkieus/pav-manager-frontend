import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import RegisseurNotes from '../components/RegisseurNotes';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { TableHead } from '../components/ui/table';
import { toast } from 'sonner';
import { Loader2, LayoutDashboard, ArrowRightLeft, StickyNote, Boxes, Contact2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { sanitizeContainer } from '../lib/safeHtml';
import {
  downloadOrShareFile,
  downloadStatusMessage,
  reserveTabForIOSFallback,
} from '../utils/fileDownload';
import { API, CONTACT_TYPES, DEFAULT_PRINCIPAUX, extractPlanned, formatNom, nomKey, sigSummary, sigText, withDefaultEquipe } from './logistique/shared';
import { LogistiqueIncidents } from './logistique/LogistiqueIncidents';
import { LogistiqueContacts } from './logistique/LogistiqueContacts';
import { LogistiqueStock } from './logistique/LogistiqueStock';
import { LogistiqueEntreesSorties } from './logistique/LogistiqueEntreesSorties';
import { LogistiqueDashboard } from './logistique/LogistiqueDashboard';
import { LogistiqueHeader } from './logistique/LogistiqueHeader';
// Bibliothèque lourde (~330 Ko) : chargée seulement quand on exporte, pas à l'ouverture de la page.
let XLSX;
const loadXLSX = async () => { XLSX = XLSX || (await import('xlsx-js-style')); };
































// Lignes d'office de l'équipe : Cadreur, Assistant, Régisseur (jamais à ajouter à la main).
const defaultEquipe = () => ['C', 'A', 'R'].map((role) => ({ role, nom: '' }));







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
  // Caméras indisponibles (ex. Caméra 1 jusqu'au 31/12) : {poste: {until}} — visibles mais verrouillées.
  const [camIndispo, setCamIndispo] = useState({});
  const loadCamIndispo = async () => { try { setCamIndispo((await axios.get(`${API}/logistique/cameras-indispo`)).data || {}); } catch { /* verrouillage non affiché */ } };
  const fmtUntil = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR') : '');
  const reactivateCam = async (poste) => {
    try { setCamIndispo((await axios.put(`${API}/logistique/cameras-indispo/${encodeURIComponent(poste)}`, { disabled: false })).data || {}); toast.success(`${poste} réactivée`); } catch (e) { toast.error(e.response?.data?.detail || 'Action impossible'); }
  };
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
    loadCamIndispo();
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
      await loadXLSX();
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
    sanitizeContainer(container);
    document.body.appendChild(container);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
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
      <LogistiqueHeader
            MOIS_NOMS_FR={MOIS_NOMS_FR}
            SUB_TABS={SUB_TABS}
            exportDialogOpen={exportDialogOpen}
            exportSel={exportSel}
            exportingPdf={exportingPdf}
            exportingXlsx={exportingXlsx}
            handleExportRegisseursPdf={handleExportRegisseursPdf}
            handleExportRegisseursXlsx={handleExportRegisseursXlsx}
            runSelectedExport={runSelectedExport}
            seanceYears={seanceYears}
            setExportDialogOpen={setExportDialogOpen}
            setExportSel={setExportSel}
            setSubTab={setSubTab}
            subTab={subTab}
          />
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
            <LogistiqueDashboard
            canManage={canManage}
            canonName={canonName}
            contacts={contacts}
            handleEditSeance={handleEditSeance}
            isSeanceVide={isSeanceVide}
            setSubTab={setSubTab}
            sortedSeances={sortedSeances}
            stats={stats}
          />
          )}

          {subTab === 'entrees-sorties' && (
            <LogistiqueEntreesSorties
            MOIS_NOMS_FR={MOIS_NOMS_FR}
            ROLE_CODES={ROLE_CODES}
            ROLE_LABELS_FULL={ROLE_LABELS_FULL}
            STORAGE_ROW={STORAGE_ROW}
            addEquipeMembre={addEquipeMembre}
            addEquipementLigne={addEquipementLigne}
            addPlannedToEquipe={addPlannedToEquipe}
            allChecked={allChecked}
            autoSaveState={autoSaveState}
            autoSavedAt={autoSavedAt}
            camIndispo={camIndispo}
            camLabelFor={camLabelFor}
            canManage={canManage}
            canWriteObservations={canWriteObservations}
            canonName={canonName}
            closeFiche={closeFiche}
            collapseAllSeances={collapseAllSeances}
            collapsedPostes={collapsedPostes}
            expandAllSeances={expandAllSeances}
            expandedSeance={expandedSeance}
            filterSeancePoste={filterSeancePoste}
            fmtUntil={fmtUntil}
            handleEditSeance={handleEditSeance}
            handleSeanceSubmit={handleSeanceSubmit}
            isAdmin={isAdmin}
            isAutoCheckExcluded={isAutoCheckExcluded}
            isSeanceVide={isSeanceVide}
            isStorageLine={isStorageLine}
            isYearOpen={isYearOpen}
            monthsByPosteYear={monthsByPosteYear}
            namesForRole={namesForRole}
            openSeanceToSign={openSeanceToSign}
            plannedCadreurs={plannedCadreurs}
            principauxFor={principauxFor}
            reactivateCam={reactivateCam}
            regisseursRoster={regisseursRoster}
            resetSeanceForm={resetSeanceForm}
            seanceDialogOpen={seanceDialogOpen}
            seanceEditingId={seanceEditingId}
            seanceForm={seanceForm}
            seanceSearch={seanceSearch}
            seanceSubmitting={seanceSubmitting}
            selectedMonthFor={selectedMonthFor}
            setExpandedSeance={setExpandedSeance}
            setFilterSeancePoste={setFilterSeancePoste}
            setMonthSel={setMonthSel}
            setSeanceDialogOpen={setSeanceDialogOpen}
            setSeanceForm={setSeanceForm}
            setSeanceSearch={setSeanceSearch}
            setYearOpen={setYearOpen}
            sortedSeances={sortedSeances}
            toggleAllChecks={toggleAllChecks}
            toggleColumnChecks={toggleColumnChecks}
            togglePoste={togglePoste}
            updateEquipeMembre={updateEquipeMembre}
            updateEquipementCheck={updateEquipementCheck}
            updateEquipementNom={updateEquipementNom}
          />
          )}

          {subTab === 'stock' && (
            <LogistiqueStock
            SortableHead={SortableHead}
            canManage={canManage}
            categories={categories}
            categoryDialogOpen={categoryDialogOpen}
            dialogOpen={dialogOpen}
            editingId={editingId}
            enums={enums}
            filterCategorie={filterCategorie}
            form={form}
            getStatutBadge={getStatutBadge}
            handleAddCategory={handleAddCategory}
            handleArchive={handleArchive}
            handleDelete={handleDelete}
            handleDeleteCategory={handleDeleteCategory}
            handleEdit={handleEdit}
            handleMatPhotoUpload={handleMatPhotoUpload}
            handleSubmit={handleSubmit}
            handleUnarchive={handleUnarchive}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            newCategoryName={newCategoryName}
            resetForm={resetForm}
            searchTerm={searchTerm}
            setCategoryDialogOpen={setCategoryDialogOpen}
            setDialogOpen={setDialogOpen}
            setFilterCategorie={setFilterCategorie}
            setForm={setForm}
            setNewCategoryName={setNewCategoryName}
            setSearchTerm={setSearchTerm}
            setShowArchivedMat={setShowArchivedMat}
            showArchivedMat={showArchivedMat}
            sortedMateriel={sortedMateriel}
            submitting={submitting}
            uploadingMatPhoto={uploadingMatPhoto}
          />
          )}

          {subTab === 'contact' && (
            <LogistiqueContacts
            addContactSecondaire={addContactSecondaire}
            canManage={canManage}
            collapsedContactTypes={collapsedContactTypes}
            contactDialogOpen={contactDialogOpen}
            contactEditingId={contactEditingId}
            contactForm={contactForm}
            contactSearch={contactSearch}
            contactSubmitting={contactSubmitting}
            contacts={contacts}
            filterContactType={filterContactType}
            filteredContacts={filteredContacts}
            handleContactPhotoUpload={handleContactPhotoUpload}
            handleContactSubmit={handleContactSubmit}
            handleDeleteContact={handleDeleteContact}
            handleEditContact={handleEditContact}
            removeContactSecondaire={removeContactSecondaire}
            resetContactForm={resetContactForm}
            setContactDialogOpen={setContactDialogOpen}
            setContactForm={setContactForm}
            setContactSearch={setContactSearch}
            setFilterContactType={setFilterContactType}
            toggleContactType={toggleContactType}
            updateContactSecondaire={updateContactSecondaire}
            uploadingContactPhoto={uploadingContactPhoto}
          />
          )}

          {subTab === 'incidents' && (
            <LogistiqueIncidents
            canManage={canManage}
            filterIncidentPoste={filterIncidentPoste}
            filteredIncidents={filteredIncidents}
            handleArchiveIncident={handleArchiveIncident}
            handleDeleteIncident={handleDeleteIncident}
            handleEditIncident={handleEditIncident}
            handleIncidentSubmit={handleIncidentSubmit}
            handleUnarchiveIncident={handleUnarchiveIncident}
            incidentDialogOpen={incidentDialogOpen}
            incidentEditingId={incidentEditingId}
            incidentForm={incidentForm}
            incidentSearch={incidentSearch}
            incidentSubmitting={incidentSubmitting}
            resetIncidentForm={resetIncidentForm}
            setFilterIncidentPoste={setFilterIncidentPoste}
            setIncidentDialogOpen={setIncidentDialogOpen}
            setIncidentForm={setIncidentForm}
            setIncidentSearch={setIncidentSearch}
            setShowArchivedInc={setShowArchivedInc}
            showArchivedInc={showArchivedInc}
          />
          )}
        </>
      )}
    </div>
  );
}
