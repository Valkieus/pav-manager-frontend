import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Changer son mot de passe soi-même (Mon espace → Sécurité).
export default function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = again.length > 0 && next !== again;
  const canSubmit = current && next.length >= 8 && next === again && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/auth/change-password`, { current_password: current, new_password: next });
      if (res.data?.access_token) {
        // les anciens jetons sont révoqués : on garde la session en cours avec le jeton neuf
        try { localStorage.setItem("token", res.data.access_token); } catch { /* ignore */ }
        axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.access_token}`;
      }
      toast.success("Mot de passe modifié");
      setCurrent(""); setNext(""); setAgain("");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Modification impossible");
    } finally { setBusy(false); }
  };

  return (
    <Card data-testid="password-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-5 h-5" /> Mot de passe</CardTitle>
        <CardDescription>Changez votre mot de passe (8 caractères minimum).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Mot de passe actuel</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">Nouveau mot de passe</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            {tooShort && <p className="text-xs text-destructive">8 caractères minimum</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-again">Confirmer le nouveau mot de passe</Label>
            <Input id="pw-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
            {mismatch && <p className="text-xs text-destructive">Les deux mots de passe ne correspondent pas</p>}
          </div>
          <Button type="submit" disabled={!canSubmit}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Changer mon mot de passe
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
