import { Wrench, LogOut } from "lucide-react";
import { Button } from "./ui/button";

// Affichage UNIQUE de toute maintenance (une page ou le site entier) : même rendu quelle que soit la page.
export default function MaintenanceBlock({ titre, message, icon: Icon = Wrench, fullScreen = false, onLogout }) {
  const card = (
    <div className="max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm" data-testid="maintenance-block">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-8 w-8" />
        <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white shadow">
          <Wrench className="h-4 w-4" />
        </span>
      </div>
      <h1 className="text-xl font-bold">{titre ? `${titre} — en maintenance` : "En maintenance"}</h1>
      <p className="text-sm text-muted-foreground">
        {message || "Cette page sera prochainement disponible. Merci de votre patience."}
      </p>
      {onLogout && (
        <div className="pt-2">
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </div>
      )}
    </div>
  );
  return fullScreen ? (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">{card}</div>
  ) : (
    <div className="flex min-h-[60vh] items-center justify-center p-4">{card}</div>
  );
}
