import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { PartyPopper, Calendar, CalendarOff, GraduationCap, Info, Loader2, Check, X, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';

export function DashboardTodayCard({
  brief,
  canEditServiceInfo,
  editingServiceInfo,
  formationsCount,
  handleSaveServiceInfo,
  navigate,
  savingServiceInfo,
  serviceInfoDraft,
  setEditingServiceInfo,
  setServiceInfoDraft,
  shiftsSentence,
  upcomingEvents,
}) {
  return (
    <Card className="animate-fadeIn border-primary/20 rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PartyPopper className="w-5 h-5 text-primary" />
          Résumé rapide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm">
            {brief?.service_status_text ? (
              <span
                className={
                  brief.service_status_text.startsWith("Tu es de service")
                    ? "font-semibold"
                    : "text-muted-foreground"
                }
              >
                {brief.service_status_text}
              </span>
            ) : shiftsSentence ? (
              <>
                Tu seras de service prochainement le{" "}
                <span className="font-semibold">{shiftsSentence}</span> !
              </>
            ) : (
              <span className="text-muted-foreground">
                Aucun service prévu prochainement pour toi.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <PartyPopper className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm">
              {brief?.guests_status_text ? (
                <span
                  className={
                    brief.guests_status_text.startsWith("Nous avons")
                      ? "font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  {brief.guests_status_text}
                </span>
              ) : upcomingEvents.length > 0 ? (
                <>
                  Nous avons{" "}
                  <span className="font-semibold">
                    {upcomingEvents.length} invité
                    {upcomingEvents.length > 1 ? "s" : ""}
                  </span>{" "}
                  prochainement :{" "}
                  {upcomingEvents.map((e) => e.titre).join(", ")}.
                </>
              ) : (
                <span className="text-muted-foreground">
                  Aucun invité prévu pour le moment.
                </span>
              )}
            </p>
            {(brief?.guests_detail || []).length > 0 && (
              <div className="mt-1.5 space-y-1">
                {brief.guests_detail.map((g, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-muted-foreground flex items-center gap-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-medium text-foreground">
                      {new Date(
                        g.date_evenement + "T00:00:00",
                      ).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span>
                      {g.titre}
                      {g.invite_nom ? ` — ${g.invite_nom}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="justify-start h-auto min-h-8 whitespace-normal text-left py-1.5"
            onClick={() => navigate("/mon-espace")}
          >
            <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
            Absent prochainement ? Renseigne-le ici
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="justify-start h-auto min-h-8 whitespace-normal text-left py-1.5"
            onClick={() => navigate("/formations")}
          >
            <GraduationCap className="w-3.5 h-3.5 mr-1.5 shrink-0" />
            {formationsCount} formation{formationsCount !== 1 ? "s" : ""}{" "}
            disponible{formationsCount !== 1 ? "s" : ""}, découvrir ici
          </Button>
        </div>

        <div className="flex items-start gap-2.5 pt-2 border-t border-border">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          {editingServiceInfo ? (
            <div className="flex-1 space-y-2">
              <Textarea
                value={serviceInfoDraft}
                onChange={(e) => setServiceInfoDraft(e.target.value)}
                className="text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={savingServiceInfo}
                  onClick={handleSaveServiceInfo}
                >
                  {savingServiceInfo ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  Enregistrer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingServiceInfo(false)}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Annuler
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground flex-1">
              {brief?.service_info_text}
              {canEditServiceInfo && (
                <button
                  className="ml-2 opacity-60 hover:opacity-100 inline-flex align-middle"
                  title="Modifier ce rappel"
                  onClick={() => {
                    setServiceInfoDraft(brief?.service_info_text || "");
                    setEditingServiceInfo(true);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
