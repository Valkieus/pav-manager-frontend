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
import { Upload, Search, Loader2, FileText, Film, Archive, Lightbulb, FolderOpen } from 'lucide-react';

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

// --- Page -----------------------------------------------------------------

export default function ElementsLED() {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

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

  const fetchElements = useCallback(async (query = '') => {
    try {
      const res = await axios.get(`${API}/led-elements`, { params: query ? { q: query } : {} });
      setElements(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchElements(q), 250);
    return () => clearTimeout(t);
  }, [q, fetchElements]);

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
    fetchElements(q);
  };

  const saveSelected = async () => {
    try {
      const { titre, notes, reference, fournisseur, prix, tags } = selected;
      const res = await axios.put(`${API}/led-elements/${selected.id}`, { titre, notes, reference, fournisseur, prix, tags });
      setElements((els) => els.map((e) => (e.id === res.data.id ? res.data : e)));
      setSelected(null);
      toast.success('Élément enregistré');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const archiveSelected = async () => {
    if (!window.confirm('Archiver cet élément ?')) return;
    try {
      await axios.put(`${API}/led-elements/${selected.id}/archive`);
      setElements((els) => els.filter((e) => e.id !== selected.id));
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="elements-led-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="w-6 h-6" /> Éléments LED</h1>
        <p className="text-muted-foreground">Recherche et bibliothèque d'éléments LED importés depuis Telegram</p>
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
            const img = el.medias?.find((m) => m.kind === 'image');
            return (
              <Card key={el.id} className="cursor-pointer overflow-hidden" onClick={() => setSelected(el)}>
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {img ? <img src={mediaUrl(img.url)} alt={el.titre} loading="lazy" className="w-full h-full object-cover" />
                    : el.medias?.[0]?.kind === 'video' ? <Film className="w-8 h-8 text-muted-foreground" />
                    : <FileText className="w-8 h-8 text-muted-foreground" />}
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="font-medium text-sm line-clamp-2">{el.titre}</p>
                  <p className="text-xs text-muted-foreground">{el.date?.slice(0, 10)}{el.medias?.length > 1 ? ` · ${el.medias.length} médias` : ''}</p>
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
                {[['titre', 'Titre'], ['reference', 'Référence'], ['fournisseur', 'Fournisseur'], ['prix', 'Prix']].map(([k, label]) => (
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
                <Button variant="outline" onClick={archiveSelected}><Archive className="w-4 h-4 mr-2" />Archiver</Button>
                <Button onClick={saveSelected}>Enregistrer</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
