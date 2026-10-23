import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export function EditCategoryDialog({
  editCategoryDialog,
  editCategoryLabel,
  saveCategoryLabel,
  setEditCategoryDialog,
  setEditCategoryLabel,
}) {
  return (
    <Dialog
      open={!!editCategoryDialog}
      onOpenChange={(open) => !open && setEditCategoryDialog(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer la catégorie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={editCategoryLabel}
            onChange={(e) => setEditCategoryLabel(e.target.value)}
            placeholder="Nom de la catégorie"
            onKeyDown={(e) => e.key === "Enter" && saveCategoryLabel()}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditCategoryDialog(null)}
            >
              Annuler
            </Button>
            <Button onClick={saveCategoryLabel} className="flex-1">
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
