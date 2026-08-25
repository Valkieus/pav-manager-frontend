import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { 
  ScrollText, 
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Info,
  Terminal,
  RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API}/logs`);
      setLogs(res.data);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await axios.post(`${API}/audit`);
      setAudit(res.data);
      toast.success('Audit terminé');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'audit');
    } finally {
      setAuditing(false);
    }
  };

  const getActionIcon = (action) => {
    if (action.includes('Connexion')) return '🔐';
    if (action.includes('Création')) return '➕';
    if (action.includes('Modification')) return '✏️';
    if (action.includes('Suppression')) return '🗑️';
    if (action.includes('Validation')) return '✅';
    if (action.includes('Refus')) return '❌';
    return '📋';
  };

  const getAuditStatusIcon = (status) => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'INFO':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'ALERTE':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="logs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Logs & Audit</h1>
          <p className="text-muted-foreground">Historique des actions et diagnostic système</p>
        </div>

        <Button 
          onClick={runAudit} 
          disabled={auditing}
          className="shadow-lg shadow-primary/20"
          data-testid="run-audit-btn"
        >
          {auditing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4 mr-2" />
          )}
          Audit Système
        </Button>
      </div>

      {/* Audit Results */}
      {audit && (
        <Card className="animate-fadeIn">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              Résultat de l'Audit
              <Badge className={audit.status === 'OK' ? 'status-validated' : 'status-pending'}>
                {audit.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="audit-terminal max-h-[300px]">
              <div className="text-xs text-slate-500 mb-3">
                [{new Date(audit.timestamp).toLocaleString('fr-FR')}] Audit initié...
              </div>
              {audit.checks.map((check, index) => (
                <div key={index} className="audit-line flex items-center gap-2">
                  {getAuditStatusIcon(check.status)}
                  <span className={`
                    ${check.status === 'OK' ? 'audit-ok' : ''}
                    ${check.status === 'INFO' ? 'audit-info' : ''}
                    ${check.status === 'ALERTE' ? 'audit-alert' : ''}
                  `}>
                    [{check.status}] {check.name}: {check.message}
                  </span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-slate-700 text-emerald-400">
                &gt; {audit.summary}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-primary" />
              Historique des Actions
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchLogs}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <ScrollText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Aucun log enregistré</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead>Date & Heure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="table-row-hover">
                    <TableCell className="text-xl">{getActionIcon(log.action)}</TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell className="text-muted-foreground">{log.user_name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {log.details}
                    </TableCell>
                    <TableCell className="text-muted-foreground mono text-xs">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
