import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Search, Loader2, FileText, Film, Lightbulb, Plus, Trash2, ExternalLink } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND}/api`;

const mediaUrl = (u) => (u?.startsWith('http') ? u : `${BACKEND}${u}`);

// Image de couverture d'un élément : sa photo, ou la vignette de sa première vidéo
// (vignette enregistrée, ou dérivée par Cloudinary pour les fichiers hébergés chez eux).
const cldUrl = (m, transform, ext) => `https://res.cloudinary.com/${m.cloud}/${m.resource_type === 'image' ? 'image' : 'video'}/upload/${transform}/${m.public_id}${ext ? `.${ext}` : ''}`;
const coverOf = (el) => {
  for (const m of el.medias || []) {
    if (m.storage === 'cloudinary') return m.resource_type === 'video' ? cldUrl(m, 'so_1,w_480,c_limit,q_auto', 'jpg') : cldUrl(m, 'c_limit,w_480,q_auto,f_auto');
    if (m.kind === 'image') return m.direct_url || mediaUrl(m.url);
    if (m.kind === 'video' && m.poster_data) return m.poster_data;
    if (m.kind === 'video' && m.poster) return mediaUrl(m.poster);
  }
  return null;
};

// --- Page -----------------------------------------------------------------

export default function ElementsLED() {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  // catégories
  const [categories, setCategories] = useState([]);
  const [sansCat, setSansCat] = useState(0);
  const [filterCat, setFilterCat] = useState('all'); // 'all' | '__none__' | nom
  const [checked, setChecked] = useState(new Set());
  const [bulkCat, setBulkCat] = useState('');


  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/led-categories`);
      setCategories(res.data.categories);
      setSansCat(res.data.sans_categorie);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du chargement des catégories');
    }
  }, []);

  const fetchElements = useCallback(async (query = '', cat = 'all') => {
    try {
      const params = {};
      if (query) params.q = query;
      if (cat !== 'all') params.categorie = cat;
      const res = await axios.get(`${API}/led-elements`, { params });
      setElements(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchElements(q, filterCat), 250);
    return () => clearTimeout(t);
  }, [q, filterCat, fetchElements]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const addCategory = async () => {
    const nom = window.prompt('Nom de la nouvelle catégorie (ex : Modules P3, Alimentations, Contrôleurs)');
    if (!nom || !nom.trim()) return;
    try {
      await axios.post(`${API}/led-categories`, { nom });
      await fetchCategories();
      toast.success('Catégorie créée');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const deleteCategory = async (cat) => {
    if (!window.confirm(`Supprimer la catégorie « ${cat.nom} » ? Ses éléments seront conservés, sans catégorie.`)) return;
    try {
      await axios.delete(`${API}/led-categories/${cat.id}`);
      setFilterCat('all');
      await fetchCategories();
      fetchElements(q, 'all');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const applyBulk = async () => {
    if (!checked.size || !bulkCat) return;
    try {
      await axios.put(`${API}/led-elements/bulk-categorie`, {
        ids: Array.from(checked), categorie: bulkCat === '__none__' ? '' : bulkCat,
      });
      toast.success(`${checked.size} élément(s) classé(s)`);
      setChecked(new Set());
      setBulkCat('');
      await fetchCategories();
      fetchElements(q, filterCat);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const toggleChecked = (id) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const saveSelected = async () => {
    try {
      const { titre, notes, reference, tags, categorie } = selected;
      await axios.put(`${API}/led-elements/${selected.id}`, { titre, notes, reference, tags, categorie: categorie || '' });
      setSelected(null);
      await fetchCategories();
      fetchElements(q, filterCat);
      toast.success('Élément enregistré');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Supprimer définitivement « ${selected.titre} » et ses fichiers ? Cette action est irréversible.`)) return;
    try {
      await axios.delete(`${API}/led-elements/${selected.id}`);
      setElements((els) => els.filter((e) => e.id !== selected.id));
      setSelected(null);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // Ouvre le site LED séparé, déjà connecté (SSO : jeton à usage unique, 2 min).
  // La fenêtre est ouverte tout de suite (clic utilisateur) pour éviter le blocage popup.
  const openLedSite = async () => {
    const win = window.open('', '_blank');
    try {
      const res = await axios.post(`${API}/led/sso-handoff`);
      if (win) win.location.href = res.data.redirect_url;
      else window.location.href = res.data.redirect_url;
    } catch (err) {
      if (win) win.close();
      toast.error(err.response?.data?.detail || "Impossible d'ouvrir le site LED");
    }
  };


  return (
    <div className="space-y-6" data-testid="elements-led-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="w-6 h-6" /> Éléments LED</h1>
          <p className="text-muted-foreground">Recherche et bibliothèque d'éléments LED</p>
        </div>
        <Button variant="outline" onClick={openLedSite} data-testid="open-led-site">
          <ExternalLink className="w-4 h-4 mr-2" /> Ouvrir le site LED
        </Button>
      </div>


      <div className="flex flex-wrap items-center gap-2" data-testid="led-categories">
        <Button size="sm" variant={filterCat === 'all' ? 'default' : 'outline'} onClick={() => setFilterCat('all')}>Toutes</Button>
        {categories.map((c) => (
          <Button key={c.id} size="sm" variant={filterCat === c.nom ? 'default' : 'outline'} onClick={() => setFilterCat(c.nom)}>
            {c.nom} ({c.count})
          </Button>
        ))}
        <Button size="sm" variant={filterCat === '__none__' ? 'default' : 'outline'} onClick={() => setFilterCat('__none__')}>
          Sans catégorie ({sansCat})
        </Button>
        <Button size="sm" variant="ghost" onClick={addCategory}><Plus className="w-4 h-4 mr-1" />Nouvelle catégorie</Button>
        {categories.find((c) => c.nom === filterCat) && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCategory(categories.find((c) => c.nom === filterCat))}>
            <Trash2 className="w-4 h-4 mr-1" />Supprimer « {filterCat} »
          </Button>
        )}
      </div>

      {checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded border bg-muted">
          <span className="text-sm">{checked.size} sélectionné(s) →</span>
          <Select value={bulkCat} onValueChange={setBulkCat}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Classer dans…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sans catégorie</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.nom}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBulk} disabled={!bulkCat}>Appliquer</Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Annuler</Button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher (titre, texte, tag, référence…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : elements.length === 0 ? (
        <p className="text-muted-foreground">Aucun élément pour le moment. Ajoutez des fichiers depuis le site LED.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {elements.map((el) => {
            const cover = coverOf(el);
            return (
              <Card key={el.id} className="cursor-pointer overflow-hidden" onClick={() => setSelected(el)}>
                <div className="aspect-video bg-muted flex items-center justify-center relative">
                  <input
                    type="checkbox" className="absolute top-2 left-2 w-4 h-4 z-10"
                    checked={checked.has(el.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleChecked(el.id)}
                    aria-label="Sélectionner"
                  />
                  {cover ? <img src={cover} alt={el.titre} loading="lazy" className="w-full h-full object-cover" />
                    : el.medias?.[0]?.kind === 'video' ? <Film className="w-8 h-8 text-muted-foreground" />
                    : <FileText className="w-8 h-8 text-muted-foreground" />}
                  {el.medias?.some((m) => m.kind === 'video') && cover && (
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center">
                        <Film className="w-5 h-5 text-white" />
                      </span>
                    </span>
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="font-medium text-sm line-clamp-2">{el.titre}</p>
                  <p className="text-xs text-muted-foreground">{el.date?.slice(0, 10)}{el.medias?.length > 1 ? ` · ${el.medias.length} médias` : ''}</p>
                  {el.categorie && <Badge>{el.categorie}</Badge>}
                  <div className="flex flex-wrap gap-1">{(el.tags || []).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.titre}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selected.medias?.map((m) => (
                  m.kind === 'image' ? (
                    <a key={m.url} href={mediaUrl(m.url)} target="_blank" rel="noreferrer">
                      <img src={mediaUrl(m.url)} alt={m.filename} className="w-full rounded" />
                    </a>
                  ) : m.kind === 'video' ? (
                    <video key={m.url} src={mediaUrl(m.url)} controls className="w-full rounded" />
                  ) : (
                    <a key={m.url} href={mediaUrl(m.url)} target="_blank" rel="noreferrer" className="underline text-sm">{m.filename}</a>
                  )
                ))}
              </div>
              {selected.texte && <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">{selected.texte}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Catégorie</Label>
                  <Select value={selected.categorie || '__none__'} onValueChange={(v) => setSelected({ ...selected, categorie: v === '__none__' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sans catégorie</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.nom}>{c.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {[['titre', 'Titre'], ['reference', 'Référence']].map(([k, label]) => (
                  <div key={k} className="space-y-1">
                    <Label>{label}</Label>
                    <Input value={selected[k] || ''} onChange={(e) => setSelected({ ...selected, [k]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1 sm:col-span-2">
                  <Label>Tags (séparés par des virgules)</Label>
                  <Input
                    value={(selected.tags || []).join(', ')}
                    onChange={(e) => setSelected({ ...selected, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea value={selected.notes || ''} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" className="text-destructive border-destructive" onClick={deleteSelected}><Trash2 className="w-4 h-4 mr-2" />Supprimer</Button>
                <Button onClick={saveSelected}>Enregistrer</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
