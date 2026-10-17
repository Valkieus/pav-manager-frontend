import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export function AddCategoryDialog({
  addCategoryDialog,
  newCategoryName,
  saveNewCategory,
  setAddCategoryDialog,
  setNewCategoryName,
}) {
  return (
    <Dialog
      open={!!addCategoryDialog}
      onOpenChange={(open) => !open && setAddCategoryDialog(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une catégorie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Ex: PHOTOGRAPHES"
            onKeyDown={(e) => e.key === "Enter" && saveNewCategory()}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setAddCategoryDialog(null)}
            >
              Annuler
            </Button>
            <Button onClick={saveNewCategory} className="flex-1">
              Ajouter
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
