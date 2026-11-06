import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';

// Lecture de QR code par la caméra arrière (jsQR : fonctionne aussi sur iPhone, où BarcodeDetector n'existe pas).
// La caméra n'est allumée que pendant le scan et toujours coupée ensuite.
export default function CameraScanner({ onCode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const doneRef = useRef(false);
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setOn(false);
  };
  useEffect(() => () => stop(), []); // eslint-disable-line

  const tick = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || doneRef.current) return;
    if (v.readyState >= 2 && v.videoWidth) {
      const w = Math.min(640, v.videoWidth), h = Math.round(v.videoHeight * (w / v.videoWidth));
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, w, h);
      const res = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
      if (res && res.data) { doneRef.current = true; stop(); try { navigator.vibrate?.(60); } catch (e) { /* facultatif */ } onCode(res.data); return; }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    setError(''); setStarting(true); doneRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Caméra non disponible sur ce navigateur (ou page non sécurisée).');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      setOn(true);
      requestAnimationFrame(() => {
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream; v.setAttribute('playsinline', 'true');
        v.play().then(() => { rafRef.current = requestAnimationFrame(tick); }).catch(() => {});
      });
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? "Accès à la caméra refusé : autorisez-le dans les réglages du navigateur, ou saisissez le code à la main." : (e?.message || 'Caméra impossible à démarrer.'));
    } finally { setStarting(false); }
  };

  return (
    <div className="space-y-2">
      {on ? (
        <div className="relative overflow-hidden rounded-xl bg-black" data-testid="camera-view">
          <video ref={videoRef} muted playsInline className="h-72 w-full object-cover sm:h-96" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-44 w-44 rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] sm:h-56 sm:w-56" />
          </div>
          <p className="absolute inset-x-0 bottom-2 text-center text-xs font-medium text-white">Placez le QR code dans le cadre</p>
          <Button size="sm" variant="secondary" onClick={stop} className="absolute right-2 top-2"><CameraOff className="mr-1 h-4 w-4" />Arrêter</Button>
        </div>
      ) : (
        <Button onClick={start} disabled={starting} className="h-14 w-full text-base" data-testid="start-scan">
          {starting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Camera className="mr-2 h-5 w-5" />}Scanner un QR code
        </Button>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {error && <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900" role="alert">{error}</p>}
    </div>
  );
}
