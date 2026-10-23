import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { CalendarDays, Plus, Trash2, Save } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export function EditDatesDialog({
  activeDay,
  addDate,
  editDatesDialog,
  editingDates,
  newDate,
  removeDate,
  resetDatesToDefault,
  saveDates,
  setEditDatesDialog,
  setNewDate,
}) {
  return (
    <Dialog open={editDatesDialog} onOpenChange={setEditDatesDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Éditer les dates -{" "}
            {activeDay === "dimanche" ? "Dimanches" : "Vendredis"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addDate} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Ajouter
            </Button>
          </div>

          <div className="border rounded-lg p-2 max-h-[250px] overflow-y-auto space-y-1">
            {editingDates.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                Aucune date. Ajoutez-en ou réinitialisez.
              </p>
            ) : (
              editingDates.map((date) => (
                <div
                  key={date}
                  className="flex items-center justify-between p-2 hover:bg-muted rounded"
                >
                  <span className="font-medium">
                    {new Date(date + "T00:00:00").toLocaleDateString(
                      "fr-FR",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      },
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => removeDate(date)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetDatesToDefault}
              className="flex-1"
            >
              Réinitialiser
            </Button>
            <Button onClick={saveDates} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
