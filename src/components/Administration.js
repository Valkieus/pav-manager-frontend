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
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const NIVEAUX_ACCES = ['Technicien', 'Gestionnaire', 'Responsable', 'Admin', 'Super Admin'];

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
const MAINTENANCE_ROLES = ['Technicien', 'Gestionnaire', 'Responsable', 'Admin'];

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

export default function Administration() {
  const { isSuperAdmin, isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
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

  const [quotaInput, setQuotaInput] = useState('');
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(null); // which cleanup action is currently running
  const [orphanPreview, setOrphanPreview] = useState(null);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [exportCollection, setExportCollection] = useState('techniciens');
  const [exportFormat, setExportFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);

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
      toast.success(`${res.data.deleted_count} log(s) de plus de 12 mois supprimé(s)`);
      fetchSystemStatus();
    } catch (err) {
      toast.error('Erreur lors du nettoyage des logs');
    } finally {
      setCleanupBusy(null);
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
    setExporting(true);
    try {
      const res = await axios.get(`${API}/admin/export/${exportCollection}?format=${exportFormat}`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportCollection}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé');
    } catch (err) {
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
    permissions: []
  });

  useEffect(() => {
    if (!isAdmin()) {
      toast.error('Accès réservé aux administrateurs');
      navigate('/');
      return;
    }
    fetchData();
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (activeTab === 'rights' && isSuperAdmin()) {
      fetchRolePermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'supervision' && isAdmin() && !systemStatus) {
      fetchSystemStatus();
    }
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
      const [usersRes, logsRes, groupsRes, maintenanceRes] = await Promise.all([
        axios.get(`${API}/auth/users`),
        axios.get(`${API}/logs`),
        axios.get(`${API}/groups/enhanced`).catch(() => ({ data: [] })),
        axios.get(`${API}/maintenance`).catch(() => ({ data: { is_active: false, message: '' } }))
      ]);
      setUsers(usersRes.data);
      setLogs(logsRes.data);
      setGroups(groupsRes.data);
      setMaintenance(maintenanceRes.data);
      setMaintenanceMessage(maintenanceRes.data.message || '');
      setMaintenanceScope(maintenanceRes.data.scope || 'site');
      setMaintenancePagePath(maintenanceRes.data.page_path || MAINTENANCE_PAGES[0].path);
      setMaintenanceAffectedRoles(maintenanceRes.data.affected_roles || []);
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
          niveau_acces: userForm.niveau_acces
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
      setGroupForm({ name: '', description: '', permissions: [] });
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
      permissions: group.permissions || []
    });
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
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Groupes & Droits
          </TabsTrigger>
          {isSuperAdmin() && (
            <TabsTrigger value="rights" className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Droits d'accès
            </TabsTrigger>
          )}
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <ScrollText className="w-4 h-4" /> Logs
          </TabsTrigger>
          {isAdmin() && (
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Maintenance
            </TabsTrigger>
          )}
          {isAdmin() && (
            <TabsTrigger value="supervision" className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Supervision
            </TabsTrigger>
          )}
        </TabsList>

        {/* MAINTENANCE TAB */}
        {isAdmin() && (
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
          </TabsContent>
        )}

        {/* USERS TAB */}
        <TabsContent value="users" className="space-y-4">
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
                      disabled={!!editingUser}
                      data-testid="user-username"
                    />
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
                        {NIVEAUX_ACCES.map((n) => (
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

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Rechercher un utilisateur..."
              className="pl-9"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
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
                      if (!q) return true;
                      return (u.username || '').toLowerCase().includes(q)
                        || (u.full_name || '').toLowerCase().includes(q)
                        || (u.niveau_acces || '').toLowerCase().includes(q);
                    }).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary text-sm font-medium">{u.full_name?.charAt(0)}</span>
                            </div>
                            <span className="font-medium">{u.username}</span>
                            {u.id === currentUser?.id && <Badge variant="outline" className="text-xs">Vous</Badge>}
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
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Modifier" onClick={() => handleEditUser(u)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Réinitialiser mot de passe" onClick={() => {
                              setSelectedUserForReset(u);
                              setResetPasswordDialogOpen(true);
                            }}>
                              <Key className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Attribuer groupes" onClick={() => openAssignDialog(u)}>
                              <UserCog className="w-4 h-4" />
                            </Button>
                            {u.id !== currentUser?.id && (
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GROUPS TAB */}
        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={groupDialogOpen} onOpenChange={(open) => {
              setGroupDialogOpen(open);
              if (!open) {
                setGroupForm({ name: '', description: '', permissions: [] });
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
                    <Label>Permissions</Label>
                    <div className="border rounded-lg p-4 space-y-4 max-h-[300px] overflow-y-auto">
                      {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
                        <div key={category}>
                          <p className="font-medium text-sm mb-2">{category}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                            {perms.map(perm => (
                              <label key={perm} className="flex items-center gap-2 cursor-pointer text-sm">
                                <Checkbox
                                  checked={groupForm.permissions.includes(perm)}
                                  onCheckedChange={() => togglePermission(perm)}
                                />
                                <span className="text-muted-foreground">{perm.split('.')[1]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {groupForm.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {groupForm.permissions.map(p => (
                          <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                        ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups.map(group => (
                <Card key={group.id} className="card-hover">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        {group.name}
                      </span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" title="Gérer les membres" onClick={() => openMembersDialog(group)}>
                          <UserCog className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleEditGroup(group)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(group.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardTitle>
                    {group.description && (
                      <CardDescription>{group.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        className="cursor-pointer"
                        onClick={() => openMembersDialog(group)}
                        title="Voir / modifier les membres"
                      >
                        <Badge variant="outline" className="hover:bg-muted"><Users className="w-3 h-3 mr-1" />{group.members_count} membre(s)</Badge>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(group.permissions || []).slice(0, 6).map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                      {(group.permissions || []).length > 6 && (
                        <Badge variant="outline" className="text-xs">+{group.permissions.length - 6}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DROITS D'ACCÈS TAB */}
        {isSuperAdmin() && (
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
        <TabsContent value="logs" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={fetchData}>
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

        {/* SUPERVISION TAB */}
        {isAdmin() && (
          <TabsContent value="supervision" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={fetchSystemStatus} disabled={systemStatusLoading}>
                {systemStatusLoading
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <RefreshCw className="w-4 h-4 mr-2" />}
                Actualiser
              </Button>
            </div>

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
                  <CardHeader>
                    <CardTitle>Détail par catégorie</CardTitle>
                    <CardDescription>Ce qui prend le plus de place, du plus gros au plus petit.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Catégorie</TableHead>
                          <TableHead>Éléments</TableHead>
                          <TableHead>Taille</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(systemStatus.collections || []).filter((c) => c.count > 0).map((c) => (
                          <TableRow key={c.name}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground">{c.count.toLocaleString('fr-FR')}</TableCell>
                            <TableCell className="text-muted-foreground">{formatBytes(c.size_bytes)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                      Dernier nettoyage automatique des logs : {systemStatus.last_logs_purge ? systemStatus.last_logs_purge : 'jamais'}.
                      Un nettoyage automatique des logs de plus de 12 mois tourne aussi chaque début de mois.
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
                      <p className="font-medium text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Logs (+12 mois)</p>
                      <p className="text-xs text-muted-foreground">Purge manuelle immédiate des journaux d'activité de plus de 12 mois.</p>
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
                  </CardContent>
                </Card>

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
              {selectedGroupForMembers && `Sélectionnez les membres de « ${selectedGroupForMembers.name} »`}
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
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <Checkbox
                      checked={selectedMemberUserIds.includes(u.id)}
                      onCheckedChange={() => {
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
              <Button onClick={handleUpdateGroupMembers} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
