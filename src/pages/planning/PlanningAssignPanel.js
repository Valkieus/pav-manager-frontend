import { Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export function PlanningAssignPanel({
  assignmentRoster,
  effectiveRosterScope,
  myBranches,
  rosterPanelOpen,
  setRosterPanelOpen,
  setRosterScope,
}) {
  return (
    <div
      // pointer-events-none here + pointer-events-auto on just the
      // handle tab and the panel below: without this, this wrapper's
      // own (invisible, untransformed) hit box always spans the full
      // w-72 width at the right edge — even while "closed" — which was
      // sitting on top of and swallowing hover/clicks meant for the
      // Planning table's row-action buttons underneath it on desktop
      // (user feedback 21/09/2026: "quand je hover juste un peu sur la
      // zone il s'ouvre, je ne peux plus cliquer up/down/griser/
      // supprimer"). Now only the actually-visible parts (tab, open
      // panel) can receive/trigger events; everywhere else is
      // click-through.
      className="print:hidden fixed top-24 right-0 z-30 pointer-events-none"
      onMouseEnter={() => setRosterPanelOpen(true)}
      onMouseLeave={() => setRosterPanelOpen(false)}
    >
      {/* max-height was a flat 70vh, leaving visible unused space below
      the panel on both desktop and mobile (user feedback 21/09/2026)
      since the panel starts at top-24 (6rem from the top) — there was
      always more room below it than 70% of the FULL viewport. Use the
      space actually available under the top offset instead; dvh (where
      supported, notably mobile) accounts for the browser's address bar
      so it doesn't overflow off-screen there either. */}
      <style>{`
.roster-panel-scroll {
max-height: 70vh;
max-height: calc(100vh - 7rem);
max-height: calc(100dvh - 7rem);
}
`}</style>
      <div
        className={`relative w-72 max-w-[80vw] bg-card border border-border rounded-l-lg shadow-xl transition-transform duration-200 ease-out pointer-events-auto ${
          rosterPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setRosterPanelOpen((o) => !o)}
          title="Affectations du mois"
          className="absolute -left-9 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-primary text-primary-foreground rounded-l-lg px-1.5 py-3 shadow-lg pointer-events-auto"
        >
          <Users className="w-4 h-4" />
          {assignmentRoster.notAssigned.length > 0 && (
            <span className="text-[10px] font-bold leading-none bg-amber-400 text-amber-950 rounded-full w-4 h-4 flex items-center justify-center">
              {assignmentRoster.notAssigned.length}
            </span>
          )}
        </button>
        <div className="roster-panel-scroll p-4 space-y-4 overflow-y-auto">
          {myBranches.length > 0 && (
            <div className="space-y-1">
              <div className="inline-flex w-full rounded-md border p-0.5 text-xs">
                {[
                  ["mine", myBranches.length > 1 ? "Mes équipes" : "Mon équipe"],
                  ["all", "Général"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRosterScope(value)}
                    className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
                      effectiveRosterScope === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {effectiveRosterScope === "mine" && (
                <p className="text-[11px] text-muted-foreground">
                  {myBranches.join(", ")}
                </p>
              )}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
              Déjà affectés ce mois-ci ({assignmentRoster.assigned.length}
              )
            </p>
            <div className="flex flex-wrap gap-1">
              {assignmentRoster.assigned.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Personne pour l'instant.
                </p>
              ) : (
                assignmentRoster.assigned.map((n) => (
                  <Badge
                    key={n}
                    className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                  >
                    {n}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
              Pas encore affectés ({assignmentRoster.notAssigned.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {assignmentRoster.notAssigned.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Tout le monde est affecté.
                </p>
              ) : (
                assignmentRoster.notAssigned.map((n) => (
                  <Badge key={n} variant="outline">
                    {n}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
