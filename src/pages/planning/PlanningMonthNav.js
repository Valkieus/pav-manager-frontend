import { Card, CardContent } from '../../components/ui/card';
import { MOIS_NOMS, MIN_YEAR, MIN_MONTH_IN_MIN_YEAR, YEARS, MAX_YEAR } from './constants';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';

export function PlanningMonthNav({
  currentMonth,
  currentYear,
  isMembre,
  setCurrentMonth,
  setCurrentYear,
}) {
  return (
    <Card className="print:hidden">
      <CardContent className="p-3 sm:p-4">
        {isMembre ? (
          <div className="text-center font-medium text-sm sm:text-base">
            {MOIS_NOMS[currentMonth - 1]} {currentYear}
            <span className="text-muted-foreground text-xs sm:text-sm font-normal ml-2">
              (mois en cours)
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={
                currentYear === MIN_YEAR &&
                currentMonth <= MIN_MONTH_IN_MIN_YEAR
              }
              onClick={() => {
                if (
                  currentYear === MIN_YEAR &&
                  currentMonth <= MIN_MONTH_IN_MIN_YEAR
                )
                  return;
                if (currentMonth === 1) {
                  setCurrentMonth(12);
                  setCurrentYear((prev) => Math.max(MIN_YEAR, prev - 1));
                } else {
                  setCurrentMonth((prev) => prev - 1);
                }
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Select
                value={String(currentMonth)}
                onValueChange={(v) => setCurrentMonth(parseInt(v))}
              >
                <SelectTrigger className="w-[104px] sm:w-[140px] text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOIS_NOMS.map((nom, idx) => {
                    const monthNum = idx + 1;
                    if (
                      currentYear === MIN_YEAR &&
                      monthNum < MIN_MONTH_IN_MIN_YEAR
                    )
                      return null;
                    return (
                      <SelectItem key={idx} value={String(monthNum)}>
                        {nom}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Select
                value={String(currentYear)}
                onValueChange={(v) => {
                  const year = parseInt(v);
                  setCurrentYear(year);
                  if (
                    year === MIN_YEAR &&
                    currentMonth < MIN_MONTH_IN_MIN_YEAR
                  ) {
                    setCurrentMonth(MIN_MONTH_IN_MIN_YEAR);
                  }
                }}
              >
                <SelectTrigger className="w-[76px] sm:w-[100px] text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={currentYear === MAX_YEAR && currentMonth >= 12}
              onClick={() => {
                if (currentYear === MAX_YEAR && currentMonth >= 12) return;
                if (currentMonth === 12) {
                  setCurrentMonth(1);
                  setCurrentYear((prev) => Math.min(MAX_YEAR, prev + 1));
                } else {
                  setCurrentMonth((prev) => prev + 1);
                }
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
