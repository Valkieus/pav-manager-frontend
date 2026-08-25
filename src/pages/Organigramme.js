import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Loader2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TreeNode = ({ name, children, level }) => {
  const hasChildren = children && children.length > 0;
  const isRoot = level === 0;
  
  return (
    <div className="flex flex-col items-center">
      <div 
        className={`
          px-4 py-2 rounded-lg border text-center min-w-[100px] shadow-sm
          animate-fadeIn
          ${isRoot 
            ? 'bg-primary text-primary-foreground border-primary' 
            : 'bg-card border-border hover:shadow-md hover:border-primary/50 transition-shadow'
          }
        `}
        style={{ animationDelay: `${level * 0.1}s` }}
      >
        <span className="text-sm font-medium whitespace-nowrap">{name}</span>
      </div>
      
      {hasChildren && (
        <div className="flex flex-col items-center">
          <div className="w-px h-4 bg-border" />
          <div className="flex relative">
            {children.length > 1 && (
              <div 
                className="absolute top-0 h-px bg-border"
                style={{
                  left: '25%',
                  right: '25%',
                }}
              />
            )}
          </div>
          <div className="flex gap-3">
            {children.map((child, idx) => (
              <div key={`${child.name}-${idx}`} className="flex flex-col items-center">
                {children.length > 1 && (
                  <div className="w-px h-4 bg-border" />
                )}
                <TreeNode 
                  name={child.name} 
                  children={child.children || []} 
                  level={level + 1} 
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Organigramme() {
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganigramme = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/organigramme`);
      setOrgData(res.data.structure);
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganigramme();
  }, [fetchOrganigramme]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="organigramme-page">
      <div>
        <h1 className="text-2xl font-bold">Organigramme</h1>
        <p className="text-muted-foreground">Structure hiérarchique de l'organisation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" />
            Structure Organisationnelle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto py-8">
            <div className="min-w-[800px] flex justify-center">
              {orgData ? (
                <TreeNode 
                  name={orgData.name} 
                  children={orgData.children || []} 
                  level={0} 
                />
              ) : (
                <p className="text-muted-foreground">Aucune structure définie</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary" />
              <span className="text-muted-foreground">Direction</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-card border border-border" />
              <span className="text-muted-foreground">Département / Service</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
