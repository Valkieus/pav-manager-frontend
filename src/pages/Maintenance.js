import { Wrench, GraduationCap } from "lucide-react";

// Page temporaire : la fonctionnalité est en cours de refonte et sera prochainement disponible.
export default function Maintenance({ titre = "Cette page", icon: Icon = GraduationCap }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4" data-testid="maintenance-page">
      <div className="max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
          <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow">
            <Wrench className="h-4 w-4" />
          </span>
        </div>
        <h1 className="text-xl font-bold">{titre} — en maintenance</h1>
        <p className="text-sm text-muted-foreground">
          Cette page sera prochainement disponible. Merci de votre patience.
        </p>
      </div>
    </div>
  );
}
