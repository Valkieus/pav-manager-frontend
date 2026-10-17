import { TabsContent } from '../../components/ui/tabs';
import { Search, RefreshCw, Loader2, ScrollText } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';

export function LogsTab({
  fetchLogs,
  getActionIcon,
  getSeverityBadge,
  loading,
  logModuleFilter,
  logSearch,
  logSeverityFilter,
  logs,
  logsUpdatedAt,
  scheduleLogsRefresh,
  selectedLog,
  setLogModuleFilter,
  setLogSearch,
  setLogSeverityFilter,
  setSelectedLog,
}) {
  return (
    <TabsContent value="logs" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative w-full flex-1 sm:max-w-xs sm:min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Rechercher (action, utilisateur, détails)..."
              className="pl-9"
            />
          </div>
          <Select
            value={logModuleFilter}
            onValueChange={setLogModuleFilter}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modules</SelectItem>
              {Array.from(new Set(logs.map((l) => l.module || "Général")))
                .sort()
                .map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select
            value={logSeverityFilter}
            onValueChange={setLogSeverityFilter}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sévérité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sévérités</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
              <SelectItem value="warning">Attention</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Mise à jour automatique toutes les 20s
            {logsUpdatedAt
              ? ` — actualisé à ${new Date(logsUpdatedAt).toLocaleTimeString("fr-FR")}`
              : ""}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              fetchLogs();
              scheduleLogsRefresh();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <ScrollText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun log</p>
            </div>
          ) : (
            <>
            {/* Téléphone : une carte par entrée du journal (plus de tableau à faire défiler) */}
            <div className="divide-y md:hidden" data-testid="logs-mobile-list">
              {logs
                .filter((log) => {
                  const q = logSearch.trim().toLowerCase();
                  const okSearch = !q || (log.action || "").toLowerCase().includes(q) || (log.user_name || "").toLowerCase().includes(q) || (log.details || "").toLowerCase().includes(q);
                  const okModule = logModuleFilter === "all" || (log.module || "Général") === logModuleFilter;
                  const okSev = logSeverityFilter === "all" || (log.severity || "info") === logSeverityFilter;
                  return okSearch && okModule && okSev;
                })
                .map((log) => (
                  <button key={log.id} type="button" onClick={() => setSelectedLog(log)} className="flex w-full items-start gap-3 p-3 text-left active:bg-muted/60">
                    <span className="text-xl leading-none">{getActionIcon(log.action)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{log.action}</span>
                        {getSeverityBadge(log.severity || "info")}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {log.user_name} · {new Date(log.timestamp).toLocaleString("fr-FR")}
                      </span>
                      {log.details && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{log.details}</span>}
                      <Badge variant="outline" className="mt-1 text-[10px]">{log.module || "Général"}</Badge>
                    </span>
                  </button>
                ))}
            </div>
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead>Date & Heure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs
                  .filter((log) => {
                    const q = logSearch.trim().toLowerCase();
                    const matchesSearch =
                      !q ||
                      (log.action || "").toLowerCase().includes(q) ||
                      (log.user_name || "").toLowerCase().includes(q) ||
                      (log.details || "").toLowerCase().includes(q);
                    const logModule = log.module || "Général";
                    const matchesModule =
                      logModuleFilter === "all" ||
                      logModule === logModuleFilter;
                    const logSeverity = log.severity || "info";
                    const matchesSeverity =
                      logSeverityFilter === "all" ||
                      logSeverity === logSeverityFilter;
                    return (
                      matchesSearch && matchesModule && matchesSeverity
                    );
                  })
                  .map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLog(log)}
                      data-testid={`log-row-${log.id}`}
                    >
                      <TableCell className="text-xl">
                        {getActionIcon(log.action)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.action}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.module || "Général"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(log.severity || "info")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.user_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {log.details}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString("fr-FR")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-xl">
                    {getActionIcon(selectedLog.action)}
                  </span>
                  {selectedLog.action}
                </DialogTitle>
                <DialogDescription>
                  {new Date(selectedLog.timestamp).toLocaleString("fr-FR")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline" className="text-xs">
                    {selectedLog.module || "Général"}
                  </Badge>
                  {getSeverityBadge(selectedLog.severity || "info")}
                  <span className="text-muted-foreground">
                    par <strong>{selectedLog.user_name}</strong>
                  </span>
                </div>
                <div className="rounded-md bg-muted/50 p-3 whitespace-pre-wrap break-words">
                  {selectedLog.details || "Aucun détail"}
                </div>
                <div>
                  <p className="font-semibold mb-2">
                    Actions réalisées par {selectedLog.user_name}
                  </p>
                  {(() => {
                    const userActions = logs.filter(
                      (l) => l.user_id === selectedLog.user_id,
                    );
                    return (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">
                          {userActions.length} action(s) dans l'historique
                          chargé
                        </p>
                        <ul className="space-y-1 max-h-64 overflow-y-auto">
                          {userActions.map((l) => (
                            <li
                              key={l.id}
                              className={`flex gap-2 items-start rounded px-2 py-1 ${
                                l.id === selectedLog.id
                                  ? "bg-primary/10"
                                  : ""
                              }`}
                            >
                              <span>{getActionIcon(l.action)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{l.action}</p>
                                <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
                                  {l.details}
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground font-mono shrink-0">
                                {new Date(l.timestamp).toLocaleString(
                                  "fr-FR",
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
