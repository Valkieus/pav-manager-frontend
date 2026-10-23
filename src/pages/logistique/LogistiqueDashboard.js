import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { CONTACT_TYPES, cameraCouleur } from './shared';

export function LogistiqueDashboard({
  canManage,
  canonName,
  contacts,
  handleEditSeance,
  isSeanceVide,
  setSubTab,
  sortedSeances,
  stats,
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Matériel total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.disponible}</p>
            <p className="text-xs text-muted-foreground">Disponible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.enUtilisation}</p>
            <p className="text-xs text-muted-foreground">En utilisation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.maintenance}</p>
            <p className="text-xs text-muted-foreground">Maintenance</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setSubTab('incidents')}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-rose-600">{stats.incidentsOuverts}</p>
            <p className="text-xs text-muted-foreground">Incidents ouverts</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(() => {
          // Fiches du jour : celles du jour de culte d'aujourd'hui, sinon du
          // prochain (à défaut, du dernier). Couleur = celle de la caméra.
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const dated = sortedSeances.filter((s) => s.date);
          const targetDate =
            (dated.find((s) => s.date >= todayStr) || dated[dated.length - 1] || {}).date || null;
          const dayFiches = dated
            .filter((s) => s.date === targetDate)
            .sort((a, b) => (parseInt((a.poste.match(/\d+/) || [99])[0], 10)) - (parseInt((b.poste.match(/\d+/) || [99])[0], 10)));
          const label =
            targetDate === todayStr ? "Fiches d'aujourd'hui" : targetDate && targetDate > todayStr ? 'Fiches du prochain culte' : 'Fiches du dernier culte';
          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {label}
                  {targetDate && (
                    <span className="ml-2 text-sm font-normal capitalize text-muted-foreground">
                      {new Date(`${targetDate}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {dayFiches.length === 0 && <p className="text-sm text-muted-foreground">Aucun culte enregistré</p>}
                {dayFiches.map((s) => {
                  const cam = cameraCouleur(s.poste);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSubTab('entrees-sorties');
                        if (canManage()) handleEditSeance(s);
                      }}
                      className={`flex w-full items-center gap-3 rounded-md border-l-8 px-3 py-2 text-left text-sm transition-colors hover:brightness-95 ${cam?.border || 'border-l-transparent'} ${cam?.soft || 'bg-muted/30'}`}
                    >
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-black ${cam?.solid || 'bg-muted'}`}>
                        {parseInt((s.poste.match(/\d+/) || ['•'])[0], 10) || '•'}
                      </span>
                      <span className="flex-1 font-medium">{s.poste}</span>
                      <span className="truncate text-muted-foreground">{s.superviseur ? canonName(s.superviseur) : '—'}</span>
                      {isSeanceVide(s) && (
                        <Badge variant="outline" className="font-normal text-muted-foreground">Vide</Badge>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}
        <Card>
          <CardHeader><CardTitle className="text-base">Contacts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CONTACT_TYPES.map((t) => (
              <div key={t} className="flex justify-between text-sm border-b pb-1">
                <span>{t}</span>
                <span className="font-semibold">{contacts.filter(c => c.type_contact === t).length}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
