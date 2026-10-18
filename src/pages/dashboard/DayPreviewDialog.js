import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Calendar, Clock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function DayPreviewDialog({
  cours,
  canEditCours,
  onCoursSaved,
  brief,
  dayPreview,
  navigate,
  setDayPreview,
}) {
  const current = cours?.days?.[dayPreview?.date]?.courses || [];
  const [sel, setSel] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => setSel(current), [dayPreview?.date, cours]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (reset) => {
    setSaving(true);
    try {
      if (reset) await axios.delete(`${API}/dashboard/cours/${dayPreview.date}`);
      else await axios.put(`${API}/dashboard/cours/${dayPreview.date}`, { courses: sel });
      toast.success("Cours mis à jour");
      onCoursSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={!!dayPreview}
      onOpenChange={(open) => !open && setDayPreview(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {dayPreview?.isService ? "Jour de service" : "Ce jour-là"}
          </DialogTitle>
          <DialogDescription>
            {dayPreview &&
              new Date(dayPreview.date + "T00:00:00").toLocaleDateString(
                "fr-FR",
                {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                },
              )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {dayPreview?.isService && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary" className="capitalize">
                {dayPreview?.jour}
              </Badge>
              {dayPreview?.poste && (
                <span className="font-medium text-foreground">
                  {dayPreview.poste}
                </span>
              )}
            </div>
          )}
          {dayPreview?.isService && brief?.service_info_text && (
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{brief.service_info_text}</span>
            </div>
          )}
          {(dayPreview?.events || []).length > 0 && (
            <div className="space-y-1.5">
              {(dayPreview.events || []).map((e, i) => (
                <div
                  key={`${e.titre}-${i}`}
                  className="flex items-start gap-2 rounded-md border p-2.5 text-sm"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      e.invite
                        ? "bg-amber-500"
                        : e.type === "absence"
                          ? "bg-slate-400"
                          : e.type === "formation"
                            ? "bg-violet-500"
                            : "bg-blue-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{e.titre}</p>
                    {e.invite && e.invite_nom && (
                      <p className="text-xs text-muted-foreground">
                        Invité : {e.invite_nom}
                      </p>
                    )}
                    {e.date_fin_evenement &&
                      e.date_fin_evenement !== e.date_evenement && (
                        <p className="text-xs text-muted-foreground">
                          Du{" "}
                          {new Date(
                            e.date_evenement + "T00:00:00",
                          ).toLocaleDateString("fr-FR")}{" "}
                          au{" "}
                          {new Date(
                            e.date_fin_evenement + "T00:00:00",
                          ).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(canEditCours || current.length > 0) && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Cours</p>
              {canEditCours ? (
                <>
                  {(cours?.available || []).map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={sel.includes(c)}
                        onChange={(e) =>
                          setSel((v) => (e.target.checked ? [...v, c] : v.filter((x) => x !== c)))
                        }
                      />
                      {c}
                    </label>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" disabled={saving} onClick={() => save(false)}>
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => save(true)}>
                      Valeurs par défaut
                    </Button>
                  </div>
                  {sel.length === 0 && (
                    <p className="text-xs text-muted-foreground">Aucun cours ce jour-là.</p>
                  )}
                </>
              ) : (
                current.map((c) => (
                  <div key={c} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    {c}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {(dayPreview?.events || []).some((e) => e.type === "evenement") && (
            <Button
              variant="outline"
              onClick={() => {
                setDayPreview(null);
                navigate("/actualites");
              }}
            >
              Voir les actualités
            </Button>
          )}
          <Button variant="outline" onClick={() => setDayPreview(null)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
