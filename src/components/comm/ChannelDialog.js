import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Megaphone, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import AudienceBuilder, { EMPTY_AUDIENCE } from "./AudienceBuilder";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#16a34a", "#0891b2", "#475569"];

// Création / réglages d'un canal.
export default function ChannelDialog({ open, channel, onClose, onSaved }) {
  const edit = !!channel;
  const [f, setF] = useState(() => ({
    nom: channel?.nom || "", description: channel?.description || "", kind: channel?.kind || "groupe",
    min_niveau_ecriture: channel?.min_niveau_ecriture || "Technicien", ephemeral_days: channel?.ephemeral_days || 0,
    color: channel?.color || COLORS[0], audience: { ...EMPTY_AUDIENCE, ...(channel?.audience || {}) },
  }));
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!f.nom.trim()) { toast.error("Donnez un nom au canal"); return; }
    const a = f.audience;
    if (!a.tous && !a.niveaux.length && !a.branches.length && !a.postes.length && !a.group_ids.length && !a.user_ids.length) {
      toast.error("Choisissez qui fait partie du canal"); return;
    }
    setBusy(true);
    try {
      const res = edit ? await axios.put(`${API}/comm/channels/${channel.id}`, f) : await axios.post(`${API}/comm/channels`, f);
      toast.success(edit ? "Canal modifié" : "Canal créé");
      onSaved(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!window.confirm("Supprimer ce canal et tous ses messages ?")) return;
    try { await axios.delete(`${API}/comm/channels/${channel.id}`); toast.success("Canal supprimé"); onSaved(null); } catch (err) { toast.error(err.response?.data?.detail || "Suppression impossible"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? "Réglages du canal" : "Nouveau canal"}</DialogTitle>
          <DialogDescription>Les membres sont ceux qui correspondent à l'audience choisie, automatiquement mise à jour.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nom</Label><Input value={f.nom} onChange={(e) => set({ nom: e.target.value })} maxLength={80} /></div>
            <div className="space-y-1.5"><Label>Couleur</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => set({ color: c })} className={`h-8 w-8 rounded-full border-2 ${f.color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />)}
              </div>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[["groupe", "Groupe de discussion", "Tout le monde échange. Notification seulement en cas de mention ou de réponse.", MessageSquare],
              ["canal", "Canal d'annonces", "Chaque message est notifié à tous les membres.", Megaphone]].map(([k, t, d, Icon]) => (
              <button key={k} type="button" onClick={() => set({ kind: k })} className={`rounded-lg border-2 p-3 text-left ${f.kind === k ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{t}</p><p className="text-xs text-muted-foreground">{d}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Qui peut écrire</Label>
              <select value={f.min_niveau_ecriture} onChange={(e) => set({ min_niveau_ecriture: e.target.value })} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                <option value="Technicien">Tous les membres</option><option value="Responsable">Responsables et plus</option><option value="Coordination">Coordination et plus (lecture seule pour les autres)</option>
              </select></div>
            <div className="space-y-1.5"><Label>Conservation des messages</Label>
              <select value={f.ephemeral_days} onChange={(e) => set({ ephemeral_days: Number(e.target.value) })} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                <option value={0}>Illimitée</option><option value={1}>24 heures</option><option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option>
              </select></div>
          </div>
          <div className="space-y-2"><Label className="text-base">Membres</Label><AudienceBuilder value={f.audience} onChange={(a) => set({ audience: a })} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{edit ? "Enregistrer" : "Créer le canal"}</Button>
            {edit && <Button variant="ghost" className="text-destructive" onClick={del}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
