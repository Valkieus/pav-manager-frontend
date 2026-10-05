import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Check, Circle, Inbox, Loader2, Megaphone, Send, Trash2, BellRing, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import AudienceBuilder, { EMPTY_AUDIENCE } from "./AudienceBuilder";
import { Attachment, AttachmentPicker } from "./attachments";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// ---- Boîte de réception : messages ciblés reçus ----
function Inbox_({ onUnreadChange }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/comm/broadcasts/inbox`);
      setItems(res.data);
      onUnreadChange && onUnreadChange(res.data.filter((b) => !b.read).length);
    } catch (e) {
      setItems([]);
    }
  }, [onUnreadChange]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const expand = async (b) => {
    setOpen(open === b.id ? null : b.id);
    if (!b.read) {
      try {
        await axios.post(`${API}/comm/broadcasts/${b.id}/read`);
        setItems((prev) => prev.map((x) => (x.id === b.id ? { ...x, read: true } : x)));
        onUnreadChange && onUnreadChange(items.filter((x) => !x.read && x.id !== b.id).length);
      } catch (e) { /* ignore */ }
    }
  };

  if (!items) return <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">Aucun message ciblé reçu pour le moment.</p>;
  return (
    <div className="space-y-3">
      {items.map((b) => (
        <Card key={b.id} className={!b.read ? "border-primary" : ""}>
          <CardContent className="p-4">
            <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => expand(b)}>
              {!b.read ? <Circle className="mt-1.5 h-3 w-3 shrink-0 fill-primary text-primary" /> : <Check className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {b.important && <AlertTriangle className="h-4 w-4 text-amber-500" />}{b.titre}
                </p>
                <p className="text-xs text-muted-foreground">{b.expediteur_nom} · {fmtDate(b.created_at)}</p>
                {open !== b.id && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.message}</p>}
              </div>
            </button>
            {open === b.id && (
              <div className="mt-3 space-y-3 border-t pt-3">
                <p className="whitespace-pre-wrap break-words text-sm">{b.message}</p>
                {(b.attachments || []).map((a) => <Attachment key={a.url} a={a} />)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Composition ----
function Compose({ onSent }) {
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [important, setImportant] = useState(false);
  const [atts, setAtts] = useState([]);
  const [aud, setAud] = useState({ ...EMPTY_AUDIENCE });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!titre.trim() || !message.trim()) { toast.error("Titre et message requis"); return; }
    setSending(true);
    try {
      const prev = await axios.post(`${API}/comm/audience/preview`, aud);
      if (prev.data.count === 0) { toast.error("Personne n'est ciblé : choisissez une audience"); return; }
      if (!window.confirm(`Envoyer à ${prev.data.count} personne${prev.data.count > 1 ? "s" : ""} ?`)) return;
      await axios.post(`${API}/comm/broadcasts`, { titre, message, audience: aud, attachments: atts, important });
      toast.success("Message envoyé");
      setTitre(""); setMessage(""); setAtts([]); setImportant(false); setAud({ ...EMPTY_AUDIENCE });
      onSent && onSent();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Megaphone className="h-5 w-5 text-primary" /> Message</h3>
        <div className="space-y-1.5"><Label>Titre</Label><Input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} placeholder="Ex : Réunion régie jeudi" /></div>
        <div className="space-y-1.5"><Label>Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} maxLength={5000} /></div>
        <AttachmentPicker value={atts} onChange={setAtts} />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5 accent-amber-500" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          Marquer comme important
        </label>
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">À qui ?</h3>
        <AudienceBuilder value={aud} onChange={setAud} />
        <Button className="h-12 w-full text-base" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
          Envoyer
        </Button>
      </div>
    </div>
  );
}

// ---- Envoyés + suivi de lecture ----
function Sent() {
  const [items, setItems] = useState(null);
  const [track, setTrack] = useState(null);
  const load = useCallback(async () => {
    try { setItems((await axios.get(`${API}/comm/broadcasts/sent`)).data); } catch (e) { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openTrack = async (b) => {
    try { setTrack((await axios.get(`${API}/comm/broadcasts/${b.id}/tracking`)).data); } catch (e) { toast.error("Suivi indisponible"); }
  };
  const remind = async () => {
    try {
      const r = await axios.post(`${API}/comm/broadcasts/${track.broadcast.id}/remind`);
      toast.success(r.data.relances ? `${r.data.relances} relance(s) envoyée(s)` : "Tout le monde a lu");
    } catch (e) { toast.error("Relance impossible"); }
  };
  const del = async () => {
    if (!window.confirm("Supprimer ce message pour tout le monde ?")) return;
    try { await axios.delete(`${API}/comm/broadcasts/${track.broadcast.id}`); setTrack(null); load(); } catch (e) { toast.error("Suppression impossible"); }
  };

  if (!items) return <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!items.length) return <p className="py-10 text-center text-muted-foreground">Aucun message envoyé.</p>;
  return (
    <>
      <div className="space-y-3">
        {items.map((b) => {
          const pct = b.nb_destinataires ? Math.round((100 * b.lus) / b.nb_destinataires) : 0;
          return (
            <Card key={b.id} className="cursor-pointer hover:border-primary" onClick={() => openTrack(b)}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.important ? "❗ " : ""}{b.titre}</p>
                    <p className="text-xs text-muted-foreground">{b.expediteur_nom} · {fmtDate(b.created_at)}</p>
                  </div>
                  <Badge variant={pct === 100 ? "secondary" : "outline"}>{b.lus}/{b.nb_destinataires} lus</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!track} onOpenChange={(o) => !o && setTrack(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {track && (
            <>
              <DialogHeader>
                <DialogTitle>{track.broadcast.titre}</DialogTitle>
                <DialogDescription>
                  {track.recipients.length} destinataires · {track.recipients.filter((r) => r.lu).length} ont lu
                </DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{track.broadcast.message}</p>
              <ul className="divide-y rounded-md border">
                {track.recipients.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate"><span className="font-medium">{r.nom}</span> <span className="text-xs text-muted-foreground">{r.niveau}{r.branches?.length ? ` · ${r.branches.join(", ")}` : ""}</span></span>
                    {r.lu
                      ? <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600"><Check className="h-4 w-4" />{track.legacy ? "ancien message" : `lu ${fmtDate(r.lu_le)}`}</span>
                      : <span className="shrink-0 text-xs text-amber-600">non lu</span>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {!track.legacy && <Button variant="outline" onClick={remind}><BellRing className="mr-2 h-4 w-4" />Relancer les non-lus</Button>}
                <Button variant="ghost" className="text-destructive" onClick={del}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Broadcasts({ onUnreadChange }) {
  const [canSend, setCanSend] = useState(false);
  const [sub, setSub] = useState("recus");
  const [sentKey, setSentKey] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    axios.get(`${API}/comm/broadcasts/sent`).then(() => setCanSend(true)).catch(() => setCanSend(false));
  }, []);
  const onUnread = useCallback((n) => { setUnread(n); onUnreadChange && onUnreadChange(n); }, [onUnreadChange]);

  const tabs = [["recus", "Reçus", Inbox, unread], ...(canSend ? [["nouveau", "Nouveau message", Send, 0], ["envoyes", "Envoyés & suivi", Megaphone, 0]] : [])];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon, n]) => (
          <Button key={id} variant={sub === id ? "default" : "outline"} onClick={() => setSub(id)}>
            <Icon className="mr-2 h-4 w-4" />{label}{n > 0 && <span className="ml-2 rounded-full bg-primary-foreground px-2 text-xs font-bold text-primary">{n}</span>}
          </Button>
        ))}
      </div>
      {sub === "recus" && <Inbox_ onUnreadChange={onUnread} />}
      {sub === "nouveau" && canSend && <Compose onSent={() => { setSentKey((k) => k + 1); setSub("envoyes"); }} />}
      {sub === "envoyes" && canSend && <Sent key={sentKey} />}
    </div>
  );
}
