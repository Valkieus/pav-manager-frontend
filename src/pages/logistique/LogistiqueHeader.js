import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../components/ui/dropdown-menu';
import { Button } from '../../components/ui/button';
import { Download, ChevronDown, CheckSquare, Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { POSTES_CAM } from './shared';

export function LogistiqueHeader({
  MOIS_NOMS_FR,
  SUB_TABS,
  exportDialogOpen,
  exportSel,
  exportingPdf,
  exportingXlsx,
  handleExportRegisseursPdf,
  handleExportRegisseursXlsx,
  runSelectedExport,
  seanceYears,
  setExportDialogOpen,
  setExportSel,
  setSubTab,
  subTab,
}) {
  return (
    <>
    <div className="flex items-center justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold">Régisseurs</h1>
      <p className="text-muted-foreground">Gestion du matériel, des entrées/sorties et des contacts du département</p>
    </div>
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" data-testid="regisseurs-export-menu-btn">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Exporter</span>
            <ChevronDown className="w-3.5 h-3.5 ml-1 hidden sm:inline" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setExportDialogOpen(true)} data-testid="regisseurs-export-select-btn">
            <CheckSquare className="w-4 h-4 mr-2" />
            Exporter une sélection…
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExportRegisseursXlsx}
            disabled={exportingXlsx}
            data-testid="regisseurs-export-xlsx-btn"
          >
            {exportingXlsx ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            Exporter tout (XLSX)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleExportRegisseursPdf}
            disabled={exportingPdf}
            data-testid="regisseurs-export-pdf-btn"
          >
            {exportingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Exporter tout (PDF)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
        <img
  className="hidden md:block h-20 object-contain shrink-0"                  src="data:image/png;base64,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"
                alt="Branche Régisseur"
                          />
                  </div>

    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exporter une sélection</DialogTitle>
          <DialogDescription>Choisissez le format, ce qu'il faut exporter et la période des Entrées / Sorties.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {[['xlsx', 'Excel (.xlsx)', FileSpreadsheet], ['pdf', 'PDF', FileText]].map(([id, label, Icon]) => (
              <Button key={id} type="button" variant={exportSel.format === id ? 'default' : 'outline'} className="flex-1" onClick={() => setExportSel((x) => ({ ...x, format: id }))}>
                <Icon className="w-4 h-4 mr-2" />{label}
              </Button>
            ))}
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            {[['seances', 'Entrées / Sorties (fiches)'], ['materiel', 'Inventaire (stock & matériel)'], ['contact', 'Contacts'], ['incidents', 'Incidents']].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 text-sm font-medium">
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={!!exportSel.sections[key]}
                  onChange={(e) => { const v = e.target.checked; setExportSel((x) => ({ ...x, sections: { ...x.sections, [key]: v } })); }} />
                {label}
              </label>
            ))}
          </div>
          {exportSel.sections.seances && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Année</Label>
                <select value={exportSel.year} onChange={(e) => { const v = e.target.value; setExportSel((x) => ({ ...x, year: v })); }} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="all">Toutes</option>
                  {seanceYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mois</Label>
                <select value={exportSel.month} onChange={(e) => { const v = e.target.value; setExportSel((x) => ({ ...x, month: v })); }} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="all">Tous</option>
                  {MOIS_NOMS_FR.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Caméra</Label>
                <select value={exportSel.poste} onChange={(e) => { const v = e.target.value; setExportSel((x) => ({ ...x, poste: v })); }} className="h-10 w-full rounded-md border bg-background px-2 text-sm">
                  <option value="all">Toutes</option>
                  {POSTES_CAM.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
          <Button className="w-full" onClick={runSelectedExport}>
            <Download className="w-4 h-4 mr-2" />Exporter
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <div className="flex flex-wrap gap-2 border-b pb-2">
      {SUB_TABS.map((t) => {
        const Icon = t.icon;
        return (
          <Button
            key={t.id}
            variant={subTab === t.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSubTab(t.id)}
            data-testid={`regisseur-tab-${t.id}`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {t.label}
          </Button>
        );
      })}
    </div>
    </>
  );
}
