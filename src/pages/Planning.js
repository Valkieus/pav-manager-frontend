import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Eye, Loader2, ChevronRight, Plus, Trash2, CalendarOff, Ban, Combine, Split, X, Pencil, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import PlanningEvenementSection from "./PlanningEvenementSection";
import { useLiveDoc } from '../lib/useLiveDoc';
import {
  getCachedTechniciens,
  setCachedTechniciens,
} from "../lib/technicienCache";
import {
  downloadOrShareFile,
  downloadStatusMessage,
  reserveTabForIOSFallback,
} from "../utils/fileDownload";
import { API, DEFAULT_SECTIONS, MOIS_NOMS, THEME, canonPoste, delimiterGroup, slugPoste, stripAccents, withCamera7, withCamera8 } from './planning/constants';
import { buildPlanningExportSVG, buildPlanningExportXLSX, loadXLSX, svgToPngDataUrl, svgToStoryPngDataUrl } from './planning/exportUtils';
import { PlanningCell } from './planning/cells';
import { useCellSelection } from './planning/useCellSelection';
import { findNoteAbsence } from './planning/absenceNotes';
import { computeConflicts, fmtIso } from './planning/conflicts';
import { EditDatesDialog } from './planning/EditDatesDialog';
import { CopyDaysDialog } from './planning/CopyDaysDialog';
import { DuplicateDialog } from './planning/DuplicateDialog';
import { EditCategoryDialog } from './planning/EditCategoryDialog';
import { AddCategoryDialog } from './planning/AddCategoryDialog';
import { EditSectionDialog } from './planning/EditSectionDialog';
import { EditDateLabelDialog } from './planning/EditDateLabelDialog';
import { EditHeaderDialog } from './planning/EditHeaderDialog';
import { PlanningAssignPanel } from './planning/PlanningAssignPanel';
import { PlanningTableArea } from './planning/PlanningTableArea';
import { PlanningNotesCard } from './planning/PlanningNotesCard';
import { PlanningMonthNav } from './planning/PlanningMonthNav';
import { PlanningHeaderBar } from './planning/PlanningHeaderBar';










 






































export default function Planning() {
  const { canValidate, isAdmin, canManage, isSuperAdmin, user } = useAuth();
  // "Publier" est réservé à Coordination+ (Coordination, Admin, Super Admin)
  // — un Responsable remplit le brouillon mais ne peut pas le rendre visible
  // aux Techniciens lui-même.
  const isGestionnairePlus = ["Super Admin", "Admin", "Coordination"].includes(
    user?.niveau_acces,
  );
  const isTechnicien = user?.niveau_acces === "Technicien";
  // Les plannings événements ne sont plus un onglet à part : "Planning
  // événement" bascule ce composant sur PlanningEvenementSection (liste +
  // éditeur dédié) sans toucher au rendu du planning équipe habituel.
  const [evenementView, setEvenementView] = useState(false);
  const [techniciens, setTechniciens] = useState([]);
  const [planning, setPlanning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Brouillon/publié : un planning fraîchement créé ou modifié par un
  // Responsable+ reste invisible pour les Techniciens tant qu'un
  // Coordination+ n'a pas cliqué "Publier". `notPublished` capture le cas où
  // le backend a explicitement signalé un brouillon non publié (404
  // "not_published") plutôt qu'une absence totale de planning.
  const [notPublished, setNotPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Enregistrement automatique : 'idle' | 'pending' | 'saving' | 'saved' | 'error'
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle");
  const autoSaveTimerRef = useRef(null);
  const skipNextAutoSaveRef = useRef(true);
  // Historique local "Retour en arrière" : pile de snapshots (max 20) de la
  // tranche d'état modifiable du planning (grille, notes/absences, sections,
  // cases grisées, en-têtes, libellés de date, casse d'affichage). Portée à
  // la session en cours uniquement — remise à zéro à chaque chargement de
  // mois/planning, jamais persistée. Chaque snapshot est cloné en profondeur
  // pour ne jamais être affecté par une mutation ultérieure de l'état React.
  const [undoStack, setUndoStack] = useState([]);
  const prevUndoSnapshotRef = useRef(null);
  const skipNextUndoCaptureRef = useRef(true);
  const isUndoingRef = useRef(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(2026);
  const [activeDay, setActiveDay] = useState("vendredi");
  // Planning scoping for the Responsable role — a Responsable in a
  // poste/section-scoped group (e.g. Planning_cadreurs) can only fill in
  // cells within their scope; enforced for real on the backend, mirrored
  // here so the UI reflects it instead of just erroring on save.
  const [planningScope, setPlanningScope] = useState({
    is_restricted: false,
    full_control: true,
    scope: [],
  });
  const [dates, setDates] = useState({ dimanche: [], vendredi: [] });
  const [affectations, setAffectations] = useState({});
  const affectationsRef = useRef({});
  affectationsRef.current = affectations;
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [notes, setNotes] = useState({ dimanche: "", vendredi: "" });
  const [absences, setAbsences] = useState({ dimanche: "", vendredi: "" });
  const [ignoredConflicts, setIgnoredConflicts] = useState([]); // alertes ignorées (Coordination+), enregistrées avec le planning
  const [publishRecapOpen, setPublishRecapOpen] = useState(false);
  const [flashConflictId, setFlashConflictId] = useState(null); // « Voir » : la case reste en rouge quelques secondes, même hors mode édition
  const [monthAbsences, setMonthAbsences] = useState([]);
  const [editSectionDialog, setEditSectionDialog] = useState(null);
  const [editRoleLabel, setEditRoleLabel] = useState("");
  const [editRoleSeparateur, setEditRoleSeparateur] = useState(false);

  // Category (section) add/rename
  const [addCategoryDialog, setAddCategoryDialog] = useState(null); // tableKey or null
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editCategoryDialog, setEditCategoryDialog] = useState(null); // { tableKey, sectionIdx, day }
  // Repli/dépli des catégories (REGIE, CADREURS, etc.) — demande 21/09/2026,
  // même logique que les catégories repliables de Groupes & Droits. Clé
  // = tableKey + nom de catégorie (partagée entre Vendredi/Dimanche pour
  // que la préférence de repli suive l'utilisateur d'un onglet à l'autre).
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const toggleCategoryCollapse = (tableKey, sectionName) => {
    const key = `${tableKey}::${sectionName}`;
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  // Panneau "Déjà affectés / Pas encore affectés" en tiroir coulissant
  // depuis la droite — demande 21/09/2026 : sur PC il s'ouvre au survol
  // et se referme quand la souris s'en va ; sur téléphone (pas de hover)
  // on tape sur l'onglet pour ouvrir/fermer. Remplace l'ancien <aside>
  // qui s'empilait tout en bas de la page sur mobile.
  const [rosterPanelOpen, setRosterPanelOpen] = useState(false);
  // Vue du panneau : « Mon équipe » (membres des équipes/branches de la
  // personne connectée) ou « Tous ». Par défaut « Mon équipe » dès que le
  // compte a une équipe.
  const [rosterScope, setRosterScope] = useState(null);
  const [editCategoryLabel, setEditCategoryLabel] = useState("");

  // Group/merge roles (e.g. "Caméra 1-6")
  const [groupModeSection, setGroupModeSection] = useState(null); // { tableKey, sectionIdx, day }
  const [selectedForGroup, setSelectedForGroup] = useState([]);

  // Single-cell gray toggle — blockedCells[`${roleKey}_${slotIdx}`][dateIdx] = true
  // grays just that one case, independent of the whole-row `role.blocked` flag.
  const [cellBlockMode, setCellBlockMode] = useState(false);
  const [blockedCells, setBlockedCells] = useState({});

  // Coordination+ voit le planning en lecture simple par défaut ; il faut
  // cliquer "Editer" pour faire apparaître les boutons/champs d'édition
  // (griser, ajouter poste/catégorie, éditer dates, en-tête, absences/notes,
  // panneau d'affectation...). N'affecte jamais la vue Technicien, qui reste
  // toujours en lecture seule.
  const [planningEditMode, setPlanningEditMode] = useState(false);
  // Structure (lignes) modifiable : Admin+ partout ; un Responsable dont le groupe a ce droit, uniquement dans les sections de son périmètre.
  const structScope = planningScope.structure_scope || [];
  const canStruct = (sectionName) =>
    canValidate() && planningEditMode && (!planningScope.is_restricted || structScope.includes(String(sectionName || "").trim().toUpperCase()));
  const toggleEditMode = () => {
    setPlanningEditMode((v) => {
      const next = !v;
      if (!next) {
        // On quitte le mode édition : referme les sous-modes en cours pour
        // éviter un état incohérent (case grisée en attente, groupement...).
        setCellBlockMode(false);
        setGroupModeSection(null);
        setSelectedForGroup([]);
      }
      return next;
    });
  };

  // Date editing
  const [editDatesDialog, setEditDatesDialog] = useState(false);
  const [editingDates, setEditingDates] = useState([]);
  const [newDate, setNewDate] = useState("");

  // Custom header title/subtitle per day — empty/absent means "use the
  // auto-generated MOIS ANNEE - JOUR / RDV à... text" (unchanged behavior).
  const [titreOverrides, setTitreOverrides] = useState({
    dimanche: { titre: "", sous_titre: "" },
    vendredi: { titre: "", sous_titre: "" },
  });
  const [editHeaderDialog, setEditHeaderDialog] = useState(false);
  const [headerDraft, setHeaderDraft] = useState({ titre: "", sous_titre: "" });

  // Free-text label shown under a specific date (e.g. guest name, "Fête des
  // pères"), keyed by day then by ISO date string.
  const [dateLabels, setDateLabels] = useState({ dimanche: {}, vendredi: {} });
  // Affichage des noms sur la grille : normal / upper / lower / capitalize.
  // Réglable uniquement par Coordination+ en mode édition ; pur CSS
  // text-transform côté affichage, la donnée stockée reste inchangée.
  // Fix 28/09/2026 (retour utilisateur) : les prénoms s'affichent en
  // MAJUSCULE par défaut (écran, export PNG et export Excel partagent
  // tous le même état `affichageNoms` / `nameCase`) — l'utilisateur garde
  // la possibilité de changer via le sélecteur "Affichage des noms".
  const [affichageNoms, setAffichageNoms] = useState("upper");
  const [editDateLabelDialog, setEditDateLabelDialog] = useState(null); // ISO date string or null
  const [dateLabelDraft, setDateLabelDraft] = useState("");

  const printRef = useRef(null);

  // Memoized technicien names for performance. Deduped defensively — a
  // fiche could list the same poste in both poste_principal and
  // postes_secondaires (bad legacy data), or the roster could momentarily
  // contain a repeated entry, and neither should ever show a name twice in
  // an assignment dropdown.
  const technicienNames = useMemo(
    () => Array.from(new Set(techniciens.map((t) => t.nom))).sort(),
    [techniciens],
  );

  // Names filtered per poste category (poste_principal or postes_secondaires
  // on the fiche Effectif). Falls back to the full roster for any poste
  // nobody has been tagged with yet, so an incomplete backfill never blocks
  // an assignment — it just means the dropdown isn't narrowed down yet.
  const namesByPoste = useMemo(() => {
    const map = {};
    techniciens.forEach((t) => {
      const postes = new Set(
        [t.poste_principal, ...(t.postes_secondaires || [])].filter(Boolean),
      );
      postes.forEach((p) => {
        if (!map[p]) map[p] = new Set();
        map[p].add(t.nom);
      });
    });
    const sorted = {};
    Object.keys(map).forEach((p) => {
      sorted[p] = Array.from(map[p]).sort();
    });
    return sorted;
  }, [techniciens]);

  const namesForPoste = useCallback(
    (poste) => {
      const list = namesByPoste[poste];
      return list && list.length > 0 ? list : technicienNames;
    },
    [namesByPoste, technicienNames],
  );

  // Every distinct poste category present in the active day's two tables —
  // used to render exactly the datalists that are actually referenced,
  // rather than one for every possible poste (including custom/renamed roles
  // whose canonPoste() falls back to the label itself).
  const distinctPostesToday = useMemo(() => {
    const daySecs = sections[activeDay] || DEFAULT_SECTIONS[activeDay];
    const set = new Set();
    ["table1", "table2"].forEach((tableKey) => {
      (daySecs[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => {
          const p = canonPoste(section.name, role.label);
          if (p) set.add(p);
        });
      });
    });
    return Array.from(set);
  }, [sections, activeDay]);

  useEffect(() => {
    axios
      .get(`${API}/me/planning-scope`)
      .then((res) => setPlanningScope(res.data))
      .catch(() =>
        setPlanningScope({
          is_restricted: false,
          full_control: true,
          scope: [],
        }),
      );
  }, []);

  // A cell is editable if the user can validate at all, and — for a scoped
  // Responsable — only within their group's sections/postes. Mirrors the
  // real enforcement on PUT /planning server-side; this just keeps the UI
  // from offering edits that would be rejected on save.
  const canEditPlanningCell = useCallback(
    (sectionName, roleKey, roleLabel = "") => {
      if (!planningEditMode) return false;
      // Droits de grille fondés sur les GROUPES (et non le seul rôle) : le
      // backend renvoie grid_editable / grid_full / grid_scope, y compris
      // pour un compte Coordination dans un groupe à périmètre Planning.
      const byGroup = planningScope.grid_editable !== undefined;
      if (byGroup && !planningScope.grid_editable) return false;
      if (!byGroup && !canValidate()) return false;
      if (byGroup ? planningScope.grid_full : !planningScope.is_restricted)
        return true;
      const scope = byGroup
        ? planningScope.grid_scope || []
        : planningScope.scope || [];
      if (scope.includes(sectionName)) return true;
      if (
        scope.some((pattern) => pattern && roleKey.includes(pattern))
      )
        return true;
      // Les postes « apprenti » font partie de la même équipe que les autres
      // postes de la ligne (animateur_vfx_1/2/3 -> apprenti animateur) :
      // toute entrée du groupe qui couvre cette équipe couvre aussi
      // l'apprenti, que l'équipe soit reconnue par la clé de la ligne ou par
      // son libellé (ligne créée à la main avec une autre clé). Miroir de
      // _scope_allows côté backend.
      const words = (text) =>
        stripAccents(text || "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((w) => w && !/^\d+$/.test(w));
      const isApprenti =
        roleKey.includes("apprenti") || words(roleLabel).includes("apprenti");
      if (!isApprenti) return false;
      const teamWords = new Set(
        [roleKey.replace(/^v_/, ""), roleLabel].flatMap((src) =>
          words(src).filter((w) => w !== "apprenti"),
        ),
      );
      return scope.some((pattern) => {
        const first = words(pattern).filter((w) => w !== "apprenti")[0];
        if (!first) return false;
        // égalité, ou abréviation d'au moins 4 lettres (anim. -> animateur)
        return [...teamWords].some(
          (tw) =>
            tw === first ||
            (tw.length >= 4 && first.startsWith(tw)) ||
            (first.length >= 4 && tw.startsWith(first)),
        );
      });
    },
    [planningScope, canValidate, planningEditMode],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Chargée dans son propre try/catch : /techniciens renvoie 403 pour
      // un Technicien (accès complet réservé à Responsable+, coordonnées
      // personnelles incluses), ce qui plantait tout fetchData avant même
      // d'atteindre le planning lui-même — d'où la Planning général vide
      // avec juste un toast d'erreur générique pour ce rôle. On retombe sur
      // /techniciens/roster (nom + poste, sans données sensibles, ouvert à
      // tout compte connecté) pour que l'affichage des noms assignés
      // continue de fonctionner en lecture seule.
      const cached = getCachedTechniciens();
      if (cached) {
        setTechniciens(cached);
      } else {
        try {
          const techRes = await axios.get(`${API}/techniciens`);
          setCachedTechniciens(techRes.data);
          setTechniciens(techRes.data);
        } catch (techErr) {
          try {
            const rosterRes = await axios.get(`${API}/techniciens/roster`);
            setTechniciens(rosterRes.data);
          } catch (rosterErr) {
            // Aucune des deux routes n'a répondu (hors-ligne, backend down...) :
            // on laisse la liste vide plutôt que de bloquer l'affichage du planning.
          }
        }
      }

      try {
        const planningRes = await axios.get(
          `${API}/planning/${currentYear}/${currentMonth}`,
        );
        setPlanning(planningRes.data);
        setNotPublished(false);
        setDates(planningRes.data.dates || { dimanche: [], vendredi: [] });
        setAffectations(planningRes.data.affectations || {});
        setSections(planningRes.data.sections ? withCamera7(planningRes.data.sections, currentYear, currentMonth) : withCamera8(withCamera7(DEFAULT_SECTIONS, currentYear, currentMonth), currentYear, currentMonth));
        setNotes(planningRes.data.notes || { dimanche: "", vendredi: "" });
        setAbsences(
          planningRes.data.absences || { dimanche: "", vendredi: "" },
        );
        setBlockedCells(planningRes.data.blocked_cells || {});
        setTitreOverrides(
          planningRes.data.titre_overrides || {
            dimanche: { titre: "", sous_titre: "" },
            vendredi: { titre: "", sous_titre: "" },
          },
        );
        setDateLabels(
          planningRes.data.date_labels || { dimanche: {}, vendredi: {} },
        );
        setAffichageNoms(planningRes.data.affichage_noms || "upper");
        setIgnoredConflicts(planningRes.data.ignored_conflicts || []);
      } catch (e) {
        // "not_published" : le planning existe mais reste un brouillon —
        // distingué de "aucun planning" pour afficher le bon message.
        setNotPublished(e.response?.data?.detail === "not_published");
        const dimanches = getDaysOfMonth(currentYear, currentMonth, 0);
        const vendredis = getDaysOfMonth(currentYear, currentMonth, 5);
        setDates({ dimanche: dimanches, vendredi: vendredis });
        setAffectations({});
        setSections(withCamera8(withCamera7(DEFAULT_SECTIONS, currentYear, currentMonth), currentYear, currentMonth));
        setNotes({ dimanche: "", vendredi: "" });
        setAbsences({ dimanche: "", vendredi: "" });
        setBlockedCells({});
        setTitreOverrides({
          dimanche: { titre: "", sous_titre: "" },
          vendredi: { titre: "", sous_titre: "" },
        });
        setDateLabels({ dimanche: {}, vendredi: {} });
        setAffichageNoms("upper");
        setIgnoredConflicts([]);
        setPlanning(null);
      }
      // Un changement de mois recharge des données fraîches — la prochaine
      // modification d'état déclenchée par ce chargement ne doit pas être
      // interprétée comme une action utilisateur par l'autosave.
      skipNextAutoSaveRef.current = true;
      // Idem pour l'historique "Retour en arrière" : un changement de mois
      // n'est pas une action utilisateur annulable, et l'historique d'un
      // mois n'a pas de sens une fois qu'on a changé de mois.
      skipNextUndoCaptureRef.current = true;
      prevUndoSnapshotRef.current = null;
      setUndoStack([]);
      setAutoSaveStatus("idle");
    } catch (err) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Coordination+ get a heads-up banner listing any self-declared absences
  // that overlap the month currently on screen, so they can plan around
  // them. Scoped server-side to the user's own branch(es) already.
  useEffect(() => {
    if (!canManage()) {
      setMonthAbsences([]);
      return;
    }
    axios
      .get(`${API}/absences`, {
        params: { mois: currentMonth, annee: currentYear },
      })
      .then((res) => setMonthAbsences(res.data))
      .catch(() => setMonthAbsences([]));
  }, [currentMonth, currentYear, canManage]);

  // Après l'ajout / la suppression d'une absence au nom d'une personne : le
  // serveur a écrit la ligne dans le champ « Absences de l'équipe » du
  // planning. On relit les absences du mois et on fusionne ce texte avec la
  // saisie locale (sans jamais écraser ce qui est en cours de frappe), pour
  // que l'autosave n'efface pas la ligne ajoutée côté serveur.
  const refreshAbsencesAfterChange = async (opts) => {
    try {
      const res = await axios.get(`${API}/absences`, {
        params: { mois: currentMonth, annee: currentYear },
      });
      setMonthAbsences(res.data);
    } catch (e) {
      // silencieux : la liste se rafraîchira au prochain chargement
    }
    try {
      const pl = await axios.get(
        `${API}/planning/${currentYear}/${currentMonth}`,
      );
      const serverAbs = pl.data.absences || {};
      setAbsences((prev) => {
        const next = { ...prev };
        ["dimanche", "vendredi"].forEach((day) => {
          const removedMarker = opts?.removed
            ? `${opts.removed.full_name} — absent du ${opts.removed.date_debut} au ${opts.removed.date_fin}`
            : null;
          const local = (prev[day] || "")
            .split("\n")
            .filter((l) => l.trim())
            .filter((l) => !(removedMarker && l.startsWith(removedMarker)));
          const server = (serverAbs[day] || "").split("\n").filter((l) => l.trim());
          // On garde les lignes locales, on ajoute celles du serveur absentes
          // en local, sauf si la ligne locale a été retirée volontairement
          // (absence supprimée côté serveur => elle n'est plus dans `server`).
          const merged = [...local, ...server.filter((l) => !local.includes(l))];
          next[day] = merged.join("\n");
        });
        return next;
      });
    } catch (e) {
      // pas de planning ce mois-ci : rien à fusionner
    }
  };

  // Keep isPrinting in sync with the native print dialog so the Absences
  // and Notes columns can both be hidden from the printed output.
  useEffect(() => {
    const onBeforePrint = () => setIsPrinting(true);
    const onAfterPrint = () => setIsPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const getDaysOfMonth = (year, month, dayOfWeek) => {
    const days = [];
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === dayOfWeek) {
        // Build the date string from local components (never toISOString(),
        // which converts to UTC and can shift the day by one depending on
        // the browser's timezone).
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        days.push(`${y}-${m}-${d}`);
      }
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    const day = date.getDay() === 0 ? "Dimanche" : "Vendredi";
    return `${day} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  // Petit popup rouge éphémère quand on met dans le planning le nom d'une
  // personne absente ce jour-là (absence déclarée avec dates : par elle-même
  // ou saisie dans « Absences de l'équipe »). Pour une ligne libre déjà
  // présente dans « Absences de l'équipe » (sans dates exploitables), un
  // avertissement orange rappelle la ligne. Dédoublonné par personne + jour
  // pour ne pas se répéter à chaque frappe.
  const [absentAlert, setAbsentAlert] = useState(null); // fenêtre « cette personne est absente »
  const warnIfAbsent = useCallback(
    (value, dateIdx) => {
      const norm = (t) =>
        stripAccents(t || "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
      const typed = norm(value);
      if (typed.length === 0 || typed.join("").length < 3) return;
      const iso = (dates[activeDay] || [])[dateIdx];
      if (!iso) return;
      const hit = (monthAbsences || []).find((a) => {
        if (!(a.date_debut <= iso && iso <= a.date_fin)) return false;
        const tokens = norm(a.full_name);
        return typed.every((t) => tokens.includes(t));
      });
      if (hit) {
        const fmtD = (d) =>
          new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
          });
        setAbsentAlert({
          level: "error",
          title: `${hit.full_name} est absent(e) ce jour-là`,
          text: `${hit.raison || "Absence déclarée"} — du ${fmtD(hit.date_debut)} au ${fmtD(hit.date_fin)}. Vérifie avant de l'affecter.`,
        });
        return;
      }
      // Notes / « Absences de l'équipe » : « Nom — du 18/10 au 25/10 » vaut absence sur cette période.
      const noted = findNoteAbsence(
        [notes.vendredi, notes.dimanche, absences.vendredi, absences.dimanche],
        typed,
        iso,
      );
      if (noted) {
        setAbsentAlert({
          level: "error",
          title: "Absent(e) ce jour-là d'après les notes",
          text: `« ${noted} » — vérifie avant de l'affecter.`,
        });
        return;
      }
      const line = (absences[activeDay] || "")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => {
          const head = norm(l.split(/[:—–-]/)[0]);
          return head.length > 0 && typed.every((t) => head.includes(t));
        });
      if (line) {
        setAbsentAlert({
          level: "warning",
          title: "À vérifier : absence possible",
          text: `« ${line} » figure dans « Absences de l'équipe » pour ce jour.`,
        });
      }
    },
    [monthAbsences, dates, activeDay, absences, notes],
  );

  const handleAffectationChange = useCallback(
    (roleKey, slotIdx, dateIdx, value) => {
      const key = `${roleKey}_${slotIdx}`;
      setAffectations((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          [dateIdx]: value === "__none__" ? "" : value,
        },
      }));
      if (value && value !== "__none__") warnIfAbsent(value, dateIdx);
    },
    [warnIfAbsent],
  );

  // Édition à plusieurs en direct : présence (qui est dans quelle case) et
  // mise à jour des cases modifiées par les collègues.
  const liveRef = useRef(null);
  const live = useLiveDoc({
    kind: "planning",
    id: planning?.id,
    enabled: !!planning?.id && canManage(),
    getLocal: () => affectationsRef.current,
    onApply: setAffectations,
    cellPrefix: `${activeDay}|`,
  });
  liveRef.current = live;
  const liveSync = live.sync;
  useEffect(() => {
    if (planning?.id) liveSync(planning.updated_at, planning.affectations);
  }, [planning, liveSync]);

  const buildPlanningPayload = useCallback(
    () => ({
      mois: currentMonth,
      annee: currentYear,
      dates,
      affectations,
      sections,
      notes,
      absences,
      blocked_cells: blockedCells,
      titre_overrides: titreOverrides,
      date_labels: dateLabels,
      affichage_noms: affichageNoms,
      ignored_conflicts: ignoredConflicts,
      base_affectations: liveRef.current ? liveRef.current.getBase() : undefined,
    }),
    [
      currentMonth,
      currentYear,
      dates,
      affectations,
      sections,
      notes,
      absences,
      blockedCells,
      titreOverrides,
      dateLabels,
      affichageNoms,
      ignoredConflicts,
    ],
  );

  const handleSave = async () => {
    setSaving(true);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      const data = buildPlanningPayload();
      if (planning?.id) {
        await axios.put(`${API}/planning/${planning.id}`, data);
      } else {
        await axios.post(`${API}/planning`, data);
      }
      toast.success("Planning enregistré");
      setAutoSaveStatus("saved");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
      setAutoSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  // Clonage profond d'un snapshot de la tranche d'état modifiable du
  // planning — utilisé par l'historique "Retour en arrière". structuredClone
  // est disponible dans tous les navigateurs ciblés ; on retombe sur un
  // clonage JSON si jamais il ne l'était pas (même contenu : uniquement des
  // objets/tableaux/primitives sérialisables, comme le confirme
  // buildPlanningPayload plus haut).
  const cloneUndoSnapshot = useCallback((snapshot) => {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(snapshot);
      } catch {
        // fallthrough sur le clonage JSON ci-dessous
      }
    }
    return JSON.parse(JSON.stringify(snapshot));
  }, []);

  // Historique "Retour en arrière" : à chaque changement de la tranche
  // d'état modifiable (la même liste de dépendances que l'autosave
  // ci-dessous), on empile le snapshot *précédent* — donc l'état dans
  // lequel il faut revenir si l'utilisateur clique sur "Retour en arrière".
  // - skipNextUndoCaptureRef évite de capturer le premier rendu après un
  //   chargement (fetchData / changement de mois), comme skipNextAutoSaveRef
  //   le fait déjà pour l'autosave.
  // - isUndoingRef évite qu'un undo ne s'ajoute lui-même à la pile (ce qui
  //   transformerait "Retour en arrière" en un simple aller-retour infini) ;
  //   l'undo continue cependant de laisser tourner l'autosave normalement,
  //   pour que la restauration soit bien persistée côté serveur.
  // Portée à la session en cours : la pile n'est jamais persistée et est
  // limitée aux 20 dernières actions.
  useEffect(() => {
    if (!canManage()) return;
    const snapshot = {
      affectations,
      notes,
      absences,
      sections,
      blockedCells,
      titreOverrides,
      dateLabels,
      affichageNoms,
    };
    if (skipNextUndoCaptureRef.current) {
      skipNextUndoCaptureRef.current = false;
      prevUndoSnapshotRef.current = snapshot;
      return;
    }
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      prevUndoSnapshotRef.current = snapshot;
      return;
    }
    const previous = prevUndoSnapshotRef.current;
    prevUndoSnapshotRef.current = snapshot;
    if (!previous) return;
    setUndoStack((stack) => [...stack, cloneUndoSnapshot(previous)].slice(-20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    affectations,
    notes,
    absences,
    sections,
    blockedCells,
    titreOverrides,
    dateLabels,
    affichageNoms,
  ]);

  // Annule la dernière action locale (case affectée/désaffectée, ligne
  // ajoutée/supprimée, absence/note modifiée, catégorie renommée,
  // réordonnancement...) en restaurant le snapshot précédent, puis laisse
  // l'autosave existant re-sauvegarder ce snapshot côté serveur — la
  // restauration n'est donc pas qu'un flash visuel, elle est bien persistée.
  const handleUndo = useCallback(() => {
    if (!canManage() || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    isUndoingRef.current = true;
    setAffectations(last.affectations);
    setNotes(last.notes);
    setAbsences(last.absences);
    setSections(last.sections);
    setBlockedCells(last.blockedCells);
    setTitreOverrides(last.titreOverrides);
    setDateLabels(last.dateLabels);
    setAffichageNoms(last.affichageNoms);
    setUndoStack((stack) => stack.slice(0, -1));
    toast.success("Dernière action annulée");
  }, [canManage, undoStack]);

  // Sélection multiple façon Excel (glisser, Maj+clic, Suppr, Ctrl+C/X/V/D/R/A/Z, Alt+glisser pour déplacer).
  useCellSelection({
    activeDay,
    canWrite: canManage() && planningEditMode,
    affectations,
    setAffectations,
    onUndo: handleUndo,
  });


  // Enregistrement automatique : dès qu'une donnée éditable change (grille,
  // absences/notes, sections, en-tête, libellés de date...), une sauvegarde
  // se déclenche 1,5s après la dernière frappe — plus besoin de penser à
  // cliquer "Enregistrer" pour que les autres utilisateurs voient la mise à
  // jour. Le premier rendu après un chargement (fetchData) est ignoré via
  // skipNextAutoSaveRef pour ne jamais sauvegarder "pour rien" juste après
  // avoir ouvert la page ou changé de mois.
  useEffect(() => {
    if (!canManage()) return undefined;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return undefined;
    }
    setAutoSaveStatus("pending");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        const data = buildPlanningPayload();
        if (planning?.id) {
          const res = await axios.put(`${API}/planning/${planning.id}`, data);
          live.applyServer(res.data.affectations, res.data.updated_at, null, data.affectations);
        } else {
          const res = await axios.post(`${API}/planning`, data);
          setPlanning(res.data);
        }
        setAutoSaveStatus("saved");
      } catch (err) {
        setAutoSaveStatus("error");
        toast.error(
          err.response?.data?.detail || "Échec de l'enregistrement automatique",
        );
      }
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    affectations,
    notes,
    absences,
    sections,
    blockedCells,
    titreOverrides,
    dateLabels,
    affichageNoms,
    ignoredConflicts,
  ]);

  const handlePublish = async () => {
    if (!planning?.id) return;
    setPublishing(true);
    try {
      const res = await axios.put(`${API}/planning/${planning.id}/publish`);
      setPlanning(res.data);
      toast.success("Planning publié — visible pour tous les Techniciens");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setPublishing(false);
    }
  };

  // Remplit les cases vides du mois affiché avec ce qui était en place le
  // mois précédent — demande explicite d'un Responsable pour éviter de
  // ressaisir chaque mois. Respecte le même périmètre par groupe qu'une
  // édition manuelle (le backend ne copie que ce que l'utilisateur a le
  // droit d'éditer) ; sauve d'abord le planning courant pour ne pas perdre
  // des saisies en cours, puis appelle l'endpoint dédié.
  const [duplicating, setDuplicating] = useState(false);
  // Contrôle total : on choisit QUELLES sections dupliquer, en voyant qui les
  // a modifiées en dernier (section_last_edit). Sans contrôle total : le
  // comportement historique (périmètre du groupe, simple confirmation).
  const [duplicateDialog, setDuplicateDialog] = useState(false);
  const [duplicateChoice, setDuplicateChoice] = useState({});
  const duplicateSectionNames = useMemo(() => {
    const names = [];
    Object.values(sections || {}).forEach((tables) =>
      Object.values(tables || {}).forEach((secs) =>
        (Array.isArray(secs) ? secs : []).forEach((sec) => {
          if (sec?.name && !names.includes(sec.name)) names.push(sec.name);
        }),
      ),
    );
    return names;
  }, [sections]);
  const openDuplicate = () => {
    if (!planning?.id) {
      toast.error(
        "Enregistrez d'abord ce planning avant de dupliquer le mois précédent.",
      );
      return;
    }
    if (planningScope.grid_full) {
      const init = {};
      duplicateSectionNames.forEach((n) => (init[n] = true));
      setDuplicateChoice(init);
      setDuplicateDialog(true);
    } else {
      handleDuplicateLastMonth();
    }
  };
  const handleDuplicateLastMonth = async (chosenSections) => {
    if (!planning?.id) {
      toast.error(
        "Enregistrez d'abord ce planning avant de dupliquer le mois précédent.",
      );
      return;
    }
    if (
      !chosenSections &&
      !window.confirm(
        `Remplir les cases vides de ${MOIS_NOMS[currentMonth - 1]} ${currentYear} avec les affectations du mois précédent ?\n\n` +
          `Seules les cases actuellement vides et dans votre périmètre seront complétées — rien n'est écrasé.`,
      )
    )
      return;
    setDuplicating(true);
    try {
      await handleSave();
      const res = await axios.post(
        `${API}/planning/${planning.id}/duplicate-last-month`,
        chosenSections ? { sections: chosenSections } : undefined,
      );
      setPlanning(res.data.planning);
      const { filled_count, skipped_out_of_scope } = res.data;
      if (filled_count === 0) {
        toast.info(
          skipped_out_of_scope > 0
            ? "Aucune case remplie : les cases restantes sont hors de votre périmètre."
            : "Aucune case à remplir — soit tout est déjà rempli, soit le mois précédent n'avait rien à cet endroit.",
        );
      } else {
        toast.success(
          `${filled_count} case(s) remplie(s) depuis le mois précédent.` +
            (skipped_out_of_scope > 0
              ? ` (${skipped_out_of_scope} hors de votre périmètre, ignorée(s))`
              : ""),
        );
      }
      fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de la duplication",
      );
    } finally {
      setDuplicating(false);
    }
  };

  // Demande de Nathalie (22/08/2026) : copier rapidement ce qui a été saisi un
  // jour (Dimanche ou Vendredi) vers l'autre jour du même mois, plutôt que de
  // ressaisir deux fois la même équipe quand elle est identique les deux
  // jours. Purement côté frontend (état local uniquement) : la correspondance
  // entre les rôles des deux jours se fait par nom de base (le préfixe "v_"
  // identifie les clés Vendredi, cf. handleResetPlanningVierge plus haut) en
  // lisant les sections REELLES de CE planning (pas DEFAULT_SECTIONS), pour
  // que ça marche même si les catégories ont été renommées/ajoutées. Écrase
  // les cases du jour cible (comportement voulu : "copier" doit remplacer,
  // pas juste compléter) — l'autosave existant se charge d'enregistrer.
  const [copyDaysDialog, setCopyDaysDialog] = useState(false);
  const [copyDaysDirection, setCopyDaysDirection] = useState(
    "dimanche_to_vendredi",
  );

  const handleCopyBetweenDays = () => {
    const fromDay =
      copyDaysDirection === "dimanche_to_vendredi" ? "dimanche" : "vendredi";
    const toDay =
      copyDaysDirection === "dimanche_to_vendredi" ? "vendredi" : "dimanche";
    const baseKey = (key, day) =>
      day === "vendredi" && key.startsWith("v_") ? key.slice(2) : key;

    const fromDatesCount = (dates[fromDay] || []).length;
    const toDatesCount = (dates[toDay] || []).length;
    const fromLabel = fromDay === "dimanche" ? "Dimanche" : "Vendredi";
    const toLabel = toDay === "dimanche" ? "Dimanche" : "Vendredi";

    // Vendredi et Dimanche n'ont pas forcement le meme nombre de dates dans
    // le mois (ex: 4 vendredis mais 5 dimanches). La copie se fait case par
    // case (1ere case -> 1ere case, etc.), donc si les deux jours n'ont pas
    // le meme nombre de dates, une copie directe peut associer un nom a la
    // mauvaise semaine. On previent avant de continuer (cause du bug ou
    // un nom apparaissait comme affecte a une date ou ce n'etait pas le cas).
    if (fromDatesCount !== toDatesCount) {
      const confirmed = window.confirm(
        `${fromLabel} a ${fromDatesCount} date(s) ce mois-ci et ${toLabel} en a ${toDatesCount}. ` +
          `La copie se fait case par case (1ere vers 1ere, 2eme vers 2eme, etc.), donc certains noms ` +
          `pourraient se retrouver sur la mauvaise semaine. Continuer quand meme ?`,
      );
      if (!confirmed) return;
    }

    const fromSections = sections[fromDay] || DEFAULT_SECTIONS[fromDay];
    const toSections = sections[toDay] || DEFAULT_SECTIONS[toDay];

    // toRolesByBase also carries the destination section's name so we can
    // gate each write through the SAME canEditPlanningCell() check used for
    // ordinary manual edits — a scoped Responsable (e.g. Laura, scoped to
    // CADREURS) must only be able to copy INTO her own section's cells.
    // Without this, this purely-frontend copy silently built a diff across
    // every branch, and the backend's update_planning scope check (which
    // rejects the WHOLE save if any changed key is out of scope) then
    // either 403'd the entire autosave or, worse, gave a false "copié"
    // success toast before that save even ran (user feedback 26/09/2026).
    const toRolesByBase = {};
    ["table1", "table2"].forEach((tableKey) => {
      (toSections[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => {
          toRolesByBase[baseKey(role.key, toDay)] = {
            role,
            sectionName: section.name,
          };
        });
      });
    });

    let copiedCount = 0;
    let skippedOutOfScope = 0;
    const updated = { ...affectations };
    ["table1", "table2"].forEach((tableKey) => {
      (fromSections[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => {
          const entry = toRolesByBase[baseKey(role.key, fromDay)];
          if (!entry) return; // pas de rôle équivalent en face — on ignore silencieusement
          const { role: target, sectionName } = entry;
          const maxSlots = Math.max(role.slots || 1, target.slots || 1);
          for (let slotIdx = 0; slotIdx < maxSlots; slotIdx++) {
            const rawVal = affectations[`${role.key}_${slotIdx}`];
            // On tronque a la longueur reelle du jour de destination pour
            // ne pas laisser trainer une valeur sur un index de date qui
            // n'existe pas (ou plus) en face.
            const val = Array.isArray(rawVal)
              ? rawVal.slice(0, toDatesCount)
              : rawVal;
            const hasContent = Array.isArray(val) ? val.some((v) => v) : !!val;
            if (!hasContent) continue;
            if (!canEditPlanningCell(sectionName, target.key, target.label)) {
              skippedOutOfScope++;
              continue;
            }
            updated[`${target.key}_${slotIdx}`] = val;
            copiedCount++;
          }
        });
      });
    });

    setAffectations(updated);
    setCopyDaysDialog(false);
    if (copiedCount === 0) {
      toast.info(
        skippedOutOfScope > 0
          ? "Rien à copier : les cases remplies côté "
            .concat(fromLabel)
            .concat(" sont hors de votre périmètre.")
          : `Rien à copier : aucune case remplie côté ${fromLabel}, ou aucun rôle équivalent côté ${toLabel}.`,
      );
    } else {
      toast.success(
        `${copiedCount} case(s) copiée(s) de ${fromLabel} vers ${toLabel} — enregistrement automatique en cours.` +
          (skippedOutOfScope > 0
            ? ` (${skippedOutOfScope} hors de votre périmètre, ignorée(s))`
            : ""),
      );
    }
  };

  const handleUnpublish = async () => {
    if (!planning?.id) return;
    if (
      !window.confirm(
        "Repasser ce planning en brouillon ? Il redeviendra invisible pour les Techniciens.",
      )
    )
      return;
    setPublishing(true);
    try {
      const res = await axios.put(`${API}/planning/${planning.id}/unpublish`);
      setPlanning(res.data);
      toast.success("Planning repassé en brouillon");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setPublishing(false);
    }
  };

  // Wipes just the currently active day (Dimanche or Vendredi) back to its
  // default blank state — sections, affectations, cases grisées, notes,
  // absences, en-tête personnalisé et libellés de date. Dimanche role keys
  // have no prefix and Vendredi keys are all prefixed "v_", so clearing one
  // day's keys never touches the other day's data. This only updates local
  // state — the user still has to click "Enregistrer" to persist it, same
  // as every other edit in this page.
  const handleResetPlanningVierge = () => {
    const dayLabel = activeDay === "dimanche" ? "Dimanche" : "Vendredi";
    if (
      !window.confirm(
        `Réinitialiser complètement le planning ${dayLabel} de ${MOIS_NOMS[currentMonth - 1]} ${currentYear} ?\n\n` +
          `Toutes les affectations, cases grisées, notes, absences et personnalisations de ce jour seront effacées. ` +
          `L'autre jour (${dayLabel === "Dimanche" ? "Vendredi" : "Dimanche"}) n'est pas concerné.\n\n` +
          `Cliquez ensuite sur "Enregistrer" pour confirmer.`,
      )
    )
      return;

    const currentDaySections =
      sections[activeDay] || DEFAULT_SECTIONS[activeDay];
    const keysToClear = new Set();
    ["table1", "table2"].forEach((tableKey) => {
      (currentDaySections[tableKey] || []).forEach((section) => {
        section.roles.forEach((role) => keysToClear.add(role.key));
      });
    });

    const stripKeys = (obj) => {
      const updated = { ...obj };
      keysToClear.forEach((key) => {
        for (let slotIdx = 0; slotIdx < 6; slotIdx++) {
          delete updated[`${key}_${slotIdx}`];
        }
      });
      return updated;
    };

    setSections((prev) => ({
      ...prev,
      [activeDay]: withCamera8(withCamera7(DEFAULT_SECTIONS, currentYear, currentMonth), currentYear, currentMonth)[activeDay],
    }));
    setAffectations(stripKeys);
    setBlockedCells(stripKeys);
    setNotes((prev) => ({ ...prev, [activeDay]: "" }));
    setAbsences((prev) => ({ ...prev, [activeDay]: "" }));
    setTitreOverrides((prev) => ({
      ...prev,
      [activeDay]: { titre: "", sous_titre: "" },
    }));
    setDateLabels((prev) => ({ ...prev, [activeDay]: {} }));
    toast.success(
      `Planning ${dayLabel} vidé — cliquez sur "Enregistrer" pour confirmer`,
    );
  };

  const openEditHeader = () => {
    setHeaderDraft({
      titre: titreOverrides[activeDay]?.titre || "",
      sous_titre: titreOverrides[activeDay]?.sous_titre || "",
    });
    setEditHeaderDialog(true);
  };

  const saveHeaderDraft = () => {
    setTitreOverrides((prev) => ({ ...prev, [activeDay]: { ...headerDraft } }));
    setEditHeaderDialog(false);
    toast.success(
      'En-tête mis à jour — cliquez sur "Enregistrer" pour confirmer',
    );
  };

  const resetHeaderDraft = () => {
    setTitreOverrides((prev) => ({
      ...prev,
      [activeDay]: { titre: "", sous_titre: "" },
    }));
    setEditHeaderDialog(false);
    toast.success(
      'En-tête réinitialisé — cliquez sur "Enregistrer" pour confirmer',
    );
  };

  const openEditDateLabel = (dateStr) => {
    setDateLabelDraft(dateLabels[activeDay]?.[dateStr] || "");
    setEditDateLabelDialog(dateStr);
  };

  const saveDateLabelDraft = () => {
    setDateLabels((prev) => ({
      ...prev,
      [activeDay]: {
        ...prev[activeDay],
        [editDateLabelDialog]: dateLabelDraft,
      },
    }));
    setEditDateLabelDialog(null);
  };

  const clearDateLabelDraft = () => {
    setDateLabels((prev) => {
      const updated = { ...prev[activeDay] };
      delete updated[editDateLabelDialog];
      return { ...prev, [activeDay]: updated };
    });
    setEditDateLabelDialog(null);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => window.print(), 50);
  };

  // Dedicated export engine: builds a standalone SVG from the real planning
  // data (never screenshots the interactive table), sized to the content's
  // natural width/height (fix 28/09/2026 : plus de format A4/paysage forcé
  // qui étirait les colonnes et laissait un grand vide autour des noms) —
  // pas une capture pivotée/étirée/paddée du tableau à l'écran. See
  // buildPlanningExportSVG / svgToPngDataUrl above.
  const handleExportPng = async () => {
    // Must happen synchronously, before any `await` below, or Safari on iOS
    // silently blocks the fallback tab (see utils/fileDownload.js).
    const preOpenedWindow = reserveTabForIOSFallback();
    setExportingPng(true);
    try {
      const { svg, width, height } = buildPlanningExportSVG({
        activeDay,
        currentMonth,
        currentYear,
        currentDates,
        daySections,
        affectations,
        blockedCells,
        titreOverrides,
        dateLabels,
        formatDate,
        nameCase: affichageNoms,
      });
      const { dataUrl, width: pngW, height: pngH } = await svgToPngDataUrl(
        svg,
        width,
        height,
        2,
      );
      console.log(
        `[Export PNG] PNG final: ${pngW}x${pngH} (ratio=${(pngW / pngH).toFixed(3)})`,
      );
      const moisSlug = (MOIS_NOMS[currentMonth - 1] || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      const filename = `planning-${moisSlug}-${currentYear}-${activeDay}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const status = await downloadOrShareFile(blob, filename, {
        title: filename,
        preOpenedWindow,
      });
      const msg = downloadStatusMessage(status);
      if (status === "blocked") toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export PNG");
    } finally {
      setExportingPng(false);
    }
  };

  // PNG vertical 9:16 (1080x1920) : même moteur, colonnes étroites, centré sur fond blanc.
  const handleExportPngStory = async () => {
    const preOpenedWindow = reserveTabForIOSFallback();
    setExportingPng(true);
    try {
      const { svg, width, height } = buildPlanningExportSVG({
        activeDay, currentMonth, currentYear, currentDates, daySections, affectations,
        blockedCells, titreOverrides, dateLabels, formatDate, nameCase: affichageNoms,
        layout: "story",
      });
      const { dataUrl } = await svgToStoryPngDataUrl(svg, width, height);
      const moisSlug = (MOIS_NOMS[currentMonth - 1] || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const filename = `planning-${moisSlug}-${currentYear}-${activeDay}-vertical.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const status = await downloadOrShareFile(blob, filename, { title: filename, preOpenedWindow });
      const msg = downloadStatusMessage(status);
      if (status === "blocked") toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export PNG vertical");
    } finally {
      setExportingPng(false);
    }
  };

  // Mirrors handleExportPng's structure — same source data, same filename
  // pattern, same download helper — just producing a workbook instead of a
  // PNG. See buildPlanningExportXLSX above.
  const handleExportXlsx = async () => {
    setExportingXlsx(true);
    try {
      await loadXLSX();
      const blob = buildPlanningExportXLSX({
        currentMonth,
        currentYear,
        dates,
        sections,
        affectations,
        blockedCells,
        titreOverrides,
        dateLabels,
        formatDate,
        nameCase: affichageNoms,
      });
      const moisSlug = (MOIS_NOMS[currentMonth - 1] || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      // Le classeur contient désormais les deux jours (Vendredi + Dimanche)
      // dans deux onglets séparés — plus de suffixe -vendredi/-dimanche.
      const filename = `planning-${moisSlug}-${currentYear}.xlsx`;
      const status = await downloadOrShareFile(blob, filename, {
        title: filename,
      });
      let msg;
      if (status === "blocked")
        msg = "Impossible d'enregistrer le fichier — réessaie";
      else if (status === "downloaded")
        msg = "Le fichier Excel a été téléchargé";
      else msg = downloadStatusMessage(status);
      if (status === "blocked") toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleEditRole = (tableKey, sectionIdx, roleIdx, day) => {
    const role = sections[day][tableKey][sectionIdx].roles[roleIdx];
    setEditRoleLabel(role.label);
    setEditRoleSeparateur(!!role.separateurApres);
    setEditSectionDialog({ tableKey, sectionIdx, roleIdx, day });
  };

  const saveRoleLabel = () => {
    if (!editSectionDialog) return;
    const { tableKey, sectionIdx, roleIdx, day } = editSectionDialog;
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = {
        ...updated[day][tableKey][sectionIdx],
      };
      updated[day][tableKey][sectionIdx].roles = [
        ...updated[day][tableKey][sectionIdx].roles,
      ];
      updated[day][tableKey][sectionIdx].roles[roleIdx] = {
        ...updated[day][tableKey][sectionIdx].roles[roleIdx],
        label: editRoleLabel,
        separateurApres: editRoleSeparateur,
      };
      return updated;
    });
    setEditSectionDialog(null);
    toast.success("Poste enregistré");
  };

  // Date editing functions
  const openEditDates = () => {
    setEditingDates([...dates[activeDay]]);
    setNewDate("");
    setEditDatesDialog(true);
  };

  const addDate = () => {
    if (!newDate) return;
    if (editingDates.includes(newDate)) {
      toast.error("Cette date existe déjà");
      return;
    }
    const updated = [...editingDates, newDate].sort();
    setEditingDates(updated);
    setNewDate("");
  };

  const removeDate = (dateToRemove) => {
    setEditingDates((prev) => prev.filter((d) => d !== dateToRemove));
  };

  const saveDates = () => {
    setDates((prev) => ({
      ...prev,
      [activeDay]: editingDates,
    }));
    setEditDatesDialog(false);
    toast.success("Dates mises à jour");
  };

  const resetDatesToDefault = () => {
    const dayOfWeek = activeDay === "dimanche" ? 0 : 5;
    const defaultDates = getDaysOfMonth(currentYear, currentMonth, dayOfWeek);
    setEditingDates(defaultDates);
  };

  const addRole = (tableKey, sectionIdx, day) => {
    const otherDay =
      day === "vendredi" ? "dimanche" : day === "dimanche" ? "vendredi" : null;
    setSections((prev) => {
      const newRole = {
        key: `custom_${Date.now()}`,
        label: "Nouveau poste",
        slots: 1,
      };
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = {
        ...updated[day][tableKey][sectionIdx],
      };
      updated[day][tableKey][sectionIdx].roles = [
        ...updated[day][tableKey][sectionIdx].roles,
        newRole,
      ];
      // Miroir Vendredi <-> Dimanche : la meme ligne est ajoutee dans la
      // meme categorie sur l'autre jour, si elle existe.
      if (otherDay && prev[otherDay] && prev[otherDay][tableKey]) {
        const currentSectionName = prev[day][tableKey][sectionIdx]?.name;
        let mirrorIdx = prev[otherDay][tableKey].findIndex(
          (s) => s.name === currentSectionName,
        );
        if (mirrorIdx === -1 && prev[otherDay][tableKey][sectionIdx]) {
          mirrorIdx = sectionIdx;
        }
        if (mirrorIdx !== -1) {
          updated[otherDay] = { ...prev[otherDay] };
          updated[otherDay][tableKey] = [...prev[otherDay][tableKey]];
          updated[otherDay][tableKey][mirrorIdx] = {
            ...updated[otherDay][tableKey][mirrorIdx],
          };
          updated[otherDay][tableKey][mirrorIdx].roles = [
            ...updated[otherDay][tableKey][mirrorIdx].roles,
            { ...newRole },
          ];
        }
      }
      return updated;
    });
  };

  const removeRole = (tableKey, sectionIdx, roleIdx, day) => {
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = {
        ...updated[day][tableKey][sectionIdx],
      };
      updated[day][tableKey][sectionIdx].roles = updated[day][tableKey][
        sectionIdx
      ].roles.filter((_, i) => i !== roleIdx);
      return updated;
    });
  };

  const moveRole = (tableKey, sectionIdx, roleIdx, direction, day) => {
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = {
        ...updated[day][tableKey][sectionIdx],
      };
      const roles = [...updated[day][tableKey][sectionIdx].roles];
      const targetIdx = direction === "up" ? roleIdx - 1 : roleIdx + 1;
      if (targetIdx < 0 || targetIdx >= roles.length) return prev;
      [roles[roleIdx], roles[targetIdx]] = [roles[targetIdx], roles[roleIdx]];
      updated[day][tableKey][sectionIdx].roles = roles;
      return updated;
    });
  };

  // Mark/unmark a single cell as blocked (grayed-out) — independent of the
  // whole-row toggle above, for the case where only one date/poste needs to
  // be greyed rather than the entire row.
  const toggleCellBlocked = (roleKey, slotIdx, dateIdx) => {
    const key = `${roleKey}_${slotIdx}`;
    setBlockedCells((prev) => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: { ...current, [dateIdx]: !current[dateIdx] },
      };
    });
  };

  // Mark/unmark a role as blocked (grayed-out, unavailable) — same visual
  // treatment as Poly 1/2/Gymnase, but toggleable on any poste.
  const toggleBlocked = (tableKey, sectionIdx, roleIdx, day) => {
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = {
        ...updated[day][tableKey][sectionIdx],
      };
      const roles = [...updated[day][tableKey][sectionIdx].roles];
      roles[roleIdx] = { ...roles[roleIdx], blocked: !roles[roleIdx].blocked };
      updated[day][tableKey][sectionIdx].roles = roles;
      return updated;
    });
  };

  // Add a brand new category (section) to a table for the active day.
  const openAddCategory = (tableKey) => {
    setNewCategoryName("");
    setAddCategoryDialog(tableKey);
  };

  const saveNewCategory = () => {
    if (!newCategoryName.trim() || !addCategoryDialog) return;
    const tableKey = addCategoryDialog;
    setSections((prev) => {
      const day = activeDay;
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [
        ...prev[day][tableKey],
        { name: newCategoryName.trim().toUpperCase(), roles: [] },
      ];
      return updated;
    });
    setAddCategoryDialog(null);
    toast.success("Catégorie ajoutée");
  };

  const removeSection = (tableKey, sectionIdx, day) => {
    if (!window.confirm("Supprimer cette catégorie et tous ses postes ?"))
      return;
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = prev[day][tableKey].filter(
        (_, i) => i !== sectionIdx,
      );
      return updated;
    });
    toast.success("Catégorie supprimée");
  };

  const handleEditCategory = (tableKey, sectionIdx, day) => {
    setEditCategoryLabel(sections[day][tableKey][sectionIdx].name);
    setEditCategoryDialog({ tableKey, sectionIdx, day });
  };

  const saveCategoryLabel = () => {
    if (!editCategoryDialog) return;
    const { tableKey, sectionIdx, day } = editCategoryDialog;
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      updated[day][tableKey][sectionIdx] = {
        ...updated[day][tableKey][sectionIdx],
        name:
          editCategoryLabel.trim().toUpperCase() ||
          updated[day][tableKey][sectionIdx].name,
      };
      return updated;
    });
    setEditCategoryDialog(null);
    toast.success("Catégorie renommée");
  };

  // Group/merge multiple postes into one shared row (e.g. "Caméra 1-6").
  const toggleGroupMode = (tableKey, sectionIdx, day) => {
    const isSame =
      groupModeSection &&
      groupModeSection.tableKey === tableKey &&
      groupModeSection.sectionIdx === sectionIdx &&
      groupModeSection.day === day;
    setGroupModeSection(isSame ? null : { tableKey, sectionIdx, day });
    setSelectedForGroup([]);
  };

  const toggleRoleSelectedForGroup = (roleIdx) => {
    setSelectedForGroup((prev) =>
      prev.includes(roleIdx)
        ? prev.filter((i) => i !== roleIdx)
        : [...prev, roleIdx],
    );
  };

  const mergeSelectedRoles = () => {
    if (!groupModeSection || selectedForGroup.length < 2) return;
    const { tableKey, sectionIdx, day } = groupModeSection;
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      const section = { ...updated[day][tableKey][sectionIdx] };
      const roles = [...section.roles];
      const sortedIdx = [...selectedForGroup].sort((a, b) => a - b);
      const selectedRoles = sortedIdx.map((i) => roles[i]);
      const mergedLabel = selectedRoles.map((r) => r.label).join(" / ");
      const mergedSlots = selectedRoles.reduce((acc, r) => acc + r.slots, 0);
      // mergedFrom keeps the original roles' key/label/slots so "Défusionner"
      // can restore them exactly later — the sub-roles' own affectation keys
      // are left untouched by the merge (see below), so their existing data
      // survives the round trip automatically.
      const mergedRole = {
        key: `grouped_${Date.now()}`,
        label: mergedLabel,
        slots: mergedSlots,
        mergedFrom: selectedRoles.map((r) => ({
          key: r.key,
          label: r.label,
          slots: r.slots,
        })),
      };
      const firstIdx = sortedIdx[0];
      const newRoles = roles.filter((_, i) => !sortedIdx.includes(i));
      newRoles.splice(firstIdx, 0, mergedRole);
      section.roles = newRoles;
      updated[day][tableKey][sectionIdx] = section;
      return updated;
    });
    setGroupModeSection(null);
    setSelectedForGroup([]);
    toast.success("Postes regroupés");
  };

  // Undo a merge: restores the original separate roles in place of the
  // merged one. The sub-roles' original affectation/blocked-cell keys were
  // never touched by the merge, so their pre-merge data reappears as soon as
  // the section references those keys again. Any data typed while the row
  // was merged (stored under the merged role's own key) is folded back into
  // the matching sub-role slot — in the same consecutive-slot order used
  // when merging — so nothing entered in the meantime is silently dropped.
  const splitMergedRole = (tableKey, sectionIdx, roleIdx, day) => {
    const role = sections[day]?.[tableKey]?.[sectionIdx]?.roles?.[roleIdx];
    if (!role || !role.mergedFrom || role.mergedFrom.length === 0) return;
    if (
      !window.confirm(
        `Défusionner « ${role.label} » en ${role.mergedFrom.length} postes séparés ?`,
      )
    )
      return;

    const mergedKey = role.key;
    const subRoles = role.mergedFrom;
    let globalSlot = 0;
    const slotRanges = subRoles.map((sr) => {
      const range = { key: sr.key, slots: sr.slots, startSlot: globalSlot };
      globalSlot += sr.slots;
      return range;
    });

    const redistribute = (prev) => {
      const updated = { ...prev };
      slotRanges.forEach(({ key, slots, startSlot }) => {
        for (let localSlot = 0; localSlot < slots; localSlot++) {
          const mergedSlotKey = `${mergedKey}_${startSlot + localSlot}`;
          const subKey = `${key}_${localSlot}`;
          const mergedData = updated[mergedSlotKey];
          if (mergedData && Object.values(mergedData).some((v) => v)) {
            updated[subKey] = { ...(updated[subKey] || {}), ...mergedData };
          }
          delete updated[mergedSlotKey];
        }
      });
      return updated;
    };

    setAffectations(redistribute);
    setBlockedCells(redistribute);
    setSections((prev) => {
      const updated = { ...prev, [day]: { ...prev[day] } };
      updated[day][tableKey] = [...prev[day][tableKey]];
      const section = { ...updated[day][tableKey][sectionIdx] };
      const roles = [...section.roles];
      const restoredRoles = subRoles.map((sr) => ({
        key: sr.key,
        label: sr.label,
        slots: sr.slots,
      }));
      roles.splice(roleIdx, 1, ...restoredRoles);
      section.roles = roles;
      updated[day][tableKey][sectionIdx] = section;
      return updated;
    });
    toast.success(
      'Postes défusionnés — cliquez sur "Enregistrer" pour confirmer',
    );
  };

  const currentDates = dates[activeDay] || [];
  const daySections = sections[activeDay] || DEFAULT_SECTIONS[activeDay];
  const theme = THEME[activeDay];
  const isMembre = user?.niveau_acces === "Technicien";

  // Panneau latéral "Déjà affectés / Pas encore affectés" pour Coordination+
  // en édition : recalculé en direct à chaque frappe dans la grille, sur
  // l'ensemble du mois (dimanche + vendredi confondus), pas juste le jour
  // actif — pour donner une vue d'ensemble de qui manque encore ce mois-ci.
  const assignedNamesSet = useMemo(() => {
    const found = new Set();
    ["dimanche", "vendredi"].forEach((day) => {
      const daySecs = sections[day] || DEFAULT_SECTIONS[day];
      [...(daySecs.table1 || []), ...(daySecs.table2 || [])].forEach(
        (section) => {
          (section.roles || []).forEach((role) => {
            for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
              const raw = affectations[`${role.key}_${slotIdx}`];
              // Certaines valeurs sauvegardées en base sont des dict {"0": "Nom"}
              // plutôt que des tableaux (artefact de sérialisation JS côté
              // ancien code) — on gère les deux formes ici comme côté backend.
              const vals = Array.isArray(raw)
                ? raw
                : raw && typeof raw === "object"
                  ? Object.values(raw)
                  : [];
              vals.forEach((value) => {
                if (value && value.trim())
                  found.add(value.trim().toLowerCase());
              });
            }
          });
        },
      );
    });
    return found;
  }, [affectations, sections]);

  const myBranches = useMemo(() => user?.branches || [], [user]);
  const effectiveRosterScope =
    rosterScope || (myBranches.length > 0 ? "mine" : "all");

  const assignmentRoster = useMemo(() => {
    const assigned = [];
    const notAssigned = [];
    (techniciens || []).forEach((t) => {
      const name = (t.nom || "").trim();
      if (!name) return;
      if (
        effectiveRosterScope === "mine" &&
        !(t.branches || []).some((b) => myBranches.includes(b))
      )
        return;
      const key = name.toLowerCase();
      let matched = assignedNamesSet.has(key);
      if (!matched) {
        for (const scheduled of assignedNamesSet) {
          if (scheduled.includes(key) || key.includes(scheduled)) {
            matched = true;
            break;
          }
        }
      }
      (matched ? assigned : notAssigned).push(name);
    });
    assigned.sort();
    notAssigned.sort();
    return { assigned, notAssigned };
  }, [techniciens, assignedNamesSet, effectiveRosterScope, myBranches]);

  // Names actually typed into the affectation grid for a given date, across
  // both Vendredi and Dimanche tables — used to detect when someone who
  // declared themselves absent has (accidentally) been scheduled anyway.
  const namesScheduledOnDate = (dateStr) => {
    const found = new Set();
    ["dimanche", "vendredi"].forEach((day) => {
      const dayDates = dates[day] || [];
      const dateIdx = dayDates.indexOf(dateStr);
      if (dateIdx === -1) return;
      const daySecs = sections[day] || DEFAULT_SECTIONS[day];
      [...(daySecs.table1 || []), ...(daySecs.table2 || [])].forEach(
        (section) => {
          section.roles.forEach((role) => {
            for (let slotIdx = 0; slotIdx < role.slots; slotIdx++) {
              const value = affectations[`${role.key}_${slotIdx}`]?.[dateIdx];
              if (value && value.trim()) found.add(value.trim().toLowerCase());
            }
          });
        },
      );
    });
    return found;
  };

  const nameMatches = (scheduledSet, fullName) => {
    const target = fullName.trim().toLowerCase();
    if (!target) return false;
    if (scheduledSet.has(target)) return true;
    for (const scheduled of scheduledSet) {
      if (scheduled.includes(target) || target.includes(scheduled)) return true;
    }
    return false;
  };

  // Only surface an absence in the banner once it actually collides with the
  // grid — i.e. the person is scheduled on a date they said they're
  // unavailable. This re-evaluates on every render, so the banner appears,
  // disappears, and reappears live as cells are edited.
  const conflictingAbsences = monthAbsences.filter((a) => {
    const start = new Date(a.date_debut + "T00:00:00");
    const end = new Date(a.date_fin + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${day}`;
      if (nameMatches(namesScheduledOnDate(dateStr), a.full_name)) return true;
    }
    return false;
  });

  // Liste live des absences declarees qui recouvrent une date de ce planning
  // (jour actif) - recalculee a chaque chargement des absences du mois, donc
  // toujours a jour meme si l'absence a ete modifiee ou supprimee apres la
  // redaction du texte libre "Absences de l'equipe" ci-dessous (#413).
  const declaredAbsencesForActiveDay = monthAbsences.filter((a) => {
    const start = new Date(a.date_debut + "T00:00:00");
    const end = new Date(a.date_fin + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      if (currentDates.includes(`${y}-${m}-${day}`)) return true;
    }
    return false;
  });

  // ---- Incohérences (personne planifiée malgré une absence déclarée) : visibles au Responsable+, ignorables par la Coordination+ ----
  const allConflicts = canManage()
    ? computeConflicts({ dates, sections, defaultSections: DEFAULT_SECTIONS, affectations, monthAbsences, notes, absences, rosterNames: technicienNames })
    : [];
  const isIgnoredConflict = (c) => ignoredConflicts.includes(c.id);
  const activeConflicts = allConflicts.filter((c) => !isIgnoredConflict(c));
  const ignoredList = allConflicts.filter((c) => isIgnoredConflict(c));
  const canIgnoreConflicts = isGestionnairePlus;
  const conflictByCell = {};
  allConflicts.forEach((c) => c.cells.forEach((cell) => {
    conflictByCell[`${cell.day}|${cell.key}|${cell.dateIdx}`] = c;
  }));
  const ignoreConflict = (id) => setIgnoredConflicts((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const restoreConflict = (id) => setIgnoredConflicts((prev) => prev.filter((x) => x !== id));
  const ignoreAllConflicts = () => setIgnoredConflicts((prev) => Array.from(new Set([...prev, ...allConflicts.map((c) => c.id)])));
  const focusConflict = (c) => {
    const cell = c.cells[0];
    if (!cell) return;
    if (cell.day !== activeDay) setActiveDay(cell.day);
    setPublishRecapOpen(false);
    setFlashConflictId(c.id);
    setTimeout(() => setFlashConflictId((cur) => (cur === c.id ? null : cur)), 8000);
    setTimeout(() => {
      const el = document.querySelector(`td[data-cell="${cell.day}|${cell.key}|${cell.dateIdx}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("animate-pulse");
      setTimeout(() => el.classList.remove("animate-pulse"), 2500);
    }, 200);
  };
  // Publier : s'il reste des incohérences non ignorées, un récapitulatif s'affiche d'abord (ignorer, revenir au planning ou publier).
  const requestPublish = () => {
    if (activeConflicts.length > 0) setPublishRecapOpen(true);
    else handlePublish();
  };

  if (evenementView) {
    return (
      <PlanningEvenementSection
        onBack={() => setEvenementView(false)}
        technicienNames={technicienNames}
        isSuperAdmin={isSuperAdmin}
        defaultSections={DEFAULT_SECTIONS}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderTable = (tableKey, tableSections) => {
    return (
      // Table stays w-full (removing it left a huge dead gap after a
      // narrow table when there's no actions column at all — e.g. outside
      // edit mode — user feedback 21/09/2026 "OULA"). Instead, only the
      // label (220px) and actions (120px) columns below get an explicit
      // <col> width; the date columns are left auto so THEY absorb any
      // extra width table-layout:fixed has to distribute on a wide
      // desktop screen, instead of it going into the actions column next
      // to the buttons (which is what made that column 200-250px wide).
      <table
        className="w-full border-collapse text-sm mb-4 print:mb-2 border-2 border-black print:border-2 print:border-black [&>tbody>tr:last-child>td]:border-b-2 [&>tbody>tr:last-child>td]:border-b-black print:[&>tbody>tr:last-child>td]:border-b-2 print:[&>tbody>tr:last-child>td]:border-b-black"
        style={{ tableLayout: "fixed" }}
      >
        <colgroup>
          <col className="col-label" style={{ width: "220px" }} />
          {currentDates.map((_, i) => (
            <col key={i} className="col-date" />
          ))}
          {canValidate() && planningEditMode && (
            <col style={{ width: "120px" }} className="print:hidden-col" />
          )}
        </colgroup>
        <thead>
          <tr>
            <th
              className={`border border-black border-b-2 border-b-black print:border-b-2 print:border-b-black p-2 text-left font-bold ${theme.band}`}
            >
              AFFECTATION
            </th>
            {currentDates.map((date, idx) => (
              <th
                key={idx}
                className={`border border-black border-b-2 border-b-black print:border-b-2 print:border-b-black p-1 font-bold text-center whitespace-nowrap text-xs sm:text-sm ${theme.band}`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{formatDate(date)}</span>
                  {canManage() && planningEditMode && (
                    <button
                      type="button"
                      className="print:hidden shrink-0 opacity-60 hover:opacity-100"
                      title="Ajouter/modifier un texte sous cette date"
                      onClick={() => openEditDateLabel(date)}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {dateLabels[activeDay]?.[date] && (
                  <div className="font-normal normal-case text-[10px] sm:text-xs whitespace-normal leading-tight mt-0.5">
                    {dateLabels[activeDay][date]}
                  </div>
                )}
              </th>
            ))}
            {canValidate() && planningEditMode && (
              <th
                className={`border border-black border-b-2 border-b-black print:border-b-2 print:border-b-black print:hidden ${theme.band}`}
              ></th>
            )}
          </tr>
        </thead>
        <tbody>
          {tableSections.map((section, sectionIdx) => {
            const isGroupModeHere =
              groupModeSection &&
              groupModeSection.tableKey === tableKey &&
              groupModeSection.sectionIdx === sectionIdx &&
              groupModeSection.day === activeDay;
            const isCollapsed =
              !!collapsedCategories[`${tableKey}::${section.name}`];
            return (
              <React.Fragment key={section.name + sectionIdx}>
                {!section.standalone && (
                  <tr>
                    <td
                      colSpan={
                        currentDates.length +
                        (canStruct(section.name) ? 2 : 1)
                      }
                      className={`border border-black border-b-2 border-b-black print:border-b-2 print:border-b-black p-1 font-bold text-center ${theme.band}`}
                    >
                      <span
                        className="cursor-pointer hover:underline inline-flex items-center gap-1"
                        onClick={() =>
                          toggleCategoryCollapse(tableKey, section.name)
                        }
                        title={isCollapsed ? "Déplier" : "Replier"}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 print:hidden" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 print:hidden" />
                        )}
                        {section.name}
                      </span>
                      {canStruct(section.name) && (
                          <span className="inline-flex items-center gap-1 ml-2 print:hidden align-middle">
                            {!planningScope.is_restricted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              title="Renommer la catégorie"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCategory(
                                  tableKey,
                                  sectionIdx,
                                  activeDay,
                                );
                              }}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              title="Ajouter un poste"
                              onClick={() =>
                                addRole(tableKey, sectionIdx, activeDay)
                              }
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-6 w-6 p-0 ${isGroupModeHere ? "bg-primary/30" : ""}`}
                              title="Grouper des postes ensemble"
                              onClick={() =>
                                toggleGroupMode(tableKey, sectionIdx, activeDay)
                              }
                            >
                              <Combine className="w-3 h-3" />
                            </Button>
                            {isGroupModeHere &&
                              selectedForGroup.length >= 2 && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-6 text-xs px-2"
                                  onClick={mergeSelectedRoles}
                                >
                                  Fusionner ({selectedForGroup.length})
                                </Button>
                              )}
                            {isGroupModeHere && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                title="Annuler le groupement"
                                onClick={() =>
                                  toggleGroupMode(
                                    tableKey,
                                    sectionIdx,
                                    activeDay,
                                  )
                                }
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                            {!planningScope.is_restricted && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive"
                              title="Supprimer la catégorie"
                              onClick={() =>
                                removeSection(tableKey, sectionIdx, activeDay)
                              }
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            )}
                          </span>
                        )}
                    </td>
                  </tr>
                )}
                {!isCollapsed &&
                  section.roles.map((role, roleIdx) => {
                  const posteCategory = canonPoste(section.name, role.label);
                  const datalistId = `tech-list-${slugPoste(posteCategory)}`;
                  const prevRole = section.roles[roleIdx - 1];
                  const isGroupBoundary =
                    roleIdx > 0 &&
                    prevRole &&
                    (delimiterGroup(section.name, role.label) !==
                      delimiterGroup(section.name, prevRole.label) ||
                      !!prevRole.separateurApres);
                  // Border-collapse gotcha: every <td> already carries its own
                  // 1px `border border-black` on all sides. Under
                  // border-collapse, adjacent cell borders resolve by WIDTH
                  // first (widest wins) — a plain border-t on the <tr> loses
                  // to the neighbouring cells' own 1px borders and is never
                  // actually painted. So the boundary must be a wider (2px)
                  // top border applied directly on each <td> of this row,
                  // not on the <tr>.
                  const boundaryTdClass =
                    slotIdx0Boundary =>
                      slotIdx0Boundary
                        ? " border-t-2 border-t-black print:border-t-2 print:border-t-black"
                        : "";
                  return (
                    <React.Fragment key={role.key}>
                      {Array.from({ length: role.slots }).map((_, slotIdx) => (
                        <tr
                          key={`${role.key}_${slotIdx}`}
                          className="hover:bg-muted/50"
                        >
                          {slotIdx === 0 ? (
                            <td
                              className={`border border-black p-2 font-medium bg-white${boundaryTdClass(isGroupBoundary)}`}
                              rowSpan={role.slots}
                            >
                              <div className="flex items-center gap-2">
                                {isGroupModeHere && (
                                  <input
                                    type="checkbox"
                                    className="print:hidden shrink-0"
                                    checked={selectedForGroup.includes(roleIdx)}
                                    onChange={() =>
                                      toggleRoleSelectedForGroup(roleIdx)
                                    }
                                  />
                                )}
                                <span
                                  className={
                                    !isGroupModeHere &&
                                    canStruct(section.name)
                                      ? "cursor-pointer hover:underline flex-1"
                                      : "flex-1"
                                  }
                                  onClick={() =>
                                    !isGroupModeHere &&
                                    canStruct(section.name) &&
                                    handleEditRole(
                                      tableKey,
                                      sectionIdx,
                                      roleIdx,
                                      activeDay,
                                    )
                                  }
                                >
                                  {role.label}
                                </span>
                              </div>
                            </td>
                          ) : null}
                          {currentDates.map((_, dateIdx) => {
                            const key = `${role.key}_${slotIdx}`;
                            const value = affectations[key]?.[dateIdx] || "";
                            const singleCellBlocked =
                              !!blockedCells[key]?.[dateIdx];
                            const cellBlocked =
                              role.blocked || singleCellBlocked;
                            const cellModeActive =
                              cellBlockMode &&
                              canStruct(section.name) &&
                              !role.blocked;
                            return (
                              <td
                                key={dateIdx}
                                data-cell={`${activeDay}|${key}|${dateIdx}`}
                                data-editable={!cellBlocked && !cellModeActive && canEditPlanningCell(section.name, role.key, role.label) ? "1" : "0"}
                                className={`border border-black p-1 ${cellBlocked ? "bg-gray-300 print:bg-gray-300" : "bg-white"} ${cellModeActive ? "cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary" : ""}${boundaryTdClass(slotIdx === 0 && isGroupBoundary)}${(() => { const cf0 = conflictByCell[`${activeDay}|${key}|${dateIdx}`]; const cf = cf0 && (planningEditMode || cf0.id === flashConflictId) ? cf0 : null; if (!cf) return ""; if (isIgnoredConflict(cf)) return " outline outline-2 -outline-offset-2 outline-dashed outline-amber-400 print:outline-none"; return (cf.type === "incomplet" ? " ring-2 ring-inset ring-amber-500 !bg-amber-100 dark:!bg-amber-900/40" : " ring-2 ring-inset ring-red-500 !bg-red-100 dark:!bg-red-900/40") + " print:ring-0 print:!bg-white"; })()}`}
                                title={(() => { const cf0 = conflictByCell[`${activeDay}|${key}|${dateIdx}`]; const cf = cf0 && (planningEditMode || cf0.id === flashConflictId) ? cf0 : null; return cf ? `${isIgnoredConflict(cf) ? "Alerte ignorée — " : "⚠ "}${cf.detail}` : undefined; })()}
                                onClick={() =>
                                  cellModeActive &&
                                  toggleCellBlocked(role.key, slotIdx, dateIdx)
                                }
                              >
                                {cellModeActive ? (
                                  <div className="w-full h-7 flex items-center justify-center">
                                    {singleCellBlocked ? (
                                      <Ban className="w-3.5 h-3.5 text-amber-600" />
                                    ) : (
                                      <span className="text-xs text-muted-foreground/50">
                                        {value || "-"}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <PlanningCell
                                    value={value}
                                    blocked={cellBlocked}
                                    canEdit={canEditPlanningCell(
                                      section.name,
                                      role.key,
                                      role.label,
                                    )}
                                    datalistId={datalistId}
                                    reason={
                                      planningEditMode &&
                                      !canEditPlanningCell(
                                        section.name,
                                        role.key,
                                        role.label,
                                      )
                                        ? `section « ${section.name} », clé « ${role.key} », libellé « ${role.label} » — périmètre de votre groupe : ${
                                            (planningScope.grid_scope ||
                                              planningScope.scope ||
                                              []
                                            ).join(", ") || "aucun"
                                          }`
                                        : ""
                                    }
                                    nameCase={affichageNoms}
                                    onChange={(v) =>
                                      handleAffectationChange(
                                        role.key,
                                        slotIdx,
                                        dateIdx,
                                        v === "" ? "__none__" : v,
                                      )
                                    }
                                  />
                                )}
                              </td>
                            );
                          })}
                          {canStruct(section.name) &&
                            slotIdx === 0 && (
                              <td
                                className="border border-black p-1 print:hidden"
                                rowSpan={role.slots}
                              >
                                {/* Two explicit, data-driven rows instead of
                                    letting flex-wrap decide: row 1 always
                                    holds the same 4 buttons (fits a 120px
                                    column with no wasted space), row 2 only
                                    exists in the DOM when mergedFrom is set.
                                    That keeps the layout deterministic from
                                    section.roles data alone — no
                                    width-dependent wrap that could disagree
                                    with what ScaleToFitMobile measured. */}
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <div className="flex items-center justify-center flex-nowrap gap-0.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0 bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground disabled:opacity-25"
                                      disabled={roleIdx === 0}
                                      title="Monter le poste"
                                      onClick={() =>
                                        moveRole(
                                          tableKey,
                                          sectionIdx,
                                          roleIdx,
                                          "up",
                                          activeDay,
                                        )
                                      }
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0 bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground disabled:opacity-25"
                                      disabled={
                                        roleIdx === section.roles.length - 1
                                      }
                                      title="Descendre le poste"
                                      onClick={() =>
                                        moveRole(
                                          tableKey,
                                          sectionIdx,
                                          roleIdx,
                                          "down",
                                          activeDay,
                                        )
                                      }
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`h-6 w-6 p-0 bg-background border-border hover:bg-muted ${role.blocked ? "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40" : "text-muted-foreground hover:text-amber-600"}`}
                                      title={
                                        role.blocked
                                          ? "Rendre disponible"
                                          : "Griser (marquer indisponible)"
                                      }
                                      onClick={() =>
                                        toggleBlocked(
                                          tableKey,
                                          sectionIdx,
                                          roleIdx,
                                          activeDay,
                                        )
                                      }
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0 bg-background text-destructive border-destructive/30 hover:bg-destructive/10"
                                      title="Supprimer le poste"
                                      onClick={() =>
                                        removeRole(
                                          tableKey,
                                          sectionIdx,
                                          roleIdx,
                                          activeDay,
                                        )
                                      }
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                  {role.mergedFrom &&
                                    role.mergedFrom.length > 0 && (
                                      <div className="flex items-center justify-center">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 w-6 p-0 bg-background text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                          title="Défusionner ces postes"
                                          onClick={() =>
                                            splitMergedRole(
                                              tableKey,
                                              sectionIdx,
                                              roleIdx,
                                              activeDay,
                                            )
                                          }
                                        >
                                          <Split className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                </div>
                              </td>
                            )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="space-y-6 print:space-y-0" data-testid="planning-page">
      <Dialog open={!!absentAlert} onOpenChange={(o) => { if (!o) setAbsentAlert(null); }}>
        <DialogContent className="max-w-md print:hidden" data-testid="absent-popup">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${absentAlert?.level === "error" ? "text-destructive" : "text-amber-600"}`}>
              <CalendarOff className="w-5 h-5 shrink-0" /> {absentAlert?.title}
            </DialogTitle>
            <DialogDescription>{absentAlert?.text}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAbsentAlert(null)} data-testid="absent-popup-ok">OK, compris</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style>{`
@media print {
@page { size: landscape; margin: 8mm; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`}</style>

      {/* Header - hidden on print */}
      <PlanningHeaderBar
            activeDay={activeDay}
            autoSaveStatus={autoSaveStatus}
            canManage={canManage}
            canValidate={canValidate}
            duplicating={duplicating}
            exportingPng={exportingPng}
            exportingXlsx={exportingXlsx}
            handleExportPng={handleExportPng}
            handleExportPngStory={handleExportPngStory}
            handleExportXlsx={handleExportXlsx}
            handlePrint={handlePrint}
            handlePublish={requestPublish}
            handleResetPlanningVierge={handleResetPlanningVierge}
            handleSave={handleSave}
            handleUndo={handleUndo}
            handleUnpublish={handleUnpublish}
            isGestionnairePlus={isGestionnairePlus}
            live={live}
            openDuplicate={openDuplicate}
            planning={planning}
            planningEditMode={planningEditMode}
            planningScope={planningScope}
            publishing={publishing}
            saving={saving}
            setCopyDaysDialog={setCopyDaysDialog}
            setEvenementView={setEvenementView}
            toggleEditMode={toggleEditMode}
            undoStack={undoStack}
          />

      {isTechnicien && notPublished && (
        <div className="print:hidden rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex items-start gap-2.5">
          <EyeOff className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900 dark:text-amber-300">
            Le planning de ce mois est en cours de préparation et n'a pas encore
            été publié — reviens un peu plus tard.
          </p>
        </div>
      )}

      {/* Month Navigation - hidden on print. Membre accounts only ever see
the current month, so navigation is replaced with a plain label. */}
      <PlanningMonthNav
            currentMonth={currentMonth}
            currentYear={currentYear}
            isMembre={isMembre}
            setCurrentMonth={setCurrentMonth}
            setCurrentYear={setCurrentYear}
          />

      {/* Day Tabs */}
      <Tabs
        value={activeDay}
        onValueChange={setActiveDay}
        className="print:hidden"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="vendredi" className={THEME.vendredi.tab}>
            Vendredi
          </TabsTrigger>
          <TabsTrigger value="dimanche" className={THEME.dimanche.tab}>
            Dimanche
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Absence CONFLICT banner for Coordination+ — kept outside printRef so
it never shows up in print or PNG export. Unlike a static "here's
who's absent this month" list, this only appears once someone who
declared themselves unavailable is actually typed into a grid cell
on a colliding date — so it appears, disappears, and reappears live
as the affectations are edited. */}
      {canManage() && allConflicts.length > 0 && (
        <div className="print:hidden space-y-2" data-testid="planning-conflicts">
          {activeConflicts.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm text-red-800 dark:text-red-400 flex items-center gap-2 flex-1">
                  <CalendarOff className="w-4 h-4" />
                  {activeConflicts.length} incohérence(s) dans le planning{planningEditMode ? " — cases encadrées en rouge (absence) ou en orange (case incomplète)" : " — passe en mode édition pour voir les cases"} (le contenu n'est pas modifié)
                </p>
                {canIgnoreConflicts && (
                  <Button size="sm" variant="outline" onClick={ignoreAllConflicts}>Tout ignorer</Button>
                )}
              </div>
              <div className="space-y-1">
                {activeConflicts.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm text-red-900 dark:text-red-300">
                    <span className="flex-1 min-w-[12rem]">
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${c.type === "incomplet" ? "bg-amber-200 text-amber-900" : "bg-red-200 text-red-900"}`}>{c.type === "incomplet" ? "Case incomplète" : "Absence"}</span>
                      <span className="font-medium">{c.name}</span> · {fmtIso(c.iso)} · {c.detail}
                    </span>
                    <Button size="sm" className="h-8 px-3 gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm" onClick={() => focusConflict(c)} data-testid="conflict-see-btn"><Eye className="w-4 h-4" /> Voir</Button>
                    {canIgnoreConflicts && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => ignoreConflict(c.id)}>Ignorer</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {ignoredList.length > 0 && (
            <details className="rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-amber-800 dark:text-amber-400">{ignoredList.length} alerte(s) ignorée(s)</summary>
              <div className="mt-2 space-y-1">
                {ignoredList.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-[12rem]"><span className="font-medium">{c.name}</span> · {fmtIso(c.iso)} · {c.detail}</span>
                    <Button size="sm" className="h-8 px-3 gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm" onClick={() => focusConflict(c)} data-testid="conflict-see-btn"><Eye className="w-4 h-4" /> Voir</Button>
                    {canIgnoreConflicts && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => restoreConflict(c.id)}>Rétablir l'alerte</Button>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

        {/* Absences / Notes — moved up here (right after the conflict banner,
before the big table) so it's not missed at the bottom of a long
scroll on phones/desktop (feedback 21/09/2026). Still deliberately
outside printRef so print/PNG export never need any hide-this-column
logic. Coordination+ only, et seulement en mode édition. */}
        {canManage() && planningEditMode && (
          <PlanningNotesCard
            absences={absences}
            activeDay={activeDay}
            declaredAbsencesForActiveDay={declaredAbsencesForActiveDay}
            notes={notes}
            refreshAbsencesAfterChange={refreshAbsencesAfterChange}
            setAbsences={setAbsences}
            setNotes={setNotes}
            techniciens={techniciens}
          />
        )}

      {/* Printable / exportable planning area + panneau latéral d'affectation
pour Coordination+. Le panneau est en dehors de printRef (jamais
exporté/imprimé) et se recalcule en direct pendant l'édition. */}
      <PlanningTableArea
            activeDay={activeDay}
            affichageNoms={affichageNoms}
            canManage={canManage}
            canValidate={canValidate}
            cellBlockMode={cellBlockMode}
            currentDates={currentDates}
            currentMonth={currentMonth}
            currentYear={currentYear}
            daySections={daySections}
            distinctPostesToday={distinctPostesToday}
            isGestionnairePlus={isGestionnairePlus}
            namesForPoste={namesForPoste}
            openAddCategory={openAddCategory}
            openEditDates={openEditDates}
            openEditHeader={openEditHeader}
            planningEditMode={planningEditMode}
            planningScope={planningScope}
            printRef={printRef}
            renderTable={renderTable}
            setAffichageNoms={setAffichageNoms}
            setCellBlockMode={setCellBlockMode}
            technicienNames={technicienNames}
            theme={theme}
            titreOverrides={titreOverrides}
          />

      {/* Panneau "Déjà affectés / Pas encore affectés" — tiroir fixe
collé au bord droit de l'écran (PC ET mobile). Onglet toujours visible ;
le corps du panneau glisse par-dessus le contenu (position fixed, pas de
place réservée dans la mise en page) donc il ne pousse plus rien vers
le bas sur mobile. Survol = ouverture/fermeture automatique sur PC ;
tap sur l'onglet = bascule sur mobile (pas de hover tactile fiable). */}
      {canManage() && planningEditMode && (
        <PlanningAssignPanel
            assignmentRoster={assignmentRoster}
            effectiveRosterScope={effectiveRosterScope}
            myBranches={myBranches}
            rosterPanelOpen={rosterPanelOpen}
            setRosterPanelOpen={setRosterPanelOpen}
            setRosterScope={setRosterScope}
          />
      )}

      {/* Edit Header (title/subtitle) Dialog */}
      <EditHeaderDialog
            activeDay={activeDay}
            currentMonth={currentMonth}
            currentYear={currentYear}
            editHeaderDialog={editHeaderDialog}
            headerDraft={headerDraft}
            resetHeaderDraft={resetHeaderDraft}
            saveHeaderDraft={saveHeaderDraft}
            setEditHeaderDialog={setEditHeaderDialog}
            setHeaderDraft={setHeaderDraft}
          />

      {/* Edit Date Label Dialog */}
      <EditDateLabelDialog
            clearDateLabelDraft={clearDateLabelDraft}
            dateLabelDraft={dateLabelDraft}
            editDateLabelDialog={editDateLabelDialog}
            formatDate={formatDate}
            saveDateLabelDraft={saveDateLabelDraft}
            setDateLabelDraft={setDateLabelDraft}
            setEditDateLabelDialog={setEditDateLabelDialog}
          />

      {/* Edit Role Dialog */}
      <EditSectionDialog
            editRoleLabel={editRoleLabel}
            editRoleSeparateur={editRoleSeparateur}
            editSectionDialog={editSectionDialog}
            saveRoleLabel={saveRoleLabel}
            setEditRoleLabel={setEditRoleLabel}
            setEditRoleSeparateur={setEditRoleSeparateur}
            setEditSectionDialog={setEditSectionDialog}
          />

      {/* Add Category Dialog */}
      <AddCategoryDialog
            addCategoryDialog={addCategoryDialog}
            newCategoryName={newCategoryName}
            saveNewCategory={saveNewCategory}
            setAddCategoryDialog={setAddCategoryDialog}
            setNewCategoryName={setNewCategoryName}
          />

      {/* Edit Category Dialog */}
      <EditCategoryDialog
            editCategoryDialog={editCategoryDialog}
            editCategoryLabel={editCategoryLabel}
            saveCategoryLabel={saveCategoryLabel}
            setEditCategoryDialog={setEditCategoryDialog}
            setEditCategoryLabel={setEditCategoryLabel}
          />

      {/* Copier Dimanche <-> Vendredi (demande Nathalie 22/08/2026) */}
      {/* Duplication du mois précédent — contrôle total : choix des sections,
          avec le nom de la dernière personne ayant modifié chacune. */}
      <DuplicateDialog
            duplicateChoice={duplicateChoice}
            duplicateDialog={duplicateDialog}
            duplicateSectionNames={duplicateSectionNames}
            duplicating={duplicating}
            handleDuplicateLastMonth={handleDuplicateLastMonth}
            planning={planning}
            setDuplicateChoice={setDuplicateChoice}
            setDuplicateDialog={setDuplicateDialog}
          />

      <Dialog open={publishRecapOpen} onOpenChange={setPublishRecapOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="publish-recap">
          <DialogHeader>
            <DialogTitle>Avant de publier : {activeConflicts.length} point(s) à vérifier</DialogTitle>
            <DialogDescription>
              Ces cases sont encadrées en rouge (absence déclarée) ou en orange (case incomplète) en mode édition. Rien n'a été modifié : tu peux ignorer une alerte, revenir au planning pour corriger, ou publier quand même.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-2 py-1">
            {activeConflicts.length === 0 && <p className="text-sm text-muted-foreground">Plus aucune incohérence : tu peux publier.</p>}
            {activeConflicts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${c.type === "absence" ? "bg-red-500" : "bg-amber-500"}`} />
                <span className="flex-1 min-w-[12rem]"><span className="font-medium">{c.name}</span> · {fmtIso(c.iso)}<br /><span className="text-muted-foreground text-xs">{c.detail}</span></span>
                <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold" onClick={() => focusConflict(c)}><Eye className="w-4 h-4" /> Voir</Button>
                {canIgnoreConflicts && <Button size="sm" variant="outline" onClick={() => ignoreConflict(c.id)}>Ignorer</Button>}
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPublishRecapOpen(false)}>Revenir au planning</Button>
            {canIgnoreConflicts && activeConflicts.length > 0 && (
              <Button variant="outline" onClick={ignoreAllConflicts}>Tout ignorer</Button>
            )}
            <Button
              disabled={publishing || (activeConflicts.length > 0 && !canIgnoreConflicts)}
              onClick={async () => { if (activeConflicts.length > 0) ignoreAllConflicts(); setPublishRecapOpen(false); await handlePublish(); }}
              data-testid="publish-anyway-btn"
            >
              {activeConflicts.length > 0 ? "Ignorer tout et publier" : "Publier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CopyDaysDialog
            copyDaysDialog={copyDaysDialog}
            copyDaysDirection={copyDaysDirection}
            currentMonth={currentMonth}
            currentYear={currentYear}
            handleCopyBetweenDays={handleCopyBetweenDays}
            setCopyDaysDialog={setCopyDaysDialog}
            setCopyDaysDirection={setCopyDaysDirection}
          />

      {/* Edit Dates Dialog */}
      <EditDatesDialog
            activeDay={activeDay}
            addDate={addDate}
            editDatesDialog={editDatesDialog}
            editingDates={editingDates}
            newDate={newDate}
            removeDate={removeDate}
            resetDatesToDefault={resetDatesToDefault}
            saveDates={saveDates}
            setEditDatesDialog={setEditDatesDialog}
            setNewDate={setNewDate}
          />
    </div>
  );
}
