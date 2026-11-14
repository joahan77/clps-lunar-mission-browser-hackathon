import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  Globe,
  Clock,
  MapPin,
  ArrowLeft,
  Compass,
  Radio,
  ChevronRight,
  Loader2,
  Zap,
  Battery,
  Signal,
  Info,
  BookOpen,
  Layers,
  Activity,
  ChevronLeft,
  Thermometer,
  Mountain,
  Droplet,
  Droplets,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import Scene from './Scene';
import { useMission } from './context/MissionContext';
import { useAppStore } from './store/useAppStore';
import type { DataPoint } from './data';
import { useCountUp } from './hooks/useCountUp';
import { useDecodeScramble } from './hooks/useDecodeScramble';
import { useMissionClock } from './hooks/useMissionClock';
import FpsMonitor from './components/FpsMonitor';
import FooterAttribution from './components/FooterAttribution';

interface DashboardProps {
  telemetryData: DataPoint[];
  selectedSite: any;
  onSelectSite: (site: any) => void;
  isSiteFetching: boolean;
}

export default function Dashboard({
  telemetryData,
  selectedSite,
  onSelectSite,
  isSiteFetching,
}: DashboardProps) {
  const navigate = useNavigate();
  const { SITES } = useMission();
  const {
    verticalExaggeration,
    setVerticalExaggeration,
    setActiveExplainerMetric,
    setDataMethodsModalOpen,
    demoSliderIndex,
    isEducatorMode,
    toggleEducatorMode,
    setEducatorMode,
  } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [mobileTab, setMobileTab] = useState<'3d' | 'telemetry' | 'chart'>('3d');

  // Sync slider with automated tour scrubbing
  useEffect(() => {
    if (demoSliderIndex !== null && demoSliderIndex !== undefined) {
      setCurrentIndex(demoSliderIndex);
    }
  }, [demoSliderIndex]);

  // Real-time ticking mission clock
  const missionClock = useMissionClock(1, 0, 0);

  // Reset slider when telemetry data changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [telemetryData]);

  // Active telemetry reading
  const currentPoint = useMemo<DataPoint>(() => {
    if (!telemetryData || telemetryData.length === 0) {
      return { time: '00:00', sunElevation: 0, earthElevation: 0 } as DataPoint;
    }
    const idx = Math.min(Math.max(currentIndex, 0), telemetryData.length - 1);
    return telemetryData[idx];
  }, [telemetryData, currentIndex]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentIndex(parseInt(e.target.value, 10));
  }, []);

  // Compute clean tick interval for the 30-day timeline
  const xAxisInterval = useMemo(() => {
    if (!telemetryData || telemetryData.length === 0) return 1;
    return Math.max(Math.floor(telemetryData.length / 10), 1);
  }, [telemetryData]);

  const totalPoints = telemetryData?.length || 0;
  const startTime = telemetryData[0]?.time ?? 'Start';
  const endTime = telemetryData[totalPoints - 1]?.time ?? 'End';

  // Living Numbers count-up hooks
  const animatedSunElevation = useCountUp(currentPoint.sunElevation, 2, 200);
  const animatedEarthElevation = useCountUp(currentPoint.earthElevation, 2, 200);
  const animatedSolar = useCountUp(currentPoint.solarIrradiance || 0, 1, 200);
  const animatedBattery = useCountUp(currentPoint.batteryLevel || 100, 1, 200);

  const scrambledSiteName = useDecodeScramble(selectedSite.name || '', 400);
  const latDir = selectedSite.lat >= 0 ? '°N' : '°S';
  const lonDir = selectedSite.lon >= 0 ? '°E' : '°W';
  const coordString = `${Math.abs(selectedSite.lat).toFixed(1)}${latDir}, ${Math.abs(selectedSite.lon).toFixed(1)}${lonDir}`;
  const scrambledCoords = useDecodeScramble(coordString, 500);

  const isLos = currentPoint.earthElevation >= 0;
  const isDaylight = currentPoint.sunElevation >= 0;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-transparent text-white overflow-hidden select-none">
      {/* ── Left Telemetry Rail (Sleek Obsidian Mission Cockpit) ── */}
      {/* ── Left Telemetry Rail (Mobile: Top 33vh / Desktop: Side-by-side w-80) ── */}
      <aside className="w-full md:w-80 h-[33vh] md:h-full flex-shrink-0 bg-[#090a10]/95 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-between z-20 overflow-hidden">
        {/* Top Header & Back to Orbit Navigation */}
        <div className="p-4 border-b border-white/10 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs pb-1 scrollbar-none">
            <button
              onClick={() => navigate('/')}
              className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded border border-white/10 hover:border-white/20 bg-black/40 shrink-0"
              title="Return to Cislunar Orbit"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Orbit</span>
            </button>
            <button
              onClick={() => navigate('/compare')}
              className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors py-1 px-2.5 rounded border border-white/10 hover:border-white/20 bg-black/40 shrink-0"
              title="Compare all landing sites"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Compare Sites</span>
            </button>
            <button
              onClick={toggleEducatorMode}
              className={`text-xs font-mono px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 border shrink-0 ${
                isEducatorMode
                  ? 'bg-amber-400 text-black border-amber-300 font-bold shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                  : 'bg-black/40 text-zinc-300 border-white/10 hover:border-white/20 hover:text-white'
              }`}
              title="Toggle Educator Mode for simplified explanations"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Educator Mode</span>
            </button>
          </div>

          <div>
            <div className="text-[11px] font-mono uppercase text-amber-400 font-semibold tracking-wider">
              {scrambledCoords}
            </div>
            <h1 className="font-['Space_Grotesk'] text-lg font-bold text-white tracking-wide truncate">
              {scrambledSiteName}
            </h1>
          </div>

          {/* Quick Target Site Switcher */}
          <div className="relative">
            <select
              value={selectedSite.id}
              onChange={(e) => {
                const target = SITES.find((s: any) => s.id === e.target.value);
                if (target) onSelectSite(target);
              }}
              disabled={isSiteFetching}
              className="w-full bg-black/60 border border-white/15 text-xs font-mono text-zinc-200 rounded-lg px-3 py-2 appearance-none focus:outline-none focus:border-white/40 cursor-pointer"
            >
              {SITES.map((site: any) => (
                <option key={site.id} value={site.id} className="bg-zinc-950 text-white">
                  {site.label} ({Math.abs(site.lat).toFixed(1)}°{site.lat >= 0 ? 'N' : 'S'})
                </option>
              ))}
            </select>
            <ChevronRight className="w-3.5 h-3.5 absolute right-3 top-3 text-zinc-400 pointer-events-none rotate-90" />
          </div>
        </div>

        {/* Scrollable Center: Mission Timeline Scrubber & Telemetry Metrics */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mission Timeline Scrubber */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Timeline
              </span>
              <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded tabular-nums">
                {currentPoint.time}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(totalPoints - 1, 0)}
              step={1}
              value={currentIndex}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-none"
            />

            <div className="flex justify-between text-[10px] font-mono text-zinc-500 tabular-nums">
              <span>{startTime}</span>
              <span className="text-zinc-400">Step {currentIndex + 1}/{totalPoints}</span>
              <span>{endTime}</span>
            </div>
          </div>

          {/* Section: Horizon Angles (Sun & Earth) */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 font-bold">
              Astronomical Horizon
            </div>

            {/* Sun Elevation / Sunlight */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isEducatorMode ? 'Sunlight' : 'Sun Elevation'}</span>
                  <button
                    onClick={() => setActiveExplainerMetric('sunElevation')}
                    className="text-zinc-500 hover:text-amber-300"
                    title="How is solar elevation computed?"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                {isEducatorMode ? (
                  <div className="font-['Space_Grotesk'] text-sm sm:text-base font-bold text-amber-300 mt-1">
                    {currentPoint.sunElevation > 10
                      ? 'Bright Daylight'
                      : currentPoint.sunElevation >= 0
                      ? 'Low Sunlight (Twilight)'
                      : 'Total Darkness'}
                  </div>
                ) : (
                  <div className="font-['Space_Grotesk'] text-base sm:text-xl font-bold text-white tabular-nums mt-0.5">
                    {parseFloat(animatedSunElevation) > 0 ? '+' : ''}{animatedSunElevation}°
                  </div>
                )}
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  isDaylight
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {isEducatorMode
                  ? currentPoint.sunElevation > 10
                    ? 'Daylight'
                    : currentPoint.sunElevation >= 0
                    ? 'Twilight'
                    : 'Darkness'
                  : isDaylight
                  ? 'Daylight'
                  : 'Eclipse'}
              </span>
            </div>

            {/* Earth Elevation */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-sky-400" />
                  <span>Earth Elevation</span>
                  <button
                    onClick={() => setActiveExplainerMetric('earthElevation')}
                    className="text-zinc-500 hover:text-sky-300"
                    title="How is Earth elevation computed?"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </div>
                <div className="font-['Space_Grotesk'] text-base sm:text-xl font-bold text-white tabular-nums mt-0.5">
                  {parseFloat(animatedEarthElevation) > 0 ? '+' : ''}{animatedEarthElevation}°
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  isLos
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {isLos ? 'LOS Active' : 'No Comm'}
              </span>
            </div>
          </div>

          {/* Section: Power & Environment */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 font-bold">
              Power & Environment
            </div>

            {/* Solar Irradiance */}
            {currentPoint.solarIrradiance !== undefined && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Solar Irradiance</span>
                    <button
                      onClick={() => setActiveExplainerMetric('solarIrradiance')}
                      className="text-zinc-500 hover:text-amber-300"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                    {animatedSolar} <span className="text-xs font-mono font-normal text-zinc-400">W/m²</span>
                  </div>
                </div>
              </div>
            )}

            {/* Battery Level */}
            {currentPoint.batteryLevel !== undefined && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Battery Storage</span>
                  </span>
                  <span className="text-white font-bold tabular-nums">{animatedBattery}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(currentPoint.batteryLevel, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Surface Temperature / Extreme Cold */}
            {(() => {
              const tempVal = currentPoint.maxSurfaceTempK ?? selectedSite.summary?.maxSurfaceTempK ?? 230.7;
              const isFreezing = tempVal < 120;
              return (
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isEducatorMode ? 'Extreme Cold' : 'Max Surface Temp'}</span>
                    </div>
                    {isEducatorMode ? (
                      <div className="mt-1">
                        <span
                          className={`inline-block px-3 py-1 rounded-lg font-['Space_Grotesk'] font-bold text-sm tracking-wider uppercase border ${
                            isFreezing
                              ? 'bg-blue-600/30 text-blue-200 border-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                              : 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                          }`}
                        >
                          {isFreezing ? '❄️ FREEZING' : '🧊 COLD'}
                        </span>
                      </div>
                    ) : (
                      <div className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                        {tempVal.toFixed(1)} <span className="text-xs font-mono font-normal text-zinc-400">K</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded">
                    {isEducatorMode ? (isFreezing ? '<120K' : 'Subzero') : tempVal < 150 ? 'Deep Freeze' : 'Equatorial Sunlit'}
                  </span>
                </div>
              );
            })()}

            {/* Terrain Slope / Landing Safety */}
            {(() => {
              const slopeVal = currentPoint.averageSlopeDeg ?? selectedSite.summary?.averageSlopeDeg ?? 14.2;
              const isSafe = slopeVal < 15;
              return (
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                      <Mountain className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isEducatorMode ? 'Landing Safety' : 'Terrain Slope'}</span>
                    </div>
                    {isEducatorMode ? (
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-['Space_Grotesk'] font-bold text-sm uppercase border ${
                            isSafe
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-red-500/20 text-red-300 border-red-500/40'
                          }`}
                        >
                          {isSafe ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>SAFE</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              <span>TOO STEEP</span>
                            </>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                        {slopeVal.toFixed(1)} <span className="text-xs font-mono font-normal text-zinc-400">deg</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      isSafe
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-red-300 bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    {isEducatorMode ? (isSafe ? '<15° Slope' : '>15° Hazard') : 'LOLA Altimetry'}
                  </span>
                </div>
              );
            })()}

            {/* Water Ice (ISRU) / Water & Fuel */}
            {(() => {
              const waterVal = currentPoint.waterIcePct ?? selectedSite.summary?.waterIcePct ?? 0.0;
              return (
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                      <Droplets className="w-3.5 h-3.5 text-sky-400" />
                      <span>{isEducatorMode ? 'Water & Fuel' : 'Water Ice (ISRU)'}</span>
                    </div>
                    {isEducatorMode ? (
                      <div className="mt-1">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg font-['Space_Grotesk'] font-bold text-xs uppercase border ${
                            waterVal > 50
                              ? 'bg-sky-500/25 text-sky-300 border-sky-400/50'
                              : waterVal > 0
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {waterVal > 50 ? 'FOUND NEARBY' : waterVal > 0 ? 'TRACE AMOUNTS' : 'NONE DETECTED'}
                        </span>
                      </div>
                    ) : (
                      <div className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                        {waterVal.toFixed(1)} <span className="text-xs font-mono font-normal text-zinc-400">%</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase text-sky-300 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded">
                    {isEducatorMode ? (waterVal > 50 ? 'Rocket Fuel' : waterVal > 0 ? 'Cold Trap' : 'Dry Rim') : 'Permanently Shadowed'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/10 bg-black/60 flex items-center justify-between text-[11px] font-mono text-zinc-400 flex-shrink-0">
          <button
            onClick={() => setDataMethodsModalOpen(true)}
            className="flex items-center gap-1 hover:text-white transition-colors underline decoration-dotted"
          >
            <BookOpen className="w-3 h-3 text-indigo-400" />
            <span>Data Methods</span>
          </button>
          <span className="text-emerald-400 font-bold tabular-nums">● {totalPoints} PTS</span>
        </div>
      </aside>

      {/* ── Main Area (3D Terrain Scene + 30-Day Recharts Profile) ── */}
      {/* ── Main Area (Mobile: Bottom 67vh / Desktop: Flex-1 h-full) ── */}
      <main className="flex-1 flex flex-col w-full h-[67vh] md:h-full min-w-0 overflow-hidden relative">
        {/* ── Educator Mode Welcoming Banner ── */}
        {isEducatorMode && (
          <div className="w-full bg-gradient-to-r from-amber-500/20 via-indigo-950/60 to-amber-500/20 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs font-mono text-amber-200 z-30 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                You are in <strong>Educator Mode</strong>. We've simplified the data so you can explore why the South Pole is so hard to land on!
              </span>
            </div>
            <button
              onClick={() => setEducatorMode(false)}
              className="text-amber-300 hover:text-white text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors ml-2 shrink-0 border border-white/10"
              title="Return to full scientific telemetry"
            >
              Exit Mode
            </button>
          </div>
        )}
        {/* Top Section (3D Surface View - 60% height) */}
        <div className="relative w-full h-[37vh] md:h-[60%] bg-transparent overflow-hidden flex-shrink-0">
          <Scene
            sunElevation={currentPoint.sunElevation}
            earthElevation={currentPoint.earthElevation}
            sunAzimuth={currentPoint.sunAzimuth ?? 0}
            earthAzimuth={currentPoint.earthAzimuth ?? 0}
            heightmapUrl={selectedSite.heightmapUrl}
          />

          {/* Loading overlay when switching sites */}
          {isSiteFetching && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-950 border border-white/20 text-white font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                Loading {selectedSite.name} ephemeris…
              </div>
            </div>
          )}

          {/* Top Left Overlay Badge + Vertical Exaggeration */}
          <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-2 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-medium">LOLA 5m/px DEM</span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-300">{selectedSite.label}</span>
            </div>

            {/* Vertical Exaggeration Selector */}
            <div className="px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-1 font-mono text-xs">
              <span className="text-zinc-400 text-[10px] uppercase">VE:</span>
              {[
                { label: '1.0x', val: 1.0 },
                { label: '1.5x', val: 1.5 },
                { label: '2.0x', val: 2.0 },
                { label: '3.0x', val: 3.0 },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setVerticalExaggeration(item.val)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                    verticalExaggeration === item.val
                      ? 'bg-amber-400 text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top Right Live Telemetry HUD */}
          <div className="absolute top-16 right-4 z-10 flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-3 font-mono text-xs tabular-nums">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Sun: <strong>{animatedSunElevation}°</strong></span>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="flex items-center gap-1.5 text-sky-300">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>Earth: <strong>{animatedEarthElevation}°</strong></span>
              </span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">
                Clock: <strong className="text-white">{missionClock.formatted}</strong>
              </span>
            </div>
          </div>

          {/* Mobile-only Quick Timeline Scrubber in 3D View */}
          <div className="md:hidden absolute bottom-4 left-3 right-3 z-20 bg-black/80 backdrop-blur-md p-2.5 rounded-xl border border-white/15 space-y-1.5 shadow-xl">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {currentPoint.time}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-zinc-300 font-mono text-[10px]"
                >
                  -1h
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(totalPoints - 1, prev + 1))}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-zinc-300 font-mono text-[10px]"
                >
                  +1h
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(totalPoints - 1, 0)}
              step={1}
              value={currentIndex}
              onChange={handleSliderChange}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Controls Tip */}
          <div className="absolute bottom-3 left-4 z-10 font-mono text-[10px] text-zinc-400 bg-black/60 backdrop-blur-sm px-3 py-1 rounded border border-white/10 pointer-events-none">
            Rotate: Left Click • Pan: Right Click • Zoom: Scroll
          </div>
        </div>

        {/* Bottom Section (Dual-Line Telemetry Profile - 40% height) */}
        <div className="w-full h-[30vh] md:h-[40%] bg-[#08090e] border-t border-white/10 p-2 sm:p-4 flex flex-col justify-between overflow-hidden flex-shrink-0">
          {/* Chart Header */}
          <div className="flex items-center justify-between mb-1 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="font-['Space_Grotesk'] text-xs font-bold tracking-wider uppercase text-white flex items-center gap-1.5">
                <span>30-Day Solar & Earth Horizon Elevation Profile</span>
                {isEducatorMode && (
                  <span className="relative group inline-flex items-center">
                    <button
                      type="button"
                      className="text-amber-400 hover:text-amber-300 p-0.5 rounded-full hover:bg-white/10 transition-colors focus:outline-none"
                      aria-label="Educational insight tooltip"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-2.5 bg-black/95 border border-amber-400/60 rounded-lg text-xs font-sans text-zinc-200 shadow-2xl z-50 pointer-events-none leading-relaxed animate-in fade-in duration-150 normal-case tracking-normal">
                      <span className="font-bold text-amber-300 font-mono text-[10px] uppercase mb-1 flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />
                        <span>Lunar Science Insight</span>
                      </span>
                      Why does the sun barely move here? Because the Moon only tilts 1.5 degrees, so at the South Pole, the sun skims the horizon.
                    </span>
                  </span>
                )}
              </h2>
              <span className="font-mono text-[10px] text-zinc-400 border border-white/10 px-2 py-0.5 rounded">
                {selectedSite.name} • 720 Hours (NASA JPL DE421)
              </span>
            </div>
            <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Sun Elevation
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Earth Elevation
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Step: {currentPoint.time}
              </span>
            </div>
          </div>

          {/* Recharts Dual-Line Chart */}
          <div className="w-full flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={telemetryData}
                margin={{ top: 8, right: 24, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#181924" vertical={false} />
                <XAxis
                  dataKey="time"
                  interval={xAxisInterval}
                  stroke="#33374a"
                  tick={{ fill: '#71768c', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={{ stroke: '#33374a' }}
                />
                <YAxis
                  stroke="#33374a"
                  unit="°"
                  tick={{ fill: '#71768c', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={{ stroke: '#33374a' }}
                  type="number"
                  domain={[-90, 90]}
                  ticks={[-90, -45, 0, 45, 90]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0b12',
                    borderColor: '#2d3148',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  formatter={(value: any) => [
                    `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}°`,
                    '',
                  ]}
                />

                <ReferenceLine
                  y={0}
                  stroke="#475569"
                  strokeDasharray="2 2"
                  label={{
                    value: 'Horizon (0°)',
                    fill: '#64748b',
                    fontSize: 10,
                    position: 'insideBottomRight',
                  }}
                />

                <ReferenceLine
                  x={currentPoint.time}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: currentPoint.time,
                    fill: '#10b981',
                    fontSize: 10,
                    position: 'top',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="sunElevation"
                  name="Sun Elevation"
                  stroke="#ffb84d"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                />

                <Line
                  type="monotone"
                  dataKey="earthElevation"
                  name="Earth Elevation"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: '#0ea5e9' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer Attribution */}
        <FooterAttribution />
      </main>

      

      {/* Global FPS Monitor HUD */}
      <FpsMonitor />
    </div>
  );
}
