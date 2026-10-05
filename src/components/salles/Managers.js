import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, UserCheck, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Gestionnaires des salles : valident/refusent les demandes et réservent directement (ex. Paul).
export default function Managers() {
  const [users, setUsers] = useState([]);
  const [ids, setIds] = useState(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    axios.get(`${API}/room-booking/managers`).then((r) => setIds(r.data.user_ids)).catch(() => setIds([]));
    axios.get(`${API}/auth/users`).then((r) => setUsers((r.data || []).filter((u) => u.is_active !== false))).catch(() => {});
  }, []);

  const nameOf = (id) => users.find((u) => u.id === id)?.full_name || id;
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return users.filter((u) => (u.full_name || u.username || "").toLowerCase().includes(s) && !(ids || []).includes(u.id)).slice(0, 8);
  }, [q, users, ids]);

  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/room-booking/managers`, { user_ids: ids }); toast.success("Gestionnaires enregistrés"); setDirty(false); }
    catch (err) { toast.error(err.response?.data?.detail || "Enregistrement impossible"); } finally { setSaving(false); }
  };

  if (!ids) return <div className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5" /> Gestionnaires des salles</CardTitle>
        <CardDescription>Ces personnes reçoivent les demandes des Responsables, les valident ou les refusent, et peuvent réserver directement. Sans gestionnaire désigné, ce sont les administrateurs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ids.length === 0 && <span className="text-sm text-muted-foreground">Aucun gestionnaire désigné.</span>}
          {ids.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 py-1.5 text-sm">{nameOf(id)}
              <button type="button" aria-label="Retirer" onClick={() => { setIds(ids.filter((x) => x !== id)); setDirty(true); }}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <div className="relative max-w-sm">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un gestionnaire (taper un nom)…" autoComplete="off" />
          {matches.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border bg-popover p-1 shadow-md">
              {matches.map((u) => (
                <li key={u.id}><button type="button" className="flex w-full justify-between rounded px-2 py-2 text-left text-sm hover:bg-accent" onClick={() => { setIds([...ids, u.id]); setDirty(true); setQ(""); }}><span>{u.full_name || u.username}</span><span className="text-xs text-muted-foreground">{u.niveau_acces}</span></button></li>
              ))}
            </ul>
          )}
        </div>
        <Button onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enregistrer</Button>
      </CardContent>
    </Card>
  );
}
