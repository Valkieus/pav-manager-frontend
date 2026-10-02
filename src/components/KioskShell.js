import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { UserRound, Repeat2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
const Logistique = lazy(() => import("../pages/Logistique"));

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "pav_kiosk_regisseur";

const norm = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch (e) {
    return "";
  }
};

// Écran de la tablette (compte « Régisseurs iPad ») : uniquement la vue
// Entrées/Sorties, sans menu, sans déconnexion. Une popup demande quel
// régisseur utilise la tablette ; son nom est envoyé avec chaque requête
// (en-tête X-Acting-Regisseur) pour être tracé dans les logs et sur les
// fiches. Le choix est mémorisé sur la tablette et modifiable à tout moment.
export default function KioskShell() {
  const [acting, setActing] = useState(readStored);
  const [pickerOpen, setPickerOpen] = useState(!readStored());
  const [roster, setRoster] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(true);

  // En-tête envoyé avec toutes les requêtes tant qu'un régisseur est choisi.
  useEffect(() => {
    if (acting) {
      axios.defaults.headers.common["X-Acting-Regisseur"] =
        encodeURIComponent(acting);
    } else {
      delete axios.defaults.headers.common["X-Acting-Regisseur"];
    }
  }, [acting]);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const res = await axios.get(`${API}/techniciens/roster`);
      setRoster(res.data || []);
    } catch (e) {
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Régisseurs : poste principal / libellé d'organigramme « régisseur »
  // (repli sur la branche Régisseurs si aucun poste ne correspond).
  const regisseurs = useMemo(() => {
    const byPoste = roster.filter((t) =>
      norm([t.poste_principal, t.organigramme_label].filter(Boolean).join(" ")).includes(
        "regisseur",
      ),
    );
    const list =
      byPoste.length > 0
        ? byPoste
        : roster.filter((t) => (t.branches || []).includes("Régisseurs"));
    return Array.from(
      new Map(list.map((t) => [(t.nom || "").trim(), t])).values(),
    )
      .filter((t) => (t.nom || "").trim())
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [roster]);

  const choose = (nom) => {
    try {
      localStorage.setItem(STORAGE_KEY, nom);
    } catch (e) {
      // stockage indisponible : le choix reste valable jusqu'au rechargement
    }
    setActing(nom);
    setPickerOpen(false);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="kiosk-shell">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 shadow-sm">
        <img src="/logo.png" alt="PAV" className="h-10 w-10 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">
            Entrées / Sorties
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Tablette des régisseurs
          </p>
        </div>
        <Button
          variant="outline"
          className="h-12 gap-2 text-base"
          onClick={() => setPickerOpen(true)}
          data-testid="kiosk-change-regisseur"
        >
          <UserRound className="h-5 w-5" />
          <span className="max-w-[40vw] truncate font-semibold">
            {acting || "Choisir le régisseur"}
          </span>
          <Repeat2 className="h-4 w-4 opacity-60" />
        </Button>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Suspense
          fallback={
            <p className="py-10 text-center text-muted-foreground">Chargement…</p>
          }
        >
          <Logistique kioskMode />
        </Suspense>
      </main>

      {/* Popup : quel régisseur utilise la tablette ? Impossible de la fermer
          tant qu'aucun nom n'est choisi. */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          if (!open && !acting) return;
          setPickerOpen(open);
        }}
      >
        <DialogContent
          className="max-w-2xl"
          onInteractOutside={(e) => {
            if (!acting) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!acting) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Qui utilise la tablette ?
            </DialogTitle>
            <DialogDescription>
              Touchez votre nom : il sera enregistré avec vos modifications
              des fiches Entrées / Sorties.
            </DialogDescription>
          </DialogHeader>
          {loadingRoster ? (
            <p className="py-6 text-center text-muted-foreground">
              Chargement des régisseurs…
            </p>
          ) : regisseurs.length === 0 ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-muted-foreground">
                Aucun régisseur trouvé dans l'effectif.
              </p>
              <Button variant="outline" onClick={loadRoster}>
                Réessayer
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {regisseurs.map((t) => (
                <Button
                  key={t.nom}
                  variant={acting === t.nom ? "default" : "outline"}
                  className="h-16 text-lg font-semibold"
                  onClick={() => choose(t.nom)}
                >
                  {t.nom}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
