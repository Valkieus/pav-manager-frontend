import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

import { toast } from 'sonner';
import { Loader2, CalendarOff, Trash2, Send, ShieldCheck, Download, UserX, GraduationCap, IdCard, Upload, CheckCircle2, AlertCircle, Clock, Repeat, Settings, Check, X, Edit, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { downloadOrShareFile, downloadStatusMessage, reserveTabForIOSFallback } from '../utils/fileDownload';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FREQUENCES = [
  { value: 'hebdomadaire', label: 'Chaque semaine' },
  { value: 'premier_du_mois', label: 'Le 1er du mois' },
];

export default function MonEspace() {
  const { user, isGestionnairePlus } = useAuth();
  const navigate = useNavigate();
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [absenceType, setAbsenceType] = useState('simple'); // 'simple' | 'recurrente'
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [joursRecurrents, setJoursRecurrents] = useState(['dimanche']); // vendredi et/ou dimanche
  const [frequence, setFrequence] = useState('hebdomadaire');
  const [raisonSelect, setRaisonSelect] = useState('');
  const [raisonAutre, setRaisonAutre] = useState('');
  const [editingId, setEditingId] = useState(null); // id de l'absence en cours de modification, null = nouvelle declaration

  const toggleJourRecurrent = (jour) => {
    setJoursRecurrents((prev) =>
      prev.includes(jour) ? prev.filter((j) => j !== jour) : [...prev, jour]
    );
  };

  // Badge — demande / renouvellement, avec photo type "photo d'identité".
  // Stored on the user's own account (works for every account, whether or
  // not it's linked to a technicien record) — starts from the auth context,
  // refreshed via /auth/me after a submission so the status updates live.
  const [badgeInfo, setBadgeInfo] = useState(user);
  const [badgePhotoFile, setBadgePhotoFile] = useState(null);
  const [badgePhotoPreview, setBadgePhotoPreview] = useState(null);
  const [badgeSubmitting, setBadgeSubmitting] = useState(false);
  const [badgeMotif, setBadgeMotif] = useState('');

  const fetchAbsences = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/absences/mine`);
      setAbsences(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement de vos absences');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBadgeInfo = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setBadgeInfo(res.data);
    } catch (err) {
      // Silent — falls back to the value already held from the auth context
    }
  }, []);
  const [enums, setEnums] = useState({ absence_reasons: [] });
  const fetchEnums = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/enums`);
      setEnums(res.data);
    } catch (err) {
      // Silent — the dropdown just falls back to an empty list
    }
  }, []);

  // ---- "Gérer les raisons" (Gestionnaire+) — same add/rename/delete
  // pattern as the postes manager on the Effectif page.
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false);
  const [newReasonLabel, setNewReasonLabel] = useState('');
  const [renamingReason, setRenamingReason] = useState(null); // { old, value }
  const [reasonBusy, setReasonBusy] = useState(false);

  const handleAddReason = async () => {
    const label = newReasonLabel.trim();
    if (!label) return;
    setReasonBusy(true);
    try {
      const res = await axios.post(`${API}/absence-reasons`, { label });
      setEnums((prev) => ({ ...prev, absence_reasons: res.data.absence_reasons }));
      setNewReasonLabel('');
      toast.success('Raison ajoutée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setReasonBusy(false);
    }
  };

  const handleRenameReasonSave = async () => {
    if (!renamingReason) return;
    const newLabel = renamingReason.value.trim();
    if (!newLabel) return;
    setReasonBusy(true);
    try {
      const res = await axios.put(`${API}/absence-reasons/rename`, { old_label: renamingReason.old, new_label: newLabel });
      setEnums((prev) => ({ ...prev, absence_reasons: res.data.absence_reasons }));
      setRenamingReason(null);
      toast.success('Raison renommée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setReasonBusy(false);
    }
  };

  const handleDeleteReason = async (label) => {
    if (!window.confirm(`Supprimer la raison « ${label} » ?`)) return;
    setReasonBusy(true);
    try {
      const res = await axios.post(`${API}/absence-reasons/delete`, { label });
      setEnums((prev) => ({ ...prev, absence_reasons: res.data.absence_reasons }));
      if (raisonSelect === label) setRaisonSelect('');
      toast.success('Raison supprimée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setReasonBusy(false);
    }
  };


  useEffect(() => {
    fetchAbsences();
    fetchBadgeInfo();
    fetchEnums();
  }, [fetchAbsences, fetchBadgeInfo, fetchEnums]);

  const handleBadgePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Merci de fournir une photo au format JPG ou PNG');
      return;
    }
    setBadgePhotoFile(file);
    setBadgePhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmitBadge = async () => {
    if (!badgePhotoFile) {
      toast.error('Merci de sélectionner une photo');
      return;
    }
    if (!badgeMotif.trim()) {
      toast.error('Merci de préciser la raison de la demande');
      return;
    }
    setBadgeSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('photo', badgePhotoFile);
      if (badgeMotif.trim()) formData.append('motif', badgeMotif.trim());
      await axios.post(`${API}/me/badge`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Votre demande a été envoyée');
      setBadgePhotoFile(null);
      setBadgePhotoPreview(null);
      setBadgeMotif('');
      fetchBadgeInfo();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'envoi");
    } finally {
      setBadgeSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const raison = raisonSelect === 'Autre' ? raisonAutre.trim() : raisonSelect;
    if (!dateDebut || !dateFin || !raisonSelect || (raisonSelect === 'Autre' && !raison)) {
      toast.error('Merci de renseigner les dates et la raison');
      return;
    }
    if (dateFin < dateDebut) {
      toast.error('La date de fin doit être après la date de début');
      return;
    }
    if (editingId) {
      setSubmitting(true);
      try {
        await axios.put(`${API}/absences/${editingId}`, { date_debut: dateDebut, date_fin: dateFin, raison });
        toast.success('Absence modifiee et renvoyee');
        setEditingId(null);
        setDateDebut('');
        setDateFin('');
        setRaisonSelect('');
        setRaisonAutre('');
        fetchAbsences();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Erreur lors de la modification");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (absenceType === 'recurrente' && joursRecurrents.length === 0) {
      toast.error('Choisis au moins un jour (vendredi et/ou dimanche)');
      return;
    }
    setSubmitting(true);
    try {
      if (absenceType === 'recurrente') {
        const res = await axios.post(`${API}/absences/recurring`, {
          jours: joursRecurrents,
          frequence,
          date_debut: dateDebut,
          date_fin: dateFin,
          raison,
        });
        const count = res.data?.length || 0;
        if (count === 0) {
          toast.error('Aucune occurrence trouvée dans cette période');
        } else {
          toast.success(`Absence récurrente enregistrée (${count} date${count > 1 ? 's' : ''})`);
        }
      } else {
        await axios.post(`${API}/absences`, { date_debut: dateDebut, date_fin: dateFin, raison });
        toast.success('Absence signalée');
      }
      setDateDebut('');
      setDateFin('');
      setRaisonSelect('');
      setRaisonAutre('');
      fetchAbsences();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/absences/${id}`);
      toast.success('Absence annulée');
      setAbsences((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error("Erreur lors de l'annulation");
    }
  };

  const handleDeleteRecurrence = async (recurrenceId) => {
    if (!window.confirm('Annuler toute la série d\'absences récurrentes liée à cette date ?')) return;
    try {
      const res = await axios.delete(`${API}/absences/recurring/${recurrenceId}`);
      toast.success(res.data?.message || 'Série annulée');
      setAbsences((prev) => prev.filter((a) => a.recurrence_id !== recurrenceId));
    } catch (err) {
      toast.error("Erreur lors de l'annulation de la série");
    }
  };

  const handleEdit = (a) => {
    setEditingId(a.id);
    setAbsenceType('simple');
    setDateDebut(a.date_debut);
    setDateFin(a.date_fin);
    const isKnownReason = (enums.absence_reasons || []).includes(a.raison);
    setRaisonSelect(isKnownReason ? a.raison : 'Autre');
    setRaisonAutre(isKnownReason ? '' : a.raison);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDateDebut('');
    setDateFin('');
    setRaisonSelect('');
    setRaisonAutre('');
  };

  const formatDate = (d) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isUpcoming = (a) => a.date_fin >= new Date().toISOString().slice(0, 10);

  const handleExportData = async () => {
    // Must happen synchronously, before any `await` below, or Safari on iOS
    // silently blocks the fallback tab (see utils/fileDownload.js).
    const preOpenedWindow = reserveTabForIOSFallback();
    try {
      const res = await axios.get(`${API}/me/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const filename = `mes-donnees-pav-${new Date().toISOString().slice(0, 10)}.json`;
      const status = await downloadOrShareFile(blob, filename, { title: filename, preOpenedWindow });
      if (status === 'downloaded') toast.success('Vos données ont été téléchargées');
      else if (status === 'blocked') toast.error(downloadStatusMessage(status));
    } catch (err) {
      if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
      toast.error("Erreur lors de l'export de vos données");
    }
  };

  const handleRequestDeletion = async () => {
    if (!window.confirm("Confirmez-vous vouloir demander la suppression de votre compte ? Un Super Admin traitera votre demande sous 30 jours.")) return;
    try {
      const res = await axios.post(`${API}/me/delete-request`);
      toast.success(res.data.message || 'Demande envoyée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la demande');
    }
  };

  return (
    <div className="space-y-6" data-testid="mon-espace-page">
      <div>
        <h1 className="text-2xl font-bold">Mon espace</h1>
        <p className="text-muted-foreground">
          Bienvenue {user?.full_name?.split(' ')[0]} — signalez vos absences ici, elles seront visibles par les gestionnaires lors de la construction du planning.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarOff className="w-5 h-5 text-primary" />
            Signaler une absence
          </CardTitle>
          {isGestionnairePlus() && (
            <Dialog open={reasonManagerOpen} onOpenChange={(open) => { setReasonManagerOpen(open); if (!open) { setNewReasonLabel(''); setRenamingReason(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Gérer les raisons
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Gérer les raisons</DialogTitle>
                  <DialogDescription>Ajoutez, renommez ou supprimez les raisons proposées dans le formulaire d'absence.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {(enums.absence_reasons || []).map((r) => (
                    <div key={r} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      {renamingReason?.old === r ? (
                        <>
                          <Input
                            className="h-8"
                            value={renamingReason.value}
                            onChange={(e) => setRenamingReason({ ...renamingReason, value: e.target.value })}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" disabled={reasonBusy} onClick={handleRenameReasonSave}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRenamingReason(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm truncate">{r}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setRenamingReason({ old: r, value: r })}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" disabled={reasonBusy} onClick={() => handleDeleteReason(r)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                  {(enums.absence_reasons || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Aucune raison définie.</p>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    placeholder="Nouvelle raison..."
                    value={newReasonLabel}
                    onChange={(e) => setNewReasonLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddReason(); } }}
                  />
                  <Button onClick={handleAddReason} disabled={reasonBusy || !newReasonLabel.trim()}>
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingId && (
              <p className="text-sm rounded-md bg-primary/10 text-primary px-3 py-2">
                Modification de l'absence selectionnee - les nouvelles dates et la raison remplaceront l'ancienne declaration.
              </p>
            )}
            {!editingId && (
            <div className="space-y-2">
              <Label>Type d'absence</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={absenceType === 'simple' ? 'default' : 'outline'}
                  onClick={() => setAbsenceType('simple')}
                >
                  Ponctuelle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={absenceType === 'recurrente' ? 'default' : 'outline'}
                  onClick={() => setAbsenceType('recurrente')}
                >
                  <Repeat className="w-3.5 h-3.5 mr-1.5" /> Récurrente
                </Button>
              </div>
            </div>
            )}

            {absenceType === 'recurrente' && (
              <>
                <div className="space-y-2">
                  <Label>Jour(s) concerné(s)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={joursRecurrents.includes('vendredi') ? 'default' : 'outline'}
                      onClick={() => toggleJourRecurrent('vendredi')}
                    >
                      Vendredi
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={joursRecurrents.includes('dimanche') ? 'default' : 'outline'}
                      onClick={() => toggleJourRecurrent('dimanche')}
                    >
                      Dimanche
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={joursRecurrents.length === 2 ? 'default' : 'outline'}
                      onClick={() => setJoursRecurrents(joursRecurrents.length === 2 ? [] : ['vendredi', 'dimanche'])}
                    >
                      Weekend (les deux)
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fréquence</Label>
                  <Select value={frequence} onValueChange={setFrequence}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{absenceType === 'recurrente' ? "Période (à partir du / jusqu'au)" : 'Dates'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {dateDebut && dateFin
                      ? `${formatDate(dateDebut)} → ${formatDate(dateFin)}`
                      : dateDebut
                        ? `${formatDate(dateDebut)} → ...`
                        : 'Choisir les dates sur le calendrier'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="range"
                    selected={{
                      from: dateDebut ? new Date(dateDebut + 'T00:00:00') : undefined,
                      to: dateFin ? new Date(dateFin + 'T00:00:00') : undefined,
                    }}
                    onSelect={(range) => {
                      setDateDebut(range?.from ? range.from.toISOString().slice(0, 10) : '');
                      setDateFin(range?.to ? range.to.toISOString().slice(0, 10) : '');
                    }}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </div>
            {absenceType === 'recurrente' && (
              <p className="text-xs text-muted-foreground -mt-2">
                {joursRecurrents.length === 0
                  ? 'Choisis au moins un jour ci-dessus.'
                  : frequence === 'hebdomadaire'
                    ? `Une absence sera enregistrée chaque ${joursRecurrents.join(' et chaque ')} entre ces deux dates.`
                    : `Une absence sera enregistrée le premier ${joursRecurrents.join(' et le premier ')} de chaque mois entre ces deux dates.`}
              </p>
            )}
            <div className="space-y-2">
              <Label>Raison</Label>
              <Select value={raisonSelect} onValueChange={setRaisonSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une raison..." />
                </SelectTrigger>
                <SelectContent>
                  {(enums.absence_reasons || []).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {raisonSelect === 'Autre' && (
                <Textarea
                  value={raisonAutre}
                  onChange={(e) => setRaisonAutre(e.target.value)}
                  placeholder="Précisez la raison..."
                  required
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : editingId ? <Edit className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {editingId ? 'Modifier et renvoyer' : 'Envoyer'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mes absences déclarées</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : absences.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aucune absence déclarée pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {absences.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${isUpcoming(a) ? 'border-border' : 'border-border opacity-60'}`}
                >
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1.5">
                      {formatDate(a.date_debut)} → {formatDate(a.date_fin)}
                      {a.recurrence_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          <Repeat className="w-2.5 h-2.5" /> {a.recurrence_label || 'Récurrente'}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.raison}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!a.recurrence_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(a)}
                        title="Modifier cette absence"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => a.recurrence_id ? handleDeleteRecurrence(a.recurrence_id) : handleDelete(a.id)}
                      title={a.recurrence_id ? 'Annuler toute la serie' : 'Annuler cette absence'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-sm">Formations</p>
              <p className="text-xs text-muted-foreground">Faites une demande, suivez son statut, ou parcourez le catalogue</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/formations')}>
            Ouvrir Formations
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IdCard className="w-5 h-5 text-primary" />
            Mon badge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {badgeInfo?.badge_status === 'en_attente_validation' && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Demande en cours de traitement</p>
                <p className="text-xs text-muted-foreground">
                  Votre photo a été envoyée le {new Date(badgeInfo.badge_requested_at).toLocaleDateString('fr-FR')} et est en attente de validation par la coordination.
                </p>
              </div>
            </div>
          )}
          {badgeInfo?.badge_status === 'non_conforme' && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Photo non conforme — merci d'en soumettre une nouvelle</p>
                {badgeInfo.badge_message && (
                  <p className="text-xs text-muted-foreground mt-1">{badgeInfo.badge_message}</p>
                )}
              </div>
            </div>
          )}
          {badgeInfo?.badge_status === 'validee' && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Badge validé</p>
                <p className="text-xs text-muted-foreground">
                  Votre badge a été validé{badgeInfo.badge_reviewed_at ? ` le ${new Date(badgeInfo.badge_reviewed_at).toLocaleDateString('fr-FR')}` : ''}.
                  Vous pouvez soumettre une nouvelle photo en cas de renouvellement.
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {badgeInfo?.badge_status === 'validee'
              ? 'Demander un renouvellement de badge :'
              : 'Demander un badge :'}
            {' '}fournissez une photo récente, nette, visage bien dégagé, de face — proche d'une photo d'identité.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {badgePhotoPreview ? (
              <img src={badgePhotoPreview} alt="Aperçu" className="w-20 h-20 rounded-lg object-cover border border-border" />
            ) : badgeInfo?.badge_photo_url ? (
              <img src={`${process.env.REACT_APP_BACKEND_URL}${badgeInfo.badge_photo_url}`} alt="Photo actuelle" className="w-20 h-20 rounded-lg object-cover border border-border opacity-70" />
            ) : (
              <div className="w-20 h-20 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                <IdCard className="w-8 h-8" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Input type="file" accept="image/png,image/jpeg" onChange={handleBadgePhotoChange} />
              <Textarea
                placeholder="Raison de la demande * — ex : première demande, badge perdu, renouvellement..."
                value={badgeMotif}
                onChange={(e) => setBadgeMotif(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button size="sm" onClick={handleSubmitBadge} disabled={badgeSubmitting || !badgePhotoFile || !badgeMotif.trim()}>
                {badgeSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {badgeInfo?.badge_status === 'validee' ? 'Envoyer pour renouvellement' : 'Envoyer ma demande'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Mes données (RGPD)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Conformément au RGPD, vous pouvez à tout moment télécharger l'ensemble de vos données personnelles ou
            demander la suppression de votre compte. Voir aussi notre <a href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">politique de confidentialité</a>.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" /> Télécharger mes données
            </Button>
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleRequestDeletion}>
              <UserX className="w-4 h-4 mr-2" /> Demander la suppression de mon compte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
