import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Settings, Check, X, Edit, Trash2, Plus } from 'lucide-react';
import { Input } from '../../components/ui/input';

export function PosteManagerDialog({
  enums,
  handleAddPoste,
  handleDeletePoste,
  handleRenamePosteSave,
  newPosteLabel,
  posteBusy,
  posteManagerOpen,
  renamingPoste,
  setNewPosteLabel,
  setPosteManagerOpen,
  setRenamingPoste,
}) {
  return (
    <Dialog
      open={posteManagerOpen}
      onOpenChange={(open) => {
        setPosteManagerOpen(open);
        if (!open) {
          setNewPosteLabel("");
          setRenamingPoste(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Gérer les postes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gérer les postes</DialogTitle>
          <DialogDescription>
            Ajoutez, renommez ou supprimez les postes
            principal/secondaires proposés sur les fiches.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {(enums.postes || []).map((p) => (
            <div
              key={p}
              className="flex items-center gap-2 border rounded-lg px-3 py-2"
            >
              {renamingPoste?.old === p ? (
                <>
                  <Input
                    className="h-8"
                    value={renamingPoste.value}
                    onChange={(e) =>
                      setRenamingPoste({
                        ...renamingPoste,
                        value: e.target.value,
                      })
                    }
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    disabled={posteBusy}
                    onClick={handleRenamePosteSave}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setRenamingPoste(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm truncate">{p}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      setRenamingPoste({ old: p, value: p })
                    }
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive"
                    disabled={posteBusy}
                    onClick={() => handleDeletePoste(p)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {(enums.postes || []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun poste défini.
            </p>
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="Nouveau poste..."
            value={newPosteLabel}
            onChange={(e) => setNewPosteLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddPoste();
              }
            }}
          />
          <Button
            onClick={handleAddPoste}
            disabled={posteBusy || !newPosteLabel.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
