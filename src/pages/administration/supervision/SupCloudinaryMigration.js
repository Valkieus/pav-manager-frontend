import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Cloud, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export function SupCloudinaryMigration({
  cloudinaryCfg,
  handleStartLedMigration,
  isSuperAdmin,
  ledMigrating,
  ledMigration,
}) {
  return (
    <>
      {/* Migration B2 -> Cloudinary (LED) */}
      {cloudinaryCfg?.configured && ledMigration && (
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="w-5 h-5" /> Migration des fichiers B2 vers Cloudinary
            </CardTitle>
            <CardDescription>
              Reprend toute seule : les fichiers que B2 refuse de lire (plafond quotidien) sont retentés plus tard. La migration répartit
              les fichiers entre les comptes Cloudinary connectés et s'arrête à 70 % de leurs crédits. Les vidéos de plus de 100 Mo
              restent sur B2 (limite de l'offre gratuite Cloudinary).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              {ledMigration.running
                ? `En cours : ${ledMigration.done ?? 0} migré(s) sur ${ledMigration.total ?? "?"}`
                : ledMigration.remaining > 0
                  ? `${ledMigration.remaining} fichier(s) encore sur B2`
                  : "Tous les fichiers sont chez Cloudinary"}
              {ledMigration.message && !ledMigration.running ? ` · ${ledMigration.message}` : ""}
            </p>
            {ledMigration.errors?.length > 0 && (
              <ul className="text-[11px] text-amber-600 dark:text-amber-500 list-disc pl-4 space-y-0.5">
                {ledMigration.errors.slice(0, 5).map((e, i) => (<li key={i}>{e}</li>))}
              </ul>
            )}
            {isSuperAdmin() && ledMigration.remaining > 0 && (
              <Button size="sm" variant="outline" onClick={handleStartLedMigration} disabled={ledMigrating || ledMigration.running}>
                {(ledMigrating || ledMigration.running) && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {ledMigration.running ? "Migration en cours…" : "Lancer / reprendre la migration"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
</>
  );
}
