import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { ShoppingBasket, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { API } from './constants';

// Qui peut valider les paniers de vidéos PAV LED (responsable de la branche Animation). Coordination et Admin peuvent toujours.
export function BasketValidatorsCard({ users = [], canEdit }) {
  const [validators, setValidators] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get(`${API}/led/basket-validators`).then((r) => setValidators(r.data.users || [])).catch(() => setValidators([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (ids, msg) => {
    setBusy(true);
    try {
      const res = await axios.put(`${API}/led/basket-validators`, { user_ids: ids });
      setValidators(res.data.users || []);
      setQuery('');
      toast.success(msg);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action impossible');
    } finally { setBusy(false); }
  };

  const ids = validators.map((v) => v.id);
  const q = query.trim().toLowerCase();
  const matches = q ? users.filter((u) => u.is_active !== false && !u.kiosk_mode && !ids.includes(u.id) && (u.full_name || '').toLowerCase().includes(q)).slice(0, 8) : [];

  return (
    <Card data-testid="basket-validators-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingBasket className="w-5 h-5" />Validation des paniers PAV LED</CardTitle>
        <CardDescription>
          Les personnes ci-dessous valident ou refusent les paniers de vidéos (responsable de la branche Animation). Les paniers validés passent
          ensuite aux animateurs pour la vérification des boucles. La Coordination et les Admin peuvent toujours valider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label>Validateurs désignés ({validators.length})</Label>
        {validators.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3 border rounded-lg border-dashed">Personne de désigné : seuls la Coordination et les Admin valident (et les Responsables dont la fiche relève de l'animation).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {validators.map((v) => (
              <span key={v.id} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm">
                {v.full_name}
                {canEdit && <button type="button" disabled={busy} title="Retirer" onClick={() => save(ids.filter((i) => i !== v.id), 'Validateur retiré')} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
              </span>
            ))}
          </div>
        )}
        {canEdit && (
          <>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ajouter une personne (ex. Laura)…" data-testid="basket-validator-search" />
            {matches.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {matches.map((u) => <Button key={u.id} size="sm" variant="outline" disabled={busy} onClick={() => save([...ids, u.id], `${u.full_name} peut valider les paniers`)}>{u.full_name}</Button>)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
