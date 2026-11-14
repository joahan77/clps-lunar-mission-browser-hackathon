import { useState, useEffect, useCallback } from 'react';
import { Loader2, Rocket, AlertTriangle, RefreshCw, GraduationCap } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { useMission } from '../context/MissionContext';
import { useAppStore } from '../store/useAppStore';
import type { DataPoint } from '../data';
import { getCachedJson } from '../utils/assetPreloader';
import DescentOverlay from '../components/DescentOverlay';

export default function MissionControl() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const { SITES, selectedSite, setSelectedSite } = useMission();
  const { setPhase, setOverlayOpacity, reducedMotion, setViewReady, isEducatorMode, toggleEducatorMode } = useAppStore();

  const [telemetryData, setTelemetryData] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSiteFetching, setIsSiteFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Signal view readiness for tour when telemetry is loaded
  useEffect(() => {
    if (!isLoading && telemetryData.length > 0) {
      setViewReady(true);
    } else {
      setViewReady(false);
    }
    return () => setViewReady(false);
  }, [isLoading, telemetryData.length, setViewReady]);

  // Crossfade in on mount
  useEffect(() => {
    setOverlayOpacity(0);
  }, [setOverlayOpacity]);

  // 1. Fetch Telemetry Data
  const fetchTelemetry = useCallback((site: any, isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsSiteFetching(true);
    }
    setError(null);

    const jsonPath = `/${site.id}_data.json`;
    const cached = getCachedJson(jsonPath);
    if (cached) {
      const points: DataPoint[] = Array.isArray(cached) ? cached : (cached?.data || []);
      setTelemetryData(points);
      setIsLoading(false);
      setIsSiteFetching(false);
      return;
    }

    fetch(jsonPath)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to fetch dataset from ${jsonPath}`);
        }
        return res.json();
      })
      .then((raw) => {
        const points: DataPoint[] = Array.isArray(raw) ? raw : (raw?.data || []);
        if (!points || points.length === 0) {
          throw new Error(`Received empty dataset for ${site.name}`);
        }
        setTelemetryData(points);
        setIsLoading(false);
        setIsSiteFetching(false);
      })
      .catch((err) => {
        console.error('Telemetry fetch error:', err);
        setError(err.message || 'Unknown error occurred.');
        setIsLoading(false);
        setIsSiteFetching(false);
      });
  }, []);

  // 2. Sync URL to Context and trigger immediate telemetry fetch on siteId change
  useEffect(() => {
    const targetSite = SITES.find((s: any) => s.id === siteId) || selectedSite || SITES[0];
    if (targetSite && targetSite.id !== selectedSite.id) {
      setSelectedSite(targetSite);
    }
    if (targetSite) {
      const isInitial = telemetryData.length === 0;
      fetchTelemetry(targetSite, isInitial);
    }
  }, [siteId, SITES, setSelectedSite, fetchTelemetry]);

  // 3. Handle Dropdown Change inside the Dashboard
  const handleSelectSite = (site: any) => {
    if (site.id === selectedSite.id && !error) return;
    setSelectedSite(site);
    navigate(`/mission/${site.id}`);
  };

  // 4. Reverse Descent (Return to Orbit)
  const handleReturnToOrbit = () => {
    if (reducedMotion) {
      navigate('/');
      return;
    }
    setPhase('returning');
    setOverlayOpacity(1);
    setTimeout(() => {
      navigate('/');
    }, 350);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-t2-void-black text-t2-ghost-white font-t2-nbarchitekt select-none">
        <div className="relative flex items-center justify-center mb-t2-18">
          <div className="w-16 h-16 rounded-t2-full border border-t2-ash-border animate-spin" />
          <div className="absolute p-3 rounded-t2-full bg-t2-dusk-violet text-t2-ghost-white">
            <Rocket className="w-6 h-6 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <div className="font-t1-unbounded text-t1-caption font-semibold tracking-[2.63px] uppercase text-t1-pure-white flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-t2-pale-mist" />
            <span>INITIALIZING CLPS TELEMETRY FEED</span>
          </div>
          <p className="font-t2-nbarchitekt text-t2-caption text-t2-pale-mist">
            Streaming 30-Day NASA JPL DE421 Ephemeris ({selectedSite.id}_data.json)...
          </p>
        </div>
      </div>
    );
  }

  if (error && telemetryData.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-t2-void-black text-t2-ghost-white font-t2-nbarchitekt p-6">
        <div className="max-w-md w-full p-t2-28 rounded-t2-xl bg-black/50 backdrop-blur-[4px] border border-data-blackout text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-t2-full bg-data-blackout/20 border border-data-blackout flex items-center justify-center text-data-blackout-text">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-t1-unbounded text-t1-body font-bold text-t1-pure-white tracking-[2.38px]">
              Telemetry Feed Offline
            </h2>
            <p className="font-t2-nbarchitekt text-t2-body-sm text-data-blackout-text mt-1">{error}</p>
          </div>
          <button
            onClick={() => fetchTelemetry(selectedSite, true)}
            className="w-full py-t2-6 px-t2-18 rounded-t2-full bg-t2-dusk-violet text-t2-ghost-white font-t2-nbarchitekt text-t2-body font-bold flex items-center justify-center gap-2 hover:opacity-90 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Telemetry Ingestion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden bg-transparent text-t2-ghost-white">
      {/* ── Return/Descent Crossfade Overlay ── */}
      <DescentOverlay />

      {/* ── TOP FLOATING NAVIGATION CHROME ── */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3 sm:gap-4 pointer-events-auto">
        <button
          onClick={handleReturnToOrbit}
          className="border border-white/20 bg-black/40 hover:bg-white/10 hover:border-white/40 text-zinc-200 hover:text-white px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-all flex items-center gap-2 backdrop-blur-md shadow-lg"
        >
          <span>← Return to Orbit</span>
        </button>
        <button
          onClick={() => navigate('/compare')}
          className="border border-white/20 bg-black/40 hover:bg-white/10 hover:border-white/40 text-zinc-200 hover:text-white px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-all flex items-center gap-2 backdrop-blur-md shadow-lg"
        >
          <span>Compare Sites</span>
        </button>
        <button
          onClick={toggleEducatorMode}
          className={`border px-3 py-1.5 rounded-md font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-all flex items-center gap-2 backdrop-blur-md shadow-lg ${
            isEducatorMode
              ? 'bg-amber-400 text-black border-amber-300 font-bold shadow-[0_0_12px_rgba(251,191,36,0.5)]'
              : 'border-white/20 bg-black/40 hover:bg-white/10 hover:border-white/40 text-zinc-200 hover:text-white'
          }`}
          title="Toggle Educator Mode for simplified explanations"
        >
          <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
          <span>Educator Mode</span>
        </button>
      </div>

      <Dashboard
        telemetryData={telemetryData}
        selectedSite={selectedSite}
        onSelectSite={handleSelectSite}
        isSiteFetching={isSiteFetching}
      />
    </div>
  );
}
