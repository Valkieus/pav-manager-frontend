import { Dialog, DialogContent } from '../../components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Badge } from '../../components/ui/badge';

export function OrgNodeDialog({
  branchMembers,
  isMembre,
  navigate,
  selectedNode,
  setSelectedNode,
}) {
  return (
    <Dialog
      open={!!selectedNode}
      onOpenChange={(open) => !open && setSelectedNode(null)}
    >
      <DialogContent className="max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-h-[300px]">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold">{selectedNode?.name}</h2>
            {selectedNode?.responsable && (
              <p className="text-muted-foreground italic mt-1">
                {selectedNode.responsable}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              {branchMembers.length} personne
              {branchMembers.length !== 1 ? "s" : ""}
            </p>
            {!isMembre && (
              <button
                className="mt-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
                onClick={() => {
                  setSelectedNode(null);
                  navigate("/effectif");
                }}
              >
                Voir dans l'Effectif <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {branchMembers.map((t) => {
                const nomComplet = [t.prenom, t.nom]
                  .filter(Boolean)
                  .join(" ");
                const badge = (t.organigramme_label || t.poste_principal) && (
                  <Badge variant="secondary" className="text-xs">
                    {t.organigramme_label || t.poste_principal}
                  </Badge>
                );
                // Technicien voit les noms de l'organigramme mais n'a pas
                // accès à la fiche individuelle (page Effectif).
                if (isMembre) {
                  return (
                    <div
                      key={t.id}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded"
                    >
                      <span className="text-sm">{nomComplet}</span>
                      {badge}
                    </div>
                  );
                }
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedNode(null);
                      navigate(`/effectif?tech=${t.id}`);
                    }}
                    className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-left transition-colors"
                  >
                    <span className="text-sm text-primary hover:underline">
                      {nomComplet}
                    </span>
                    {badge}
                  </button>
                );
              })}
              {branchMembers.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Aucun membre trouvé
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
