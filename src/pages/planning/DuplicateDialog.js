import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

export function DuplicateDialog({
  duplicateChoice,
  duplicateDialog,
  duplicateSectionNames,
  duplicating,
  handleDuplicateLastMonth,
  planning,
  setDuplicateChoice,
  setDuplicateDialog,
}) {
  return (
    <Dialog open={duplicateDialog} onOpenChange={setDuplicateDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dupliquer le mois dernier</DialogTitle>
          <DialogDescription>
            Choisissez les sections à remplir avec les affectations du mois
            précédent. Seules les cases vides sont complétées, rien n'est
            écrasé.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {duplicateSectionNames.map((name) => {
            const last = planning?.section_last_edit?.[name];
            return (
              <label
                key={name}
                className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={!!duplicateChoice[name]}
                  onChange={(e) =>
                    setDuplicateChoice((c) => ({
                      ...c,
                      [name]: e.target.checked,
                    }))
                  }
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {last
                      ? `Dernière modification : ${last.user_name} · ${new Date(
                          last.at,
                        ).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Aucune modification enregistrée"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDuplicateChoice(
                  Object.fromEntries(
                    duplicateSectionNames.map((n) => [n, true]),
                  ),
                )
              }
            >
              Tout cocher
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setDuplicateChoice(
                  Object.fromEntries(
                    duplicateSectionNames.map((n) => [n, false]),
                  ),
                )
              }
            >
              Tout décocher
            </Button>
          </div>
          <Button
            disabled={
              duplicating ||
              !duplicateSectionNames.some((n) => duplicateChoice[n])
            }
            onClick={() => {
              const chosen = duplicateSectionNames.filter(
                (n) => duplicateChoice[n],
              );
              setDuplicateDialog(false);
              handleDuplicateLastMonth(chosen);
            }}
          >
            Dupliquer ({duplicateSectionNames.filter((n) => duplicateChoice[n]).length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
