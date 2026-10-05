import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const BACKEND = process.env.REACT_APP_BACKEND_URL;

export const fmtSize = (n) => {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} o`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(0)} Ko`;
  return `${(v / 1024 ** 2).toFixed(1)} Mo`;
};

export async function uploadComm(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await axios.post(`${API}/comm/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data;
}

// Affichage d'une pièce jointe (image, audio, vidéo, fichier).
export function Attachment({ a, onImage }) {
  const url = `${BACKEND}${a.url}`;
  if (a.kind === "image") {
    return <img src={url} alt={a.filename} loading="lazy" onClick={() => onImage && onImage(url)} className="max-h-64 max-w-full cursor-zoom-in rounded-lg object-cover" />;
  }
  if (a.kind === "audio") return <audio controls src={url} className="h-10 w-full max-w-[260px]" />;
  if (a.kind === "video") return <video controls src={url} className="max-h-64 max-w-full rounded-lg" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-muted">
      <FileText className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{a.filename}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{fmtSize(a.size)}</span>
    </a>
  );
}

// Sélecteur de fichiers pour les compositions : envoie tout de suite, renvoie la liste des pièces jointes.
export function AttachmentPicker({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const out = [];
      for (const f of files) out.push(await uploadComm(f));
      onChange([...value, ...out]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Envoi du fichier impossible");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        Joindre des fichiers
        <input type="file" multiple className="hidden" onChange={pick} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.mp4,.mov,.mp3,.m4a,.wav" />
      </label>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a, i) => (
            <li key={a.url} className="flex items-center gap-2 rounded border px-2 py-1 text-sm">
              <FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{a.filename}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(a.size)}</span>
              <button type="button" aria-label="Retirer" onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
