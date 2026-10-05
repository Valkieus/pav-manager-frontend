import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Building2, CalendarDays, ClipboardList, Inbox, Loader2, Settings, UserCheck } from "lucide-react";
import { Badge } from "../components/ui/badge";
import Planner from "../components/salles/Planner";
import { MyRequests, ToValidate } from "../components/salles/Requests";
import Managers from "../components/salles/Managers";
import SallesAdmin from "./SallesAdmin";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Salles : planning visuel + demandes des Responsables, validées par les gestionnaires désignés ;
// l'ancienne gestion (salles, créneaux, liens externes, e-mails) reste dans l'onglet « Gestion ».
export default function Salles() {
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("planning");
  const [pending, setPending] = useState(0);
  const [mine, setMine] = useState(0);

  useEffect(() => { axios.get(`${API}/room-booking/me`).then((r) => setMe(r.data)).catch(() => setMe({})); }, []);

  const refreshCounts = useCallback(async () => {
    if (!me) return;
    try {
      if (me.can_manage) setPending((await axios.get(`${API}/reservations`, { params: { statut: "En attente" } })).data.length);
      if (me.can_book) setMine((await axios.get(`${API}/room-booking/requests/mine`)).data.filter((r) => r.statut === "En attente").length);
    } catch (e) { /* ignore */ }
  }, [me]);
  useEffect(() => { refreshCounts(); const t = setInterval(() => { if (!document.hidden) refreshCounts(); }, 60000); return () => clearInterval(t); }, [refreshCounts]);

  if (!me) return <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (!me.can_view) return <p className="p-10 text-center text-muted-foreground">Accès aux salles réservé aux Responsables et plus.</p>;

  const tabs = [
    ["planning", "Planning", CalendarDays, 0, true],
    ["demandes", "Mes demandes", ClipboardList, mine, me.can_book],
    ["avalider", "À valider", Inbox, pending, me.can_manage],
    ["gestionnaires", "Gestionnaires", UserCheck, 0, me.can_edit_managers],
    ["gestion", "Gestion", Settings, 0, me.admin_access],
  ].filter((t) => t[4]);

  return (
    <div className="space-y-5" data-testid="salles-page">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Salles</h1>
          <p className="text-muted-foreground">{me.can_manage ? "Planning des salles, demandes à valider et réservations directes." : "Consultez le planning et demandez une salle : un gestionnaire valide votre demande."}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map(([id, label, Icon, n]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`touch-manipulation flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold sm:text-base ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-4 w-4" />{label}{n > 0 && <Badge className="h-5 min-w-5 bg-amber-500 px-1.5 text-white">{n}</Badge>}
          </button>
        ))}
      </div>
      {tab === "planning" && <Planner me={me} onChanged={refreshCounts} />}
      {tab === "demandes" && me.can_book && <MyRequests onChanged={refreshCounts} />}
      {tab === "avalider" && me.can_manage && <ToValidate onChanged={refreshCounts} />}
      {tab === "gestionnaires" && me.can_edit_managers && <Managers />}
      {tab === "gestion" && me.admin_access && <SallesAdmin embedded />}
    </div>
  );
}
