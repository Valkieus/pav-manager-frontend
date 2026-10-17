import { TabsContent } from '../../components/ui/tabs';
import { NotificationRoutingPanel } from './panels';

export function NotificationsTab() {
  return (
    <TabsContent value="notifications" className="space-y-4">
      <NotificationRoutingPanel />
    </TabsContent>
  );
}
