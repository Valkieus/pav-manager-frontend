import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export function EditSectionDialog({
  editRoleLabel,
  editRoleSeparateur,
  editSectionDialog,
  saveRoleLabel,
  setEditRoleLabel,
  setEditRoleSeparateur,
  setEditSectionDialog,
}) {
  return (
    <Dialog
      open={!!editSectionDialog}
      onOpenChange={() => setEditSectionDialog(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Options du poste</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={editRoleLabel}
            onChange={(e) => setEditRoleLabel(e.target.value)}
            placeholder="Nom du poste"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={editRoleSeparateur}
              onChange={(e) => setEditRoleSeparateur(e.target.checked)}
            />
            Ajouter un séparateur (ligne épaisse) juste après ce poste
          </label>
          <Button onClick={saveRoleLabel} className="w-full">
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
