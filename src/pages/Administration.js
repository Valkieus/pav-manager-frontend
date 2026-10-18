import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs } from '../components/ui/tabs';
import { toast } from "sonner";
import { Users, Loader2, Trash2, Shield, ScrollText, Edit, Key, UserCog, Lock, AlertTriangle, Activity, Bell } from 'lucide-react';
import {
  downloadOrShareFile,
  downloadStatusMessage,
  reserveTabForIOSFallback,
} from "../utils/fileDownload";
import { API, MAINTENANCE_PAGES, SUPERVISED_COLLECTIONS_LABELS } from './administration/constants';
import { FicheEffectifSection } from './administration/panels';
import { NotificationsTab } from './administration/NotificationsTab';
import { SupervisionTab } from './administration/SupervisionTab';
import { LogsTab } from './administration/LogsTab';
import { RightsTab } from './administration/RightsTab';
import { GroupsTab } from './administration/GroupsTab';
import { UsersTab } from './administration/UsersTab';
import { MaintenanceTab } from './administration/MaintenanceTab';
// Bibliothèque lourde (~330 Ko) : chargée seulement quand on exporte, pas à l'ouverture de la page.
let XLSX;
const loadXLSX = async () => { XLSX = XLSX || (await import('xlsx-js-style')); };





// Mirrors SUPERVISED_COLLECTIONS in server.py — kept in sync manually since the
// export dropdown must only ever offer categories the backend allow-lists.


// Libelles lisibles pour l'onglet "Par entite" de Supervision (#579) --
// reutilise le meme ordre/liste que SUPERVISED_COLLECTIONS_FRONT ; toute
// collection sans entree ici retombe simplement sur son nom technique.


// Pages that can individually be put into maintenance (mirrors Layout.js navItems)


// Roles that can be individually targeted by a maintenance activation.
// Super Admin is intentionally excluded — it can never be impacted.


// Permission categories for display


// Droits qui peuvent être segmentés par section (même principe que le
// Planning : contrôle total, ou limité à certaines valeurs seulement).
// La liste des valeurs possibles pour chaque droit vient de
// GET /groups/scope-options (dynamique : salles existantes, catégories
// fournisseur utilisées, catégories documents créées, etc.)



// Redesign "façon AD" (20/08/2026, demande explicite) : au lieu de cases à
// cocher éparpillées par catégorie, une vraie matrice Module × Lecture /
// Écriture / Suppression / Spécial — même lisibilité qu'un groupe Active
// Directory RO/RW. Les valeurs de permission envoyées au backend sont
// STRICTEMENT les mêmes chaînes "module.action" qu'avant (ex: "devis.write") ;
// ceci ne change que l'affichage, pas le modèle de données ni handleGroupSubmit.



// Sélecteur à cocher réutilisable pour les périmètres de groupe (sections
// Planning, salles, catégories fournisseurs/documents/formations/actualités,
// branches Effectif...). Remplace l'ancienne "mur de puces" où cliquer une
// valeur la faisait juste changer de couleur au milieu de 30+ autres —
// difficile à lire et, pire, source de clics par erreur sur la mauvaise
// puce (constaté en direct le 20/08/2026). Ici : une liste de cases à
// cocher classique (une par ligne, scrollable), plus une bande "Sélection
// actuelle" séparée au-dessus qui ne montre QUE ce qui est coché, avec un
// bouton × pour retirer sans avoir à retrouver la case dans la liste.


// Pastille de statut compacte pour le bandeau "vue d'ensemble" de Supervision
// — un coup d'œil sur la santé globale (vert = ok, rouge = problème,
// ambre = non configuré/à vérifier, gris = en cours de chargement). Purement
// présentationnel : dérivé des données déjà chargées par la page
// (systemStatus / infraStatus / b2Status), aucun appel réseau propre.
















export default function Administration() {
  const { isSuperAdmin, isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  // La Coordination accède à Administration mais uniquement à
  // l'onglet Groupes & Droits (création/édition des groupes, scope planning
  // des Responsables) — Utilisateurs/Logs/Maintenance/Supervision/Droits
  // d'accès restent réservés à Admin/Super Admin.
  const isGestionnaireOnly = currentUser?.niveau_acces === "Coordination";
  // "Admin (lecture seule)" = comportement historique d'Admin : accès en lecture
  // aux onglets Utilisateurs (non — voir plus bas), Logs, Maintenance et Supervision,
  // mais aucune action d'écriture (celles-ci restent gérées individuellement par
  // isAdmin() sur chaque bouton/switch). N'a pas accès à Droits d'accès (jamais
  // eu accès par le passé) ni à l'onglet Utilisateurs (CRUD non protégé bouton
  // par bouton — on préfère ne pas l'exposer plutôt que d'afficher des actions
  // qui échoueraient côté serveur).
  const isReadOnlyAdmin = currentUser?.niveau_acces === "Admin (lecture seule)";
  // Onglets à contenu purement lecture (Logs/Maintenance/Supervision) : leurs
  // actions sensibles sont déjà individuellement protégées par isSuperAdmin()
  // au niveau du bouton, donc sûr d'ouvrir la vue à Admin (lecture seule).
  const canViewReadOnlyTabs = isAdmin() || isReadOnlyAdmin;
  const [activeTab, setActiveTab] = useState(() =>
    currentUser?.niveau_acces === "Coordination" ? "groups" : "users",
  );
  const [users, setUsers] = useState([]);
  // Compte tablette « Régisseurs iPad » (Super Admin) : session permanente,
  // uniquement la vue Entrées/Sorties.
  const [kioskDialogOpen, setKioskDialogOpen] = useState(false);
  const [kioskForm, setKioskForm] = useState({ username: "regisseurs-ipad", password: "" });
  const [kioskSubmitting, setKioskSubmitting] = useState(false);
  const [kioskCreated, setKioskCreated] = useState(null);
  const generateKioskPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const arr = new Uint32Array(12);
    crypto.getRandomValues(arr);
    setKioskForm((f) => ({
      ...f,
      password: Array.from(arr, (n) => chars[n % chars.length]).join(""),
    }));
  };
  const createKioskAccount = async () => {
    setKioskSubmitting(true);
    try {
      const res = await axios.post(`${API}/admin/kiosk-account`, kioskForm);
      toast.success(
        `Compte tablette créé : ${res.data.username} (groupe ${res.data.group})`,
      );
      setKioskDialogOpen(false);
      setKioskCreated({ username: res.data.username || kioskForm.username, password: kioskForm.password });
      setKioskForm({ username: "regisseurs-ipad", password: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la création");
    } finally {
      setKioskSubmitting(false);
    }
  };
  const [userSearch, setUserSearch] = useState("");
  const [userLevelFilter, setUserLevelFilter] = useState("all");
  const [userDetailOpen, setUserDetailOpen] = useState(null);
  const [groups, setGroups] = useState([]);
  // Catégories des groupes Groupes & Droits (ex. "Planning") — demande
  // explicite du 21/09/2026 pour gérer les groupes par catégorie plutôt
  // qu'en liste plate. Le backend renvoie toujours une catégorie effective
  // par groupe (explicite ou déduite du nom), donc pas besoin de fallback
  // ici. `expandedCategories` mémorise quelles catégories sont dépliées ;
  // toutes ouvertes par défaut au premier chargement.
  const [expandedCategories, setExpandedCategories] = useState(null);
  const groupCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(groups.map((g) => g.category).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
    [groups],
  );
  const groupsByCategory = useMemo(() => {
    const map = {};
    for (const g of groups) {
      const cat = g.category || "Général";
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [groups]);
  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => {
      // Première interaction : construire l'état complet "tout ouvert" à
      // partir des catégories actuelles avant de refermer celle cliquée.
      const base =
        prev || Object.fromEntries(groupsByCategory.map(([c]) => [c, true]));
      return { ...base, [cat]: !base[cat] };
    });
  };
  const isCategoryExpanded = (cat) =>
    expandedCategories ? expandedCategories[cat] !== false : true;
  // Demande 21/09/2026 : le bloc "Segmentation du planning" (planning_scope/
  // planning_full_control) n'a de sens que pour les groupes de catégorie
  // Planning (Planning_*) — un groupe Salles/Communication/etc. ne doit
  // même pas le voir, pour éviter la confusion. Comparaison tolérante
  // (espaces/casse) puisque la catégorie est un champ texte libre.
  const isPlanningCategory = (category) =>
    (category || "").trim().toLowerCase() === "planning";
  const [logs, setLogs] = useState([]);
  const [logsUpdatedAt, setLogsUpdatedAt] = useState(null);
  const [logSearch, setLogSearch] = useState("");
  const [logModuleFilter, setLogModuleFilter] = useState("all");
  const [logSeverityFilter, setLogSeverityFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(true);

  // Maintenance Mode (#542 : plusieurs activations simultanées possibles)
  const [maintenanceEntries, setMaintenanceEntries] = useState([]);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceScope, setMaintenanceScope] = useState("site");
  const [maintenancePagePath, setMaintenancePagePath] = useState(
    MAINTENANCE_PAGES[0].path,
  );
  const [maintenanceAffectedRoles, setMaintenanceAffectedRoles] = useState([]); // [] = tout le monde (sous Super Admin)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Signalement de retard (Dashboard) — activable/désactivable ici, avec
  // liste configurable de destinataires Coordination+ toujours notifiés
  // (en plus du/de la superviseur du jour, déduit automatiquement du
  // planning).
  const [retardEnabled, setRetardEnabled] = useState(false);
  const [retardLoading, setRetardLoading] = useState(false);
  const [retardNotifyUserIds, setRetardNotifyUserIds] = useState([]);
  const [retardRecipientsSaving, setRetardRecipientsSaving] = useState(false);

  // Mode test — permet de désigner des comptes existants comme "testeurs"
  // pour valider des fonctionnalités qui dépendent normalement du jour réel
  // (ex : bouton "Signaler un retard"), sans attendre un vrai jour de
  // service. On garde la main pour retirer un testeur ou couper le mode
  // entier à tout moment.
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testModeLoading, setTestModeLoading] = useState(false);
  const [testModeUserIds, setTestModeUserIds] = useState([]);
  const [testModeSaving, setTestModeSaving] = useState(false);
  const [testModeUserQuery, setTestModeUserQuery] = useState("");

  // User Dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  // Group Dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

  // User Group Assignment Dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserForGroups, setSelectedUserForGroups] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);

  // Group Members Dialog — the reverse direction: pick which users belong to
  // a given group directly from the Groupes tab, instead of having to open
  // each user's own "Attribuer groupes" dialog one by one.
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState(null);
  const [selectedMemberUserIds, setSelectedMemberUserIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState("");

  // Supervision tab — resource/storage health, fetched only when that tab
  // is actually opened (Super Admin only, no need to load it on every visit).
  const [systemStatus, setSystemStatus] = useState(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);
  const [systemStatusUpdatedAt, setSystemStatusUpdatedAt] = useState(null);
  const [infraStatus, setInfraStatus] = useState(null);
  const [infraStatusLoading, setInfraStatusLoading] = useState(false);
  const [infraStatusUpdatedAt, setInfraStatusUpdatedAt] = useState(null);

  // Droits d'accès tab — role-permissions matrix, fetched only when opened
  // (Super Admin only).
  const [rightsRows, setRightsRows] = useState([]);
  const [rightsLoading, setRightsLoading] = useState(false);
  const [rightsBusyKey, setRightsBusyKey] = useState(null);

  const fetchRolePermissions = async () => {
    setRightsLoading(true);
    try {
      const res = await axios.get(`${API}/admin/role-permissions`);
      setRightsRows(res.data.rows || []);
    } catch (err) {
      toast.error("Erreur lors du chargement des droits d'accès");
    } finally {
      setRightsLoading(false);
    }
  };

  const toggleRolePermission = async (permissionKey, role, nextGranted) => {
    setRightsBusyKey(`${permissionKey}:${role}`);
    try {
      await axios.put(`${API}/admin/role-permissions`, {
        role,
        permission: permissionKey,
        granted: nextGranted,
      });
      setRightsRows((rows) =>
        rows.map((row) =>
          row.key === permissionKey
            ? {
                ...row,
                roles: {
                  ...row.roles,
                  [role]: { ...row.roles[role], granted: nextGranted },
                },
              }
            : row,
        ),
      );
      toast.success("Droit mis à jour");
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de la mise à jour du droit",
      );
    } finally {
      setRightsBusyKey(null);
    }
  };

  // `silent` = appel d'auto-refresh en arrière-plan : pas de spinner (évite le
  // clignotement toutes les 15-60s), et pas de toast d'erreur répété sur un
  // simple blip réseau (même principe que fetchLogs plus bas) — seul le clic
  // manuel sur "Actualiser" reste bruyant en cas d'échec (#502/#504).
  const fetchSystemStatus = async (silent = false) => {
    if (!silent) setSystemStatusLoading(true);
    try {
      const res = await axios.get(`${API}/admin/system-status`);
      setSystemStatus(res.data);
      setSystemStatusUpdatedAt(Date.now());
    } catch (err) {
      if (!silent) toast.error("Erreur lors du chargement de la supervision");
    } finally {
      if (!silent) setSystemStatusLoading(false);
    }
  };

  const fetchInfraStatus = async (silent = false) => {
    if (!silent) setInfraStatusLoading(true);
    try {
      const res = await axios.get(`${API}/admin/infra-status`);
      setInfraStatus(res.data);
      setInfraStatusUpdatedAt(Date.now());
    } catch (err) {
      if (!silent) toast.error("Erreur lors du chargement de l'état de l'infrastructure");
    } finally {
      if (!silent) setInfraStatusLoading(false);
    }
  };

  const [quotaInput, setQuotaInput] = useState("");
  const [collectionsSortBy, setCollectionsSortBy] = useState("size_desc");
  const [collectionsExpanded, setCollectionsExpanded] = useState(false);
  const COLLECTIONS_COLLAPSED_COUNT = 6;
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(null); // which cleanup action is currently running
  const [orphanPreview, setOrphanPreview] = useState(null);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [exportCollection, setExportCollection] = useState("techniciens");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);

  // ---- Supervision par entite (snapshot/export/visualisation, #579) ----
  const [entitySelected, setEntitySelected] = useState("techniciens");
  const [entitySnapshot, setEntitySnapshot] = useState(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState(null);
  const [entityExporting, setEntityExporting] = useState(false);

  // Actions infra (Supervision) : redéployer Render, historique + restauration Netlify
  const [renderDeploys, setRenderDeploys] = useState(null);
  const [renderDeploysOpen, setRenderDeploysOpen] = useState(false);
  const [renderDeploysLoading, setRenderDeploysLoading] = useState(false);
  const [renderRedeployDialogOpen, setRenderRedeployDialogOpen] =
    useState(false);
  const [renderRedeploying, setRenderRedeploying] = useState(false);
  const [netlifyDeploys, setNetlifyDeploys] = useState(null);
  const [netlifyDeploysOpen, setNetlifyDeploysOpen] = useState(false);
  const [netlifyDeploysLoading, setNetlifyDeploysLoading] = useState(false);
  const [netlifyRestoringId, setNetlifyRestoringId] = useState(null);

  // Redondance stockage B2 (deux comptes Backblaze indépendants + bascule)
  const [supSection, setSupSection] = useState("overview"); // sous-section de la Supervision
  const [b2Status, setB2Status] = useState(null);
  const [b2StatusLoading, setB2StatusLoading] = useState(false);
  const [b2StatusUpdatedAt, setB2StatusUpdatedAt] = useState(null);
  const [cloudinaryStatus, setCloudinaryStatus] = useState(null);
  const [r2Status, setR2Status] = useState(null);
  const [r2Backing, setR2Backing] = useState(false);
  const [dataBackup, setDataBackup] = useState(null);
  const [dataBacking, setDataBacking] = useState(false);
  const [cloudinaryCfg, setCloudinaryCfg] = useState(null);
  const [cloudinaryForm, setCloudinaryForm] = useState({ cloud: "", api_key: "", api_secret: "" });
  const [cloudinarySaving, setCloudinarySaving] = useState(false);
  const [ledMigration, setLedMigration] = useState(null);
  const [ledMigrating, setLedMigrating] = useState(false);
  const [b2LimitInputs, setB2LimitInputs] = useState({
    primary: "",
    backup: "",
    tertiary: "",
  });
  const [b2LimitsSaving, setB2LimitsSaving] = useState(null); // 'primary' | 'backup' | 'tertiary' | null
  const [b2ToggleDialogOpen, setB2ToggleDialogOpen] = useState(false);
  const [b2Toggling, setB2Toggling] = useState(false);
  const [b2Backfilling, setB2Backfilling] = useState(false);
  const [b2MirrorToggling, setB2MirrorToggling] = useState(false);

  const toggleRenderDeploys = async () => {
    const next = !renderDeploysOpen;
    setRenderDeploysOpen(next);
    if (next && !renderDeploys) {
      setRenderDeploysLoading(true);
      try {
        const res = await axios.get(`${API}/admin/infra/render/deploys`);
        setRenderDeploys(res.data);
      } catch (err) {
        toast.error("Impossible de charger l'historique Render");
      } finally {
        setRenderDeploysLoading(false);
      }
    }
  };

  const handleRenderRedeploy = async () => {
    setRenderRedeploying(true);
    try {
      const res = await axios.post(`${API}/admin/infra/render/redeploy`);
      toast.success(res.data.message || "Redéploiement lancé");
      setRenderRedeployDialogOpen(false);
      setRenderDeploys(null);
      setTimeout(() => {
        fetchInfraStatus();
      }, 4000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors du redéploiement");
    } finally {
      setRenderRedeploying(false);
    }
  };

  const toggleNetlifyDeploys = async () => {
    const next = !netlifyDeploysOpen;
    setNetlifyDeploysOpen(next);
    if (next && !netlifyDeploys) {
      setNetlifyDeploysLoading(true);
      try {
        const res = await axios.get(`${API}/admin/infra/netlify/deploys`);
        setNetlifyDeploys(res.data);
      } catch (err) {
        toast.error("Impossible de charger l'historique Netlify");
      } finally {
        setNetlifyDeploysLoading(false);
      }
    }
  };

  const handleNetlifyRestore = async (deployId) => {
    setNetlifyRestoringId(deployId);
    try {
      const res = await axios.post(
        `${API}/admin/infra/netlify/deploys/${deployId}/restore`,
      );
      toast.success(res.data.message || "Déploiement restauré");
      setNetlifyDeploys(null);
      setNetlifyDeploysOpen(false);
      setTimeout(() => {
        fetchInfraStatus();
      }, 2000);
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de la restauration",
      );
    } finally {
      setNetlifyRestoringId(null);
    }
  };

  const fetchB2Status = async (silent = false) => {
    if (!silent) setB2StatusLoading(true);
    try {
      const res = await axios.get(`${API}/admin/infra/b2-status`);
      setB2Status(res.data);
      setB2StatusUpdatedAt(Date.now());
    } catch (err) {
      if (!silent) toast.error("Erreur lors du chargement du stockage B2");
    } finally {
      if (!silent) setB2StatusLoading(false);
    }
  };

  const fetchCloudinaryConfig = async () => {
    try {
      const res = await axios.get(`${API}/admin/infra/cloudinary-config`);
      setCloudinaryCfg(res.data);
    } catch (err) {
      setCloudinaryCfg(null);
    }
  };

  const fetchLedMigration = async () => {
    try {
      const res = await axios.get(`${API}/led/migration-status`);
      setLedMigration(res.data);
    } catch (err) {
      setLedMigration(null);
    }
  };

  const fetchDataBackup = async () => {
    try { setDataBackup((await axios.get(`${API}/admin/infra/data-backup`)).data); } catch (err) { setDataBackup(null); }
  };

  const handleDataBackupNow = async () => {
    setDataBacking(true);
    try {
      await axios.post(`${API}/admin/infra/data-backup`);
      toast.success("Sauvegarde des données effectuée");
      fetchDataBackup();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sauvegarde impossible");
    } finally {
      setDataBacking(false);
    }
  };

  // Instantanés des données : choix du stockage / de la date, téléchargement, restauration des fiches manquantes.
  const [snapSel, setSnapSel] = useState({}); // { [domaine]: { source, date, dates:[], busy } }
  const patchSnap = (domain, patch) => setSnapSel((p) => ({ ...p, [domain]: { source: "auto", date: "latest", dates: [], ...(p[domain] || {}), ...patch } }));
  const loadSnapDates = async (domain, source) => {
    try {
      const res = await axios.get(`${API}/admin/infra/data-backup/${domain}/snapshots`, { params: source && source !== "auto" ? { source } : {} });
      patchSnap(domain, { dates: res.data.dates || [], source: source || "auto", date: "latest" });
    } catch (err) {
      patchSnap(domain, { dates: [], source: source || "auto", date: "latest" });
    }
  };
  const snapParams = (domain) => {
    const sel = snapSel[domain] || {};
    const params = {};
    if (sel.source && sel.source !== "auto") params.source = sel.source;
    if (sel.date && sel.date !== "latest") params.date = sel.date;
    return params;
  };
  const handleSnapDownload = async (domain) => {
    patchSnap(domain, { busy: "download" });
    try {
      const sel = snapSel[domain] || {};
      const res = await axios.get(`${API}/admin/infra/data-backup/${domain}/download`, { params: snapParams(domain), responseType: "blob" });
      const filename = `${domain}-${sel.date && sel.date !== "latest" ? sel.date : "latest"}.json.gz`;
      const status = await downloadOrShareFile(res.data, filename, { title: filename });
      const msg = downloadStatusMessage(status);
      if (status === "blocked") toast.error(msg); else toast.success(msg || "Sauvegarde téléchargée");
    } catch (err) {
      toast.error("Téléchargement impossible : cet instantané n'est pas disponible sur ce stockage");
    } finally {
      patchSnap(domain, { busy: null });
    }
  };
  // Répare les lignes du planning remplacées par 0,1,2… : aperçu, puis restauration depuis les sauvegardes.
  const handlePlanningRepair = async () => {
    patchSnap("planning", { busy: "repair" });
    try {
      const pre = (await axios.post(`${API}/admin/planning/repair-cells`, null, { params: { dry_run: true } })).data;
      if (!pre.abimees) { toast.success("Aucune ligne abîmée : tout est en ordre"); return; }
      const ok = window.confirm(`${pre.abimees} ligne(s) de planning abîmée(s) sur ${Object.keys(pre.plannings || {}).length} planning(s).\n${pre.restaurables} peuvent être restaurées depuis les sauvegardes (${(pre.instantanes_utilises || []).join(", ")}), ${pre.introuvables} introuvable(s).\n\nRestaurer maintenant ?`);
      if (!ok) return;
      const res = (await axios.post(`${API}/admin/planning/repair-cells`, null, { params: { dry_run: false } })).data;
      toast.success(`${res.restaurables} ligne(s) restaurée(s)${res.introuvables ? `, ${res.introuvables} introuvable(s)` : ""}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Réparation impossible");
    } finally {
      patchSnap("planning", { busy: null });
    }
  };
  // Remplit le planning du mois en cours (vendredi + dimanche) d'après les exports fournis : aperçu puis application.
  const fillNow = new Date();
  const fillLabel = `${["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][fillNow.getMonth()]} ${fillNow.getFullYear()}`;
  const handlePlanningFillOctobre = async () => {
    patchSnap("planning", { busy: "fill" });
    try {
      const pre = (await axios.post(`${API}/admin/planning/fill-from-export`, null, { params: { annee: fillNow.getFullYear(), mois: fillNow.getMonth() + 1, dry_run: true } })).data;
      const lignes = (j) => (pre[j]?.erreur ? `erreur : ${pre[j].erreur}` : `${pre[j]?.lignes_remplies ?? 0} ligne(s)`);
      const ok = window.confirm(`Planning ${pre.planning} : remplir les affectations d'après les exports.\nDimanche : ${lignes("dimanche")}\nVendredi : ${lignes("vendredi")}\n\nCela remplace les affectations actuelles de ces deux plannings. Continuer ?`);
      if (!ok) return;
      await axios.post(`${API}/admin/planning/fill-from-export`, null, { params: { annee: fillNow.getFullYear(), mois: fillNow.getMonth() + 1, dry_run: false } });
      toast.success(`Planning de ${fillLabel} rempli`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Remplissage impossible");
    } finally {
      patchSnap("planning", { busy: null });
    }
  };
  const handleSnapRestore = async (domain) => {
    if (!window.confirm(`Restaurer les fiches manquantes de « ${domain} » depuis cette sauvegarde ?\nAucune fiche existante n'est modifiée ni supprimée : seules les fiches absentes sont ajoutées.`)) return;
    patchSnap(domain, { busy: "restore" });
    try {
      const res = await axios.post(`${API}/admin/infra/data-restore`, null, { params: { domain, ...snapParams(domain) } });
      const total = Object.values(res.data.restaurees || {}).reduce((a, b) => a + b, 0);
      toast.success(total ? `${total} fiche(s) restaurée(s) depuis ${res.data.source}` : `Rien à restaurer : toutes les fiches sont déjà présentes (${res.data.source})`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Restauration impossible");
    } finally {
      patchSnap(domain, { busy: null });
    }
  };

  const fetchR2Status = async () => {
    try {
      const res = await axios.get(`${API}/admin/infra/r2-status`);
      setR2Status(res.data);
    } catch (err) {
      setR2Status({ enabled: true, error: err.response?.data?.detail || "Lecture impossible" });
    }
  };

  const handleR2BackupCloudinary = async () => {
    setR2Backing(true);
    try {
      const res = await axios.post(`${API}/admin/infra/r2-backup-cloudinary`);
      toast.success(res.data.started ? `Copie lancée (${res.data.total} fichier(s))` : res.data.message);
      setTimeout(fetchR2Status, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible de lancer la copie");
    } finally {
      setR2Backing(false);
    }
  };

  const handleStartLedMigration = async () => {
    setLedMigrating(true);
    try {
      await axios.post(`${API}/led/migrate-to-cloudinary`);
      toast.success("Migration lancée en arrière-plan");
      setTimeout(fetchLedMigration, 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible de lancer la migration");
    } finally {
      setLedMigrating(false);
    }
  };

  const handleSaveCloudinary = async () => {
    setCloudinarySaving(true);
    try {
      const res = await axios.put(`${API}/admin/infra/cloudinary-config`, cloudinaryForm);
      toast.success(`Cloudinary connecté (réglage d'envoi ${res.data.preset_state})`);
      setCloudinaryForm({ cloud: "", api_key: "", api_secret: "" });
      await fetchCloudinaryConfig();
      await fetchCloudinaryStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Enregistrement impossible");
    } finally {
      setCloudinarySaving(false);
    }
  };

  const handleDeleteCloudinary = async () => {
    if (!window.confirm("Déconnecter Cloudinary ? Les nouveaux envois du site LED reviendront au stockage B2. Les fichiers déjà chez Cloudinary restent affichés.")) return;
    try {
      await axios.delete(`${API}/admin/infra/cloudinary-config`);
      toast.success("Cloudinary déconnecté");
      await fetchCloudinaryConfig();
      await fetchCloudinaryStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const fetchCloudinaryStatus = async () => {
    try {
      const res = await axios.get(`${API}/admin/infra/cloudinary-status`);
      setCloudinaryStatus(res.data);
    } catch (err) {
      setCloudinaryStatus({ configured: true, error: err.response?.data?.detail || "Lecture impossible" });
    }
  };

  const handleSaveB2Limit = async (account) => {
    const raw = b2LimitInputs[account];
    const value = raw === "" ? null : parseFloat(raw);
    if (raw !== "" && (isNaN(value) || value < 0)) {
      toast.error("Entrez un nombre valide (en Go)");
      return;
    }
    setB2LimitsSaving(account);
    try {
      const payload = { [`${account}_limit_gb`]: raw === "" ? 0 : value };
      await axios.put(`${API}/admin/infra/b2-limits`, payload);
      toast.success("Limite enregistrée");
      setB2LimitInputs((prev) => ({ ...prev, [account]: "" }));
      fetchB2Status();
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          "Erreur lors de l'enregistrement de la limite",
      );
    } finally {
      setB2LimitsSaving(null);
    }
  };

  const handleB2Backfill = async () => {
    setB2Backfilling(true);
    try {
      const res = await axios.post(`${API}/admin/infra/b2-backfill`);
      const r = res.data;
      const parts = [];
      if (r.backup_copied) parts.push(`${r.backup_copied} vers secours`);
      if (r.tertiary_copied)
        parts.push(`${r.tertiary_copied} vers géo-redondant`);
      toast.success(
        parts.length
          ? `Backfill terminé — ${parts.join(", ")}.`
          : `Backfill terminé — tout était déjà à jour (${r.total} fichiers vérifiés).`,
      );
      if (r.errors?.length)
        toast.error(
          `${r.errors.length} fichier(s) en erreur — voir logs serveur`,
        );
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors du backfill");
    } finally {
      setB2Backfilling(false);
    }
  };

  const handleB2MirrorToggle = async () => {
    setB2MirrorToggling(true);
    try {
      const res = await axios.post(`${API}/admin/infra/b2-mirroring-toggle`);
      toast.success(res.data.message || "Copie automatique mise à jour");
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors du changement");
    } finally {
      setB2MirrorToggling(false);
    }
  };

  const handleB2Toggle = async () => {
    setB2Toggling(true);
    try {
      const res = await axios.post(`${API}/admin/infra/b2-toggle`);
      toast.success(res.data.message || "Compte actif basculé");
      setB2ToggleDialogOpen(false);
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la bascule");
    } finally {
      setB2Toggling(false);
    }
  };

  const handleSaveQuota = async () => {
    const value = parseFloat(quotaInput);
    if (quotaInput && (isNaN(value) || value < 0)) {
      toast.error("Entrez un nombre valide (en Go)");
      return;
    }
    setQuotaSaving(true);
    try {
      await axios.put(`${API}/admin/storage-quota`, {
        quota_gb: quotaInput ? value : 0,
      });
      toast.success(quotaInput ? "Quota enregistré" : "Quota retiré");
      setQuotaInput("");
      fetchSystemStatus();
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement du quota");
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleClearBrowserCache = async () => {
    setCleanupBusy("cache");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success("Cache vidé — la page va se recharger");
      setTimeout(() => window.location.reload(true), 800);
    } catch (err) {
      toast.error("Erreur lors du nettoyage du cache");
      setCleanupBusy(null);
    }
  };

  const handlePreviewOrphanedFiles = async () => {
    setCleanupBusy("orphan-preview");
    try {
      const res = await axios.get(`${API}/admin/cleanup/orphaned-files`);
      setOrphanPreview(res.data);
      if (res.data.count === 0) toast.success("Aucun fichier orphelin trouvé");
    } catch (err) {
      toast.error("Erreur lors de la vérification");
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleConfirmOrphanedCleanup = async () => {
    setCleanupBusy("orphan-delete");
    try {
      const res = await axios.post(`${API}/admin/cleanup/orphaned-files`);
      toast.success(`${res.data.deleted_count} fichier(s) supprimé(s)`);
      setOrphanPreview(null);
      fetchSystemStatus();
    } catch (err) {
      toast.error("Erreur lors du nettoyage");
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleCleanupLogs = async () => {
    setCleanupBusy("logs");
    try {
      const res = await axios.post(`${API}/admin/cleanup/logs`);
      toast.success(
        `${res.data.deleted_count} log(s) de plus de 1 mois supprimé(s)`,
      );
      fetchSystemStatus();
    } catch (err) {
      toast.error("Erreur lors du nettoyage des logs");
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleCleanupNotifications = async () => {
    setCleanupBusy("notifications");
    try {
      const res = await axios.post(`${API}/admin/cleanup/notifications`);
      toast.success(
        `${res.data.deleted_count} notification(s) de plus de 1 mois supprimée(s)`,
      );
      fetchSystemStatus();
    } catch (err) {
      toast.error("Erreur lors du nettoyage des notifications");
    } finally {
      setCleanupBusy(null);
    }
  };

  const [purgeAllNotifDialogOpen, setPurgeAllNotifDialogOpen] = useState(false);
  const [purgeAllNotifBusy, setPurgeAllNotifBusy] = useState(false);

  const handlePurgeAllNotificationsNow = async () => {
    setPurgeAllNotifBusy(true);
    try {
      const res = await axios.post(
        `${API}/admin/cleanup/notifications/purge-all`,
      );
      toast.success(
        `${res.data.deleted_count} notification(s) supprimée(s) — historique complet purgé`,
      );
      setPurgeAllNotifDialogOpen(false);
      fetchSystemStatus();
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
          "Erreur lors de la purge totale des notifications",
      );
    } finally {
      setPurgeAllNotifBusy(false);
    }
  };

  // Purge totale des logs (immédiate) — réservée au titulaire du compte
  // (Guichard) et aux comptes qu'il autorise explicitement, cf. backend.
  const [canPurgeAllLogs, setCanPurgeAllLogs] = useState(false);
  const [purgeAllDialogOpen, setPurgeAllDialogOpen] = useState(false);
  const [purgeAllBusy, setPurgeAllBusy] = useState(false);
  const [logPurgeAllowlist, setLogPurgeAllowlist] = useState(null);
  const [allowlistAddUserId, setAllowlistAddUserId] = useState("");
  const [allowlistBusy, setAllowlistBusy] = useState(false);

  const isOwnerAccount = currentUser?.username === "Guichard";

  const fetchCanPurgeAllLogs = async () => {
    try {
      const res = await axios.get(`${API}/admin/logs/can-purge-all`);
      setCanPurgeAllLogs(!!res.data.allowed);
    } catch (err) {
      setCanPurgeAllLogs(false);
    }
  };

  const fetchLogPurgeAllowlist = async () => {
    try {
      const res = await axios.get(`${API}/admin/logs/purge-allowlist`);
      setLogPurgeAllowlist(res.data);
    } catch (err) {
      setLogPurgeAllowlist([]);
    }
  };

  const handlePurgeAllLogsNow = async () => {
    setPurgeAllBusy(true);
    try {
      const res = await axios.post(`${API}/admin/cleanup/logs/purge-all`);
      toast.success(
        `${res.data.deleted_count} log(s) supprimé(s) — historique complet purgé`,
      );
      setPurgeAllDialogOpen(false);
      fetchSystemStatus();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Erreur lors de la purge totale des logs",
      );
    } finally {
      setPurgeAllBusy(false);
    }
  };

  const handleAddAllowlistUser = async () => {
    if (!allowlistAddUserId) return;
    setAllowlistBusy(true);
    try {
      await axios.post(`${API}/admin/logs/purge-allowlist`, {
        user_id: allowlistAddUserId,
      });
      toast.success("Autorisation accordée");
      setAllowlistAddUserId("");
      fetchLogPurgeAllowlist();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'ajout");
    } finally {
      setAllowlistBusy(false);
    }
  };

  const handleRemoveAllowlistUser = async (userId) => {
    setAllowlistBusy(true);
    try {
      await axios.delete(`${API}/admin/logs/purge-allowlist/${userId}`);
      toast.success("Autorisation retirée");
      fetchLogPurgeAllowlist();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors du retrait");
    } finally {
      setAllowlistBusy(false);
    }
  };

  const handleRestartServer = async () => {
    setRestarting(true);
    try {
      await axios.post(`${API}/admin/restart-server`);
      toast.success(
        "Redémarrage lancé — l'application sera indisponible environ une minute",
      );
      setRestartDialogOpen(false);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("Vous n'avez pas les droits pour redémarrer le serveur");
        setRestartDialogOpen(false);
        return;
      }
      // A network error here can be entirely expected: the server may have
      // already gone down before the response finished round-tripping.
      toast.success(
        "Redémarrage probablement lancé — réessayez dans une minute si l'app ne répond plus",
      );
      setRestartDialogOpen(false);
    } finally {
      setRestarting(false);
    }
  };

  const handleExportData = async () => {
    // Must happen synchronously, before any `await` below, or Safari on iOS
    // silently blocks the fallback tab (see utils/fileDownload.js).
    const preOpenedWindow = reserveTabForIOSFallback();
    setExporting(true);
    try {
      const res = await axios.get(
        `${API}/admin/export/${exportCollection}?format=${exportFormat}`,
        {
          responseType: "blob",
        },
      );
      const filename = `${exportCollection}.${exportFormat}`;
      const status = await downloadOrShareFile(res.data, filename, {
        title: filename,
        preOpenedWindow,
      });
      if (status === "downloaded") toast.success("Export téléchargé");
      else if (status === "blocked") toast.error(downloadStatusMessage(status));
    } catch (err) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  // ---- Supervision par entite : charge le snapshot (compte/taille/echantillon) ----
  const fetchEntitySnapshot = async (collection) => {
    setEntityLoading(true);
    setEntityError(null);
    try {
      const res = await axios.get(`${API}/admin/supervision/entity/${collection}`);
      setEntitySnapshot(res.data);
    } catch (err) {
      setEntitySnapshot(null);
      setEntityError(
        err.response?.status === 404
          ? "Categorie inconnue"
          : "Impossible de charger l'apercu de cette entite",
      );
    } finally {
      setEntityLoading(false);
    }
  };

  // Convertit un tableau d'objets (echantillon ou export complet) en feuille
  // XLSX -- meme approche que buildEffectifListXLSX dans Effectif.js (xlsx-js-style).
  const buildEntityXLSX = (collection, rows) => {
    const keys = [];
    const seen = new Set();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    const stringify = (v) => {
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    };
    const aoa = [keys, ...rows.map((r) => keys.map((k) => stringify(r[k])))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const HEADER_HEX = "1F4E78";
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: HEADER_HEX } },
      alignment: { horizontal: "center", vertical: "center" },
    };
    keys.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = headerStyle;
    });
    ws["!cols"] = keys.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      (SUPERVISED_COLLECTIONS_LABELS[collection] || collection).slice(0, 31),
    );
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  };

  const handleExportEntityXlsx = async () => {
    const preOpenedWindow = reserveTabForIOSFallback();
    setEntityExporting(true);
    try {
      const res = await axios.get(
        `${API}/admin/supervision/entity/${entitySelected}/export`,
      );
      const rows = Array.isArray(res.data) ? res.data : [];
      await loadXLSX();
      const blob = buildEntityXLSX(entitySelected, rows);
      const filename = `${entitySelected}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const status = await downloadOrShareFile(blob, filename, {
        title: filename,
        preOpenedWindow,
      });
      if (status === "downloaded") toast.success("Export Excel téléchargé");
      else if (status === "blocked") toast.error(downloadStatusMessage(status));
    } catch (err) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export de l'entité");
    } finally {
      setEntityExporting(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    full_name: "",
    niveau_acces: "",
  });

  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    category: "",
    permissions: [],
    planning_full_control: false,
    planning_scope: [],
    scope_map: {},
  });
  const [planningScopeInput, setPlanningScopeInput] = useState("");
  // Valeurs de périmètre disponibles par droit segmentable (salles, catégories
  // fournisseur/document, branches...) — chargées une fois, utilisées pour
  // construire les puces à cocher dans le dialogue de groupe.
  const [scopeOptions, setScopeOptions] = useState({});
  // Etat purement local (jamais envoyé au backend) qui mémorise, par droit
  // segmentable, si l'utilisateur a explicitement basculé le switch
  // "Contrôle total" sur OFF. Nécessaire car scope_map[permKey] vide sert
  // aussi bien à représenter "contrôle total" qu'à représenter "restreint
  // mais aucune section encore cochée" côté backend — sans cet état local
  // le switch retombait aussitôt sur "Contrôle total" dès qu'on le
  // décochait avec une liste encore vide (bug corrigé le 20/08/2026).
  const [scopeOverride, setScopeOverride] = useState({});
  // Sections/postes Planning réels (dérivés des plannings existants côté
  // serveur) affichés en puces à cocher dans "Segmentation du planning",
  // à la place du champ texte libre seul (qui reste disponible en
  // complément pour toute valeur non encore répertoriée).
  const [planningScopeOptions, setPlanningScopeOptions] = useState({
    sections: [],
    postes: [],
  });

  useEffect(() => {
    if ((isAdmin() || isGestionnaireOnly) && !isReadOnlyAdmin) {
      axios
        .get(`${API}/groups/scope-options`)
        .then((res) => setScopeOptions(res.data))
        .catch(() => {});
      axios
        .get(`${API}/groups/planning-scope-options`)
        .then((res) => setPlanningScopeOptions(res.data))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin() && !isGestionnaireOnly && !isReadOnlyAdmin) {
      toast.error("Accès réservé aux administrateurs");
      navigate("/");
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (activeTab === "rights" && (isSuperAdmin() || isAdmin())) {
      fetchRolePermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Charge l'apercu "par entite" (#579) des qu'on est sur l'onglet
  // Supervision et a chaque changement de collection selectionnee.
  useEffect(() => {
    if (activeTab === "supervision" && (isSuperAdmin() || isAdmin())) {
      fetchEntitySnapshot(entitySelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, entitySelected]);

  // #504 (rendre la Supervision réellement live/temps réel) : remplace les
  // setInterval fixes par un setTimeout auto-récursif par section, avec une
  // cadence propre à chacune selon ce qu'elle coûte réellement côté serveur
  // (voir server.py) : lecture Mongo locale (system-status) -> 20s ; appels
  // externes Render+Netlify (infra-status, désormais mis en cache 45s côté
  // serveur) -> 60s ; listing complet des buckets B2 (b2-status, caché 40s
  // côté serveur) -> 45s. Le setTimeout récursif (plutôt que setInterval)
  // permet à un clic manuel "Actualiser" de réellement réinitialiser le
  // compte à rebours au lieu de se contenter d'un fetch en plus (voir
  // restartSupervisionPolling ci-dessous). L'API Page Visibility met les 3
  // cycles en pause quand l'onglet du navigateur n'est pas visible (aucune
  // requête gaspillée) et les relance avec un refresh immédiat au retour.
  const supervisionTimersRef = useRef({ system: null, infra: null, b2: null });
  const SUPERVISION_DELAYS = { system: 20000, infra: 60000, b2: 45000 };
  const supervisionFetchersRef = useRef({});
  supervisionFetchersRef.current = {
    system: fetchSystemStatus,
    infra: fetchInfraStatus,
    b2: fetchB2Status,
  };

  const scheduleSupervisionRefresh = (key) => {
    const timers = supervisionTimersRef.current;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(async () => {
      if (document.visibilityState === "visible") {
        await supervisionFetchersRef.current[key](true);
      }
      scheduleSupervisionRefresh(key);
    }, SUPERVISION_DELAYS[key]);
  };

  const stopSupervisionPolling = () => {
    const timers = supervisionTimersRef.current;
    Object.keys(timers).forEach((k) => {
      if (timers[k]) clearTimeout(timers[k]);
      timers[k] = null;
    });
  };

  // Utilisé par le bouton "Actualiser" manuel : relance les 3 cycles à zéro
  // pour que le prochain refresh auto n'arrive pas juste après le manuel.
  const restartSupervisionPolling = () => {
    ["system", "infra", "b2"].forEach((key) => scheduleSupervisionRefresh(key));
  };

  useEffect(() => {
    if (activeTab !== "supervision" || !ledMigration?.running) return undefined;
    const t = setInterval(fetchLedMigration, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [activeTab, ledMigration?.running]);

  useEffect(() => {
    if (activeTab !== "supervision" || !canViewReadOnlyTabs) return;
    fetchSystemStatus();
    fetchInfraStatus();
    fetchB2Status();
    fetchCloudinaryStatus();
    fetchCloudinaryConfig();
    fetchR2Status();
    fetchDataBackup();
    fetchLedMigration();
    if (isSuperAdmin()) {
      fetchCanPurgeAllLogs();
      if (isOwnerAccount && !logPurgeAllowlist) {
        fetchLogPurgeAllowlist();
      }
    }
    ["system", "infra", "b2"].forEach((key) => scheduleSupervisionRefresh(key));

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // L'onglet redevient visible : refresh immédiat plutôt que d'attendre
        // le prochain tick, puis on relance les 3 cycles proprement.
        fetchSystemStatus(true);
        fetchInfraStatus(true);
        fetchB2Status(true);
        ["system", "infra", "b2"].forEach((key) => scheduleSupervisionRefresh(key));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stopSupervisionPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Demande explicite (22/08/2026) : les Logs doivent se mettre à jour tout
  // seuls plutôt que d'attendre un clic sur "Actualiser" — même principe que
  // Supervision ci-dessus : refetch à l'ouverture de l'onglet + toutes les
  // 20s tant qu'il reste ouvert. fetchLogs() est silencieux en cas d'échec
  // (pas de toast d'erreur répété toutes les 20s sur un blip réseau) — le
  // clic manuel "Actualiser" (fetchData) reste, lui, bruyant en cas d'erreur.
  // #504 : mise en pause quand l'onglet navigateur n'est pas visible + reprise
  // avec refresh immédiat, comme pour Supervision ci-dessus.
  const logsTimerRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API}/logs`);
      setLogs(res.data);
      setLogsUpdatedAt(Date.now());
    } catch (err) {
      // silencieux — rafraîchissement en arrière-plan
    }
  };

  const scheduleLogsRefresh = () => {
    if (logsTimerRef.current) clearTimeout(logsTimerRef.current);
    logsTimerRef.current = setTimeout(async () => {
      if (document.visibilityState === "visible") {
        await fetchLogs();
      }
      scheduleLogsRefresh();
    }, 20000);
  };

  useEffect(() => {
    if (activeTab !== "logs") return;
    fetchLogs();
    scheduleLogsRefresh();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchLogs();
        scheduleLogsRefresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (logsTimerRef.current) clearTimeout(logsTimerRef.current);
      logsTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Human-readable byte formatting (KB/MB/GB), and a plain-language health
  // read on the numbers rather than a raw quota bar — Railway's MongoDB
  // volumes are usage-based rather than a small fixed quota like a free
  // Atlas cluster, so there's no single "% full" figure that means
  // anything; what actually matters here is "is this growing into
  // something concerning" which a human can judge better than a fake
  // progress bar pretending there's a hard 512MB-style ceiling.
  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return "0 Ko";
    const units = ["Ko", "Mo", "Go"];
    let value = bytes / 1024;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
      value /= 1024;
      unitIdx++;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIdx]}`;
  };

  const formatUptime = (seconds) => {
    if (!seconds || seconds < 0) return "—";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} j ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${minutes} min`;
  };

  const fetchData = async () => {
    try {
      // La Coordination a maintenant accès à Groupes & Droits ET Logs (lecture
      // seule, #299) — /logs accepte désormais ce rôle côté serveur, donc
      // plus besoin de le contourner ici comme avant.
      const [
        usersRes,
        logsRes,
        groupsRes,
        maintenanceRes,
        retardRes,
        testModeRes,
      ] = await Promise.all([
        axios.get(`${API}/auth/users`).catch(() => ({ data: [] })),
        axios.get(`${API}/logs`).catch(() => ({ data: [] })),
        axios.get(`${API}/groups/enhanced`).catch(() => ({ data: [] })),
        axios
          .get(`${API}/maintenance`)
          .catch(() => ({ data: { entries: [] } })),
        axios
          .get(`${API}/dashboard/retard-settings`)
          .catch(() => ({ data: { enabled: false } })),
        axios
          .get(`${API}/admin/test-mode`)
          .catch(() => ({ data: { enabled: false, test_user_ids: [] } })),
      ]);
      setUsers(usersRes.data);
      setLogs(logsRes.data);
      setGroups(groupsRes.data);
      setMaintenanceEntries(maintenanceRes.data.entries || []);
      setMaintenancePagePath(MAINTENANCE_PAGES[0].path);
      setRetardEnabled(!!retardRes.data.enabled);
      setRetardNotifyUserIds(retardRes.data.notify_user_ids || []);
      setTestModeEnabled(!!testModeRes.data.enabled);
      setTestModeUserIds(testModeRes.data.test_user_ids || []);
    } catch (err) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  // Maintenance mode handlers
  const toggleMaintenanceRole = (role) => {
    setMaintenanceAffectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleAddMaintenanceEntry = async () => {
    if (!isSuperAdmin()) {
      toast.error("Seul le Super Admin peut modifier le mode maintenance");
      return;
    }
    if (maintenanceScope === "page" && !maintenancePagePath) {
      toast.error("Choisissez une page à mettre en maintenance");
      return;
    }
    setMaintenanceLoading(true);
    try {
      const res = await axios.post(`${API}/maintenance/entries`, {
        message:
          maintenanceMessage ||
          "Maintenance en cours. Veuillez réessayer plus tard.",
        scope: maintenanceScope,
        page_path: maintenanceScope === "page" ? maintenancePagePath : null,
        affected_roles:
          maintenanceAffectedRoles.length > 0 ? maintenanceAffectedRoles : null,
      });
      setMaintenanceEntries((prev) => {
        // Une nouvelle activation "site" couvre déjà tout, et une nouvelle
        // activation "page" remplace une éventuelle activation existante
        // sur cette même page (cf. logique backend) — on retire donc les
        // entrées équivalentes avant d'ajouter la nouvelle.
        const filtered =
          res.data.scope === "site"
            ? []
            : prev.filter(
                (e) =>
                  !(e.scope === "page" && e.page_path === res.data.page_path),
              );
        return [...filtered, res.data];
      });
      setMaintenanceMessage("");
      toast.success("Maintenance activée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleRemoveMaintenanceEntry = async (entryId) => {
    if (!isSuperAdmin()) {
      toast.error("Seul le Super Admin peut modifier le mode maintenance");
      return;
    }
    setMaintenanceLoading(true);
    try {
      await axios.delete(`${API}/maintenance/entries/${entryId}`);
      setMaintenanceEntries((prev) => prev.filter((e) => e.id !== entryId));
      toast.success("Maintenance désactivée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleRetardToggle = async (checked) => {
    if (!isAdmin()) {
      toast.error("Seul un Admin peut modifier ce réglage");
      return;
    }
    setRetardLoading(true);
    try {
      const res = await axios.put(`${API}/dashboard/retard-settings`, {
        enabled: checked,
      });
      setRetardEnabled(!!res.data.enabled);
      toast.success(
        checked
          ? "Signalement de retard activé"
          : "Signalement de retard désactivé",
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setRetardLoading(false);
    }
  };

  const handleToggleRetardRecipient = async (userId) => {
    if (!isAdmin()) {
      toast.error("Seul un Admin peut modifier ce réglage");
      return;
    }
    const next = retardNotifyUserIds.includes(userId)
      ? retardNotifyUserIds.filter((id) => id !== userId)
      : [...retardNotifyUserIds, userId];
    setRetardNotifyUserIds(next);
    setRetardRecipientsSaving(true);
    try {
      const res = await axios.put(`${API}/dashboard/retard-settings`, {
        notify_user_ids: next,
      });
      setRetardNotifyUserIds(res.data.notify_user_ids || next);
    } catch (err) {
      setRetardNotifyUserIds(retardNotifyUserIds); // revert on error
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setRetardRecipientsSaving(false);
    }
  };

  const handleTestModeToggle = async (checked) => {
    if (!isAdmin()) {
      toast.error("Seul un Admin peut modifier ce réglage");
      return;
    }
    setTestModeLoading(true);
    try {
      const res = await axios.put(`${API}/admin/test-mode`, {
        enabled: checked,
      });
      setTestModeEnabled(!!res.data.enabled);
      toast.success(checked ? "Mode test activé" : "Mode test désactivé");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setTestModeLoading(false);
    }
  };

  const handleToggleTestUser = async (userId) => {
    if (!isAdmin()) {
      toast.error("Seul un Admin peut modifier ce réglage");
      return;
    }
    const next = testModeUserIds.includes(userId)
      ? testModeUserIds.filter((id) => id !== userId)
      : [...testModeUserIds, userId];
    setTestModeUserIds(next);
    setTestModeSaving(true);
    try {
      const res = await axios.put(`${API}/admin/test-mode`, {
        test_user_ids: next,
      });
      setTestModeUserIds(res.data.test_user_ids || next);
    } catch (err) {
      setTestModeUserIds(testModeUserIds); // revert on error
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setTestModeSaving(false);
    }
  };

  // User handlers
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingUser) {
        // Update existing user
        await axios.put(`${API}/auth/users/${editingUser.id}`, {
          full_name: userForm.full_name,
          niveau_acces: userForm.niveau_acces,
          username: userForm.username,
          songs_access: userForm.songs_access !== false,
        });
        toast.success("Utilisateur modifié");
      } else {
        // Create new user
        await axios.post(`${API}/auth/users`, userForm);
        toast.success("Utilisateur créé");
      }
      setUserDialogOpen(false);
      setUserForm({
        username: "",
        password: "",
        full_name: "",
        niveau_acces: "",
      });
      setEditingUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = (user) => {
    setUserForm({
      username: user.username,
      password: "",
      full_name: user.full_name,
      niveau_acces: user.niveau_acces,
      songs_access: user.songs_access !== false,
    });
    setEditingUser(user);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    try {
      await axios.delete(`${API}/auth/users/${id}`);
      toast.success("Utilisateur supprimé");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      await axios.put(
        `${API}/auth/users/${user.id}/${user.is_active ? "deactivate" : "activate"}`,
      );
      toast.success(`Utilisateur ${user.is_active ? "désactivé" : "activé"}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères");
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(
        `${API}/auth/users/${selectedUserForReset.id}/reset-password`,
        {
          new_password: newPassword,
        },
      );
      toast.success("Mot de passe réinitialisé");
      setResetPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUserForReset(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  // Group handlers
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingGroup) {
        await axios.put(`${API}/groups/enhanced/${editingGroup.id}`, groupForm);
        toast.success("Groupe modifié");
      } else {
        await axios.post(`${API}/groups/enhanced`, groupForm);
        toast.success("Groupe créé");
      }
      setGroupDialogOpen(false);
      setGroupForm({
        name: "",
        description: "",
        category: "",
        permissions: [],
        planning_full_control: false,
        planning_scope: [],
        scope_map: {},
      });
      setPlanningScopeInput("");
      setScopeOverride({});
      setEditingGroup(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGroup = (group) => {
    setGroupForm({
      name: group.name,
      description: group.description || "",
      category: group.category || "",
      permissions: group.permissions || [],
      planning_full_control: group.planning_full_control || false,
      planning_scope: group.planning_scope || [],
      scope_map: group.scope_map || {},
    });
    setPlanningScopeInput("");
    setScopeOverride({});
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm("Supprimer ce groupe ?")) return;
    try {
      await axios.delete(`${API}/groups/enhanced/${id}`);
      toast.success("Groupe supprimé");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const togglePermission = (perm) => {
    setGroupForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  // User-Group assignment handlers
  const openAssignDialog = (user) => {
    setSelectedUserForGroups(user);
    setSelectedGroupIds(user.group_ids || []);
    setAssignDialogOpen(true);
  };

  const handleAssignGroups = async () => {
    setSubmitting(true);
    try {
      await axios.put(`${API}/users/${selectedUserForGroups.id}/groups`, {
        user_id: selectedUserForGroups.id,
        group_ids: selectedGroupIds,
      });
      toast.success("Groupes attribués");
      setAssignDialogOpen(false);
      setSelectedUserForGroups(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  // Group -> members handlers (reverse direction of Assign Groups above)
  const openMembersDialog = (group) => {
    setSelectedGroupForMembers(group);
    setSelectedMemberUserIds(
      users
        .filter((u) => (u.group_ids || []).includes(group.id))
        .map((u) => u.id),
    );
    setMemberSearch("");
    setMembersDialogOpen(true);
  };

  const handleUpdateGroupMembers = async () => {
    setSubmitting(true);
    try {
      await axios.put(
        `${API}/groups/enhanced/${selectedGroupForMembers.id}/members`,
        {
          user_ids: selectedMemberUserIds,
        },
      );
      toast.success("Membres du groupe mis à jour");
      setMembersDialogOpen(false);
      setSelectedGroupForMembers(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const getNiveauAccesColor = (niveau) => {
    const colors = {
      "Super Admin":
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      Admin:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      "Admin (lecture seule)":
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      Responsable:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      Coordination:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      Technicien:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    };
    return colors[niveau] || colors["Technicien"];
  };

  const getActionIcon = (action) => {
    if (action.includes("Connexion")) return "🔐";
    if (action.includes("Création")) return "➕";
    if (action.includes("Modification")) return "✏️";
    if (action.includes("Suppression")) return "🗑️";
    if (action.includes("Validation")) return "✅";
    if (action.includes("Refus")) return "❌";
    if (action.includes("Archivage")) return "📦";
    return "📋";
  };

  const getSeverityBadge = (severity) => {
    const map = {
      critical: { label: "Critique", className: "bg-red-100 text-red-800" },
      warning: { label: "Attention", className: "bg-amber-100 text-amber-800" },
      info: { label: "Info", className: "bg-slate-100 text-slate-600" },
    };
    const s = map[severity] || map.info;
    return <Badge className={s.className + " text-xs"}>{s.label}</Badge>;
  };

  // Centre d'administration : sections regroupées par thème (navigation latérale).
  const ADMIN_SECTIONS = [
    {
      title: "Comptes & accès",
      items: [
        { value: "users", label: "Utilisateurs", desc: "Comptes, niveaux, comptes de service", icon: Users, tone: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", show: canViewReadOnlyTabs || isGestionnaireOnly },
        { value: "groups", label: "Groupes & Droits", desc: "Groupes, membres, permissions", icon: Shield, tone: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", show: !isReadOnlyAdmin },
        { value: "rights", label: "Droits d'accès", desc: "Droits par niveau d'accès", icon: Lock, tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", show: isSuperAdmin() || isAdmin() },
      ],
    },
    {
      title: "Surveillance",
      items: [
        { value: "logs", label: "Logs", desc: "Historique des actions", icon: ScrollText, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", show: canViewReadOnlyTabs || isGestionnaireOnly },
        { value: "supervision", label: "Supervision", desc: "État des services en direct", icon: Activity, tone: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300", show: canViewReadOnlyTabs },
      ],
    },
    {
      title: "Système",
      items: [
        { value: "maintenance", label: "Maintenance", desc: "Mode maintenance, redémarrage", icon: AlertTriangle, tone: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", show: canViewReadOnlyTabs },
        { value: "notifications", label: "Notifications", desc: "Routage des notifications", icon: Bell, tone: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300", show: isSuperAdmin() },
      ],
    },
  ]
    .map((sec) => ({ ...sec, items: sec.items.filter((i) => i.show) }))
    .filter((sec) => sec.items.length > 0);
  const activeSection = ADMIN_SECTIONS.flatMap((sec) => sec.items).find((i) => i.value === activeTab);

  return (
    <div className="space-y-6" data-testid="administration-page">
      {/* Bandeau du centre d'administration */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-violet-500/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Shield className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Centre d'administration</h1>
              <p className="text-muted-foreground">
                Comptes, droits, surveillance et maintenance du système PAV
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-sm font-medium">
              <Users className="h-4 w-4 text-blue-600" />
              {users.filter((u) => u.is_active).length} comptes actifs
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-sm font-medium">
              <Shield className="h-4 w-4 text-violet-600" />
              {groups.length} groupes
            </span>
            {maintenanceEntries.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Maintenance active
              </span>
            )}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]"
      >
        {/* Navigation : colonne à gauche sur grand écran, bandeau défilant sur mobile */}
        <nav
          aria-label="Sections de l'administration"
          className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:block lg:space-y-5 lg:overflow-visible lg:rounded-2xl lg:border lg:bg-card lg:p-3 lg:shadow-sm"
          data-testid="admin-nav"
        >
          {ADMIN_SECTIONS.map((sec) => (
            <div key={sec.title} className="flex shrink-0 gap-2 lg:block lg:space-y-1">
              <p className="hidden px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:block">
                {sec.title}
              </p>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setActiveTab(item.value)}
                    aria-current={active ? "page" : undefined}
                    data-testid={`admin-nav-${item.value}`}
                    className={`flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left transition lg:w-full ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow"
                        : "border-transparent bg-muted/40 hover:bg-muted lg:bg-transparent"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-white/20 text-white" : item.tone
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">
                        {item.label}
                      </span>
                      <span
                        className={`hidden truncate text-xs lg:block ${
                          active ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {item.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {activeSection && (
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <span>Administration</span>
              <span>/</span>
              <span className="font-semibold text-foreground">{activeSection.label}</span>
            </div>
          )}

        {/* MAINTENANCE TAB */}
        {canViewReadOnlyTabs && (
          <MaintenanceTab
            handleAddMaintenanceEntry={handleAddMaintenanceEntry}
            handleRemoveMaintenanceEntry={handleRemoveMaintenanceEntry}
            handleRetardToggle={handleRetardToggle}
            handleTestModeToggle={handleTestModeToggle}
            handleToggleRetardRecipient={handleToggleRetardRecipient}
            handleToggleTestUser={handleToggleTestUser}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            maintenanceAffectedRoles={maintenanceAffectedRoles}
            maintenanceEntries={maintenanceEntries}
            maintenanceLoading={maintenanceLoading}
            maintenanceMessage={maintenanceMessage}
            maintenancePagePath={maintenancePagePath}
            maintenanceScope={maintenanceScope}
            retardEnabled={retardEnabled}
            retardLoading={retardLoading}
            retardNotifyUserIds={retardNotifyUserIds}
            retardRecipientsSaving={retardRecipientsSaving}
            setMaintenanceMessage={setMaintenanceMessage}
            setMaintenancePagePath={setMaintenancePagePath}
            setMaintenanceScope={setMaintenanceScope}
            setTestModeUserQuery={setTestModeUserQuery}
            testModeEnabled={testModeEnabled}
            testModeLoading={testModeLoading}
            testModeSaving={testModeSaving}
            testModeUserIds={testModeUserIds}
            testModeUserQuery={testModeUserQuery}
            toggleMaintenanceRole={toggleMaintenanceRole}
            users={users}
          />
        )}

        {/* USERS TAB */}
        {(canViewReadOnlyTabs || isGestionnaireOnly) && (
          <UsersTab
            createKioskAccount={createKioskAccount}
            currentUser={currentUser}
            editingUser={editingUser}
            generateKioskPassword={generateKioskPassword}
            getNiveauAccesColor={getNiveauAccesColor}
            handleDeleteUser={handleDeleteUser}
            handleToggleUserStatus={handleToggleUserStatus}
            handleUserSubmit={handleUserSubmit}
            isGestionnaireOnly={isGestionnaireOnly}
            isReadOnlyAdmin={isReadOnlyAdmin}
            isSuperAdmin={isSuperAdmin}
            kioskCreated={kioskCreated}
            kioskDialogOpen={kioskDialogOpen}
            kioskForm={kioskForm}
            kioskSubmitting={kioskSubmitting}
            loading={loading}
            setEditingUser={setEditingUser}
            setKioskCreated={setKioskCreated}
            setKioskDialogOpen={setKioskDialogOpen}
            setKioskForm={setKioskForm}
            setNewPassword={setNewPassword}
            setResetPasswordDialogOpen={setResetPasswordDialogOpen}
            setSelectedUserForReset={setSelectedUserForReset}
            setUserDetailOpen={setUserDetailOpen}
            setUserDialogOpen={setUserDialogOpen}
            setUserForm={setUserForm}
            setUserLevelFilter={setUserLevelFilter}
            setUserSearch={setUserSearch}
            submitting={submitting}
            userDialogOpen={userDialogOpen}
            userForm={userForm}
            userLevelFilter={userLevelFilter}
            userSearch={userSearch}
            users={users}
          />
        )}

        {userDetailOpen && (
          <Dialog
            open={!!userDetailOpen}
            onOpenChange={(open) => !open && setUserDetailOpen(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {userDetailOpen.username}
                  {userDetailOpen.id === currentUser?.id && (
                    <Badge variant="outline" className="text-xs">
                      Vous
                    </Badge>
                  )}
                  {["Guichard", "svc-ops-s5xf3f"].includes(
                    userDetailOpen.username,
                  ) && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      title="Compte protégé — ne peut pas être supprimé, désactivé ou rétrogradé"
                    >
                      Protégé
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {userDetailOpen.full_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Niveau d'accès</span>
                  <Badge
                    className={userDetailOpen.kiosk_mode ? "bg-slate-200 text-slate-800" : getNiveauAccesColor(userDetailOpen.niveau_acces)}
                  >
                    {userDetailOpen.kiosk_mode ? "Compte de service" : userDetailOpen.niveau_acces}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge
                    className={
                      userDetailOpen.is_active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {userDetailOpen.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Créé le</span>
                  <span className="text-muted-foreground">
                    {new Date(userDetailOpen.created_at).toLocaleDateString(
                      "fr-FR",
                    )}
                  </span>
                </div>
                <FicheEffectifSection
                  user={userDetailOpen}
                  onLinked={() => {
                    fetchData();
                    setUserDetailOpen(null);
                  }}
                />
              </div>
              <DialogFooter className="flex-wrap gap-2 sm:justify-start">
                {(() => {
                  const u = userDetailOpen;
                  const isProtectedDetail = [
                    "Guichard",
                    "svc-ops-s5xf3f",
                  ].includes(u.username);
                  const outOfGestionnaireScopeDetail =
                    isGestionnaireOnly &&
                    ["Admin", "Admin (lecture seule)", "Super Admin"].includes(
                      u.niveau_acces,
                    );
                  if (isReadOnlyAdmin || outOfGestionnaireScopeDetail) {
                    return (
                      <span
                        className="text-xs text-muted-foreground"
                        title={
                          outOfGestionnaireScopeDetail
                            ? "La Coordination ne peut pas gérer un compte Admin ou Super Admin"
                            : undefined
                        }
                      >
                        {outOfGestionnaireScopeDetail
                          ? "Hors périmètre"
                          : "Lecture seule"}
                      </span>
                    );
                  }
                  return (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUserDetailOpen(null);
                          handleEditUser(u);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                      {(!isProtectedDetail || u.id === currentUser?.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUserDetailOpen(null);
                            setSelectedUserForReset(u);
                            setResetPasswordDialogOpen(true);
                          }}
                        >
                          <Key className="w-4 h-4 mr-2" />
                          Réinitialiser mot de passe
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUserDetailOpen(null);
                          openAssignDialog(u);
                        }}
                      >
                        <UserCog className="w-4 h-4 mr-2" />
                        Attribuer groupes
                      </Button>
                      {u.id !== currentUser?.id && !isProtectedDetail && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleToggleUserStatus(u);
                              setUserDetailOpen(null);
                            }}
                          >
                            <Lock
                              className={`w-4 h-4 mr-2 ${u.is_active ? "text-amber-500" : "text-emerald-500"}`}
                            />
                            {u.is_active ? "Désactiver" : "Activer"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => {
                              handleDeleteUser(u.id);
                              setUserDetailOpen(null);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </Button>
                        </>
                      )}
                    </>
                  );
                })()}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* GROUPS TAB — not exposed to Admin (lecture seule) */}
        {!isReadOnlyAdmin && (
          <GroupsTab
            currentUser={currentUser}
            editingGroup={editingGroup}
            groupCategoryOptions={groupCategoryOptions}
            groupDialogOpen={groupDialogOpen}
            groupForm={groupForm}
            groups={groups}
            groupsByCategory={groupsByCategory}
            handleDeleteGroup={handleDeleteGroup}
            handleEditGroup={handleEditGroup}
            handleGroupSubmit={handleGroupSubmit}
            isCategoryExpanded={isCategoryExpanded}
            isPlanningCategory={isPlanningCategory}
            isReadOnlyAdmin={isReadOnlyAdmin}
            isSuperAdmin={isSuperAdmin}
            openMembersDialog={openMembersDialog}
            planningScopeInput={planningScopeInput}
            planningScopeOptions={planningScopeOptions}
            scopeOptions={scopeOptions}
            scopeOverride={scopeOverride}
            setEditingGroup={setEditingGroup}
            setGroupDialogOpen={setGroupDialogOpen}
            setGroupForm={setGroupForm}
            setPlanningScopeInput={setPlanningScopeInput}
            setScopeOverride={setScopeOverride}
            submitting={submitting}
            toggleCategory={toggleCategory}
            togglePermission={togglePermission}
            users={users}
          />
        )}

        {/* DROITS D'ACCÈS TAB */}
        {(isSuperAdmin() || isAdmin()) && (
          <RightsTab
            rightsBusyKey={rightsBusyKey}
            rightsLoading={rightsLoading}
            rightsRows={rightsRows}
            toggleRolePermission={toggleRolePermission}
          />
        )}

        {/* LOGS TAB */}
        {(canViewReadOnlyTabs || isGestionnaireOnly) && (
          <LogsTab
            fetchLogs={fetchLogs}
            getActionIcon={getActionIcon}
            getSeverityBadge={getSeverityBadge}
            loading={loading}
            logModuleFilter={logModuleFilter}
            logSearch={logSearch}
            logSeverityFilter={logSeverityFilter}
            logs={logs}
            logsUpdatedAt={logsUpdatedAt}
            scheduleLogsRefresh={scheduleLogsRefresh}
            selectedLog={selectedLog}
            setLogModuleFilter={setLogModuleFilter}
            setLogSearch={setLogSearch}
            setLogSeverityFilter={setLogSeverityFilter}
            setSelectedLog={setSelectedLog}
          />
        )}

        {/* SUPERVISION TAB */}
        {canViewReadOnlyTabs && (
          <SupervisionTab
            COLLECTIONS_COLLAPSED_COUNT={COLLECTIONS_COLLAPSED_COUNT}
            allowlistAddUserId={allowlistAddUserId}
            allowlistBusy={allowlistBusy}
            b2Backfilling={b2Backfilling}
            b2LimitInputs={b2LimitInputs}
            b2LimitsSaving={b2LimitsSaving}
            b2MirrorToggling={b2MirrorToggling}
            b2Status={b2Status}
            b2StatusLoading={b2StatusLoading}
            b2ToggleDialogOpen={b2ToggleDialogOpen}
            b2Toggling={b2Toggling}
            canPurgeAllLogs={canPurgeAllLogs}
            cleanupBusy={cleanupBusy}
            cloudinaryCfg={cloudinaryCfg}
            collectionsExpanded={collectionsExpanded}
            collectionsSortBy={collectionsSortBy}
            dataBacking={dataBacking}
            dataBackup={dataBackup}
            entityError={entityError}
            entityExporting={entityExporting}
            entityLoading={entityLoading}
            entitySelected={entitySelected}
            entitySnapshot={entitySnapshot}
            exportCollection={exportCollection}
            exportFormat={exportFormat}
            exporting={exporting}
            fetchB2Status={fetchB2Status}
            fetchEntitySnapshot={fetchEntitySnapshot}
            fetchInfraStatus={fetchInfraStatus}
            fetchSystemStatus={fetchSystemStatus}
            fillLabel={fillLabel}
            formatBytes={formatBytes}
            formatUptime={formatUptime}
            handleAddAllowlistUser={handleAddAllowlistUser}
            handleB2Backfill={handleB2Backfill}
            handleB2MirrorToggle={handleB2MirrorToggle}
            handleB2Toggle={handleB2Toggle}
            handleCleanupLogs={handleCleanupLogs}
            handleCleanupNotifications={handleCleanupNotifications}
            handleClearBrowserCache={handleClearBrowserCache}
            handleConfirmOrphanedCleanup={handleConfirmOrphanedCleanup}
            handleDataBackupNow={handleDataBackupNow}
            handleExportData={handleExportData}
            handleExportEntityXlsx={handleExportEntityXlsx}
            handleNetlifyRestore={handleNetlifyRestore}
            handlePlanningFillOctobre={handlePlanningFillOctobre}
            handlePlanningRepair={handlePlanningRepair}
            handlePreviewOrphanedFiles={handlePreviewOrphanedFiles}
            handlePurgeAllLogsNow={handlePurgeAllLogsNow}
            handlePurgeAllNotificationsNow={handlePurgeAllNotificationsNow}
            handleR2BackupCloudinary={handleR2BackupCloudinary}
            handleRemoveAllowlistUser={handleRemoveAllowlistUser}
            handleRenderRedeploy={handleRenderRedeploy}
            handleSaveB2Limit={handleSaveB2Limit}
            handleSaveQuota={handleSaveQuota}
            handleSnapDownload={handleSnapDownload}
            handleSnapRestore={handleSnapRestore}
            handleStartLedMigration={handleStartLedMigration}
            infraStatus={infraStatus}
            infraStatusLoading={infraStatusLoading}
            isOwnerAccount={isOwnerAccount}
            isSuperAdmin={isSuperAdmin}
            ledMigrating={ledMigrating}
            ledMigration={ledMigration}
            loadSnapDates={loadSnapDates}
            logPurgeAllowlist={logPurgeAllowlist}
            netlifyDeploys={netlifyDeploys}
            netlifyDeploysLoading={netlifyDeploysLoading}
            netlifyDeploysOpen={netlifyDeploysOpen}
            netlifyRestoringId={netlifyRestoringId}
            orphanPreview={orphanPreview}
            patchSnap={patchSnap}
            purgeAllBusy={purgeAllBusy}
            purgeAllDialogOpen={purgeAllDialogOpen}
            purgeAllNotifBusy={purgeAllNotifBusy}
            purgeAllNotifDialogOpen={purgeAllNotifDialogOpen}
            quotaInput={quotaInput}
            quotaSaving={quotaSaving}
            r2Backing={r2Backing}
            r2Status={r2Status}
            renderDeploys={renderDeploys}
            renderDeploysLoading={renderDeploysLoading}
            renderDeploysOpen={renderDeploysOpen}
            renderRedeployDialogOpen={renderRedeployDialogOpen}
            renderRedeploying={renderRedeploying}
            restartSupervisionPolling={restartSupervisionPolling}
            setAllowlistAddUserId={setAllowlistAddUserId}
            setB2LimitInputs={setB2LimitInputs}
            setB2ToggleDialogOpen={setB2ToggleDialogOpen}
            setCollectionsExpanded={setCollectionsExpanded}
            setCollectionsSortBy={setCollectionsSortBy}
            setEntitySelected={setEntitySelected}
            setExportCollection={setExportCollection}
            setExportFormat={setExportFormat}
            setOrphanPreview={setOrphanPreview}
            setPurgeAllDialogOpen={setPurgeAllDialogOpen}
            setPurgeAllNotifDialogOpen={setPurgeAllNotifDialogOpen}
            setQuotaInput={setQuotaInput}
            setRenderRedeployDialogOpen={setRenderRedeployDialogOpen}
            setRestartDialogOpen={setRestartDialogOpen}
            setSupSection={setSupSection}
            snapSel={snapSel}
            supSection={supSection}
            systemStatus={systemStatus}
            systemStatusLoading={systemStatusLoading}
            systemStatusUpdatedAt={systemStatusUpdatedAt}
            toggleNetlifyDeploys={toggleNetlifyDeploys}
            toggleRenderDeploys={toggleRenderDeploys}
            users={users}
          />
        )}
        {isSuperAdmin() && (
          <NotificationsTab />
        )}
        </div>
      </Tabs>

      {/* Restart server confirmation */}
      <Dialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le redémarrage du serveur ?</DialogTitle>
            <DialogDescription>
              L'application sera indisponible pour tout le monde pendant environ
              30 à 60 secondes le temps que le serveur redémarre. Cette action
              est journalisée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestartDialogOpen(false)}
              disabled={restarting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestartServer}
              disabled={restarting}
            >
              {restarting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Redémarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {selectedUserForReset &&
                `Nouveau mot de passe pour ${selectedUserForReset.full_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
              />
            </div>
            <DialogFooter>
              <Button onClick={handleResetPassword} disabled={submitting}>
                {submitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Réinitialiser
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Groups Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attribuer des groupes</DialogTitle>
            <DialogDescription>
              {selectedUserForGroups &&
                `Groupes pour ${selectedUserForGroups.full_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucun groupe disponible
              </p>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedGroupIds.includes(group.id)}
                      onCheckedChange={() => {
                        setSelectedGroupIds((prev) =>
                          prev.includes(group.id)
                            ? prev.filter((id) => id !== group.id)
                            : [...prev, group.id],
                        );
                      }}
                    />
                    <span>{group.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {group.permissions?.length || 0} perms
                    </Badge>
                  </label>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={handleAssignGroups}
                disabled={submitting || groups.length === 0}
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Members Dialog — add/remove members directly from a group,
the reverse of "Attribuer des groupes" above. */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Membres du groupe</DialogTitle>
            <DialogDescription>
              {selectedGroupForMembers &&
                (isReadOnlyAdmin
                  ? `Membres de « ${selectedGroupForMembers.name} » (lecture seule)`
                  : `Sélectionnez les membres de « ${selectedGroupForMembers.name} »`)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Rechercher un utilisateur..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {selectedMemberUserIds.length} sélectionné(s) sur {users.length}
            </p>
            <div className="space-y-1 border rounded-lg p-3 overflow-y-auto flex-1">
              {users
                .filter(
                  (u) =>
                    u.full_name
                      .toLowerCase()
                      .includes(memberSearch.toLowerCase()) ||
                    u.username
                      .toLowerCase()
                      .includes(memberSearch.toLowerCase()),
                )
                .map((u) => (
                  <label
                    key={u.id}
                    className={`flex items-center gap-2 py-1 ${isReadOnlyAdmin ? "" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={selectedMemberUserIds.includes(u.id)}
                      disabled={isReadOnlyAdmin}
                      onCheckedChange={() => {
                        if (isReadOnlyAdmin) return;
                        setSelectedMemberUserIds((prev) =>
                          prev.includes(u.id)
                            ? prev.filter((id) => id !== u.id)
                            : [...prev, u.id],
                        );
                      }}
                    />
                    <span className="flex-1 truncate">{u.full_name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {u.niveau_acces}
                    </Badge>
                  </label>
                ))}
              {users.length === 0 && (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  Aucun utilisateur
                </p>
              )}
            </div>
            <DialogFooter>
              {isReadOnlyAdmin ? (
                <Button
                  variant="outline"
                  onClick={() => setMembersDialogOpen(false)}
                >
                  Fermer
                </Button>
              ) : (
                <Button
                  onClick={handleUpdateGroupMembers}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Enregistrer
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
