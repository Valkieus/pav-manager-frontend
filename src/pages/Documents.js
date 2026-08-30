import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Loader2,
  Edit,
  Trash2,
  FolderOpen,
  ExternalLink,
  FileImage,
  File,
  FileSpreadsheet,
  Upload,
  Search,
  Layers,
  Lock,
} from 'lucide-react';

// Rôles pouvant être exclus de la visibilité d'un document. Admin et Super
// Admin voient toujours tout (côté backend), donc ils ne sont pas proposés ici.
const RESTRICTABLE_ROLES = ['Technicien', 'Gestionnaire', 'Responsable'];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FILE_TYPE_STYLE = {
  pdf: { icon: FileText, cls: 'bg-red-500/10 text-red-600' },
  png: { icon: FileImage, cls: 'bg-emerald-500/10 text-emerald-600' },
  jpg: { icon: FileImage, cls: 'bg-emerald-500/10 text-emerald-600' },
  jpeg: { icon: FileImage, cls: 'bg-emerald-500/10 text-emerald-600' },
  gif: { icon: FileImage, cls: 'bg-emerald-500/10 text-emerald-600' },
  webp: { icon: FileImage, cls: 'bg-emerald-500/10 text-emerald-600' },
  docx: { icon: FileText, cls: 'bg-blue-500/10 text-blue-600' },
  xlsx: { icon: FileSpreadsheet, cls: 'bg-green-500/10 text-green-600' },
};

const getFileMeta = (type) => FILE_TYPE_STYLE[type?.toLowerCase()] || { icon: File, cls: 'bg-slate-500/10 text-slate-600' };

// Assigns a stable accent color to each category so the gallery reads as
// organized sections rather than a flat undifferentiated list.
const CATEGORY_COLORS = [
  'border-l-blue-500', 'border-l-emerald-500', 'border-l-violet-500',
  'border-l-amber-500', 'border-l-red-500', 'border-l-cyan-500', 'border-l-pink-500',
];
const colorForCategory = (catId, categories) => {
  const idx = categories.findIndex((c) => c.id === catId);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || 'border-l-border';
};

export default function Documents() {
  const { canManage, isAdmin, isSuperAdmin, user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    titre: '',
    categorie_id: '',
    description: '',
    file_url: '',
    file_type: 'pdf',
    visible_roles: []
  });

  const [categoryForm, setCategoryForm] = useState({
    nom: '',
    description: ''
  });

  const resetForm = () => {
    setForm({ titre: '', categorie_id: '', description: '', file_url: '', file_type: 'pdf', visible_roles: [] });
    setEditingId(null);
  };

  // true si l'utilisateur a activé la restriction pour le document en cours d'édition
  const isRestricted = form.visible_roles.length > 0;

  const toggleRestricted = (on) => {
    // À l'activation, on part de "tous les rôles restrictibles cochés" (rien
    // n'est encore exclu) ; l'utilisateur décoche ensuite ceux à exclure.
    setForm((f) => ({ ...f, visible_roles: on ? [...RESTRICTABLE_ROLES] : [] }));
  };

  const toggleVisibleRole = (role) => {
    setForm((f) => {
      const has = f.visible_roles.includes(role);
      return { ...f, visible_roles: has ? f.visible_roles.filter((r) => r !== role) : [...f.visible_roles, role] };
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 MB)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
      setForm({ ...form, file_url: fileUrl, file_type: res.data.type, titre: form.titre || file.name.split('.')[0] });
      toast.success('Fichier uploadé');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ nom: '', description: '' });
    setEditingCategoryId(null);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docsRes, catsRes] = await Promise.all([
        axios.get(`${API}/documents`),
        axios.get(`${API}/documents/categories`)
      ]);
      setDocuments(docsRes.data);
      setCategories(catsRes.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.categorie_id) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await axios.put(`${API}/documents/${editingId}`, form);
        toast.success('Document modifié');
      } else {
        await axios.post(`${API}/documents`, form);
        toast.success('Document ajouté');
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

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCategoryId) {
        await axios.put(`${API}/documents/categories/${editingCategoryId}`, categoryForm);
        toast.success('Catégorie modifiée');
      } else {
        await axios.post(`${API}/documents/categories`, categoryForm);
        toast.success('Catégorie créée');
      }
      setCategoryDialogOpen(false);
      resetCategoryForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (doc) => {
    setForm({
      titre: doc.titre,
      categorie_id: doc.categorie_id,
      description: doc.description || '',
      file_url: doc.file_url,
      file_type: doc.file_type,
      visible_roles: doc.visible_roles || []
    });
    setEditingId(doc.id);
    setDialogOpen(true);
  };

  const handleEditCategory = (cat) => {
    setCategoryForm({
      nom: cat.nom,
      description: cat.description || ''
    });
    setEditingCategoryId(cat.id);
    setCategoryDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    try {
      await axios.delete(`${API}/documents/${id}`);
      toast.success('Document supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Supprimer cette catégorie ?')) return;
    try {
      await axios.delete(`${API}/documents/categories/${id}`);
      toast.success('Catégorie supprimée');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const getDocCountByCategory = (catId) => documents.filter((d) => d.categorie_id === catId).length;

  const filteredDocuments = documents
    .filter((d) => selectedCategory === 'all' || d.categorie_id === selectedCategory)
    .filter((d) => !search.trim() || d.titre.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6" data-testid="documents-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Base de connaissance</h1>
          <p className="text-muted-foreground">Plans, procédures et fichiers techniques</p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="animate-fadeIn">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Documents</p>
              <p className="text-2xl font-bold">{documents.length}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fadeIn stagger-1">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Catégories</p>
              <p className="text-2xl font-bold">{categories.length}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Layers className="w-5 h-5 text-violet-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {canManage() && <TabsTrigger value="categories">Catégories</TabsTrigger>}
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Rechercher un document..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canManage() && (
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="shadow-lg shadow-primary/20 shrink-0" data-testid="add-document-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un document
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} un document</DialogTitle>
                    <DialogDescription>
                      Uploadez directement un fichier ou ajoutez un lien externe
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Titre *</Label>
                      <Input
                        value={form.titre}
                        onChange={(e) => setForm({ ...form, titre: e.target.value })}
                        required
                        placeholder="Ex: Plan de scène Pâques 2026"
                        data-testid="document-titre"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie *</Label>
                      <Select value={form.categorie_id} onValueChange={(v) => setForm({ ...form, categorie_id: v })}>
                        <SelectTrigger data-testid="document-categorie">
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={2}
                        placeholder="Description du document..."
                        data-testid="document-description"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Fichier</Label>
                      <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          onChange={handleFileUpload}
                        />
                        <label htmlFor="file-upload" className="cursor-pointer">
                          {uploading ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Upload en cours...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="w-8 h-8 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                Cliquez pour uploader un fichier (max 10 MB)
                              </span>
                              <span className="text-xs text-muted-foreground">
                                PDF, PNG, JPG, DOCX, XLSX, PPTX
                              </span>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>URL du fichier {!form.file_url && '*'}</Label>
                      <Input
                        value={form.file_url}
                        onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                        required
                        placeholder="https://... ou uploadez un fichier ci-dessus"
                        data-testid="document-url"
                      />
                      {form.file_url && (
                        <p className="text-xs text-emerald-600">✓ Fichier prêt</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Type de fichier</Label>
                      <Select value={form.file_type} onValueChange={(v) => setForm({ ...form, file_type: v })}>
                        <SelectTrigger data-testid="document-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="png">PNG</SelectItem>
                          <SelectItem value="jpg">JPG</SelectItem>
                          <SelectItem value="docx">Word (DOCX)</SelectItem>
                          <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 border-t border-border pt-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRestricted}
                          onChange={(e) => toggleRestricted(e.target.checked)}
                          className="rounded border-input"
                        />
                        <Label className="cursor-pointer mb-0 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5" />
                          Restreindre la visibilité de ce document
                        </Label>
                      </label>
                      {isRestricted && (
                        <div className="pl-6 space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            Décochez les niveaux qui ne doivent pas voir ce document. Admin et Super Admin le voient toujours.
                          </p>
                          {RESTRICTABLE_ROLES.map((role) => (
                            <label key={role} className="flex items-center gap-2 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={form.visible_roles.includes(role)}
                                onChange={() => toggleVisibleRole(role)}
                                className="rounded border-input"
                              />
                              {role}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Tâche #416 : un Responsable n'a pas de sélecteur de branches — son
                        document est automatiquement cantonné à sa/ses propre(s)
                        équipe(s) côté serveur (voir create_document). */}
                    {user?.niveau_acces === 'Responsable' && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-3">
                        Ce document sera visible uniquement par les membres de votre/vos équipe(s)
                        {user?.branches?.length ? ` (${user.branches.join(', ')})` : ''}, ainsi que par la Gestion/l'Administration.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" className="flex-1" disabled={submitting || uploading} data-testid="document-submit">
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingId ? 'Modifier' : 'Ajouter'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {search.trim() ? 'Aucun document ne correspond à votre recherche' : 'Aucun document dans cette catégorie'}
                </p>
                {canManage() && !search.trim() && (
                  <p className="text-sm text-muted-foreground mt-2">Cliquez sur "Ajouter un document" pour commencer</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => {
                const { icon: Icon, cls } = getFileMeta(doc.file_type);
                return (
                  <Card
                    key={doc.id}
                    className={`card-hover border-l-4 ${colorForCategory(doc.categorie_id, categories)}`}
                  >
                    <CardContent className="p-4 flex flex-col gap-3 h-full">
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate" title={doc.titre}>{doc.titre}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">{doc.categorie_nom}</Badge>
                            {doc.visible_roles && doc.visible_roles.length > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs gap-1 border-amber-500/40 text-amber-600"
                                title={`Visible par : ${doc.visible_roles.join(', ')} (+ Admin, Super Admin)`}
                              >
                                <Lock className="w-3 h-3" />
                                Restreint
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {doc.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                      )}

                      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                        <span className="truncate">
                          {doc.created_by_name} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Ouvrir">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                          {canManage() && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEdit(doc)}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {isAdmin() && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(doc.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {canManage() && (
          <TabsContent value="categories" className="space-y-4">
            {/* Tâche #416 : une rubrique créée par un Responsable est privée —
                réservée à lui seul (Gestionnaire+/Admin+ la voient aussi, pour
                supervision, comme le reste ici). */}
            {!isAdmin() && (
              <p className="text-xs text-muted-foreground">
                Les rubriques que vous créez sont visibles uniquement par vous
                (et par la Gestion/l'Administration).
              </p>
            )}
            <div className="flex justify-end">
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                setCategoryDialogOpen(open);
                if (!open) resetCategoryForm();
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="add-category-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Nouvelle catégorie
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingCategoryId ? 'Modifier' : 'Créer'} une catégorie</DialogTitle>
                    <DialogDescription>
                      Les catégories permettent d'organiser vos documents
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCategorySubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nom de la catégorie *</Label>
                      <Input
                        value={categoryForm.nom}
                        onChange={(e) => setCategoryForm({ ...categoryForm, nom: e.target.value })}
                        required
                        placeholder="Ex: Plans de scène"
                        data-testid="category-nom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={categoryForm.description}
                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                        rows={2}
                        placeholder="Description de la catégorie..."
                        data-testid="category-description"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setCategoryDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button type="submit" className="flex-1" disabled={submitting} data-testid="category-submit">
                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {editingCategoryId ? 'Modifier' : 'Créer'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat, idx) => (
                <Card key={cat.id} className={`card-hover border-l-4 ${CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-primary" />
                        <CardTitle className="text-lg">{cat.nom}</CardTitle>
                        {cat.private_to && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Privée{cat.created_by_name ? ` · ${cat.created_by_name}` : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {/* Tâche #416 : le backend (PUT/DELETE) reste réservé à
                            Super Admin ; on ne montre donc plus ces actions à
                            Gestionnaire/Responsable pour éviter un 403 muet. */}
                        {isSuperAdmin() && (
                          <Button size="sm" variant="ghost" onClick={() => handleEditCategory(cat)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {isSuperAdmin() && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {cat.description && (
                      <p className="text-sm text-muted-foreground mb-2">{cat.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
              {categories.length === 0 && (
                <Card className="md:col-span-2 lg:col-span-3">
                  <CardContent className="p-8 text-center">
                    <Layers className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Aucune catégorie créée</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
