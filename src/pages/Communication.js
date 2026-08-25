import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Plus, 
  Megaphone, 
  Loader2,
  Trash2,
  Image as ImageIcon,
  Link as LinkIcon,
  Upload,
  Calendar,
  User
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Communication() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageMode, setImageMode] = useState('url');
  const [previewUrl, setPreviewUrl] = useState('');
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    titre: '',
    contenu: '',
    image_url: ''
  });

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const res = await axios.get(`${API}/news`);
      setNews(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setPreviewUrl(base64);
        setForm({ ...form, image_url: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (url) => {
    setForm({ ...form, image_url: url });
    setPreviewUrl(url);
  };

  const resetForm = () => {
    setForm({ titre: '', contenu: '', image_url: '' });
    setPreviewUrl('');
    setImageMode('url');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/news`, {
        titre: form.titre,
        contenu: form.contenu,
        image_url: imageMode === 'url' ? form.image_url : null,
        image_data: imageMode === 'upload' ? form.image_url : null
      });
      toast.success('Actualité publiée');
      setDialogOpen(false);
      resetForm();
      fetchNews();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette actualité ?')) return;
    try {
      await axios.delete(`${API}/news/${id}`);
      toast.success('Actualité supprimée');
      fetchNews();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  return (
    <div className="space-y-6" data-testid="communication-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Communication</h1>
          <p className="text-muted-foreground">Mur d'actualités de l'entreprise</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20" data-testid="add-news-btn">
              <Plus className="w-4 h-4 mr-2" />
              Publier une actualité
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle actualité</DialogTitle>
              <DialogDescription>
                Partagez une information avec l'équipe
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre</Label>
                <Input
                  id="titre"
                  value={form.titre}
                  onChange={(e) => setForm({ ...form, titre: e.target.value })}
                  required
                  data-testid="news-titre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contenu">Contenu</Label>
                <Textarea
                  id="contenu"
                  value={form.contenu}
                  onChange={(e) => setForm({ ...form, contenu: e.target.value })}
                  required
                  rows={4}
                  data-testid="news-contenu"
                />
              </div>

              {/* Image Section */}
              <div className="space-y-3">
                <Label>Image (optionnel)</Label>
                <Tabs value={imageMode} onValueChange={setImageMode}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url" className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      URL
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-3">
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={imageMode === 'url' ? form.image_url : ''}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      data-testid="news-image-url"
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-3">
                    <div 
                      className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Cliquez pour sélectionner une image
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                        data-testid="news-image-upload"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Preview */}
                {previewUrl && (
                  <div className="mt-3">
                    <Label className="text-xs text-muted-foreground">Prévisualisation</Label>
                    <div className="mt-2 rounded-lg overflow-hidden border border-border">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-40 object-cover"
                        onError={() => setPreviewUrl('')}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting} data-testid="news-submit">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Publier
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* News Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : news.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucune actualité pour le moment</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item, index) => (
            <Card 
              key={item.id} 
              className="overflow-hidden card-hover animate-fadeIn"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {item.image_url && (
                <div className="relative h-48 bg-muted">
                  <img 
                    src={item.image_url} 
                    alt={item.titre}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-lg line-clamp-2">{item.titre}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDelete(item.id)}
                    data-testid={`delete-news-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {item.contenu}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {item.created_by_name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
