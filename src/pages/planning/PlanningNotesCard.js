import { useMemo } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import PlanningTeamAbsences from '../../components/PlanningTeamAbsences';
import { NameTextarea } from '../../components/NameAutocomplete';

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
  const names = useMemo(() => (techniciens || []).map((t) => [t.prenom, t.nom].filter(Boolean).join(' ')).filter(Boolean), [techniciens]);
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
          <NameTextarea
            className="w-full min-h-[120px] text-sm border border-input rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-ring p-2 resize-y"
            names={names}
            value={notes[activeDay] || ""}
            onChange={(v) =>
              setNotes((prev) => ({
                ...prev,
                [activeDay]: v,
              }))
            }
            placeholder="Notes / informations pertinentes..."
          />
          <p className="text-xs text-muted-foreground">
            Astuce : écris « Jean — du 18/10 au 25/10 » (nom + période) : c'est lu comme une absence — alerte quand
            tu l'affectes ce jour-là, et plus de rappel d'absences pour cette personne.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
