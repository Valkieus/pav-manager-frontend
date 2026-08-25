import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { toast } from 'sonner';
import { 
  Loader2, 
  TrendingUp, 
  FileText, 
  Euro, 
  Users,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ['#001DF3', '#10B981', '#EF4444', '#F59E0B'];

export default function KPI() {
  const { isSupervision } = useAuth();
  const navigate = useNavigate();
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupervision()) {
      toast.error('Accès réservé à la Supervision');
      navigate('/');
      return;
    }
    fetchKPI();
  }, [isSupervision, navigate]);

  const fetchKPI = async () => {
    try {
      const res = await axios.get(`${API}/kpi`);
      setKpi(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement des KPI');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!kpi) return null;

  const pieData = [
    { name: 'En attente', value: kpi.devis_en_attente },
    { name: 'Validés', value: kpi.devis_valides },
    { name: 'Refusés', value: kpi.devis_refuses },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6" data-testid="kpi-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">KPI Financier</h1>
        <p className="text-muted-foreground">Vue d'ensemble des indicateurs de performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="kpi-gradient animate-fadeIn stagger-1" data-testid="kpi-total-devis">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devis</p>
                <p className="text-3xl font-bold mt-1">{kpi.total_devis}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn stagger-2" data-testid="kpi-total-montant">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Montant Total</p>
                <p className="text-3xl font-bold mt-1">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(kpi.total_montant)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Euro className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn stagger-3" data-testid="kpi-fournisseurs">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fournisseurs Actifs</p>
                <p className="text-3xl font-bold mt-1">{kpi.fournisseurs_actifs}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-violet-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn stagger-4" data-testid="kpi-formations">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Formations en cours</p>
                <p className="text-3xl font-bold mt-1">{kpi.formations_en_cours}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Monthly */}
        <Card className="animate-fadeIn stagger-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Évolution Mensuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpi.monthly_stats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)}
                  />
                  <Bar dataKey="montant" fill="#001DF3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Status Distribution */}
        <Card className="animate-fadeIn stagger-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Répartition des Devis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-fadeIn">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.devis_en_attente}</p>
                <p className="text-sm text-muted-foreground">Devis en attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.devis_valides}</p>
                <p className="text-sm text-muted-foreground">Devis validés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.devis_refuses}</p>
                <p className="text-sm text-muted-foreground">Devis refusés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
