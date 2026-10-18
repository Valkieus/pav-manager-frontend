import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Calendar, ChevronLeft, ChevronRight, AlarmClock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { MiniCalendar } from './widgets';

export function DashboardMonthCard({
  brief,
  calOtherEvents,
  cours,
  canEditCours,
  calView,
  isCurrentCalMonth,
  setCalView,
  setDayPreview,
  setRetardDialogOpen,
  shiftCalMonth,
}) {
  return (
    <Card className="animate-fadeIn rounded-2xl border-primary/10 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg capitalize">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="flex-1">
            {new Date(calView.year, calView.month - 1, 1).toLocaleDateString(
              "fr-FR",
              { month: "long", year: "numeric" },
            )}
          </span>
          <span className="flex items-center gap-1 normal-case">
            {!isCurrentCalMonth && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const n = new Date();
                  setCalView({ year: n.getFullYear(), month: n.getMonth() + 1 });
                }}
              >
                Aujourd'hui
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => shiftCalMonth(-1)}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => shiftCalMonth(1)}
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* max-w cap : même sur un col-span-3 large, on évite que les
cases du calendrier deviennent démesurées sur grand écran. */}
        <div className="max-w-md mx-auto">
        <MiniCalendar
          year={calView.year}
          month={calView.month}
          serviceDates={
            isCurrentCalMonth ? brief?.calendar_service_dates || [] : []
          }
          events={
            isCurrentCalMonth
              ? [
                  ...(brief?.calendar_events || []),
                  ...(brief?.calendar_personal || []),
                ]
              : calOtherEvents
          }
          cours={cours?.days || {}}
          canEditCours={canEditCours}
          onDayClick={(dateStr, serviceInfo, dayEvents) =>
            setDayPreview({
              date: dateStr,
              isService: !!serviceInfo,
              ...(serviceInfo || {}),
              events: dayEvents || [],
            })
          }
        />
        </div>
        {brief?.retard_enabled && brief?.retard_is_scheduled_today && (
          <div className="mt-4 pt-3 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setRetardDialogOpen(true)}
            >
              <AlarmClock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              Je vais être en retard ce{" "}
              {brief.retard_today_service_type === "dimanche"
                ? "dimanche"
                : "vendredi"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
