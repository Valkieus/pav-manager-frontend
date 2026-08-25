import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  Building2,
  Loader2,
  Clock,
  Link as LinkIcon,
  Calendar,
  Check,
  X,
  Copy,
  Trash2,
  Edit,
  Users,
  ExternalLink,
  CalendarClock,
  ShieldCheck,
  Timer,
  Sparkles,
  Wifi,
  RefreshCw,
  Mail,
  UserPlus,
  Save,
  RotateCcw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TAB_META = {
  salles: { label: 'Salles', icon: Building2 },
  reservations: { label: 'Réservations', icon: CalendarClock },
  liens: { label: 'Liens', icon: LinkIcon },
  creneaux: { label: 'Créneaux', icon: Clock },
  notifications: { label: 'Notifications', icon: Mail },
};

function formatTimeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expiré';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60000))} min restantes`;
  if (hours < 24) return `${hours} h restantes`;
  return `${Math.floor(hours / 24)} j restants`;
}

export default function Salles() {
  const { isAdmin, isSuperAdmin, canValidate } = useAuth();
  const [activeTab, setActiveTab] = useState('salles');
  const [salles, setSalles] = useState([]);
  const [creneaux, setCreneaux] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [shareLinks, setShareLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingReservations, setRefreshingReservations] = useState(false);

  // Notifications tab (email templates + per-case recipients)
  const [templates, setTemplates] = useState([]);
  const [notifSettings, setNotifSettings] = useState({});
  const [techniciensList, setTechniciensList] = useState([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [templateDrafts, setTemplateDrafts] = useState({});
  const [savingTemplate, setSavingTemplate] = useState(null);
  const [newRecipientTech, setNewRecipientTech] = useState({});
  const [newRecipientEmail, setNewRecipientEmail] = useState({});

  // Dialog states
  const [salleDialogOpen, setSalleDialogOpen] = useState(false);
  const [creneauDialogOpen, setCreneauDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingSalle, setEditingSalle] = useState(null);
  const [editingCreneau, setEditingCreneau] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Filter
  const [filterStatut, setFilterStatut] = useState('En attente');

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReservationForReject, setSelectedReservationForReject] = useState(null);
  const [raisonRefus, setRaisonRefus] = useState('');

  // Admin meeting dialog
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    salle_id: '', date: '', creneau_id: '', nom_demandeur: '', raison: ''
  });

  // Forms
  const [salleForm, setSalleForm] = useState({
    nom: '', capacite: '', equipements: '', description: ''
  });
  const [creneauForm, setCreneauForm] = useState({
    nom: '', heure_debut: '', heure_fin: ''
  });
  const [linkForm, setLinkForm] = useState({
    nom: '', duree_heures: 24, mot_de_passe: '', salles_ids: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications' && !notificationsLoaded) {
      fetchNotificationsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchNotificationsData = async () => {
    try {
      const [templatesRes, settingsRes, techRes] = await Promise.all([
        axios.get(`${API}/email-templates`),
        axios.get(`${API}/salles/notification-settings`),
        axios.get(`${API}/techniciens`),
      ]);
      setTemplates(templatesRes.data);
      setNotifSettings(settingsRes.data);
      setTechniciensList(techRes.data);
      const drafts = {};
      templatesRes.data.forEach((t) => {
        drafts[t.key] = { subject: t.subject, bodyText: t.body_lines.join('\n') };
      });
      setTemplateDrafts(drafts);
      setNotificationsLoaded(true);
    } catch (err) {
      toast.error('Erreur lors du chargement des notifications');
    }
  };

  const handleTemplateFieldChange = (key, field, value) => {
    setTemplateDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSaveTemplate = async (key) => {
    setSavingTemplate(key);
    try {
      const draft = templateDrafts[key];
      const body_lines = draft.bodyText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      if (!draft.subject.trim() || body_lines.length === 0) {
        toast.error('Le sujet et le corps du message ne peuvent pas être vides');
        return;
      }
      await axios.put(`${API}/email-templates/${key}`, { subject: draft.subject, body_lines });
      toast.success('Modèle enregistré');
      fetchNotificationsData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSavingTemplate(null);
    }
  };

  const handleResetTemplate = async (key) => {
    if (!window.confirm('Réinitialiser ce modèle au texte par défaut ?')) return;
    try {
      await axios.post(`${API}/email-templates/${key}/reset`);
      toast.success('Modèle réinitialisé');
      fetchNotificationsData();
    } catch (err) {
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  const currentRecipientsPayload = (caseKey) =>
    (notifSettings[caseKey]?.recipients || []).map((r) =>
      r.type === 'technicien' ? { type: 'technicien', id: r.id } : { type: 'email', value: r.value }
    );

  const handleAddRecipientTech = async (caseKey) => {
    const techId = newRecipientTech[caseKey];
    if (!techId) return;
    const updated = [...currentRecipientsPayload(caseKey), { type: 'technicien', id: techId }];
    try {
      await axios.put(`${API}/salles/notification-settings/${caseKey}`, { recipients: updated });
      toast.success('Destinataire ajouté');
      setNewRecipientTech((prev) => ({ ...prev, [caseKey]: '' }));
      fetchNotificationsData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleAddRecipientEmail = async (caseKey) => {
    const email = (newRecipientEmail[caseKey] || '').trim();
    if (!email) return;
    const updated = [...currentRecipientsPayload(caseKey), { type: 'email', value: email }];
    try {
      await axios.put(`${API}/salles/notification-settings/${caseKey}`, { recipients: updated });
      toast.success('Destinataire ajouté');
      setNewRecipientEmail((prev) => ({ ...prev, [caseKey]: '' }));
      fetchNotificationsData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleRemoveRecipient = async (caseKey, index) => {
    const updated = currentRecipientsPayload(caseKey).filter((_, i) => i !== index);
    try {
      await axios.put(`${API}/salles/notification-settings/${caseKey}`, { recipients: updated });
      toast.success('Destinataire retiré');
      fetchNotificationsData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const fetchData = async () => {
    try {
      const [sallesRes, creneauxRes, reservationsRes, linksRes] = await Promise.all([
        axios.get(`${API}/salles`),
        axios.get(`${API}/creneaux`),
        axios.get(`${API}/reservations`),
        axios.get(`${API}/share-links`)
      ]);
      setSalles(sallesRes.data);
      setCreneaux(creneauxRes.data);
      setReservations(reservationsRes.data);
      setShareLinks(linksRes.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshReservations = async () => {
    setRefreshingReservations(true);
    try {
      const prevPendingIds = new Set(reservations.filter(r => r.statut === 'En attente').map(r => r.id));
      const res = await axios.get(`${API}/reservations`);
      setReservations(res.data);
      const newPendingCount = res.data.filter(r => r.statut === 'En attente' && !prevPendingIds.has(r.id)).length;
      if (newPendingCount > 0) {
        toast.success(`${newPendingCount} nouvelle${newPendingCount > 1 ? 's' : ''} demande${newPendingCount > 1 ? 's' : ''} de réservation`);
      } else {
        toast.info('Aucune nouvelle demande');
      }
    } catch (err) {
      toast.error('Erreur lors de l\'actualisation');
    } finally {
      setRefreshingReservations(false);
    }
  };

  // Salle handlers
  const handleSalleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = {
        ...salleForm,
        capacite: salleForm.capacite ? parseInt(salleForm.capacite) : null
      };
      if (editingSalle) {
        await axios.put(`${API}/salles/${editingSalle.id}`, data);
        toast.success('Salle modifiée');
      } else {
        await axios.post(`${API}/salles`, data);
        toast.success('Salle créée');
      }
      setSalleDialogOpen(false);
      setSalleForm({ nom: '', capacite: '', equipements: '', description: '' });
      setEditingSalle(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSalle = (salle) => {
    setSalleForm({
      nom: salle.nom,
      capacite: salle.capacite?.toString() || '',
      equipements: salle.equipements || '',
      description: salle.description || ''
    });
    setEditingSalle(salle);
    setSalleDialogOpen(true);
  };

  const handleDeleteSalle = async (id) => {
    if (!window.confirm('Supprimer cette salle ?')) return;
    try {
      await axios.delete(`${API}/salles/${id}`);
      toast.success('Salle supprimée');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // Creneau handlers
  const handleCreneauSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCreneau) {
        await axios.put(`${API}/creneaux/${editingCreneau.id}`, creneauForm);
        toast.success('Créneau modifié');
      } else {
        await axios.post(`${API}/creneaux`, creneauForm);
        toast.success('Créneau créé');
      }
      setCreneauDialogOpen(false);
      setCreneauForm({ nom: '', heure_debut: '', heure_fin: '' });
      setEditingCreneau(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCreneau = async (id) => {
    if (!window.confirm('Supprimer ce créneau ?')) return;
    try {
      await axios.delete(`${API}/creneaux/${id}`);
      toast.success('Créneau supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // Share link handlers
  const handleLinkSubmit = async (e) => {
    e.preventDefault();
    if (linkForm.salles_ids.length === 0) {
      toast.error('Sélectionnez au moins une salle');
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        ...linkForm,
        mot_de_passe: linkForm.mot_de_passe || null
      };
      await axios.post(`${API}/share-links`, data);
      toast.success('Lien créé');
      setLinkDialogOpen(false);
      setLinkForm({ nom: '', duree_heures: 24, mot_de_passe: '', salles_ids: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async (id) => {
    if (!window.confirm('Désactiver ce lien ?')) return;
    try {
      await axios.delete(`${API}/share-links/${id}`);
      toast.success('Lien désactivé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const copyLinkToClipboard = (token) => {
    const url = `${window.location.origin}/reservation/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Lien copié !');
  };

  // Reservation handlers
  const refetchReservationsOnly = async () => {
    try {
      const res = await axios.get(`${API}/reservations`);
      setReservations(res.data);
    } catch (err) {
      // silent — the action itself already succeeded, this is just the list refresh
    }
  };

  const handleValidateReservation = async (id) => {
    try {
      await axios.put(`${API}/reservations/${id}/validate`);
      toast.success('Réservation validée');
      refetchReservationsOnly();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleOpenRejectDialog = (reservation) => {
    setSelectedReservationForReject(reservation);
    setRaisonRefus('');
    setRejectDialogOpen(true);
  };

  const handleRejectReservation = async () => {
    if (!raisonRefus.trim()) {
      toast.error('Veuillez indiquer une raison de refus');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`${API}/reservations/${selectedReservationForReject.id}/reject`, {
        raison_refus: raisonRefus
      });
      toast.success('Réservation refusée');
      setRejectDialogOpen(false);
      setSelectedReservationForReject(null);
      setRaisonRefus('');
      refetchReservationsOnly();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin meeting handler
  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/reservations/admin`, {
        ...meetingForm,
        statut: 'Validée'
      });
      toast.success('Réunion créée');
      setMeetingDialogOpen(false);
      setMeetingForm({ salle_id: '', date: '', creneau_id: '', nom_demandeur: '', raison: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredReservations = useMemo(() => {
    if (filterStatut === 'all') return reservations;
    return reservations.filter(r => r.statut === filterStatut);
  }, [reservations, filterStatut]);

  const toggleSalleSelection = (salleId) => {
    setLinkForm(prev => ({
      ...prev,
      salles_ids: prev.salles_ids.includes(salleId)
        ? prev.salles_ids.filter(id => id !== salleId)
        : [...prev.salles_ids, salleId]
    }));
  };

  const getStatutBadge = (statut) => {
    const styles = {
      'En attente': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Validée': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'Refusée': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Annulée': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    };
    return styles[statut] || styles['En attente'];
  };

  const pendingCount = useMemo(() => reservations.filter(r => r.statut === 'En attente').length, [reservations]);
  const activeLinksCount = useMemo(() => shareLinks.filter(l => l.is_active).length, [shareLinks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="salles-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Salles</h1>
            <p className="text-muted-foreground">Réservations, créneaux et liens de partage externes</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3 sm:p-4">
            <p className="text-2xl font-bold">{salles.length}</p>
            <p className="text-xs text-muted-foreground">Salle{salles.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-2xl font-bold">{activeLinksCount}</p>
            <p className="text-xs text-muted-foreground">Lien{activeLinksCount !== 1 ? 's' : ''} actif{activeLinksCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 sm:p-4">
            <p className="text-2xl font-bold">{creneaux.length}</p>
            <p className="text-xs text-muted-foreground">Créneau{creneaux.length !== 1 ? 'x' : ''}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto w-full sm:w-auto sm:grid sm:max-w-2xl sm:grid-cols-5 p-1 gap-1">
          {Object.entries(TAB_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <TabsTrigger key={key} value={key} className="text-xs sm:text-sm px-2 sm:px-3 py-2 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 hidden sm:inline" />
                {meta.label}
                {key === 'reservations' && pendingCount > 0 && (
                  <Badge className="ml-1 h-4 min-w-4 px-1 bg-amber-500 text-white text-[10px] leading-none">{pendingCount}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* SALLES TAB */}
        <TabsContent value="salles" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {isAdmin() && (
              <Dialog open={salleDialogOpen} onOpenChange={(open) => {
                setSalleDialogOpen(open);
                if (!open) {
                  setSalleForm({ nom: '', capacite: '', equipements: '', description: '' });
                  setEditingSalle(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-salle-btn" className="shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une salle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSalle ? 'Modifier' : 'Ajouter'} une salle</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSalleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input
                        value={salleForm.nom}
                        onChange={(e) => setSalleForm({ ...salleForm, nom: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Capacité</Label>
                      <Input
                        type="number"
                        value={salleForm.capacite}
                        onChange={(e) => setSalleForm({ ...salleForm, capacite: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Équipements</Label>
                      <Input
                        value={salleForm.equipements}
                        onChange={(e) => setSalleForm({ ...salleForm, equipements: e.target.value })}
                        placeholder="Sono, Vidéoprojecteur..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={salleForm.description}
                        onChange={(e) => setSalleForm({ ...salleForm, description: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setSalleDialogOpen(false)}>Annuler</Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingSalle ? 'Modifier' : 'Créer'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {salles.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Aucune salle enregistrée</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {salles.map((salle) => (
                <Card key={salle.id} className="card-hover overflow-hidden" data-testid={`salle-${salle.id}`}>
                  <div className="h-1.5 bg-gradient-to-r from-primary to-primary/40" />
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <span className="truncate">{salle.nom}</span>
                      </span>
                      {isAdmin() && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditSalle(salle)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {isSuperAdmin() && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteSalle(salle.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {salle.capacite && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{salle.capacite} personnes</span>
                      </div>
                    )}
                    {salle.equipements && (
                      <div className="flex flex-wrap gap-1">
                        {salle.equipements.split(',').map((eq, i) => eq.trim() && (
                          <Badge key={i} variant="secondary" className="text-xs font-normal">
                            <Wifi className="w-3 h-3 mr-1" />{eq.trim()}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {salle.description && (
                      <p className="text-xs text-muted-foreground pt-1 border-t">{salle.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* RESERVATIONS TAB */}
        <TabsContent value="reservations" className="space-y-4 mt-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="En attente">En attente</SelectItem>
                <SelectItem value="Validée">Validées</SelectItem>
                <SelectItem value="Refusée">Refusées</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredReservations.length} réservation(s)</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshReservations}
                disabled={refreshingReservations}
                data-testid="refresh-reservations-btn"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshingReservations ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              {(isAdmin() || isSuperAdmin()) && (
                <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-meeting-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter réunion
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer une réunion</DialogTitle>
                      <DialogDescription>
                        Réservez directement une salle pour une réunion (validée automatiquement)
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMeetingSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Salle *</Label>
                        <Select
                          value={meetingForm.salle_id}
                          onValueChange={(v) => setMeetingForm({...meetingForm, salle_id: v})}
                        >
                          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                          <SelectContent>
                            {salles.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date *</Label>
                          <Input
                            type="date"
                            value={meetingForm.date}
                            onChange={(e) => setMeetingForm({...meetingForm, date: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Créneau *</Label>
                          <Select
                            value={meetingForm.creneau_id}
                            onValueChange={(v) => setMeetingForm({...meetingForm, creneau_id: v})}
                          >
                            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                            <SelectContent>
                              {creneaux.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.nom} ({c.heure_debut}-{c.heure_fin})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Organisateur *</Label>
                        <Input
                          value={meetingForm.nom_demandeur}
                          onChange={(e) => setMeetingForm({...meetingForm, nom_demandeur: e.target.value})}
                          placeholder="Nom de l'organisateur"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Objet de la réunion *</Label>
                        <Textarea
                          value={meetingForm.raison}
                          onChange={(e) => setMeetingForm({...meetingForm, raison: e.target.value})}
                          placeholder="Description de la réunion"
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setMeetingDialogOpen(false)}>Annuler</Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Créer la réunion
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {filteredReservations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Aucune réservation</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((r) => (
                <Card key={r.id} data-testid={`reservation-${r.id}`} className="overflow-hidden">
                  <div className={`h-1 ${r.statut === 'Validée' ? 'bg-emerald-500' : r.statut === 'Refusée' ? 'bg-red-500' : r.statut === 'Annulée' ? 'bg-gray-400' : 'bg-amber-500'}`} />
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={getStatutBadge(r.statut)}>{r.statut}</Badge>
                          <span className="font-medium">{r.salle_nom}</span>
                          {r.created_by_admin && (
                            <Badge variant="outline" className="text-xs"><ShieldCheck className="w-3 h-3 mr-1" />Réunion admin</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {r.date}</p>
                          <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" /> {r.creneau_nom} ({r.heure_debut}-{r.heure_fin})</p>
                          <p><span className="text-muted-foreground">Demandeur :</span> {r.nom_demandeur}</p>
                          <p><span className="text-muted-foreground">Email :</span> {r.email || '-'}</p>
                          <p><span className="text-muted-foreground">Téléphone :</span> {r.telephone || '-'}</p>
                          <p className="sm:col-span-2"><span className="text-muted-foreground">Raison :</span> {r.raison}</p>
                        </div>
                        {r.statut === 'Refusée' && r.raison_refus && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                            <p className="text-sm text-red-700 dark:text-red-400">
                              <span className="font-medium">Raison du refus :</span> {r.raison_refus}
                            </p>
                          </div>
                        )}
                      </div>
                      {r.statut === 'En attente' && (isAdmin() || isSuperAdmin()) && (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => handleValidateReservation(r.id)}>
                            <Check className="w-4 h-4 mr-1" /> Valider
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleOpenRejectDialog(r)}>
                            <X className="w-4 h-4 mr-1" /> Refuser
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LIENS TAB */}
        <TabsContent value="liens" className="space-y-4 mt-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Un lien de partage permet à une personne — au sein du PAV ou totalement externe — de réserver
                elle-même une salle sur une page dédiée, sans compte. Vous recevez sa demande ici pour validation.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-link-btn" className="shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un lien
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Créer un lien de partage</DialogTitle>
                  <DialogDescription>
                    Ce lien permettra à des personnes externes de réserver une salle
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLinkSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nom / Description *</Label>
                    <Input
                      value={linkForm.nom}
                      onChange={(e) => setLinkForm({ ...linkForm, nom: e.target.value })}
                      placeholder="Ex: Lien pour le groupe XYZ"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Durée de validité *</Label>
                    <Select
                      value={String(linkForm.duree_heures)}
                      onValueChange={(v) => setLinkForm({ ...linkForm, duree_heures: parseInt(v) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 heure</SelectItem>
                        <SelectItem value="24">24 heures</SelectItem>
                        <SelectItem value="168">7 jours</SelectItem>
                        <SelectItem value="720">30 jours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe (optionnel)</Label>
                    <Input
                      type="password"
                      value={linkForm.mot_de_passe}
                      onChange={(e) => setLinkForm({ ...linkForm, mot_de_passe: e.target.value })}
                      placeholder="Laisser vide pour aucun mot de passe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Salles accessibles *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg">
                      {salles.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkForm.salles_ids.includes(s.id)}
                            onChange={() => toggleSalleSelection(s.id)}
                            className="rounded"
                          />
                          <span className="text-sm">{s.nom}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Créer le lien
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {shareLinks.filter(l => l.is_active).length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <LinkIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">Aucun lien actif</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shareLinks.filter(l => l.is_active).map((link) => (
                <Card key={link.id} data-testid={`link-${link.id}`} className="card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <LinkIcon className="w-4 h-4 text-primary" />
                        </div>
                        <p className="font-medium truncate">{link.nom}</p>
                      </div>
                      <Badge variant={link.has_password ? 'secondary' : 'outline'} className="text-xs shrink-0">
                        {link.has_password ? '🔒 Protégé' : '🔓 Ouvert'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                      <Timer className="w-3.5 h-3.5" />
                      {formatTimeLeft(link.expires_at)} · expire le {new Date(link.expires_at).toLocaleString('fr-FR')}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => copyLinkToClipboard(link.token)}>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copier
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/reservation/${link.token}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteLink(link.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CRENEAUX TAB */}
        <TabsContent value="creneaux" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {isAdmin() && (
              <Dialog open={creneauDialogOpen} onOpenChange={(open) => {
                setCreneauDialogOpen(open);
                if (!open) {
                  setCreneauForm({ nom: '', heure_debut: '', heure_fin: '' });
                  setEditingCreneau(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-creneau-btn" className="shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un créneau
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCreneau ? 'Modifier' : 'Ajouter'} un créneau</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreneauSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom *</Label>
                      <Input
                        value={creneauForm.nom}
                        onChange={(e) => setCreneauForm({ ...creneauForm, nom: e.target.value })}
                        placeholder="Ex: Matin, Après-midi..."
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Heure de début *</Label>
                        <Input
                          type="time"
                          value={creneauForm.heure_debut}
                          onChange={(e) => setCreneauForm({ ...creneauForm, heure_debut: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Heure de fin *</Label>
                        <Input
                          type="time"
                          value={creneauForm.heure_fin}
                          onChange={(e) => setCreneauForm({ ...creneauForm, heure_fin: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCreneauDialogOpen(false)}>Annuler</Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingCreneau ? 'Modifier' : 'Créer'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {creneaux.map((creneau) => (
              <Card key={creneau.id} className="card-hover" data-testid={`creneau-${creneau.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{creneau.nom}</span>
                    </div>
                    {isSuperAdmin() && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteCreneau(creneau.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 pl-11">
                    {creneau.heure_debut} - {creneau.heure_fin}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                pav.reservations@gmail.com n'est qu'un tunnel d'envoi technique — personne ne consulte cette boîte.
                Configurez ici qui reçoit réellement chaque type de notification, et personnalisez le texte des emails envoyés.
              </p>
            </CardContent>
          </Card>

          {!notificationsLoaded ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Destinataires par cas</CardTitle>
                  <CardDescription>
                    La confirmation envoyée au demandeur externe n'est pas configurable ici (c'est toujours sa propre adresse).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(notifSettings).map(([caseKey, caseData]) => (
                    <div key={caseKey} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                      <p className="font-medium text-sm">{caseData.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {(caseData.recipients || []).length === 0 && (
                          <span className="text-xs text-muted-foreground italic">
                            Aucun destinataire configuré — utilise l'adresse de secours par défaut.
                          </span>
                        )}
                        {(caseData.recipients || []).map((r, idx) => (
                          <Badge key={idx} variant="secondary" className="gap-1.5 pr-1">
                            {r.type === 'technicien' ? `${r.nom}${r.email ? ` (${r.email})` : ' (pas d\'email)'}` : r.value}
                            {isAdmin() && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRecipient(caseKey, idx)}
                                className="ml-1 rounded-full hover:bg-black/10 p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                      </div>
                      {isAdmin() && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Select
                            value={newRecipientTech[caseKey] || ''}
                            onValueChange={(v) => setNewRecipientTech((prev) => ({ ...prev, [caseKey]: v }))}
                          >
                            <SelectTrigger className="w-[220px] h-8 text-xs">
                              <SelectValue placeholder="Choisir un technicien..." />
                            </SelectTrigger>
                            <SelectContent>
                              {techniciensList.filter((t) => t.email).map((t) => (
                                <SelectItem key={t.id} value={t.id}>{t.nom} ({t.email})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm" variant="outline" className="h-8"
                            onClick={() => handleAddRecipientTech(caseKey)}
                            disabled={!newRecipientTech[caseKey]}
                          >
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Ajouter
                          </Button>
                          <Input
                            className="w-[200px] h-8 text-xs"
                            placeholder="ou une adresse email..."
                            value={newRecipientEmail[caseKey] || ''}
                            onChange={(e) => setNewRecipientEmail((prev) => ({ ...prev, [caseKey]: e.target.value }))}
                          />
                          <Button
                            size="sm" variant="outline" className="h-8"
                            onClick={() => handleAddRecipientEmail(caseKey)}
                            disabled={!(newRecipientEmail[caseKey] || '').trim()}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Modèles d'emails</CardTitle>
                  <CardDescription>
                    Une ligne = un paragraphe. Le HTML simple (ex: &lt;b&gt;texte&lt;/b&gt;) est autorisé.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {templates.map((t) => (
                    <div key={t.key} className="space-y-2 pb-5 border-b last:border-0 last:pb-0">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-medium text-sm">{t.label}</p>
                        {t.is_customized && <Badge variant="outline" className="text-xs">Personnalisé</Badge>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Sujet</Label>
                        <Input
                          value={templateDrafts[t.key]?.subject || ''}
                          onChange={(e) => handleTemplateFieldChange(t.key, 'subject', e.target.value)}
                          disabled={!canValidate()}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Corps du message</Label>
                        <Textarea
                          rows={5}
                          value={templateDrafts[t.key]?.bodyText || ''}
                          onChange={(e) => handleTemplateFieldChange(t.key, 'bodyText', e.target.value)}
                          disabled={!canValidate()}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Variables disponibles : {t.placeholders.map((p) => `{${p}}`).join(', ')}
                      </p>
                      {canValidate() && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={() => handleSaveTemplate(t.key)} disabled={savingTemplate === t.key}>
                            {savingTemplate === t.key ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5 mr-1" />
                            )}
                            Enregistrer
                          </Button>
                          {t.is_customized && (
                            <Button size="sm" variant="outline" onClick={() => handleResetTemplate(t.key)}>
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Réinitialiser
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Reservation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la réservation</DialogTitle>
            <DialogDescription>
              {selectedReservationForReject && (
                <>Réservation de {selectedReservationForReject.nom_demandeur} pour {selectedReservationForReject.salle_nom}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Raison du refus *</Label>
              <Textarea
                value={raisonRefus}
                onChange={(e) => setRaisonRefus(e.target.value)}
                placeholder="Expliquez pourquoi cette réservation est refusée..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleRejectReservation} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmer le refus
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
