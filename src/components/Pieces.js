import { useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Paperclip, Upload, Trash2, Loader2, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

// Les pièces sont privées : on les télécharge avec la session (pas d'URL publique), puis on les ouvre.
async function openPiece(p) {
  const tab = window.open('', '_blank');
  try {
    const res = await axios.get(`${API}/pieces/${p.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = p.filename; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (tab) tab.close();
    toast.error('Impossible d\'ouvrir la pièce');
  }
}

// Bouton trombone + fenêtre : devis fournisseur / factures hébergés sur la demande ou le devis.
export default function PiecesButton({ kind, doc, canUpload = true, canDeleteAll = false, meId, onChanged }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const pieces = doc.pieces || [];

  const upload = async (files) => {
    setBusy(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        await axios.post(`${API}/pieces/${kind}/${doc.id}`, fd);
      }
      toast.success(files.length > 1 ? 'Pièces ajoutées' : 'Pièce ajoutée');
      await onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Envoi impossible');
    } finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const remove = async (p) => {
    if (!window.confirm(`Supprimer « ${p.filename} » ?`)) return;
    try { await axios.delete(`${API}/pieces/${kind}/${doc.id}/${p.id}`); await onChanged(); } catch (e) { toast.error(e.response?.data?.detail || 'Suppression impossible'); }
  };

  return (
    <>
      <Button size="sm" variant="ghost" title="Devis fournisseur / pièces jointes" onClick={() => setOpen(true)} data-testid="pieces-btn">
        <Paperclip className="w-4 h-4" />{pieces.length > 0 && <span className="ml-1 text-xs">{pieces.length}</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pièces jointes</DialogTitle>
            <DialogDescription>Devis fournisseur, factures… (PDF, image, Word, Excel — 15 Mo max). Accessibles uniquement aux responsables.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5">
            {pieces.length === 0 && <li className="text-sm text-muted-foreground">Aucune pièce pour l'instant.</li>}
            {pieces.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                <button type="button" className="min-w-0 flex-1 text-left truncate underline" onClick={() => openPiece(p)}>{p.filename}</button>
                <span className="text-xs text-muted-foreground shrink-0">{size(p.size)}</span>
                {(canDeleteAll || p.uploaded_by === meId) && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
                )}
              </li>
            ))}
          </ul>
          {canUpload && (
            <>
              <input ref={input} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx" onChange={(e) => e.target.files?.length && upload([...e.target.files])} />
              <Button onClick={() => input.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Ajouter un devis / une pièce
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
