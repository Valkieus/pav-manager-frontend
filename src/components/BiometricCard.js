import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, ScanFace, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { enrollPasskey, passkeySupported, passkeyEnrolledHere } from "../lib/passkey";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const deviceLabel = () => {
  const ua = navigator.userAgent || "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh/.test(ua)) return "Mac";
  return "Cet appareil";
};

// Connexion rapide : Face ID, Touch ID, empreinte ou Windows Hello à la place du mot de passe.
export default function BiometricCard() {
  const [supported, setSupported] = useState(null);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [serverOk, setServerOk] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/auth/passkeys`);
      setList(r.data.passkeys || []);
      setServerOk(r.data.available !== false);
    } catch (e) { setList([]); }
  }, []);
  useEffect(() => { passkeySupported().then(setSupported); load(); }, [load]);

  const enable = async () => {
    setBusy(true);
    try {
      await enrollPasskey(deviceLabel());
      toast.success("Face ID / empreinte activé sur cet appareil");
      load();
    } catch (err) {
      if (err?.name === "NotAllowedError") toast.info("Activation annulée");
      else toast.error(err.response?.data?.detail || "Activation impossible sur cet appareil");
    } finally { setBusy(false); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Retirer « ${p.label} » ? Vous devrez utiliser votre mot de passe sur cet appareil.`)) return;
    await axios.delete(`${API}/auth/passkeys/${p.id}`);
    if (!passkeyEnrolledHere()) load();
    try { localStorage.removeItem("pav_passkey_enrolled"); localStorage.removeItem("pav_passkey_cred_id"); } catch (e) { /* ignore */ }
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ScanFace className="h-5 w-5 text-primary" /> Connexion rapide</CardTitle>
        <CardDescription>
          Connectez-vous d'un regard ou d'un doigt (Face ID, Touch ID, empreinte, Windows Hello) sans retaper votre mot de passe.
          Votre biométrie ne quitte jamais l'appareil ; le mot de passe reste toujours possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {supported === null ? <Loader2 className="h-5 w-5 animate-spin" /> : !supported ? (
          <p className="text-sm text-muted-foreground">Cet appareil ou ce navigateur ne propose pas Face ID / empreinte. Essayez depuis Safari (iPhone, iPad) ou Chrome (Android, ordinateur).</p>
        ) : !serverOk ? (
          <p className="text-sm text-muted-foreground">Cette fonction n'est pas encore disponible sur le serveur.</p>
        ) : (
          <Button onClick={enable} disabled={busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanFace className="mr-2 h-4 w-4" />}
            Activer sur cet appareil
          </Button>
        )}
        {list.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {list.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span><span className="font-medium">{p.label}</span> <span className="text-muted-foreground">· activé le {new Date(p.created_at).toLocaleDateString("fr-FR")}{p.last_used_at ? ` · dernière connexion ${new Date(p.last_used_at).toLocaleDateString("fr-FR")}` : ""}</span></span>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p)} aria-label="Retirer"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
