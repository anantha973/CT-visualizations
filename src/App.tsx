import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
} from 'lucide-react';
import {
  AcquisitionParams,
  PhantomPreset,
  PhantomPrimitive,
  PrimitiveShape,
  ProbedSinogramPoint,
  SinogramColormap,
} from './types/tomography';
import {
  computeFullSinogram,
  computeSingleProjection,
  huToMu,
  PHANTOM_PRESETS,
} from './engine/radonEngine';
import { ObjectGeometryWindow } from './components/ObjectGeometryWindow';
import { CurrentProjectionWindow } from './components/CurrentProjectionWindow';
import { SinogramWindow } from './components/SinogramWindow';
import { PhantomEditorPanel } from './components/PhantomEditorPanel';
import { RadonMathGuide } from './components/RadonMathGuide';
import { MathFormula } from './components/MathFormula';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Default to the Anatomical Thorax (Heart, Lungs & Spine) preset
  const [activePresetId, setActivePresetId] = useState<string>(PHANTOM_PRESETS[0].id);
  const [primitives, setPrimitives] = useState<PhantomPrimitive[]>(() =>
    PHANTOM_PRESETS[0].primitives.map((p) => ({ ...p }))
  );
  const [selectedPrimitiveId, setSelectedPrimitiveId] = useState<string | null>(
    PHANTOM_PRESETS[0].primitives[3]?.id || PHANTOM_PRESETS[0].primitives[0].id
  );

  // CT Acquisition & Gantry Geometry State
  const [params, setParams] = useState<AcquisitionParams>({
    beamMode: 'parallel',
    currentAngleDeg: 36,
    maxAngleDeg: 180,
    angularStepDeg: 2,
    detectorBins: 128,
    sliceThicknessMm: 2.0,
    sliceZOffsetMm: 0.0,
    sourceIsoDistMm: 210,
    fanAngleDeg: 54,
  });

  // Real-Time Animation & Progressive Sinogram Drawing State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [maxAcquiredAngleDeg, setMaxAcquiredAngleDeg] = useState<number>(180);
  const [showFullGhostSinogram, setShowFullGhostSinogram] = useState<boolean>(true);
  const [showSinusoidLocus, setShowSinusoidLocus] = useState<boolean>(true);
  const [showRayLines, setShowRayLines] = useState<boolean>(true);
  const [colormap, setColormap] = useState<SinogramColormap>('clinical_cyan');
  const [probedPoint, setProbedPoint] = useState<ProbedSinogramPoint | null>(null);

  const fullSinogram = useMemo(
    () => computeFullSinogram(primitives, params),
    [
      primitives,
      params.beamMode,
      params.maxAngleDeg,
      params.angularStepDeg,
      params.detectorBins,
      params.sliceThicknessMm,
      params.sliceZOffsetMm,
      params.sourceIsoDistMm,
      params.fanAngleDeg,
    ]
  );

  const currentProjection = useMemo(
    () => computeSingleProjection(primitives, params, params.currentAngleDeg),
    [primitives, params]
  );

  // Real-time Play animation loop: rotates gantry & draws sinogram simultaneously
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      lastFrameTimeRef.current = null;
      return;
    }

    let animId: number;
    const baseDegreesPerSec = 36;

    const tick = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }
      const dtSec = Math.min(0.1, (timestamp - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = timestamp;

      setParams((prev) => {
        const nextAngle = prev.currentAngleDeg + dtSec * baseDegreesPerSec * playbackSpeed;
        if (nextAngle >= prev.maxAngleDeg) {
          setIsPlaying(false);
          setMaxAcquiredAngleDeg(prev.maxAngleDeg);
          return { ...prev, currentAngleDeg: prev.maxAngleDeg };
        }
        const quantized =
          Math.round(nextAngle / prev.angularStepDeg) * prev.angularStepDeg;
        setMaxAcquiredAngleDeg((prevMax) => Math.max(prevMax, quantized));
        return { ...prev, currentAngleDeg: Number(nextAngle.toFixed(1)) };
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackSpeed]);

  const handleTogglePlay = () => {
    if (!isPlaying) {
      if (
        params.currentAngleDeg >= params.maxAngleDeg - 1 ||
        maxAcquiredAngleDeg >= params.maxAngleDeg
      ) {
        setParams((prev) => ({ ...prev, currentAngleDeg: 0 }));
        setMaxAcquiredAngleDeg(0);
      }
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const handleStepAngle = (direction: -1 | 1) => {
    setIsPlaying(false);
    setParams((prev) => {
      const next = Math.max(
        0,
        Math.min(prev.maxAngleDeg, prev.currentAngleDeg + direction * prev.angularStepDeg)
      );
      setMaxAcquiredAngleDeg((prevMax) => Math.max(prevMax, next));
      return { ...prev, currentAngleDeg: next };
    });
  };

  const handleResetSweep = () => {
    setIsPlaying(false);
    setParams((prev) => ({ ...prev, currentAngleDeg: 0 }));
    setMaxAcquiredAngleDeg(0);
  };

  const handleCompleteSinogram = () => {
    setIsPlaying(false);
    setMaxAcquiredAngleDeg(params.maxAngleDeg);
  };

  const handleSelectPreset = (preset: PhantomPreset) => {
    setIsPlaying(false);
    setActivePresetId(preset.id);
    const cloned = preset.primitives.map((p) => ({ ...p }));
    setPrimitives(cloned);
    setSelectedPrimitiveId(cloned[3]?.id || cloned[cloned.length - 1]?.id || cloned[0]?.id || null);
    setMaxAcquiredAngleDeg(params.maxAngleDeg);
    setProbedPoint(null);
  };

  const handleResetCurrentPreset = () => {
    const preset =
      PHANTOM_PRESETS.find((p) => p.id === activePresetId) || PHANTOM_PRESETS[0];
    handleSelectPreset(preset);
  };

  const handleUpdatePrimitivePosition = (
    id: string,
    centerX: number,
    centerY: number
  ) => {
    setPrimitives((prev) =>
      prev.map((p) => (p.id === id ? { ...p, centerX, centerY } : p))
    );
  };

  const handleUpdatePrimitive = (id: string, patch: Partial<PhantomPrimitive>) => {
    setPrimitives((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const handleAddPrimitive = (shape: PrimitiveShape) => {
    const newId = `custom-${Date.now()}`;
    const defaults: Record<
      PrimitiveShape,
      { label: string; tissueType: PhantomPrimitive['tissueType']; hu: number; rx: number; ry: number }
    > = {
      heart: { label: 'Anatomical Heart', tissueType: 'soft_tissue', hu: 55, rx: 26, ry: 23 },
      lung_left: { label: 'Anatomical Left Lung', tissueType: 'lung', hu: -740, rx: 32, ry: 42 },
      lung_right: { label: 'Anatomical Right Lung', tissueType: 'lung', hu: -740, rx: 32, ry: 42 },
      brain_left: { label: 'Cerebral Hemisphere', tissueType: 'soft_tissue', hu: 45, rx: 45, ry: 60 },
      brain_right: { label: 'Right Hemisphere', tissueType: 'soft_tissue', hu: 45, rx: 45, ry: 60 },
      brain_ventricle: { label: 'Lateral Ventricles', tissueType: 'water', hu: 0, rx: 22, ry: 26 },
      vertebra: { label: 'Thoracic Vertebra', tissueType: 'cortical_bone', hu: 1050, rx: 22, ry: 20 },
      ellipse: { label: 'Calcified Lesion', tissueType: 'cortical_bone', hu: 950, rx: 10, ry: 10 },
      rectangle: { label: 'Calibration Bar', tissueType: 'titanium', hu: 1600, rx: 18, ry: 5 },
    };
    const cfg = defaults[shape];
    const newPrim: PhantomPrimitive = {
      id: newId,
      label: cfg.label,
      shape,
      tissueType: cfg.tissueType,
      hu: cfg.hu,
      mu: huToMu(cfg.hu),
      centerX: Math.round((Math.random() - 0.5) * 45),
      centerY: Math.round((Math.random() - 0.5) * 45),
      radiusX: cfg.rx,
      radiusY: cfg.ry,
      tiltDeg: 0,
      zCenterMm: 0,
      zThicknessMm: 14,
      visible: true,
    };
    setPrimitives((prev) => [...prev, newPrim]);
    setSelectedPrimitiveId(newId);
    setMaxAcquiredAngleDeg(params.maxAngleDeg);
  };

  const handleDeletePrimitive = (id: string) => {
    setPrimitives((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (selectedPrimitiveId === id) {
        setSelectedPrimitiveId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleProbeBinFromWindow2 = (binIndex: number | null) => {
    if (binIndex === null) {
      if (!probedPoint?.locked) setProbedPoint(null);
      return;
    }
    const ray = currentProjection.rays[binIndex];
    if (!ray) return;
    const angleIndex = Math.round(params.currentAngleDeg / params.angularStepDeg);
    setProbedPoint({
      angleIndex,
      angleDeg: params.currentAngleDeg,
      binIndex,
      sMm: ray.sMm,
      attenuation: ray.attenuation,
      locked: false,
    });
  };

  const handleApplyLabScenario = (
    scenarioId: 'sinusoid' | 'partial_volume' | 'fan_vs_parallel' | 'anisotropy'
  ) => {
    if (scenarioId === 'sinusoid') {
      const preset = PHANTOM_PRESETS.find((p) => p.id === 'point-sinusoid-demo')!;
      handleSelectPreset(preset);
      setSelectedPrimitiveId('ps-pin-quad1');
      setShowSinusoidLocus(true);
      setParams((prev) => ({
        ...prev,
        beamMode: 'parallel',
        maxAngleDeg: 360,
        currentAngleDeg: 0,
        sliceThicknessMm: 2.0,
      }));
      setMaxAcquiredAngleDeg(0);
      setIsPlaying(true);
    } else if (scenarioId === 'partial_volume') {
      const preset = PHANTOM_PRESETS.find((p) => p.id === 'partial-volume-z-slab')!;
      handleSelectPreset(preset);
      setSelectedPrimitiveId('pv-disc-1.5mm');
      setParams((prev) => ({
        ...prev,
        beamMode: 'parallel',
        sliceThicknessMm: 12.0,
        sliceZOffsetMm: 0.0,
        currentAngleDeg: 45,
      }));
      setMaxAcquiredAngleDeg(params.maxAngleDeg);
    } else if (scenarioId === 'fan_vs_parallel') {
      const preset = PHANTOM_PRESETS.find((p) => p.id === 'point-sinusoid-demo')!;
      handleSelectPreset(preset);
      setSelectedPrimitiveId('ps-pin-quad1');
      setShowSinusoidLocus(true);
      setParams((prev) => ({
        ...prev,
        beamMode: 'fan',
        maxAngleDeg: 360,
        sourceIsoDistMm: 165,
        fanAngleDeg: 64,
        currentAngleDeg: 60,
      }));
      setMaxAcquiredAngleDeg(360);
    } else if (scenarioId === 'anisotropy') {
      const preset = PHANTOM_PRESETS.find((p) => p.id === 'anatomical-thorax-heart-lungs')!;
      handleSelectPreset(preset);
      setSelectedPrimitiveId('ath-heart-myocardium');
      setMaxAcquiredAngleDeg(params.maxAngleDeg);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-5 py-2.5 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workbench"
          className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          RadonLab
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-400">
          <a
            href="#workbench"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Sinogram Workbench
          </a>
          <a
            href="#phantom-studio"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Anatomical Studio
          </a>
          <a
            href="#math-reference"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Radon Mathematics
          </a>
          <a
            href="#math-reference"
            onClick={(e) => {
              e.preventDefault();
              handleApplyLabScenario('sinusoid');
            }}
            className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
          >
            Guided Sinusoid Demo
          </a>
        </nav>

        {/* Zone 3: Light / Dark Mode Icon Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-cyan-500/50 transition-colors whitespace-nowrap shrink-0"
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="workbench" className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-5 py-3 space-y-3">
        {/* Compact Topic Header & Quick Phantom Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pb-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              How Is a CT Sinogram Formed?
            </h1>
            <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
              Module 01 · Radon Transform <MathFormula tex="\mathcal{R}[\mu](s, \theta)" />
            </span>
          </div>

          {/* Interactive Phantom Quick-Select Bar */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-[#111827] p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            {PHANTOM_PRESETS.map((preset) => {
              const active = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {preset.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Acquisition & Real-Time Gantry Animation Control Console */}
        <section className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 shadow-2xs">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
            {/* Transport & Animation Controls (4 cols) */}
            <div className="xl:col-span-4 flex flex-wrap items-center gap-1.5 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 pb-2.5 xl:pb-0 xl:pr-3">
              <button
                type="button"
                onClick={handleTogglePlay}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-cyan-600 text-white hover:bg-cyan-500'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Scan</span>
                  </>
                )}
              </button>

              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-0.5 tabular-nums">
                <button
                  type="button"
                  onClick={() => handleStepAngle(-1)}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md"
                  title={`Step Backward (-${params.angularStepDeg}°)`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                  <MathFormula tex={`\\pm ${params.angularStepDeg}^\\circ`} />
                </span>
                <button
                  type="button"
                  onClick={() => handleStepAngle(1)}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md"
                  title={`Step Forward (+${params.angularStepDeg}°)`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetSweep}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
                title="Clear sinogram and reset gantry to 0°"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Zero</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteSinogram}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors whitespace-nowrap shrink-0"
                title="Fill entire sinogram immediately"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Fill</span>
              </button>

              <select
                aria-label="Playback Speed"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="px-2 py-1.5 text-xs font-medium tabular-nums rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1.0×</option>
                <option value={2}>2.0×</option>
                <option value={4}>4.0×</option>
              </select>
            </div>

            {/* Primary Continuous Sliders: Projection Angle θ & Slice Thickness Δz (4 cols) */}
            <div className="xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 pb-2.5 xl:pb-0 xl:pr-3 tabular-nums">
              {/* Projection Angle Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Angle (<MathFormula tex="\theta" />)
                  </span>
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    <MathFormula tex={`${params.currentAngleDeg.toFixed(0)}^\\circ / ${params.maxAngleDeg}^\\circ`} />
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={params.maxAngleDeg}
                  step={params.angularStepDeg}
                  value={params.currentAngleDeg}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    setIsPlaying(false);
                    setParams((prev) => ({ ...prev, currentAngleDeg: deg }));
                    setMaxAcquiredAngleDeg((prevMax) => Math.max(prevMax, deg));
                  }}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Axial Slice Thickness Δz Slider */}
              <div>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Slice <MathFormula tex="\Delta z" />
                  </span>
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    {params.sliceThicknessMm.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={20.0}
                  step={0.5}
                  value={params.sliceThicknessMm}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      sliceThicknessMm: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Geometry & Resolution Controls (4 cols) */}
            <div className="xl:col-span-4 flex flex-wrap items-center justify-between gap-1.5 tabular-nums">
              {/* Parallel vs Fan-Beam Segmented Toggle */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setParams((prev) => ({ ...prev, beamMode: 'parallel' }))}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    params.beamMode === 'parallel'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Parallel
                </button>
                <button
                  type="button"
                  onClick={() => setParams((prev) => ({ ...prev, beamMode: 'fan' }))}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    params.beamMode === 'fan'
                      ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Fan-Beam
                </button>
              </div>

              {/* 180° vs 360° Scan Range */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {([180, 360] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setParams((prev) => ({
                        ...prev,
                        maxAngleDeg: range,
                        currentAngleDeg: Math.min(prev.currentAngleDeg, range),
                      }));
                      setMaxAcquiredAngleDeg(range);
                    }}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      params.maxAngleDeg === range
                        ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {range}°
                  </button>
                ))}
              </div>

              {/* Angular Step Δθ */}
              <select
                aria-label="Angular Step Resolution"
                value={params.angularStepDeg}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    angularStepDeg: Number(e.target.value) as 1 | 2 | 3 | 5,
                  }))
                }
                className="px-1.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                title="Angular Step Size (Δθ)"
              >
                <option value={1}>Step 1°</option>
                <option value={2}>Step 2°</option>
                <option value={3}>Step 3°</option>
                <option value={5}>Step 5°</option>
              </select>

              {/* Detector Bins Selector */}
              <select
                aria-label="Detector Channels"
                value={params.detectorBins}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    detectorBins: Number(e.target.value) as 64 | 128 | 192 | 256,
                  }))
                }
                className="px-1.5 py-1 text-xs font-medium rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                title="Number of Detector Channels (Ns)"
              >
                <option value={64}>64 bins</option>
                <option value={128}>128 bins</option>
                <option value={192}>192 bins</option>
                <option value={256}>256 bins</option>
              </select>
            </div>
          </div>
        </section>

        {/* Three Synchronized Tomography Inspection Windows — Asymmetric Fixed-Viewport Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 md:h-[calc(100vh-190px)] md:min-h-[460px] md:max-h-[680px] min-h-0 overflow-hidden">
          {/* Left Column: Window 1 (Object & Projection Geometry) */}
          <div className="md:col-span-5 h-[360px] md:h-full min-h-0 overflow-hidden">
            <ObjectGeometryWindow
              primitives={primitives}
              params={params}
              currentProjection={currentProjection}
              selectedPrimitiveId={selectedPrimitiveId}
              onSelectPrimitive={setSelectedPrimitiveId}
              onUpdatePrimitivePosition={handleUpdatePrimitivePosition}
              probedPoint={probedPoint}
              isDark={isDark}
              showRayLines={showRayLines}
              onToggleRayLines={() => setShowRayLines((v) => !v)}
            />
          </div>

          {/* Right Column: Window 2 (Current Projection) stacked above Window 3 (Sinogram) */}
          <div className="md:col-span-7 grid grid-rows-2 gap-3.5 md:h-full min-h-0 overflow-hidden">
            {/* Top Right: Window 2 — Current Projection Profile */}
            <div className="h-[240px] md:h-full min-h-0 overflow-hidden">
              <CurrentProjectionWindow
                params={params}
                currentProjection={currentProjection}
                primitives={primitives}
                selectedPrimitiveId={selectedPrimitiveId}
                probedPoint={probedPoint}
                onProbeBin={handleProbeBinFromWindow2}
                globalMaxAttenuation={fullSinogram.globalMax}
                isDark={isDark}
              />
            </div>

            {/* Bottom Right: Window 3 — 2D Sinogram Matrix */}
            <div className="h-[260px] md:h-full min-h-0 overflow-hidden">
              <SinogramWindow
                params={params}
                sinogram={fullSinogram}
                primitives={primitives}
                selectedPrimitiveId={selectedPrimitiveId}
                maxAcquiredAngleDeg={maxAcquiredAngleDeg}
                showFullGhostSinogram={showFullGhostSinogram}
                onToggleGhostSinogram={() => setShowFullGhostSinogram((v) => !v)}
                showSinusoidLocus={showSinusoidLocus}
                onToggleSinusoidLocus={() => setShowSinusoidLocus((v) => !v)}
                colormap={colormap}
                onChangeColormap={setColormap}
                probedPoint={probedPoint}
                onProbePoint={setProbedPoint}
                onSelectAngle={(angleDeg) => {
                  setIsPlaying(false);
                  setParams((prev) => ({ ...prev, currentAngleDeg: angleDeg }));
                  setMaxAcquiredAngleDeg((prevMax) => Math.max(prevMax, angleDeg));
                }}
                isDark={isDark}
              />
            </div>
          </div>
        </div>

        {/* Custom Phantom & Organ Density Studio */}
        <section id="phantom-studio" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                Interactive Anatomical Studio · Hounsfield Unit &amp; Organ Builder
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Anatomical CT Phantoms &amp; Custom Organ Inspector
              </h2>
            </div>
          </div>

          <PhantomEditorPanel
            activePresetId={activePresetId}
            onSelectPreset={handleSelectPreset}
            onResetPreset={handleResetCurrentPreset}
            primitives={primitives}
            selectedPrimitiveId={selectedPrimitiveId}
            onSelectPrimitive={setSelectedPrimitiveId}
            onUpdatePrimitive={handleUpdatePrimitive}
            onAddPrimitive={handleAddPrimitive}
            onDeletePrimitive={handleDeletePrimitive}
          />
        </section>

        {/* Master's Mathematical Formulation & Guided Lab Scenarios */}
        <RadonMathGuide onApplyLabScenario={handleApplyLabScenario} />
      </main>

      {/* Quiet Academic Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        RadonLab — Master&apos;s Computed Tomography Interactive Workbench for Medical Systems Engineering
      </footer>
    </div>
  );
}
