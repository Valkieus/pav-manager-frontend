import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Globe, ExternalLink, Youtube, Palette, Loader2, Award, Music, BookOpen } from 'lucide-react';
import { openSongsSite } from '../../lib/songs';

export function CharismaDialog({
  academySsoLoading,
  charismaOpen,
  handleAcademySSO,
  hasAcademyAccess,
  isMembre,
  setCharismaOpen,
}) {
  return (
    <Dialog open={charismaOpen} onOpenChange={setCharismaOpen}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Portail Charisma
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
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
        <button
          type="button"
          onClick={openSongsSite}
          className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-left hover:border-amber-500/50 hover:shadow-md transition-all group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 text-amber-600" />
          </div>
          <div className="whitespace-nowrap">
            <p className="font-medium text-sm group-hover:text-amber-600 transition-colors">
              CEC Songs
            </p>
            <p className="text-xs text-muted-foreground">
              Connexion avec PAV Manager
            </p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-1 shrink-0" />
        </button>
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
      </DialogContent>
    </Dialog>
  );
}
