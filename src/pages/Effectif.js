import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import { Users, Loader2, IdCard, Clock, CheckCircle2, XCircle, Download, ChevronDown, FileSpreadsheet, FileText, Phone, Mail } from 'lucide-react';
import {
  downloadOrShareFile,
  downloadStatusMessage,
  reserveTabForIOSFallback,
} from "../utils/fileDownload";
import { invalidateTechniciensCache } from "../lib/technicienCache";
import TeamAbsenceDashboard from "./TeamAbsenceDashboard";

import { sanitizeContainer } from '../lib/safeHtml';
import { LIVE_POLES, POLES, isLiveMember, polesOf, toRaw } from './effectif/poles';
import { API, NIVEAU_ORDER, XLSX, getBranchColor, loadXLSX } from './effectif/constants';
import { TechDetailDialog } from './effectif/TechDetailDialog';
import { EffectifList } from './effectif/EffectifList';
import { EffectifToolbar } from './effectif/EffectifToolbar';
import { TechEditDialog } from './effectif/TechEditDialog';
import { PosteManagerDialog } from './effectif/PosteManagerDialog';
import { BadgesQueueDialog } from './effectif/BadgesQueueDialog';
import { PendingTechniciensDialog } from './effectif/PendingTechniciensDialog';












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
  const [autoOpenWizard, setAutoOpenWizard] = useState(false);
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
    branches_raw: [],
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
      // `branches` = pôles (alignés sur l'organigramme) pour tout l'affichage ; `branches_raw` = valeurs enregistrées.
      setTechniciens(list.map((t) => ({ ...t, branches_raw: t.branches || [], branches: polesOf(t) })));
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
    branches_raw: [],
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
      branches_raw: tech.branches_raw || [],
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

  // Même règle que le serveur : un Responsable / une Coordination limité(e) à des branches ne modifie que les fiches qui en partagent une.
  const canEditTech = (t) => {
    if (!canManage()) return false;
    if (!["Responsable", "Coordination"].includes(user?.niveau_acces)) return true;
    const mine = user?.branches || [];
    if (mine.length === 0) return true;
    return (t?.branches_raw || t?.branches || []).some((b) => mine.includes(b));
  };

  const toggleBranche = (pole) => {
    setForm((prev) => ({
      ...prev,
      branches: prev.branches.includes(pole) ? prev.branches.filter((b) => b !== pole) : [...prev.branches, pole],
    }));
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
        ...toRaw(form.branches, form.branches_raw || [], form.sous_branches), // pôles choisis -> branches / sous-branches enregistrées (valeurs d'origine gardées si rien ne change)
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
    ["Super Admin", "Admin", "Coordination", "Admin (lecture seule)"].includes(user?.niveau_acces);
  // Admin (lecture seule) voit tout (demandes, photos, badge fabriqué) mais ne valide / archive / supprime rien.
  const badgeReadOnly = user?.niveau_acces === "Admin (lecture seule)";
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
    // Ordre d'affichage : le titre « Live » (ensemble), ses cinq pôles, puis Production / Coordination / Supervision.
    const counts = { Live: techniciens.filter(isLiveMember).length };
    POLES.forEach((p) => { counts[p] = techniciens.filter((t) => (t.branches || []).includes(p)).length; });
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
        filterBranche === "all" || (filterBranche === "Live" ? isLiveMember(t) : branches.includes(filterBranche));
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
      await loadXLSX();
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
    sanitizeContainer(container);
    document.body.appendChild(container);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
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
          {canManageBadges() && (
            <BadgesQueueDialog
              onOpenRequest={(r) => {
                const norm = (x) => String(x || "").trim().toLowerCase();
                const tech =
                  techniciens.find((t) => r.technicien_id && t.id === r.technicien_id) ||
                  techniciens.find((t) => norm(t.nom) === norm(r.full_name));
                if (!tech) {
                  toast.error("Fiche technicien introuvable pour cette demande.");
                  return;
                }
                setAutoOpenWizard(true);
                setSelectedTech(tech);
              }}
            />
          )}
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
            <PosteManagerDialog
            enums={enums}
            handleAddPoste={handleAddPoste}
            handleDeletePoste={handleDeletePoste}
            handleRenamePosteSave={handleRenamePosteSave}
            newPosteLabel={newPosteLabel}
            posteBusy={posteBusy}
            posteManagerOpen={posteManagerOpen}
            renamingPoste={renamingPoste}
            setNewPosteLabel={setNewPosteLabel}
            setPosteManagerOpen={setPosteManagerOpen}
            setRenamingPoste={setRenamingPoste}
          />
          )}

          {canManage() && (
            <TechEditDialog
            dialogOpen={dialogOpen}
            editingId={editingId}
            enums={enums}
            form={form}
            handleSubmit={handleSubmit}
            isAdminOrReadOnly={isAdminOrReadOnly}
            isGestionnairePlus={isGestionnairePlus}
            resetForm={resetForm}
            setDialogOpen={setDialogOpen}
            setForm={setForm}
            submitting={submitting}
            toggleBranche={toggleBranche}
            togglePosteSecondaire={togglePosteSecondaire}
            user={user}
          />
          )}
        </div>
      </div>

      {/* Barre d'outils : recherche, filtres en pastilles (branches + badge), vue, tri, regroupement */}
      {!loading && (
        <EffectifToolbar
            badgeCounts={badgeCounts}
            branchCounts={branchCounts}
            canManageBadges={canManageBadges}
            filterBadge={filterBadge}
            filterBranche={filterBranche}
            filtersActive={filtersActive}
            groupBy={groupBy}
            resetFilters={resetFilters}
            savePref={savePref}
            searchTerm={searchTerm}
            setFilterBadge={setFilterBadge}
            setFilterBranche={setFilterBranche}
            setGroupBy={setGroupBy}
            setSearchTerm={setSearchTerm}
            setSortBy={setSortBy}
            setViewMode={setViewMode}
            sortBy={sortBy}
            techniciens={techniciens}
            viewMode={viewMode}
          />
      )}

      {/* Liste */}
      {loading ? (
        <EffectifList />
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
                          </div>
                          {/* Niveau toujours sur sa propre ligne (jamais collé aux branches), contacts à droite */}
                          {(tech.niveau_technicien || tech.telephone || tech.email) && (
                            <div className="flex flex-wrap items-center justify-between gap-1 border-t pt-2">
                              <span>
                                {tech.niveau_technicien && <Badge className={`${getNiveauColor(tech.niveau_technicien)} border-0 text-[11px]`}>{tech.niveau_technicien}</Badge>}
                              </span>
                              <span className="flex items-center gap-1">
                                {tech.telephone && <a href={`tel:${tech.telephone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"><Phone className="h-3.5 w-3.5" />{tech.telephone}</a>}
                                {tech.email && <a href={`mailto:${tech.email}`} onClick={(e) => e.stopPropagation()} className="rounded-md p-1.5 hover:bg-muted" title={tech.email}><Mail className="h-3.5 w-3.5" /></a>}
                              </span>
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
      <TechDetailDialog
            badgeReadOnly={badgeReadOnly}
            autoOpenWizard={autoOpenWizard}
            setAutoOpenWizard={setAutoOpenWizard}
            badgeActionBusy={badgeActionBusy}
            badgeDetail={badgeDetail}
            badgeDetailLoading={badgeDetailLoading}
            canManage={canManage}
            canEditTech={canEditTech}
            canManageBadges={canManageBadges}
            exportingFichePdf={exportingFichePdf}
            getAccesColor={getAccesColor}
            getBadgeStatusInfo={getBadgeStatusInfo}
            getNiveauColor={getNiveauColor}
            handleArchive={handleArchive}
            handleArchiveBadge={handleArchiveBadge}
            handleCloseDetail={handleCloseDetail}
            handleCollectBadge={handleCollectBadge}
            handleConfirmBadge={handleConfirmBadge}
            handleDelete={handleDelete}
            handleDeleteBadge={handleDeleteBadge}
            handleEdit={handleEdit}
            handleExportFichePdf={handleExportFichePdf}
            handleRejectBadge={handleRejectBadge}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            rejectMessage={rejectMessage}
            rejectingBadge={rejectingBadge}
            selectedTech={selectedTech}
            setRejectMessage={setRejectMessage}
            setRejectingBadge={setRejectingBadge}
          />
    </div>
  );
}
