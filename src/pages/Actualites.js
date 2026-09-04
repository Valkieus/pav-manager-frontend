import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  Newspaper,
  Loader2,
  Calendar,
  Edit,
  Trash2,
  Upload,
  Sparkles,
  CalendarClock,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Actualites() {
  const { user, isAdmin } = useAuth();
  // 20/08/2026 (#293) : Actualités passe à Gestionnaire+ par défaut —
  // canManage() du contexte est partagé par plusieurs pages et inclut
  // toujours Responsable, donc on n'écrit plus l'accès sur ce helper
  // générique ici. Un Responsable garde l'accès seulement s'il est dans un
  // groupe qui accorde actualites.write (opt-in, même logique que
  // Salles/Régisseurs).
  const canManage = () => {
    if (!user) return false;
    if (['Super Admin', 'Admin', 'Gestionnaire'].includes(user.niveau_acces)) return true;
    if (user.niveau_acces === 'Responsable') return (user.module_permissions || []).includes('actualites.write');
    return false;
  };
  const [actualites, setActualites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    titre: '',
    description: '',
    date_evenement: '',
    date_fin_evenement: '',
    image_url: '',
    invite: false,
    invite_nom: ''
  });
  // Bascule d'affichage seulement — un jour unique OU une période (comme le
  // choix côté absences dans Mon espace). Dérivé de date_fin_evenement au
  // chargement d'un événement existant.
  const [isPeriode, setIsPeriode] = useState(false);

  const resetForm = () => {
    setForm({ titre: '', description: '', date_evenement: '', date_fin_evenement: '', image_url: '', invite: false, invite_nom: '' });
    setIsPeriode(false);
    setEditingId(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 10 MB)');
      return;
    }

    if (!['image/png', 'image/jpg', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('Format d\'image non supporté');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const imageUrl = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
      setForm({ ...form, image_url: imageUrl });
      toast.success('Image uploadée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchActualites();
  }, []);

  const fetchActualites = async () => {
    try {
      const res = await axios.get(`${API}/actualites`);
      setActualites(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPeriode && form.date_evenement && form.date_fin_evenement && form.date_fin_evenement < form.date_evenement) {
      toast.error('La date de fin doit être après la date de début');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, date_fin_evenement: isPeriode ? (form.date_fin_evenement || null) : null };
      if (editingId) {
        await axios.put(`${API}/actualites/${editingId}`, payload);
        toast.success('Actualité modifiée');
      } else {
        await axios.post(`${API}/actualites`, payload);
        toast.success('Actualité créée');
      }
      setDialogOpen(false);
      resetForm();
      fetchActualites();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (a) => {
    setForm({
      titre: a.titre,
      description: a.description || '',
      date_evenement: a.date_evenement || '',
      date_fin_evenement: a.date_fin_evenement || '',
      image_url: a.image_url || '',
      invite: a.invite || false,
      invite_nom: a.invite_nom || ''
    });
    setIsPeriode(!!a.date_fin_evenement);
    setEditingId(a.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette actualité ?')) return;
    try {
      await axios.delete(`${API}/actualites/${id}`);
      toast.success('Actualité supprimée');
      fetchActualites();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Une actualité "période" reste active/à venir tant que sa date de FIN
  // n'est pas passée, même si sa date de début l'est déjà.
  const eventEndDate = (a) => a.date_fin_evenement || a.date_evenement;
  const isPastEvent = (a) => eventEndDate(a) && new Date(eventEndDate(a) + 'T00:00:00') < today;

  // Upcoming/undated events feed the main tab; past events go in their own tab.
  const upcomingActualites = actualites.filter((a) => !isPastEvent(a));
  const pastActualites = [...actualites]
    .filter(isPastEvent)
    .sort((a, b) => new Date(eventEndDate(b)) - new Date(eventEndDate(a)));

  // Sort: upcoming events first (soonest first), then undated events by
  // most recently created — so the page always leads with what's next.
  const sorted = [...upcomingActualites].sort((a, b) => {
    const aDate = a.date_evenement ? new Date(a.date_evenement + 'T00:00:00') : null;
    const bDate = b.date_evenement ? new Date(b.date_evenement + 'T00:00:00') : null;
    const aUpcoming = !isPastEvent(a) && aDate;
    const bUpcoming = !isPastEvent(b) && bDate;
    if (aUpcoming && bUpcoming) return aDate - bDate;
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const [featured, ...rest] = sorted;
  const featuredIsUpcoming = featured?.date_evenement && !isPastEvent(featured);

  // Libellé de date affiché sur les cartes — plage "12 août → 15 août" pour
  // une période, sinon la date seule comme avant.
  const formatEventDate = (a) => {
    if (!a.date_evenement) return null;
    const startLabel = new Date(a.date_evenement + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!a.date_fin_evenement || a.date_fin_evenement === a.date_evenement) return startLabel;
    const endLabel = new Date(a.date_fin_evenement + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${startLabel} → ${endLabel}`;
  };

  const renderActions = (a) => canManage() && (
    <div className="flex gap-1">
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(a)}>
        <Edit className="w-4 h-4" />
      </Button>
      {isAdmin() && (
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(a.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="actualites-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Actualités</h1>
          <p className="text-muted-foreground">Événements à venir du département PAV</p>
        </div>

        {canManage() && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20" data-testid="add-actualite-btn">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle actualité
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Modifier' : 'Créer'} une actualité</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Modifiez les informations' : 'Cette actualité sera visible sur la page de connexion'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Titre de l'événement *</Label>
                  <Input
                    value={form.titre}
                    onChange={(e) => setForm({ ...form, titre: e.target.value })}
                    required
                    placeholder="Ex: Pâques 2026, Concert de Noël..."
                    data-testid="actualite-titre"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Détails de l'événement..."
                    data-testid="actualite-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isPeriode ? 'Date de début' : "Date de l'événement"}</Label>
                  <Input
                    type="date"
                    value={form.date_evenement}
                    onChange={(e) => setForm({ ...form, date_evenement: e.target.value })}
                    data-testid="actualite-date"
                  />
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <Checkbox
                      checked={isPeriode}
                      onCheckedChange={(checked) => setIsPeriode(!!checked)}
                      data-testid="actualite-periode-checkbox"
                    />
                    <span className="text-sm text-muted-foreground">Sur plusieurs jours (période)</span>
                  </label>
                  {isPeriode && (
                    <div className="space-y-1 mt-1">
                      <Label className="text-xs">Date de fin</Label>
                      <Input
                        type="date"
                        value={form.date_fin_evenement}
                        onChange={(e) => setForm({ ...form, date_fin_evenement: e.target.value })}
                        data-testid="actualite-date-fin"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2 border rounded-md p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.invite}
                      onCheckedChange={(checked) => setForm({ ...form, invite: !!checked, invite_nom: checked ? form.invite_nom : '' })}
                      data-testid="actualite-invite-checkbox"
                    />
                    <span className="text-sm font-medium">Cet événement accueille un invité</span>
                  </label>
                  {form.invite && (
                    <Input
                      value={form.invite_nom}
                      onChange={(e) => setForm({ ...form, invite_nom: e.target.value })}
                      placeholder="Nom de l'invité"
                      className="mt-1"
                      data-testid="actualite-invite-nom"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Alimente le rappel "invités ce mois" affiché sur le Dashboard de tous les utilisateurs.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Image (optionnel)</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      id="image-upload-actualite"
                      className="hidden"
                      accept="image/png,image/jpg,image/jpeg,image/gif,image/webp"
                      onChange={handleImageUpload}
                    />
                    <label htmlFor="image-upload-actualite" className="cursor-pointer">
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Upload en cours...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-6 h-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Cliquez pour uploader une image (max 10 MB)
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                  <Input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="Ou collez une URL https://..."
                    data-testid="actualite-image"
                  />
                  {form.image_url && (
                    <p className="text-xs text-emerald-600">✓ Image prête</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting || uploading} data-testid="actualite-submit">
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingId ? 'Modifier' : 'Créer'}
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
      ) : actualites.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucune actualité pour le moment</p>
            {canManage() && (
              <p className="text-sm text-muted-foreground mt-2">Cliquez sur "Nouvelle actualité" pour en créer une</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming" data-testid="tab-actualites-upcoming">Événements à venir</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-actualites-past">Événements passés</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-6 mt-0">
          {upcomingActualites.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun événement à venir pour le moment</p>
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-6">
          {/* Featured / next event — leads the page with what matters most */}
          {featured && (
            <Card className="overflow-hidden card-hover animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="aspect-[32/9] md:aspect-auto bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative overflow-hidden min-h-[200px]">
                  {featured.image_url ? (
                    <img
                      src={featured.image_url}
                      alt={featured.titre}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                      style={{ maskImage: 'radial-gradient(ellipse 45% 75% at 100% 0%, transparent 8%, black 55%)', WebkitMaskImage: 'radial-gradient(ellipse 45% 75% at 100% 0%, transparent 8%, black 55%)' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Newspaper className="w-16 h-16 text-primary/30" />
                    </div>
                  )}
                  {featuredIsUpcoming && (
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground shadow-md">
                      <Sparkles className="w-3 h-3 mr-1" /> Prochainement
                    </Badge>
                  )}
                </div>
                <div className="p-6 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-xl font-bold">{featured.titre}</h2>
                    {renderActions(featured)}
                  </div>
                  {featured.date_evenement && (
                    <div className="flex items-center gap-2 text-sm text-primary font-medium mt-2">
                      <CalendarClock className="w-4 h-4" />
                      {formatEventDate(featured)}
                    </div>
                  )}
                  {featured.description && (
                    <p className="text-muted-foreground text-sm mt-3 flex-1">{featured.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                    Par {featured.created_by_name} • {new Date(featured.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Remaining events */}
          {rest.length > 0 && (
            <div>
              {featured && <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Autres actualités</h2>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((a) => (
                  <Card key={a.id} className="overflow-hidden card-hover animate-fadeIn">
                    {a.image_url ? (
                      <div className="aspect-[32/9] bg-muted relative overflow-hidden">
                        <img
                          src={a.image_url}
                          alt={a.titre}
                          className="w-full h-full object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                          style={{ maskImage: 'radial-gradient(ellipse 45% 75% at 100% 0%, transparent 8%, black 55%)', WebkitMaskImage: 'radial-gradient(ellipse 45% 75% at 100% 0%, transparent 8%, black 55%)' }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted/50 flex items-center justify-center">
                        <Newspaper className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <CardHeader className="pt-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{a.titre}</CardTitle>
                        {renderActions(a)}
                      </div>
                      {a.date_evenement && (
                        <CardDescription className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          {formatEventDate(a)}
                        </CardDescription>
                      )}
                    </CardHeader>
                    {a.description && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground text-sm line-clamp-3">{a.description}</p>
                      </CardContent>
                    )}
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Par {a.created_by_name} • {new Date(a.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          </div>
          )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {pastActualites.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Newspaper className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Aucun événement passé pour le moment</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastActualites.map((a) => (
                  <Card key={a.id} className="overflow-hidden opacity-90">
                    {a.image_url ? (
                      <div className="aspect-[32/9] bg-muted relative overflow-hidden">
                        <img
                          src={a.image_url}
                          alt={a.titre}
                          className="w-full h-full object-contain grayscale-[30%]"
                          onError={(e) => { e.target.style.display = 'none'; }}
                          style={{ maskImage: 'radial-gradient(ellipse 45% 75% at 100% 0%, transparent 8%, black 55%)', WebkitMaskImage: 'radial-gradient(ellipse 45% 75% at 100% 0%, transparent 8%, black 55%)' }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted/50 flex items-center justify-center">
                        <Newspaper className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <CardHeader className="pt-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{a.titre}</CardTitle>
                        {renderActions(a)}
                      </div>
                      {a.date_evenement && (
                        <CardDescription className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4" />
                          {formatEventDate(a)}
                        </CardDescription>
                      )}
                    </CardHeader>
                    {a.description && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground text-sm line-clamp-3">{a.description}</p>
                      </CardContent>
                    )}
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        Par {a.created_by_name} • {new Date(a.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
