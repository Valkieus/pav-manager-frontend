import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BellOff, Loader2, Megaphone, MessageSquare, Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ChatView from "./ChatView";
import ChannelDialog from "./ChannelDialog";
import { useAuth } from "../../contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso); const t = new Date();
  if (d.toDateString() === t.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
};

export default function Channels({ onUnreadChange }) {
  const { user } = useAuth();
  const [channels, setChannels] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState(null); // null | "new" | channel
  const [canCreate, setCanCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/comm/channels`);
      setChannels(res.data);
      onUnreadChange && onUnreadChange(res.data.filter((c) => !c.muted).reduce((s, c) => s + c.unread, 0));
    } catch (e) {
      setChannels((old) => old || []);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { axios.get(`${API}/comm/audience/options`).then(() => setCanCreate(true)).catch(() => setCanCreate(false)); }, []);

  const active = channels?.find((c) => c.id === activeId) || null;
  const shown = (channels || []).filter((c) => !q.trim() || c.nom.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="grid h-[calc(100vh-15rem)] min-h-[520px] grid-cols-1 gap-3 md:grid-cols-[320px_minmax(0,1fr)]" data-testid="comm-channels">
      <div className={`${active ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-col rounded-lg border bg-card`}>
        <div className="flex items-center gap-2 border-b p-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher un canal" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canCreate && <Button size="sm" onClick={() => setDialog("new")} aria-label="Nouveau canal"><Plus className="h-4 w-4" /></Button>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!channels && <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {channels && shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Aucun canal.{canCreate ? " Créez-en un avec « + »." : ""}</p>}
          {shown.map((c) => (
            <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
              className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left hover:bg-muted/60 ${c.id === activeId ? "bg-muted" : ""}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: c.color }}>
                {c.kind === "canal" ? <Megaphone className="h-5 w-5" /> : c.nom.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{c.nom}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{when(c.last_message?.created_at)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">
                    {c.last_message ? <><span className="font-medium">{c.last_message.auteur_nom?.split(" ")[0]} : </span>{c.last_message.texte}</> : <span className="italic">Aucun message</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {c.muted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    {c.unread > 0 && <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-xs font-bold text-white ${c.muted ? "bg-muted-foreground" : "bg-primary"}`}>{c.unread}</span>}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${active ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}>
        {active ? (
          <ChatView key={active.id} channel={active} user={user} onBack={() => setActiveId(null)} onChanged={load} onSettings={() => setDialog(active)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-card text-muted-foreground">
            <MessageSquare className="mb-3 h-12 w-12 opacity-40" />
            <p>Choisissez un canal pour discuter</p>
          </div>
        )}
      </div>

      {dialog && (
        <ChannelDialog
          key={dialog === "new" ? "new" : dialog.id}
          open
          channel={dialog === "new" ? null : dialog}
          onClose={() => setDialog(null)}
          onSaved={(ch) => { setDialog(null); if (ch === null) setActiveId(null); else if (dialog === "new") setActiveId(ch.id); load(); }}
        />
      )}
    </div>
  );
}
