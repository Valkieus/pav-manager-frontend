import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Calendar } from "lucide-react";

// Dates clés « événementielles » (France) calculées chaque année.
const easter = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
};
const nthSunday = (y, month, n) => {
  const first = new Date(y, month, 1);
  const offset = (7 - first.getDay()) % 7; // 1er dimanche
  return new Date(y, month, 1 + offset + (n - 1) * 7);
};
const lastSunday = (y, month) => {
  const last = new Date(y, month + 1, 0);
  return new Date(y, month, last.getDate() - last.getDay());
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const eventsOf = (y) => {
  const pentecost = addDays(easter(y), 49);
  let meres = lastSunday(y, 4);
  if (meres.getTime() === pentecost.getTime()) meres = nthSunday(y, 5, 1);
  return [
    { nom: "Fête des grands-mères", date: nthSunday(y, 2, 1), emoji: "👵" },
    { nom: "Pâques", date: easter(y), emoji: "🐣" },
    { nom: "Saint-Valentin", date: new Date(y, 1, 14), emoji: "💘" },
    { nom: "Fête des mères", date: meres, emoji: "💐" },
    { nom: "Fête des pères", date: nthSunday(y, 5, 3), emoji: "👔" },
    { nom: "Fête des grands-pères", date: nthSunday(y, 9, 1), emoji: "👴" },
    { nom: "Noël", date: new Date(y, 11, 25), emoji: "🎄" },
  ];
};

export default function DatesCles() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = [...eventsOf(today.getFullYear()), ...eventsOf(today.getFullYear() + 1)]
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date - b.date)
    .slice(0, 6);

  return (
    <Card className="animate-fadeIn">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Dates clés
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcoming.map((e) => {
            const days = Math.round((e.date - today) / 86400000);
            return (
              <div key={e.nom + e.date.getFullYear()} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="text-2xl" aria-hidden="true">{e.emoji}</span>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{e.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    {" · "}
                    {days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} j`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
