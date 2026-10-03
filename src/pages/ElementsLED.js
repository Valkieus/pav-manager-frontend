import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { Upload, Search, Loader2, FileText, Film, Lightbulb, FolderOpen, Plus, Trash2, ExternalLink } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND}/api`;

// --- Lecture d'un export Telegram Desktop (result.json) -------------------

const flattenText = (t) => {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t.map((p) => (typeof p === 'string' ? p : p.text || '')).join('');
};

const messageMediaPath = (m) => m.photo || m.file || null;

// Fusionne les albums (plusieurs médias envoyés d'un coup = même auteur, même seconde).
export function buildItems(chat, { includeTextOnly }) {
  const chatId = String(chat.id ?? chat.name ?? 'chat');
  const items = [];
  let current = null;
  for (const m of chat.messages || []) {
    if (m.type !== 'message') continue;
    const text = flattenText(m.text).trim();
    const media = messageMediaPath(m);
    const groupKey = `${m.from_id}|${m.date_unixtime}`;
    if (media && current && current.groupKey === groupKey && current.hasMedia) {
      current.media.push({ path: media, name: m.file_name || media.split('/').pop() });
      current.ids.push(m.id);
      if (text) current.text = current.text ? `${current.text}\n${text}` : text;
      continue;
    }
    current = {
      groupKey, hasMedia: !!media, ids: [m.id], date: m.date, author: m.from || '',
      text, media: media ? [{ path: media, name: m.file_name || media.split('/').pop() }] : [],
    };
    items.push(current);
  }
  return items
    .filter((it) => it.media.length > 0 || (includeTextOnly && it.text))
    .map((it) => ({ ...it, tgKey: `${chatId}:${it.ids[0]}`, chatName: chat.name || chatId }));
}

const pickChats = (json) => {
  if (json.chats?.list) return json.chats.list.filter((c) => Array.isArray(c.messages));
  if (Array.isArray(json.messages)) return [json];
  return [];
};

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
  const [importCat, setImportCat] = useState('__none__');
  const [checked, setChecked] = useState(new Set());
  const [bulkCat, setBulkCat] = useState('');

  // import
  const [filesMap, setFilesMap] = useState(null); // chemin relatif -> File
  const [chats, setChats] = useState([]);
  const [chatIdx, setChatIdx] = useState('0');
  const [includeTextOnly, setIncludeTextOnly] = useState(true);
  const [importedKeys, setImportedKeys] = useState(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: [] });
  const cancelRef = useRef(false);
  const inputRef = useRef(null);

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
      if (importCat === cat.nom) setImportCat('__none__');
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

  const items = useMemo(() => {
    const chat = chats[Number(chatIdx)];
    return chat ? buildItems(chat, { includeTextOnly }) : [];
  }, [chats, chatIdx, includeTextOnly]);
  const pending = useMemo(() => items.filter((i) => !importedKeys.has(i.tgKey)), [items, importedKeys]);

  const onPickFolder = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    const map = new Map();
    for (const f of list) {
      const rel = (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name;
      map.set(rel, f);
    }
    const jsonFile = map.get('result.json');
    if (!jsonFile) {
      toast.error("result.json introuvable : choisissez le dossier exporté par Telegram Desktop (format JSON).");
      return;
    }
    try {
      const parsed = JSON.parse(await jsonFile.text());
      const found = pickChats(parsed);
      if (!found.length) throw new Error('vide');
      setFilesMap(map);
      setChats(found);
      setChatIdx('0');
      const res = await axios.get(`${API}/led-elements/imported-keys`);
      setImportedKeys(new Set(res.data.keys));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Export Telegram illisible');
    }
  };

  const importOne = async (item) => {
    const form = new FormData();
    let missing = 0;
    for (const m of item.media) {
      const f = filesMap.get(m.path);
      if (f) form.append('files', f, m.name); // fichier d'origine, tel quel
      else missing += 1; // non téléchargé dans l'export (trop gros / non coché)
    }
    if (!item.text && item.media.length === missing) return 'missing';
    form.append('meta', JSON.stringify({
      tg_key: item.tgKey, tg_chat: item.chatName, tg_message_ids: item.ids,
      date: item.date, auteur: item.author, texte: item.text,
      categorie: importCat === '__none__' ? '' : importCat,
    }));
    const res = await axios.post(`${API}/led-elements/import`, form);
    return res.data.status;
  };

  const startImport = async () => {
    cancelRef.current = false;
    setRunning(true);
    const errors = [];
    setProgress({ done: 0, total: pending.length, errors });
    let done = 0;
    for (const item of pending) {
      if (cancelRef.current) break;
      let status;
      for (let attempt = 0; attempt < 2 && !status; attempt += 1) {
        try {
          status = await importOne(item);
        } catch (err) {
          if (attempt === 1) errors.push(`#${item.ids[0]} : ${err.response?.data?.detail || err.message}`);
        }
      }
      if (status === 'missing') errors.push(`#${item.ids[0]} : média absent de l'export`);
      if (status === 'imported' || status === 'skipped') {
        setImportedKeys((prev) => new Set(prev).add(item.tgKey));
      }
      done += 1;
      setProgress({ done, total: pending.length, errors: [...errors] });
    }
    setRunning(false);
    toast.success(cancelRef.current ? 'Import interrompu (reprenable)' : 'Import terminé');
    fetchCategories();
    fetchElements(q, filterCat);
  };

  const saveSelected = async () => {
    try {
      const { titre, notes, reference, tags, categorie } = selected;
      const res = await axios.put(`${API}/led-elements/${selected.id}`, { titre, notes, reference, tags, categorie: categorie || '' });
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

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="elements-led-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="w-6 h-6" /> Éléments LED</h1>
          <p className="text-muted-foreground">Recherche et bibliothèque d'éléments LED importés depuis Telegram</p>
        </div>
        <Button variant="outline" onClick={openLedSite} data-testid="open-led-site">
          <ExternalLink className="w-4 h-4 mr-2" /> Ouvrir le site LED
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef} type="file" className="hidden" multiple
              // eslint-disable-next-line react/no-unknown-property
              webkitdirectory="" directory="" onChange={onPickFolder}
              data-testid="led-folder-input"
            />
            <Button onClick={() => inputRef.current?.click()} disabled={running}>
              <FolderOpen className="w-4 h-4 mr-2" /> Choisir le dossier d'export Telegram
            </Button>
            <p className="text-sm text-muted-foreground">
              Telegram Desktop → ⋮ du groupe → « Exporter l'historique » → format JSON, cocher photos/vidéos/fichiers,
              taille maximale au plus haut. Sélectionnez ensuite le dossier obtenu (il contient result.json).
            </p>
          </div>

          {filesMap && (
            <div className="space-y-3">
              {chats.length > 1 && (
                <Select value={chatIdx} onValueChange={setChatIdx}>
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Groupe" /></SelectTrigger>
                  <SelectContent>
                    {chats.map((c, i) => <SelectItem key={i} value={String(i)}>{c.name || `Chat ${i + 1}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span>Catégorie des éléments importés :</span>
                <Select value={importCat} onValueChange={setImportCat} disabled={running}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sans catégorie</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={c.nom}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeTextOnly} onChange={(e) => setIncludeTextOnly(e.target.checked)} disabled={running} />
                Inclure aussi les messages sans photo/fichier
              </label>
              <p className="text-sm">
                {items.length} éléments détectés — <strong>{pending.length}</strong> à importer
                ({items.length - pending.length} déjà importés).
              </p>
              <div className="flex gap-2">
                <Button onClick={startImport} disabled={running || !pending.length}>
                  {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Importer {pending.length} éléments
                </Button>
                {running && <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Interrompre</Button>}
              </div>
              {progress.total > 0 && (
                <div className="space-y-2">
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground">{progress.done} / {progress.total}</p>
                  {progress.errors.length > 0 && (
                    <details className="text-xs text-destructive">
                      <summary>{progress.errors.length} erreur(s)</summary>
                      <ul className="list-disc pl-5">{progress.errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
        <p className="text-muted-foreground">Aucun élément. Importez un export Telegram ci-dessus.</p>
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
