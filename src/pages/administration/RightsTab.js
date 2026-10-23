import { TabsContent } from '../../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Lock, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../../components/ui/table';

export function RightsTab({
  rightsBusyKey,
  rightsLoading,
  rightsRows,
  toggleRolePermission,
}) {
  return (
    <TabsContent value="rights" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Droits d'accès
          </CardTitle>
          <CardDescription>
            Ajoutez, retirez ou modifiez les droits accordés à chaque
            rôle. Les cases grisées sont des droits de base du rôle (ou de
            l'accès Admin) et ne peuvent pas être retirées ici. Super
            Admin possède toujours l'ensemble des droits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rightsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
            {/* Téléphone : chaque droit en carte avec ses interrupteurs par rôle */}
            <div className="space-y-2 md:hidden" data-testid="rights-mobile-list">
              {(() => {
                const LABELS = { actualites: "Actualités", documents: "Documents", effectif: "Effectif", planning: "Planning", devis: "Devis", formations: "Formations", logistique: "Logistique / Matériel", led: "Éléments LED", salles: "Salles", admin: "Supervision & Maintenance" };
                let last = null;
                const out = [];
                rightsRows.forEach((row) => {
                  const cat = row.key.split(".")[0];
                  if (cat !== last) {
                    last = cat;
                    out.push(<p key={`c-${cat}`} className="pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{LABELS[cat] || cat}</p>);
                  }
                  out.push(
                    <div key={row.key} className="rounded-xl border p-3">
                      <p className="mb-2 text-sm font-medium">{row.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {["Responsable", "Coordination", "Admin"].map((role) => {
                          const cell = row.roles[role] || {};
                          const busy = rightsBusyKey === `${row.key}:${role}`;
                          return (
                            <label key={role} title={cell.reason || ""} className={`flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm ${cell.locked ? "opacity-60" : ""}`}>
                              {role}
                              <input type="checkbox" checked={!!cell.granted} disabled={cell.locked || busy}
                                onChange={(e) => toggleRolePermission(row.key, role, e.target.checked)} className="h-5 w-5" />
                            </label>
                          );
                        })}
                        <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm opacity-60">
                          Super Admin
                          <input type="checkbox" checked disabled className="h-5 w-5" />
                        </label>
                      </div>
                    </div>,
                  );
                });
                return out;
              })()}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Droit</TableHead>
                    <TableHead className="text-center">
                      Responsable
                    </TableHead>
                    <TableHead className="text-center">
                      Coordination
                    </TableHead>
                    <TableHead className="text-center">Admin</TableHead>
                    <TableHead className="text-center">
                      Super Admin
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const CATEGORY_LABELS = {
                      actualites: "Actualités",
                      documents: "Documents",
                      effectif: "Effectif",
                      planning: "Planning",
                      devis: "Devis",
                      formations: "Formations",
                      logistique: "Logistique / Matériel",
                      led: "Éléments LED",
                      salles: "Salles",
                      admin: "Supervision & Maintenance",
                    };
                    let lastCategory = null;
                    const out = [];
                    rightsRows.forEach((row) => {
                      const category = row.key.split(".")[0];
                      if (category !== lastCategory) {
                        lastCategory = category;
                        out.push(
                          <TableRow
                            key={`cat-${category}`}
                            className="bg-muted/50 hover:bg-muted/50"
                          >
                            <TableCell
                              colSpan={5}
                              className="font-semibold text-xs uppercase tracking-wide text-muted-foreground py-2"
                            >
                              {CATEGORY_LABELS[category] || category}
                            </TableCell>
                          </TableRow>,
                        );
                      }
                      out.push(
                        <TableRow key={row.key}>
                          <TableCell className="font-medium">
                            {row.label}
                          </TableCell>
                          {["Responsable", "Coordination", "Admin"].map(
                            (role) => {
                              const cell = row.roles[role] || {};
                              const busy =
                                rightsBusyKey === `${row.key}:${role}`;
                              return (
                                <TableCell
                                  key={role}
                                  className="text-center"
                                >
                                  <input
                                    type="checkbox"
                                    checked={cell.granted}
                                    disabled={cell.locked || busy}
                                    title={cell.reason || ""}
                                    onChange={(e) =>
                                      toggleRolePermission(
                                        row.key,
                                        role,
                                        e.target.checked,
                                      )
                                    }
                                    className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                  />
                                </TableCell>
                              );
                            },
                          )}
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked
                              disabled
                              title="Super Admin a toujours tous les droits"
                              className="w-4 h-4 opacity-60"
                            />
                          </TableCell>
                        </TableRow>,
                      );
                    });
                    return out;
                  })()}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Certaines actions restent réservées à Super Admin et
        n'apparaissent pas dans ce tableau pour des raisons de sécurité :
        gestion des comptes utilisateurs, gestion des groupes, et
        suppressions définitives. Le contrôle fin du Planning par section
        (Cadreurs, Régisseurs, Diffusion, Régie, etc.) ne se règle pas ici
        mais dans l'onglet Groupes & Droits, via les groupes Planning_*.
      </p>
    </TabsContent>
  );
}
