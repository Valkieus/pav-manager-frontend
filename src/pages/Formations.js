import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar as CalendarIcon,
  Archive,
  Trash2,
  Edit,
  Users,
  ShieldCheck,
  ArrowRight,
  MapPin,
  BookOpen,
  UserCheck,
  Settings,
  X,
  Check,
  UserX,
  Star,
  HelpCircle,
  Award,
  ExternalLink,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// The 3-step approval chain, used to render the pipeline/stepper UI.
const STEPS = [
  { key: 'demande', label: 'Demande' },
  { key: 'coordination', label: 'Coordination' },
  { key: 'direction', label: 'Validation finale' },
  { key: 'valide', label: 'Validée' },
];

function stepIndexFor(statut) {
  if (statut === 'En attente Coordination') return 0;
  if (statut === 'En attente validation finale') return 1;
  if (statut === 'Validée') return 3;
  if (statut === 'Refusée') return -1; // handled separately
  return 0;
}

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
  const [coordForm, setCoordForm] = useState({ formateur: '', cursus: '', lieu: '', duree: '' });

  // Reject-with-reason dialogs (shared between the two stages)
  const [rejectTarget, setRejectTarget] = useState(null); // { formation, stage: 'coordination' | 'direction' }
  const [rejectMotif, setRejectMotif] = useState('');

  const [form, setForm] = useState({
    titre: '',
    description: '',
    dates_souhaitees: [],
    duree: ''
  });

  // Compétences souhaitées — editable list (Admin/Super Admin), mirrors the
  // postes management pattern used in Effectif.
  const [competences, setCompetences] = useState([]);
  const [competenceManagerOpen, setCompetenceManagerOpen] = useState(false);
  const [newCompetenceLabel, setNewCompetenceLabel] = useState('');
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
  const hasAcademyAccess = isAdminOrReadOnly() || ['academy.examiner', 'academy.formateur', 'academy.student'].some(p => modulePerms.includes(p));
  const [academySsoLoading, setAcademySsoLoading] = useState(false);
  const handleAcademySSO = async () => {
    setAcademySsoLoading(true);
    try {
      const res = await axios.post(`${API}/academy/sso-handoff`, {});
      window.location.href = res.data.redirect_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir PAV Academy");
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
      setNewCompetenceLabel('');
      toast.success('Compétence ajoutée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
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
      const res = await axios.put(`${API}/competences-formation/${encodeURIComponent(renamingCompetence.old)}`, { new_label: newLabel });
      setCompetences(res.data.competences_formation);
      setRenamingCompetence(null);
      toast.success('Compétence renommée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setCompetenceBusy(false);
    }
  };

  const handleDeleteCompetence = async (label) => {
    if (!window.confirm(`Supprimer la compétence "${label}" ?`)) return;
    setCompetenceBusy(true);
    try {
      const res = await axios.delete(`${API}/competences-formation/${encodeURIComponent(label)}`);
      setCompetences(res.data.competences_formation);
      toast.success('Compétence supprimée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setCompetenceBusy(false);
    }
  };

  // Is this user allowed to SEE the Coordination step (tabs, pipeline
  // summary)? Includes Admin (lecture seule), which sees everything.
  const isCoordination = isAdminOrReadOnly() || (
    ['Gestionnaire', 'Responsable'].includes(user?.niveau_acces) &&
    (user?.branches || []).includes('Coordination')
  );
  // Is this user allowed to SEE the Direction (final validation) step?
  // Mirrors the backend's is_direction_or_admin for view purposes.
  const isDirection = isAdminOrReadOnly() || (
    user?.niveau_acces === 'Responsable' && (!user?.branches || user.branches.length === 0)
  );
  // 20/08/2026 (#303) : write-capable variants, used to gate the actual
  // validate/reject/archive buttons — isAdmin() (not isAdminOrReadOnly()),
  // so Admin (lecture seule) no longer sees action buttons that the
  // backend's is_coordination_or_admin/is_direction_or_admin (Admin/Super
  // Admin only, deliberately excluding the read-only role) would 403 on.
  const isCoordinationWrite = isAdmin() || (
    ['Gestionnaire', 'Responsable'].includes(user?.niveau_acces) &&
    (user?.branches || []).includes('Coordination')
  );
  const isDirectionWrite = isAdmin() || (
    user?.niveau_acces === 'Responsable' && (!user?.branches || user.branches.length === 0)
  );

  // Console (Gestionnaire and up) can propose team-wide formations and see the
  // full pipeline; a plain Membre gets the simpler "Mes demandes" + "Catalogue" view.
  const isConsole = ['Gestionnaire', 'Responsable', 'Admin (lecture seule)', 'Admin', 'Super Admin'].includes(user?.niveau_acces);
  const [activeTab, setActiveTab] = useState(isConsole ? 'toutes' : 'mes_demandes');

  const resetForm = () => {
    setForm({ titre: '', description: '', dates_souhaitees: [], duree: '' });
    setEditingId(null);
  };

  const [suggestions, setSuggestions] = useState([]);

  // Catalogue browsing + lightweight topic suggestions — the Membre-facing tab.
  const [catalogue, setCatalogue] = useState([]);
  const [mySuggestions, setMySuggestions] = useState([]);
  const [suggTitre, setSuggTitre] = useState('');
  const [suggDescription, setSuggDescription] = useState('');
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
      toast.error('Merci de préciser un intitulé');
      return;
    }
    setSuggSubmitting(true);
    try {
      await axios.post(`${API}/formation-suggestions`, { titre: suggTitre, description: suggDescription });
      toast.success('Suggestion envoyée à la Coordination');
      setSuggTitre('');
      setSuggDescription('');
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSuggSubmitting(false);
    }
  };

  const alreadyInterested = (formationId) => mySuggestions.some((s) => s.formation_id === formationId);

  const handleExpressInterest = async (f) => {
    try {
      await axios.post(`${API}/formation-suggestions`, { titre: f.titre, description: '', formation_id: f.id });
      toast.success('Votre intérêt a été transmis à la Coordination');
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleWithdrawSuggestion = async (id) => {
    if (!window.confirm('Se retirer de cette formation / retirer cette suggestion ?')) return;
    try {
      await axios.delete(`${API}/formation-suggestions/${id}`);
      toast.success('Retrait effectué');
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const [showArchivedSuggestions, setShowArchivedSuggestions] = useState(false);

  const handleArchiveSuggestion = async (id) => {
    try {
      await axios.put(`${API}/formation-suggestions/${id}/archive`);
      toast.success('Suggestion archivée');
      fetchSuggestions();
      fetchCatalogueData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleUnarchiveSuggestion = async (id) => {
    try {
      await axios.put(`${API}/formation-suggestions/${id}/unarchive`);
      toast.success('Suggestion désarchivée');
      fetchSuggestions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
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
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestions = async () => {
    try {
      const res = await axios.get(`${API}/formation-suggestions?include_archived=true`);
      setSuggestions(res.data);
    } catch (err) {
      // Membre without access — ignore silently
    }
  };

  const handleToggleCatalogue = async (f) => {
    try {
      await axios.put(`${API}/formations/${f.id}/catalogue`, { disponible_catalogue: !f.disponible_catalogue });
      toast.success(!f.disponible_catalogue ? 'Ajoutée au catalogue' : 'Retirée du catalogue');
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleSuggestionStatus = async (id, statut) => {
    try {
      await axios.put(`${API}/formation-suggestions/${id}/status`, { statut });
      toast.success(statut === 'Approuvée' ? 'Suggestion approuvée' : 'Suggestion rejetée');
      fetchSuggestions();
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const wasEditing = !!editingId;
      if (editingId) {
        await axios.put(`${API}/formations/${editingId}`, form);
        toast.success('Formation modifiée');
      } else {
        await axios.post(`${API}/formations`, form);
        toast.success('Demande envoyée à la Coordination');
      }
      setDialogOpen(false);
      resetForm();
      if (wasEditing) {
        navigate('/');
      } else {
        fetchFormations();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (f) => {
    setForm({
      titre: f.titre,
      description: f.description,
      dates_souhaitees: f.dates_souhaitees || [],
      duree: f.duree || ''
    });
    setEditingId(f.id);
    setDialogOpen(true);
  };

  const openCoordDialog = (f) => {
    setCoordForm({
      formateur: f.formateur || '',
      cursus: f.cursus || '',
      lieu: f.lieu || '',
      duree: f.duree || ''
    });
    setCoordDialogFormation(f);
  };

  const handleCoordinationValidate = async (e) => {
    e.preventDefault();
    if (!coordDialogFormation) return;
    setSubmitting(true);
    try {
      await axios.put(`${API}/formations/${coordDialogFormation.id}/coordination-validate`, coordForm);
      toast.success('Transmis à la Direction pour validation finale');
      setCoordDialogFormation(null);
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalValidate = async (id) => {
    try {
      await axios.put(`${API}/formations/${id}/final-validate`);
      toast.success('Formation validée définitivement');
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const { formation, stage } = rejectTarget;
    const endpoint = stage === 'coordination' ? 'coordination-reject' : 'final-reject';
    try {
      await axios.put(`${API}/formations/${formation.id}/${endpoint}`, { motif: rejectMotif || null });
      toast.success('Formation refusée');
      setRejectTarget(null);
      setRejectMotif('');
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleArchive = async (id) => {
    try {
      await axios.put(`${API}/formations/${id}/archive`);
      toast.success('Formation archivée');
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette formation ?')) return;
    try {
      await axios.delete(`${API}/formations/${id}`);
      toast.success('Formation supprimée');
      fetchFormations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'En attente Coordination':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Clock className="w-3 h-3 mr-1" />En attente Coordination</Badge>;
      case 'En attente validation finale':
        return <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400"><ShieldCheck className="w-3 h-3 mr-1" />En attente validation finale</Badge>;
      case 'Validée':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Validée</Badge>;
      case 'Refusée':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="w-3 h-3 mr-1" />Refusée</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Mini horizontal stepper showing where a formation stands in the chain.
  const Stepper = ({ f }) => {
    if (f.statut === 'Refusée') {
      const stageLabel = f.refused_stage === 'direction' ? 'Validation finale' : 'Coordination';
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
              className={`w-2 h-2 rounded-full ${idx <= current ? 'bg-primary' : 'bg-muted'}`}
              title={s.label}
            />
            {idx < STEPS.length - 1 && (
              <div className={`w-4 h-0.5 ${idx < current ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const pendingCoordinationCount = formations.filter((f) => f.statut === 'En attente Coordination' && !f.is_archived).length;
  const pendingDirectionCount = formations.filter((f) => f.statut === 'En attente validation finale' && !f.is_archived).length;
  const myFormations = formations.filter((f) => f.created_by === user?.id && !f.is_archived);
  const pendingSuggestionsCount = suggestions.filter((s) => s.statut === 'En attente' && !s.is_archived).length;
  const activeSuggestions = suggestions.filter((s) => !s.is_archived);
  const archivedSuggestions = suggestions.filter((s) => s.is_archived);

  const filteredFormations = (() => {
    if (!isConsole) return myFormations;
    switch (activeTab) {
      case 'a_traiter': return formations.filter((f) => f.statut === 'En attente Coordination' && !f.is_archived);
      case 'a_valider': return formations.filter((f) => f.statut === 'En attente validation finale' && !f.is_archived);
      case 'validees': return formations.filter((f) => f.statut === 'Validée' && !f.is_archived);
      case 'refusees': return formations.filter((f) => f.statut === 'Refusée' && !f.is_archived);
      case 'archivees': return formations.filter((f) => f.is_archived);
      default: return formations.filter((f) => !f.is_archived);
    }
  })();

  const originBadge = (f) => {
    const label = f.origine === 'proposition_responsable' ? "Proposition d'équipe"
      : f.origine === 'suggestion_membre' ? 'Suggestion approuvée'
      : 'Demande individuelle';
    return <Badge variant="outline" className="text-xs font-normal shrink-0">{label}</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="formations-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Formations</h1>
          <p className="text-muted-foreground">
            {isConsole
              ? 'Demandes & propositions → validation Coordination (formateur, cursus, durée, lieu) → validation finale'
              : 'Faites une demande, suivez son statut, ou parcourez le catalogue'}
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
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="workflow-info-btn">
                <HelpCircle className="w-4 h-4 mr-2" />
                Comment ça marche ?
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Le circuit d'une demande de formation</DialogTitle>
                <DialogDescription>
                  Les 4 étapes par lesquelles passe chaque demande, du dépôt jusqu'à la validation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-1">
                  {STEPS.map((s, idx) => (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" title={s.label} />
                      {idx < STEPS.length - 1 && <div className="h-0.5 bg-primary flex-1 mx-1" />}
                    </div>
                  ))}
                </div>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-medium text-sm">Demande</p>
                      <p className="text-xs text-muted-foreground">
                        Un Technicien fait une demande individuelle ("Faire une demande"), ou un Responsable propose une formation pour son équipe. Une suggestion approuvée (onglet Suggestions) devient aussi une demande à ce stade.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-medium text-sm">En attente Coordination</p>
                      <p className="text-xs text-muted-foreground">
                        La Coordination (Gestionnaire+) examine la demande et renseigne formateur, cursus, lieu et durée avant de la faire avancer — ou la refuse avec un motif.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-medium text-sm">En attente validation finale</p>
                      <p className="text-xs text-muted-foreground">
                        La Direction (Responsable+) valide définitivement ou refuse avec un motif.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                    <div>
                      <p className="font-medium text-sm">Validée</p>
                      <p className="text-xs text-muted-foreground">
                        La formation est confirmée. Les membres intéressés peuvent se manifester ; la Coordination peut la marquer comme terminée/archiver après coup.
                      </p>
                    </div>
                  </li>
                </ol>
                <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p>Une demande refusée à n'importe quelle étape passe directement en <span className="font-medium text-red-600 dark:text-red-400">Refusée</span>, avec le motif indiqué.</p>
                  <p>Sur chaque carte de demande, les points en haut (comme ci-dessus) indiquent où <span className="font-medium text-foreground">cette demande précise</span> se situe dans ce circuit.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWorkflowInfoOpen(false)}>Fermer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 20/08/2026 (#301) : Gestionnaire ajouté — pilote la
              Coordination des Formations, doit pouvoir gérer la liste des
              compétences souhaitées comme Admin/Super Admin. */}
          {(isAdmin() || isSuperAdmin() || user?.niveau_acces === 'Gestionnaire') && (
            <Dialog open={competenceManagerOpen} onOpenChange={setCompetenceManagerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="manage-competences-btn">
                  <Settings className="w-4 h-4 mr-2" />
                  Compétences
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gérer les compétences souhaitées</DialogTitle>
                  <DialogDescription>Liste utilisée dans le formulaire de demande/proposition de formation.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {competences.map((c) => (
                    <div key={c} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                      {renamingCompetence?.old === c ? (
                        <>
                          <Input
                            value={renamingCompetence.value}
                            onChange={(e) => setRenamingCompetence({ old: c, value: e.target.value })}
                            className="h-8"
                          />
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={competenceBusy} onClick={handleRenameCompetenceSave}>
                              <Check className="w-4 h-4 text-emerald-600" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setRenamingCompetence(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">{c}</span>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setRenamingCompetence({ old: c, value: c })}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" disabled={competenceBusy} onClick={() => handleDeleteCompetence(c)}>
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
                    placeholder="Nouvelle compétence..."
                  />
                  <Button disabled={competenceBusy || !newCompetenceLabel.trim()} onClick={handleAddCompetence}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" data-testid="add-formation-btn">
                <Plus className="w-4 h-4 mr-2" />
                {isConsole ? 'Proposer une formation' : 'Faire une demande'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Modifier' : (isConsole ? 'Proposer une' : 'Demande de')} formation</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Modifiez les informations' : 'Cette demande sera soumise à la Coordination'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Compétence souhaitée *</Label>
                  <Select
                    value={form.titre}
                    onValueChange={(v) => setForm({ ...form, titre: v })}
                  >
                    <SelectTrigger data-testid="formation-titre">
                      <SelectValue placeholder="Sélectionner une compétence" />
                    </SelectTrigger>
                    <SelectContent>
                      {competences.map((comp) => (
                        <SelectItem key={comp} value={comp}>{comp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description / Objectifs *</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                    rows={3}
                    placeholder="Décrivez vos objectifs d'apprentissage..."
                    data-testid="formation-description"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date(s) souhaitée(s) *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-start font-normal" data-testid="formation-date">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {form.dates_souhaitees.length === 0
                            ? 'Choisir un ou plusieurs jours'
                            : `${form.dates_souhaitees.length} jour(s) sélectionné(s)`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="multiple"
                          selected={form.dates_souhaitees.map((d) => new Date(d + 'T00:00:00'))}
                          onSelect={(days) => setForm({
                            ...form,
                            dates_souhaitees: (days || []).map((d) => d.toISOString().slice(0, 10)).sort()
                          })}
                        />
                      </PopoverContent>
                    </Popover>
                    {form.dates_souhaitees.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {form.dates_souhaitees.map((d) => (
                          <Badge key={d} variant="secondary" className="text-xs font-normal">
                            {new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Durée estimée *</Label>
                    <Input
                      value={form.duree}
                      onChange={(e) => setForm({ ...form, duree: e.target.value })}
                      placeholder="ex: 2 jours"
                      required
                      data-testid="formation-duree"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting} data-testid="formation-submit">
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingId ? 'Modifier' : 'Envoyer la demande'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          {isConsole ? (
            <>
              {isCoordination && (
                <TabsTrigger value="a_traiter" data-testid="tab-a-traiter">
                  À traiter{pendingCoordinationCount > 0 ? ` (${pendingCoordinationCount})` : ''}
                </TabsTrigger>
              )}
              {isDirection && (
                <TabsTrigger value="a_valider" data-testid="tab-a-valider">
                  À valider{pendingDirectionCount > 0 ? ` (${pendingDirectionCount})` : ''}
                </TabsTrigger>
              )}
              <TabsTrigger value="validees" data-testid="tab-validees">Validées</TabsTrigger>
              <TabsTrigger value="refusees" data-testid="tab-refusees">Refusées</TabsTrigger>
              <TabsTrigger value="toutes" data-testid="tab-toutes">Toutes</TabsTrigger>
              <TabsTrigger value="suggestions" data-testid="tab-suggestions">
                Suggestions{pendingSuggestionsCount > 0 ? ` (${pendingSuggestionsCount})` : ''}
              </TabsTrigger>
              {(isAdmin() || isSuperAdmin()) && (
                <TabsTrigger value="archivees" data-testid="tab-archivees">Archivées</TabsTrigger>
              )}
            </>
          ) : (
            <>
              <TabsTrigger value="mes_demandes" data-testid="tab-mes-demandes">Mes demandes</TabsTrigger>
              <TabsTrigger value="catalogue" data-testid="tab-catalogue">Catalogue</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6 mt-0">
        {activeTab === 'catalogue' ? (
          <div className="space-y-5">
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <p className="font-medium flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  Suggérer un sujet de formation
                </p>
                <form onSubmit={handleSuggestFormation} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Intitulé *</Label>
                      <Input value={suggTitre} onChange={(e) => setSuggTitre(e.target.value)} placeholder="Ex: Étalonnage avancé" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Description (optionnel)</Label>
                      <Input value={suggDescription} onChange={(e) => setSuggDescription(e.target.value)} placeholder="Pourquoi cette formation vous intéresse..." />
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={suggSubmitting}>
                    {suggSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Envoyer la suggestion
                  </Button>
                </form>
                {mySuggestions.filter((s) => !s.formation_id).length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    {mySuggestions.filter((s) => !s.formation_id).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-1.5">
                        <span>{s.titre}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={
                            s.statut === 'Approuvée' ? 'text-emerald-600' : s.statut === 'Rejetée' ? 'text-red-600' : 'text-amber-600'
                          }>{s.statut}</span>
                          {s.statut === 'En attente' && (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleWithdrawSuggestion(s.id)}>
                              Retirer
                            </Button>
                          )}
                          {s.statut !== 'En attente' && (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleArchiveSuggestion(s.id)}>
                              <Archive className="w-3 h-3 mr-1" /> Archiver
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Formations disponibles</p>
              {catalogue.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Aucune formation au catalogue pour le moment</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catalogue.map((f) => {
                    const mySugg = mySuggestions.find((s) => s.formation_id === f.id);
                    return (
                      <Card key={f.id}>
                        <CardContent className="p-4 space-y-2">
                          <p className="font-semibold">{f.titre}</p>
                          {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                          {mySugg ? (
                            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleWithdrawSuggestion(mySugg.id)}>
                              <UserX className="w-4 h-4 mr-1" /> Se retirer
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => handleExpressInterest(f)}>
                              Je suis intéressé(e)
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'suggestions' ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowArchivedSuggestions((v) => !v)}>
                <Archive className="w-4 h-4 mr-1.5" />
                {showArchivedSuggestions ? 'Voir les actives' : `Voir les archivées${archivedSuggestions.length > 0 ? ` (${archivedSuggestions.length})` : ''}`}
              </Button>
            </div>
            {(showArchivedSuggestions ? archivedSuggestions : activeSuggestions).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {showArchivedSuggestions ? 'Aucune suggestion archivée' : 'Aucune suggestion pour le moment'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              (showArchivedSuggestions ? archivedSuggestions : activeSuggestions).map((s) => (
                <Card key={s.id} className={showArchivedSuggestions ? 'opacity-70' : ''}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{s.titre}</p>
                        <Badge variant="outline" className="text-xs font-normal">
                          {s.formation_id ? 'Intérêt catalogue' : 'Nouveau sujet'}
                        </Badge>
                        <span className={`text-xs ${
                          s.statut === 'Approuvée' ? 'text-emerald-600' : s.statut === 'Rejetée' ? 'text-red-600' : 'text-amber-600'
                        }`}>{s.statut}</span>
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Par {s.created_by_name}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!showArchivedSuggestions && isCoordinationWrite && s.statut === 'En attente' && (
                        <>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleSuggestionStatus(s.id, 'Rejetée')}>
                            <XCircle className="w-4 h-4 mr-1" /> Rejeter
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSuggestionStatus(s.id, 'Approuvée')}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approuver
                          </Button>
                        </>
                      )}
                      {!showArchivedSuggestions && s.statut !== 'En attente' && (isCoordinationWrite || s.created_by === user?.id) && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleArchiveSuggestion(s.id)}>
                          <Archive className="w-4 h-4 mr-1" /> Archiver
                        </Button>
                      )}
                      {showArchivedSuggestions && isCoordinationWrite && (
                        <Button size="sm" variant="ghost" onClick={() => handleUnarchiveSuggestion(s.id)}>
                          Désarchiver
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
        <>
        {/* Pipeline summary — visible to whoever can act on at least one stage */}
        {isConsole && activeTab === 'toutes' && (isCoordination || isDirection) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className={pendingCoordinationCount > 0 && isCoordination ? 'border-amber-300 dark:border-amber-800' : ''}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">À traiter — Coordination</p>
                  <p className="text-2xl font-bold">{pendingCoordinationCount}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
              </CardContent>
            </Card>
            <Card className={pendingDirectionCount > 0 && isDirection ? 'border-violet-300 dark:border-violet-800' : ''}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">À traiter — Validation finale</p>
                  <p className="text-2xl font-bold">{pendingDirectionCount}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-violet-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lightweight pointer to the dedicated "Suggestions" tab — the full
            list (all statuses, new topics + catalogue interest) lives there. */}
        {isConsole && activeTab === 'toutes' && pendingSuggestionsCount > 0 && (
          <Card className="border-blue-300 dark:border-blue-800">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <p className="text-sm flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                {pendingSuggestionsCount} suggestion(s) de membres en attente
              </p>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('suggestions')}>
                Voir les suggestions
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Member's own topic suggestions also live under "Mes demandes" so
            they can track everything they've submitted in one place. */}
        {!isConsole && activeTab === 'mes_demandes' && mySuggestions.filter((s) => !s.formation_id).length > 0 && (
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Mes suggestions de sujet</p>
            <div className="space-y-2">
              {mySuggestions.filter((s) => !s.formation_id).map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{s.titre}</p>
                      <span className={`text-xs ${
                        s.statut === 'Approuvée' ? 'text-emerald-600' : s.statut === 'Rejetée' ? 'text-red-600' : 'text-amber-600'
                      }`}>{s.statut}</span>
                    </div>
                    {s.statut === 'En attente' && (
                      <Button size="sm" variant="ghost" onClick={() => handleWithdrawSuggestion(s.id)}>
                        Retirer
                      </Button>
                    )}
                    {s.statut !== 'En attente' && (
                      <Button size="sm" variant="ghost" onClick={() => handleArchiveSuggestion(s.id)}>
                        <Archive className="w-4 h-4 mr-1" /> Archiver
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : filteredFormations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {!isConsole && activeTab === 'mes_demandes' ? "Vous n'avez pas encore fait de demande" : 'Aucune formation dans cette vue'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredFormations.map((f) => (
              <Card key={f.id} className="card-hover">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{f.titre}</p>
                            {isConsole && originBadge(f)}
                          </div>
                          <p className="text-xs text-muted-foreground">Demandé par {f.created_by_name}</p>
                        </div>
                      </div>
                      {getStatusBadge(f.statut)}
                    </div>

                  <Stepper f={f} />

                  <p className="text-sm text-muted-foreground">{f.description}</p>

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {f.dates_souhaitees && f.dates_souhaitees.length > 0
                        ? f.dates_souhaitees.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })).join(', ')
                        : '-'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {f.duree || '-'}
                    </span>
                    {f.formateur && (
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        {f.formateur}
                      </span>
                    )}
                    {f.cursus && (
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        {f.cursus}
                      </span>
                    )}
                    {f.lieu && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {f.lieu}
                      </span>
                    )}
                  </div>

                  {f.statut === 'Refusée' && f.motif_refus && (
                    <p className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-2">
                      Motif du refus : {f.motif_refus}
                    </p>
                  )}

                  {f.statut === 'Validée' && isConsole && f.interested_members && f.interested_members.length > 0 && (
                    <div className="flex items-start gap-1.5 text-sm">
                      <Star className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">
                        {f.interested_members.length} membre(s) intéressé(e)s : {f.interested_members.join(', ')}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border">
                    {f.statut === 'En attente Coordination' && f.created_by === user?.id && (
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(f)}>
                        <Edit className="w-4 h-4 mr-1" /> Modifier
                      </Button>
                    )}

                    {f.statut === 'En attente Coordination' && isCoordinationWrite && (
                      <>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectTarget({ formation: f, stage: 'coordination' })}>
                          <XCircle className="w-4 h-4 mr-1" /> Refuser
                        </Button>
                        <Button size="sm" onClick={() => openCoordDialog(f)}>
                          <ArrowRight className="w-4 h-4 mr-1" /> Valider &amp; transmettre
                        </Button>
                      </>
                    )}

                    {f.statut === 'En attente validation finale' && isDirectionWrite && (
                      <>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectTarget({ formation: f, stage: 'direction' })}>
                          <XCircle className="w-4 h-4 mr-1" /> Refuser
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleFinalValidate(f.id)}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Valider définitivement
                        </Button>
                      </>
                    )}

                    {f.statut === 'Validée' && isCoordinationWrite && (
                      <Button
                        size="sm"
                        variant={f.disponible_catalogue ? 'default' : 'outline'}
                        className={f.disponible_catalogue ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        onClick={() => handleToggleCatalogue(f)}
                      >
                        <BookOpen className="w-4 h-4 mr-1" />
                        {f.disponible_catalogue ? 'Au catalogue' : 'Ajouter au catalogue'}
                      </Button>
                    )}

                    {isAdmin() && !f.is_archived && (
                      <Button size="sm" variant="ghost" onClick={() => handleArchive(f.id)}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                    {isSuperAdmin() && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(f.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
        )}
        </TabsContent>
      </Tabs>

      {/* Coordination validation dialog */}
      <Dialog open={!!coordDialogFormation} onOpenChange={(open) => !open && setCoordDialogFormation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validation Coordination</DialogTitle>
            <DialogDescription>
              Confirmez le formateur, le cursus et le lieu avant de transmettre à la Direction pour validation finale.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCoordinationValidate} className="space-y-4">
            <div className="space-y-2">
              <Label>Formateur *</Label>
              <Input
                value={coordForm.formateur}
                onChange={(e) => setCoordForm({ ...coordForm, formateur: e.target.value })}
                placeholder="Nom du formateur"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cursus *</Label>
              <Input
                value={coordForm.cursus}
                onChange={(e) => setCoordForm({ ...coordForm, cursus: e.target.value })}
                placeholder="Intitulé du cursus / programme"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lieu *</Label>
                <Input
                  value={coordForm.lieu}
                  onChange={(e) => setCoordForm({ ...coordForm, lieu: e.target.value })}
                  placeholder="Ex: Salle 114, en ligne..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Durée confirmée</Label>
                <Input
                  value={coordForm.duree}
                  onChange={(e) => setCoordForm({ ...coordForm, duree: e.target.value })}
                  placeholder="ex: 2 jours"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCoordDialogFormation(null)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Transmettre à la Direction
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject-with-reason dialog, shared by both stages */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectMotif(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
            <DialogDescription>
              {rejectTarget?.formation?.titre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motif (optionnel)</Label>
              <Textarea
                value={rejectMotif}
                onChange={(e) => setRejectMotif(e.target.value)}
                placeholder="Expliquez la raison du refus..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectMotif(''); }}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={submitReject}>
                Confirmer le refus
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
