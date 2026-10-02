import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Eraser } from "lucide-react";

const WIDTH = 720;
const HEIGHT = 260;

// Zone de signature au doigt (téléphone / tablette) ou à la souris.
// `value` = image PNG en data URL (ou vide) ; `onChange(dataUrl | "")` est
// appelé à la fin de chaque trait. L'image est volontairement petite
// (720x260) pour rester légère à enregistrer.
export default function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const emittedRef = useRef(value || "");
  const [hasInk, setHasInk] = useState(!!value);

  // Dessine l'image existante (modification d'une fiche déjà signée).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Valeur qu'on vient nous-mêmes d'émettre : le canvas est déjà à jour.
    if ((value || "") === emittedRef.current && canvas.dataset.ready) return;
    canvas.dataset.ready = "1";
    emittedRef.current = value || "";
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (value && value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
      img.src = value;
      setHasInk(true);
    } else {
      setHasInk(false);
    }
  }, [value]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.arc(lastRef.current.x, lastRef.current.y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  };

  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setHasInk(true);
    const url = canvasRef.current.toDataURL("image/png");
    emittedRef.current = url;
    onChange(url);
  };

  const clear = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    setHasInk(false);
    emittedRef.current = "";
    onChange("");
  };

  return (
    <div className="space-y-1.5">
      <div className="relative block w-full rounded-md border-2 border-dashed border-muted-foreground/30 bg-white">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="block w-full touch-none cursor-crosshair"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          data-testid="signature-canvas"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base text-muted-foreground/50">
            Signez ici avec le doigt
          </span>
        )}
      </div>
      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={clear}
          disabled={!hasInk}
        >
          <Eraser className="w-3.5 h-3.5 mr-1" />
          Effacer
        </Button>
      </div>
    </div>
  );
}
