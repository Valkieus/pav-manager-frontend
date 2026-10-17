import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Loader2 } from 'lucide-react';

export function SupStorage({
  formatBytes,
  handleSaveQuota,
  isSuperAdmin,
  quotaInput,
  quotaSaving,
  setQuotaInput,
  systemStatus,
}) {
  return (
    <>
        {/* Quota de stockage */}
        <Card>
          <CardHeader>
            <CardTitle>Quota de stockage</CardTitle>
            <CardDescription>
              Définis une limite de référence (en Go) pour suivre
              l'espace utilisé / restant. Sans quota défini, seul
              l'espace utilisé est affiché ci-dessus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {systemStatus.quota_bytes ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Quota</p>
                  <p className="text-lg font-bold">
                    {formatBytes(systemStatus.quota_bytes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Restant
                  </p>
                  <p className="text-lg font-bold">
                    {formatBytes(systemStatus.remaining_bytes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Utilisé
                  </p>
                  <p className="text-lg font-bold">
                    {systemStatus.percent_used}%
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun quota défini pour le moment.
              </p>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label>
                  Nouveau quota (Go) — laisser vide pour retirer
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ex: 5"
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSaveQuota}
                disabled={quotaSaving || !isSuperAdmin()}
                title={
                  !isSuperAdmin()
                    ? "Réservé à Super Admin (configurable dans Droits d'accès)"
                    : undefined
                }
              >
                {quotaSaving && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
    </>
  );
}
