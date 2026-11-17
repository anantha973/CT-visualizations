import React, { useEffect, useRef, useState } from 'react';
import { Activity, Layers } from 'lucide-react';
import {
  AcquisitionParams,
  PhantomPrimitive,
  ProbedSinogramPoint,
  ProjectionResult,
} from '../types/tomography';
import { MathFormula } from './MathFormula';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 400, h: 300 });
  const [showThinSliceRef, setShowThinSliceRef] = useState<boolean>(true);
  const [showSelectedComponent, setShowSelectedComponent] = useState<boolean>(true);

  const selectedPrim = primitives.find((p) => p.id === selectedPrimitiveId && p.visible);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.floor(width);
        const h = Math.floor(height);
        if (w > 0 && h > 0) {
          setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padLeft = 42;
    const padRight = 16;
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
    const width = canvasSize.w;
    const height = canvasSize.h;
    if (width <= 0 || height <= 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padLeft = 42;
    const padRight = 16;
    const padTop = 14;
    const padBottom = 28;
    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

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

    // 2. Grid lines & clean sans-serif axis labels
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.15)';
    ctx.lineWidth = 1;
    ctx.font = '500 10.5px "Plus Jakarta Sans", "DM Sans", sans-serif';
    ctx.fillStyle = isDark ? '#64748B' : '#475569';

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

    [-100, -50, 0, 50, 100].forEach((sVal) => {
      const u = (sVal + 100) / 200;
      const x = padLeft + u * plotW;
      ctx.beginPath();
      ctx.strokeStyle =
        sVal === 0
          ? isDark
            ? 'rgba(148, 163, 184, 0.28)'
            : 'rgba(71, 85, 105, 0.3)'
          : isDark
            ? 'rgba(148, 163, 184, 0.12)'
            : 'rgba(100, 116, 139, 0.15)';
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${sVal > 0 ? `+${sVal}` : sVal}`, x, padTop + plotH + 4);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
    ctx.font = '500 10.5px "Plus Jakarta Sans", "DM Sans", sans-serif';
    ctx.fillText(
      params.beamMode === 'parallel'
        ? 'Detector Coordinate s (mm)'
        : 'Fan Detector Coordinate s (mm)',
      padLeft + plotW / 2,
      height - 11
    );

    // 3. Thin-Slice (0.5mm) Baseline Reference Curve
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

    // 4. Selected Primitive Individual Contribution Curve
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

    // 5. Primary Total Attenuation Profile p_theta(s)
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
    canvasSize,
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
    <section className="flex flex-col h-full w-full min-h-0 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
            Window 02 ·
          </span>
          <h2 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            Current Projection <MathFormula tex="p_\theta(s)" />
          </h2>
          <span className="text-xs text-cyan-600 dark:text-cyan-400 tabular-nums shrink-0">
            (<MathFormula tex={`\\theta = ${params.currentAngleDeg.toFixed(0)}^\\circ`} />)
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowThinSliceRef((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showThinSliceRef
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Compare current slice thickness against 0.5mm thin-slice reference"
          >
            <Layers className="w-3 h-3" />
            <span>0.5 mm Ref</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSelectedComponent((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showSelectedComponent
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Show isolated attenuation contribution of selected organ"
          >
            <Activity className="w-3 h-3" />
            <span>Organ Split</span>
          </button>
        </div>
      </div>

      {/* Main 1D Waveform Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full select-none overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => onProbeBin(null)}
          className="absolute inset-0 w-full h-full cursor-crosshair block"
        />

        {/* Legend & Live Integral Readout */}
        <div className="pointer-events-none absolute top-2 right-2 flex flex-col items-end gap-0.5 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200/80 dark:border-slate-800/80 text-[11px] tabular-nums">
          <div className="flex items-center gap-2">
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
              Peak <MathFormula tex="\int \mu\,d\ell" />: {currentProjection.maxAttenuation.toFixed(2)}
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600 dark:text-slate-300">
              {params.detectorBins} channels
            </span>
          </div>
          {activeBinRay ? (
            <div className="text-amber-600 dark:text-amber-400 font-medium">
              <MathFormula tex={`s = ${activeBinRay.sMm.toFixed(0)}\\text{ mm} \\implies p = ${activeBinRay.attenuation.toFixed(3)}`} />
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400">
              Hover waveform to trace single X-ray path
            </div>
          )}
        </div>
      </div>

      {/* Footer Mathematical Summary */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080C14] px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0">
        <div className="text-slate-700 dark:text-slate-300 truncate">
          <MathFormula tex={`p_\\theta(s) = -\\ln(I / I_0) = \\int_{L(s,\\theta)} \\mu(x,y,z)\\,d\\ell \\;\\longrightarrow\\; \\text{Sinogram Row } \\theta = ${params.currentAngleDeg.toFixed(0)}^\\circ`} />
        </div>
        {selectedPrim && showSelectedComponent && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 truncate max-w-[180px] shrink-0">
            Amber: {selectedPrim.label}
          </span>
        )}
      </div>
    </section>
  );
};
