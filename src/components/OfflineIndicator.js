import { useOffline } from '../contexts/OfflineContext';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export const OfflineIndicator = () => {
  const { isOnline, pendingSync, syncPendingOperations } = useOffline();

  if (isOnline && pendingSync === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
      {!isOnline && (
        <Badge variant="destructive" className="flex items-center gap-2 py-2 px-3 animate-pulse">
          <WifiOff className="w-4 h-4" />
          Mode hors-ligne
        </Badge>
      )}
      
      {pendingSync > 0 && isOnline && (
        <Badge variant="secondary" className="flex items-center gap-2 py-2 px-3">
          <RefreshCw className="w-4 h-4 animate-spin" />
          {pendingSync} en attente
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 ml-1"
            onClick={syncPendingOperations}
          >
            Sync
          </Button>
        </Badge>
      )}
    </div>
  );
};
