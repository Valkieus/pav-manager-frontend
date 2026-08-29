import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
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
import { toast } from 'sonner';
import {
  Plus,
  Users,
  Loader2,
  Search,
  IdCard,
  Edit,
  Archive,
  Trash2,
  Settings,
  X,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Download
} from 'lucide-react';
import { invalidateTechniciensCache } from '../lib/technicienCache';
import TeamAbsenceDashboard from './TeamAbsenceDashboard';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Couleurs distinctives par branche
const BRANCH_COLORS = {
  'Live': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-700', dot: 'bg-red-500' },
  'Post-Prod': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700', dot: 'bg-blue-500' },
  'Studio': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-700', dot: 'bg-purple-500' },
  'Technique': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700', dot: 'bg-amber-500' },
  'Production': { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700', dot: 'bg-emerald-500' },
  'Diffusion': { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-700', dot: 'bg-cyan-500' },
  'Animation': { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700', dot: 'bg-orange-500' },
  'Coordination': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-300 dark:border-indigo-700', dot: 'bg-indigo-500' },
  'Supervision': { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-700 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-700', dot: 'bg-slate-500' },
  'Régisseurs': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-500' },
  'Logistique': { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-300 dark:border-pink-700', dot: 'bg-pink-500' },
};

const getBranchColor = (branche) => BRANCH_COLORS[branche] || { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-500' };

export default function Effectif() {
  const { canManage, isAdmin, isSuperAdmin, isAdminOrReadOnly, isGestionnairePlus, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenedTechRef = useRef(false);
  const [techniciens, setTechniciens] = useState([]);
  const [enums, setEnums] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranche, setFilterBranche] = useState('all');
  const [filterBadge, setFilterBadge] = useState('all'); // 'all' | 'avec' | 'sans' — KPI badge (#302)
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    niveau_technicien: '',
    niveau_acces: '',
    branches: [],
    sous_branches: [],
    poste_principal: '',
    postes_secondaires: [],
    organigramme_label: '',
    badge_attribue: false,
    telephone: '',
    email: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Deep-link support : arriver sur /effectif?tech=<id> (depuis l'organigramme
  // du Dashboard, ou toute autre page) ouvre directement la fiche de cette
  // personne, une fois la liste chargée. Ne se déclenche qu'une seule fois.
  useEffect(() => {
    if (autoOpenedTechRef.current || loading) return;
    const techId = searchParams.get('tech');
    if (!techId) return;
    autoOpenedTechRef.current = true;
    const found = techniciens.find((t) => t.id === techId);
    if (found) {
      setSelectedTech(found);
    } else {
      toast.error("Fiche technicien introuvable, ou hors de ta portée d'accès.");
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tech');
      return next;
    }, { replace: true });
  }, [loading, techniciens, searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      const [techRes, enumsRes] = await Promise.all([
        axios.get(`${API}/techniciens`),
        axios.get(`${API}/enums`)
      ]);
      let list = techRes.data;
      // Gestionnaire/Responsable users with an assigned branch scope only
      // see their own branch(es) here; Admin/Super Admin (and Responsables
      // with no branch assigned) see the full Effectif.
      if (!isAdminOrReadOnly() && user?.branches?.length) {
        list = list.filter((t) => (t.branches || []).some((b) => user.branches.includes(b)));
      }
      setTechniciens(list);
      setEnums(enumsRes.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = useCallback(() => {
    setForm({
      nom: '', prenom: '', niveau_technicien: '', niveau_acces: '',
      branches: [], sous_branches: [], poste_principal: '', postes_secondaires: [], organigramme_label: '',
      badge_attribue: false, telephone: '', email: ''
    });
    setEditingId(null);
  }, []);

  const handleCardClick = useCallback((tech) => {
    setSelectedTech(tech);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTech(null);
  }, []);

  const handleEdit = useCallback((tech) => {
    setForm({
      nom: tech.nom,
      prenom: tech.prenom || '',
      niveau_technicien: tech.niveau_technicien || '',
      niveau_acces: tech.niveau_acces,
      branches: tech.branches || [],
      sous_branches: tech.sous_branches || [],
      poste_principal: tech.poste_principal || '',
      postes_secondaires: tech.postes_secondaires || [],
      organigramme_label: tech.organigramme_label || '',
      badge_attribue: tech.badge_attribue,
      telephone: tech.telephone || '',
      email: tech.email || ''
    });
    setEditingId(tech.id);
    setSelectedTech(null);
    setDialogOpen(true);
  }, []);

  const togglePosteSecondaire = (poste) => {
    setForm(prev => ({
      ...prev,
      postes_secondaires: prev.postes_secondaires.includes(poste)
        ? prev.postes_secondaires.filter(p => p !== poste)
        : [...prev.postes_secondaires, poste]
    }));
  };

  const toggleBranche = (branche) => {
    setForm(prev => {
      const newBranches = prev.branches.includes(branche)
        ? prev.branches.filter(b => b !== branche)
        : [...prev.branches, branche];
      // Dropping "Live" clears any sous-branches selected (they only apply to Live)
      const newSousBranches = newBranches.includes('Live') ? prev.sous_branches : [];
      return { ...prev, branches: newBranches, sous_branches: newSousBranches };
    });
  };

  const toggleSousBranche = (sb) => {
    setForm(prev => ({
      ...prev,
      sous_branches: prev.sous_branches.includes(sb)
        ? prev.sous_branches.filter(s => s !== sb)
        : [...prev.sous_branches, sb]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.branches.length === 0) {
      toast.error('Veuillez sélectionner au moins une branche');
      return;
    }
    setSubmitting(true);
    try {
      const data = { ...form, sous_branches: form.branches.includes('Live') ? form.sous_branches : [] };
      if (editingId) {
        await axios.put(`${API}/techniciens/${editingId}`, data);
        toast.success('Technicien modifié');
      } else {
        const res = await axios.post(`${API}/techniciens`, data);
        if (res.data.is_pending_approval) {
          toast.success('Fiche soumise à la Coordination pour validation');
        } else {
          toast.success('Technicien créé');
        }
      }
      setDialogOpen(false);
      resetForm();
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archiver ce technicien ?')) return;
    try {
      await axios.put(`${API}/techniciens/${id}/archive`);
      toast.success('Technicien archivé');
      setSelectedTech(null);
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer définitivement ce technicien ?')) return;
    try {
      await axios.delete(`${API}/techniciens/${id}`);
      toast.success('Technicien supprimé');
      setSelectedTech(null);
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // ---- Postes management (add / rename / delete the poste taxonomy) ----
  const [posteManagerOpen, setPosteManagerOpen] = useState(false);
  const [newPosteLabel, setNewPosteLabel] = useState('');
  const [renamingPoste, setRenamingPoste] = useState(null); // { old, value }
  const [posteBusy, setPosteBusy] = useState(false);

  const handleAddPoste = async () => {
    const label = newPosteLabel.trim();
    if (!label) return;
    setPosteBusy(true);
    try {
      const res = await axios.post(`${API}/postes`, { label });
      setEnums(prev => ({ ...prev, postes: res.data.postes }));
      setNewPosteLabel('');
      invalidateTechniciensCache();
      toast.success('Poste ajouté');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPosteBusy(false);
    }
  };

  const handleRenamePosteSave = async () => {
    if (!renamingPoste) return;
    const newLabel = renamingPoste.value.trim();
    if (!newLabel) return;
    setPosteBusy(true);
    try {
      const res = await axios.put(`${API}/postes/${encodeURIComponent(renamingPoste.old)}`, { new_label: newLabel });
      setEnums(prev => ({ ...prev, postes: res.data.postes }));
      setRenamingPoste(null);
      toast.success('Poste renommé');
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPosteBusy(false);
    }
  };

  const handleDeletePoste = async (label) => {
    if (!window.confirm(`Supprimer le poste « ${label} » ? Il sera retiré des fiches qui l'utilisent.`)) return;
    setPosteBusy(true);
    try {
      const res = await axios.delete(`${API}/postes/${encodeURIComponent(label)}`);
      setEnums(prev => ({ ...prev, postes: res.data.postes }));
      toast.success('Poste supprimé');
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPosteBusy(false);
    }
  };

  // ---- Fiches techniciens proposées par un Responsable, en attente de
  // validation Coordination (Gestionnaire+) avant d'intégrer l'effectif ----
  const canApproveTechniciens = () => ['Super Admin', 'Admin', 'Gestionnaire'].includes(user?.niveau_acces);
  const [pendingManagerOpen, setPendingManagerOpen] = useState(false);
  const [pendingTechs, setPendingTechs] = useState([]);
  const [pendingTechsLoading, setPendingTechsLoading] = useState(false);
  const [pendingActionBusy, setPendingActionBusy] = useState(null);
  const [rejectingPendingId, setRejectingPendingId] = useState(null);
  const [pendingRejectMessage, setPendingRejectMessage] = useState('');

  const fetchPendingTechs = async () => {
    setPendingTechsLoading(true);
    try {
      const res = await axios.get(`${API}/techniciens/pending`);
      setPendingTechs(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement des fiches en attente');
    } finally {
      setPendingTechsLoading(false);
    }
  };

  useEffect(() => {
    if (canApproveTechniciens()) fetchPendingTechs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingManagerOpen) fetchPendingTechs();
  }, [pendingManagerOpen]);

  const handleApprovePending = async (techId) => {
    setPendingActionBusy(techId);
    try {
      await axios.post(`${API}/techniciens/${techId}/approve`);
      toast.success('Fiche validée et ajoutée à l\'effectif');
      setPendingTechs((prev) => prev.filter((t) => t.id !== techId));
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPendingActionBusy(null);
    }
  };

  const handleRejectPending = async (techId) => {
    setPendingActionBusy(techId);
    try {
      await axios.post(`${API}/techniciens/${techId}/reject`, { message: pendingRejectMessage || null });
      toast.success('Fiche rejetée');
      setPendingTechs((prev) => prev.filter((t) => t.id !== techId));
      setRejectingPendingId(null);
      setPendingRejectMessage('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPendingActionBusy(null);
    }
  };

  // ---- Gestion des badges — Gestionnaire+ (fusionné dans la fiche technicien) ----
  // Explicitly excludes Responsable (visibilité badge retirée des droits Responsable).
  const canManageBadges = () => ['Super Admin', 'Admin', 'Gestionnaire'].includes(user?.niveau_acces);
  const [badgeDetail, setBadgeDetail] = useState(null);
  const [badgeDetailLoading, setBadgeDetailLoading] = useState(false);
  const [badgeActionBusy, setBadgeActionBusy] = useState(false);
  const [rejectingBadge, setRejectingBadge] = useState(false);
  const [rejectMessage, setRejectMessage] = useState('');
  const [editingExpiration, setEditingExpiration] = useState(false);
  const [expirationDraft, setExpirationDraft] = useState('');

  const fetchBadgeDetail = async (technicienId) => {
    setBadgeDetailLoading(true);
    try {
      const res = await axios.get(`${API}/admin/badges/technicien/${technicienId}`);
      setBadgeDetail(res.data);
      setExpirationDraft(res.data.badge_expiration_date || '');
    } catch (err) {
      setBadgeDetail(null);
    } finally {
      setBadgeDetailLoading(false);
    }
  };

  // Charge le détail badge dès qu'une fiche technicien est ouverte par un
  // profil habilité (Gestionnaire+) — remplace l'ancienne liste globale de
  // demandes par une vue centrée sur la personne, fusionnée dans la fiche.
  useEffect(() => {
    if (selectedTech && canManageBadges()) {
      fetchBadgeDetail(selectedTech.id);
    } else {
      setBadgeDetail(null);
    }
    setRejectingBadge(false);
    setRejectMessage('');
    setEditingExpiration(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTech]);

  const refreshBadgeAndList = () => {
    if (selectedTech) fetchBadgeDetail(selectedTech.id);
    fetchData();
  };

  const handleConfirmBadge = async () => {
    if (!badgeDetail?.user_id) return;
    setBadgeActionBusy(true);
    try {
      await axios.post(`${API}/admin/badges/${badgeDetail.user_id}/confirm`);
      toast.success('Photo validée — badge prêt à récupérer.');
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleRejectBadge = async () => {
    if (!badgeDetail?.user_id) return;
    if (!rejectMessage.trim()) {
      toast.error('Merci de préciser le motif pour le technicien');
      return;
    }
    setBadgeActionBusy(true);
    try {
      await axios.post(`${API}/admin/badges/${badgeDetail.user_id}/reject`, { message: rejectMessage.trim() });
      toast.success('Photo signalée comme non conforme');
      setRejectingBadge(false);
      setRejectMessage('');
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleCollectBadge = async () => {
    if (!badgeDetail?.user_id) return;
    setBadgeActionBusy(true);
    try {
      await axios.post(`${API}/admin/badges/${badgeDetail.user_id}/collect`, expirationDraft ? { expiration_date: expirationDraft } : {});
      toast.success('Badge marqué comme remis au technicien');
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleArchiveBadge = async (archive) => {
    if (!badgeDetail?.user_id) return;
    setBadgeActionBusy(true);
    try {
      await axios.post(`${API}/admin/badges/${badgeDetail.user_id}/${archive ? 'archive' : 'unarchive'}`);
      toast.success(archive ? 'Demande archivée' : 'Demande désarchivée');
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleDeleteBadge = async () => {
    if (!badgeDetail?.user_id) return;
    if (!window.confirm('Supprimer définitivement cette demande de badge ? Photo, statut et historique de revue seront effacés — irréversible.')) return;
    setBadgeActionBusy(true);
    try {
      await axios.delete(`${API}/admin/badges/${badgeDetail.user_id}`);
      toast.success('Demande supprimée définitivement');
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleSaveExpiration = async () => {
    if (!selectedTech) return;
    setBadgeActionBusy(true);
    try {
      await axios.put(`${API}/admin/badges/technicien/${selectedTech.id}/expiration`, { expiration_date: expirationDraft || null });
      toast.success('Date de renouvellement mise à jour');
      setEditingExpiration(false);
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const getBadgeStatusInfo = (status) => {
    switch (status) {
      case 'en_attente_validation':
        return { label: 'En attente de validation', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock };
      case 'non_conforme':
        return { label: 'Photo non conforme', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle };
      case 'pret_a_recuperer':
        return { label: 'Prêt à récupérer', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2 };
      case 'recupere':
        return { label: 'Remis au technicien', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 };
      default:
        return { label: status || 'Aucune demande', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: Clock };
    }
  };

  const getNiveauColor = (niveau) => {
    const colors = {
      'Novice': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      'Débutant': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'Intermédiaire': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Confirmé': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Expert': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400'
    };
    return colors[niveau] || colors['Novice'];
  };

  const getAccesColor = (acces) => {
    const colors = {
      'Technicien': 'bg-gray-500',
      'Gestionnaire': 'bg-green-500',
      'Responsable': 'bg-blue-500',
      'Admin': 'bg-orange-500',
      'Super Admin': 'bg-red-500'
    };
    return colors[acces] || colors['Technicien'];
  };

  // Comptage par branche pour l'overview
  const branchCounts = useMemo(() => {
    const counts = {};
    techniciens.forEach(t => {
      (t.branches || []).forEach(b => {
        counts[b] = (counts[b] || 0) + 1;
      });
    });
    return counts;
  }, [techniciens]);

  // KPI badges (tâche #302) : qui a / n'a pas de badge, tous rôles/branches
  // confondus dans la liste déjà chargée (donc déjà scopée par branche pour
  // un Responsable/Gestionnaire limité — cf. #292). "en_attente" = une
  // demande de badge est en cours de validation (badge_status), distinct de
  // badge_attribue qui reflète l'attribution réelle sur la fiche.
  const badgeCounts = useMemo(() => {
    let avec = 0, sans = 0, enAttente = 0;
    techniciens.forEach(t => {
      if (t.badge_attribue) avec++;
      else sans++;
      if (t.badge_status === 'en_attente_validation') enAttente++;
    });
    return { avec, sans, enAttente, total: techniciens.length };
  }, [techniciens]);

  const filteredTechniciens = useMemo(() => {
    return techniciens.filter(t => {
      const matchSearch = t.nom.toLowerCase().includes(searchTerm.toLowerCase());
      const branches = t.branches || [];
      const matchBranche = filterBranche === 'all' || branches.includes(filterBranche);
      const matchBadge = filterBadge === 'all'
        || (filterBadge === 'avec' && t.badge_attribue)
        || (filterBadge === 'sans' && !t.badge_attribue);
      return matchSearch && matchBranche && matchBadge;
    });
  }, [techniciens, searchTerm, filterBranche, filterBadge]);

  return (
    <div className="space-y-6" data-testid="effectif-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Effectif</h1>
          <p className="text-muted-foreground">Gestion des techniciens ({filteredTechniciens.length})</p>
        </div>

        <div className="flex flex-wrap gap-2">
        {canApproveTechniciens() && (
          <Dialog open={pendingManagerOpen} onOpenChange={setPendingManagerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="relative">
                <Send className="w-4 h-4 mr-2" />
                Fiches à valider
                {pendingTechs.length > 0 && (
                  <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">{pendingTechs.length}</Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Fiches techniciens à valider</DialogTitle>
                <DialogDescription>
                  Fiches proposées par un Responsable — elles n'intègrent l'effectif qu'après validation.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-3">
                {pendingTechsLoading ? (
                  <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : pendingTechs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">Aucune fiche en attente</p>
                ) : (
                  pendingTechs.map((t) => (
                    <div key={t.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{t.nom}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Proposée par {t.proposed_by_name || 'un Responsable'}
                          </p>
                        </div>
                        <Badge variant="outline">{t.branches?.join(', ')}</Badge>
                      </div>
                      {rejectingPendingId === t.id ? (
                        <div className="space-y-2">
                          <Label className="text-xs">Motif (optionnel)</Label>
                          <Input
                            value={pendingRejectMessage}
                            onChange={(e) => setPendingRejectMessage(e.target.value)}
                            placeholder="Motif du rejet..."
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={pendingActionBusy === t.id}
                              onClick={() => handleRejectPending(t.id)}
                            >
                              Confirmer le rejet
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRejectingPendingId(null); setPendingRejectMessage(''); }}>
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={pendingActionBusy === t.id}
                            onClick={() => handleApprovePending(t.id)}
                          >
                            {pendingActionBusy === t.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            onClick={() => { setRejectingPendingId(t.id); setPendingRejectMessage(''); }}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Rejeter
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
        {/* Tâche #295 : dashboard des absences d'équipe — Responsable et
            Gestionnaire+ (le filtrage par équipe/branche est déjà fait
            côté serveur, voir GET /absences). */}
        {['Responsable', 'Gestionnaire', 'Admin', 'Admin (lecture seule)', 'Super Admin'].includes(user?.niveau_acces) && (
          <TeamAbsenceDashboard
            scopeLabel={
              user?.niveau_acces === 'Responsable' && user?.branches?.length
                ? `Absences déclarées par les membres de : ${user.branches.join(', ')}.`
                : "Absences déclarées par l'ensemble de l'effectif, pour le mois sélectionné."
            }
          />
        )}
        {(isAdmin() || isSuperAdmin()) && (
          <Dialog open={posteManagerOpen} onOpenChange={(open) => { setPosteManagerOpen(open); if (!open) { setNewPosteLabel(''); setRenamingPoste(null); } }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Gérer les postes
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Gérer les postes</DialogTitle>
                <DialogDescription>Ajoutez, renommez ou supprimez les postes principal/secondaires proposés sur les fiches.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(enums.postes || []).map((p) => (
                  <div key={p} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                    {renamingPoste?.old === p ? (
                      <>
                        <Input
                          className="h-8"
                          value={renamingPoste.value}
                          onChange={(e) => setRenamingPoste({ ...renamingPoste, value: e.target.value })}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={posteBusy} onClick={handleRenamePosteSave}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRenamingPoste(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm truncate">{p}</span>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRenamingPoste({ old: p, value: p })}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" disabled={posteBusy} onClick={() => handleDeletePoste(p)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                {(enums.postes || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun poste défini.</p>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Input
                  placeholder="Nouveau poste..."
                  value={newPosteLabel}
                  onChange={(e) => setNewPosteLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPoste(); } }}
                />
                <Button onClick={handleAddPoste} disabled={posteBusy || !newPosteLabel.trim()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {canManage() && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" data-testid="add-tech-btn">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} un technicien</DialogTitle>
                <DialogDescription>Remplissez les informations</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input
                    value={form.nom}
                    onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Niveau Technicien</Label>
                    <Select value={form.niveau_technicien} onValueChange={(v) => setForm({ ...form, niveau_technicien: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner (optionnel)" /></SelectTrigger>
                      <SelectContent>
                        {enums.niveaux_technicien?.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Niveau d'Accès *</Label>
                    <Select value={form.niveau_acces} onValueChange={(v) => setForm({ ...form, niveau_acces: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {enums.niveaux_acces?.map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Multiple Branches Selection */}
                <div className="space-y-2">
                  <Label>Branches * (plusieurs possibles)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                    {(
                      // Un Responsable/Gestionnaire scopé à une ou plusieurs branches
                      // (User.branches) ne peut créer/éditer que dans son propre
                      // périmètre — le backend le refuse désormais aussi (tâche #292),
                      // donc on ne propose ici que les branches réellement utilisables
                      // pour éviter un 403 confus après coup.
                      (!isAdminOrReadOnly() && user?.branches?.length)
                        ? enums.branches?.filter((b) => user.branches.includes(b))
                        : enums.branches
                    )?.map((b) => (
                      <div key={b} className="flex items-center space-x-2">
                        <Checkbox
                          id={`branch-${b}`}
                          checked={form.branches.includes(b)}
                          onCheckedChange={() => toggleBranche(b)}
                        />
                        <Label htmlFor={`branch-${b}`} className="text-sm cursor-pointer">{b}</Label>
                      </div>
                    ))}
                  </div>
                  {form.branches.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.branches.map(b => (
                        <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Poste(s) de prédilection — used to filter the Planning
                    assignment dropdown to only relevant people (independent
                    of branche, so exceptions are just an extra tick here). */}
                <div className="space-y-2">
                  <Label>Poste principal</Label>
                  <Select value={form.poste_principal || '__none__'} onValueChange={(v) => setForm({ ...form, poste_principal: v === '__none__' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner (optionnel)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun</SelectItem>
                      {enums.postes?.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Postes secondaires (plusieurs possibles)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30 max-h-40 overflow-y-auto">
                    {enums.postes?.filter((p) => p !== form.poste_principal).map((p) => (
                      <div key={p} className="flex items-center space-x-2">
                        <Checkbox
                          id={`poste-${p}`}
                          checked={form.postes_secondaires.includes(p)}
                          onCheckedChange={() => togglePosteSecondaire(p)}
                        />
                        <Label htmlFor={`poste-${p}`} className="text-sm cursor-pointer">{p}</Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dans le Planning, la liste des noms proposée pour un poste ne montrera que les personnes ayant ce poste en principal ou secondaire.
                  </p>
                </div>

                {isGestionnairePlus() && (
                  <div className="space-y-2">
                    <Label>Étiquette dans l'organigramme (optionnel)</Label>
                    <Input
                      value={form.organigramme_label}
                      onChange={(e) => setForm({ ...form, organigramme_label: e.target.value })}
                      placeholder={form.poste_principal || 'Par défaut : poste principal'}
                    />
                    <p className="text-xs text-muted-foreground">
                      Réservé à Gestionnaire+. Contrôle le petit badge affiché à côté de son nom dans l'organigramme du Dashboard. Laisse vide pour reprendre automatiquement le poste principal.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input
                      value={form.telephone}
                      onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="badge"
                    checked={form.badge_attribue}
                    onCheckedChange={(checked) => setForm({ ...form, badge_attribue: checked })}
                  />
                  <Label htmlFor="badge" className="text-sm">Badge attribué</Label>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingId ? 'Modifier' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      </div>

      {/* KPI badges (tâche #302) — vue d'ensemble qui a / n'a pas de badge.
          Cliquer une carte filtre la liste ; recliquer revient à "tous". */}
      {!loading && canManageBadges() && badgeCounts.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card
            onClick={() => setFilterBadge(filterBadge === 'avec' ? 'all' : 'avec')}
            className={`bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filterBadge === 'avec' ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
          >
            <CardContent className="p-3 text-center">
              <IdCard className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
              <p className="font-semibold text-lg text-emerald-700 dark:text-emerald-400">{badgeCounts.avec}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 opacity-80">Avec badge</p>
            </CardContent>
          </Card>
          <Card
            onClick={() => setFilterBadge(filterBadge === 'sans' ? 'all' : 'sans')}
            className={`bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${filterBadge === 'sans' ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
          >
            <CardContent className="p-3 text-center">
              <IdCard className="w-4 h-4 mx-auto mb-1 text-amber-600" />
              <p className="font-semibold text-lg text-amber-700 dark:text-amber-400">{badgeCounts.sans}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 opacity-80">Sans badge</p>
            </CardContent>
          </Card>
          {badgeCounts.enAttente > 0 && (
            <Card className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <CardContent className="p-3 text-center">
                <Send className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <p className="font-semibold text-lg text-blue-700 dark:text-blue-400">{badgeCounts.enAttente}</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 opacity-80">Demande(s) en attente</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Overview par branche — cliquer une carte filtre la liste sur cette
          branche ; recliquer la même carte revient à "toutes les branches". */}
      {!loading && Object.keys(branchCounts).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(branchCounts).map(([branche, count]) => {
            const colors = getBranchColor(branche);
            const isActive = filterBranche === branche;
            return (
              <Card
                key={branche}
                onClick={() => setFilterBranche(isActive ? 'all' : branche)}
                className={`${colors.bg} border ${colors.border} cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${isActive ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
              >
                <CardContent className="p-3 text-center">
                  <div className={`w-3 h-3 rounded-full ${colors.dot} mx-auto mb-1`} />
                  <p className={`font-semibold text-lg ${colors.text}`}>{count}</p>
                  <p className={`text-xs ${colors.text} opacity-80`}>{branche}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterBranche} onValueChange={setFilterBranche}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Toutes les branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les branches</SelectItem>
            {enums.branches?.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredTechniciens.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun technicien trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredTechniciens.map((tech) => {
            const mainBranch = (tech.branches || [])[0];
            const branchColor = getBranchColor(mainBranch);
            return (
              <Card 
                key={tech.id} 
                className={`cursor-pointer card-hover border-l-4 ${branchColor.border}`}
                onClick={() => handleCardClick(tech)}
                data-testid={`tech-card-${tech.id}`}
              >
                <CardContent className="p-4 text-center">
                  <div className={`w-12 h-12 mx-auto rounded-full ${branchColor.bg} flex items-center justify-center mb-3`}>
                    <span className={`${branchColor.text} font-semibold text-lg`}>
                      {tech.nom.charAt(0)}
                    </span>
                  </div>
                  <p className="font-medium text-sm truncate">{tech.nom}</p>
                  {/* Colored branch "bubble" — the branch name itself, not just
                      a color, so it's identifiable at a glance without having
                      to open the card or filter by branch first. */}
                  <div className="mt-2 flex justify-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium truncate max-w-full ${branchColor.bg} ${branchColor.text} ${branchColor.border}`}
                      title={(tech.branches || []).join(', ') || 'Aucune branche'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${branchColor.dot}`} />
                      <span className="truncate">{mainBranch || 'Sans branche'}</span>
                      {(tech.branches || []).length > 1 && (
                        <span className="shrink-0">+{tech.branches.length - 1}</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-center items-center gap-2">
                    <IdCard className={`w-4 h-4 ${tech.badge_attribue ? 'text-emerald-500' : 'text-muted-foreground/30'}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedTech} onOpenChange={handleCloseDetail}>
        <DialogContent className="max-w-md">
          {selectedTech && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold text-xl">
                      {selectedTech.nom.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg">{selectedTech.nom}</p>
                    <p className="text-sm font-normal text-muted-foreground">
                      {(selectedTech.branches || []).join(', ') || 'Aucune branche'}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedTech.niveau_technicien && (
                    <Badge className={getNiveauColor(selectedTech.niveau_technicien)}>
                      {selectedTech.niveau_technicien}
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${getAccesColor(selectedTech.niveau_acces)}`} />
                    {selectedTech.niveau_acces}
                  </Badge>
                </div>

                {/* Show all branches with colors */}
                {(selectedTech.branches || []).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Branches</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTech.branches.map(b => {
                        const colors = getBranchColor(b);
                        return (
                          <Badge key={b} className={`${colors.bg} ${colors.text} border ${colors.border}`}>
                            <span className={`w-2 h-2 rounded-full ${colors.dot} mr-1`} />
                            {b}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Poste(s) de prédilection */}
                {(selectedTech.poste_principal || (selectedTech.postes_secondaires || []).length > 0) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Poste(s)</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTech.poste_principal && (
                        <Badge className="bg-primary/10 text-primary border border-primary/30">
                          {selectedTech.poste_principal}
                        </Badge>
                      )}
                      {(selectedTech.postes_secondaires || []).map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <IdCard className="w-4 h-4" /> Badge
                    </p>
                    {!canManageBadges() && (
                      <Badge className={selectedTech.badge_attribue ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : ''} variant={selectedTech.badge_attribue ? undefined : 'outline'}>
                        {selectedTech.badge_attribue ? 'Attribué' : 'Non attribué'}
                      </Badge>
                    )}
                  </div>

                  {!canManageBadges() ? (
                    selectedTech.badge_attribue && selectedTech.badge_expiration_date && (
                      <p className="text-xs text-muted-foreground">
                        Expire le {new Date(selectedTech.badge_expiration_date).toLocaleDateString('fr-FR')}
                      </p>
                    )
                  ) : badgeDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                    </div>
                  ) : badgeDetail && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={getBadgeStatusInfo(badgeDetail.badge_status).color}>
                          {getBadgeStatusInfo(badgeDetail.badge_status).label}
                        </Badge>
                        {badgeDetail.badge_is_renewal && <Badge variant="outline">Renouvellement</Badge>}
                        {badgeDetail.badge_archived && <Badge variant="outline">Archivée</Badge>}
                      </div>

                      {badgeDetail.badge_photo_url && (
                        <div className="flex items-center gap-3">
                          <img
                            src={`${process.env.REACT_APP_BACKEND_URL}${badgeDetail.badge_photo_url}`}
                            alt="Photo badge"
                            className="w-16 h-16 rounded-lg object-cover border"
                          />
                          <a
                            href={`${process.env.REACT_APP_BACKEND_URL}${badgeDetail.badge_photo_url}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Voir / télécharger
                          </a>
                        </div>
                      )}

                      {badgeDetail.badge_message && (
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          Motif du dernier refus : {badgeDetail.badge_message}
                        </p>
                      )}

                      {badgeDetail.badge_status === 'en_attente_validation' && (
                        rejectingBadge ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full text-sm border rounded-md p-2 bg-background"
                              rows={2}
                              placeholder="Motif du refus (envoyé au technicien)..."
                              value={rejectMessage}
                              onChange={(e) => setRejectMessage(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" disabled={badgeActionBusy} onClick={handleRejectBadge}>
                                {badgeActionBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Confirmer le refus
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setRejectingBadge(false); setRejectMessage(''); }}>Annuler</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            <Button size="sm" disabled={badgeActionBusy} onClick={handleConfirmBadge}>
                              {badgeActionBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              <Check className="w-4 h-4 mr-1" /> Valider la photo
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectingBadge(true)}>
                              <X className="w-4 h-4 mr-1" /> Refuser
                            </Button>
                          </div>
                        )
                      )}

                      {badgeDetail.badge_status === 'pret_a_recuperer' && (
                        <Button size="sm" disabled={badgeActionBusy} onClick={handleCollectBadge}>
                          {badgeActionBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <IdCard className="w-4 h-4 mr-1" /> Marquer comme remis
                        </Button>
                      )}

                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Expire le</Label>
                        {editingExpiration ? (
                          <>
                            <Input type="date" className="h-8 text-sm w-auto" value={expirationDraft || ''} onChange={(e) => setExpirationDraft(e.target.value)} />
                            <Button size="sm" disabled={badgeActionBusy} onClick={handleSaveExpiration}>
                              {badgeActionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditingExpiration(false); setExpirationDraft(badgeDetail.badge_expiration_date || ''); }}>Annuler</Button>
                          </>
                        ) : (
                          <>
                            <span className="text-sm">
                              {badgeDetail.badge_expiration_date ? new Date(badgeDetail.badge_expiration_date).toLocaleDateString('fr-FR') : 'Non renseignée'}
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => setEditingExpiration(true)}>
                              <Edit className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>

                      {badgeDetail.badge_status && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            size="sm" variant="ghost"
                            disabled={badgeActionBusy}
                            onClick={() => handleArchiveBadge(!badgeDetail.badge_archived)}
                          >
                            <Archive className="w-3.5 h-3.5 mr-1" /> {badgeDetail.badge_archived ? 'Désarchiver' : 'Archiver'}
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="text-destructive"
                            disabled={badgeActionBusy}
                            onClick={handleDeleteBadge}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {canManage() && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button variant="outline" className="flex-1" onClick={() => handleEdit(selectedTech)}>
                      <Edit className="w-4 h-4 mr-2" /> Modifier
                    </Button>
                    {isAdmin() && (
                      <Button variant="outline" onClick={() => handleArchive(selectedTech.id)}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                    {isSuperAdmin() && (
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(selectedTech.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
