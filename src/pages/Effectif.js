import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
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
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List as ListIcon,
  Phone,
  Mail,
  FilterX,
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  downloadOrShareFile,
  downloadStatusMessage,
  reserveTabForIOSFallback,
} from "../utils/fileDownload";
import { invalidateTechniciensCache } from "../lib/technicienCache";
import TeamAbsenceDashboard from "./TeamAbsenceDashboard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Couleurs distinctives par branche
const BRANCH_COLORS = {
  Live: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-300 dark:border-red-700",
    dot: "bg-red-500",
  },
  "Post-Prod": {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500",
  },
  Studio: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-300 dark:border-purple-700",
    dot: "bg-purple-500",
  },
  Technique: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  Production: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-300 dark:border-emerald-700",
    dot: "bg-emerald-500",
  },
  Diffusion: {
    bg: "bg-cyan-100 dark:bg-cyan-900/30",
    text: "text-cyan-700 dark:text-cyan-400",
    border: "border-cyan-300 dark:border-cyan-700",
    dot: "bg-cyan-500",
  },
  Animation: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-300 dark:border-orange-700",
    dot: "bg-orange-500",
  },
  Coordination: {
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-300 dark:border-indigo-700",
    dot: "bg-indigo-500",
  },
  Supervision: {
    bg: "bg-slate-100 dark:bg-slate-900/30",
    text: "text-slate-700 dark:text-slate-400",
    border: "border-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
  },
  Régisseurs: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-300 dark:border-pink-700",
    dot: "bg-pink-500",
  },
  Logistique: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-300 dark:border-pink-700",
    dot: "bg-pink-500",
  },
};

// Fenêtre « fiche » : centrée sur PC, plein écran sur téléphone (zones de sécurité iOS/Android respectées).
const SHEET_CLASS =
  "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:max-h-[90vh] sm:rounded-xl max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none";

const NIVEAU_ORDER = { Expert: 0, Confirmé: 1, Intermédiaire: 2, Débutant: 3, Novice: 4 };

const getBranchColor = (branche) =>
  BRANCH_COLORS[branche] || {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-300",
    dot: "bg-gray-500",
  };

export default function Effectif() {
  const {
    canManage,
    isAdmin,
    isSuperAdmin,
    isAdminOrReadOnly,
    isGestionnairePlus,
    user,
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoOpenedTechRef = useRef(false);
  const [techniciens, setTechniciens] = useState([]);
  const [enums, setEnums] = useState({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranche, setFilterBranche] = useState("all");
  const [filterBadge, setFilterBadge] = useState("all"); // 'all' | 'avec' | 'sans' — KPI badge (#302)
  // Présentation de la liste (mémorisée sur l'appareil) : cartes ou liste, tri, regroupement.
  const readPref = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const [viewMode, setViewMode] = useState(() => readPref("effectif_view", "cards"));
  const [sortBy, setSortBy] = useState(() => readPref("effectif_sort", "nom"));
  const [groupBy, setGroupBy] = useState(() => readPref("effectif_group", "none"));
  const savePref = (k, v, set) => { set(v); try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const [exportingListXlsx, setExportingListXlsx] = useState(false); // #578
  const [exportingFichePdf, setExportingFichePdf] = useState(false); // #578
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    niveau_technicien: "",
    niveau_acces: "",
    branches: [],
    sous_branches: [],
    poste_principal: "",
    postes_secondaires: [],
    organigramme_label: "",
    badge_attribue: false,
    telephone: "",
    email: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Deep-link support : arriver sur /effectif?tech=<id> (depuis l'organigramme
  // du Dashboard, ou toute autre page) ouvre directement la fiche de cette
  // personne, une fois la liste chargée. Ne se déclenche qu'une seule fois.
  useEffect(() => {
    if (autoOpenedTechRef.current || loading) return;
    const techId = searchParams.get("tech");
    if (!techId) return;
    autoOpenedTechRef.current = true;
    const found = techniciens.find((t) => t.id === techId);
    if (found) {
      setSelectedTech(found);
    } else {
      toast.error(
        "Fiche technicien introuvable, ou hors de ta portée d'accès.",
      );
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tech");
        return next;
      },
      { replace: true },
    );
  }, [loading, techniciens, searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      const [techRes, enumsRes] = await Promise.all([
        axios.get(`${API}/techniciens`),
        axios.get(`${API}/enums`),
      ]);
      let list = techRes.data;
      // Coordination/Responsable users with an assigned branch scope only
      // see their own branch(es) here; Admin/Super Admin (and Responsables
      // with no branch assigned) see the full Effectif.
      if (!isAdminOrReadOnly() && user?.branches?.length) {
        list = list.filter((t) =>
          (t.branches || []).some((b) => user.branches.includes(b)),
        );
      }
      setTechniciens(list);
      setEnums(enumsRes.data);
    } catch (err) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = useCallback(() => {
    setForm({
      nom: "",
      prenom: "",
      niveau_technicien: "",
      niveau_acces: "",
      branches: [],
      sous_branches: [],
      poste_principal: "",
      postes_secondaires: [],
      organigramme_label: "",
      badge_attribue: false,
      telephone: "",
      email: "",
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
      prenom: tech.prenom || "",
      niveau_technicien: tech.niveau_technicien || "",
      niveau_acces: tech.niveau_acces,
      branches: tech.branches || [],
      sous_branches: tech.sous_branches || [],
      poste_principal: tech.poste_principal || "",
      postes_secondaires: tech.postes_secondaires || [],
      organigramme_label: tech.organigramme_label || "",
      badge_attribue: tech.badge_attribue,
      telephone: tech.telephone || "",
      email: tech.email || "",
    });
    setEditingId(tech.id);
    setSelectedTech(null);
    setDialogOpen(true);
  }, []);

  const togglePosteSecondaire = (poste) => {
    setForm((prev) => ({
      ...prev,
      postes_secondaires: prev.postes_secondaires.includes(poste)
        ? prev.postes_secondaires.filter((p) => p !== poste)
        : [...prev.postes_secondaires, poste],
    }));
  };

  const toggleBranche = (branche) => {
    setForm((prev) => {
      const newBranches = prev.branches.includes(branche)
        ? prev.branches.filter((b) => b !== branche)
        : [...prev.branches, branche];
      // Dropping "Live" clears any sous-branches selected (they only apply to Live)
      const newSousBranches = newBranches.includes("Live")
        ? prev.sous_branches
        : [];
      return { ...prev, branches: newBranches, sous_branches: newSousBranches };
    });
  };

  const toggleSousBranche = (sb) => {
    setForm((prev) => ({
      ...prev,
      sous_branches: prev.sous_branches.includes(sb)
        ? prev.sous_branches.filter((s) => s !== sb)
        : [...prev.sous_branches, sb],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.branches.length === 0) {
      toast.error("Veuillez sélectionner au moins une branche");
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        ...form,
        sous_branches: form.branches.includes("Live") ? form.sous_branches : [],
      };
      if (editingId) {
        await axios.put(`${API}/techniciens/${editingId}`, data);
        toast.success("Technicien modifié");
      } else {
        const res = await axios.post(`${API}/techniciens`, data);
        if (res.data.is_pending_approval) {
          toast.success("Fiche soumise à la Coordination pour validation");
        } else {
          toast.success("Technicien créé");
        }
      }
      setDialogOpen(false);
      resetForm();
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm("Archiver ce technicien ?")) return;
    try {
      await axios.put(`${API}/techniciens/${id}/archive`);
      toast.success("Technicien archivé");
      setSelectedTech(null);
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer définitivement ce technicien ?")) return;
    try {
      await axios.delete(`${API}/techniciens/${id}`);
      toast.success("Technicien supprimé");
      setSelectedTech(null);
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  // ---- Postes management (add / rename / delete the poste taxonomy) ----
  const [posteManagerOpen, setPosteManagerOpen] = useState(false);
  const [newPosteLabel, setNewPosteLabel] = useState("");
  const [renamingPoste, setRenamingPoste] = useState(null); // { old, value }
  const [posteBusy, setPosteBusy] = useState(false);

  const handleAddPoste = async () => {
    const label = newPosteLabel.trim();
    if (!label) return;
    setPosteBusy(true);
    try {
      const res = await axios.post(`${API}/postes`, { label });
      setEnums((prev) => ({ ...prev, postes: res.data.postes }));
      setNewPosteLabel("");
      invalidateTechniciensCache();
      toast.success("Poste ajouté");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
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
      const res = await axios.put(`${API}/postes/rename`, {
        old_label: renamingPoste.old,
        new_label: newLabel,
      });
      setEnums((prev) => ({ ...prev, postes: res.data.postes }));
      setRenamingPoste(null);
      toast.success("Poste renommé");
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setPosteBusy(false);
    }
  };

  const handleDeletePoste = async (label) => {
    if (
      !window.confirm(
        `Supprimer le poste « ${label} » ? Il sera retiré des fiches qui l'utilisent.`,
      )
    )
      return;
    setPosteBusy(true);
    try {
      const res = await axios.post(`${API}/postes/delete`, { label });
      setEnums((prev) => ({ ...prev, postes: res.data.postes }));
      toast.success("Poste supprimé");
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setPosteBusy(false);
    }
  };

  // ---- Fiches techniciens proposées par un Responsable, en attente de
  // validation Coordination avant d'intégrer l'effectif ----
  const canApproveTechniciens = () =>
    ["Super Admin", "Admin", "Coordination"].includes(user?.niveau_acces);
  const [pendingManagerOpen, setPendingManagerOpen] = useState(false);
  const [pendingTechs, setPendingTechs] = useState([]);
  const [pendingTechsLoading, setPendingTechsLoading] = useState(false);
  const [pendingActionBusy, setPendingActionBusy] = useState(null);
  const [rejectingPendingId, setRejectingPendingId] = useState(null);
  const [pendingRejectMessage, setPendingRejectMessage] = useState("");

  const fetchPendingTechs = async () => {
    setPendingTechsLoading(true);
    try {
      const res = await axios.get(`${API}/techniciens/pending`);
      setPendingTechs(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement des fiches en attente");
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
      toast.success("Fiche validée et ajoutée à l'effectif");
      setPendingTechs((prev) => prev.filter((t) => t.id !== techId));
      invalidateTechniciensCache();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setPendingActionBusy(null);
    }
  };

  const handleRejectPending = async (techId) => {
    setPendingActionBusy(techId);
    try {
      await axios.post(`${API}/techniciens/${techId}/reject`, {
        message: pendingRejectMessage || null,
      });
      toast.success("Fiche rejetée");
      setPendingTechs((prev) => prev.filter((t) => t.id !== techId));
      setRejectingPendingId(null);
      setPendingRejectMessage("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setPendingActionBusy(null);
    }
  };

  // ---- Gestion des badges — Coordination+ (fusionné dans la fiche technicien) ----
  // Explicitly excludes Responsable (visibilité badge retirée des droits Responsable).
  const canManageBadges = () =>
    ["Super Admin", "Admin", "Coordination"].includes(user?.niveau_acces);
  const [badgeDetail, setBadgeDetail] = useState(null);
  const [badgeDetailLoading, setBadgeDetailLoading] = useState(false);
  const [badgeActionBusy, setBadgeActionBusy] = useState(false);
  const [rejectingBadge, setRejectingBadge] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");

  const fetchBadgeDetail = async (technicienId) => {
    setBadgeDetailLoading(true);
    try {
      const res = await axios.get(
        `${API}/admin/badges/technicien/${technicienId}`,
      );
      setBadgeDetail(res.data);
    } catch (err) {
      setBadgeDetail(null);
    } finally {
      setBadgeDetailLoading(false);
    }
  };

  // Charge le détail badge dès qu'une fiche technicien est ouverte par un
  // profil habilité (Coordination+) — remplace l'ancienne liste globale de
  // demandes par une vue centrée sur la personne, fusionnée dans la fiche.
  useEffect(() => {
    if (selectedTech && canManageBadges()) {
      fetchBadgeDetail(selectedTech.id);
    } else {
      setBadgeDetail(null);
    }
    setRejectingBadge(false);
    setRejectMessage("");
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
      toast.success("Photo validée — badge prêt à récupérer.");
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleRejectBadge = async () => {
    if (!badgeDetail?.user_id) return;
    if (!rejectMessage.trim()) {
      toast.error("Merci de préciser le motif pour le technicien");
      return;
    }
    setBadgeActionBusy(true);
    try {
      await axios.post(`${API}/admin/badges/${badgeDetail.user_id}/reject`, {
        message: rejectMessage.trim(),
      });
      toast.success("Photo signalée comme non conforme");
      setRejectingBadge(false);
      setRejectMessage("");
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleCollectBadge = async () => {
    if (!badgeDetail?.user_id) return;
    setBadgeActionBusy(true);
    try {
      await axios.post(`${API}/admin/badges/${badgeDetail.user_id}/collect`);
      toast.success("Badge marqué comme remis au technicien");
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleArchiveBadge = async (archive) => {
    if (!badgeDetail?.user_id) return;
    setBadgeActionBusy(true);
    try {
      await axios.post(
        `${API}/admin/badges/${badgeDetail.user_id}/${archive ? "archive" : "unarchive"}`,
      );
      toast.success(archive ? "Demande archivée" : "Demande désarchivée");
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const handleDeleteBadge = async () => {
    if (!badgeDetail?.user_id) return;
    if (
      !window.confirm(
        "Supprimer définitivement cette demande de badge ? Photo, statut et historique de revue seront effacés — irréversible.",
      )
    )
      return;
    setBadgeActionBusy(true);
    try {
      await axios.delete(`${API}/admin/badges/${badgeDetail.user_id}`);
      toast.success("Demande supprimée définitivement");
      refreshBadgeAndList();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setBadgeActionBusy(false);
    }
  };

  const getBadgeStatusInfo = (status) => {
    switch (status) {
      case "en_attente_validation":
        return {
          label: "En attente de validation",
          color:
            "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
          icon: Clock,
        };
      case "non_conforme":
        return {
          label: "Photo non conforme",
          color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          icon: XCircle,
        };
      case "pret_a_recuperer":
        return {
          label: "Prêt à récupérer",
          color:
            "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          icon: CheckCircle2,
        };
      case "recupere":
        return {
          label: "Remis au technicien",
          color:
            "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
          icon: CheckCircle2,
        };
      default:
        return {
          label: status || "Aucune demande",
          color:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
          icon: Clock,
        };
    }
  };

  const getNiveauColor = (niveau) => {
    const colors = {
      Novice: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      Débutant:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      Intermédiaire:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      Confirmé:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
      Expert:
        "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
    };
    return colors[niveau] || colors["Novice"];
  };

  const getAccesColor = (acces) => {
    const colors = {
      Technicien: "bg-gray-500",
      Coordination: "bg-green-500",
      Responsable: "bg-blue-500",
      Admin: "bg-orange-500",
      "Super Admin": "bg-red-500",
    };
    return colors[acces] || colors["Technicien"];
  };

  // Comptage par branche pour l'overview
  const branchCounts = useMemo(() => {
    const counts = {};
    techniciens.forEach((t) => {
      (t.branches || []).forEach((b) => {
        counts[b] = (counts[b] || 0) + 1;
      });
    });
    return counts;
  }, [techniciens]);

  // KPI badges (tâche #302) : qui a / n'a pas de badge, tous rôles/branches
  // confondus dans la liste déjà chargée (donc déjà scopée par branche pour
  // un Responsable/Coordination limité — cf. #292). "en_attente" = une
  // demande de badge est en cours de validation (badge_status), distinct de
  // badge_attribue qui reflète l'attribution réelle sur la fiche.
  const badgeCounts = useMemo(() => {
    let avec = 0,
      sans = 0,
      enAttente = 0;
    techniciens.forEach((t) => {
      if (t.badge_attribue) avec++;
      else sans++;
      if (t.badge_status === "en_attente_validation") enAttente++;
    });
    return { avec, sans, enAttente, total: techniciens.length };
  }, [techniciens]);

  const filteredTechniciens = useMemo(() => {
    return techniciens.filter((t) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        [t.nom, t.poste_principal, t.telephone, t.email, ...(t.postes_secondaires || [])]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      const branches = t.branches || [];
      const matchBranche =
        filterBranche === "all" || branches.includes(filterBranche);
      const matchBadge =
        filterBadge === "all" ||
        (filterBadge === "avec" && t.badge_attribue) ||
        (filterBadge === "sans" && !t.badge_attribue);
      return matchSearch && matchBranche && matchBadge;
    });
  }, [techniciens, searchTerm, filterBranche, filterBadge]);

  const sortedTechniciens = useMemo(() => {
    const list = [...filteredTechniciens];
    const byNom = (x, y) => (x.nom || "").localeCompare(y.nom || "", "fr", { sensitivity: "base" });
    if (sortBy === "branche") list.sort((x, y) => ((x.branches || [])[0] || "~").localeCompare((y.branches || [])[0] || "~", "fr") || byNom(x, y));
    else if (sortBy === "poste") list.sort((x, y) => (x.poste_principal || "~").localeCompare(y.poste_principal || "~", "fr") || byNom(x, y));
    else if (sortBy === "niveau") list.sort((x, y) => (NIVEAU_ORDER[x.niveau_technicien] ?? 9) - (NIVEAU_ORDER[y.niveau_technicien] ?? 9) || byNom(x, y));
    else list.sort(byNom);
    return list;
  }, [filteredTechniciens, sortBy]);

  const groupedTechniciens = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", title: null, items: sortedTechniciens }];
    const map = new Map();
    sortedTechniciens.forEach((t) => {
      const key = groupBy === "branche" ? (t.branches || [])[0] || "Sans branche"
        : groupBy === "poste" ? t.poste_principal || "Sans poste principal"
        : (t.nom || "?").charAt(0).toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return [...map.entries()].map(([key, items]) => ({ key, title: key, items }));
  }, [sortedTechniciens, groupBy]);

  const filtersActive = searchTerm !== "" || filterBranche !== "all" || filterBadge !== "all";
  const resetFilters = () => { setSearchTerm(""); setFilterBranche("all"); setFilterBadge("all"); };

  // ---------------------------------------------------------------------
  // Export XLSX (liste complète, filtrée par recherche/branche/badge comme
  // affichée à l'écran) + PDF (fiche individuelle) — tâche #578. Réutilise
  // les mêmes bibliothèques et le même utilitaire de téléchargement que
  // Planning.js (xlsx-js-style + downloadOrShareFile) et que Devis.js
  // (html2canvas + jsPDF) plutôt que d'introduire une nouvelle dépendance.
  // ---------------------------------------------------------------------
  const buildEffectifListXLSX = (list) => {
    const headers = [
      "Nom",
      "Branches",
      "Poste principal",
      "Postes secondaires",
      "Niveau technicien",
      "Niveau d'accès",
      "Badge attribué",
      "Téléphone",
      "Email",
    ];
    const rows = list.map((t) => [
      t.nom || "",
      (t.branches || []).join(", "),
      t.poste_principal || "",
      (t.postes_secondaires || []).join(", "),
      t.niveau_technicien || "",
      t.niveau_acces || "",
      t.badge_attribue ? "Oui" : "Non",
      t.telephone || "",
      t.email || "",
    ]);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const HEADER_HEX = "1F4E78";
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: HEADER_HEX } },
      alignment: { horizontal: "center", vertical: "center" },
    };
    headers.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      ws[ref].s = headerStyle;
    });
    ws["!cols"] = [
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 26 },
    ];
    ws["!autofilter"] = { ref: `A1:I${aoa.length}` };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Effectif");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  };

  const handleExportListXlsx = async () => {
    setExportingListXlsx(true);
    try {
      const blob = buildEffectifListXLSX(filteredTechniciens);
      const filename = `effectif-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const status = await downloadOrShareFile(blob, filename, { title: filename });
      const msg =
        status === "blocked"
          ? "Impossible d'enregistrer le fichier — réessaie"
          : status === "downloaded"
            ? "Le fichier Excel a été téléchargé"
            : downloadStatusMessage(status);
      if (status === "blocked") toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExportingListXlsx(false);
    }
  };

  // Construit un mini-document HTML hors-écran pour la fiche d'un
  // technicien puis le convertit en PDF via html2canvas + jsPDF — même
  // méthode que handleDownloadDevisPdf dans Devis.js.
  const handleExportFichePdf = async () => {
    if (!selectedTech) return;
    const preOpenedWindow = reserveTabForIOSFallback();
    setExportingFichePdf(true);
    const tech = selectedTech;
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "-99999px";
    container.style.width = "794px";
    container.style.background = "#ffffff";
    const branchesHtml =
      (tech.branches || [])
        .map(
          (b) =>
            `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;margin:0 4px 4px 0;">${b}</span>`,
        )
        .join("") || '<span style="color:#999;">Aucune branche</span>';
    const postesSecHtml =
      (tech.postes_secondaires || [])
        .map(
          (p) =>
            `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#f3f4f6;color:#374151;font-size:12px;margin:0 4px 4px 0;">${p}</span>`,
        )
        .join("") || '<span style="color:#999;">Aucun</span>';
    container.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 40px; color: #333; box-sizing: border-box; width: 794px;">
        <div style="display:flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <div style="font-size: 28px; font-weight: bold; color: #2563eb;">PAV Manager</div>
            <div style="font-size: 12px; color: #666;">Fiche technicien — Effectif</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: #1e40af;">FICHE</div>
            <div style="color: #666; margin-top: 5px;">Édité le ${new Date().toLocaleDateString("fr-FR")}</div>
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 22px; font-weight: bold;">${tech.nom || ""}</div>
          <div style="margin-top: 6px;">
            <span style="display:inline-block; padding: 6px 14px; border-radius: 20px; font-weight: bold; background: #dbeafe; color: #1e3a8a;">${tech.niveau_acces || ""}</span>
            ${tech.niveau_technicien ? `<span style="display:inline-block; padding: 6px 14px; border-radius: 20px; font-weight: bold; background: #fef3c7; color: #92400e; margin-left:8px;">${tech.niveau_technicien}</span>` : ""}
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Branches</div>
          <div>${branchesHtml}</div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Poste(s)</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Poste principal</div><div style="font-size: 16px; font-weight: 500;">${tech.poste_principal || "Non spécifié"}</div></div>
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Postes secondaires</div><div>${postesSecHtml}</div></div>
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Coordonnées</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Téléphone</div><div style="font-size: 16px; font-weight: 500;">${tech.telephone || "Non renseigné"}</div></div>
            <div><div style="font-size: 12px; color: #666; margin-bottom: 3px;">Email</div><div style="font-size: 16px; font-weight: 500;">${tech.email || "Non renseigné"}</div></div>
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <div style="font-size: 14px; font-weight: bold; color: #2563eb; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Badge</div>
          <div style="font-size: 16px; font-weight: 500;">${tech.badge_attribue ? "Attribué" : "Non attribué"}</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    try {
      const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
      const filename = `fiche-${(tech.nom || "technicien").replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
      const blob = pdf.output("blob");
      const status = await downloadOrShareFile(blob, filename, {
        title: filename,
        preOpenedWindow,
      });
      const msg =
        status === "blocked"
          ? "Impossible d'enregistrer le fichier — réessaie"
          : status === "downloaded"
            ? "Le PDF a été téléchargé"
            : downloadStatusMessage(status);
      if (status === "blocked") toast.error(msg);
      else if (msg) toast.success(msg);
    } catch (err) {
      console.error(err);
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      document.body.removeChild(container);
      setExportingFichePdf(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="effectif-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Effectif</h1>
          <p className="text-muted-foreground">
            Gestion des techniciens ({filteredTechniciens.length})
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                data-testid="effectif-export-menu-btn"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Exporter</span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 hidden sm:inline" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleExportListXlsx}
                disabled={exportingListXlsx}
                data-testid="effectif-export-xlsx-btn"
              >
                {exportingListXlsx ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Exporter la liste (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportFichePdf}
                disabled={!selectedTech || exportingFichePdf}
                data-testid="effectif-export-fiche-pdf-btn"
              >
                {exportingFichePdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                Exporter la fiche (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canApproveTechniciens() && (
            <Dialog
              open={pendingManagerOpen}
              onOpenChange={setPendingManagerOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="relative">
                  <Send className="w-4 h-4 mr-2" />
                  Fiches à valider
                  {pendingTechs.length > 0 && (
                    <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">
                      {pendingTechs.length}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Fiches techniciens à valider</DialogTitle>
                  <DialogDescription>
                    Fiches proposées par un Responsable — elles n'intègrent
                    l'effectif qu'après validation.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {pendingTechsLoading ? (
                    <div className="p-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </div>
                  ) : pendingTechs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Aucune fiche en attente
                    </p>
                  ) : (
                    pendingTechs.map((t) => (
                      <div
                        key={t.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{t.nom}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Proposée par{" "}
                              {t.proposed_by_name || "un Responsable"}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {t.branches?.join(", ")}
                          </Badge>
                        </div>
                        {rejectingPendingId === t.id ? (
                          <div className="space-y-2">
                            <Label className="text-xs">Motif (optionnel)</Label>
                            <Input
                              value={pendingRejectMessage}
                              onChange={(e) =>
                                setPendingRejectMessage(e.target.value)
                              }
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
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRejectingPendingId(null);
                                  setPendingRejectMessage("");
                                }}
                              >
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
                              {pendingActionBusy === t.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                              )}
                              Valider
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              onClick={() => {
                                setRejectingPendingId(t.id);
                                setPendingRejectMessage("");
                              }}
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
            Coordination+ (le filtrage par équipe/branche est déjà fait
            côté serveur, voir GET /absences). */}
          {[
            "Responsable",
            "Coordination",
            "Admin",
            "Admin (lecture seule)",
            "Super Admin",
          ].includes(user?.niveau_acces) && (
            <TeamAbsenceDashboard
              scopeLabel={
                user?.niveau_acces === "Responsable" && user?.branches?.length
                  ? `Absences déclarées par les membres de : ${user.branches.join(", ")}.`
                  : "Absences déclarées par l'ensemble de l'effectif, pour le mois sélectionné."
              }
            />
          )}
          {(isAdmin() || isSuperAdmin()) && (
            <Dialog
              open={posteManagerOpen}
              onOpenChange={(open) => {
                setPosteManagerOpen(open);
                if (!open) {
                  setNewPosteLabel("");
                  setRenamingPoste(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Gérer les postes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Gérer les postes</DialogTitle>
                  <DialogDescription>
                    Ajoutez, renommez ou supprimez les postes
                    principal/secondaires proposés sur les fiches.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {(enums.postes || []).map((p) => (
                    <div
                      key={p}
                      className="flex items-center gap-2 border rounded-lg px-3 py-2"
                    >
                      {renamingPoste?.old === p ? (
                        <>
                          <Input
                            className="h-8"
                            value={renamingPoste.value}
                            onChange={(e) =>
                              setRenamingPoste({
                                ...renamingPoste,
                                value: e.target.value,
                              })
                            }
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            disabled={posteBusy}
                            onClick={handleRenamePosteSave}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setRenamingPoste(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm truncate">{p}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() =>
                              setRenamingPoste({ old: p, value: p })
                            }
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-destructive"
                            disabled={posteBusy}
                            onClick={() => handleDeletePoste(p)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                  {(enums.postes || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Aucun poste défini.
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    placeholder="Nouveau poste..."
                    value={newPosteLabel}
                    onChange={(e) => setNewPosteLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddPoste();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddPoste}
                    disabled={posteBusy || !newPosteLabel.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {canManage() && (
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              {/* Tâche #415 : un Responsable ne peut plus créer de fiche
                technicien (le backend le refuse désormais aussi) — seul le
                bouton "Modifier" depuis la fiche d'un technicien existant
                reste disponible pour lui, via le même Dialog contrôlé plus
                haut par dialogOpen/editingId. */}
              {user?.niveau_acces !== "Responsable" && (
                <DialogTrigger asChild>
                  <Button
                    className="shadow-lg shadow-primary/20"
                    data-testid="add-tech-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent
                className={SHEET_CLASS}
                data-testid="tech-edit-dialog"
              >
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b px-4 pb-3 pt-4 sm:px-6">
                    <DialogHeader className="space-y-1 text-left">
                      <DialogTitle className="flex items-center gap-2 pr-8">
                        {editingId ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                        {editingId ? "Modifier la fiche" : "Nouveau technicien"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingId ? (form.nom || "Technicien") : "Remplissez les informations de la personne"}
                      </DialogDescription>
                    </DialogHeader>
                  </div>

                  <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
                    {/* Identité */}
                    <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                      <h3 className="text-sm font-semibold">Identité</h3>
                      <div className="space-y-1.5">
                        <Label htmlFor="tech-nom">Nom *</Label>
                        <Input
                          id="tech-nom"
                          value={form.nom}
                          onChange={(e) => setForm({ ...form, nom: e.target.value })}
                          className="h-11 text-base sm:h-10 sm:text-sm"
                          autoComplete="off"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Niveau technicien</Label>
                          <Select value={form.niveau_technicien} onValueChange={(v) => setForm({ ...form, niveau_technicien: v })}>
                            <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                            <SelectContent>
                              {enums.niveaux_technicien?.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Niveau d'accès *</Label>
                          <Select value={form.niveau_acces} onValueChange={(v) => setForm({ ...form, niveau_acces: v })}>
                            <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                            <SelectContent>
                              {enums.niveaux_acces?.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    {/* Coordonnées */}
                    <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                      <h3 className="text-sm font-semibold">Coordonnées</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="tech-tel">Téléphone</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input id="tech-tel" type="tel" inputMode="tel" autoComplete="off" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="h-11 pl-9 text-base sm:h-10 sm:text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="tech-mail">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input id="tech-mail" type="email" inputMode="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 pl-9 text-base sm:h-10 sm:text-sm" />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Branches : pastilles à toucher */}
                    <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">Branches *</h3>
                        <span className="text-xs text-muted-foreground">{form.branches.length} choisie(s)</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {
                          // Un Responsable/Coordination scopé à une ou plusieurs branches
                          // (User.branches) ne peut créer/éditer que dans son propre
                          // périmètre — le backend le refuse aussi (tâche #292).
                          (!isAdminOrReadOnly() && user?.branches?.length
                            ? enums.branches?.filter((b) => user.branches.includes(b))
                            : enums.branches
                          )?.map((b) => {
                            const c = getBranchColor(b);
                            const on = form.branches.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleBranche(b)}
                                className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition ${on ? `${c.bg} ${c.text} ${c.border} ring-2 ring-primary/40` : "hover:bg-muted"}`}
                              >
                                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                                {b}
                                {on && <Check className="h-3.5 w-3.5" />}
                              </button>
                            );
                          })
                        }
                      </div>
                    </section>

                    {/* Postes : sert à filtrer les noms proposés dans le Planning */}
                    <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                      <h3 className="text-sm font-semibold">Postes</h3>
                      <div className="space-y-1.5">
                        <Label>Poste principal</Label>
                        <Select
                          value={form.poste_principal || "__none__"}
                          onValueChange={(v) => setForm({ ...form, poste_principal: v === "__none__" ? "" : v })}
                        >
                          <SelectTrigger className="h-11 sm:h-10"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Aucun</SelectItem>
                            {enums.postes?.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Postes secondaires</Label>
                        <div className="flex flex-wrap gap-2">
                          {enums.postes?.filter((p) => p !== form.poste_principal).map((p) => {
                            const on = form.postes_secondaires.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                aria-pressed={on}
                                onClick={() => togglePosteSecondaire(p)}
                                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm transition ${on ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40" : "hover:bg-muted"}`}
                              >
                                {on && <Check className="h-3.5 w-3.5" />}
                                {p}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Dans le Planning, la liste des noms proposée pour un poste ne montre que les personnes ayant ce poste en principal ou secondaire.
                        </p>
                      </div>
                      {isGestionnairePlus() && (
                        <div className="space-y-1.5 border-t pt-3">
                          <Label htmlFor="tech-orga">Étiquette dans l'organigramme (optionnel)</Label>
                          <Input
                            id="tech-orga"
                            value={form.organigramme_label}
                            onChange={(e) => setForm({ ...form, organigramme_label: e.target.value })}
                            placeholder={form.poste_principal || "Par défaut : poste principal"}
                            className="h-11 text-base sm:h-10 sm:text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Petit badge affiché à côté du nom dans l'organigramme du Dashboard. Laissez vide pour reprendre le poste principal.
                          </p>
                        </div>
                      )}
                    </section>

                    {/* Badge */}
                    <label
                      htmlFor="badge"
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 sm:p-4"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <IdCard className="h-4 w-4 text-muted-foreground" /> Badge attribué
                      </span>
                      <Checkbox
                        id="badge"
                        checked={form.badge_attribue}
                        onCheckedChange={(checked) => setForm({ ...form, badge_attribue: checked })}
                        className="h-6 w-6"
                      />
                    </label>
                  </div>

                  <div
                    className="flex gap-2 border-t bg-background px-4 py-3 sm:justify-end sm:px-6"
                    style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                  >
                    <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={() => { setDialogOpen(false); resetForm(); }}>
                      Annuler
                    </Button>
                    <Button type="submit" className="h-11 flex-1 sm:h-10 sm:flex-none sm:min-w-[160px]" disabled={submitting} data-testid="tech-save-btn">
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingId ? "Enregistrer" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Barre d'outils : recherche, filtres en pastilles (branches + badge), vue, tri, regroupement */}
      {!loading && (
        <Card data-testid="effectif-toolbar">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un nom, un poste, un téléphone…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="effectif-search"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => savePref("effectif_sort", v, setSortBy)}>
                  <SelectTrigger className="w-[150px]" aria-label="Trier"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nom">Trier : nom</SelectItem>
                    <SelectItem value="branche">Trier : branche</SelectItem>
                    <SelectItem value="poste">Trier : poste</SelectItem>
                    <SelectItem value="niveau">Trier : niveau</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={(v) => savePref("effectif_group", v, setGroupBy)}>
                  <SelectTrigger className="w-[160px]" aria-label="Regrouper"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans regroupement</SelectItem>
                    <SelectItem value="lettre">Par lettre</SelectItem>
                    <SelectItem value="branche">Par branche</SelectItem>
                    <SelectItem value="poste">Par poste</SelectItem>
                  </SelectContent>
                </Select>
                <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Affichage">
                  <Button type="button" size="sm" variant={viewMode === "cards" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => savePref("effectif_view", "cards", setViewMode)} title="Cartes" data-testid="effectif-view-cards">
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => savePref("effectif_view", "table", setViewMode)} title="Liste" data-testid="effectif-view-table">
                    <ListIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5" data-testid="effectif-chips">
              <button
                type="button"
                onClick={() => setFilterBranche("all")}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filterBranche === "all" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Toutes ({techniciens.length})
              </button>
              {Object.entries(branchCounts).map(([branche, count]) => {
                const c = getBranchColor(branche);
                const active = filterBranche === branche;
                return (
                  <button
                    key={branche}
                    type="button"
                    onClick={() => setFilterBranche(active ? "all" : branche)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${active ? `${c.bg} ${c.text} ${c.border} ring-2 ring-primary/40` : "hover:bg-muted"}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    {branche} <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
              {canManageBadges() && badgeCounts.total > 0 && (
                <>
                  <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
                  <button
                    type="button"
                    onClick={() => setFilterBadge(filterBadge === "avec" ? "all" : "avec")}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${filterBadge === "avec" ? "border-emerald-400 bg-emerald-100 text-emerald-800 ring-2 ring-primary/40 dark:bg-emerald-900/30 dark:text-emerald-300" : "hover:bg-muted"}`}
                  >
                    <IdCard className="h-3.5 w-3.5 text-emerald-600" /> Avec badge <span className="opacity-70">{badgeCounts.avec}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterBadge(filterBadge === "sans" ? "all" : "sans")}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${filterBadge === "sans" ? "border-amber-400 bg-amber-100 text-amber-800 ring-2 ring-primary/40 dark:bg-amber-900/30 dark:text-amber-300" : "hover:bg-muted"}`}
                  >
                    <IdCard className="h-3.5 w-3.5 text-amber-600" /> Sans badge <span className="opacity-70">{badgeCounts.sans}</span>
                  </button>
                  {badgeCounts.enAttente > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                      <Send className="h-3.5 w-3.5" /> {badgeCounts.enAttente} demande(s) en attente
                    </span>
                  )}
                </>
              )}
              {filtersActive && (
                <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={resetFilters}>
                  <FilterX className="mr-1 h-3.5 w-3.5" /> Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : sortedTechniciens.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun technicien trouvé</p>
            {filtersActive && (
              <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>Réinitialiser les filtres</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedTechniciens.map((g) => (
            <section key={g.key} className="space-y-2">
              {g.title && (
                <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  {groupBy === "branche" && <span className={`h-2.5 w-2.5 rounded-full ${getBranchColor(g.title).dot}`} />}
                  {g.title}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{g.items.length}</span>
                </h2>
              )}
              {viewMode === "table" ? (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Nom</th>
                          <th className="px-3 py-2 font-medium">Branches</th>
                          <th className="px-3 py-2 font-medium">Poste</th>
                          <th className="px-3 py-2 font-medium">Niveau</th>
                          <th className="px-3 py-2 font-medium">Badge</th>
                          <th className="px-3 py-2 font-medium">Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((tech) => {
                          const bc = getBranchColor((tech.branches || [])[0]);
                          return (
                            <tr
                              key={tech.id}
                              className="cursor-pointer border-t transition hover:bg-muted/40"
                              onClick={() => handleCardClick(tech)}
                              data-testid={`tech-card-${tech.id}`}
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${bc.bg} ${bc.text}`}>{(tech.nom || "?").charAt(0)}</span>
                                  <span className="font-medium">{tech.nom}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {(tech.branches || []).length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (tech.branches || []).map((b) => {
                                    const c = getBranchColor(b);
                                    return <span key={b} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${c.bg} ${c.text} ${c.border}`}><span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{b}</span>;
                                  })}
                                </div>
                              </td>
                              <td className="px-3 py-2">{tech.poste_principal || <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-3 py-2">{tech.niveau_technicien ? <Badge className={`${getNiveauColor(tech.niveau_technicien)} border-0`}>{tech.niveau_technicien}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-3 py-2"><IdCard className={`h-4 w-4 ${tech.badge_attribue ? "text-emerald-500" : "text-muted-foreground/30"}`} /></td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  {tech.telephone && <a href={`tel:${tech.telephone}`} onClick={(e) => e.stopPropagation()} className="rounded p-1.5 hover:bg-muted" title={tech.telephone}><Phone className="h-4 w-4" /></a>}
                                  {tech.email && <a href={`mailto:${tech.email}`} onClick={(e) => e.stopPropagation()} className="rounded p-1.5 hover:bg-muted" title={tech.email}><Mail className="h-4 w-4" /></a>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {g.items.map((tech) => {
                    const branches = tech.branches || [];
                    const bc = getBranchColor(branches[0]);
                    return (
                      <Card
                        key={tech.id}
                        className={`cursor-pointer card-hover border-l-4 ${bc.border}`}
                        onClick={() => handleCardClick(tech)}
                        data-testid={`tech-card-${tech.id}`}
                      >
                        <CardContent className="space-y-2 p-3">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${bc.bg} ${bc.text}`}>{(tech.nom || "?").charAt(0)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold leading-tight">{tech.nom}</p>
                              <p className="truncate text-xs text-muted-foreground">{tech.poste_principal || "Poste non renseigné"}</p>
                            </div>
                            <IdCard className={`h-4 w-4 shrink-0 ${tech.badge_attribue ? "text-emerald-500" : "text-muted-foreground/30"}`} title={tech.badge_attribue ? "Badge attribué" : "Sans badge"} />
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {branches.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground">Sans branche</span>
                            ) : branches.slice(0, 3).map((b) => {
                              const c = getBranchColor(b);
                              return <span key={b} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.bg} ${c.text} ${c.border}`}><span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{b}</span>;
                            })}
                            {branches.length > 3 && <span className="text-[11px] text-muted-foreground">+{branches.length - 3}</span>}
                            {tech.niveau_technicien && <Badge className={`${getNiveauColor(tech.niveau_technicien)} ml-auto border-0 text-[11px]`}>{tech.niveau_technicien}</Badge>}
                          </div>
                          {(tech.telephone || tech.email) && (
                            <div className="flex items-center gap-1 border-t pt-2">
                              {tech.telephone && <a href={`tel:${tech.telephone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"><Phone className="h-3.5 w-3.5" />{tech.telephone}</a>}
                              {tech.email && <a href={`mailto:${tech.email}`} onClick={(e) => e.stopPropagation()} className="ml-auto rounded-md p-1.5 hover:bg-muted" title={tech.email}><Mail className="h-3.5 w-3.5" /></a>}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Fiche d'un technicien (PC : fenêtre ; téléphone : plein écran) */}
      <Dialog open={!!selectedTech} onOpenChange={handleCloseDetail}>
        <DialogContent className={SHEET_CLASS} data-testid="tech-detail-dialog">
          {selectedTech && (() => {
            const t = selectedTech;
            const bc = getBranchColor((t.branches || [])[0]);
            return (
              <>
                <div className={`${bc.bg} px-4 pb-4 pt-5 sm:px-6`}>
                  <DialogHeader className="space-y-0 text-left">
                    <DialogTitle className="flex items-center gap-3 pr-8">
                      <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-background/70 text-2xl font-bold shadow-sm ${bc.text}`}>
                        {(t.nom || "?").charAt(0)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xl font-bold leading-tight">{t.nom}</span>
                        <span className="block truncate text-sm font-normal text-foreground/70">
                          {t.poste_principal || "Poste non renseigné"}
                        </span>
                      </span>
                    </DialogTitle>
                    <DialogDescription className="sr-only">Fiche de {t.nom}</DialogDescription>
                  </DialogHeader>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.niveau_technicien && <Badge className={`${getNiveauColor(t.niveau_technicien)} border-0`}>{t.niveau_technicien}</Badge>}
                    <Badge variant="outline" className="flex items-center gap-1 bg-background/60">
                      <span className={`h-2 w-2 rounded-full ${getAccesColor(t.niveau_acces)}`} />
                      {t.niveau_acces}
                    </Badge>
                    <Badge variant="outline" className={`flex items-center gap-1 bg-background/60 ${t.badge_attribue ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                      <IdCard className="h-3 w-3" /> {t.badge_attribue ? "Badge attribué" : "Sans badge"}
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                  {/* Joindre la personne en un geste */}
                  <div className="grid grid-cols-2 gap-2">
                    {t.telephone ? (
                      <a href={`tel:${t.telephone}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm active:scale-[0.98]">
                        <Phone className="h-4 w-4" /> Appeler
                      </a>
                    ) : (
                      <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><Phone className="h-4 w-4" /> Pas de numéro</span>
                    )}
                    {t.email ? (
                      <a href={`mailto:${t.email}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold hover:bg-muted active:scale-[0.98]">
                        <Mail className="h-4 w-4" /> Écrire
                      </a>
                    ) : (
                      <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground"><Mail className="h-4 w-4" /> Pas d'email</span>
                    )}
                  </div>

                  <section className="space-y-2 rounded-xl border p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coordonnées</h3>
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Téléphone</dt><dd className="truncate font-medium">{t.telephone || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="truncate font-medium">{t.email || "—"}</dd></div>
                    </dl>
                  </section>

                  <section className="space-y-2 rounded-xl border p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Branches</h3>
                    {(t.branches || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune branche</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {t.branches.map((b) => {
                          const c = getBranchColor(b);
                          return (
                            <span key={b} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
                              <span className={`h-2 w-2 rounded-full ${c.dot}`} />{b}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="space-y-2 rounded-xl border p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Postes</h3>
                    {!t.poste_principal && (t.postes_secondaires || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucun poste renseigné</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {t.poste_principal && <Badge className="border border-primary/30 bg-primary/10 text-primary">{t.poste_principal}</Badge>}
                        {(t.postes_secondaires || []).map((p) => (<Badge key={p} variant="secondary">{p}</Badge>))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <IdCard className="w-4 h-4" /> Badge
                    </p>
                    {!canManageBadges() && (
                      <Badge
                        className={
                          selectedTech.badge_attribue
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : ""
                        }
                        variant={
                          selectedTech.badge_attribue ? undefined : "outline"
                        }
                      >
                        {selectedTech.badge_attribue
                          ? "Attribué"
                          : "Non attribué"}
                      </Badge>
                    )}
                  </div>

                  {!canManageBadges() ? null : badgeDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                    </div>
                  ) : (
                    badgeDetail && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={
                              getBadgeStatusInfo(badgeDetail.badge_status).color
                            }
                          >
                            {getBadgeStatusInfo(badgeDetail.badge_status).label}
                          </Badge>
                          {badgeDetail.badge_is_renewal && (
                            <Badge variant="outline">Renouvellement</Badge>
                          )}
                          {badgeDetail.badge_archived && (
                            <Badge variant="outline">Archivée</Badge>
                          )}
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
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Voir /
                              télécharger
                            </a>
                          </div>
                        )}

                        {badgeDetail.badge_message && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            Motif du dernier refus : {badgeDetail.badge_message}
                          </p>
                        )}

                        {badgeDetail.badge_status === "en_attente_validation" &&
                          (rejectingBadge ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full text-sm border rounded-md p-2 bg-background"
                                rows={2}
                                placeholder="Motif du refus (envoyé au technicien)..."
                                value={rejectMessage}
                                onChange={(e) =>
                                  setRejectMessage(e.target.value)
                                }
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={badgeActionBusy}
                                  onClick={handleRejectBadge}
                                >
                                  {badgeActionBusy && (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  )}
                                  Confirmer le refus
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setRejectingBadge(false);
                                    setRejectMessage("");
                                  }}
                                >
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                disabled={badgeActionBusy}
                                onClick={handleConfirmBadge}
                              >
                                {badgeActionBusy && (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                <Check className="w-4 h-4 mr-1" /> Valider la
                                photo
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => setRejectingBadge(true)}
                              >
                                <X className="w-4 h-4 mr-1" /> Refuser
                              </Button>
                            </div>
                          ))}

                        {badgeDetail.badge_status === "pret_a_recuperer" && (
                          <Button
                            size="sm"
                            disabled={badgeActionBusy}
                            onClick={handleCollectBadge}
                          >
                            {badgeActionBusy && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}
                            <IdCard className="w-4 h-4 mr-1" /> Marquer comme
                            remis
                          </Button>
                        )}

                        {badgeDetail.badge_status && (
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={badgeActionBusy}
                              onClick={() =>
                                handleArchiveBadge(!badgeDetail.badge_archived)
                              }
                            >
                              <Archive className="w-3.5 h-3.5 mr-1" />{" "}
                              {badgeDetail.badge_archived
                                ? "Désarchiver"
                                : "Archiver"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={badgeActionBusy}
                              onClick={handleDeleteBadge}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                  </section>
                </div>

                {/* Actions toujours visibles en bas */}
                <div
                  className="flex flex-wrap items-center gap-2 border-t bg-background px-4 py-3 sm:px-6"
                  style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                >
                  {canManage() && (
                    <Button className="h-11 flex-1 sm:h-10" onClick={() => handleEdit(t)} data-testid="tech-edit-btn">
                      <Edit className="mr-2 h-4 w-4" /> Modifier
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-11 sm:h-10"
                    disabled={exportingFichePdf}
                    onClick={handleExportFichePdf}
                    data-testid="effectif-fiche-export-pdf-btn"
                    title="Exporter la fiche (PDF)"
                  >
                    {exportingFichePdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">PDF</span>
                  </Button>
                  {canManage() && isAdmin() && (
                    <Button variant="outline" className="h-11 sm:h-10" onClick={() => handleArchive(t.id)} title="Archiver">
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  {canManage() && isSuperAdmin() && (
                    <Button variant="destructive" size="icon" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => handleDelete(t.id)} title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
