import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Calendar, Clock } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

export function DayPreviewDialog({
  brief,
  dayPreview,
  navigate,
  setDayPreview,
}) {
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
