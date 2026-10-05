import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Send, Trash2, StickyNote, Star } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent } from "./ui/card";
import { useAuth } from "../contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Messages entre régisseurs (PC et tablette). La tablette signe avec le
// régisseur choisi dans la popup (en-tête X-Acting-Regisseur côté serveur).
export default function RegisseurNotes({ kioskMode = false }) {
  const { user, isAdmin } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [texte, setTexte] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/regisseur-notes`);
      setNotes(res.data || []);
    } catch (e) {
      /* silencieux : on garde la liste affichée */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const t = texte.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await axios.post(`${API}/regisseur-notes`, { texte: t });
      setNotes((prev) => [res.data, ...prev]);
      setTexte("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Envoi impossible");
    } finally {
      setSending(false);
    }
  };

  const toggleImportant = async (n) => {
    try {
      const res = await axios.put(`${API}/regisseur-notes/${n.id}/important`, { important: !n.important });
      setNotes((prev) => {
        const next = prev.map((x) => (x.id === n.id ? { ...x, ...res.data } : x));
        return [...next.filter((x) => x.important), ...next.filter((x) => !x.important)];
      });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Action impossible");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette note ?")) return;
    try {
      await axios.delete(`${API}/regisseur-notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Suppression impossible");
    }
  };

  return (
    <div className="space-y-4" data-testid="regisseur-notes">
      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <StickyNote className="h-5 w-5 text-primary" /> Laisser un message aux régisseurs
          </p>
          <Textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Écrivez votre note…"
            className="text-base"
          />
          <p className="text-xs text-muted-foreground">
            Les notes sont supprimées au bout de 31 jours. Marquez-les d'une étoile pour les garder 2 mois.
          </p>
          <Button onClick={send} disabled={sending || !texte.trim()} className="h-11">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Publier
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-8 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
      ) : notes.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Aucune note pour le moment</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <Card key={n.id} className={n.important ? "border-amber-400" : ""}>
              <CardContent className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    <button type="button" onClick={() => toggleImportant(n)} aria-label={n.important ? "Retirer l'importance" : "Marquer comme importante"} className="touch-manipulation p-1">
                      <Star className={`h-6 w-6 ${n.important ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                    </button>
                    {n.auteur}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {!kioskMode && (isAdmin() || n.author_id === user?.id) && (
                      <button type="button" onClick={() => remove(n.id)} className="text-destructive" aria-label="Supprimer la note">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-base">{n.texte}</p>
                {n.important && n.expires_at && (
                  <p className="mt-1 text-xs text-amber-600">Gardée jusqu'au {new Date(n.expires_at).toLocaleDateString("fr-FR")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
