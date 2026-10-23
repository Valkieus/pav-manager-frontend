import { HardDrive, Server, CheckCircle2, XCircle, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../../components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../../components/ui/table';

export function SupDatabase({
  COLLECTIONS_COLLAPSED_COUNT,
  collectionsExpanded,
  collectionsSortBy,
  formatBytes,
  formatUptime,
  setCollectionsExpanded,
  setCollectionsSortBy,
  systemStatus,
}) {
  return (
    <>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 pt-1">
          <HardDrive className="w-3.5 h-3.5" /> Base de données
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" /> État général
              </CardTitle>
              <CardDescription>
                Rien ici ne devrait t'inquiéter : l'utilisation actuelle
                est très faible. Cette page se met à jour à chaque
                ouverture pour que tu puisses vérifier quand tu veux.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  {systemStatus.mongo_connected ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm">
                      Base de données
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {systemStatus.mongo_connected
                        ? "Connectée, fonctionne normalement"
                        : systemStatus.mongo_error ||
                          "Problème de connexion"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Activity className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">
                      Serveur actif depuis
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatUptime(
                        systemStatus.backend_uptime_seconds,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <HardDrive className="w-6 h-6 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">
                      Espace utilisé (données)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(systemStatus.db_data_size_bytes)} sur
                      disque
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stockage de la base de données</CardTitle>
              <CardDescription>
                Pour référence : à titre de comparaison, une clé USB
                fait généralement 8 000 à 64 000 Mo — l'app utilise
                aujourd'hui une fraction infime de cet ordre de
                grandeur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Données
                  </p>
                  <p className="text-lg font-bold">
                    {formatBytes(systemStatus.db_data_size_bytes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Sur disque
                  </p>
                  <p className="text-lg font-bold">
                    {formatBytes(systemStatus.db_storage_size_bytes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Index</p>
                  <p className="text-lg font-bold">
                    {formatBytes(systemStatus.db_index_size_bytes)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">
                    Documents
                  </p>
                  <p className="text-lg font-bold">
                    {(
                      systemStatus.db_objects_count || 0
                    ).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Détail par catégorie</CardTitle>
              <CardDescription>
                Ce qui prend le plus de place, du plus gros au plus
                petit.
              </CardDescription>
            </div>
            <Select
              value={collectionsSortBy}
              onValueChange={setCollectionsSortBy}
            >
              <SelectTrigger className="w-[190px] h-8 text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="size_desc">
                  Taille (plus gros d'abord)
                </SelectItem>
                <SelectItem value="size_asc">
                  Taille (plus petit d'abord)
                </SelectItem>
                <SelectItem value="count_desc">
                  Éléments (plus au moins)
                </SelectItem>
                <SelectItem value="name_asc">
                  Catégorie (A → Z)
                </SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {(() => {
              const sortedCollections = (systemStatus.collections || [])
                .filter((c) => c.count > 0)
                .sort((a, b) => {
                  if (collectionsSortBy === "size_asc")
                    return a.size_bytes - b.size_bytes;
                  if (collectionsSortBy === "count_desc")
                    return b.count - a.count;
                  if (collectionsSortBy === "name_asc")
                    return a.name.localeCompare(b.name);
                  return b.size_bytes - a.size_bytes; // size_desc (défaut)
                });
              const hiddenCount =
                sortedCollections.length - COLLECTIONS_COLLAPSED_COUNT;
              const visibleCollections = collectionsExpanded
                ? sortedCollections
                : sortedCollections.slice(
                    0,
                    COLLECTIONS_COLLAPSED_COUNT,
                  );
              return (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Éléments</TableHead>
                        <TableHead>Taille</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleCollections.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">
                            {c.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.count.toLocaleString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatBytes(c.size_bytes)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setCollectionsExpanded((prev) => !prev)
                      }
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border"
                    >
                      {collectionsExpanded ? (
                        <>
                          Voir moins{" "}
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          Voir {hiddenCount} de plus{" "}
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
    </>
  );
}
