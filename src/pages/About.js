import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Info, Code, Palette, Database, Globe } from 'lucide-react';

const technologies = [
  { name: 'React', icon: '⚛️', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { name: 'FastAPI', icon: '⚡', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { name: 'MongoDB', icon: '🍃', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { name: 'Tailwind CSS', icon: '🎨', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { name: 'Shadcn UI', icon: '🧩', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
];

export default function About() {
  return (
    <div className="space-y-6" data-testid="about-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">À Propos</h1>
        <p className="text-muted-foreground">Informations sur le système</p>
      </div>

      {/* Credits Card */}
      <Card className="animate-fadeIn">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Crédits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-primary-foreground font-bold text-2xl">G</span>
            </div>
            <div>
              <p className="text-xl font-bold">Développé par Guichard ELANE</p>
              <p className="text-muted-foreground">Système de Gestion Interne v1.0</p>
            </div>
          </div>
          
          <p className="text-muted-foreground">
            Cette application a été conçue pour centraliser et optimiser la gestion des devis, 
            fournisseurs, formations et communications au sein de l'organisation.
          </p>
        </CardContent>
      </Card>

      {/* Technologies */}
      <Card className="animate-fadeIn stagger-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Technologies Utilisées
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {technologies.map((tech) => (
              <Badge 
                key={tech.name} 
                className={`${tech.color} px-4 py-2 text-sm font-medium`}
              >
                <span className="mr-2">{tech.icon}</span>
                {tech.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="animate-fadeIn stagger-3">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Base de données</h3>
            <p className="text-sm text-muted-foreground">
              MongoDB pour un stockage flexible et performant des données
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn stagger-4">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="font-semibold mb-2">API REST</h3>
            <p className="text-sm text-muted-foreground">
              FastAPI pour des endpoints rapides et documentation automatique
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fadeIn stagger-5">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4">
              <Palette className="w-6 h-6 text-violet-500" />
            </div>
            <h3 className="font-semibold mb-2">Interface Moderne</h3>
            <p className="text-sm text-muted-foreground">
              React avec Tailwind CSS pour une expérience utilisateur fluide
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Version Info */}
      <Card className="animate-fadeIn">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Version</span>
            <Badge variant="outline">1.0.0</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
