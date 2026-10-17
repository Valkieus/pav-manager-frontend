import { DialogTrigger } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { HelpCircle } from 'lucide-react';

export function WorkflowInfoDialog() {
  return (
    <DialogTrigger asChild>
      <Button variant="outline" data-testid="workflow-info-btn">
        <HelpCircle className="w-4 h-4 mr-2" />
        Comment ça marche ?
      </Button>
    </DialogTrigger>
  );
}
