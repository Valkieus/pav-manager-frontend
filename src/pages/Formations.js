import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Clock, CheckCircle2, XCircle, Loader2, Trash2, Edit, ShieldCheck, Settings, X, Check, Award, ExternalLink } from 'lucide-react';
import { API, STEPS, stepIndexFor } from './formations/constants';
import { RejectDialog } from './formations/RejectDialog';
import { CoordValidationDialog } from './formations/CoordValidationDialog';
import { FormationsTabs } from './formations/FormationsTabs';
import { FormationFormDialog } from './formations/FormationFormDialog';
import { WorkflowInfoDialog } from './formations/WorkflowInfoDialog';







export default function Formations() {
  const { user, isAdmin, isSuperAdmin, isAdminOrReadOnly } = useAuth();
  const navigate = useNavigate();
  const [formations, setFormations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Coordination validation dialog
  const [coordDialogFormation, setCoordDialogFormation] = useState(null);
  const [coordForm, setCoordForm] = useState({
    formateur: "",
    cursus: "",
    lieu: "",
    duree: "",
  });

  // Reject-with-reason dialogs (shared between the two stages)
  const [rejectTarget, setRejectTarget] = useState(null); // { formation, stage: 'coordination' | 'direction' }
  const [rejectMotif, setRejectMotif] = useState("");

  const [form, setForm] = useState({
    titre: "",
    description: "",
    dates_souhaitees: [],
    duree: "",
  });

  // Compétences souhaitées — editable list (Admin/Super Admin), mirrors the
  // postes management pattern used in Effectif.
  const [competences, setCompetences] = useState([]);
  const [competenceManagerOpen, setCompetenceManagerOpen] = useState(false);
  const [newCompetenceLabel, setNewCompetenceLabel] = useState("");
  const [renamingCompetence, setRenamingCompetence] = useState(null); // { old, value }
  const [competenceBusy, setCompetenceBusy] = useState(false);

  // "Comment ça marche ?" — vue d'ensemble du workflow complet, ouverte via
  // un petit bouton dans l'en-tête, accessible à tout le monde (peu importe
  // le niveau d'accès) pour que chacun comprenne le circuit entier d'une
  // demande de formation, pas juste où sa propre demande en est.
  const [workflowInfoOpen, setWorkflowInfoOpen] = useState(false);

  // PAV Academy — bouton d'accès direct depuis Formations (même handoff SSO
  // que le Dashboard, cf. tâche #325), réservé aux comptes ayant l'accès
  // academy.examiner, academy.formateur ou academy.student.
  const modulePerms = user?.module_permissions || [];
  const hasAcademyAccess =
    isAdminOrReadOnly() ||
    ["academy.examiner", "academy.formateur", "academy.student"].some((p) =>
      modulePerms.includes(p),
    );
  const [academySsoLoading, setAcademySsoLoading] = useState(false);
  const handleAcademySSO = async () => {
    setAcademySsoLoading(true);
    try {
      const res = await axios.post(`${API}/academy/sso-handoff`, {});
      window.location.href = res.data.redirect_url;
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Impossible d'ouvrir PAV Academy",
      );
      setAcademySsoLoading(false);
    }
  };

  const fetchEnums = async () => {
    try {
      const res = await axios.get(`${API}/enums`);
      setCompetences(res.data.competences_formation || []);
    } catch (err) {
      // silent
    }
  };

  const handleAddCompetence = async () => {
    const label = newCompetenceLabel.trim();
    if (!label) return;
    setCompetenceBusy(true);
    try {
      const res = await axios.post(`${API}/competences-formation`, { label });
      setCompetences(res.data.competences_formation);
      setNewCompetenceLabel("");
      toast.success("Formation souhaitée ajoutée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setCompetenceBusy(false);
    }
  };

  const handleRenameCompetenceSave = async () => {
    if (!renamingCompetence) return;
    const newLabel = renamingCompetence.value.trim();
    if (!newLabel) return;
    setCompetenceBusy(true);
    try {
      const res = await axios.put(
        `${API}/competences-formation/${encodeURIComponent(renamingCompetence.old)}`,
        { new_label: newLabel },
      );
      setCompetences(res.data.competences_formation);
      setRenamingCompetence(null);
      toast.success("Formation souhaitée renommée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setCompetenceBusy(false);
    }
  };

  const handleDeleteCompetence = async (label) => {
    if (!window.confirm(`Supprimer la formation souhaitée "${label}" ?`))
      return;
    setCompetenceBusy(true);
    try {
      const res = await axios.delete(
        `${API}/competences-formation/${encodeURIComponent(label)}`,
      );
      setCompetences(res.data.competences_formation);
      toast.success("Formation souhaitée supprimée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setCompetenceBusy(false);
    }
  };

  // Is this user allowed to SEE the Coordination step (tabs, pipeline
  // summary)? Includes Admin (lecture seule), which sees everything.
  const isCoordination =
    isAdminOrReadOnly() ||
    (["Coordination", "Responsable"].includes(user?.niveau_acces) &&
      (user?.branches || []).includes("Coordination"));
  // Is this user allowed to SEE the Direction (final validation) step?
  // Mirrors the backend's is_direction_or_admin for view purposes.
  const isDirection =
    isAdminOrReadOnly() ||
    (user?.niveau_acces === "Responsable" &&
      (!user?.branches || user.branches.length === 0));
  // 20/08/2026 (#303) : write-capable variants, used to gate the actual
  // validate/reject/archive buttons — isAdmin() (not isAdminOrReadOnly()),
  // so Admin (lecture seule) no longer sees action buttons that the
  // backend's is_coordination_or_admin/is_direction_or_admin (Admin/Super
  // Admin only, deliberately excluding the read-only role) would 403 on.
  const isCoordinationWrite =
    isAdmin() ||
    (["Coordination", "Responsable"].includes(user?.niveau_acces) &&
      (user?.branches || []).includes("Coordination"));
  const isDirectionWrite =
    isAdmin() ||
    (user?.niveau_acces === "Responsable" &&
      (!user?.branches || user.branches.length === 0));

  // Console (Coordination and up) can propose team-wide formations and see the
  // full pipeline; a plain Membre gets the simpler "Mes demandes" + "Catalogue" view.
  const isConsole = [
    "Coordination",
    "Responsable",
    "Admin (lecture seule)",
    "Admin",
    "Super Admin",
  ].includes(user?.niveau_acces);
  const [activeTab, setActiveTab] = useState(
    isConsole ? "toutes" : "mes_demandes",
  );

  const resetForm = () => {
    setForm({ titre: "", description: "", dates_souhaitees: [], duree: "" });
    setEditingId(null);
  };

  const [suggestions, setSuggestions] = useState([]);

  // Catalogue browsing + lightweight topic suggestions — the Membre-facing tab.
  const [catalogue, setCatalogue] = useState([]);
  const [mySuggestions, setMySuggestions] = useState([]);
  const [suggTitre, setSuggTitre] = useState("");
  const [suggDescription, setSuggDescription] = useState("");
  const [suggSubmitting, setSuggSubmitting] = useState(false);

  const fetchCatalogueData = async () => {
    try {
      const [catRes, mineRes] = await Promise.all([
        axios.get(`${API}/formations/catalogue`),
        axios.get(`${API}/formation-suggestions/mine`),
      ]);
      setCatalogue(catRes.data);
      setMySuggestions(mineRes.data);
    } catch (err) {
      // silent — non-critical section
    }
  };

  const handleSuggestFormation = async (e) => {
    e.preventDefault();
    if (!suggTitre.trim()) {
      toast.error("Merci de préciser un intitulé");
      return;
    }
    setSuggSubmitting(true);
    try {
      await axios.post(`${API}/formation-suggestions`, {
        titre: suggTitre,
        description: suggDescription,
      });
      toast.success("Suggestion envoyée à la Coordination");
      setSuggTitre("");
      setSuggDescription("");
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSuggSubmitting(false);
    }
  };

  const alreadyInterested = (formationId) =>
    mySuggestions.some((s) => s.formation_id === formationId);

  const handleExpressInterest = async (f) => {
    try {
      await axios.post(`${API}/formation-suggestions`, {
        titre: f.titre,
        description: "",
        formation_id: f.id,
      });
      toast.success("Votre intérêt a été transmis à la Coordination");
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleWithdrawSuggestion = async (id) => {
    if (
      !window.confirm(
        "Se retirer de cette formation / retirer cette suggestion ?",
      )
    )
      return;
    try {
      await axios.delete(`${API}/formation-suggestions/${id}`);
      toast.success("Retrait effectué");
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const [showArchivedSuggestions, setShowArchivedSuggestions] = useState(false);

  const handleArchiveSuggestion = async (id) => {
    try {
      await axios.put(`${API}/formation-suggestions/${id}/archive`);
      toast.success("Suggestion archivée");
      fetchSuggestions();
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleUnarchiveSuggestion = async (id) => {
    try {
      await axios.put(`${API}/formation-suggestions/${id}/unarchive`);
      toast.success("Suggestion désarchivée");
      fetchSuggestions();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  useEffect(() => {
    fetchFormations();
    fetchEnums();
    if (!isConsole) {
      fetchCatalogueData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isConsole) {
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsole]);

  const fetchFormations = async () => {
    try {
      const res = await axios.get(`${API}/formations?include_archived=true`);
      setFormations(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(
        `${API}/formation-suggestions?include_archived=true`,
      );
      setSuggestions(res.data);
    } catch (err) {
      // Membre without access — ignore silently
    }
  };

  const handleToggleCatalogue = async (f) => {
    try {
      await axios.put(`${API}/formations/${f.id}/catalogue`, {
        disponible_catalogue: !f.disponible_catalogue,
      });
      toast.success(
        !f.disponible_catalogue
          ? "Ajoutée au catalogue"
          : "Retirée du catalogue",
      );
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleSuggestionStatus = async (id, statut) => {
    try {
      await axios.put(`${API}/formation-suggestions/${id}/status`, { statut });
      toast.success(
        statut === "Approuvée" ? "Suggestion approuvée" : "Suggestion rejetée",
      );
      fetchSuggestions();
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const wasEditing = !!editingId;
      if (editingId) {
        await axios.put(`${API}/formations/${editingId}`, form);
        toast.success("Formation modifiée");
      } else {
        await axios.post(`${API}/formations`, form);
        toast.success("Demande envoyée à la Coordination");
      }
      setDialogOpen(false);
      resetForm();
      if (wasEditing) {
        navigate("/");
      } else {
        fetchFormations();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (f) => {
    setForm({
      titre: f.titre,
      description: f.description,
      dates_souhaitees: f.dates_souhaitees || [],
      duree: f.duree || "",
    });
    setEditingId(f.id);
    setDialogOpen(true);
  };

  const openCoordDialog = (f) => {
    setCoordForm({
      formateur: f.formateur || "",
      cursus: f.cursus || "",
      lieu: f.lieu || "",
      duree: f.duree || "",
    });
    setCoordDialogFormation(f);
  };

  const handleCoordinationValidate = async (e) => {
    e.preventDefault();
    if (!coordDialogFormation) return;
    setSubmitting(true);
    try {
      await axios.put(
        `${API}/formations/${coordDialogFormation.id}/coordination-validate`,
        coordForm,
      );
      toast.success("Transmis à la Direction pour validation finale");
      setCoordDialogFormation(null);
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalValidate = async (id) => {
    try {
      await axios.put(`${API}/formations/${id}/final-validate`);
      toast.success("Formation validée définitivement");
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const { formation, stage } = rejectTarget;
    const endpoint =
      stage === "coordination" ? "coordination-reject" : "final-reject";
    try {
      await axios.put(`${API}/formations/${formation.id}/${endpoint}`, {
        motif: rejectMotif || null,
      });
      toast.success("Formation refusée");
      setRejectTarget(null);
      setRejectMotif("");
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleArchive = async (id) => {
    try {
      await axios.put(`${API}/formations/${id}/archive`);
      toast.success("Formation archivée");
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette formation ?")) return;
    try {
      await axios.delete(`${API}/formations/${id}`);
      toast.success("Formation supprimée");
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "En attente Coordination":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="w-3 h-3 mr-1" />
            En attente Coordination
          </Badge>
        );
      case "En attente validation finale":
        return (
          <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400">
            <ShieldCheck className="w-3 h-3 mr-1" />
            En attente validation finale
          </Badge>
        );
      case "Validée":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Validée
          </Badge>
        );
      case "Refusée":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3 h-3 mr-1" />
            Refusée
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Mini horizontal stepper showing where a formation stands in the chain.
  const Stepper = ({ f }) => {
    if (f.statut === "Refusée") {
      const stageLabel =
        f.refused_stage === "direction" ? "Validation finale" : "Coordination";
      return (
        <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <XCircle className="w-3.5 h-3.5" />
          Refusée au stade : {stageLabel}
        </div>
      );
    }
    const current = stepIndexFor(f.statut);
    return (
      <div className="flex items-center gap-1">
        {STEPS.map((s, idx) => (
          <div key={s.key} className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full ${idx <= current ? "bg-primary" : "bg-muted"}`}
              title={s.label}
            />
            {idx < STEPS.length - 1 && (
              <div
                className={`w-4 h-0.5 ${idx < current ? "bg-primary" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const pendingCoordinationCount = formations.filter(
    (f) => f.statut === "En attente Coordination" && !f.is_archived,
  ).length;
  const pendingDirectionCount = formations.filter(
    (f) => f.statut === "En attente validation finale" && !f.is_archived,
  ).length;
  const myFormations = formations.filter(
    (f) => f.created_by === user?.id && !f.is_archived,
  );
  const pendingSuggestionsCount = suggestions.filter(
    (s) => s.statut === "En attente" && !s.is_archived,
  ).length;
  const activeSuggestions = suggestions.filter((s) => !s.is_archived);
  const archivedSuggestions = suggestions.filter((s) => s.is_archived);

  const filteredFormations = (() => {
    if (!isConsole) return myFormations;
    switch (activeTab) {
      case "a_traiter":
        return formations.filter(
          (f) => f.statut === "En attente Coordination" && !f.is_archived,
        );
      case "a_valider":
        return formations.filter(
          (f) => f.statut === "En attente validation finale" && !f.is_archived,
        );
      case "validees":
        return formations.filter(
          (f) => f.statut === "Validée" && !f.is_archived,
        );
      case "refusees":
        return formations.filter(
          (f) => f.statut === "Refusée" && !f.is_archived,
        );
      case "archivees":
        return formations.filter((f) => f.is_archived);
      default:
        return formations.filter((f) => !f.is_archived);
    }
  })();

  const originBadge = (f) => {
    const label =
      f.origine === "proposition_responsable"
        ? "Proposition d'équipe"
        : f.origine === "suggestion_membre"
          ? "Suggestion approuvée"
          : "Demande individuelle";
    return (
      <Badge variant="outline" className="text-xs font-normal shrink-0">
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="formations-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Formations</h1>
          <p className="text-muted-foreground">
            {isConsole
              ? "Demandes & propositions → validation Coordination (formateur, cursus, durée, lieu) → validation finale"
              : "Faites une demande, suivez son statut, ou parcourez le catalogue"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasAcademyAccess && (
            <Button
              variant="outline"
              onClick={handleAcademySSO}
              disabled={academySsoLoading}
              data-testid="academy-entry-btn"
              className="border-emerald-500/40 hover:border-emerald-500 hover:text-emerald-600"
            >
              {academySsoLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Award className="w-4 h-4 mr-2" />
              )}
              PAV Academy
              <ExternalLink className="w-3.5 h-3.5 ml-2" />
            </Button>
          )}
          <Dialog open={workflowInfoOpen} onOpenChange={setWorkflowInfoOpen}>
            <WorkflowInfoDialog />
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Le circuit d'une demande de formation</DialogTitle>
                <DialogDescription>
                  Les 4 étapes par lesquelles passe chaque demande, du dépôt
                  jusqu'à la validation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-1">
                  {STEPS.map((s, idx) => (
                    <div
                      key={s.key}
                      className="flex items-center flex-1 last:flex-none"
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full bg-primary shrink-0"
                        title={s.label}
                      />
                      {idx < STEPS.length - 1 && (
                        <div className="h-0.5 bg-primary flex-1 mx-1" />
                      )}
                    </div>
                  ))}
                </div>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-medium text-sm">Demande</p>
                      <p className="text-xs text-muted-foreground">
                        Un Technicien fait une demande individuelle ("Faire une
                        demande"), ou un Responsable propose une formation pour
                        son équipe. Une suggestion approuvée (onglet
                        Suggestions) devient aussi une demande à ce stade.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-medium text-sm">
                        En attente Coordination
                      </p>
                      <p className="text-xs text-muted-foreground">
                        La Coordination examine la demande et renseigne
                        formateur, cursus, lieu et durée avant de la faire
                        avancer — ou la refuse avec un motif.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-medium text-sm">
                        En attente validation finale
                      </p>
                      <p className="text-xs text-muted-foreground">
                        La Direction (Responsable+) valide définitivement ou
                        refuse avec un motif.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <p className="font-medium text-sm">Validée</p>
                      <p className="text-xs text-muted-foreground">
                        La formation est confirmée. Les membres intéressés
                        peuvent se manifester ; la Coordination peut la marquer
                        comme terminée/archiver après coup.
                      </p>
                    </div>
                  </li>
                </ol>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    Une demande refusée à n'importe quelle étape passe
                    directement en{" "}
                    <span className="font-medium text-red-600 dark:text-red-400">
                      Refusée
                    </span>
                    , avec le motif indiqué.
                  </p>
                  <p>
                    Sur chaque carte de demande, les points en haut (comme
                    ci-dessus) indiquent où{" "}
                    <span className="font-medium text-foreground">
                      cette demande précise
                    </span>{" "}
                    se situe dans ce circuit.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setWorkflowInfoOpen(false)}
                >
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 20/08/2026 (#301) : Coordination ajoutée — pilote la
Coordination des Formations, doit pouvoir gérer la liste des
compétences souhaitées comme Admin/Super Admin. */}
          {(isAdmin() ||
            isSuperAdmin() ||
            user?.niveau_acces === "Coordination") && (
            <Dialog
              open={competenceManagerOpen}
              onOpenChange={setCompetenceManagerOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="manage-competences-btn">
                  <Settings className="w-4 h-4 mr-2" />
                  Formations souhaitées
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gérer les formations souhaitées</DialogTitle>
                  <DialogDescription>
                    Liste utilisée dans le formulaire de demande/proposition de
                    formation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {competences.map((c) => (
                    <div
                      key={c}
                      className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2"
                    >
                      {renamingCompetence?.old === c ? (
                        <>
                          <Input
                            value={renamingCompetence.value}
                            onChange={(e) =>
                              setRenamingCompetence({
                                old: c,
                                value: e.target.value,
                              })
                            }
                            className="h-8"
                          />
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={competenceBusy}
                              onClick={handleRenameCompetenceSave}
                            >
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setRenamingCompetence(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">{c}</span>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() =>
                                setRenamingCompetence({ old: c, value: c })
                              }
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive"
                              disabled={competenceBusy}
                              onClick={() => handleDeleteCompetence(c)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    value={newCompetenceLabel}
                    onChange={(e) => setNewCompetenceLabel(e.target.value)}
                    placeholder="Nouvelle formation souhaitée..."
                  />
                  <Button
                    disabled={competenceBusy || !newCompetenceLabel.trim()}
                    onClick={handleAddCompetence}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <FormationFormDialog
            competences={competences}
            dialogOpen={dialogOpen}
            editingId={editingId}
            form={form}
            handleSubmit={handleSubmit}
            isConsole={isConsole}
            resetForm={resetForm}
            setDialogOpen={setDialogOpen}
            setForm={setForm}
            submitting={submitting}
          />
        </div>
      </div>

      <FormationsTabs
            Stepper={Stepper}
            activeSuggestions={activeSuggestions}
            activeTab={activeTab}
            archivedSuggestions={archivedSuggestions}
            catalogue={catalogue}
            filteredFormations={filteredFormations}
            getStatusBadge={getStatusBadge}
            handleArchive={handleArchive}
            handleArchiveSuggestion={handleArchiveSuggestion}
            handleDelete={handleDelete}
            handleEdit={handleEdit}
            handleExpressInterest={handleExpressInterest}
            handleFinalValidate={handleFinalValidate}
            handleSuggestFormation={handleSuggestFormation}
            handleSuggestionStatus={handleSuggestionStatus}
            handleToggleCatalogue={handleToggleCatalogue}
            handleUnarchiveSuggestion={handleUnarchiveSuggestion}
            handleWithdrawSuggestion={handleWithdrawSuggestion}
            isAdmin={isAdmin}
            isConsole={isConsole}
            isCoordination={isCoordination}
            isCoordinationWrite={isCoordinationWrite}
            isDirection={isDirection}
            isDirectionWrite={isDirectionWrite}
            isSuperAdmin={isSuperAdmin}
            loading={loading}
            mySuggestions={mySuggestions}
            openCoordDialog={openCoordDialog}
            originBadge={originBadge}
            pendingCoordinationCount={pendingCoordinationCount}
            pendingDirectionCount={pendingDirectionCount}
            pendingSuggestionsCount={pendingSuggestionsCount}
            setActiveTab={setActiveTab}
            setRejectTarget={setRejectTarget}
            setShowArchivedSuggestions={setShowArchivedSuggestions}
            setSuggDescription={setSuggDescription}
            setSuggTitre={setSuggTitre}
            showArchivedSuggestions={showArchivedSuggestions}
            suggDescription={suggDescription}
            suggSubmitting={suggSubmitting}
            suggTitre={suggTitre}
            user={user}
          />

      {/* Coordination validation dialog */}
      <CoordValidationDialog
            coordDialogFormation={coordDialogFormation}
            coordForm={coordForm}
            handleCoordinationValidate={handleCoordinationValidate}
            setCoordDialogFormation={setCoordDialogFormation}
            setCoordForm={setCoordForm}
            submitting={submitting}
          />

      {/* Reject-with-reason dialog, shared by both stages */}
      <RejectDialog
            rejectMotif={rejectMotif}
            rejectTarget={rejectTarget}
            setRejectMotif={setRejectMotif}
            setRejectTarget={setRejectTarget}
            submitReject={submitReject}
          />
    </div>
  );
}
