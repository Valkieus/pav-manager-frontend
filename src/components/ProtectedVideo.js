import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';

// Lecteur vidéo avec NOS commandes (pas celles du navigateur) : le menu natif « ⋮ » propose « Télécharger »,
// « Vitesse », « Image dans l'image », « Caster »… ici il n'y a rien de tout ça. Clic droit et glisser bloqués.
const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

export default function ProtectedVideo({ src, onError, autoPlay = true, loop = true, className = '' }) {
  const ref = useRef(null);
  const box = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);

  useEffect(() => { if (ref.current) ref.current.muted = muted; }, [muted]);
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const full = () => { const el = box.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); };

  return (
    <div ref={box} className={`relative bg-black rounded overflow-hidden select-none ${className}`} onContextMenu={(e) => e.preventDefault()} data-testid="protected-video">
      <video ref={ref} src={src} autoPlay={autoPlay} muted loop={loop} playsInline preload="auto" disablePictureInPicture disableRemotePlayback
        draggable={false} controlsList="nodownload noremoteplayback noplaybackrate" onError={onError} onClick={toggle}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setD(e.currentTarget.duration)}
        className="w-full max-h-[70vh] object-contain bg-black" />
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-white">
        <button type="button" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'} className="p-1">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <input type="range" min={0} max={d || 0} step="0.1" value={t} aria-label="Position"
          onChange={(e) => { if (ref.current) ref.current.currentTime = Number(e.target.value); }} className="h-1 flex-1 accent-white" />
        <span className="text-[11px] tabular-nums">{fmt(t)} / {fmt(d)}</span>
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Activer le son' : 'Couper le son'} className="p-1">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        <button type="button" onClick={full} aria-label="Plein écran" className="p-1"><Maximize className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
