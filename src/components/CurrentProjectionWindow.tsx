import React, { useEffect, useRef, useState } from 'react';
import { Activity, Layers } from 'lucide-react';
import {
  AcquisitionParams,
  PhantomPrimitive,
  ProbedSinogramPoint,
  ProjectionResult,
} from '../types/tomography';

interface CurrentProjectionWindowProps {
  params: AcquisitionParams;
  currentProjection: ProjectionResult;
  primitives: PhantomPrimitive[];
  selectedPrimitiveId: string | null;
  probedPoint: ProbedSinogramPoint | null;
  onProbeBin: (binIndex: number | null) => void;
  globalMaxAttenuation: number;
  isDark: boolean;
}

export const CurrentProjectionWindow: React.FC<CurrentProjectionWindowProps> = ({
  params,
  currentProjection,
  primitives,
  selectedPrimitiveId,
  probedPoint,
  onProbeBin,
  globalMaxAttenuation,
  isDark,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showThinSliceRef, setShowThinSliceRef] = useState<boolean>(true);
  const [showSelectedComponent, setShowSelectedComponent] = useState<boolean>(true);

  const selectedPrim = primitives.find((p) => p.id === selectedPrimitiveId && p.visible);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padLeft = 44;
    const padRight = 18;
    const plotW = rect.width - padLeft - padRight;
    const relX = e.clientX - rect.left - padLeft;
    if (relX < 0 || relX > plotW) {
      onProbeBin(null);
      return;
    }
    const u = Math.max(0, Math.min(1, relX / plotW));
    const binIndex = Math.round(u * (params.detectorBins - 1));
    onProbeBin(binIndex);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 420;
    const height = canvas.clientHeight || 360;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 44;
    const padRight = 18;
    const padTop = 24;
    const padBottom = 38;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // 1. Background
    ctx.fillStyle = isDark ? '#0B0F19' : '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    const yMax = Math.max(2.5, globalMaxAttenuation * 1.12);
    const rays = currentProjection.rays;
    const numBins = rays.length;

    const binToX = (k: number) =>
      padLeft + (numBins <= 1 ? 0.5 : k / (numBins - 1)) * plotW;
    const valToY = (v: number) =>
      padTop + plotH - Math.min(1, Math.max(0, v / yMax)) * plotH;

    // 2. Grid lines
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.15)';
    ctx.lineWidth = 1;
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isDark ? '#64748B' : '#475569';

    // Horizontal Y grid lines (attenuation p = ∫ μ dl)
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = (yMax * i) / ySteps;
      const y = valToY(val);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(1), padLeft - 6, y);
    }

    // Vertical X grid lines (detector s in mm: -100, -50, 0, +50, +100)
    [-100, -50, 0, 50, 100].forEach((sVal) => {
      const u = (sVal + 100) / 200;
      const x = padLeft + u * plotW;
      ctx.beginPath();
      if (sVal === 0) {
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.28)' : 'rgba(71, 85, 105, 0.3)';
      } else {
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.15)';
      }
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${sVal > 0 ? `+${sVal}` : sVal}`, x, padTop + plotH + 7);
    });

    // Axis title
    ctx.textAlign = 'center';
    ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
    ctx.fillText(
      params.beamMode === 'parallel'
        ? 'Detector Position s (mm)'
        : 'Fan-Beam Detector Coordinate s (mm)',
      padLeft + plotW / 2,
      height - 14
    );

    // 3. Optional Thin-Slice (0.5mm) Baseline Reference Curve (shows partial volume contrast loss)
    if (showThinSliceRef && params.sliceThicknessMm > 1.0 && rays.length > 0) {
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.55)' : 'rgba(100, 116, 139, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let k = 0; k < numBins; k++) {
        const x = binToX(k);
        const y = valToY(rays[k].thinSliceAttenuation);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. Optional Selected Primitive Individual Contribution Curve
    if (
      showSelectedComponent &&
      selectedPrim &&
      currentProjection.primitiveContributions[selectedPrim.id]
    ) {
      const contrib = currentProjection.primitiveContributions[selectedPrim.id];
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(binToX(0), valToY(0));
      for (let k = 0; k < contrib.length; k++) {
        ctx.lineTo(binToX(k), valToY(contrib[k]));
      }
      ctx.lineTo(binToX(contrib.length - 1), valToY(0));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Primary Total Attenuation Line Integral Profile p_theta(s)
    if (rays.length > 0) {
      const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.34)');
      grad.addColorStop(1, 'rgba(6, 182, 212, 0.02)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(binToX(0), valToY(0));
      for (let k = 0; k < numBins; k++) {
        ctx.lineTo(binToX(k), valToY(rays[k].attenuation));
      }
      ctx.lineTo(binToX(numBins - 1), valToY(0));
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let k = 0; k < numBins; k++) {
        const x = binToX(k);
        const y = valToY(rays[k].attenuation);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 6. Probed Detector Bin Crosshair
    if (probedPoint) {
      const k = Math.max(0, Math.min(numBins - 1, probedPoint.binIndex));
      const ray = rays[k];
      if (ray) {
        const px = binToX(k);
        const py = valToY(ray.attenuation);

        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, padTop);
        ctx.lineTo(px, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    params,
    currentProjection,
    primitives,
    selectedPrimitiveId,
    probedPoint,
    globalMaxAttenuation,
    isDark,
    showThinSliceRef,
    showSelectedComponent,
    selectedPrim,
  ]);

  const activeBinRay =
    probedPoint && currentProjection.rays[probedPoint.binIndex]
      ? currentProjection.rays[probedPoint.binIndex]
      : null;

  return (
    <section className="flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>WINDOW 02</span>
            <span aria-hidden="true">·</span>
            <span>1D DETECTOR PROFILE pθ(s)</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Current Projection (θ = {params.currentAngleDeg.toFixed(0)}°)
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowThinSliceRef((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showThinSliceRef
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Compare current slice thickness against 0.5mm thin-slice reference"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>0.5mm Ref</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSelectedComponent((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showSelectedComponent
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Show isolated attenuation contribution of selected object"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Object Split</span>
          </button>
        </div>
      </div>

      {/* Main 1D Waveform Canvas */}
      <div className="relative flex-1 min-h-[310px] w-full select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => onProbeBin(null)}
          className="w-full h-full min-h-[310px] cursor-crosshair block"
        />

        {/* Legend & Live Integral Readout */}
        <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-mono">
          <div className="flex items-center gap-3">
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
              Peak ∫μdl: {currentProjection.maxAttenuation.toFixed(2)}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 dark:text-slate-300">
              Bins: {params.detectorBins}
            </span>
          </div>
          {activeBinRay ? (
            <div className="text-amber-600 dark:text-amber-400">
              Bin #{activeBinRay.binIndex} (s = {activeBinRay.sMm.toFixed(1)} mm) → p ={' '}
              {activeBinRay.attenuation.toFixed(3)}
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400">
              Hover waveform to trace single ray path
            </div>
          )}
        </div>
      </div>

      {/* Footer Mathematical Summary */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080C14] px-4 py-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <span className="font-mono text-cyan-600 dark:text-cyan-400 font-medium">
            pθ(s) = -ln(I / I₀) = ∫ μ(x,y,z) dℓ
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
             maps directly to Row θ = {params.currentAngleDeg.toFixed(0)}° in Sinogram
          </span>
        </div>
        {selectedPrim && showSelectedComponent && (
          <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 shrink-0">
            Amber: {selectedPrim.label}
          </span>
        )}
      </div>
    </section>
  );
};
