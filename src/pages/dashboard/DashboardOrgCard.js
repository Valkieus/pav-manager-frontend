import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Globe, ExternalLink, Youtube, Palette, Loader2, Award, Music, BookOpen, ChevronRight } from 'lucide-react';

export function DashboardOrgCard({
  academySsoLoading,
  handleAcademySSO,
  hasAcademyAccess,
  isMembre,
  setCharismaOpen,
}) {
  return (
    <Card className="animate-fadeIn stagger-4 overflow-hidden rounded-2xl border-primary/10 shadow-sm">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Portail Charisma
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Bandeau desktop : défilement horizontal (inchangé). Sur
mobile (demande 28/09/2026), le défilement latéral n'était pas
user-friendly : remplacé par un simple bouton "Portail Charisma"
qui ouvre une liste verticale de liens dans une fenêtre qui reste
sur PAV Manager (pas de navigation). */}
          <div className="hidden sm:flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            <a
              href="https://www.charisma.fr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-md transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="whitespace-nowrap">
                <p className="font-medium text-sm group-hover:text-primary transition-colors">
                  Site Web Charisma
                </p>
                <p className="text-xs text-muted-foreground">
                  www.charisma.fr
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
            </a>

            <a
              href="https://www.youtube.com/@CHARISMATV1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-red-500/50 hover:shadow-md transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <Youtube className="w-4 h-4 text-red-500" />
              </div>
              <div className="whitespace-nowrap">
                <p className="font-medium text-sm group-hover:text-red-500 transition-colors">
                  Charisma TV
                </p>
                <p className="text-xs text-muted-foreground">@CHARISMATV1</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
            </a>

            {!isMembre && (
              <a
                href="https://acadarts.charisma.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-purple-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4 text-purple-500" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-purple-500 transition-colors">
                    Académie des Arts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    acadarts.charisma.fr
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>
            )}

            {/* PAV Academy — entrée SSO (tâche #325) vers le site
d'entraînement/examen séparé, réservée aux comptes ayant
l'accès academy.examiner ou academy.student. */}
            {hasAcademyAccess && (
              <button
                type="button"
                onClick={handleAcademySSO}
                disabled={academySsoLoading}
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-emerald-500/50 hover:shadow-md transition-all group disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  {academySsoLoading ? (
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  ) : (
                    <Award className="w-4 h-4 text-emerald-600" />
                  )}
                </div>
                <div className="whitespace-nowrap text-left">
                  <p className="font-medium text-sm group-hover:text-emerald-600 transition-colors">
                    PAV Academy
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formation &amp; examens
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </button>
            )}

            {/* Cahier de Louange (CEC songs) — #417 : masqué pour
Technicien, reste visible à partir de Responsable. */}
            {!isMembre && (
              <a
                href="https://cec-songs.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-amber-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-amber-600" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-amber-600 transition-colors">
                    Cahier de Louange
                  </p>
                  <p className="text-xs text-muted-foreground">
                    cec-songs.netlify.app
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>
            )}

            {/* SongSpot — même règle de visibilité que le Cahier de Louange
(masqué pour Technicien, visible à partir de Responsable). */}
            {!isMembre && (
              <a
                href="https://songspot-cec.netlify.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-violet-500/50 hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-violet-600" />
                </div>
                <div className="whitespace-nowrap">
                  <p className="font-medium text-sm group-hover:text-violet-600 transition-colors">
                    SongSpot
                  </p>
                  <p className="text-xs text-muted-foreground">
                    songspot-cec.netlify.app
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
              </a>
            )}

            {/* Recherche Biblique — visible à tous, comme le Cahier de
Louange ci-dessus. */}
            <a
              href="https://quick-bible-search.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border hover:border-sky-500/50 hover:shadow-md transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-sky-600" />
              </div>
              <div className="whitespace-nowrap">
                <p className="font-medium text-sm group-hover:text-sky-600 transition-colors">
                  Recherche Biblique
                </p>
                <p className="text-xs text-muted-foreground">
                  quick-bible-search.netlify.app
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
            </a>
          </div>

          {/* Mobile : un seul bouton, ouvre le Dialog ci-dessous avec
tous les liens en liste verticale — fini le défilement latéral. Reste
DANS la même Card bleue que le bandeau desktop (demande 28/09/2026 :
ne plus dupliquer le bloc "Portail Charisma" en dehors). */}
          <button
            type="button"
            onClick={() => setCharismaOpen(true)}
            className="flex sm:hidden items-center justify-between w-full px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Portail Charisma</span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </CardContent>
      </div>
    </Card>
  );
}
