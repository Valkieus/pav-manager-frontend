import { Card, CardContent } from '../../components/ui/card';
import PlanningTeamAbsences from '../../components/PlanningTeamAbsences';

export function PlanningNotesCard({
  absences,
  activeDay,
  declaredAbsencesForActiveDay,
  notes,
  refreshAbsencesAfterChange,
  setAbsences,
  setNotes,
  techniciens,
}) {
  return (
    <Card className="print:hidden">
      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PlanningTeamAbsences
          techniciens={techniciens}
          declared={declaredAbsencesForActiveDay}
          text={absences[activeDay] || ""}
          onTextChange={(v) =>
            setAbsences((prev) => ({ ...prev, [activeDay]: v }))
          }
          onCreated={refreshAbsencesAfterChange}
        />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold">
            Notes / informations pertinentes
          </label>
          <textarea
            className="w-full min-h-[120px] text-sm border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring p-2 resize-y"
            value={notes[activeDay] || ""}
            onChange={(e) =>
              setNotes((prev) => ({
                ...prev,
                [activeDay]: e.target.value,
              }))
            }
            placeholder="Notes / informations pertinentes..."
          />
        </div>
      </CardContent>
    </Card>
  );
}
