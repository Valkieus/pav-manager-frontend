import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { Switch } from '../components/ui/switch';
import { 
  Plus, 
  Users, 
  Loader2,
  Trash2,
  Shield,
  ScrollText,
  Settings,
  RefreshCw,
  Edit,
  Key,
  UserCog,
  Lock,
  AlertTriangle,
  Timer,
  FlaskConical,
  Activity,
  HardDrive,
  Server,
  CheckCircle2,
  XCircle,
  Download,
  Power,
  Trash,
  FileArchive,
  Search,
  Cloud,
  GitBranch,
  RotateCcw,
  History,
  ChevronDown,
  ChevronUp,
  Bell,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { downloadOrShareFile, downloadStatusMessage, reserveTabForIOSFallback } from '../utils/fileDownload';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NIVEAUX_ACCES = ['Technicien', 'Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'];

// Mirrors SUPERVISED_COLLECTIONS in server.py — kept in sync manually since the
// export dropdown must only ever offer categories the backend allow-lists.
const SUPERVISED_COLLECTIONS_FRONT = [
  'users', 'techniciens', 'planning', 'absences', 'formations',
  'formation_suggestions', 'devis', 'fournisseurs', 'materiel', 'salles',
  'creneaux', 'reservations', 'notifications', 'logs', 'groups',
  'actualites', 'documents', 'organigramme', 'settings',
];

// Pages that can individually be put into maintenance (mirrors Layout.js navItems)
const MAINTENANCE_PAGES = [
  { path: '/', label: 'Dashboard' },
  { path: '/actualites', label: 'Actualités' },
  { path: '/planning', label: 'Planning' },
  { path: '/mon-espace', label: 'Mon espace' },
  { path: '/effectif', label: 'Effectif' },
  { path: '/salles', label: 'Salles' },
  { path: '/logistique', label: 'Régisseurs' },
  { path: '/devis', label: 'Devis & Achat' },
  { path: '/formations', label: 'Formations' },
  { path: '/documents', label: 'Base de connaissance' },
];

// Roles that can be individually targeted by a maintenance activation.
// Super Admin is intentionally excluded — it can never be impacted.
const MAINTENANCE_ROLES = ['Technicien', 'Responsable', 'Gestionnaire', 'Admin (lecture seule)', 'Admin'];

// Permission categories for display
const PERMISSION_CATEGORIES = {
  'Effectif': ['effectif.read', 'effectif.write', 'effectif.delete'],
  'Planning': ['planning.read', 'planning.write', 'planning.delete'],
  'Logistique': ['logistique.read', 'logistique.write', 'logistique.delete'],
  'Devis': ['devis.read', 'devis.write', 'devis.validate', 'devis.delete'],
  'Formations': ['formations.read', 'formations.write', 'formations.validate', 'formations.delete'],
  'Salles': ['salles.read', 'salles.write', 'salles.reservations', 'salles.delete'],
  'Administration': ['admin.users', 'admin.groups', 'admin.logs']
};

// Droits qui peuvent être segmentés par section (même principe que le
// Planning : contrôle total, ou limité à certaines valeurs seulement).
// La liste des valeurs possibles pour chaque droit vient de
// GET /groups/scope-options (dynamique : salles existantes, catégories
// fournisseur utilisées, catégories documents créées, etc.)
const SEGMENTABLE_PERMISSION_LABELS = {
  'salles.reservations': 'Salles — valider / refuser une réservation',
  'devis.validate': 'Devis — valider / refuser un devis',
  'formations.validate': 'Formations — valider une demande',
  'effectif.write': 'Effectif — créer / modifier une fiche',
  'effectif.approve': 'Effectif — valider une fiche proposée',
  'documents.write': 'Documents — ajouter / modifier',
  'actualites.write': 'Actualités — publier / modifier',
};
const SEGMENTABLE_PERMISSIONS = Object.keys(SEGMENTABLE_PERMISSION_LABELS);

// Redesign "façon AD" (20/08/2026, demande explicite) : au lieu de cases à
// cocher éparpillées par catégorie, une vraie matrice Module × Lecture /
// Écriture / Suppression / Spécial — même lisibilité qu'un groupe Active
// Directory RO/RW. Les valeurs de permission envoyées au backend sont
// STRICTEMENT les mêmes chaînes "module.action" qu'avant (ex: "devis.write") ;
// ceci ne change que l'affichage, pas le modèle de données ni handleGroupSubmit.
const PERMISSION_MATRIX_MODULES = [
  { label: 'Effectif', prefix: 'effectif' },
  { label: 'Planning', prefix: 'planning' },
  { label: 'Logistique', prefix: 'logistique' },
  { label: 'Devis', prefix: 'devis', special: { key: 'devis.validate', label: 'Valider' } },
  { label: 'Formations', prefix: 'formations', special: { key: 'formations.validate', label: 'Valider' } },
  { label: 'Salles', prefix: 'salles', special: { key: 'salles.reservations', label: 'Réserver' } },
];
const ADMINISTRATION_PERMISSIONS = [
  { key: 'admin.users', label: 'Utilisateurs' },
  { key: 'admin.groups', label: 'Groupes' },
  { key: 'admin.logs', label: 'Logs' },
];

// Sélecteur à cocher réutilisable pour les périmètres de groupe (sections
// Planning, salles, catégories fournisseurs/documents/formations/actualités,
// branches Effectif...). Remplace l'ancienne "mur de puces" où cliquer une
// valeur la faisait juste changer de couleur au milieu de 30+ autres —
// difficile à lire et, pire, source de clics par erreur sur la mauvaise
// puce (constaté en direct le 20/08/2026). Ici : une liste de cases à
// cocher classique (une par ligne, scrollable), plus une bande "Sélection
// actuelle" séparée au-dessus qui ne montre QUE ce qui est coché, avec un
// bouton × pour retirer sans avoir à retrouver la case dans la liste.
function ScopeChecklist({ options, selected, onToggle, searchPlaceholder = 'Rechercher…' }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/30 p-2 min-h-[2.25rem]">
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune sélection pour l'instant — cochez ci-dessous.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.map(opt => (
              <span
                key={opt}
                className="inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-full pl-2 pr-1 py-0.5"
              >
                {opt}
                <button
                  type="button"
                  onClick={() => onToggle(opt)}
                  aria-label={`Retirer ${opt}`}
                  className="rounded-full p-0.5 hover:bg-white/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {options.length > 8 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 text-xs"
        />
      )}
      <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun résultat.</p>
        ) : (
          filtered.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/50"
            >
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => onToggle(opt)} />
              <span>{opt}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export default function Administration() {
  const { isSuperAdmin, isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  // Gestionnaire (coordination) accède à Administration mais uniquement à
  // l'onglet Groupes & Droits (création/édition des groupes, scope planning
  // des Responsables) — Utilisateurs/Logs/Maintenance/Supervision/Droits
  // d'accès restent réservés à Admin/Super Admin.
  const isGestionnaireOnly = currentUser?.niveau_acces === 'Gestionnaire';
  // "Admin (lecture seule)" = comportement historique d'Admin : accès en lecture
  // aux onglets Utilisateurs (non — voir plus bas), Logs, Maintenance et Supervision,
  // mais aucune action d'écriture (celles-ci restent gérées individuellement par
  // isAdmin() sur chaque bouton/switch). N'a pas accès à Droits d'accès (jamais
  // eu accès par le passé) ni à l'onglet Utilisateurs (CRUD non protégé bouton
  // par bouton — on préfère ne pas l'exposer plutôt que d'afficher des actions
  // qui échoueraient côté serveur).
  const isReadOnlyAdmin = currentUser?.niveau_acces === 'Admin (lecture seule)';
  // Onglets à contenu purement lecture (Logs/Maintenance/Supervision) : leurs
  // actions sensibles sont déjà individuellement protégées par isSuperAdmin()
  // au niveau du bouton, donc sûr d'ouvrir la vue à Admin (lecture seule).
  const canViewReadOnlyTabs = isAdmin() || isReadOnlyAdmin;
  const [activeTab, setActiveTab] = useState(() => (
    currentUser?.niveau_acces === 'Gestionnaire' ? 'groups' : 'users'
  ));
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userLevelFilter, setUserLevelFilter] = useState('all');
  const [groups, setGroups] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Maintenance Mode
  const [maintenance, setMaintenance] = useState({ is_active: false, message: '', scope: 'site', page_path: null });
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceScope, setMaintenanceScope] = useState('site');
  const [maintenancePagePath, setMaintenancePagePath] = useState(MAINTENANCE_PAGES[0].path);
  const [maintenanceAffectedRoles, setMaintenanceAffectedRoles] = useState([]); // [] = tout le monde (sous Super Admin)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // Signalement de retard (Dashboard) — activable/désactivable ici, avec
  // liste configurable de destinataires Gestionnaire+ toujours notifiés
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
  const [testModeUserQuery, setTestModeUserQuery] = useState('');

  // User Dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  
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
  const [memberSearch, setMemberSearch] = useState('');
  
  // Supervision tab — resource/storage health, fetched only when that tab
  // is actually opened (Super Admin only, no need to load it on every visit).
  const [systemStatus, setSystemStatus] = useState(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);
  const [infraStatus, setInfraStatus] = useState(null);
  const [infraStatusLoading, setInfraStatusLoading] = useState(false);

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
      await axios.put(`${API}/admin/role-permissions`, { role, permission: permissionKey, granted: nextGranted });
      setRightsRows((rows) => rows.map((row) => (
        row.key === permissionKey
          ? { ...row, roles: { ...row.roles, [role]: { ...row.roles[role], granted: nextGranted } } }
          : row
      )));
      toast.success('Droit mis à jour');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la mise à jour du droit");
    } finally {
      setRightsBusyKey(null);
    }
  };

  const fetchSystemStatus = async () => {
    setSystemStatusLoading(true);
    try {
      const res = await axios.get(`${API}/admin/system-status`);
      setSystemStatus(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement de la supervision');
    } finally {
      setSystemStatusLoading(false);
    }
  };

  const fetchInfraStatus = async () => {
    setInfraStatusLoading(true);
    try {
      const res = await axios.get(`${API}/admin/infra-status`);
      setInfraStatus(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement de l'état de l'infrastructure");
    } finally {
      setInfraStatusLoading(false);
    }
  };

  const [quotaInput, setQuotaInput] = useState('');
  const [collectionsSortBy, setCollectionsSortBy] = useState('size_desc');
  const [collectionsExpanded, setCollectionsExpanded] = useState(false);
  const COLLECTIONS_COLLAPSED_COUNT = 6;
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(null); // which cleanup action is currently running
  const [orphanPreview, setOrphanPreview] = useState(null);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [exportCollection, setExportCollection] = useState('techniciens');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

  // Actions infra (Supervision) : redéployer Render, historique + restauration Netlify
  const [renderDeploys, setRenderDeploys] = useState(null);
  const [renderDeploysOpen, setRenderDeploysOpen] = useState(false);
  const [renderDeploysLoading, setRenderDeploysLoading] = useState(false);
  const [renderRedeployDialogOpen, setRenderRedeployDialogOpen] = useState(false);
  const [renderRedeploying, setRenderRedeploying] = useState(false);
  const [netlifyDeploys, setNetlifyDeploys] = useState(null);
  const [netlifyDeploysOpen, setNetlifyDeploysOpen] = useState(false);
  const [netlifyDeploysLoading, setNetlifyDeploysLoading] = useState(false);
  const [netlifyRestoringId, setNetlifyRestoringId] = useState(null);

  // Redondance stockage B2 (deux comptes Backblaze indépendants + bascule)
  const [b2Status, setB2Status] = useState(null);
  const [b2StatusLoading, setB2StatusLoading] = useState(false);
  const [b2LimitInputs, setB2LimitInputs] = useState({ primary: '', backup: '', tertiary: '' });
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
      toast.success(res.data.message || 'Redéploiement lancé');
      setRenderRedeployDialogOpen(false);
      setRenderDeploys(null);
      setTimeout(() => { fetchInfraStatus(); }, 4000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du redéploiement');
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
      const res = await axios.post(`${API}/admin/infra/netlify/deploys/${deployId}/restore`);
      toast.success(res.data.message || 'Déploiement restauré');
      setNetlifyDeploys(null);
      setNetlifyDeploysOpen(false);
      setTimeout(() => { fetchInfraStatus(); }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la restauration');
    } finally {
      setNetlifyRestoringId(null);
    }
  };

  const fetchB2Status = async () => {
    setB2StatusLoading(true);
    try {
      const res = await axios.get(`${API}/admin/infra/b2-status`);
      setB2Status(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement du stockage B2");
    } finally {
      setB2StatusLoading(false);
    }
  };

  const handleSaveB2Limit = async (account) => {
    const raw = b2LimitInputs[account];
    const value = raw === '' ? null : parseFloat(raw);
    if (raw !== '' && (isNaN(value) || value < 0)) {
      toast.error('Entrez un nombre valide (en Go)');
      return;
    }
    setB2LimitsSaving(account);
    try {
      const payload = { [`${account}_limit_gb`]: raw === '' ? 0 : value };
      await axios.put(`${API}/admin/infra/b2-limits`, payload);
      toast.success('Limite enregistrée');
      setB2LimitInputs((prev) => ({ ...prev, [account]: '' }));
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement de la limite");
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
      if (r.tertiary_copied) parts.push(`${r.tertiary_copied} vers géo-redondant`);
      toast.success(parts.length ? `Backfill terminé — ${parts.join(', ')}.` : `Backfill terminé — tout était déjà à jour (${r.total} fichiers vérifiés).`);
      if (r.errors?.length) toast.error(`${r.errors.length} fichier(s) en erreur — voir logs serveur`);
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du backfill');
    } finally {
      setB2Backfilling(false);
    }
  };

  const handleB2MirrorToggle = async () => {
    setB2MirrorToggling(true);
    try {
      const res = await axios.post(`${API}/admin/infra/b2-mirroring-toggle`);
      toast.success(res.data.message || 'Copie automatique mise à jour');
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du changement');
    } finally {
      setB2MirrorToggling(false);
    }
  };

  const handleB2Toggle = async () => {
    setB2Toggling(true);
    try {
      const res = await axios.post(`${API}/admin/infra/b2-toggle`);
      toast.success(res.data.message || 'Compte actif basculé');
      setB2ToggleDialogOpen(false);
      fetchB2Status();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la bascule');
    } finally {
      setB2Toggling(false);
    }
  };

  const handleSaveQuota = async () => {
    const value = parseFloat(quotaInput);
    if (quotaInput && (isNaN(value) || value < 0)) {
      toast.error('Entrez un nombre valide (en Go)');
      return;
    }
    setQuotaSaving(true);
    try {
      await axios.put(`${API}/admin/storage-quota`, { quota_gb: quotaInput ? value : 0 });
      toast.success(quotaInput ? 'Quota enregistré' : 'Quota retiré');
      setQuotaInput('');
      fetchSystemStatus();
    } catch (err) {
      toast.error('Erreur lors de l\'enregistrement du quota');
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleClearBrowserCache = async () => {
    setCleanupBusy('cache');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success('Cache vidé — la page va se recharger');
      setTimeout(() => window.location.reload(true), 800);
    } catch (err) {
      toast.error('Erreur lors du nettoyage du cache');
      setCleanupBusy(null);
    }
  };

  const handlePreviewOrphanedFiles = async () => {
    setCleanupBusy('orphan-preview');
    try {
      const res = await axios.get(`${API}/admin/cleanup/orphaned-files`);
      setOrphanPreview(res.data);
      if (res.data.count === 0) toast.success('Aucun fichier orphelin trouvé');
    } catch (err) {
      toast.error('Erreur lors de la vérification');
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleConfirmOrphanedCleanup = async () => {
    setCleanupBusy('orphan-delete');
    try {
      const res = await axios.post(`${API}/admin/cleanup/orphaned-files`);
      toast.success(`${res.data.deleted_count} fichier(s) supprimé(s)`);
      setOrphanPreview(null);
      fetchSystemStatus();
    } catch (err) {
      toast.error('Erreur lors du nettoyage');
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleCleanupLogs = async () => {
    setCleanupBusy('logs');
    try {
      const res = await axios.post(`${API}/admin/cleanup/logs`);
      toast.success(`${res.data.deleted_count} log(s) de plus de 1 mois supprimé(s)`);
      fetchSystemStatus();
    } catch (err) {
      toast.error('Erreur lors du nettoyage des logs');
    } finally {
      setCleanupBusy(null);
    }
  };

  const handleCleanupNotifications = async () => {
    setCleanupBusy('notifications');
    try {
      const res = await axios.post(`${API}/admin/cleanup/notifications`);
      toast.success(`${res.data.deleted_count} notification(s) de plus de 1 mois supprimée(s)`);
      fetchSystemStatus();
    } catch (err) {
      toast.error('Erreur lors du nettoyage des notifications');
    } finally {
      setCleanupBusy(null);
    }
  };

  const [purgeAllNotifDialogOpen, setPurgeAllNotifDialogOpen] = useState(false);
  const [purgeAllNotifBusy, setPurgeAllNotifBusy] = useState(false);

  const handlePurgeAllNotificationsNow = async () => {
    setPurgeAllNotifBusy(true);
    try {
      const res = await axios.post(`${API}/admin/cleanup/notifications/purge-all`);
      toast.success(`${res.data.deleted_count} notification(s) supprimée(s) — historique complet purgé`);
      setPurgeAllNotifDialogOpen(false);
      fetchSystemStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la purge totale des notifications');
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
  const [allowlistAddUserId, setAllowlistAddUserId] = useState('');
  const [allowlistBusy, setAllowlistBusy] = useState(false);

  const isOwnerAccount = currentUser?.username === 'Guichard';

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
      toast.success(`${res.data.deleted_count} log(s) supprimé(s) — historique complet purgé`);
      setPurgeAllDialogOpen(false);
      fetchSystemStatus();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la purge totale des logs');
    } finally {
      setPurgeAllBusy(false);
    }
  };

  const handleAddAllowlistUser = async () => {
    if (!allowlistAddUserId) return;
    setAllowlistBusy(true);
    try {
      await axios.post(`${API}/admin/logs/purge-allowlist`, { user_id: allowlistAddUserId });
      toast.success('Autorisation accordée');
      setAllowlistAddUserId('');
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
      toast.success('Autorisation retirée');
      fetchLogPurgeAllowlist();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du retrait');
    } finally {
      setAllowlistBusy(false);
    }
  };

  const handleRestartServer = async () => {
    setRestarting(true);
    try {
      await axios.post(`${API}/admin/restart-server`);
      toast.success('Redémarrage lancé — l\'application sera indisponible environ une minute');
      setRestartDialogOpen(false);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("Vous n'avez pas les droits pour redémarrer le serveur");
        setRestartDialogOpen(false);
        return;
      }
      // A network error here can be entirely expected: the server may have
      // already gone down before the response finished round-tripping.
      toast.success('Redémarrage probablement lancé — réessayez dans une minute si l\'app ne répond plus');
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
      const res = await axios.get(`${API}/admin/export/${exportCollection}?format=${exportFormat}`, {
        responseType: 'blob'
      });
      const filename = `${exportCollection}.${exportFormat}`;
      const status = await downloadOrShareFile(res.data, filename, { title: filename, preOpenedWindow });
      if (status === 'downloaded') toast.success('Export téléchargé');
      else if (status === 'blocked') toast.error(downloadStatusMessage(status));
    } catch (err) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    full_name: '',
    niveau_acces: ''
  });
  
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    permissions: [],
    planning_full_control: false,
    planning_scope: [],
    scope_map: {}
  });
  const [planningScopeInput, setPlanningScopeInput] = useState('');
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
  const [planningScopeOptions, setPlanningScopeOptions] = useState({ sections: [], postes: [] });

  useEffect(() => {
    if ((isAdmin() || isGestionnaireOnly) && !isReadOnlyAdmin) {
      axios.get(`${API}/groups/scope-options`).then(res => setScopeOptions(res.data)).catch(() => {});
      axios.get(`${API}/groups/planning-scope-options`).then(res => setPlanningScopeOptions(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin() && !isGestionnaireOnly && !isReadOnlyAdmin) {
      toast.error('Accès réservé aux administrateurs');
      navigate('/');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (activeTab === 'rights' && (isSuperAdmin() || isAdmin())) {
      fetchRolePermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 22/08/2026 : la Supervision paraissait "figée" — les 3 fetch ci-dessous
  // n'étaient déclenchés qu'une seule fois par session (gardés par `!systemStatus`
  // etc.), donc revenir sur l'onglet après un moment montrait toujours les
  // mêmes chiffres. Corrigé en (1) refetch à CHAQUE ouverture de l'onglet, et
  // (2) rafraîchissement automatique toutes les 30s tant que l'onglet reste
  // ouvert — sans jamais faire clignoter la vue en "chargement" plein écran,
  // les blocs concernés ne montrent le loader que si aucune donnée n'existe
  // encore (`loading && !data`), une actualisation en fond met juste les
  // chiffres à jour silencieusement.
  useEffect(() => {
    if (activeTab !== 'supervision' || !canViewReadOnlyTabs) return;
    fetchSystemStatus();
    fetchInfraStatus();
    fetchB2Status();
    if (isSuperAdmin()) {
      fetchCanPurgeAllLogs();
      if (isOwnerAccount && !logPurgeAllowlist) {
        fetchLogPurgeAllowlist();
      }
    }
    const interval = setInterval(() => {
      fetchSystemStatus();
      fetchInfraStatus();
      fetchB2Status();
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Demande explicite (22/08/2026) : les Logs doivent se mettre à jour tout
  // seuls plutôt que d'attendre un clic sur "Actualiser" — même principe que
  // Supervision ci-dessus : refetch à l'ouverture de l'onglet + toutes les
  // 20s tant qu'il reste ouvert. fetchLogs() est silencieux en cas d'échec
  // (pas de toast d'erreur répété toutes les 20s sur un blip réseau) — le
  // clic manuel "Actualiser" (fetchData) reste, lui, bruyant en cas d'erreur.
  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API}/logs`);
      setLogs(res.data);
    } catch (err) {
      // silencieux — rafraîchissement en arrière-plan
    }
  };

  useEffect(() => {
    if (activeTab !== 'logs') return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 20000);
    return () => clearInterval(interval);
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
    if (!bytes || bytes <= 0) return '0 Ko';
    const units = ['Ko', 'Mo', 'Go'];
    let value = bytes / 1024;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
      value /= 1024;
      unitIdx++;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIdx]}`;
  };

  const formatUptime = (seconds) => {
    if (!seconds || seconds < 0) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} j ${hours} h`;
    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${minutes} min`;
  };

  const fetchData = async () => {
    try {
      // Gestionnaire a maintenant accès à Groupes & Droits ET Logs (lecture
      // seule, #299) — /logs accepte désormais ce rôle côté serveur, donc
      // plus besoin de le contourner ici comme avant.
      const [usersRes, logsRes, groupsRes, maintenanceRes, retardRes, testModeRes] = await Promise.all([
        axios.get(`${API}/auth/users`).catch(() => ({ data: [] })),
        axios.get(`${API}/logs`).catch(() => ({ data: [] })),
        axios.get(`${API}/groups/enhanced`).catch(() => ({ data: [] })),
        axios.get(`${API}/maintenance`).catch(() => ({ data: { is_active: false, message: '' } })),
        axios.get(`${API}/dashboard/retard-settings`).catch(() => ({ data: { enabled: false } })),
        axios.get(`${API}/admin/test-mode`).catch(() => ({ data: { enabled: false, test_user_ids: [] } })),
      ]);
      setUsers(usersRes.data);
      setLogs(logsRes.data);
      setGroups(groupsRes.data);
      setMaintenance(maintenanceRes.data);
      setMaintenanceMessage(maintenanceRes.data.message || '');
      setMaintenanceScope(maintenanceRes.data.scope || 'site');
      setMaintenancePagePath(maintenanceRes.data.page_path || MAINTENANCE_PAGES[0].path);
      setMaintenanceAffectedRoles(maintenanceRes.data.affected_roles || []);
      setRetardEnabled(!!retardRes.data.enabled);
      setRetardNotifyUserIds(retardRes.data.notify_user_ids || []);
      setTestModeEnabled(!!testModeRes.data.enabled);
      setTestModeUserIds(testModeRes.data.test_user_ids || []);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // Maintenance mode handlers
  const toggleMaintenanceRole = (role) => {
    setMaintenanceAffectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleMaintenanceToggle = async (checked) => {
    if (!isSuperAdmin()) {
      toast.error('Seul le Super Admin peut modifier le mode maintenance');
      return;
    }
    if (checked && maintenanceScope === 'page' && !maintenancePagePath) {
      toast.error('Choisissez une page à mettre en maintenance');
      return;
    }
    setMaintenanceLoading(true);
    try {
      const res = await axios.put(`${API}/maintenance`, {
        is_active: checked,
        message: maintenanceMessage || 'Maintenance en cours. Veuillez réessayer plus tard.',
        scope: maintenanceScope,
        page_path: maintenanceScope === 'page' ? maintenancePagePath : null,
        affected_roles: maintenanceAffectedRoles.length > 0 ? maintenanceAffectedRoles : null
      });
      setMaintenance(res.data);
      toast.success(checked ? 'Mode maintenance activé' : 'Mode maintenance désactivé');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleRetardToggle = async (checked) => {
    if (!isAdmin()) {
      toast.error('Seul un Admin peut modifier ce réglage');
      return;
    }
    setRetardLoading(true);
    try {
      const res = await axios.put(`${API}/dashboard/retard-settings`, { enabled: checked });
      setRetardEnabled(!!res.data.enabled);
      toast.success(checked ? 'Signalement de retard activé' : 'Signalement de retard désactivé');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setRetardLoading(false);
    }
  };

  const handleToggleRetardRecipient = async (userId) => {
    if (!isAdmin()) {
      toast.error('Seul un Admin peut modifier ce réglage');
      return;
    }
    const next = retardNotifyUserIds.includes(userId)
      ? retardNotifyUserIds.filter((id) => id !== userId)
      : [...retardNotifyUserIds, userId];
    setRetardNotifyUserIds(next);
    setRetardRecipientsSaving(true);
    try {
      const res = await axios.put(`${API}/dashboard/retard-settings`, { notify_user_ids: next });
      setRetardNotifyUserIds(res.data.notify_user_ids || next);
    } catch (err) {
      setRetardNotifyUserIds(retardNotifyUserIds); // revert on error
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setRetardRecipientsSaving(false);
    }
  };

  const handleTestModeToggle = async (checked) => {
    if (!isAdmin()) {
      toast.error('Seul un Admin peut modifier ce réglage');
      return;
    }
    setTestModeLoading(true);
    try {
      const res = await axios.put(`${API}/admin/test-mode`, { enabled: checked });
      setTestModeEnabled(!!res.data.enabled);
      toast.success(checked ? 'Mode test activé' : 'Mode test désactivé');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setTestModeLoading(false);
    }
  };

  const handleToggleTestUser = async (userId) => {
    if (!isAdmin()) {
      toast.error('Seul un Admin peut modifier ce réglage');
      return;
    }
    const next = testModeUserIds.includes(userId)
      ? testModeUserIds.filter((id) => id !== userId)
      : [...testModeUserIds, userId];
    setTestModeUserIds(next);
    setTestModeSaving(true);
    try {
      const res = await axios.put(`${API}/admin/test-mode`, { test_user_ids: next });
      setTestModeUserIds(res.data.test_user_ids || next);
    } catch (err) {
      setTestModeUserIds(testModeUserIds); // revert on error
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setTestModeSaving(false);
    }
  };

  const handleMaintenanceMessageUpdate = async () => {
    if (!isSuperAdmin()) return;
    if (maintenance.is_active && maintenanceScope === 'page' && !maintenancePagePath) {
      toast.error('Choisissez une page à mettre en maintenance');
      return;
    }
    setMaintenanceLoading(true);
    try {
      const res = await axios.put(`${API}/maintenance`, {
        is_active: maintenance.is_active,
        message: maintenanceMessage,
        scope: maintenanceScope,
        page_path: maintenanceScope === 'page' ? maintenancePagePath : null,
        affected_roles: maintenanceAffectedRoles.length > 0 ? maintenanceAffectedRoles : null
      });
      setMaintenance(res.data);
      toast.success('Paramètres mis à jour');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setMaintenanceLoading(false);
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
          username: userForm.username
        });
        toast.success('Utilisateur modifié');
      } else {
        // Create new user
        await axios.post(`${API}/auth/users`, userForm);
        toast.success('Utilisateur créé');
      }
      setUserDialogOpen(false);
      setUserForm({ username: '', password: '', full_name: '', niveau_acces: '' });
      setEditingUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = (user) => {
    setUserForm({
      username: user.username,
      password: '',
      full_name: user.full_name,
      niveau_acces: user.niveau_acces
    });
    setEditingUser(user);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await axios.delete(`${API}/auth/users/${id}`);
      toast.success('Utilisateur supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      await axios.put(`${API}/auth/users/${user.id}/${user.is_active ? 'deactivate' : 'activate'}`);
      toast.success(`Utilisateur ${user.is_active ? 'désactivé' : 'activé'}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`${API}/auth/users/${selectedUserForReset.id}/reset-password`, {
        new_password: newPassword
      });
      toast.success('Mot de passe réinitialisé');
      setResetPasswordDialogOpen(false);
      setNewPassword('');
      setSelectedUserForReset(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
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
        toast.success('Groupe modifié');
      } else {
        await axios.post(`${API}/groups/enhanced`, groupForm);
        toast.success('Groupe créé');
      }
      setGroupDialogOpen(false);
      setGroupForm({ name: '', description: '', permissions: [], planning_full_control: false, planning_scope: [], scope_map: {} });
      setPlanningScopeInput('');
      setScopeOverride({});
      setEditingGroup(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGroup = (group) => {
    setGroupForm({
      name: group.name,
      description: group.description || '',
      permissions: group.permissions || [],
      planning_full_control: group.planning_full_control || false,
      planning_scope: group.planning_scope || [],
      scope_map: group.scope_map || {}
    });
    setPlanningScopeInput('');
    setScopeOverride({});
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Supprimer ce groupe ?')) return;
    try {
      await axios.delete(`${API}/groups/enhanced/${id}`);
      toast.success('Groupe supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const togglePermission = (perm) => {
    setGroupForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
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
        group_ids: selectedGroupIds
      });
      toast.success('Groupes attribués');
      setAssignDialogOpen(false);
      setSelectedUserForGroups(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  // Group -> members handlers (reverse direction of Assign Groups above)
  const openMembersDialog = (group) => {
    setSelectedGroupForMembers(group);
    setSelectedMemberUserIds(users.filter(u => (u.group_ids || []).includes(group.id)).map(u => u.id));
    setMemberSearch('');
    setMembersDialogOpen(true);
  };

  const handleUpdateGroupMembers = async () => {
    setSubmitting(true);
    try {
      await axios.put(`${API}/groups/enhanced/${selectedGroupForMembers.id}/members`, {
        user_ids: selectedMemberUserIds
      });
      toast.success('Membres du groupe mis à jour');
      setMembersDialogOpen(false);
      setSelectedGroupForMembers(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const getNiveauAccesColor = (niveau) => {
    const colors = {
      'Super Admin': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Admin': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'Admin (lecture seule)': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Responsable': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Gestionnaire': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'Technicien': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    };
    return colors[niveau] || colors['Technicien'];
  };

  const getActionIcon = (action) => {
    if (action.includes('Connexion')) return '🔐';
    if (action.includes('Création')) return '➕';
    if (action.includes('Modification')) return '✏️';
    if (action.includes('Suppression')) return '🗑️';
    if (action.includes('Validation')) return '✅';
    if (action.includes('Refus')) return '❌';
    if (action.includes('Archivage')) return '📦';
    return '📋';
  };

  return (
    <div className="space-y-6" data-testid="administration-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Gestion complète du système PAV</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {/* 20/08/2026 (#298) : Gestionnaire voit aussi Utilisateurs — accès
              élargi au-delà de canViewReadOnlyTabs, avec un périmètre plus
              restreint que Admin (pas de gestion des comptes Admin/Admin
              lecture seule/Super Admin, voir plus bas et
              assert_gestionnaire_user_mgmt_scope côté serveur). */}
          {(canViewReadOnlyTabs || isGestionnaireOnly) && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Utilisateurs
            </TabsTrigger>
          )}
          {!isReadOnlyAdmin && (
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Groupes & Droits
          </TabsTrigger>
          )}
          {(isSuperAdmin() || isAdmin()) && (
            <TabsTrigger value="rights" className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Droits d'accès
            </TabsTrigger>
          )}
          {/* 20/08/2026 (#299) : Gestionnaire voit aussi Logs (lecture
              seule) — accès élargi au-delà de canViewReadOnlyTabs
              (Admin/Admin lecture seule), Maintenance/Supervision restent
              inchangés pour ce rôle. */}
          {(canViewReadOnlyTabs || isGestionnaireOnly) && (
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <ScrollText className="w-4 h-4" /> Logs
            </TabsTrigger>
          )}
          {canViewReadOnlyTabs && (
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Maintenance
            </TabsTrigger>
          )}
          {canViewReadOnlyTabs && (
            <TabsTrigger value="supervision" className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Supervision
            </TabsTrigger>
          )}
        </TabsList>

        {/* MAINTENANCE TAB */}
        {canViewReadOnlyTabs && (
          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Mode Maintenance
                </CardTitle>
                <CardDescription>
                  Activez le mode maintenance pour bloquer l'accès aux membres pendant les travaux
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Portée de la maintenance</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMaintenanceScope('site')}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${
                        maintenanceScope === 'site'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-sm">Site complet</p>
                      <p className="text-xs text-muted-foreground">Bloque l'accès à toute l'application pour les Techniciens</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaintenanceScope('page')}
                      className={`text-left p-3 rounded-lg border-2 transition-colors ${
                        maintenanceScope === 'page'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-sm">Une seule page</p>
                      <p className="text-xs text-muted-foreground">Bloque uniquement la page choisie ci-dessous</p>
                    </button>
                  </div>

                  {maintenanceScope === 'page' && (
                    <Select value={maintenancePagePath} onValueChange={setMaintenancePagePath}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Choisir une page" />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_PAGES.map((p) => (
                          <SelectItem key={p.path} value={p.path}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Qui est impacté par cette maintenance</Label>
                  <p className="text-xs text-muted-foreground">
                    Par défaut, tout le monde en dessous de Super Admin est impacté. Cochez des rôles précis pour restreindre la maintenance à ces rôles uniquement — Super Admin n'est jamais impacté.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {MAINTENANCE_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        disabled={!isSuperAdmin()}
                        onClick={() => toggleMaintenanceRole(role)}
                        className={`text-sm p-2 rounded-lg border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          maintenanceAffectedRoles.includes(role)
                            ? 'border-primary bg-primary/5 font-medium'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {maintenanceAffectedRoles.length > 0
                      ? `Maintenance restreinte à : ${maintenanceAffectedRoles.join(', ')}`
                      : 'Aucun rôle spécifique sélectionné — tout le monde en dessous de Super Admin sera impacté'}
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">Activer le mode maintenance</p>
                    <p className="text-sm text-muted-foreground">
                      {maintenanceScope === 'page'
                        ? `Les membres verront une page de maintenance sur "${MAINTENANCE_PAGES.find(p => p.path === maintenancePagePath)?.label || maintenancePagePath}" uniquement`
                        : 'Les membres verront une page de maintenance sur tout le site'}
                    </p>
                  </div>
                  <Switch
                    checked={maintenance.is_active}
                    onCheckedChange={handleMaintenanceToggle}
                    disabled={maintenanceLoading || !isSuperAdmin()}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Message affiché aux membres</Label>
                  <Textarea
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    placeholder="Ex: Maintenance en cours. Nous revenons bientôt !"
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    onClick={handleMaintenanceMessageUpdate}
                    disabled={maintenanceLoading}
                  >
                    {maintenanceLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Mettre à jour les paramètres
                  </Button>
                </div>

                {maintenance.is_active && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">
                          Mode maintenance actif — {maintenance.scope === 'page'
                            ? `page "${MAINTENANCE_PAGES.find(p => p.path === maintenance.page_path)?.label || maintenance.page_path}"`
                            : 'site complet'}
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Activé par {maintenance.activated_by} le {new Date(maintenance.activated_at).toLocaleString('fr-FR')}
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Rôles impactés : {maintenance.affected_roles && maintenance.affected_roles.length > 0
                            ? maintenance.affected_roles.join(', ')
                            : 'tout le monde (sous Super Admin)'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Aperçu de la page maintenance</Label>
                  <div className="border rounded-lg p-8 text-center bg-muted/30">
                    <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Maintenance en cours</h2>
                    <p className="text-muted-foreground">
                      {maintenanceMessage || 'Nous effectuons une maintenance. Veuillez réessayer plus tard.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="w-5 h-5" />
                  Signalement de retard
                </CardTitle>
                <CardDescription>
                  Quand c'est activé, chaque personne planifiée voit un bouton "Je vais être en retard" sur son jour de service (Dashboard). L'envoi notifie le/la superviseur du jour (selon le planning), le Responsable PAV et les Responsables Coordination.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">Activer le signalement de retard</p>
                    <p className="text-sm text-muted-foreground">
                      {retardEnabled ? 'Le bouton est visible pour les personnes planifiées aujourd\'hui.' : 'Le bouton est masqué pour tout le monde.'}
                    </p>
                  </div>
                  <Switch
                    checked={retardEnabled}
                    onCheckedChange={handleRetardToggle}
                    disabled={retardLoading || !isAdmin()}
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Destinataires toujours notifiés (Gestionnaire+)</Label>
                  <p className="text-xs text-muted-foreground">
                    En plus du/de la superviseur du jour (déduit automatiquement du planning). Tant qu'aucun n'est coché ici, Paul Baptista, Delphine et Winchel sont notifiés par défaut.
                  </p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {users
                      .filter((u) => ['Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'].includes(u.niveau_acces))
                      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                      .map((u) => (
                        <label key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                          <span>{u.full_name} <span className="text-xs text-muted-foreground">({u.niveau_acces})</span></span>
                          <input
                            type="checkbox"
                            checked={retardNotifyUserIds.includes(u.id)}
                            onChange={() => handleToggleRetardRecipient(u.id)}
                            disabled={retardRecipientsSaving || !isAdmin()}
                            className="h-4 w-4"
                          />
                        </label>
                      ))}
                    {users.filter((u) => ['Gestionnaire', 'Admin (lecture seule)', 'Admin', 'Super Admin'].includes(u.niveau_acces)).length === 0 && (
                      <p className="text-sm text-muted-foreground px-3 py-4 text-center">Aucun compte Gestionnaire+ trouvé</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5" />
                  Mode test
                </CardTitle>
                <CardDescription>
                  Permet à des comptes désignés ici de tester les fonctionnalités qui dépendent normalement du jour réel (ex : le bouton "Signaler un retard", visible d'ordinaire seulement le jour où on est planifié). Pour un compte testeur, ce bouton devient visible n'importe quel jour tant que le signalement de retard est activé ci-dessus. Le reste du comportement (notifications envoyées, logs) fonctionne normalement — c'est un vrai test de bout en bout. Retire un testeur ou coupe le mode entier à tout moment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">Activer le mode test</p>
                    <p className="text-sm text-muted-foreground">
                      {testModeEnabled ? `Actif pour ${testModeUserIds.length} compte(s) testeur(s).` : 'Désactivé — personne n\'a d\'accès de test.'}
                    </p>
                  </div>
                  <Switch
                    checked={testModeEnabled}
                    onCheckedChange={handleTestModeToggle}
                    disabled={testModeLoading || !isAdmin()}
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Comptes testeurs</Label>
                  {testModeUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {testModeUserIds.map((uid) => {
                        const u = users.find((x) => x.id === uid);
                        return (
                          <span key={uid} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                            {u ? u.full_name : uid}
                            <button
                              type="button"
                              onClick={() => handleToggleTestUser(uid)}
                              disabled={testModeSaving || !isAdmin()}
                              className="hover:text-destructive"
                              title="Retirer ce testeur"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <Input
                    placeholder="Rechercher un compte à ajouter comme testeur..."
                    value={testModeUserQuery}
                    onChange={(e) => setTestModeUserQuery(e.target.value)}
                    className="mt-2"
                  />
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {users
                      .filter((u) => !testModeUserQuery || (u.full_name || '').toLowerCase().includes(testModeUserQuery.toLowerCase()))
                      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                      .map((u) => (
                        <label key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                          <span>{u.full_name} <span className="text-xs text-muted-foreground">({u.niveau_acces})</span></span>
                          <input
                            type="checkbox"
                            checked={testModeUserIds.includes(u.id)}
                            onChange={() => handleToggleTestUser(u.id)}
                            disabled={testModeSaving || !isAdmin()}
                            className="h-4 w-4"
                          />
                        </label>
                      ))}
                    {users.length === 0 && (
                      <p className="text-sm text-muted-foreground px-3 py-4 text-center">Aucun compte trouvé</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* USERS TAB */}
        {(canViewReadOnlyTabs || isGestionnaireOnly) && (
        <TabsContent value="users" className="space-y-4">
          {!isReadOnlyAdmin && (
          <div className="flex justify-end">
            <Dialog open={userDialogOpen} onOpenChange={(open) => {
              setUserDialogOpen(open);
              if (!open) {
                setUserForm({ username: '', password: '', full_name: '', niveau_acces: '' });
                setEditingUser(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-user-btn">
                  <Plus className="w-4 h-4 mr-2" /> Nouvel utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUser ? 'Modifier' : 'Créer'} un utilisateur</DialogTitle>
                  <DialogDescription>
                    {editingUser ? 'Modifiez les informations' : 'Ajoutez un nouveau compte'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Identifiant *</Label>
                    <Input
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      required
                      data-testid="user-username"
                    />
                    {editingUser && (
                      <p className="text-xs text-muted-foreground">
                        Attention : changer l'identifiant modifie le nom utilisé pour se connecter.
                      </p>
                    )}
                  </div>
                  {!editingUser && (
                    <div className="space-y-2">
                      <Label>Mot de passe *</Label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        required
                        data-testid="user-password"
                      />
                      <p className="text-xs text-muted-foreground">L'utilisateur devra le modifier à la première connexion</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Nom complet *</Label>
                    <Input
                      value={userForm.full_name}
                      onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                      required
                      data-testid="user-fullname"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau d'accès *</Label>
                    <Select value={userForm.niveau_acces} onValueChange={(v) => setUserForm({ ...userForm, niveau_acces: v })}>
                      <SelectTrigger data-testid="user-niveau"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {/* 20/08/2026 (#298) : un Gestionnaire ne peut pas
                            créer/promouvoir un compte Admin ou Super Admin
                            (assert_gestionnaire_user_mgmt_scope côté
                            serveur) — la liste proposée ici reflète cette
                            même limite pour éviter un 403 après coup. */}
                        {(isGestionnaireOnly ? NIVEAUX_ACCES.filter((n) => !['Admin (lecture seule)', 'Admin', 'Super Admin'].includes(n)) : NIVEAUX_ACCES).map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting} data-testid="user-submit">
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingUser ? 'Modifier' : 'Créer'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="pl-9"
              />
            </div>
            <Select value={userLevelFilter} onValueChange={setUserLevelFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrer par niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                {NIVEAUX_ACCES.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead>Niveau d'accès</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Créé le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter((u) => {
                      const q = userSearch.trim().toLowerCase();
                      const matchesSearch = !q
                        || (u.username || '').toLowerCase().includes(q)
                        || (u.full_name || '').toLowerCase().includes(q)
                        || (u.niveau_acces || '').toLowerCase().includes(q);
                      const matchesLevel = userLevelFilter === 'all' || u.niveau_acces === userLevelFilter;
                      return matchesSearch && matchesLevel;
                    }).map((u) => {
                      const isProtected = ['Guichard', 'svc-ops-s5xf3f'].includes(u.username);
                      // 20/08/2026 (#298) : un Gestionnaire n'a pas la main
                      // sur les comptes Admin/Admin (lecture seule)/Super
                      // Admin — masque les actions plutôt que de laisser un
                      // clic échouer en 403 (assert_gestionnaire_user_mgmt_scope).
                      const outOfGestionnaireScope = isGestionnaireOnly && ['Admin', 'Admin (lecture seule)', 'Super Admin'].includes(u.niveau_acces);
                      return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary text-sm font-medium">{u.full_name?.charAt(0)}</span>
                            </div>
                            <span className="font-medium">{u.username}</span>
                            {u.id === currentUser?.id && <Badge variant="outline" className="text-xs">Vous</Badge>}
                            {isProtected && <Badge variant="outline" className="text-xs" title="Compte protégé — ne peut pas être supprimé, désactivé ou rétrogradé">Protégé</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{u.full_name}</TableCell>
                        <TableCell><Badge className={getNiveauAccesColor(u.niveau_acces)}>{u.niveau_acces}</Badge></TableCell>
                        <TableCell>
                          <Badge className={u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                            {u.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell className="text-right">
                          {isReadOnlyAdmin || outOfGestionnaireScope ? (
                            <span className="text-xs text-muted-foreground" title={outOfGestionnaireScope ? "Un Gestionnaire ne peut pas gérer un compte Admin ou Super Admin" : undefined}>
                              {outOfGestionnaireScope ? 'Hors périmètre' : 'Lecture seule'}
                            </span>
                          ) : (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Modifier" onClick={() => handleEditUser(u)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {(!isProtected || u.id === currentUser?.id) && (
                              <Button size="sm" variant="ghost" title="Réinitialiser mot de passe" onClick={() => {
                                setSelectedUserForReset(u);
                                setResetPasswordDialogOpen(true);
                              }}>
                                <Key className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" title="Attribuer groupes" onClick={() => openAssignDialog(u)}>
                              <UserCog className="w-4 h-4" />
                            </Button>
                            {u.id !== currentUser?.id && !isProtected && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleToggleUserStatus(u)}>
                                  <Lock className={`w-4 h-4 ${u.is_active ? 'text-amber-500' : 'text-emerald-500'}`} />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteUser(u.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                          )}
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* GROUPS TAB — not exposed to Admin (lecture seule) */}
        {!isReadOnlyAdmin && (
        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={groupDialogOpen} onOpenChange={(open) => {
              setGroupDialogOpen(open);
              if (!open) {
                setGroupForm({ name: '', description: '', permissions: [], planning_full_control: false, planning_scope: [], scope_map: {} });
                setPlanningScopeInput('');
                setEditingGroup(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-group-btn">
                  <Plus className="w-4 h-4 mr-2" /> Nouveau groupe
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingGroup ? 'Modifier' : 'Créer'} un groupe</DialogTitle>
                  <DialogDescription>Définissez les permissions du groupe</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleGroupSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nom du groupe *</Label>
                    <Input
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder="Ex: Gestionnaires Planning"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={groupForm.description}
                      onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                      placeholder="Description du groupe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions par module</Label>
                    <p className="text-xs text-muted-foreground">
                      Lecture / Écriture / Suppression pour chaque module, comme un groupe RO/RW
                      Active Directory. « Spécial » couvre l'action propre au module (valider un
                      devis/une formation, réserver une salle).
                    </p>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left font-medium px-3 py-2">Module</th>
                            <th className="text-center font-medium px-2 py-2 w-16">Lecture</th>
                            <th className="text-center font-medium px-2 py-2 w-16">Écriture</th>
                            <th className="text-center font-medium px-2 py-2 w-20">Suppr.</th>
                            <th className="text-center font-medium px-2 py-2 w-24">Spécial</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PERMISSION_MATRIX_MODULES.map(mod => {
                            const readKey = `${mod.prefix}.read`;
                            const writeKey = `${mod.prefix}.write`;
                            const deleteKey = `${mod.prefix}.delete`;
                            return (
                              <tr key={mod.prefix} className="border-b last:border-b-0">
                                <td className="px-3 py-2 font-medium">{mod.label}</td>
                                <td className="text-center px-2 py-2">
                                  <Checkbox
                                    checked={groupForm.permissions.includes(readKey)}
                                    onCheckedChange={() => togglePermission(readKey)}
                                  />
                                </td>
                                <td className="text-center px-2 py-2">
                                  <Checkbox
                                    checked={groupForm.permissions.includes(writeKey)}
                                    onCheckedChange={() => togglePermission(writeKey)}
                                  />
                                </td>
                                <td className="text-center px-2 py-2">
                                  <Checkbox
                                    checked={groupForm.permissions.includes(deleteKey)}
                                    onCheckedChange={() => togglePermission(deleteKey)}
                                  />
                                </td>
                                <td className="text-center px-2 py-2">
                                  {mod.special ? (
                                    <label
                                      className="inline-flex items-center gap-1 cursor-pointer"
                                      title={mod.special.label}
                                    >
                                      <Checkbox
                                        checked={groupForm.permissions.includes(mod.special.key)}
                                        onCheckedChange={() => togglePermission(mod.special.key)}
                                      />
                                      <span className="text-xs text-muted-foreground">{mod.special.label}</span>
                                    </label>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium mb-2">Administration (droits système)</p>
                      <div className="flex flex-wrap gap-4">
                        {ADMINISTRATION_PERMISSIONS.map(p => (
                          <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm">
                            <Checkbox
                              checked={groupForm.permissions.includes(p.key)}
                              onCheckedChange={() => togglePermission(p.key)}
                            />
                            <span className="text-muted-foreground">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {groupForm.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {groupForm.permissions.map(p => (
                          <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {SEGMENTABLE_PERMISSIONS.filter(p => groupForm.permissions.includes(p)).length > 0 && (
                    <div className="space-y-3 border-t pt-4">
                      <Label>Périmètre par section</Label>
                      <p className="text-xs text-muted-foreground">
                        Pour chaque droit accordé ci-dessus qui peut être limité à certaines valeurs,
                        choisissez « Contrôle total » ou une liste de sections précises — exactement le
                        même principe que la segmentation du Planning ci-dessous.
                      </p>
                      {SEGMENTABLE_PERMISSIONS.filter(p => groupForm.permissions.includes(p)).map(permKey => {
                        const options = scopeOptions[permKey] || [];
                        const scopeList = groupForm.scope_map[permKey] || [];
                        // Le switch reflète scopeOverride si l'utilisateur l'a
                        // manipulé pendant cette session d'édition, sinon il se
                        // déduit de la liste (vide = contrôle total). Sans ce
                        // découplage, décocher "Contrôle total" alors que la
                        // liste est encore vide repassait aussitôt le switch à
                        // ON (la liste restant vide dans les deux cas).
                        const overrideVal = scopeOverride[permKey];
                        const isTotal = overrideVal !== undefined ? overrideVal : scopeList.length === 0;
                        return (
                          <div key={permKey} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{SEGMENTABLE_PERMISSION_LABELS[permKey]}</span>
                              <label className="flex items-center gap-2 text-xs cursor-pointer whitespace-nowrap">
                                <Switch
                                  checked={isTotal}
                                  onCheckedChange={(checked) => {
                                    setScopeOverride(prev => ({ ...prev, [permKey]: checked }));
                                    if (checked) {
                                      // Retour à "Contrôle total" : on efface la
                                      // sélection de sections spécifiques.
                                      setGroupForm(prev => ({
                                        ...prev,
                                        scope_map: { ...prev.scope_map, [permKey]: [] }
                                      }));
                                    }
                                  }}
                                />
                                Contrôle total
                              </label>
                            </div>
                            {!isTotal && (
                              <div className="space-y-1">
                                {options.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Aucune valeur disponible pour l'instant.</p>
                                ) : (
                                  <ScopeChecklist
                                    options={options}
                                    selected={scopeList}
                                    onToggle={(opt) => {
                                      setGroupForm(prev => {
                                        const cur = prev.scope_map[permKey] || [];
                                        const next = cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt];
                                        return { ...prev, scope_map: { ...prev.scope_map, [permKey]: next } };
                                      });
                                    }}
                                  />
                                )}
                                {scopeList.length === 0 && (
                                  <p className="text-xs text-amber-600">Aucune section sélectionnée = accès total tant que rien n'est coché.</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="space-y-2 border-t pt-4">
                    <Label>Segmentation du planning</Label>
                    <p className="text-xs text-muted-foreground">
                      Définit quelles sections/postes du Planning les membres Responsable de ce groupe
                      peuvent voir et éditer. Sans accès complet, un Responsable ne verra que les
                      sections listées ci-dessous.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer text-sm mt-2">
                      <Switch
                        checked={groupForm.planning_full_control}
                        onCheckedChange={(checked) => setGroupForm({ ...groupForm, planning_full_control: checked })}
                      />
                      <span>Accès complet au planning (toutes sections)</span>
                    </label>
                    {!groupForm.planning_full_control && (
                      <div className="space-y-2 pt-1">
                        {(planningScopeOptions.sections.length > 0 || planningScopeOptions.postes.length > 0) ? (
                          <>
                            {planningScopeOptions.sections.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Sections</p>
                                <ScopeChecklist
                                  options={planningScopeOptions.sections}
                                  selected={groupForm.planning_scope}
                                  searchPlaceholder="Rechercher une section…"
                                  onToggle={(opt) => {
                                    const next = groupForm.planning_scope.includes(opt)
                                      ? groupForm.planning_scope.filter(v => v !== opt)
                                      : [...groupForm.planning_scope, opt];
                                    setGroupForm({ ...groupForm, planning_scope: next });
                                  }}
                                />
                              </div>
                            )}
                            {planningScopeOptions.postes.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Postes (mot-clé)</p>
                                <ScopeChecklist
                                  options={planningScopeOptions.postes}
                                  selected={groupForm.planning_scope}
                                  searchPlaceholder="Rechercher un poste…"
                                  onToggle={(opt) => {
                                    const next = groupForm.planning_scope.includes(opt)
                                      ? groupForm.planning_scope.filter(v => v !== opt)
                                      : [...groupForm.planning_scope, opt];
                                    setGroupForm({ ...groupForm, planning_scope: next });
                                  }}
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Aucune section/poste détecté dans les plannings existants pour l'instant — utilisez le champ ci-dessous.
                          </p>
                        )}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Ajouter une valeur personnalisée (si absente ci-dessus)</p>
                          <div className="flex gap-2">
                            <Input
                              value={planningScopeInput}
                              onChange={(e) => setPlanningScopeInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = planningScopeInput.trim();
                                  if (val && !groupForm.planning_scope.includes(val)) {
                                    setGroupForm({ ...groupForm, planning_scope: [...groupForm.planning_scope, val] });
                                  }
                                  setPlanningScopeInput('');
                                }
                              }}
                              placeholder="Ex: CADREURS, REGIE, DIFFUSION"
                              className="h-8 text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const val = planningScopeInput.trim();
                                if (val && !groupForm.planning_scope.includes(val)) {
                                  setGroupForm({ ...groupForm, planning_scope: [...groupForm.planning_scope, val] });
                                }
                                setPlanningScopeInput('');
                              }}
                            >
                              Ajouter
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Ceci ajoute la valeur à la sélection — elle n'efface jamais ce qui est déjà coché.
                          </p>
                        </div>
                        {groupForm.planning_scope.length === 0 && (
                          <p className="text-xs text-amber-600">Aucune section sélectionnée = accès total tant que rien n'est coché.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {editingGroup ? 'Modifier' : 'Créer'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {groups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun groupe créé</p>
                <p className="text-sm text-muted-foreground mt-1">Créez des groupes pour gérer les permissions finement</p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg divide-y overflow-hidden">
              {groups.map(group => (
                <div key={group.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
                  <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{group.name}</span>
                      <button
                        className="cursor-pointer"
                        onClick={() => openMembersDialog(group)}
                        title="Voir / modifier les membres"
                      >
                        <Badge variant="outline" className="hover:bg-muted text-xs">
                          <Users className="w-3 h-3 mr-1" />{group.members_count} membre(s)
                        </Badge>
                      </button>
                      {group.planning_full_control ? (
                        <Badge variant="outline" className="text-xs">Planning : accès complet</Badge>
                      ) : (group.planning_scope || []).length > 0 ? (
                        <Badge variant="outline" className="text-xs">Planning : {group.planning_scope.join(', ')}</Badge>
                      ) : null}
                      {Object.entries(group.scope_map || {}).filter(([, v]) => (v || []).length > 0).map(([permKey, values]) => (
                        <Badge key={permKey} variant="outline" className="text-xs">
                          {(SEGMENTABLE_PERMISSION_LABELS[permKey] || permKey).split('—')[0].trim()} : {values.join(', ')}
                        </Badge>
                      ))}
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(group.permissions || []).slice(0, 8).map(p => (
                        <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                      ))}
                      {(group.permissions || []).length > 8 && (
                        <Badge variant="outline" className="text-[10px]">+{group.permissions.length - 8}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" title={isReadOnlyAdmin ? "Voir les membres" : "Gérer les membres"} onClick={() => openMembersDialog(group)}>
                      <UserCog className="w-4 h-4" />
                    </Button>
                    {!isReadOnlyAdmin && (
                    <>
                    <Button size="icon" variant="ghost" onClick={() => handleEditGroup(group)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(group.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        )}

        {/* DROITS D'ACCÈS TAB */}
        {(isSuperAdmin() || isAdmin()) && (
          <TabsContent value="rights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Droits d'accès
                </CardTitle>
                <CardDescription>
                  Ajoutez, retirez ou modifiez les droits accordés à chaque rôle. Les cases grisées
                  sont des droits de base du rôle (ou de l'accès Admin) et ne peuvent pas être retirées ici.
                  Super Admin possède toujours l'ensemble des droits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rightsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Droit</TableHead>
                          <TableHead className="text-center">Responsable</TableHead>
                          <TableHead className="text-center">Gestionnaire</TableHead>
                          <TableHead className="text-center">Admin</TableHead>
                          <TableHead className="text-center">Super Admin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const CATEGORY_LABELS = {
                            actualites: 'Actualités',
                            documents: 'Documents',
                            effectif: 'Effectif',
                            planning: 'Planning',
                            devis: 'Devis',
                            formations: 'Formations',
                            logistique: 'Logistique / Matériel',
                            salles: 'Salles',
                            admin: 'Supervision & Maintenance',
                          };
                          let lastCategory = null;
                          const out = [];
                          rightsRows.forEach((row) => {
                            const category = row.key.split('.')[0];
                            if (category !== lastCategory) {
                              lastCategory = category;
                              out.push(
                                <TableRow key={`cat-${category}`} className="bg-muted/50 hover:bg-muted/50">
                                  <TableCell colSpan={5} className="font-semibold text-xs uppercase tracking-wide text-muted-foreground py-2">
                                    {CATEGORY_LABELS[category] || category}
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            out.push(
                              <TableRow key={row.key}>
                                <TableCell className="font-medium">{row.label}</TableCell>
                                {['Responsable', 'Gestionnaire', 'Admin'].map((role) => {
                                  const cell = row.roles[role];
                                  const busy = rightsBusyKey === `${row.key}:${role}`;
                                  return (
                                    <TableCell key={role} className="text-center">
                                      <input
                                        type="checkbox"
                                        checked={cell.granted}
                                        disabled={cell.locked || busy}
                                        title={cell.reason || ''}
                                        onChange={(e) => toggleRolePermission(row.key, role, e.target.checked)}
                                        className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                      />
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center">
                                  <input type="checkbox" checked disabled title="Super Admin a toujours tous les droits" className="w-4 h-4 opacity-60" />
                                </TableCell>
                              </TableRow>
                            );
                          });
                          return out;
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              Certaines actions restent réservées à Super Admin et n'apparaissent pas dans ce tableau pour des raisons
              de sécurité : gestion des comptes utilisateurs, gestion des groupes, et suppressions définitives.
              Le contrôle fin du Planning par section (Cadreurs, Régisseurs, Diffusion, Régie, etc.) ne se règle pas
              ici mais dans l'onglet Groupes & Droits, via les groupes Planning_*.
            </p>
          </TabsContent>
        )}

        {/* LOGS TAB */}
        {(canViewReadOnlyTabs || isGestionnaireOnly) && (
        <TabsContent value="logs" className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">Mise à jour automatique toutes les 20s</span>
            <Button variant="outline" onClick={fetchLogs}>
              <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center">
                  <ScrollText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun log</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Détails</TableHead>
                      <TableHead>Date & Heure</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xl">{getActionIcon(log.action)}</TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell className="text-muted-foreground">{log.user_name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">{log.details}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* SUPERVISION TAB */}
        {canViewReadOnlyTabs && (
          <TabsContent value="supervision" className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">Mise à jour automatique toutes les 30s</span>
              <Button
                variant="outline"
                onClick={() => { fetchSystemStatus(); fetchInfraStatus(); fetchB2Status(); }}
                disabled={systemStatusLoading || infraStatusLoading || b2StatusLoading}
              >
                {(systemStatusLoading || infraStatusLoading || b2StatusLoading)
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <RefreshCw className="w-4 h-4 mr-2" />}
                Actualiser
              </Button>
            </div>

            {/* INFRASTRUCTURE : backend (Render) + frontend (Netlify), en direct */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5" /> Infrastructure
                </CardTitle>
                <CardDescription>
                  État en direct des services qui font tourner l'application : le serveur (Render), le site
                  (Netlify) et la base de données ci-dessous.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {infraStatusLoading && !infraStatus ? (
                  <div className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : !infraStatus ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Aucune donnée pour le moment</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Backend / Render */}
                    <div className="p-4 rounded-lg border border-border space-y-2">
                      <div className="flex items-center gap-2">
                        <Server className="w-5 h-5 text-primary shrink-0" />
                        <p className="font-medium text-sm flex-1">Backend (Render)</p>
                        {infraStatus.backend?.ok
                          ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {infraStatus.backend?.ok ? 'En ligne' : 'Problème détecté'}
                        {' · '}{infraStatus.backend?.region}
                        {typeof infraStatus.backend?.response_time_ms === 'number' && ` · ${infraStatus.backend.response_time_ms} ms`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Actif depuis {formatUptime(infraStatus.backend?.uptime_seconds || 0)}
                      </p>

                      {infraStatus.render?.configured === false ? (
                        <p className="text-xs text-amber-600 dark:text-amber-500 pt-1 border-t border-border mt-2">
                          {infraStatus.render.message}
                        </p>
                      ) : infraStatus.render?.error ? (
                        <p className="text-xs text-red-500 pt-1 border-t border-border mt-2">{infraStatus.render.error}</p>
                      ) : infraStatus.render ? (
                        <div className="pt-2 border-t border-border mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Service <span className="font-medium text-foreground">{infraStatus.render.name}</span>
                            {infraStatus.render.plan && ` · plan ${infraStatus.render.plan}`}
                          </p>
                          {infraStatus.render.latest_deploy_status && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <GitBranch className="w-3 h-3 shrink-0" />
                              Dernier déploiement : {infraStatus.render.latest_deploy_status}
                              {infraStatus.render.latest_deploy_at && ` · ${new Date(infraStatus.render.latest_deploy_at).toLocaleString('fr-FR')}`}
                            </p>
                          )}
                          {infraStatus.render.latest_deploy_commit && (
                            <p className="text-xs text-muted-foreground truncate">{infraStatus.render.latest_deploy_commit}</p>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRenderRedeployDialogOpen(true)}
                              disabled={!isSuperAdmin()}
                              title={!isSuperAdmin() ? "Réservé à Super Admin" : undefined}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Redéployer
                            </Button>
                            <Button size="sm" variant="ghost" onClick={toggleRenderDeploys}>
                              <History className="w-3.5 h-3.5 mr-1.5" /> Historique
                              {renderDeploysOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                            </Button>
                          </div>

                          {renderDeploysOpen && (
                            <div className="pt-2 space-y-1.5">
                              {renderDeploysLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              ) : renderDeploys?.length ? (
                                renderDeploys.map((d) => (
                                  <div key={d.id} className="text-xs bg-muted/50 rounded px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-medium">{d.status}</span>
                                      <span className="text-muted-foreground">
                                        {d.finished_at ? new Date(d.finished_at).toLocaleString('fr-FR') : ''}
                                      </span>
                                    </div>
                                    {d.commit_message && (
                                      <p className="text-muted-foreground truncate">{d.commit_message}</p>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">Aucun déploiement trouvé.</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {/* Frontend / Netlify */}
                    <div className="p-4 rounded-lg border border-border space-y-2">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-primary shrink-0" />
                        <p className="font-medium text-sm flex-1">Frontend (Netlify)</p>
                        {infraStatus.netlify?.configured && (
                          infraStatus.netlify?.ok
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                            : <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                      </div>

                      {infraStatus.netlify?.configured === false ? (
                        <p className="text-xs text-amber-600 dark:text-amber-500">{infraStatus.netlify.message}</p>
                      ) : infraStatus.netlify?.error ? (
                        <p className="text-xs text-red-500">{infraStatus.netlify.error}</p>
                      ) : infraStatus.netlify ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Site <span className="font-medium text-foreground">{infraStatus.netlify.name}</span>
                            {' · '}{infraStatus.netlify.state}
                          </p>
                          {infraStatus.netlify.latest_deploy_state && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <GitBranch className="w-3 h-3 shrink-0" />
                              Dernier déploiement : {infraStatus.netlify.latest_deploy_state}
                              {infraStatus.netlify.latest_deploy_at && ` · ${new Date(infraStatus.netlify.latest_deploy_at).toLocaleString('fr-FR')}`}
                            </p>
                          )}
                          {infraStatus.netlify.latest_deploy_title && (
                            <p className="text-xs text-muted-foreground truncate">{infraStatus.netlify.latest_deploy_title}</p>
                          )}

                          <div className="flex items-center gap-2 pt-2">
                            <Button size="sm" variant="ghost" onClick={toggleNetlifyDeploys}>
                              <History className="w-3.5 h-3.5 mr-1.5" /> Historique
                              {netlifyDeploysOpen ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                            </Button>
                          </div>

                          {netlifyDeploysOpen && (
                            <div className="pt-2 space-y-1.5">
                              {netlifyDeploysLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                              ) : netlifyDeploys?.length ? (
                                netlifyDeploys.map((d) => (
                                  <div key={d.id} className="text-xs bg-muted/50 rounded px-2 py-1.5 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{d.state}</span>
                                        {d.is_current && <span className="text-emerald-600 dark:text-emerald-500">· en ligne</span>}
                                      </div>
                                      <p className="text-muted-foreground truncate">
                                        {d.title || ''}{d.created_at && ` · ${new Date(d.created_at).toLocaleString('fr-FR')}`}
                                      </p>
                                    </div>
                                    {!d.is_current && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="shrink-0"
                                        onClick={() => handleNetlifyRestore(d.id)}
                                        disabled={netlifyRestoringId === d.id || !isSuperAdmin()}
                                        title={!isSuperAdmin() ? "Réservé à Super Admin" : undefined}
                                      >
                                        {netlifyRestoringId === d.id
                                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          : 'Restaurer'}
                                      </Button>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">Aucun déploiement trouvé.</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Confirmation redéploiement Render */}
            <Dialog open={renderRedeployDialogOpen} onOpenChange={setRenderRedeployDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Redéployer le backend ?</DialogTitle>
                  <DialogDescription>
                    Render va relancer un déploiement à partir du dernier commit. Le service reste
                    accessible pendant le build ; une brève coupure (quelques secondes) peut survenir
                    au moment du basculement, comme pour tout déploiement normal.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRenderRedeployDialogOpen(false)} disabled={renderRedeploying}>Annuler</Button>
                  <Button onClick={handleRenderRedeploy} disabled={renderRedeploying}>
                    {renderRedeploying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Redéployer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Redondance stockage (Backblaze B2) */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="w-5 h-5" /> Redondance stockage (Backblaze B2)
                  </CardTitle>
                  <CardDescription>
                    Chaque fichier (photos badge, documents, images actualités) est envoyé sur tous les
                    comptes configurés à chaque fois — la bascule change seulement lequel est lu en
                    premier parmi principal/secours, pas où les données existent. Tous les comptes
                    restent gratuits (10 Go chacun, sans carte).
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={handleB2Backfill}
                  disabled={b2Backfilling || !isSuperAdmin()}
                  title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : "Copie les fichiers déjà présents sur un compte vers les comptes qui ne les ont pas encore"}
                >
                  {b2Backfilling && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Backfill fichiers existants
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {b2StatusLoading && !b2Status ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : !b2Status ? (
                  <p className="text-sm text-muted-foreground">Aucune donnée pour le moment</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['primary', 'backup'].map((acctKey) => {
                        const acct = b2Status[acctKey];
                        const label = acctKey === 'primary' ? 'Compte principal' : 'Compte de secours';
                        return (
                          <div key={acctKey} className="p-4 rounded-lg border border-border space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{label}</p>
                              <div className="flex items-center gap-1.5">
                                {acct.active && (
                                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Actif</Badge>
                                )}
                                {acct.configured
                                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  : <XCircle className="w-4 h-4 text-red-500" />}
                              </div>
                            </div>
                            {!acct.configured ? (
                              <p className="text-xs text-amber-600 dark:text-amber-500">{acct.message}</p>
                            ) : (
                              <>
                                <p className="text-xs text-muted-foreground truncate">
                                  Bucket <span className="font-medium text-foreground">{acct.bucket}</span>
                                  {' · '}{acct.region}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="p-2 rounded-lg bg-muted/50">
                                    <p className="text-[10px] text-muted-foreground">Utilisé</p>
                                    <p className="text-sm font-bold">{formatBytes(acct.used_bytes)}</p>
                                  </div>
                                  <div className="p-2 rounded-lg bg-muted/50">
                                    <p className="text-[10px] text-muted-foreground">Limite</p>
                                    <p className="text-sm font-bold">{acct.limit_gb ? `${acct.limit_gb} Go` : '—'}</p>
                                  </div>
                                  <div className="p-2 rounded-lg bg-muted/50">
                                    <p className="text-[10px] text-muted-foreground">%</p>
                                    <p className="text-sm font-bold">{acct.percent_used != null ? `${acct.percent_used}%` : '—'}</p>
                                  </div>
                                </div>
                                {acct.message && (
                                  <p className="text-xs text-red-500">{acct.message}</p>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Limite en Go"
                                    className="h-8 text-sm"
                                    value={b2LimitInputs[acctKey]}
                                    onChange={(e) => setB2LimitInputs((prev) => ({ ...prev, [acctKey]: e.target.value }))}
                                    disabled={!isSuperAdmin()}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveB2Limit(acctKey)}
                                    disabled={b2LimitsSaving === acctKey || !isSuperAdmin()}
                                    title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                                  >
                                    {b2LimitsSaving === acctKey
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : 'Définir'}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">Copie automatique vers les comptes de secours</p>
                        <p className="text-xs text-muted-foreground">
                          Activée par défaut : chaque nouveau fichier est copié partout dès l'upload. Si
                          désactivée, un fichier n'est écrit que sur le compte actif — utilisez "Backfill
                          fichiers existants" pour rattraper manuellement ce qui a été stocké entre-temps.
                        </p>
                      </div>
                      <Switch
                        checked={!!b2Status.mirroring_enabled}
                        onCheckedChange={handleB2MirrorToggle}
                        disabled={b2MirrorToggling || !isSuperAdmin()}
                        title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Compte actif actuellement : <span className="font-medium text-foreground">
                          {b2Status.active_account === 'primary' ? 'Compte principal' : 'Compte de secours'}
                        </span>
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setB2ToggleDialogOpen(true)}
                        disabled={!b2Status.redundancy_enabled || !isSuperAdmin()}
                        title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" /> Basculer
                      </Button>
                    </div>

                    {b2Status.tertiary && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">
                          Compte géo-redondant (région distincte — protège contre un incident propre à la
                          région EU des deux comptes ci-dessus). Toujours écrit en miroir, mais ne
                          participe pas à la bascule.
                        </p>
                        <div className="p-4 rounded-lg border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">Compte géo-redondant (US)</p>
                            <div className="flex items-center gap-1.5">
                              {b2Status.tertiary.configured && (
                                <Badge variant="secondary">Géo</Badge>
                              )}
                              {b2Status.tertiary.configured
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                : <XCircle className="w-4 h-4 text-red-500" />}
                            </div>
                          </div>
                          {!b2Status.tertiary.configured ? (
                            <p className="text-xs text-amber-600 dark:text-amber-500">{b2Status.tertiary.message}</p>
                          ) : (
                            <>
                              <p className="text-xs text-muted-foreground truncate">
                                Bucket <span className="font-medium text-foreground">{b2Status.tertiary.bucket}</span>
                                {' · '}{b2Status.tertiary.region}
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 rounded-lg bg-muted/50">
                                  <p className="text-[10px] text-muted-foreground">Utilisé</p>
                                  <p className="text-sm font-bold">{formatBytes(b2Status.tertiary.used_bytes)}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/50">
                                  <p className="text-[10px] text-muted-foreground">Limite</p>
                                  <p className="text-sm font-bold">{b2Status.tertiary.limit_gb ? `${b2Status.tertiary.limit_gb} Go` : '—'}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/50">
                                  <p className="text-[10px] text-muted-foreground">%</p>
                                  <p className="text-sm font-bold">{b2Status.tertiary.percent_used != null ? `${b2Status.tertiary.percent_used}%` : '—'}</p>
                                </div>
                              </div>
                              {b2Status.tertiary.message && (
                                <p className="text-xs text-red-500">{b2Status.tertiary.message}</p>
                              )}
                              <div className="flex items-center gap-2 pt-1">
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Limite en Go"
                                  className="h-8 text-sm"
                                  value={b2LimitInputs.tertiary}
                                  onChange={(e) => setB2LimitInputs((prev) => ({ ...prev, tertiary: e.target.value }))}
                                  disabled={!isSuperAdmin()}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveB2Limit('tertiary')}
                                  disabled={b2LimitsSaving === 'tertiary' || !isSuperAdmin()}
                                  title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                                >
                                  {b2LimitsSaving === 'tertiary'
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : 'Définir'}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Confirmation bascule B2 */}
            <Dialog open={b2ToggleDialogOpen} onOpenChange={setB2ToggleDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Basculer le compte de stockage actif ?</DialogTitle>
                  <DialogDescription>
                    Les fichiers restent présents sur les deux comptes (mirroring). Cette action change
                    seulement lequel est utilisé en priorité pour lire les fichiers — sans coupure de
                    service, réversible à tout moment.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setB2ToggleDialogOpen(false)} disabled={b2Toggling}>Annuler</Button>
                  <Button onClick={handleB2Toggle} disabled={b2Toggling}>
                    {b2Toggling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Basculer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {systemStatusLoading && !systemStatus ? (
              <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
            ) : !systemStatus ? (
              <div className="p-8 text-center text-muted-foreground">Aucune donnée pour le moment</div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="w-5 h-5" /> État général
                    </CardTitle>
                    <CardDescription>
                      Rien ici ne devrait t'inquiéter : l'utilisation actuelle est très faible. Cette page se
                      met à jour à chaque ouverture pour que tu puisses vérifier quand tu veux.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        {systemStatus.mongo_connected
                          ? <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                          : <XCircle className="w-6 h-6 text-red-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-sm">Base de données</p>
                          <p className="text-xs text-muted-foreground">
                            {systemStatus.mongo_connected ? 'Connectée, fonctionne normalement' : (systemStatus.mongo_error || 'Problème de connexion')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <Activity className="w-6 h-6 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Serveur actif depuis</p>
                          <p className="text-xs text-muted-foreground">{formatUptime(systemStatus.backend_uptime_seconds)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <HardDrive className="w-6 h-6 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">Espace utilisé (données)</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(systemStatus.db_data_size_bytes)} sur disque
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Stockage de la base de données</CardTitle>
                    <CardDescription>
                      Pour référence : à titre de comparaison, une clé USB fait généralement 8 000 à 64 000 Mo —
                      l'app utilise aujourd'hui une fraction infime de cet ordre de grandeur.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Données</p>
                        <p className="text-lg font-bold">{formatBytes(systemStatus.db_data_size_bytes)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Sur disque</p>
                        <p className="text-lg font-bold">{formatBytes(systemStatus.db_storage_size_bytes)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Index</p>
                        <p className="text-lg font-bold">{formatBytes(systemStatus.db_index_size_bytes)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs text-muted-foreground">Documents</p>
                        <p className="text-lg font-bold">{(systemStatus.db_objects_count || 0).toLocaleString('fr-FR')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle>Détail par catégorie</CardTitle>
                      <CardDescription>Ce qui prend le plus de place, du plus gros au plus petit.</CardDescription>
                    </div>
                    <Select value={collectionsSortBy} onValueChange={setCollectionsSortBy}>
                      <SelectTrigger className="w-[190px] h-8 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="size_desc">Taille (plus gros d'abord)</SelectItem>
                        <SelectItem value="size_asc">Taille (plus petit d'abord)</SelectItem>
                        <SelectItem value="count_desc">Éléments (plus au moins)</SelectItem>
                        <SelectItem value="name_asc">Catégorie (A → Z)</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(() => {
                      const sortedCollections = (systemStatus.collections || [])
                        .filter((c) => c.count > 0)
                        .sort((a, b) => {
                          if (collectionsSortBy === 'size_asc') return a.size_bytes - b.size_bytes;
                          if (collectionsSortBy === 'count_desc') return b.count - a.count;
                          if (collectionsSortBy === 'name_asc') return a.name.localeCompare(b.name);
                          return b.size_bytes - a.size_bytes; // size_desc (défaut)
                        });
                      const hiddenCount = sortedCollections.length - COLLECTIONS_COLLAPSED_COUNT;
                      const visibleCollections = collectionsExpanded ? sortedCollections : sortedCollections.slice(0, COLLECTIONS_COLLAPSED_COUNT);
                      return (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Catégorie</TableHead>
                                <TableHead>Éléments</TableHead>
                                <TableHead>Taille</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleCollections.map((c) => (
                                <TableRow key={c.name}>
                                  <TableCell className="font-medium">{c.name}</TableCell>
                                  <TableCell className="text-muted-foreground">{c.count.toLocaleString('fr-FR')}</TableCell>
                                  <TableCell className="text-muted-foreground">{formatBytes(c.size_bytes)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setCollectionsExpanded((prev) => !prev)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border"
                            >
                              {collectionsExpanded ? (
                                <>Voir moins <ChevronUp className="w-3.5 h-3.5" /></>
                              ) : (
                                <>Voir {hiddenCount} de plus <ChevronDown className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Quota de stockage */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quota de stockage</CardTitle>
                    <CardDescription>
                      Définis une limite de référence (en Go) pour suivre l'espace utilisé / restant.
                      Sans quota défini, seul l'espace utilisé est affiché ci-dessus.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {systemStatus.quota_bytes ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Quota</p>
                          <p className="text-lg font-bold">{formatBytes(systemStatus.quota_bytes)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Restant</p>
                          <p className="text-lg font-bold">{formatBytes(systemStatus.remaining_bytes)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs text-muted-foreground">Utilisé</p>
                          <p className="text-lg font-bold">{systemStatus.percent_used}%</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun quota défini pour le moment.</p>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Label>Nouveau quota (Go) — laisser vide pour retirer</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="Ex: 5"
                          value={quotaInput}
                          onChange={(e) => setQuotaInput(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={handleSaveQuota}
                        disabled={quotaSaving || !isSuperAdmin()}
                        title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                      >
                        {quotaSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enregistrer
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Nettoyage & maintenance */}
                <Card>
                  <CardHeader>
                    <CardTitle>Nettoyage & maintenance</CardTitle>
                    <CardDescription>
                      Dernier nettoyage automatique des logs : {systemStatus.last_logs_purge ? systemStatus.last_logs_purge : 'jamais'} ·
                      notifications : {systemStatus.last_notifications_purge ? systemStatus.last_notifications_purge : 'jamais'}.
                      Un nettoyage automatique des logs et notifications de plus de 1 mois tourne aussi chaque début de mois.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border border-border space-y-2">
                      <p className="font-medium text-sm flex items-center gap-2"><Trash className="w-4 h-4" /> Cache navigateur</p>
                      <p className="text-xs text-muted-foreground">Vide le cache local de l'app dans ce navigateur et recharge la page.</p>
                      <Button size="sm" variant="outline" onClick={handleClearBrowserCache} disabled={cleanupBusy === 'cache'}>
                        {cleanupBusy === 'cache' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Vider le cache
                      </Button>
                    </div>
                    <div className="p-3 rounded-lg border border-border space-y-2">
                      <p className="font-medium text-sm flex items-center gap-2"><FileArchive className="w-4 h-4" /> Fichiers orphelins</p>
                      <p className="text-xs text-muted-foreground">Fichiers uploadés qui ne sont plus reliés à aucune actualité ou document.</p>
                      {orphanPreview ? (
                        <div className="text-xs space-y-1">
                          <p>{orphanPreview.count} fichier(s), {formatBytes(orphanPreview.total_bytes)}</p>
                          {orphanPreview.count > 0 ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleConfirmOrphanedCleanup}
                                disabled={cleanupBusy === 'orphan-delete' || !isSuperAdmin()}
                                title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                              >
                                {cleanupBusy === 'orphan-delete' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Confirmer suppression
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setOrphanPreview(null)}>Annuler</Button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={handlePreviewOrphanedFiles} disabled={cleanupBusy === 'orphan-preview'}>
                          {cleanupBusy === 'orphan-preview' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Vérifier
                        </Button>
                      )}
                    </div>
                    <div className="p-3 rounded-lg border border-border space-y-2">
                      <p className="font-medium text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Logs (+1 mois)</p>
                      <p className="text-xs text-muted-foreground">Purge manuelle immédiate des journaux d'activité de plus de 1 mois.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCleanupLogs}
                        disabled={cleanupBusy === 'logs' || !isSuperAdmin()}
                        title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                      >
                        {cleanupBusy === 'logs' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Nettoyer maintenant
                      </Button>
                    </div>

                    <div className="p-3 rounded-lg border border-border space-y-2">
                      <p className="font-medium text-sm flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications (+1 mois)</p>
                      <p className="text-xs text-muted-foreground">Purge manuelle immédiate des notifications reçues de plus de 1 mois.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCleanupNotifications}
                        disabled={cleanupBusy === 'notifications' || !isSuperAdmin()}
                        title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                      >
                        {cleanupBusy === 'notifications' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Nettoyer maintenant
                      </Button>
                    </div>

                    {isSuperAdmin() && (
                      <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 space-y-2">
                        <p className="font-medium text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Logs — purge totale immédiate</p>
                        <p className="text-xs text-muted-foreground">
                          Supprime tout l'historique des logs, y compris le dernier mois. Irréversible.
                          {!canPurgeAllLogs && " Réservé au titulaire du compte, ou aux comptes qu'il autorise explicitement."}
                        </p>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setPurgeAllDialogOpen(true)}
                          disabled={!canPurgeAllLogs}
                          title={!canPurgeAllLogs ? "Réservé au titulaire du compte, ou aux comptes qu'il autorise" : undefined}
                        >
                          Purger toutes les logs
                        </Button>
                      </div>
                    )}

                    {isSuperAdmin() && (
                      <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 space-y-2">
                        <p className="font-medium text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Notifications — purge totale immédiate</p>
                        <p className="text-xs text-muted-foreground">
                          Supprime toutes les notifications de tous les comptes, y compris le dernier mois. Irréversible.
                          {!canPurgeAllLogs && " Réservé au titulaire du compte, ou aux comptes qu'il autorise explicitement."}
                        </p>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setPurgeAllNotifDialogOpen(true)}
                          disabled={!canPurgeAllLogs}
                          title={!canPurgeAllLogs ? "Réservé au titulaire du compte, ou aux comptes qu'il autorise" : undefined}
                        >
                          Purger toutes les notifications
                        </Button>
                      </div>
                    )}

                    {isOwnerAccount && (
                      <div className="p-3 rounded-lg border border-border space-y-2">
                        <p className="font-medium text-sm">Qui peut purger toutes les logs</p>
                        <p className="text-xs text-muted-foreground">Visible uniquement par toi. Ajoute les comptes Super Admin que tu autorises à utiliser la purge totale.</p>
                        <div className="space-y-1">
                          {(logPurgeAllowlist || []).length === 0 && (
                            <p className="text-xs text-muted-foreground">Personne d'autre n'est autorisé pour le moment.</p>
                          )}
                          {(logPurgeAllowlist || []).map((u) => (
                            <div key={u.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1.5">
                              <span>{u.full_name}</span>
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveAllowlistUser(u.id)} disabled={allowlistBusy}>
                                Retirer
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Select value={allowlistAddUserId} onValueChange={setAllowlistAddUserId}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Choisir un Super Admin..." />
                            </SelectTrigger>
                            <SelectContent>
                              {users.filter((u) => u.niveau_acces === 'Super Admin' && u.username !== 'Guichard' && !(logPurgeAllowlist || []).some((a) => a.id === u.id)).map((u) => (
                                <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={handleAddAllowlistUser} disabled={!allowlistAddUserId || allowlistBusy}>
                            Autoriser
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Confirmation purge totale des logs */}
                <Dialog open={purgeAllDialogOpen} onOpenChange={setPurgeAllDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Purger tout l'historique des logs ?</DialogTitle>
                      <DialogDescription>
                        Cette action supprime définitivement TOUS les journaux d'activité, y compris le dernier
                        mois habituellement conservé. Cette action est irréversible.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPurgeAllDialogOpen(false)} disabled={purgeAllBusy}>Annuler</Button>
                      <Button variant="destructive" onClick={handlePurgeAllLogsNow} disabled={purgeAllBusy}>
                        {purgeAllBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Purger définitivement
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Confirmation purge totale des notifications */}
                <Dialog open={purgeAllNotifDialogOpen} onOpenChange={setPurgeAllNotifDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Purger toutes les notifications ?</DialogTitle>
                      <DialogDescription>
                        Cette action supprime définitivement TOUTES les notifications de tous les comptes, y
                        compris le dernier mois habituellement conservé. Cette action est irréversible.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPurgeAllNotifDialogOpen(false)} disabled={purgeAllNotifBusy}>Annuler</Button>
                      <Button variant="destructive" onClick={handlePurgeAllNotificationsNow} disabled={purgeAllNotifBusy}>
                        {purgeAllNotifBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Purger définitivement
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Export de données */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" /> Export de données</CardTitle>
                    <CardDescription>Télécharge une catégorie de données au format CSV ou JSON.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label>Catégorie</Label>
                      <Select value={exportCollection} onValueChange={setExportCollection}>
                        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUPERVISED_COLLECTIONS_FRONT.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Format</Label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="csv">CSV</SelectItem>
                          <SelectItem value="json">JSON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleExportData} disabled={exporting}>
                      {exporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Télécharger
                    </Button>
                  </CardContent>
                </Card>

                {/* Redémarrage du serveur */}
                <Card className="border-amber-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-700"><Power className="w-5 h-5" /> Redémarrage du serveur</CardTitle>
                    <CardDescription>
                      Redémarre le serveur backend. L'application sera indisponible environ 30 à 60 secondes.
                      À utiliser seulement si nécessaire (ex : le serveur semble bloqué).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={() => setRestartDialogOpen(true)}
                      disabled={!isSuperAdmin()}
                      title={!isSuperAdmin() ? "Réservé à Super Admin (configurable dans Droits d'accès)" : undefined}
                    >
                      <Power className="w-4 h-4 mr-2" /> Redémarrer le serveur
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Restart server confirmation */}
      <Dialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le redémarrage du serveur ?</DialogTitle>
            <DialogDescription>
              L'application sera indisponible pour tout le monde pendant environ 30 à 60 secondes le temps que
              le serveur redémarre. Cette action est journalisée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestartDialogOpen(false)} disabled={restarting}>Annuler</Button>
            <Button variant="destructive" onClick={handleRestartServer} disabled={restarting}>
              {restarting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Redémarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              {selectedUserForReset && `Nouveau mot de passe pour ${selectedUserForReset.full_name}`}
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
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
              {selectedUserForGroups && `Groupes pour ${selectedUserForGroups.full_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Aucun groupe disponible</p>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                {groups.map(group => (
                  <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedGroupIds.includes(group.id)}
                      onCheckedChange={() => {
                        setSelectedGroupIds(prev => 
                          prev.includes(group.id)
                            ? prev.filter(id => id !== group.id)
                            : [...prev, group.id]
                        );
                      }}
                    />
                    <span>{group.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">{group.permissions?.length || 0} perms</Badge>
                  </label>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleAssignGroups} disabled={submitting || groups.length === 0}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
              {selectedGroupForMembers && (isReadOnlyAdmin
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
                .filter(u => u.full_name.toLowerCase().includes(memberSearch.toLowerCase()) || u.username.toLowerCase().includes(memberSearch.toLowerCase()))
                .map(u => (
                  <label key={u.id} className={`flex items-center gap-2 py-1 ${isReadOnlyAdmin ? '' : 'cursor-pointer'}`}>
                    <Checkbox
                      checked={selectedMemberUserIds.includes(u.id)}
                      disabled={isReadOnlyAdmin}
                      onCheckedChange={() => {
                        if (isReadOnlyAdmin) return;
                        setSelectedMemberUserIds(prev =>
                          prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        );
                      }}
                    />
                    <span className="flex-1 truncate">{u.full_name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{u.niveau_acces}</Badge>
                  </label>
                ))}
              {users.length === 0 && (
                <p className="text-muted-foreground text-center py-4 text-sm">Aucun utilisateur</p>
              )}
            </div>
            <DialogFooter>
              {isReadOnlyAdmin ? (
                <Button variant="outline" onClick={() => setMembersDialogOpen(false)}>Fermer</Button>
              ) : (
                <Button onClick={handleUpdateGroupMembers} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
