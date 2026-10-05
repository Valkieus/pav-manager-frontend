import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft, BarChart3, Bell, BellOff, CheckCheck, Copy, Loader2, Megaphone, MoreHorizontal, Mic, Paperclip,
  Pencil, Pin, Reply, Search, Send, Settings, Smile, Square, Trash2, Users, X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Attachment, uploadComm } from "./attachments";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const QUICK = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];
const EMOJIS = ["😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😢", "😭", "😡", "🙄", "😴", "🤝", "👍", "👎", "👏", "🙌", "🙏", "💪", "🔥", "✅", "❌", "⚠️", "❤️", "💙", "🎉", "🎬", "🎥", "📷", "🎤", "🎧", "💡", "📌", "📅", "⏰", "🚀", "👀"];

const hue = (s) => { let h = 0; for (const c of String(s || "")) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const hhmm = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso) => {
  const d = new Date(iso); const t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (same(d, t)) return "Aujourd'hui";
  if (same(d, y)) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

// Fusionne la dernière page reçue avec ce qui est déjà affiché (les plus anciens chargés restent).
const mergeMessages = (old, fresh) => {
  if (!fresh.length) return old.filter((m) => m._local);
  const earliest = fresh[0].created_at;
  return [...old.filter((m) => m.created_at < earliest), ...fresh];
};

function PollCard({ m, onVote }) {
  const p = m.poll;
  return (
    <div className="min-w-[220px] space-y-2 rounded-lg border bg-background/80 p-3 text-foreground">
      <p className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" />{p.question}</p>
      <p className="text-xs text-muted-foreground">{p.multiple ? "Plusieurs choix possibles" : "Un seul choix"} · {p.total} vote{p.total > 1 ? "s" : ""}</p>
      {p.options.map((o) => {
        const pct = p.total ? Math.round((100 * o.votes) / p.total) : 0;
        return (
          <button key={o.id} type="button" onClick={() => onVote(m, o.id)} className={`relative block w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm ${o.mine ? "border-primary" : ""}`}>
            <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
            <span className="relative flex justify-between gap-2"><span>{o.mine ? "✓ " : ""}{o.text}</span><span className="font-medium">{o.votes}</span></span>
          </button>
        );
      })}
    </div>
  );
}

export default function ChatView({ channel, user, onBack, onChanged, onSettings }) {
  const cid = channel.id;
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState([]);
  const [text, setText] = useState("");
  const [atts, setAtts] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [mentions, setMentions] = useState([]);
  const [mentionAll, setMentionAll] = useState(false);
  const [members, setMembers] = useState([]);
  const [menuFor, setMenuFor] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [search, setSearch] = useState(null); // null = fermé, sinon { q, results }
  const [membersOpen, setMembersOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [poll, setPoll] = useState({ question: "", options: ["", ""], multiple: false });
  const [recording, setRecording] = useState(null); // { secs }
  const [muted, setMuted] = useState(channel.muted);
  const [newBelow, setNewBelow] = useState(0);

  const rev = useRef(-1);
  const box = useRef(null);
  const stick = useRef(true);
  const lastTyping = useRef(0);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const recTimer = useRef(null);
  const lastCount = useRef(0);
  const textRef = useRef(null);
  const me = user.id;

  const scrollBottom = useCallback((smooth) => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const markRead = useCallback(async () => {
    if (document.hidden) return;
    try { await axios.post(`${API}/comm/channels/${cid}/read`); onChanged && onChanged(); } catch (e) { /* ignore */ }
  }, [cid, onChanged]);

  const fetchMessages = useCallback(async (initial) => {
    try {
      const res = await axios.get(`${API}/comm/channels/${cid}/messages`, { params: initial ? {} : { rev: rev.current } });
      setTyping(res.data.typing || []);
      if (res.data.unchanged) return;
      rev.current = res.data.rev;
      setMessages((old) => (initial ? res.data.messages : mergeMessages(old, res.data.messages)));
      setPinned(res.data.pinned || []);
      if (initial) setHasMore(res.data.has_more);
      markRead();
    } catch (e) { /* réseau : on réessaie au prochain tour */ } finally {
      if (initial) setLoading(false);
    }
  }, [cid, markRead]);

  useEffect(() => {
    rev.current = -1; stick.current = true; lastCount.current = 0;
    setMessages([]); setPinned([]); setLoading(true); setText(""); setAtts([]); setReplyTo(null); setEditing(null); setSearch(null); setMuted(channel.muted);
    fetchMessages(true);
    axios.get(`${API}/comm/channels/${cid}/members`).then((r) => setMembers(r.data)).catch(() => {});
    const t = setInterval(() => { if (!document.hidden) fetchMessages(false); }, 3000);
    const vis = () => { if (!document.hidden) { fetchMessages(false); markRead(); } };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);

  // Défilement : en bas si on y était, sinon bouton « nouveaux messages ».
  useEffect(() => {
    const added = messages.length - lastCount.current;
    if (messages.length && lastCount.current === 0) scrollBottom(false);
    else if (added > 0) { if (stick.current) scrollBottom(true); else setNewBelow((n) => n + added); }
    lastCount.current = messages.length;
  }, [messages, scrollBottom]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stick.current) setNewBelow(0);
  };

  const loadOlder = async () => {
    if (!messages.length) return;
    try {
      const res = await axios.get(`${API}/comm/channels/${cid}/messages`, { params: { before: messages[0].created_at } });
      const el = box.current; const prev = el ? el.scrollHeight : 0;
      stick.current = false;
      lastCount.current += res.data.messages.length;
      setMessages((old) => [...res.data.messages, ...old]);
      setHasMore(res.data.has_more);
      setTimeout(() => { if (el) el.scrollTop = el.scrollHeight - prev; }, 0);
    } catch (e) { toast.error("Chargement impossible"); }
  };

  const replaceMsg = (m) => setMessages((old) => old.map((x) => (x.id === m.id ? m : x)));

  const send = async (extra) => {
    const body = { texte: text, reply_to_id: replyTo?.id || null, attachments: atts, mentions, mention_all: mentionAll, ...(extra || {}) };
    if (!body.texte.trim() && !body.attachments.length && !body.poll) return;
    setSending(true);
    try {
      if (editing) {
        const res = await axios.put(`${API}/comm/messages/${editing.id}`, { texte: text });
        replaceMsg(res.data); setEditing(null);
      } else {
        const res = await axios.post(`${API}/comm/channels/${cid}/messages`, body);
        stick.current = true;
        setMessages((old) => (old.some((x) => x.id === res.data.id) ? old : [...old, res.data]));
      }
      setText(""); setAtts([]); setReplyTo(null); setMentions([]); setMentionAll(false); setEmojiOpen(false);
      onChanged && onChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  const onType = (v) => {
    setText(v);
    if (Date.now() - lastTyping.current > 3000 && v) { lastTyping.current = Date.now(); axios.post(`${API}/comm/channels/${cid}/typing`).catch(() => {}); }
  };
  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); send(); }
  };

  // @mentions : suggestions selon le mot en cours de frappe
  const mentionQuery = useMemo(() => { const m = text.match(/(?:^|\s)@([^\s@]*)$/); return m ? m[1].toLowerCase() : null; }, [text]);
  const mentionList = useMemo(() => {
    if (mentionQuery === null) return [];
    const base = [{ id: "__all", nom: "tous" }, ...members.filter((x) => x.id !== me)];
    return base.filter((x) => x.nom.toLowerCase().includes(mentionQuery)).slice(0, 6);
  }, [mentionQuery, members, me]);
  const pickMention = (x) => {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${x.nom} `));
    if (x.id === "__all") setMentionAll(true); else setMentions((a) => (a.includes(x.id) ? a : [...a, x.id]));
    textRef.current?.focus();
  };

  const attachFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try { const out = []; for (const f of files) out.push(await uploadComm(f)); setAtts((a) => [...a, ...out]); }
    catch (err) { toast.error(err.response?.data?.detail || "Envoi du fichier impossible"); } finally { setUploading(false); }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recTimer.current);
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunks.current, { type });
        setRecording(null);
        if (rec.cancelled || blob.size < 1200) return;
        setUploading(true);
        try {
          const up = await uploadComm(new File([blob], `vocal.${ext}`, { type }));
          await send({ attachments: [...atts, up], texte: text });
        } catch (err) { toast.error(err.response?.data?.detail || "Vocal non envoyé"); } finally { setUploading(false); }
      };
      rec.start();
      recorder.current = rec;
      setRecording({ secs: 0 });
      recTimer.current = setInterval(() => setRecording((r) => (r ? { secs: r.secs + 1 } : r)), 1000);
    } catch (e) { toast.error("Micro inaccessible : autorisez-le dans le navigateur"); }
  };
  const stopRec = (cancel) => { if (recorder.current) { recorder.current.cancelled = !!cancel; recorder.current.stop(); } };

  const react = async (m, emoji) => { setMenuFor(null); try { replaceMsg((await axios.post(`${API}/comm/messages/${m.id}/react`, { emoji })).data); } catch (e) { toast.error("Réaction impossible"); } };
  const vote = async (m, optionId) => { try { replaceMsg((await axios.post(`${API}/comm/messages/${m.id}/vote`, { option_id: optionId })).data); } catch (e) { toast.error("Vote impossible"); } };
  const pin = async (m) => { setMenuFor(null); try { await axios.post(`${API}/comm/messages/${m.id}/pin`, { pinned: !m.pinned }); fetchMessages(true); } catch (err) { toast.error(err.response?.data?.detail || "Épinglage impossible"); } };
  const del = async (m) => {
    setMenuFor(null);
    if (!window.confirm("Supprimer ce message ?")) return;
    try { await axios.delete(`${API}/comm/messages/${m.id}`); setMessages((old) => old.filter((x) => x.id !== m.id)); } catch (err) { toast.error(err.response?.data?.detail || "Suppression impossible"); }
  };
  const toggleMute = async () => {
    try { await axios.post(`${API}/comm/channels/${cid}/mute`, { muted: !muted }); setMuted(!muted); onChanged && onChanged(); toast.success(!muted ? "Notifications coupées" : "Notifications actives"); } catch (e) { toast.error("Action impossible"); }
  };
  const doSearch = async (q) => {
    setSearch({ q, results: search?.results || [] });
    if (q.trim().length < 2) { setSearch({ q, results: [] }); return; }
    try { setSearch({ q, results: (await axios.get(`${API}/comm/channels/${cid}/search`, { params: { q } })).data }); } catch (e) { /* ignore */ }
  };
  const createPoll = async () => {
    const options = poll.options.map((o) => o.trim()).filter(Boolean);
    if (!poll.question.trim() || options.length < 2) { toast.error("Une question et au moins 2 choix"); return; }
    await send({ texte: "", attachments: [], poll: { question: poll.question, options, multiple: poll.multiple } });
    setPollOpen(false); setPoll({ question: "", options: ["", ""], multiple: false });
  };
  const scrollToMsg = (id) => { const el = document.getElementById(`msg-${id}`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("ring-2", "ring-primary"); setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500); } };

  const canEditMsg = (m) => m.auteur_id === me && Date.now() - new Date(m.created_at).getTime() < 48 * 3600 * 1000;
  const list = search && search.q.trim().length >= 2 ? search.results : messages;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
      {/* en-tête */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack} aria-label="Retour"><ArrowLeft className="h-5 w-5" /></Button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: channel.color }}>
          {channel.kind === "canal" ? <Megaphone className="h-5 w-5" /> : channel.nom.slice(0, 1).toUpperCase()}
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMembersOpen(true)}>
          <p className="truncate font-semibold leading-tight">{channel.nom}</p>
          <p className="truncate text-xs text-muted-foreground">
            {typing.length ? `${typing.join(", ")} écrit…` : `${members.length} membre${members.length > 1 ? "s" : ""}${channel.description ? ` · ${channel.description}` : ""}`}
          </p>
        </button>
        <Button variant="ghost" size="sm" onClick={() => setSearch(search ? null : { q: "", results: [] })} aria-label="Rechercher"><Search className="h-5 w-5" /></Button>
        <Button variant="ghost" size="sm" onClick={toggleMute} aria-label="Notifications">{muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}</Button>
        <Button variant="ghost" size="sm" onClick={() => setMembersOpen(true)} aria-label="Membres"><Users className="h-5 w-5" /></Button>
        {channel.can_manage && <Button variant="ghost" size="sm" onClick={onSettings} aria-label="Réglages"><Settings className="h-5 w-5" /></Button>}
      </div>
      {search && (
        <div className="border-b p-2"><Input autoFocus value={search.q} onChange={(e) => doSearch(e.target.value)} placeholder="Rechercher dans ce canal…" /></div>
      )}
      {!search && pinned.length > 0 && (
        <button type="button" onClick={() => scrollToMsg(pinned[0].id)} className="flex items-center gap-2 border-b bg-amber-50 px-3 py-1.5 text-left text-sm dark:bg-amber-950/30">
          <Pin className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{pinned[0].auteur_nom} : </span>{pinned[0].texte || "Pièce jointe"}</span>
          {pinned.length > 1 && <span className="text-xs text-muted-foreground">+{pinned.length - 1}</span>}
        </button>
      )}

      {/* messages */}
      <div ref={box} onScroll={onScroll} className="relative min-h-0 flex-1 space-y-1 overflow-y-auto bg-muted/20 p-3" onClick={() => setMenuFor(null)}>
        {loading && <div className="p-6 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>}
        {!loading && hasMore && !search && <div className="text-center"><Button variant="outline" size="sm" onClick={loadOlder}>Messages précédents</Button></div>}
        {!loading && list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{search ? "Aucun résultat" : "Aucun message. Écrivez le premier !"}</p>}
        {list.map((m, i) => {
          const prev = list[i - 1];
          const mine = m.auteur_id === me;
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const grouped = prev && !newDay && prev.auteur_id === m.auteur_id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
          const mentionsMe = (m.mentions || []).includes(me);
          return (
            <div key={m.id}>
              {newDay && <div className="my-3 text-center"><span className="rounded-full bg-background px-3 py-1 text-xs font-medium capitalize text-muted-foreground shadow-sm">{dayLabel(m.created_at)}</span></div>}
              <div id={`msg-${m.id}`} className={`group relative flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-2"} rounded-lg transition-shadow`}>
                <div onClick={(e) => { if (e.target.closest("a,button,audio,video,img,input")) return; e.stopPropagation(); setMenuFor(menuFor === m.id ? null : m.id); }} className={`relative max-w-[85%] cursor-pointer rounded-2xl px-3 py-2 shadow-sm md:max-w-[70%] ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-background"} ${mentionsMe ? "ring-2 ring-amber-400" : ""}`}>
                  {!mine && !grouped && <p className="text-xs font-bold" style={{ color: `hsl(${hue(m.auteur_id)} 65% 42%)` }}>{m.auteur_nom}</p>}
                  {m.reply_to && (
                    <button type="button" onClick={() => scrollToMsg(m.reply_to.id)} className={`mb-1 block w-full rounded border-l-4 px-2 py-1 text-left text-xs ${mine ? "border-primary-foreground/70 bg-primary-foreground/15" : "border-primary bg-primary/10"}`}>
                      <span className="font-semibold">{m.reply_to.auteur_nom}</span><span className="block truncate opacity-80">{m.reply_to.texte}</span>
                    </button>
                  )}
                  {(m.attachments || []).map((a) => <div key={a.url} className="mb-1"><Attachment a={a} onImage={setLightbox} /></div>)}
                  {m.poll && <PollCard m={m} onVote={vote} />}
                  {m.texte && <p className="whitespace-pre-wrap break-words text-[15px]">{m.texte}</p>}
                  <p className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {m.pinned && <Pin className="h-3 w-3" />}{m.edited_at && "modifié · "}{hhmm(m.created_at)}
                    {mine && m.seen_count != null && <span className="flex items-center gap-0.5" title={`Vu par ${m.seen_count}`}><CheckCheck className="h-3.5 w-3.5" />{m.seen_count > 0 ? m.seen_count : ""}</span>}
                  </p>
                  {m.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.reactions.map((r) => (
                        <button key={r.emoji} type="button" onClick={() => react(m, r.emoji)} className={`rounded-full border px-2 py-0.5 text-xs ${r.mine ? "border-primary bg-primary/15 text-foreground" : "bg-background/80 text-foreground"}`}>{r.emoji} {r.count}</button>
                      ))}
                    </div>
                  )}
                  <button type="button" aria-label="Actions" onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.id ? null : m.id); }}
                    className={`absolute -top-3 ${mine ? "left-0 -translate-x-full" : "right-0 translate-x-full"} hidden touch-manipulation rounded-full bg-background p-1.5 text-foreground opacity-0 shadow hover:opacity-100 md:block md:group-hover:opacity-100`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {menuFor === m.id && (
                    <div onClick={(e) => e.stopPropagation()} className={`absolute z-30 ${mine ? "right-0" : "left-0"} top-full mt-1 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg`}>
                      <div className="flex justify-around border-b p-1">{QUICK.map((e) => <button key={e} type="button" className="rounded p-1 text-xl hover:bg-accent" onClick={() => react(m, e)}>{e}</button>)}</div>
                      {[
                        [Reply, "Répondre", () => { setReplyTo(m); setMenuFor(null); textRef.current?.focus(); }, true],
                        [Copy, "Copier le texte", () => { navigator.clipboard?.writeText(m.texte || ""); setMenuFor(null); toast.success("Copié"); }, !!m.texte],
                        [Pencil, "Modifier", () => { setEditing(m); setText(m.texte); setMenuFor(null); textRef.current?.focus(); }, canEditMsg(m) && !!m.texte],
                        [Pin, m.pinned ? "Désépingler" : "Épingler", () => pin(m), channel.can_manage || ["Coordination", "Admin", "Super Admin"].includes(user.niveau_acces)],
                        [Trash2, "Supprimer", () => del(m), channel.can_manage || canEditMsg(m)],
                      ].filter((x) => x[3]).map(([Icon, label, fn]) => (
                        <button key={label} type="button" onClick={fn} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-accent"><Icon className="h-4 w-4" />{label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {newBelow > 0 && (
          <button type="button" onClick={() => { scrollBottom(true); setNewBelow(0); }} className="sticky bottom-2 left-1/2 z-20 mx-auto block -translate-x-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg">
            ↓ {newBelow} nouveau{newBelow > 1 ? "x" : ""} message{newBelow > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* composition */}
      {channel.can_post ? (
        <div className="relative border-t p-2">
          {(replyTo || editing) && (
            <div className="mb-2 flex items-center gap-2 rounded border-l-4 border-primary bg-muted/60 px-2 py-1 text-sm">
              {editing ? <Pencil className="h-4 w-4" /> : <Reply className="h-4 w-4" />}
              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{editing ? "Modifier le message" : replyTo.auteur_nom}</span>{!editing && ` : ${replyTo.texte || "Pièce jointe"}`}</span>
              <button type="button" aria-label="Annuler" onClick={() => { setReplyTo(null); setEditing(null); setText(""); }}><X className="h-4 w-4" /></button>
            </div>
          )}
          {atts.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {atts.map((a, i) => <span key={a.url} className="flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs"><Paperclip className="h-3 w-3" />{a.filename}<button type="button" aria-label="Retirer" onClick={() => setAtts(atts.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></span>)}
            </div>
          )}
          {mentionList.length > 0 && (
            <ul className="absolute bottom-full left-2 right-2 z-30 mb-1 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
              {mentionList.map((x) => <li key={x.id}><button type="button" className="w-full rounded px-2 py-2 text-left text-sm hover:bg-accent" onMouseDown={(e) => { e.preventDefault(); pickMention(x); }}>@{x.nom}</button></li>)}
            </ul>
          )}
          {emojiOpen && (
            <div className="absolute bottom-full left-2 z-30 mb-1 grid w-72 grid-cols-8 gap-1 rounded-md border bg-popover p-2 shadow-lg">
              {EMOJIS.map((e) => <button key={e} type="button" className="rounded p-1 text-xl hover:bg-accent" onClick={() => { setText((t) => t + e); textRef.current?.focus(); }}>{e}</button>)}
            </div>
          )}
          {recording ? (
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-2 dark:bg-red-950/30">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
              <span className="flex-1 text-sm font-semibold tabular-nums">Enregistrement {String(Math.floor(recording.secs / 60)).padStart(2, "0")}:{String(recording.secs % 60).padStart(2, "0")}</span>
              <Button variant="ghost" size="sm" onClick={() => stopRec(true)}><X className="h-4 w-4" /></Button>
              <Button size="sm" onClick={() => stopRec(false)}><Square className="mr-1 h-4 w-4" />Envoyer</Button>
            </div>
          ) : (
            <div className="flex items-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji"><Smile className="h-5 w-5" /></Button>
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md px-2 hover:bg-accent" aria-label="Joindre">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                <input type="file" multiple className="hidden" onChange={attachFiles} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.mp4,.mov,.mp3,.m4a,.wav" />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setPollOpen(true)} aria-label="Sondage"><BarChart3 className="h-5 w-5" /></Button>
              <textarea ref={textRef} value={text} onChange={(e) => onType(e.target.value)} onKeyDown={onKey} rows={1} maxLength={4000} placeholder="Message… (@ pour mentionner)"
                className="max-h-32 min-h-[40px] min-w-0 flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-[15px] outline-none focus:border-primary" />
              {text.trim() || atts.length ? (
                <Button size="sm" className="h-10 w-10 rounded-full p-0" onClick={() => send()} disabled={sending} aria-label="Envoyer">{sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</Button>
              ) : (
                <Button size="sm" variant="secondary" className="h-10 w-10 rounded-full p-0" onClick={startRec} aria-label="Message vocal"><Mic className="h-5 w-5" /></Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="border-t p-3 text-center text-sm text-muted-foreground">Seuls les {channel.min_niveau_ecriture === "Coordination" ? "membres de la Coordination" : "responsables"} peuvent écrire ici.</p>
      )}

      {/* image plein écran */}
      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-full max-w-full object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white" aria-label="Fermer"><X className="h-6 w-6" /></button>
        </div>
      )}

      {/* membres + vu */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{channel.nom}</DialogTitle><DialogDescription>{members.length} membres · dernière lecture du canal</DialogDescription></DialogHeader>
          <ul className="divide-y rounded-md border">
            {members.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 truncate"><span className="font-medium">{u.nom}</span> <span className="text-xs text-muted-foreground">{u.niveau}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{u.vu_le ? new Date(u.vu_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* sondage */}
      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouveau sondage</DialogTitle><DialogDescription>Les membres votent d'un toucher.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Question</Label><Input value={poll.question} onChange={(e) => setPoll({ ...poll, question: e.target.value })} maxLength={200} /></div>
            {poll.options.map((o, i) => (
              <div key={i} className="flex gap-2"><Input value={o} placeholder={`Choix ${i + 1}`} maxLength={100} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                {poll.options.length > 2 && <Button variant="ghost" size="sm" onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>}</div>
            ))}
            {poll.options.length < 10 && <Button variant="outline" size="sm" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}>+ Ajouter un choix</Button>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={poll.multiple} onChange={(e) => setPoll({ ...poll, multiple: e.target.checked })} />Plusieurs réponses possibles</label>
            <Button className="w-full" onClick={createPoll} disabled={sending}>Publier le sondage</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
