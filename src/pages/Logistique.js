import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import {
  Plus,
  Package,
  Loader2,
  Edit,
  Archive,
  Trash2,
  Search,
  Settings,
  Tag,
  LayoutDashboard,
  ArrowRightLeft,
  Boxes,
  Contact2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ImagePlus
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CONTACT_TYPES = ['Fournisseur', 'Location', 'Réparation'];
const POSTES_CAM = ['CAM 1', 'CAM 2', 'CAM 3', 'CAM 4', 'CAM 5', 'CAM 6 / 7'];
const FREQUENCE_OPTIONS = ['Ponctuel', 'Récurrent'];

export default function Logistique() {
  const { canManage, isAdmin, isSuperAdmin } = useAuth();
  const [subTab, setSubTab] = useState('dashboard');

  // ---------- Shared / Materiel state ----------
  const [materiel, setMateriel] = useState([]);
  const [enums, setEnums] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('all');
  const [form, setForm] = useState({
    nom: '',
    categorie: '',
    quantite: 1,
    numero_serie: '',
    marque: '',
    modele: '',
    statut: 'Disponible',
    notes: '',
    salle: '',
    groupe: '',
    date_achat: '',
    etat: '',
    reference: '',
    photo_url: ''
  });
  const [uploadingMatPhoto, setUploadingMatPhoto] = useState(false);
  const [uploadingContactPhoto, setUploadingContactPhoto] = useState(false);

  // ---------- Seances (Entrees / Sorties) state ----------
  const [seances, setSeances] = useState([]);
  const [seanceDialogOpen, setSeanceDialogOpen] = useState(false);
  const [seanceEditingId, setSeanceEditingId] = useState(null);
  const [seanceSubmitting, setSeanceSubmitting] = useState(false);
  const [expandedSeance, setExpandedSeance] = useState(null);
  const [seanceForm, setSeanceForm] = useState({
    date: '',
    poste: '',
    superviseur: '',
    horaire_debut: '',
    horaire_fin: '',
    observations: '',
    interventions: '',
    equipements: [],
    equipe: []
  });

  // ---------- Contacts state ----------
  const [contacts, setContacts] = useState([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactEditingId, setContactEditingId] = useState(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [filterContactType, setFilterContactType] = useState('all');
  const [contactForm, setContactForm] = useState({
    nom: '',
    type_contact: 'Fournisseur',
    contact: '',
    email: '',
    telephone: '',
    adresse: '',
    categorie: '',
    notation: '',
    site: '',
    n_siret: '',
    n_client: '',
    notes: '',
    photo_url: ''
  });

  // ---------- Incidents state ----------
  const [incidents, setIncidents] = useState([]);
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [incidentEditingId, setIncidentEditingId] = useState(null);
  const [incidentSubmitting, setIncidentSubmitting] = useState(false);
  const [filterIncidentPoste, setFilterIncidentPoste] = useState('all');
  const [incidentForm, setIncidentForm] = useState({
    poste: 'CAM 1',
    date: '',
    cadreur_regisseur: '',
    equipement_concerne: '',
    frequence: 'Ponctuel',
    description_probleme: '',
    resolution: '',
    date_fin: '',
    responsable_suivi: '',
    commentaire: ''
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [matRes, enumsRes, catRes, seancesRes, contactsRes, incidentsRes] = await Promise.all([
        axios.get(`${API}/materiel`),
        axios.get(`${API}/enums`),
        axios.get(`${API}/materiel/categories`),
        axios.get(`${API}/regisseur-seances`).catch(() => ({ data: [] })),
        axios.get(`${API}/regisseur-contacts`).catch(() => ({ data: [] })),
        axios.get(`${API}/regisseur-incidents`).catch(() => ({ data: [] }))
      ]);
      setMateriel(matRes.data);
      setEnums(enumsRes.data);
      setCategories(catRes.data.categories || []);
      setSeances(seancesRes.data || []);
      setContacts(contactsRes.data || []);
      setIncidents(incidentsRes.data || []);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // ================= MATERIEL (Stock & Inventaire) =================
  const resetForm = () => {
    setForm({
      nom: '', categorie: '', quantite: 1, numero_serie: '', marque: '', modele: '',
      statut: 'Disponible', notes: '', salle: '', groupe: '', date_achat: '', etat: '', reference: '', photo_url: ''
    });
    setEditingId(null);
  };

  const handleMatPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 MB)');
      return;
    }
    if (!['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error("Format d'image non supporté");
      return;
    }
    setUploadingMatPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((f) => ({ ...f, photo_url: res.data.url }));
      toast.success('Photo uploadée');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploadingMatPhoto(false);
      e.target.value = '';
    }
  };

  const handleEdit = (mat) => {
    setForm({
      nom: mat.nom,
      categorie: mat.categorie,
      quantite: mat.quantite || 1,
      numero_serie: mat.numero_serie || '',
      marque: mat.marque || '',
      modele: mat.modele || '',
      statut: mat.statut,
      notes: mat.notes || '',
      salle: mat.salle || '',
      groupe: mat.groupe || '',
      date_achat: mat.date_achat || '',
      etat: mat.etat || '',
      reference: mat.reference || '',
      photo_url: mat.photo_url || ''
    });
    setEditingId(mat.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await axios.put(`${API}/materiel/${editingId}`, form);
        toast.success('Matériel modifié');
      } else {
        await axios.post(`${API}/materiel`, form);
        toast.success('Matériel ajouté');
      }
      setDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archiver ce matériel ?')) return;
    try {
      await axios.put(`${API}/materiel/${id}/archive`);
      toast.success('Matériel archivé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer définitivement ?')) return;
    try {
      await axios.delete(`${API}/materiel/${id}`);
      toast.success('Matériel supprimé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Nom de catégorie requis');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/materiel/categories`, { nom: newCategoryName.trim() });
      toast.success('Catégorie créée');
      setNewCategoryName('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (catName) => {
    if (!window.confirm(`Supprimer la catégorie "${catName}" ?`)) return;
    try {
      await axios.delete(`${API}/materiel/categories/${encodeURIComponent(catName)}`);
      toast.success('Catégorie supprimée');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const getStatutBadge = (statut) => {
    const colors = {
      'Disponible': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      'En utilisation': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'En maintenance': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'Hors service': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return <Badge className={colors[statut] || colors['Disponible']}>{statut}</Badge>;
  };

  const filteredMateriel = materiel.filter(m => {
    const matchSearch = m.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.numero_serie && m.numero_serie.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategorie = filterCategorie === 'all' || m.categorie === filterCategorie;
    return matchSearch && matchCategorie;
  });

  const stats = {
    total: materiel.length,
    disponible: materiel.filter(m => m.statut === 'Disponible').length,
    enUtilisation: materiel.filter(m => m.statut === 'En utilisation').length,
    maintenance: materiel.filter(m => m.statut === 'En maintenance').length
  };

  // ================= SEANCES (Entrees / Sorties) =================
  const resetSeanceForm = () => {
    setSeanceForm({ date: '', poste: '', superviseur: '', horaire_debut: '', horaire_fin: '', observations: '', interventions: '', equipements: [], equipe: [] });
    setSeanceEditingId(null);
  };

  const handleEditSeance = (s) => {
    setSeanceForm({
      date: s.date || '',
      poste: s.poste || '',
      superviseur: s.superviseur || '',
      horaire_debut: s.horaire_debut || '',
      horaire_fin: s.horaire_fin || '',
      observations: s.observations || '',
      interventions: s.interventions || '',
      equipements: s.equipements || [],
      equipe: s.equipe || []
    });
    setSeanceEditingId(s.id);
    setSeanceDialogOpen(true);
  };

  const addEquipeMembre = () => {
    setSeanceForm({ ...seanceForm, equipe: [...seanceForm.equipe, { role: '', nom: '' }] });
  };

  const updateEquipeMembre = (idx, field, value) => {
    const eq = [...seanceForm.equipe];
    eq[idx] = { ...eq[idx], [field]: value };
    setSeanceForm({ ...seanceForm, equipe: eq });
  };

  const removeEquipeMembre = (idx) => {
    const eq = [...seanceForm.equipe];
    eq.splice(idx, 1);
    setSeanceForm({ ...seanceForm, equipe: eq });
  };

  const addEquipementLigne = () => {
    setSeanceForm({
      ...seanceForm,
      equipements: [...seanceForm.equipements, { nom: '', personne: '', sortie: true, entree: false }]
    });
  };

  const updateEquipementLigne = (idx, field, value) => {
    const eqs = [...seanceForm.equipements];
    eqs[idx] = { ...eqs[idx], [field]: value };
    setSeanceForm({ ...seanceForm, equipements: eqs });
  };

  const removeEquipementLigne = (idx) => {
    const eqs = [...seanceForm.equipements];
    eqs.splice(idx, 1);
    setSeanceForm({ ...seanceForm, equipements: eqs });
  };

  const handleSeanceSubmit = async (e) => {
    e.preventDefault();
    if (!seanceForm.date || !seanceForm.poste) {
      toast.error('Date et poste requis');
      return;
    }
    setSeanceSubmitting(true);
    try {
      if (seanceEditingId) {
        await axios.put(`${API}/regisseur-seances/${seanceEditingId}`, seanceForm);
        toast.success('Séance modifiée');
      } else {
        await axios.post(`${API}/regisseur-seances`, seanceForm);
        toast.success('Séance enregistrée');
      }
      setSeanceDialogOpen(false);
      resetSeanceForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSeanceSubmitting(false);
    }
  };

  const handleDeleteSeance = async (id) => {
    if (!window.confirm('Supprimer cette séance ?')) return;
    try {
      await axios.delete(`${API}/regisseur-seances/${id}`);
      toast.success('Séance supprimée');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const sortedSeances = [...seances].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // ================= CONTACTS =================
  const resetContactForm = () => {
    setContactForm({ nom: '', type_contact: 'Fournisseur', contact: '', email: '', telephone: '', adresse: '', categorie: '', notation: '', site: '', n_siret: '', n_client: '', notes: '', photo_url: '' });
    setContactEditingId(null);
  };

  const handleEditContact = (c) => {
    setContactForm({
      nom: c.nom || '',
      type_contact: c.type_contact || 'Fournisseur',
      contact: c.contact || '',
      email: c.email || '',
      telephone: c.telephone || '',
      adresse: c.adresse || '',
      categorie: c.categorie || '',
      notation: c.notation || '',
      site: c.site || '',
      n_siret: c.n_siret || '',
      n_client: c.n_client || '',
      notes: c.notes || '',
      photo_url: c.photo_url || ''
    });
    setContactEditingId(c.id);
    setContactDialogOpen(true);
  };

  const handleContactPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 MB)');
      return;
    }
    if (!['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error("Format d'image non supporté");
      return;
    }
    setUploadingContactPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setContactForm((f) => ({ ...f, photo_url: res.data.url }));
      toast.success('Photo uploadée');
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploadingContactPhoto(false);
      e.target.value = '';
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactSubmitting(true);
    try {
      if (contactEditingId) {
        await axios.put(`${API}/regisseur-contacts/${contactEditingId}`, contactForm);
        toast.success('Contact modifié');
      } else {
        await axios.post(`${API}/regisseur-contacts`, contactForm);
        toast.success('Contact ajouté');
      }
      setContactDialogOpen(false);
      resetContactForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('Supprimer ce contact ?')) return;
    try {
      await axios.delete(`${API}/regisseur-contacts/${id}`);
      toast.success('Contact supprimé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const filteredContacts = contacts.filter(c => filterContactType === 'all' || c.type_contact === filterContactType);

  // ================= INCIDENTS =================
  const resetIncidentForm = () => {
    setIncidentForm({
      poste: 'CAM 1', date: '', cadreur_regisseur: '', equipement_concerne: '',
      frequence: 'Ponctuel', description_probleme: '', resolution: '', date_fin: '',
      responsable_suivi: '', commentaire: ''
    });
    setIncidentEditingId(null);
  };

  const handleEditIncident = (i) => {
    setIncidentForm({
      poste: i.poste || 'CAM 1',
      date: i.date || '',
      cadreur_regisseur: i.cadreur_regisseur || '',
      equipement_concerne: i.equipement_concerne || '',
      frequence: i.frequence || 'Ponctuel',
      description_probleme: i.description_probleme || '',
      resolution: i.resolution || '',
      date_fin: i.date_fin || '',
      responsable_suivi: i.responsable_suivi || '',
      commentaire: i.commentaire || ''
    });
    setIncidentEditingId(i.id);
    setIncidentDialogOpen(true);
  };

  const handleIncidentSubmit = async (e) => {
    e.preventDefault();
    setIncidentSubmitting(true);
    try {
      if (incidentEditingId) {
        await axios.put(`${API}/regisseur-incidents/${incidentEditingId}`, incidentForm);
        toast.success('Incident modifié');
      } else {
        await axios.post(`${API}/regisseur-incidents`, incidentForm);
        toast.success('Incident ajouté');
      }
      setIncidentDialogOpen(false);
      resetIncidentForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setIncidentSubmitting(false);
    }
  };

  const handleArchiveIncident = async (id) => {
    if (!window.confirm('Archiver cet incident ?')) return;
    try {
      await axios.put(`${API}/regisseur-incidents/${id}/archive`);
      toast.success('Incident archivé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDeleteIncident = async (id) => {
    if (!window.confirm('Supprimer cet incident ?')) return;
    try {
      await axios.delete(`${API}/regisseur-incidents/${id}`);
      toast.success('Incident supprimé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const filteredIncidents = incidents
    .filter(i => filterIncidentPoste === 'all' || i.poste === filterIncidentPoste)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'entrees-sorties', label: 'Entrées / Sorties', icon: ArrowRightLeft },
    { id: 'stock', label: 'Stock & Inventaire', icon: Boxes },
    { id: 'contact', label: 'Contact', icon: Contact2 },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle }
  ];

  return (
    <div className="space-y-6" data-testid="logistique-page">
      <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Régisseurs</h1>
        <p className="text-muted-foreground">Gestion du matériel, des entrées/sorties et des contacts du département</p>
      </div>
          <img
    className="hidden md:block h-16 object-contain shrink-0"                  src="data:image/png;base64,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"
                  alt="Branche Régisseur"
                            />
                    </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              variant={subTab === t.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSubTab(t.id)}
              data-testid={`regisseur-tab-${t.id}`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
      ) : (
        <>
          {subTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Matériel total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats.disponible}</p>
                    <p className="text-xs text-muted-foreground">Disponible</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.enUtilisation}</p>
                    <p className="text-xs text-muted-foreground">En utilisation</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
                    <p className="text-xs text-muted-foreground">Maintenance</p>
                  </CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Dernières séances</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {sortedSeances.length === 0 && <p className="text-sm text-muted-foreground">Aucune séance enregistrée</p>}
                    {sortedSeances.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex justify-between text-sm border-b pb-1">
                        <span>{s.date} — {s.poste}</span>
                        <span className="text-muted-foreground">{s.superviseur}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Contacts</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {CONTACT_TYPES.map((t) => (
                      <div key={t} className="flex justify-between text-sm border-b pb-1">
                        <span>{t}</span>
                        <span className="font-semibold">{contacts.filter(c => c.type_contact === t).length}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {subTab === 'entrees-sorties' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                {canManage() && (
                  <Dialog open={seanceDialogOpen} onOpenChange={(open) => { setSeanceDialogOpen(open); if (!open) resetSeanceForm(); }}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-seance-btn"><Plus className="w-4 h-4 mr-2" />Nouvelle séance</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{seanceEditingId ? 'Modifier la séance' : 'Nouvelle séance'}</DialogTitle>
                        <DialogDescription>Enregistrer les entrées/sorties d'équipement</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSeanceSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Date *</Label>
                            <Input type="date" value={seanceForm.date} onChange={(e) => setSeanceForm({ ...seanceForm, date: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Poste *</Label>
                            <Input value={seanceForm.poste} onChange={(e) => setSeanceForm({ ...seanceForm, poste: e.target.value })} required placeholder="ex: CAM 1" />
                          </div>
                          <div className="space-y-2">
                            <Label>Superviseur</Label>
                            <Input value={seanceForm.superviseur} onChange={(e) => setSeanceForm({ ...seanceForm, superviseur: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Heure sortie</Label>
                            <Input value={seanceForm.horaire_debut} onChange={(e) => setSeanceForm({ ...seanceForm, horaire_debut: e.target.value })} placeholder="ex: 8h30" />
                          </div>
                          <div className="space-y-2">
                            <Label>Heure entrée</Label>
                            <Input value={seanceForm.horaire_fin} onChange={(e) => setSeanceForm({ ...seanceForm, horaire_fin: e.target.value })} placeholder="ex: 15h12" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Équipe (Cadreur / Assistant / Régisseur...)</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addEquipeMembre}>
                              <Plus className="w-3 h-3 mr-1" />Ajouter
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {seanceForm.equipe.map((m, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-2 border rounded p-2">
                                <Input
                                  className="w-28"
                                  placeholder="Rôle (C/A/R)"
                                  value={m.role}
                                  onChange={(e) => updateEquipeMembre(idx, 'role', e.target.value)}
                                />
                                <Input
                                  className="flex-1 min-w-[140px]"
                                  placeholder="Nom"
                                  value={m.nom}
                                  onChange={(e) => updateEquipeMembre(idx, 'nom', e.target.value)}
                                />
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeEquipeMembre(idx)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                            {seanceForm.equipe.length === 0 && (
                              <p className="text-xs text-muted-foreground">Aucun membre d'équipe ajouté</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Équipements</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addEquipementLigne}>
                              <Plus className="w-3 h-3 mr-1" />Ajouter une ligne
                            </Button>
                          </div>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {seanceForm.equipements.map((eq, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-2 border rounded p-2">
                                <Input
                                  className="flex-1 min-w-[140px]"
                                  placeholder="Équipement"
                                  value={eq.nom}
                                  onChange={(e) => updateEquipementLigne(idx, 'nom', e.target.value)}
                                />
                                <Input
                                  className="flex-1 min-w-[140px]"
                                  placeholder="Personne"
                                  value={eq.personne}
                                  onChange={(e) => updateEquipementLigne(idx, 'personne', e.target.value)}
                                />
                                <label className="flex items-center gap-1 text-xs">
                                  <input type="checkbox" checked={!!eq.sortie} onChange={(e) => updateEquipementLigne(idx, 'sortie', e.target.checked)} />
                                  Sortie
                                </label>
                                <label className="flex items-center gap-1 text-xs">
                                  <input type="checkbox" checked={!!eq.entree} onChange={(e) => updateEquipementLigne(idx, 'entree', e.target.checked)} />
                                  Entrée
                                </label>
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeEquipementLigne(idx)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            ))}
                            {seanceForm.equipements.length === 0 && (
                              <p className="text-xs text-muted-foreground">Aucune ligne d'équipement — cliquez sur "Ajouter une ligne"</p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Observations</Label>
                          <Textarea value={seanceForm.observations} onChange={(e) => setSeanceForm({ ...seanceForm, observations: e.target.value })} rows={2} />
                        </div>
                        <div className="space-y-2">
                          <Label>Interventions</Label>
                          <Textarea value={seanceForm.interventions} onChange={(e) => setSeanceForm({ ...seanceForm, interventions: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={seanceSubmitting}>
                          {seanceSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {seanceEditingId ? 'Modifier' : 'Enregistrer'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  {sortedSeances.length === 0 ? (
                    <div className="p-8 text-center">
                      <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucune séance enregistrée</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Poste</TableHead>
                          <TableHead>Superviseur</TableHead>
                          <TableHead className="text-center">Équipements</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSeances.map((s) => (
                          <>
                            <TableRow key={s.id} onClick={() => canManage() && handleEditSeance(s)} className={canManage() ? "cursor-pointer hover:bg-muted/50" : ""}>
                              <TableCell className="font-medium">{s.date}</TableCell>
                              <TableCell>{s.poste}</TableCell>
                              <TableCell>{s.superviseur || '-'}</TableCell>
                              <TableCell className="text-center">{(s.equipements || []).length}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setExpandedSeance(expandedSeance === s.id ? null : s.id); }}>
                                    {expandedSeance === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </Button>
                                  {canManage() && (
                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditSeance(s); }}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {isSuperAdmin() && (
                                    <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSeance(s.id); }}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedSeance === s.id && (
                              <TableRow key={`${s.id}-detail`}>
                                <TableCell colSpan={5} className="bg-muted/30">
                                  <div className="space-y-1 py-2">
                                    {(s.equipe || []).length > 0 && (
                                      <div className="flex flex-wrap gap-3 mb-2">
                                        {(s.equipe || []).map((m, i) => (
                                          <span key={i} className="text-sm"><span className="font-medium">{m.role}:</span> {m.nom}</span>
                                        ))}
                                      </div>
                                    )}
                                    {(s.horaire_debut || s.horaire_fin) && (
                                      <p className="text-xs text-muted-foreground mb-2">Horaires: {s.horaire_debut || '-'} → {s.horaire_fin || '-'}</p>
                                    )}
                                    {(s.equipements || []).map((eq, i) => (
                                      <div key={i} className="flex gap-4 text-sm">
                                        <span className="font-medium">{eq.nom}</span>
                                        <span className="text-muted-foreground">{eq.personne}</span>
                                        {eq.sortie && <Badge variant="outline">Sortie</Badge>}
                                        {eq.entree && <Badge variant="outline">Entrée</Badge>}
                                      </div>
                                    ))}
                                    {s.observations && <p className="text-xs text-muted-foreground italic mt-2">Obs: {s.observations}</p>}
                                    {s.interventions && <p className="text-xs text-muted-foreground italic mt-2">Interventions: {s.interventions}</p>}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {subTab === 'stock' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {isAdmin() && (
                    <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" data-testid="manage-categories-btn">
                          <Tag className="w-4 h-4 mr-2" />Catégories
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Gérer les catégories</DialogTitle>
                          <DialogDescription>Ajoutez ou supprimez des catégories de matériel</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nouvelle catégorie..." />
                            <Button onClick={handleAddCategory} disabled={submitting}>
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            </Button>
                          </div>
                          <div className="border rounded-lg p-2 max-h-[300px] overflow-y-auto">
                            {categories.map((cat) => (
                              <div key={cat} className="flex items-center justify-between py-2 px-2 hover:bg-muted rounded">
                                <span className="text-sm">{cat}</span>
                                {isSuperAdmin() && !['Caméra', 'Trépied', 'Batterie', 'Câble', 'Micro', 'Lumière', 'Moniteur', 'Enregistreur', 'Accessoire', 'Autre'].includes(cat) && (
                                  <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(cat)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {canManage() && (
                  <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                      <Button className="shadow-lg shadow-primary/20" data-testid="add-mat-btn">
                        <Plus className="w-4 h-4 mr-2" />Ajouter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} du matériel</DialogTitle>
                        <DialogDescription>Remplissez les informations</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Photo</Label>
                          <div className="flex items-center gap-3">
                            {form.photo_url ? (
                              <img src={`${process.env.REACT_APP_BACKEND_URL}${form.photo_url}`} alt="aperçu" className="w-16 h-16 object-cover rounded border" />
                            ) : (
                              <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                                <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <label className="cursor-pointer">
                                <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                                  {uploadingMatPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  {form.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleMatPhotoUpload} disabled={uploadingMatPhoto} />
                              </label>
                              {form.photo_url && (
                                <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}>
                                  Retirer la photo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nom *</Label>
                            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Catégorie *</Label>
                            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
                              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Référence / sous-catégorie</Label>
                          <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="ex: CAM 1, HDMI..." />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Quantité *</Label>
                            <Input type="number" min="1" value={form.quantite} onChange={(e) => setForm({ ...form, quantite: parseInt(e.target.value) || 1 })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Marque</Label>
                            <Input value={form.marque} onChange={(e) => setForm({ ...form, marque: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Modèle</Label>
                            <Input value={form.modele} onChange={(e) => setForm({ ...form, modele: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>N° Série</Label>
                            <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Statut</Label>
                            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {enums.statuts_materiel?.filter(s => s !== 'Archivé').map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Salle</Label>
                            <Input value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Groupe</Label>
                            <Input value={form.groupe} onChange={(e) => setForm({ ...form, groupe: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date d'achat</Label>
                            <Input type="date" value={form.date_achat} onChange={(e) => setForm({ ...form, date_achat: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>État</Label>
                            <Input value={form.etat} onChange={(e) => setForm({ ...form, etat: e.target.value })} placeholder="Neuf, bon, usé..." />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={submitting}>
                          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {editingId ? 'Modifier' : 'Ajouter'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Select value={filterCategorie} onValueChange={setFilterCategorie}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <Card>
                <CardContent className="p-0">
                  {filteredMateriel.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucun matériel trouvé</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Photo</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-center">Qté</TableHead>
                          <TableHead>Marque / Modèle</TableHead>
                          <TableHead>Salle / Groupe</TableHead>
                          <TableHead>État</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMateriel.map((m) => (
                          <TableRow key={m.id} onClick={() => handleEdit(m)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              {m.photo_url ? (
                                <img
                                  src={`${process.env.REACT_APP_BACKEND_URL}${m.photo_url}`}
                                  alt={m.nom}
                                  width={48}
                                  height={48}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-12 h-12 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                                  <Package className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{m.nom}</TableCell>
                            <TableCell><Badge variant="outline">{m.categorie}</Badge></TableCell>
                            <TableCell className="text-center font-semibold">{m.quantite || 1}</TableCell>
                            <TableCell className="text-muted-foreground">{m.marque} {m.modele}</TableCell>
                            <TableCell className="text-muted-foreground">{m.salle}{m.salle && m.groupe ? ' / ' : ''}{m.groupe}</TableCell>
                            <TableCell className="text-muted-foreground">{m.etat || '-'}</TableCell>
                            <TableCell>{getStatutBadge(m.statut)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canManage() && (
                                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(m); }}><Edit className="w-4 h-4" /></Button>
                                )}
                                {isAdmin() && (
                                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleArchive(m.id); }}><Archive className="w-4 h-4" /></Button>
                                )}
                                {isSuperAdmin() && (
                                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}><Trash2 className="w-4 h-4" /></Button>
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
            </div>
          )}

          {subTab === 'contact' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Select value={filterContactType} onValueChange={setFilterContactType}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous les types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {CONTACT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
                {canManage() && (
                  <Dialog open={contactDialogOpen} onOpenChange={(open) => { setContactDialogOpen(open); if (!open) resetContactForm(); }}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-contact-btn"><Plus className="w-4 h-4 mr-2" />Ajouter un contact</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{contactEditingId ? 'Modifier' : 'Ajouter'} un contact</DialogTitle>
                        <DialogDescription>Fournisseur, location ou réparation</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleContactSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Logo / Photo</Label>
                          <div className="flex items-center gap-3">
                            {contactForm.photo_url ? (
                              <img src={`${process.env.REACT_APP_BACKEND_URL}${contactForm.photo_url}`} alt="aperçu" className="w-16 h-16 object-contain rounded border bg-white" />
                            ) : (
                              <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                                <ImagePlus className="w-6 h-6 text-muted-foreground/40" />
                              </div>
                            )}
                            <div className="flex flex-col gap-1">
                              <label className="cursor-pointer">
                                <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                                  {uploadingContactPhoto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                  {contactForm.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
                                </span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleContactPhotoUpload} disabled={uploadingContactPhoto} />
                              </label>
                              {contactForm.photo_url && (
                                <button type="button" className="text-xs text-muted-foreground hover:text-destructive text-left" onClick={() => setContactForm((f) => ({ ...f, photo_url: '' }))}>
                                  Retirer la photo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nom *</Label>
                            <Input value={contactForm.nom} onChange={(e) => setContactForm({ ...contactForm, nom: e.target.value })} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Type *</Label>
                            <Select value={contactForm.type_contact} onValueChange={(v) => setContactForm({ ...contactForm, type_contact: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {CONTACT_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Contact (personne)</Label>
                            <Input value={contactForm.contact} onChange={(e) => setContactForm({ ...contactForm, contact: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Téléphone</Label>
                            <Input value={contactForm.telephone} onChange={(e) => setContactForm({ ...contactForm, telephone: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Adresse</Label>
                          <Input value={contactForm.adresse} onChange={(e) => setContactForm({ ...contactForm, adresse: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Catégorie</Label>
                            <Input value={contactForm.categorie} onChange={(e) => setContactForm({ ...contactForm, categorie: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Site web</Label>
                            <Input value={contactForm.site} onChange={(e) => setContactForm({ ...contactForm, site: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>N° SIRET</Label>
                            <Input value={contactForm.n_siret} onChange={(e) => setContactForm({ ...contactForm, n_siret: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>N° Client</Label>
                            <Input value={contactForm.n_client} onChange={(e) => setContactForm({ ...contactForm, n_client: e.target.value })} />
                          </div>
                        </div>
                        {contactForm.type_contact === 'Réparation' && (
                          <div className="space-y-2">
                            <Label>Notation</Label>
                            <Input value={contactForm.notation} onChange={(e) => setContactForm({ ...contactForm, notation: e.target.value })} />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Notes / Commentaire</Label>
                          <Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={contactSubmitting}>
                          {contactSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {contactEditingId ? 'Modifier' : 'Ajouter'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  {filteredContacts.length === 0 ? (
                    <div className="p-8 text-center">
                      <Contact2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucun contact trouvé</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Logo</TableHead>
                          <TableHead>Nom</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Téléphone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContacts.map((c) => (
                                      <TableRow key={c.id} onClick={() => handleEditContact(c)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              {c.photo_url ? (
                                <img
                                  src={`${process.env.REACT_APP_BACKEND_URL}${c.photo_url}`}
                                  alt={c.nom}
                                  width={48}
                                  height={48}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-12 h-12 object-contain rounded border bg-white"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                                  <Contact2 className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{c.nom}</TableCell>
                            <TableCell><Badge variant="outline">{c.type_contact}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{c.contact || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{c.telephone || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{c.email || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canManage() && (
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditContact(c); }}><Edit className="w-4 h-4" /></Button>
                                )}
                                {isSuperAdmin() && (
                                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id); }}><Trash2 className="w-4 h-4" /></Button>
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
            </div>
          )}

          {subTab === 'incidents' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Select value={filterIncidentPoste} onValueChange={setFilterIncidentPoste}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tous les postes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les postes</SelectItem>
                    {POSTES_CAM.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                  </SelectContent>
                </Select>
                {canManage() && (
                  <Dialog open={incidentDialogOpen} onOpenChange={(open) => { setIncidentDialogOpen(open); if (!open) resetIncidentForm(); }}>
                    <DialogTrigger asChild>
                      <Button data-testid="add-incident-btn"><Plus className="w-4 h-4 mr-2" />Signaler un incident</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{incidentEditingId ? 'Modifier' : 'Signaler'} un incident</DialogTitle>
                        <DialogDescription>Problème matériel ou technique rencontré sur un poste caméra</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleIncidentSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Poste *</Label>
                            <Select value={incidentForm.poste} onValueChange={(v) => setIncidentForm({ ...incidentForm, poste: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {POSTES_CAM.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={incidentForm.date} onChange={(e) => setIncidentForm({ ...incidentForm, date: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Fréquence</Label>
                            <Select value={incidentForm.frequence} onValueChange={(v) => setIncidentForm({ ...incidentForm, frequence: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {FREQUENCE_OPTIONS.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Cadreur / Régisseur</Label>
                            <Input value={incidentForm.cadreur_regisseur} onChange={(e) => setIncidentForm({ ...incidentForm, cadreur_regisseur: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Équipement concerné</Label>
                            <Input value={incidentForm.equipement_concerne} onChange={(e) => setIncidentForm({ ...incidentForm, equipement_concerne: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description du problème *</Label>
                          <Textarea value={incidentForm.description_probleme} onChange={(e) => setIncidentForm({ ...incidentForm, description_probleme: e.target.value })} rows={2} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Résolution</Label>
                          <Textarea value={incidentForm.resolution} onChange={(e) => setIncidentForm({ ...incidentForm, resolution: e.target.value })} rows={2} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date de fin</Label>
                            <Input type="date" value={incidentForm.date_fin} onChange={(e) => setIncidentForm({ ...incidentForm, date_fin: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Responsable du suivi</Label>
                            <Input value={incidentForm.responsable_suivi} onChange={(e) => setIncidentForm({ ...incidentForm, responsable_suivi: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Commentaire</Label>
                          <Textarea value={incidentForm.commentaire} onChange={(e) => setIncidentForm({ ...incidentForm, commentaire: e.target.value })} rows={2} />
                        </div>
                        <Button type="submit" className="w-full" disabled={incidentSubmitting}>
                          {incidentSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {incidentEditingId ? 'Modifier' : 'Signaler'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  {filteredIncidents.length === 0 ? (
                    <div className="p-8 text-center">
                      <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">Aucun incident signalé</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Poste</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Cadreur / Régisseur</TableHead>
                          <TableHead>Équipement</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Responsable</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIncidents.map((i) => (
                                    <TableRow key={i.id} onClick={() => handleEditIncident(i)} className="cursor-pointer hover:bg-muted/50">
                            <TableCell><Badge variant="outline">{i.poste}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{i.date || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{i.cadreur_regisseur || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{i.equipement_concerne || '-'}</TableCell>
                            <TableCell className="max-w-[280px] truncate" title={i.description_probleme}>{i.description_probleme}</TableCell>
                            <TableCell>
                              {i.date_fin ? (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Résolu</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">En cours</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{i.responsable_suivi || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {canManage() && (
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditIncident(i); }}><Edit className="w-4 h-4" /></Button>
                                )}
                                {isAdmin() && (
                                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleArchiveIncident(i.id); }}><Archive className="w-4 h-4" /></Button>
                                )}
                                {isSuperAdmin() && (
                                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteIncident(i.id); }}><Trash2 className="w-4 h-4" /></Button>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
