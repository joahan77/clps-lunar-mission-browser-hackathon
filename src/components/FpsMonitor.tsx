import { useFps } from '../hooks/useFps';
import { useAppStore } from '../store/useAppStore';
import { Activity, Gauge } from 'lucide-react';

interface FpsMonitorProps {
  className?: string;
  inline?: boolean;
}

export default function FpsMonitor({ className, inline = false }: FpsMonitorProps) {
  const fps = useFps();
  const { lowQuality, setLowQuality, showFps, setShowFps } = useAppStore();

  const fpsColor =
    fps >= 55 ? 'text-data-nominal-text' : fps >= 30 ? 'text-data-degraded-text' : 'text-data-blackout-text';

  if (inline) {
    return (
      <div className={`relative flex items-center gap-1.5 select-none ${className || ''}`}>
        <button
          onClick={() => setShowFps(!showFps)}
          title="Toggle Performance HUD"
          className="px-2 py-0.5 bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded text-[10px] font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
        >
          <Activity className={`w-3 h-3 ${fpsColor}`} />
          <span className={`font-bold tabular-nums ${fpsColor}`}>{fps} FPS</span>
        </button>

        {showFps && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/95 backdrop-blur-md border border-white/20 rounded-md px-2.5 py-1 text-[10px] font-mono text-zinc-200 shadow-2xl whitespace-nowrap">
            <span className="text-zinc-400 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-amber-400" />
              DPR: {lowQuality ? '1.0' : '1.5 max'}
            </span>
            <span className="text-white/20">|</span>
            <button
              onClick={() => setLowQuality(!lowQuality)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                lowQuality
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'border-white/20 text-zinc-400 hover:text-white'
              }`}
            >
              {lowQuality ? 'LOW-Q (ACTIVE)' : 'HIGH-Q'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed bottom-12 sm:bottom-14 left-4 z-50 flex items-center gap-2 select-none ${className || ''}`}>
      {/* Toggle button */}
      <button
        onClick={() => setShowFps(!showFps)}
        title="Toggle Performance HUD"
        className="px-2 py-1 bg-black/60 backdrop-blur-[4px] border border-t2-ash-border rounded-t2-md text-t2-caption font-t2-nbarchitekt text-t2-pale-mist hover:text-t2-ghost-white transition-colors flex items-center gap-1.5"
      >
        <Activity className={`w-3 h-3 ${fpsColor}`} />
        <span className={`font-bold tabular-nums ${fpsColor}`}>{fps} FPS</span>
      </button>

      {showFps && (
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-[6px] border border-t2-ash-border rounded-t2-md px-2.5 py-1 text-t2-caption font-t2-nbarchitekt text-t2-pale-mist">
          <span className="text-t2-smoke flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            DPR: {lowQuality ? '1.0' : '1.5 max'}
          </span>
          <span className="text-t2-ash-border">|</span>
          <button
            onClick={() => setLowQuality(!lowQuality)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
              lowQuality
                ? 'bg-data-nominal/20 border-data-nominal text-data-nominal-text'
                : 'border-t2-ash-border text-t2-smoke hover:text-t2-ghost-white'
            }`}
          >
            {lowQuality ? 'LOW-Q (ACTIVE)' : 'HIGH-Q'}
          </button>
        </div>
      )}
    </div>
  );
}
