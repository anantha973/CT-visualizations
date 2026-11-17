import React, { useEffect, useRef } from 'react';
import { Eye, Orbit } from 'lucide-react';
import {
  AcquisitionParams,
  PhantomPrimitive,
  ProbedSinogramPoint,
  SinogramColormap,
  SinogramMatrix,
} from '../types/tomography';
import { computeTheoreticalSinusoidMm, mapSinogramColor } from '../engine/radonEngine';

interface SinogramWindowProps {
  params: AcquisitionParams;
  sinogram: SinogramMatrix;
  primitives: PhantomPrimitive[];
  selectedPrimitiveId: string | null;
  maxAcquiredAngleDeg: number;
  showFullGhostSinogram: boolean;
  onToggleGhostSinogram: () => void;
  showSinusoidLocus: boolean;
  onToggleSinusoidLocus: () => void;
  colormap: SinogramColormap;
  onChangeColormap: (c: SinogramColormap) => void;
  probedPoint: ProbedSinogramPoint | null;
  onProbePoint: (pt: ProbedSinogramPoint | null) => void;
  onSelectAngle: (angleDeg: number) => void;
  isDark: boolean;
}

export const SinogramWindow: React.FC<SinogramWindowProps> = ({
  params,
  sinogram,
  primitives,
  selectedPrimitiveId,
  maxAcquiredAngleDeg,
  showFullGhostSinogram,
  onToggleGhostSinogram,
  showSinusoidLocus,
  onToggleSinusoidLocus,
  colormap,
  onChangeColormap,
  probedPoint,
  onProbePoint,
  onSelectAngle,
  isDark,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedPrim = primitives.find((p) => p.id === selectedPrimitiveId && p.visible);

  const getPlotMetrics = (width: number, height: number) => {
    const padLeft = 46;
    const padRight = 18;
    const padTop = 24;
    const padBottom = 38;
    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);
    return { padLeft, padRight, padTop, padBottom, plotW, plotH };
  };

  const handlePointerEvent = (
    e: React.PointerEvent<HTMLCanvasElement>,
    shouldLockAngle: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas || sinogram.anglesDeg.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const { padLeft, padTop, plotW, plotH } = getPlotMetrics(rect.width, rect.height);

    const relX = e.clientX - rect.left - padLeft;
    const relY = e.clientY - rect.top - padTop;

    if (relX < 0 || relX > plotW || relY < 0 || relY > plotH) {
      if (!probedPoint?.locked) onProbePoint(null);
      return;
    }

    const uX = Math.max(0, Math.min(1, relX / plotW));
    const uY = Math.max(0, Math.min(1, relY / plotH));

    const numBins = params.detectorBins;
    const numAngles = sinogram.anglesDeg.length;

    const binIndex = Math.round(uX * (numBins - 1));
    const angleIndex = Math.round(uY * (numAngles - 1));
    const angleDeg = sinogram.anglesDeg[angleIndex] ?? 0;
    const sMm = sinogram.detectorCoordsMm[binIndex] ?? 0;
    const attenuation = sinogram.data[angleIndex]?.[binIndex] ?? 0;

    onProbePoint({
      angleIndex,
      angleDeg,
      binIndex,
      sMm,
      attenuation,
      locked: shouldLockAngle ? !probedPoint?.locked : Boolean(probedPoint?.locked),
    });

    if (shouldLockAngle) {
      onSelectAngle(angleDeg);
    }
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

    const { padLeft, padTop, plotW, plotH } = getPlotMetrics(width, height);

    // 1. Background
    ctx.fillStyle = isDark ? '#0B0F19' : '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // 2. Render 2D Sinogram Heatmap into an offscreen ImageData buffer for crisp pixel accuracy
    const numAngles = sinogram.anglesDeg.length;
    const numBins = params.detectorBins;

    if (numAngles > 0 && numBins > 0) {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = numBins;
      offCanvas.height = numAngles;
      const offCtx = offCanvas.getContext('2d');

      if (offCtx) {
        const imgData = offCtx.createImageData(numBins, numAngles);
        const buf = imgData.data;
        const maxVal = sinogram.globalMax;

        for (let aIdx = 0; aIdx < numAngles; aIdx++) {
          const angleDeg = sinogram.anglesDeg[aIdx];
          const isAcquired = angleDeg <= maxAcquiredAngleDeg + 0.01;
          const row = sinogram.data[aIdx];

          for (let bIdx = 0; bIdx < numBins; bIdx++) {
            const pIdx = (aIdx * numBins + bIdx) * 4;
            const norm = row[bIdx] / maxVal;
            const [r, g, b] = mapSinogramColor(norm, colormap);

            if (isAcquired) {
              buf[pIdx] = r;
              buf[pIdx + 1] = g;
              buf[pIdx + 2] = b;
              buf[pIdx + 3] = 255;
            } else if (showFullGhostSinogram) {
              // Subtle ghost preview of not-yet-swept rows
              buf[pIdx] = r;
              buf[pIdx + 1] = g;
              buf[pIdx + 2] = b;
              buf[pIdx + 3] = 48;
            } else {
              // Unacquired dark slate matrix background
              buf[pIdx] = isDark ? 13 : 226;
              buf[pIdx + 1] = isDark ? 19 : 232;
              buf[pIdx + 2] = isDark ? 33 : 240;
              buf[pIdx + 3] = 255;
            }
          }
        }
        offCtx.putImageData(imgData, 0, 0);

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offCanvas, padLeft, padTop, plotW, plotH);
        ctx.restore();
      }
    }

    // Border around sinogram matrix
    ctx.strokeStyle = isDark ? '#1E293B' : '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // 3. Coordinate Axes & Tick Labels
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isDark ? '#64748B' : '#475569';

    // Vertical Angle θ ticks (0° to maxAngleDeg)
    const angleSteps = 4;
    for (let i = 0; i <= angleSteps; i++) {
      const deg = (params.maxAngleDeg * i) / angleSteps;
      const y = padTop + (i / angleSteps) * plotH;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg.toFixed(0)}°`, padLeft - 6, y);
    }

    // Horizontal Detector s ticks (-100, -50, 0, +50, +100 mm)
    [-100, -50, 0, 50, 100].forEach((sVal) => {
      const u = (sVal + 100) / 200;
      const x = padLeft + u * plotW;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${sVal > 0 ? `+${sVal}` : sVal}`, x, padTop + plotH + 7);
    });

    // Center s = 0 vertical reference line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padLeft + plotW / 2, padTop);
    ctx.lineTo(padLeft + plotW / 2, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
    ctx.fillText('Detector Position s (mm)', padLeft + plotW / 2, height - 14);

    // 4. Optional Theoretical Sinusoidal Locus Curve s(θ) = x₀ cos θ + y₀ sin θ for Selected Object
    if (showSinusoidLocus && selectedPrim) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();

      for (let aIdx = 0; aIdx < numAngles; aIdx++) {
        const deg = sinogram.anglesDeg[aIdx];
        const sMm = computeTheoreticalSinusoidMm(
          selectedPrim.centerX,
          selectedPrim.centerY,
          deg,
          params
        );
        const uX = (sMm + 100) / 200;
        const uY = numAngles <= 1 ? 0 : aIdx / (numAngles - 1);
        const px = padLeft + uX * plotW;
        const py = padTop + uY * plotH;
        if (aIdx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5. Active Gantry Angle Horizontal Scanline (Current Projection Row Indicator)
    const activeAngleNorm = Math.max(
      0,
      Math.min(1, params.currentAngleDeg / params.maxAngleDeg)
    );
    const activeRowY = padTop + activeAngleNorm * plotH;

    ctx.save();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padLeft, activeRowY);
    ctx.lineTo(padLeft + plotW, activeRowY);
    ctx.stroke();

    // Glowing triangle marker on left edge of active scanline
    ctx.fillStyle = '#06B6D4';
    ctx.beginPath();
    ctx.moveTo(padLeft - 1, activeRowY);
    ctx.lineTo(padLeft + 7, activeRowY - 4);
    ctx.lineTo(padLeft + 7, activeRowY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 6. Probed (s, θ) Crosshair Marker
    if (probedPoint) {
      const uX =
        params.detectorBins <= 1
          ? 0.5
          : probedPoint.binIndex / (params.detectorBins - 1);
      const uY = Math.max(0, Math.min(1, probedPoint.angleDeg / params.maxAngleDeg));
      const px = padLeft + uX * plotW;
      const py = padTop + uY * plotH;

      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
      ctx.moveTo(padLeft, py);
      ctx.lineTo(padLeft + plotW, py);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [
    params,
    sinogram,
    primitives,
    selectedPrimitiveId,
    maxAcquiredAngleDeg,
    showFullGhostSinogram,
    showSinusoidLocus,
    colormap,
    probedPoint,
    isDark,
    selectedPrim,
  ]);

  // Compute polar coordinates (r0, phi0) of selected object for mathematical annotation
  const r0Mm = selectedPrim
    ? Math.hypot(selectedPrim.centerX, selectedPrim.centerY).toFixed(1)
    : '0.0';
  const phi0Deg = selectedPrim
    ? ((Math.atan2(selectedPrim.centerY, selectedPrim.centerX) * 180) / Math.PI).toFixed(0)
    : '0';

  return (
    <section className="flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>WINDOW 03</span>
            <span aria-hidden="true">·</span>
            <span>RADON DOMAIN R[μ](s, θ)</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Sinogram Matrix (0° → {params.maxAngleDeg}°)
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleSinusoidLocus}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showSinusoidLocus
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Overlay analytical sinusoidal trajectory s(θ) = x₀cosθ + y₀sinθ of selected object"
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>Locus s(θ)</span>
          </button>

          <button
            type="button"
            onClick={onToggleGhostSinogram}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showFullGhostSinogram
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Show faint preview of full sinogram behind progressive real-time scan"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ghost Ref</span>
          </button>

          <select
            aria-label="Sinogram Colormap"
            value={colormap}
            onChange={(e) => onChangeColormap(e.target.value as SinogramColormap)}
            className="px-2 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="clinical_cyan">Cyan Telemetry</option>
            <option value="grayscale">CT Grayscale</option>
            <option value="inferno">Inferno Thermal</option>
            <option value="viridis">Viridis Lab</option>
          </select>
        </div>
      </div>

      {/* 2D Sinogram Canvas */}
      <div className="relative flex-1 min-h-[310px] w-full select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={(e) => handlePointerEvent(e, false)}
          onPointerDown={(e) => handlePointerEvent(e, true)}
          onPointerLeave={() => {
            if (!probedPoint?.locked) onProbePoint(null);
          }}
          className="w-full h-full min-h-[310px] cursor-crosshair block"
        />

        {/* Top-Right Probe Status Overlay */}
        <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-0.5 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-mono">
          <div className="text-slate-700 dark:text-slate-200">
            Acquired:{' '}
            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
              {Math.round((maxAcquiredAngleDeg / params.maxAngleDeg) * 100)}%
            </span>{' '}
            ({ (maxAcquiredAngleDeg / params.angularStepDeg + 1).toFixed(0) }/{sinogram.anglesDeg.length} views)
          </div>
          {probedPoint ? (
            <div className="text-amber-600 dark:text-amber-400">
              Probe (s={probedPoint.sMm.toFixed(0)}mm, θ={probedPoint.angleDeg.toFixed(0)}°) →{' '}
              {probedPoint.attenuation.toFixed(2)}
            </div>
          ) : (
            <div className="text-slate-500 dark:text-slate-400">
              Click any sinogram row to jump gantry angle θ
            </div>
          )}
        </div>
      </div>

      {/* Footer Sinusoid Trajectory Formula */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080C14] px-4 py-2.5 flex items-center justify-between text-xs">
        {selectedPrim ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
            <span className="text-amber-600 dark:text-amber-400 font-semibold">
              s(θ) = {selectedPrim.centerX}·cosθ + ({selectedPrim.centerY})·sinθ
            </span>
            <span aria-hidden="true">·</span>
            <span>
              r₀ = {r0Mm} mm, φ₀ = {phi0Deg}°
            </span>
          </div>
        ) : (
          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Select an object in Window 01 to inspect its sinusoidal locus s(θ)
          </div>
        )}
        <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400 shrink-0">
          Matrix: {params.detectorBins} × {sinogram.anglesDeg.length}
        </span>
      </div>
    </section>
  );
};
