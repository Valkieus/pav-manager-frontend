import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Globe } from 'lucide-react';
import { PortalLinkItem } from './PortalLinkItem';

export function CharismaDialog({ busyKind, charismaOpen, links, onOpenLink, setCharismaOpen }) {
  return (
    <Dialog open={charismaOpen} onOpenChange={setCharismaOpen}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Portail Charisma
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
          {links.map((l) => <PortalLinkItem key={l.id} link={l} onOpen={onOpenLink} busy={busyKind === l.kind} fullWidth />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
