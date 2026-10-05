import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Inbox, MessageSquare } from "lucide-react";
import Channels from "../components/comm/Channels";
import Broadcasts from "../components/comm/Broadcasts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Communication : canaux de discussion (style Telegram) + messages ciblés avec suivi de lecture.
export default function Communication() {
  const [tab, setTab] = useState("canaux");
  const [unreadChannels, setUnreadChannels] = useState(0);
  const [unreadBroadcasts, setUnreadBroadcasts] = useState(0);

  useEffect(() => {
    axios.get(`${API}/comm/unread`).then((r) => { setUnreadChannels(r.data.channels); setUnreadBroadcasts(r.data.broadcasts); }).catch(() => {});
  }, []);
  const onCh = useCallback((n) => setUnreadChannels(n), []);
  const onBc = useCallback((n) => setUnreadBroadcasts(n), []);

  const Tab = ({ id, icon: Icon, label, n }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`touch-manipulation flex items-center gap-2 border-b-2 px-4 py-3 text-base font-semibold ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className="h-5 w-5" />{label}
      {n > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{n}</span>}
    </button>
  );

  return (
    <div className="space-y-4" data-testid="communication-page">
      <div>
        <h1 className="text-2xl font-bold">Communication</h1>
        <p className="text-muted-foreground">Discutez dans des canaux et diffusez des messages ciblés dont vous suivez la lecture.</p>
      </div>
      <div className="flex gap-1 border-b">
        <Tab id="canaux" icon={MessageSquare} label="Canaux" n={unreadChannels} />
        <Tab id="messages" icon={Inbox} label="Messages ciblés" n={unreadBroadcasts} />
      </div>
      {/* Les deux vues restent montées : on garde l'état et les compteurs à jour. */}
      <div className={tab === "canaux" ? "" : "hidden"}><Channels onUnreadChange={onCh} /></div>
      <div className={tab === "messages" ? "" : "hidden"}><Broadcasts onUnreadChange={onBc} /></div>
    </div>
  );
}
