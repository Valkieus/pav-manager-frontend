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
    ChevronUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CONTACT_TYPES = ['Fournisseur', 'Location', 'Réparation'];

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
        etat: ''
    });

  // ---------- Seances (Entrees / Sorties) state ----------
  const [seances, setSeances] = useState([]);
    const [seanceDialogOpen, setSeanceDialogOpen] = useState(false);
    const [seanceSubmitting, setSeanceSubmitting] = useState(false);
    const [expandedSeance, setExpandedSeance] = useState(null);
    const [seanceForm, setSeanceForm] = useState({
        date: '',
        poste: '',
        superviseur: '',
        notes: '',
        equipements: []
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
        notes: ''
    });

  useEffect(() => {
      fetchAll();
  }, []);

  const fetchAll = async () => {
      setLoading(true);
      try {
          const [matRes, enumsRes, catRes, seancesRes, contactsRes] = await Promise.all([
              axios.get(`${API}/materiel`),
              axios.get(`${API}/enums`),
              axios.get(`${API}/materiel/categories`),
              axios.get(`${API}/regisseur-seances`).catch(() => ({ data: [] })),
              axios.get(`${API}/regisseur-contacts`).catch(() => ({ data: [] }))
              ]);
          setMateriel(matRes.data);
          setEnums(enumsRes.data);
          setCategories(catRes.data.categories || []);
          setSeances(seancesRes.data || []);
          setContacts(contactsRes.data || []);
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
          statut: 'Disponible', notes: '', salle: '', groupe: '', date_achat: '', etat: ''
      });
      setEditingId(null);
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
          etat: mat.etat || ''
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
      setSeanceForm({ date: '', poste: '', superviseur: '', notes: '', equipements: [] });
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
          await axios.post(`${API}/regisseur-seances`, seanceForm);
          toast.success('Séance enregistrée');
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
      setContactForm({ nom: '', type_contact: 'Fournisseur', contact: '', email: '', telephone: '', adresse: '', notes: '' });
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
          notes: c.notes || ''
      });
      setContactEditingId(c.id);
      setContactDialogOpen(true);
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

  const SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'entrees-sorties', label: 'Entrées / Sorties', icon: ArrowRightLeft },
    { id: 'stock', label: 'Stock & Inventaire', icon: Boxes },
    { id: 'contact', label: 'Contact', icon: Contact2 }
      ];

  return (
      <div className="space-y-6" data-testid="logistique-page">
      <div>
      <h1 className="text-2xl font-bold">Régisseurs</h1>
  <p className="text-muted-foreground">Gestion du matériel, des entrées/sorties et des contacts du département</p>
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
    <DialogTitle>Nouvelle séance</DialogTitle>
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
  <Input value={seanceForm.poste} onChange={(e) => setSeanceForm({ ...seanceForm, poste: e.target.value })} required />
  </div>
  <div className="space-y-2">
    <Label>Superviseur</Label>
  <Input value={seanceForm.superviseur} onChange={(e) => setSeanceForm({ ...seanceForm, superviseur: e.target.value })} />
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
    <Label>Notes</Label>
  <Textarea value={seanceForm.notes} onChange={(e) => setSeanceForm({ ...seanceForm, notes: e.target.value })} rows={2} />
  </div>
  <Button type="submit" className="w-full" disabled={seanceSubmitting}>
{seanceSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
  Enregistrer
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
      <TableRow key={s.id}>
      <TableCell className="font-medium">{s.date}</TableCell>
                       <TableCell>{s.poste}</TableCell>
                       <TableCell>{s.superviseur || '-'}</TableCell>
                       <TableCell className="text-center">{(s.equipements || []).length}</TableCell>
                       <TableCell className="text-right">
                       <div className="flex justify-end gap-1">
                       <Button size="sm" variant="ghost" onClick={() => setExpandedSeance(expandedSeance === s.id ? null : s.id)}>
                     {expandedSeance === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      {isSuperAdmin() && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteSeance(s.id)}>
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
{(s.equipements || []).map((eq, i) => (
    <div key={i} className="flex gap-4 text-sm">
    <span className="font-medium">{eq.nom}</span>
                             <span className="text-muted-foreground">{eq.personne}</span>
                           {eq.sortie && <Badge variant="outline">Sortie</Badge>}
                            {eq.entree && <Badge variant="outline">Entrée</Badge>}
                              </div>
                               ))}
                            {s.notes && <p className="text-xs text-muted-foreground italic mt-2">{s.notes}</p>}
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
      <TableRow key={m.id}>
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
    <Button size="sm" variant="ghost" onClick={() => handleEdit(m)}><Edit className="w-4 h-4" /></Button>
  )}
{isAdmin() && (
    <Button size="sm" variant="ghost" onClick={() => handleArchive(m.id)}><Archive className="w-4 h-4" /></Button>
  )}
{isSuperAdmin() && (
    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></Button>
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
                      <div className="space-y-2">
     <Label>Notes</Label>
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
    <TableRow key={c.id}>
    <TableCell className="font-medium">{c.nom}</TableCell>
                        <TableCell><Badge variant="outline">{c.type_contact}</Badge></TableCell>
    <TableCell className="text-muted-foreground">{c.contact || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.telephone || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email || '-'}</TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                      {canManage() && (
                          <Button size="sm" variant="ghost" onClick={() => handleEditContact(c)}><Edit className="w-4 h-4" /></Button>
                        )}
{isSuperAdmin() && (
    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteContact(c.id)}><Trash2 className="w-4 h-4" /></Button>
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
