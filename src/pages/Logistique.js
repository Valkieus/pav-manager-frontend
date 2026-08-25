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
  Tag
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Logistique() {
  const { canManage, isAdmin, isSuperAdmin } = useAuth();
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
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [matRes, enumsRes, catRes] = await Promise.all([
        axios.get(`${API}/materiel`),
        axios.get(`${API}/enums`),
        axios.get(`${API}/materiel/categories`)
      ]);
      setMateriel(matRes.data);
      setEnums(enumsRes.data);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      nom: '', categorie: '', quantite: 1, numero_serie: '', marque: '', modele: '', statut: 'Disponible', notes: ''
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
      notes: mat.notes || ''
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
      fetchData();
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
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer définitivement ?')) return;
    try {
      await axios.delete(`${API}/materiel/${id}`);
      toast.success('Matériel supprimé');
      fetchData();
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
      fetchData();
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
      fetchData();
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

  // Stats
  const stats = {
    total: materiel.length,
    disponible: materiel.filter(m => m.statut === 'Disponible').length,
    enUtilisation: materiel.filter(m => m.statut === 'En utilisation').length,
    maintenance: materiel.filter(m => m.statut === 'En maintenance').length
  };

  return (
    <div className="space-y-6" data-testid="logistique-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Régisseurs</h1>
          <p className="text-muted-foreground">Gestion du matériel du département</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isAdmin() && (
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="manage-categories-btn">
                  <Tag className="w-4 h-4 mr-2" />
                  Catégories
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gérer les catégories</DialogTitle>
                  <DialogDescription>Ajoutez ou supprimez des catégories de matériel</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nouvelle catégorie..."
                    />
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
          {canManage() && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="shadow-lg shadow-primary/20" data-testid="add-mat-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter
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
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité *</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={form.quantite} 
                      onChange={(e) => setForm({ ...form, quantite: parseInt(e.target.value) || 1 })} 
                    />
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
                        {enums.statuts_materiel?.filter(s => s !== 'Archivé').map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterCategorie} onValueChange={setFilterCategorie}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
          ) : filteredMateriel.length === 0 ? (
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
                  <TableHead>N° Série</TableHead>
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
                    <TableCell className="text-muted-foreground font-mono text-xs">{m.numero_serie || '-'}</TableCell>
                    <TableCell>{getStatutBadge(m.statut)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canManage() && (
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(m)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {isAdmin() && (
                          <Button size="sm" variant="ghost" onClick={() => handleArchive(m.id)}>
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                        {isSuperAdmin() && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
  );
}
