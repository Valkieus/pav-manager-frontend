import { Card, CardContent } from '../../components/ui/card';
import { Users, CheckCircle2, IdCard, Package, AlertCircle, Calendar, Building2, AlertTriangle } from 'lucide-react';

export function DashboardStatsSection({
  hasRegisseursAccess,
  isCoordinationPlus,
  isResponsableRole,
  myTeamCount,
  navigate,
  stats,
  user,
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3"><span className="w-1 h-4 rounded-full gradient-primary" />
        Vue d'ensemble
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isCoordinationPlus && (
          <Card
            className="card-hover animate-fadeIn cursor-pointer rounded-2xl border-primary/10 shadow-sm"
            data-testid="stat-effectif"
            onClick={() => navigate("/effectif")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Effectif Total
                  </p>
                  <p className="text-4xl font-bold tracking-tight mt-1">
                    {stats?.total_techniciens || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Techniciens actifs
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* "Mon équipe" — remplace Effectif Total pour un Responsable
non-Coordination : le chiffre global n'a pas de sens pour lui, mais
la taille de sa propre équipe si (demande 28/09/2026). */}
        {!isCoordinationPlus &&
          isResponsableRole &&
          (user?.branches || []).length > 0 && (
            <Card
              className="card-hover animate-fadeIn cursor-pointer rounded-2xl border-primary/10 shadow-sm"
              data-testid="stat-mon-equipe"
              onClick={() => navigate("/effectif")}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Mon équipe
                    </p>
                    <p className="text-4xl font-bold tracking-tight mt-1">
                      {myTeamCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {user.branches.join(", ")}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        {isCoordinationPlus && (
          <Card
            className="card-hover animate-fadeIn stagger-1 cursor-pointer"
            data-testid="stat-badges"
            onClick={() => navigate("/effectif")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Badges</p>
                  <p className="text-4xl font-bold tracking-tight mt-1">
                    {stats?.badges_attribues || 0}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Attribués
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {stats?.badges_non_attribues || 0} en attente
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md flex items-center justify-center">
                  <IdCard className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          className="card-hover animate-fadeIn stagger-2 cursor-pointer"
          data-testid="stat-materiel"
          onClick={() => navigate("/logistique")}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Matériel</p>
                <p className="text-4xl font-bold tracking-tight mt-1">
                  {stats?.total_materiel || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="text-emerald-500 font-medium">
                    {stats?.materiel_disponible || 0}
                  </span>{" "}
                  disponible
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isCoordinationPlus && (
          <Card
            className="card-hover animate-fadeIn stagger-3 cursor-pointer"
            data-testid="stat-pending"
            onClick={() => navigate("/formations")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    En attente
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.devis_en_attente || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Devis
                      </p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.formations_en_attente || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Formations
                      </p>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Devis en attente, seul (sans les Formations qui restent
Coordination-only) — visible aussi à un Responsable qui gère les
Régisseurs, puisque les devis matériel le concernent directement
(demande 28/09/2026). */}
        {!isCoordinationPlus && isResponsableRole && hasRegisseursAccess && (
          <Card
            className="card-hover animate-fadeIn stagger-3 cursor-pointer"
            data-testid="stat-devis-regisseurs"
            onClick={() => navigate("/devis")}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Devis en attente
                  </p>
                  <p className="text-4xl font-bold tracking-tight mt-1">
                    {stats?.devis_en_attente || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Régisseurs
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-md flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          className="card-hover animate-fadeIn stagger-4 cursor-pointer"
          data-testid="stat-salles"
          onClick={() => navigate("/salles")}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Salles</p>
                <p className="text-4xl font-bold tracking-tight mt-1">
                  {stats?.total_salles || 0}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-amber-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />{" "}
                    {stats?.reservations_en_attente || 0} en attente
                  </span>
                  <span className="text-xs text-emerald-500">
                    {stats?.reservations_validees || 0} validées
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="card-hover animate-fadeIn stagger-4 cursor-pointer"
          data-testid="stat-incidents"
          onClick={() => navigate("/logistique")}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Incidents</p>
                <p className="text-4xl font-bold tracking-tight mt-1">
                  {stats?.incidents_ouverts || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  ouverts sur{" "}
                  <span className="font-medium">
                    {stats?.incidents_total || 0}
                  </span>{" "}
                  au total
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-md flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
