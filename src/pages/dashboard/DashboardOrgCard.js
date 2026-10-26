import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Globe, ChevronRight, Pencil } from 'lucide-react';
import { PortalLinkItem } from './PortalLinkItem';

export function DashboardOrgCard({
  busyKind,
  canEdit,
  links,
  onEdit,
  onOpenLink,
  setCharismaOpen,
}) {
  return (
    <Card className="animate-fadeIn stagger-4 overflow-hidden rounded-2xl border-primary/10 shadow-sm">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Portail Charisma
            {canEdit && (
              <button type="button" onClick={onEdit} className="ml-auto inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-normal text-muted-foreground hover:text-foreground" data-testid="portal-edit">
                <Pencil className="w-3.5 h-3.5" /> Modifier la barre
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Bandeau PC : défilement horizontal. Téléphone : un seul bouton qui ouvre la liste verticale (fenêtre). */}
          <div className="hidden sm:flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {links.map((l) => <PortalLinkItem key={l.id} link={l} onOpen={onOpenLink} busy={busyKind === l.kind} />)}
          </div>
          <button
            type="button"
            onClick={() => setCharismaOpen(true)}
            className="flex sm:hidden items-center justify-between w-full px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Portail Charisma</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </CardContent>
      </div>
    </Card>
  );
}
