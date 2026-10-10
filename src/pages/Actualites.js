import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Newspaper,
  Loader2,
  Calendar,
  Edit,
  Trash2,
  Sparkles,
  CalendarClock,
  UserRound,
  ImagePlus,
  X,
  Clock,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Fenêtre « fiche » : centrée sur PC, plein écran sur téléphone (zones de sécurité iOS/Android respectées).
const SHEET_CLASS =
  "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:max-h-[90vh] sm:rounded-xl max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none";

export default function Actualites() {
  const { user, isAdmin } = useAuth();
  // 20/08/2026 (#293) : Actualités passe à Coordination+ par défaut —
  // canManage() du contexte est partagé par plusieurs pages et inclut
  // toujours Responsable, donc on n'écrit plus l'accès sur ce helper
  // générique ici. Un Responsable garde l'accès seulement s'il est dans un
  // groupe qui accorde actualites.write (opt-in, même logique que
  // Salles/Régisseurs).
  const canManage = () => {
    if (!user) return false;
    if (["Super Admin", "Admin", "Coordination"].includes(user.niveau_acces))
      return true;
    if (user.niveau_acces === "Responsable")
      return (user.module_permissions || []).includes("actualites.write");
    return false;
  };
  const [actualites, setActualites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null); // actualité ouverte en détail
  const [form, setForm] = useState({
    titre: "",
    description: "",
    date_evenement: "",
    date_fin_evenement: "",
    image_url: "",
    invite: false,
    invite_nom: "",
  });
  // Bascule d'affichage seulement — un jour unique OU une période (comme le
  // choix côté absences dans Mon espace). Dérivé de date_fin_evenement au
  // chargement d'un événement existant.
  const [isPeriode, setIsPeriode] = useState(false);

  const resetForm = () => {
    setForm({
      titre: "",
      description: "",
      date_evenement: "",
      date_fin_evenement: "",
      image_url: "",
      invite: false,
      invite_nom: "",
    });
    setIsPeriode(false);
    setEditingId(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 10 MB)");
      return;
    }

    if (
      ![
        "image/png",
        "image/jpg",
        "image/jpeg",
        "image/gif",
        "image/webp",
      ].includes(file.type)
    ) {
      toast.error("Format d'image non supporté");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imageUrl = `${process.env.REACT_APP_BACKEND_URL}${res.data.url}`;
      setForm({ ...form, image_url: imageUrl });
      toast.success("Image uploadée");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchActualites();
  }, []);

  const fetchActualites = async () => {
    try {
      const res = await axios.get(`${API}/actualites`);
      setActualites(res.data);
    } catch (err) {
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      isPeriode &&
      form.date_evenement &&
      form.date_fin_evenement &&
      form.date_fin_evenement < form.date_evenement
    ) {
      toast.error("La date de fin doit être après la date de début");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        date_fin_evenement: isPeriode ? form.date_fin_evenement || null : null,
      };
      if (editingId) {
        await axios.put(`${API}/actualites/${editingId}`, payload);
        toast.success("Actualité modifiée");
      } else {
        await axios.post(`${API}/actualites`, payload);
        toast.success("Actualité créée");
      }
      setDialogOpen(false);
      resetForm();
      fetchActualites();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (a) => {
    setForm({
      titre: a.titre,
      description: a.description || "",
      date_evenement: a.date_evenement || "",
      date_fin_evenement: a.date_fin_evenement || "",
      image_url: a.image_url || "",
      invite: a.invite || false,
      invite_nom: a.invite_nom || "",
    });
    setIsPeriode(!!a.date_fin_evenement);
    setEditingId(a.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette actualité ?")) return;
    try {
      await axios.delete(`${API}/actualites/${id}`);
      toast.success("Actualité supprimée");
      fetchActualites();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Une actualité "période" reste active/à venir tant que sa date de FIN
  // n'est pas passée, même si sa date de début l'est déjà.
  const eventEndDate = (a) => a.date_fin_evenement || a.date_evenement;
  const isPastEvent = (a) =>
    eventEndDate(a) && new Date(eventEndDate(a) + "T00:00:00") < today;

  // Upcoming/undated events feed the main tab; past events go in their own tab.
  const upcomingActualites = actualites.filter((a) => !isPastEvent(a));
  const pastActualites = [...actualites]
    .filter(isPastEvent)
    .sort((a, b) => new Date(eventEndDate(b)) - new Date(eventEndDate(a)));

  // Sort: upcoming events first (soonest first), then undated events by
  // most recently created — so the page always leads with what's next.
  const sorted = [...upcomingActualites].sort((a, b) => {
    const aDate = a.date_evenement
      ? new Date(a.date_evenement + "T00:00:00")
      : null;
    const bDate = b.date_evenement
      ? new Date(b.date_evenement + "T00:00:00")
      : null;
    const aUpcoming = !isPastEvent(a) && aDate;
    const bUpcoming = !isPastEvent(b) && bDate;
    if (aUpcoming && bUpcoming) return aDate - bDate;
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const [featured, ...rest] = sorted;
  const featuredIsUpcoming = featured?.date_evenement && !isPastEvent(featured);

  // Libellé de date affiché sur les cartes — plage "12 août → 15 août" pour
  // une période, sinon la date seule comme avant.
  const formatEventDate = (a) => {
    if (!a.date_evenement) return null;
    const startLabel = new Date(
      a.date_evenement + "T00:00:00",
    ).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!a.date_fin_evenement || a.date_fin_evenement === a.date_evenement)
      return startLabel;
    const endLabel = new Date(
      a.date_fin_evenement + "T00:00:00",
    ).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${startLabel} → ${endLabel}`;
  };

  // Étiquette « dans N jours » / « En cours » / « Terminé » pour une actualité.
  const startOf = (a) => (a.date_evenement ? new Date(a.date_evenement + "T00:00:00") : null);
  const endOf = (a) => (eventEndDate(a) ? new Date(eventEndDate(a) + "T00:00:00") : null);
  const countdown = (a) => {
    const st = startOf(a);
    const en = endOf(a);
    if (!st) return null;
    if (en < today) return { label: "Terminé", tone: "muted" };
    if (st <= today && today <= en) return { label: st.getTime() === en.getTime() ? "Aujourd'hui" : "En cours", tone: "live" };
    const days = Math.round((st - today) / 86400000);
    if (days === 1) return { label: "Demain", tone: "soon" };
    return { label: `Dans ${days} jours`, tone: days <= 7 ? "soon" : "later" };
  };
  const toneCls = {
    live: "bg-emerald-500 text-white",
    soon: "bg-amber-500 text-white",
    later: "bg-background/90 text-primary shadow-sm",
    muted: "bg-background/90 text-muted-foreground shadow-sm",
  };
  const CountdownChip = ({ a, className = "" }) => {
    const c = countdown(a);
    if (!c) return null;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${toneCls[c.tone]} ${className}`}>
        <Clock className="h-3 w-3" /> {c.label}
      </span>
    );
  };
  // Pastille « jour / mois » façon calendrier
  const DateBlock = ({ a, muted }) => {
    const st = startOf(a);
    if (!st) return null;
    return (
      <div className={`flex w-14 shrink-0 flex-col items-center rounded-xl border bg-background/95 px-1 py-1.5 shadow-sm ${muted ? "opacity-70" : ""}`}>
        <span className="text-[10px] font-semibold uppercase leading-none text-primary">
          {st.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
        </span>
        <span className="text-2xl font-bold leading-tight">{st.getDate()}</span>
      </div>
    );
  };
  const InviteChip = ({ a }) =>
    a.invite ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <UserRound className="h-3 w-3" /> Invité{a.invite_nom ? ` : ${a.invite_nom}` : ""}
      </span>
    ) : null;

  const renderActions = (a) =>
    canManage() && (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" className="h-9 w-9 p-0" onClick={() => handleEdit(a)} title="Modifier">
          <Edit className="h-4 w-4" />
        </Button>
        {isAdmin() && (
          <Button size="sm" variant="secondary" className="h-9 w-9 p-0 text-destructive" onClick={() => handleDelete(a.id)} title="Supprimer">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );

  const Cover = ({ a, className = "", past }) =>
    a.image_url ? (
      <img
        src={a.image_url}
        alt=""
        loading="lazy"
        className={`h-full w-full object-cover ${past ? "grayscale-[40%]" : ""} ${className}`}
        onError={(e) => { e.target.style.display = "none"; }}
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
        <Newspaper className="h-10 w-10 text-primary/30" />
      </div>
    );

  const EventCard = ({ a }) => (
    <Card
      className="group cursor-pointer overflow-hidden card-hover animate-fadeIn"
      onClick={() => setSelected(a)}
      data-testid={`actualite-card-${a.id}`}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <Cover a={a} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3"><DateBlock a={a} /></div>
        <div className="absolute right-3 top-3"><CountdownChip a={a} /></div>
      </div>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug">{a.titre}</h3>
          {renderActions(a)}
        </div>
        {a.date_evenement && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatEventDate(a)}</p>
        )}
        {a.description && <p className="line-clamp-2 text-sm text-muted-foreground">{a.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5"><InviteChip a={a} /></div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="actualites-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Actualités</h1>
          <p className="text-muted-foreground">
            {upcomingActualites.length} événement{upcomingActualites.length > 1 ? "s" : ""} à venir du département PAV
          </p>
        </div>
        {canManage() && (
          <Button className="shadow-lg shadow-primary/20" data-testid="add-actualite-btn" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle actualité
          </Button>
        )}
      </div>

      {/* Création / modification */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className={SHEET_CLASS} data-testid="actualite-dialog">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 pb-3 pt-4 sm:px-6">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="flex items-center gap-2 pr-8">
                  {editingId ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                  {editingId ? "Modifier l'actualité" : "Nouvelle actualité"}
                </DialogTitle>
                <DialogDescription>
                  {editingId ? "Modifiez les informations" : "Cette actualité sera visible sur la page de connexion"}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
              <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="act-titre">Titre de l'événement *</Label>
                  <Input id="act-titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required placeholder="Ex : Pâques 2026, Concert de Noël…" className="h-11 text-base sm:h-10 sm:text-sm" data-testid="actualite-titre" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="act-desc">Description</Label>
                  <Textarea id="act-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Détails de l'événement…" className="text-base sm:text-sm" data-testid="actualite-description" />
                </div>
              </section>

              <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                <h3 className="text-sm font-semibold">Date</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{isPeriode ? "Date de début" : "Date de l'événement"}</Label>
                    <Input type="date" value={form.date_evenement} onChange={(e) => setForm({ ...form, date_evenement: e.target.value })} className="h-11 sm:h-10" data-testid="actualite-date" />
                  </div>
                  {isPeriode && (
                    <div className="space-y-1.5">
                      <Label>Date de fin</Label>
                      <Input type="date" value={form.date_fin_evenement} onChange={(e) => setForm({ ...form, date_fin_evenement: e.target.value })} className="h-11 sm:h-10" data-testid="actualite-date-fin" />
                    </div>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={isPeriode} onCheckedChange={(checked) => setIsPeriode(!!checked)} data-testid="actualite-periode-checkbox" />
                  <span className="text-sm text-muted-foreground">Sur plusieurs jours (période)</span>
                </label>
              </section>

              <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={form.invite}
                    onCheckedChange={(checked) => setForm({ ...form, invite: !!checked, invite_nom: checked ? form.invite_nom : "" })}
                    data-testid="actualite-invite-checkbox"
                  />
                  <span className="text-sm font-medium">Cet événement accueille un invité</span>
                </label>
                {form.invite && (
                  <Input value={form.invite_nom} onChange={(e) => setForm({ ...form, invite_nom: e.target.value })} placeholder="Nom de l'invité" className="h-11 text-base sm:h-10 sm:text-sm" data-testid="actualite-invite-nom" />
                )}
                <p className="text-xs text-muted-foreground">Alimente le rappel « invités ce mois » affiché sur le Dashboard de tous les utilisateurs.</p>
              </section>

              <section className="space-y-3 rounded-xl border p-3 sm:p-4">
                <h3 className="text-sm font-semibold">Image (optionnel)</h3>
                {form.image_url ? (
                  <div className="relative overflow-hidden rounded-lg border bg-muted">
                    <img src={form.image_url} alt="Aperçu" className="aspect-[16/9] w-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
                    <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 h-8 w-8" onClick={() => setForm({ ...form, image_url: "" })} title="Retirer l'image">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:border-primary/50">
                    <input type="file" id="image-upload-actualite" className="hidden" accept="image/png,image/jpg,image/jpeg,image/gif,image/webp" onChange={handleImageUpload} />
                    <label htmlFor="image-upload-actualite" className="cursor-pointer">
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>Envoi en cours…</span></div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <ImagePlus className="h-7 w-7 text-muted-foreground" />
                          <span className="text-sm font-medium">Choisir une image</span>
                          <span className="text-xs text-muted-foreground">Appareil photo ou galerie · 10 Mo max</span>
                        </div>
                      )}
                    </label>
                  </div>
                )}
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="Ou collez une URL https://…" className="h-11 text-base sm:h-10 sm:text-sm" data-testid="actualite-image" />
              </section>
            </div>

            <div className="flex gap-2 border-t bg-background px-4 py-3 sm:justify-end sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
              <Button type="button" variant="outline" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={() => { setDialogOpen(false); resetForm(); }}>Annuler</Button>
              <Button type="submit" className="h-11 flex-1 sm:h-10 sm:min-w-[160px] sm:flex-none" disabled={submitting || uploading} data-testid="actualite-submit">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Enregistrer" : "Publier"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Détail d'une actualité */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className={SHEET_CLASS} data-testid="actualite-detail">
          {selected && (
            <>
              <div className="relative max-h-[45%] shrink-0 overflow-hidden bg-muted">
                {selected.image_url ? (
                  <img src={selected.image_url} alt={selected.titre} className="max-h-[40vh] w-full object-contain bg-black/5" onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="flex h-32 items-center justify-center bg-gradient-to-br from-primary/20 to-transparent"><Newspaper className="h-12 w-12 text-primary/30" /></div>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="pr-8 text-xl">{selected.titre}</DialogTitle>
                  <DialogDescription className="sr-only">Détail de l'actualité</DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CountdownChip a={selected} />
                  {selected.date_evenement && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium"><CalendarClock className="h-4 w-4" />{formatEventDate(selected)}</span>
                  )}
                </div>
                <InviteChip a={selected} />
                {selected.description && <p className="whitespace-pre-line text-sm leading-relaxed">{selected.description}</p>}
                <p className="border-t pt-3 text-xs text-muted-foreground">
                  Par {selected.created_by_name} • {new Date(selected.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              {canManage() && (
                <div className="flex gap-2 border-t bg-background px-4 py-3 sm:px-6" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                  <Button className="h-11 flex-1 sm:h-10" onClick={() => { const a = selected; setSelected(null); handleEdit(a); }}>
                    <Edit className="mr-2 h-4 w-4" /> Modifier
                  </Button>
                  {isAdmin() && (
                    <Button variant="destructive" size="icon" className="h-11 w-11 sm:h-10 sm:w-10" onClick={() => { const id = selected.id; setSelected(null); handleDelete(id); }} title="Supprimer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : actualites.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Newspaper className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Aucune actualité pour le moment</p>
            {canManage() && <p className="mt-2 text-sm text-muted-foreground">Cliquez sur « Nouvelle actualité » pour en créer une</p>}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upcoming" data-testid="tab-actualites-upcoming">À venir ({upcomingActualites.length})</TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-actualites-past">Passés ({pastActualites.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-0 space-y-6">
            {upcomingActualites.length === 0 ? (
              <Card><CardContent className="p-8 text-center"><Newspaper className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" /><p className="text-muted-foreground">Aucun événement à venir pour le moment</p></CardContent></Card>
            ) : (
              <>
                {featured && (
                  <article
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-sm animate-fadeIn"
                    onClick={() => setSelected(featured)}
                    data-testid="actualite-featured"
                  >
                    <div className="relative min-h-[260px] sm:min-h-[320px]">
                      <div className="absolute inset-0"><Cover a={featured} className="transition-transform duration-500 group-hover:scale-[1.02]" /></div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
                      <div className="absolute left-4 top-4 flex items-center gap-2">
                        <DateBlock a={featured} />
                        {featuredIsUpcoming && (
                          <Badge className="hidden bg-primary text-primary-foreground shadow-md sm:inline-flex"><Sparkles className="mr-1 h-3 w-3" /> Prochainement</Badge>
                        )}
                      </div>
                      <div className="absolute right-4 top-4 flex items-center gap-2"><CountdownChip a={featured} />{renderActions(featured)}</div>
                      <div className="absolute inset-x-0 bottom-0 space-y-2 p-4 text-white sm:p-6">
                        <h2 className="text-2xl font-bold leading-tight drop-shadow sm:text-3xl">{featured.titre}</h2>
                        {featured.date_evenement && (
                          <p className="flex items-center gap-2 text-sm font-medium text-white/90"><CalendarClock className="h-4 w-4" />{formatEventDate(featured)}</p>
                        )}
                        {featured.description && <p className="line-clamp-2 max-w-3xl text-sm text-white/85">{featured.description}</p>}
                        <InviteChip a={featured} />
                      </div>
                    </div>
                  </article>
                )}

                {rest.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ensuite</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {rest.map((a) => <EventCard key={a.id} a={a} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-0">
            {pastActualites.length === 0 ? (
              <Card><CardContent className="p-8 text-center"><Newspaper className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" /><p className="text-muted-foreground">Aucun événement passé pour le moment</p></CardContent></Card>
            ) : (
              <div className="space-y-2">
                {pastActualites.map((a) => (
                  <Card key={a.id} className="cursor-pointer overflow-hidden transition hover:bg-muted/40" onClick={() => setSelected(a)} data-testid={`actualite-past-${a.id}`}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted"><Cover a={a} past /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{a.titre}</p>
                        {a.date_evenement && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{formatEventDate(a)}</p>}
                        <div className="mt-1"><InviteChip a={a} /></div>
                      </div>
                      {renderActions(a)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
