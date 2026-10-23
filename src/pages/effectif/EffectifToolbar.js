import { Card, CardContent } from '../../components/ui/card';
import { Search, LayoutGrid, List as ListIcon, IdCard, Send, FilterX } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { getBranchColor } from './constants';

export function EffectifToolbar({
  badgeCounts,
  branchCounts,
  canManageBadges,
  filterBadge,
  filterBranche,
  filtersActive,
  groupBy,
  resetFilters,
  savePref,
  searchTerm,
  setFilterBadge,
  setFilterBranche,
  setGroupBy,
  setSearchTerm,
  setSortBy,
  setViewMode,
  sortBy,
  techniciens,
  viewMode,
}) {
  return (
    <Card data-testid="effectif-toolbar">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un nom, un poste, un téléphone…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="effectif-search"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => savePref("effectif_sort", v, setSortBy)}>
              <SelectTrigger className="w-[150px]" aria-label="Trier"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nom">Trier : nom</SelectItem>
                <SelectItem value="branche">Trier : branche</SelectItem>
                <SelectItem value="poste">Trier : poste</SelectItem>
                <SelectItem value="niveau">Trier : niveau</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(v) => savePref("effectif_group", v, setGroupBy)}>
              <SelectTrigger className="w-[160px]" aria-label="Regrouper"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sans regroupement</SelectItem>
                <SelectItem value="lettre">Par lettre</SelectItem>
                <SelectItem value="branche">Par branche</SelectItem>
                <SelectItem value="poste">Par poste</SelectItem>
              </SelectContent>
            </Select>
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Affichage">
              <Button type="button" size="sm" variant={viewMode === "cards" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => savePref("effectif_view", "cards", setViewMode)} title="Cartes" data-testid="effectif-view-cards">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} className="h-8 px-2" onClick={() => savePref("effectif_view", "table", setViewMode)} title="Liste" data-testid="effectif-view-table">
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" data-testid="effectif-chips">
          <button
            type="button"
            onClick={() => setFilterBranche("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filterBranche === "all" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Toutes ({techniciens.length})
          </button>
          {Object.entries(branchCounts).map(([branche, count]) => {
            const c = getBranchColor(branche);
            const active = filterBranche === branche;
            return (
              <button
                key={branche}
                type="button"
                onClick={() => setFilterBranche(active ? "all" : branche)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${active ? `${c.bg} ${c.text} ${c.border} ring-2 ring-primary/40` : "hover:bg-muted"}`}
              >
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {branche} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
          {canManageBadges() && badgeCounts.total > 0 && (
            <>
              <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
              <button
                type="button"
                onClick={() => setFilterBadge(filterBadge === "avec" ? "all" : "avec")}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${filterBadge === "avec" ? "border-emerald-400 bg-emerald-100 text-emerald-800 ring-2 ring-primary/40 dark:bg-emerald-900/30 dark:text-emerald-300" : "hover:bg-muted"}`}
              >
                <IdCard className="h-3.5 w-3.5 text-emerald-600" /> Avec badge <span className="opacity-70">{badgeCounts.avec}</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterBadge(filterBadge === "sans" ? "all" : "sans")}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${filterBadge === "sans" ? "border-amber-400 bg-amber-100 text-amber-800 ring-2 ring-primary/40 dark:bg-amber-900/30 dark:text-amber-300" : "hover:bg-muted"}`}
              >
                <IdCard className="h-3.5 w-3.5 text-amber-600" /> Sans badge <span className="opacity-70">{badgeCounts.sans}</span>
              </button>
              {badgeCounts.enAttente > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                  <Send className="h-3.5 w-3.5" /> {badgeCounts.enAttente} demande(s) en attente
                </span>
              )}
            </>
          )}
          {filtersActive && (
            <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={resetFilters}>
              <FilterX className="mr-1 h-3.5 w-3.5" /> Réinitialiser
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
