import { Sparkles } from 'lucide-react';
import { Badge } from '../../components/ui/badge';

export function DashboardWelcome({
  accessChips,
  greeting,
  user,
}) {
  return (
    <div className="animate-fadeIn rounded-xl p-6 sm:p-8 text-white relative overflow-hidden border border-white/10 bg-[#02040a] [background-image:radial-gradient(120%_90%_at_85%_0%,hsl(var(--primary)/0.22),transparent_60%)]">
      <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" /> {user?.niveau_acces}
          </span>
          <h1 className="text-3xl font-bold">
            {greeting}, {user?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-white/80 mt-1">
            Tableau de bord du département PAV
          </p>
          {accessChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {accessChips.map((chip, i) => (
                <Badge
                  key={i}
                  className="font-normal text-xs border-transparent bg-white/15 text-white hover:bg-white/20"
                >
                  {chip}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-blue-200/80">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
