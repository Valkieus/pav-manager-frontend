import { TabsContent } from '../../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import axios from 'axios';
import { toast } from 'sonner';
import BetaTesters from '../../components/BetaTesters';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { Plus, Loader2, Shield, ChevronDown, ChevronUp, Users, UserCog, Edit, Trash2 } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { ADMINISTRATION_PERMISSIONS, API, PERMISSION_MATRIX_MODULES, SEGMENTABLE_PERMISSIONS, SEGMENTABLE_PERMISSION_LABELS } from './constants';
import { ScopeChecklist } from './panels';

export function GroupsTab({
  currentUser,
  editingGroup,
  groupCategoryOptions,
  groupDialogOpen,
  groupForm,
  groups,
  groupsByCategory,
  handleDeleteGroup,
  handleEditGroup,
  handleGroupSubmit,
  isCategoryExpanded,
  isPlanningCategory,
  isReadOnlyAdmin,
  isSuperAdmin,
  openMembersDialog,
  planningScopeInput,
  planningScopeOptions,
  scopeOptions,
  scopeOverride,
  setEditingGroup,
  setGroupDialogOpen,
  setGroupForm,
  setPlanningScopeInput,
  setScopeOverride,
  submitting,
  toggleCategory,
  togglePermission,
  users,
}) {
  return (
    <TabsContent value="groups" className="space-y-4">
      {isSuperAdmin() && currentUser?.username === "Guichard" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Compte de secours</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">Le mot de passe change chaque semaine et vous est envoyé par notification. Si vous ne l'avez pas reçu, générez-en un nouveau maintenant : il arrive dans vos notifications (cloche).</p>
            <Button variant="outline" onClick={async () => {
              if (!window.confirm("Générer un NOUVEAU mot de passe pour le compte de secours et me l'envoyer par notification ?")) return;
              try { await axios.post(`${API}/admin/secours/rotate-now`); toast.success("Nouveau mot de passe envoyé dans vos notifications"); }
              catch (e) { toast.error(e.response?.data?.detail || "Envoi impossible"); }
            }}>Recevoir un nouveau mot de passe du compte de secours</Button>
          </CardContent>
        </Card>
      )}
      {isSuperAdmin() && <BetaTesters users={users} />}
      <div className="flex justify-end">
        <Dialog
          open={groupDialogOpen}
          onOpenChange={(open) => {
            setGroupDialogOpen(open);
            if (!open) {
              setGroupForm({
                name: "",
                description: "",
                category: "",
                permissions: [],
                planning_full_control: false,
                planning_structure: false,
                planning_scope: [],
                scope_map: {},
              });
              setPlanningScopeInput("");
              setEditingGroup(null);
            }
          }}
        >
          {!isReadOnlyAdmin && (
            <DialogTrigger asChild>
              <Button data-testid="add-group-btn">
                <Plus className="w-4 h-4 mr-2" /> Nouveau groupe
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingGroup ? "Modifier" : "Créer"} un groupe
              </DialogTitle>
              <DialogDescription>
                Définissez les permissions du groupe
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du groupe *</Label>
                <Input
                  value={groupForm.name}
                  onChange={(e) =>
                    setGroupForm({ ...groupForm, name: e.target.value })
                  }
                  placeholder="Ex: Coordination Planning"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={groupForm.description}
                  onChange={(e) =>
                    setGroupForm({
                      ...groupForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Description du groupe"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <p className="text-xs text-muted-foreground">
                  Regroupe ce groupe avec les autres de la même
                  catégorie dans la liste ci-dessous (ex. "Planning"
                  pour tous les groupes Planning_*). Laissez vide pour
                  garder la catégorie déduite automatiquement du nom.
                </p>
                <Input
                  list="group-category-options"
                  value={groupForm.category}
                  onChange={(e) =>
                    setGroupForm({
                      ...groupForm,
                      category: e.target.value,
                    })
                  }
                  placeholder={
                    groupCategoryOptions.length > 0
                      ? `Ex: ${groupCategoryOptions[0]}`
                      : "Ex: Planning"
                  }
                />
                <datalist id="group-category-options">
                  {groupCategoryOptions.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Permissions par module</Label>
                <p className="text-xs text-muted-foreground">
                  Lecture / Écriture / Suppression pour chaque module,
                  comme un groupe RO/RW Active Directory. « Spécial »
                  couvre l'action propre au module (valider un devis/une
                  formation, réserver une salle).
                </p>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left font-medium px-3 py-2">
                          Module
                        </th>
                        <th className="text-center font-medium px-2 py-2 w-16">
                          Lecture
                        </th>
                        <th className="text-center font-medium px-2 py-2 w-16">
                          Écriture
                        </th>
                        <th className="text-center font-medium px-2 py-2 w-20">
                          Suppr.
                        </th>
                        <th className="text-center font-medium px-2 py-2 w-24">
                          Spécial
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_MATRIX_MODULES.map((mod) => {
                        const readKey = `${mod.prefix}.read`;
                        const writeKey = `${mod.prefix}.write`;
                        const deleteKey = `${mod.prefix}.delete`;
                        return (
                          <tr
                            key={mod.prefix}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-3 py-2 font-medium">
                              {mod.label}
                            </td>
                            <td className="text-center px-2 py-2">
                              <Checkbox
                                checked={groupForm.permissions.includes(
                                  readKey,
                                )}
                                onCheckedChange={() =>
                                  togglePermission(readKey)
                                }
                              />
                            </td>
                            <td className="text-center px-2 py-2">
                              <Checkbox
                                checked={groupForm.permissions.includes(
                                  writeKey,
                                )}
                                onCheckedChange={() =>
                                  togglePermission(writeKey)
                                }
                              />
                            </td>
                            <td className="text-center px-2 py-2">
                              {mod.noDelete ? (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              ) : (
                                <Checkbox
                                  checked={groupForm.permissions.includes(
                                    deleteKey,
                                  )}
                                  onCheckedChange={() =>
                                    togglePermission(deleteKey)
                                  }
                                />
                              )}
                            </td>
                            <td className="text-center px-2 py-2">
                              {mod.special ? (
                                <label
                                  className="inline-flex items-center gap-1 cursor-pointer"
                                  title={mod.special.label}
                                >
                                  <Checkbox
                                    checked={groupForm.permissions.includes(
                                      mod.special.key,
                                    )}
                                    onCheckedChange={() =>
                                      togglePermission(mod.special.key)
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {mod.special.label}
                                  </span>
                                </label>
                              ) : (
                                <span className="text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium mb-2">
                    Administration (droits système)
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {ADMINISTRATION_PERMISSIONS.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={groupForm.permissions.includes(p.key)}
                          onCheckedChange={() => togglePermission(p.key)}
                        />
                        <span className="text-muted-foreground">
                          {p.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {groupForm.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {groupForm.permissions.map((p) => (
                      <Badge
                        key={p}
                        variant="secondary"
                        className="text-xs"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {SEGMENTABLE_PERMISSIONS.filter((p) =>
                groupForm.permissions.includes(p),
              ).length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Périmètre par section</Label>
                  <p className="text-xs text-muted-foreground">
                    Pour chaque droit accordé ci-dessus qui peut être
                    limité à certaines valeurs, choisissez « Contrôle
                    total » ou une liste de sections précises — exactement
                    le même principe que la segmentation du Planning
                    ci-dessous.
                  </p>
                  {SEGMENTABLE_PERMISSIONS.filter((p) =>
                    groupForm.permissions.includes(p),
                  ).map((permKey) => {
                    const options = scopeOptions[permKey] || [];
                    const scopeList = groupForm.scope_map[permKey] || [];
                    // Le switch reflète scopeOverride si l'utilisateur l'a
                    // manipulé pendant cette session d'édition, sinon il se
                    // déduit de la liste (vide = contrôle total). Sans ce
                    // découplage, décocher "Contrôle total" alors que la
                    // liste est encore vide repassait aussitôt le switch à
                    // ON (la liste restant vide dans les deux cas).
                    const overrideVal = scopeOverride[permKey];
                    const isTotal =
                      overrideVal !== undefined
                        ? overrideVal
                        : scopeList.length === 0;
                    return (
                      <div
                        key={permKey}
                        className="rounded-lg border p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {SEGMENTABLE_PERMISSION_LABELS[permKey]}
                          </span>
                          <label className="flex items-center gap-2 text-xs cursor-pointer whitespace-nowrap">
                            <Switch
                              checked={isTotal}
                              onCheckedChange={(checked) => {
                                setScopeOverride((prev) => ({
                                  ...prev,
                                  [permKey]: checked,
                                }));
                                if (checked) {
                                  // Retour à "Contrôle total" : on efface la
                                  // sélection de sections spécifiques.
                                  setGroupForm((prev) => ({
                                    ...prev,
                                    scope_map: {
                                      ...prev.scope_map,
                                      [permKey]: [],
                                    },
                                  }));
                                }
                              }}
                            />
                            Contrôle total
                          </label>
                        </div>
                        {!isTotal && (
                          <div className="space-y-1">
                            {options.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Aucune valeur disponible pour l'instant.
                              </p>
                            ) : (
                              <ScopeChecklist
                                options={options}
                                selected={scopeList}
                                onToggle={(opt) => {
                                  setGroupForm((prev) => {
                                    const cur =
                                      prev.scope_map[permKey] || [];
                                    const next = cur.includes(opt)
                                      ? cur.filter((v) => v !== opt)
                                      : [...cur, opt];
                                    return {
                                      ...prev,
                                      scope_map: {
                                        ...prev.scope_map,
                                        [permKey]: next,
                                      },
                                    };
                                  });
                                }}
                              />
                            )}
                            {scopeList.length === 0 && (
                              <p className="text-xs text-amber-600">
                                Aucune section sélectionnée = accès total
                                tant que rien n'est coché.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {isPlanningCategory(groupForm.category) && (
              <div className="space-y-2 border-t pt-4">
                <Label>Segmentation du planning</Label>
                <p className="text-xs text-muted-foreground">
                  Définit quelles sections/postes du Planning les membres
                  Responsable de ce groupe peuvent voir et éditer. Sans
                  accès complet, un Responsable ne verra que les sections
                  listées ci-dessous.
                </p>
                <label className="flex items-center gap-2 cursor-pointer text-sm mt-2">
                  <Switch
                    checked={groupForm.planning_full_control}
                    onCheckedChange={(checked) =>
                      setGroupForm({
                        ...groupForm,
                        planning_full_control: checked,
                      })
                    }
                  />
                  <span>Accès complet au planning (toutes sections)</span>
                </label>
                {!groupForm.planning_full_control && (
                  <label className="flex items-start gap-2 cursor-pointer text-sm mt-2" data-testid="planning-structure-switch">
                    <Switch
                      checked={!!groupForm.planning_structure}
                      onCheckedChange={(checked) => setGroupForm({ ...groupForm, planning_structure: checked })}
                    />
                    <span>
                      Peut aussi modifier la <b>structure</b> de ces sections : ajouter, renommer, fusionner / défusionner, griser,
                      déplacer et supprimer des lignes — uniquement dans les sections cochées ci-dessous.
                    </span>
                  </label>
                )}
                {!groupForm.planning_full_control && (
                  <div className="space-y-2 pt-1">
                    {planningScopeOptions.sections.length > 0 ||
                    planningScopeOptions.postes.length > 0 ? (
                      <>
                        {planningScopeOptions.sections.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Sections
                            </p>
                            <ScopeChecklist
                              options={planningScopeOptions.sections}
                              selected={groupForm.planning_scope}
                              searchPlaceholder="Rechercher une section…"
                              onToggle={(opt) => {
                                const next =
                                  groupForm.planning_scope.includes(opt)
                                    ? groupForm.planning_scope.filter(
                                        (v) => v !== opt,
                                      )
                                    : [...groupForm.planning_scope, opt];
                                setGroupForm({
                                  ...groupForm,
                                  planning_scope: next,
                                });
                              }}
                            />
                          </div>
                        )}
                        {planningScopeOptions.postes.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Postes (mot-clé)
                            </p>
                            <ScopeChecklist
                              options={planningScopeOptions.postes}
                              selected={groupForm.planning_scope}
                              searchPlaceholder="Rechercher un poste…"
                              onToggle={(opt) => {
                                const next =
                                  groupForm.planning_scope.includes(opt)
                                    ? groupForm.planning_scope.filter(
                                        (v) => v !== opt,
                                      )
                                    : [...groupForm.planning_scope, opt];
                                setGroupForm({
                                  ...groupForm,
                                  planning_scope: next,
                                });
                              }}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Aucune section/poste détecté dans les plannings
                        existants pour l'instant — utilisez le champ
                        ci-dessous.
                      </p>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Ajouter une valeur personnalisée (si absente
                        ci-dessus)
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={planningScopeInput}
                          onChange={(e) =>
                            setPlanningScopeInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = planningScopeInput.trim();
                              if (
                                val &&
                                !groupForm.planning_scope.includes(val)
                              ) {
                                setGroupForm({
                                  ...groupForm,
                                  planning_scope: [
                                    ...groupForm.planning_scope,
                                    val,
                                  ],
                                });
                              }
                              setPlanningScopeInput("");
                            }
                          }}
                          placeholder="Ex: CADREURS, REGIE, DIFFUSION"
                          className="h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const val = planningScopeInput.trim();
                            if (
                              val &&
                              !groupForm.planning_scope.includes(val)
                            ) {
                              setGroupForm({
                                ...groupForm,
                                planning_scope: [
                                  ...groupForm.planning_scope,
                                  val,
                                ],
                              });
                            }
                            setPlanningScopeInput("");
                          }}
                        >
                          Ajouter
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Ceci ajoute la valeur à la sélection — elle
                        n'efface jamais ce qui est déjà coché.
                      </p>
                    </div>
                    {groupForm.planning_scope.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Aucune section sélectionnée = accès total tant que
                        rien n'est coché.
                      </p>
                    )}
                  </div>
                )}
              </div>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingGroup ? "Modifier" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Aucun groupe créé</p>
            <p className="text-sm text-muted-foreground mt-1">
              Créez des groupes pour gérer les permissions finement
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupsByCategory.map(([category, catGroups]) => {
            const expanded = isCategoryExpanded(category);
            const totalMembers = catGroups.reduce(
              (a, g) => a + (g.members_count || 0),
              0,
            );
            return (
              <div
                key={category}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-muted-foreground -rotate-90" />
                    )}
                    <span className="font-semibold text-sm">
                      {category}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {catGroups.length} groupe
                      {catGroups.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {totalMembers} membre{totalMembers > 1 ? "s" : ""}{" "}
                    au total
                  </span>
                </button>
                {expanded && (
                  <div className="divide-y">
                    {catGroups.map((group) => (
                      <div
                        key={group.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30"
                      >
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{group.name}</span>
                  <button
                    className="cursor-pointer"
                    onClick={() => openMembersDialog(group)}
                    title="Voir / modifier les membres"
                  >
                    <Badge
                      variant="outline"
                      className="hover:bg-muted text-xs"
                    >
                      <Users className="w-3 h-3 mr-1" />
                      {group.members_count} membre(s)
                    </Badge>
                  </button>
                  {group.planning_full_control ? (
                    <Badge variant="outline" className="text-xs">
                      Planning : accès complet
                    </Badge>
                  ) : (group.planning_scope || []).length > 0 ? (
                    <Badge variant="outline" className="text-xs">
                      Planning : {group.planning_scope.join(", ")}
                    </Badge>
                  ) : null}
                  {group.planning_structure && !group.planning_full_control && (
                    <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                      Peut modifier les lignes
                    </Badge>
                  )}
                  {Object.entries(group.scope_map || {})
                    .filter(([, v]) => (v || []).length > 0)
                    .map(([permKey, values]) => (
                      <Badge
                        key={permKey}
                        variant="outline"
                        className="text-xs"
                      >
                        {(
                          SEGMENTABLE_PERMISSION_LABELS[permKey] ||
                          permKey
                        )
                          .split("—")[0]
                          .trim()}{" "}
                        : {values.join(", ")}
                      </Badge>
                    ))}
                </div>
                {group.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(group.permissions || []).slice(0, 8).map((p) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {p}
                    </Badge>
                  ))}
                  {(group.permissions || []).length > 8 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{group.permissions.length - 8}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  title={
                    isReadOnlyAdmin
                      ? "Voir les membres"
                      : "Gérer les membres"
                  }
                  onClick={() => openMembersDialog(group)}
                >
                  <UserCog className="w-4 h-4" />
                </Button>
                {!isReadOnlyAdmin && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditGroup(group)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
                    </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </TabsContent>
  );
}
