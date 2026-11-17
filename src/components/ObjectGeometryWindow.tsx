import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Eye, Layers, Move } from 'lucide-react';
import {
  AcquisitionParams,
  PhantomPrimitive,
  ProbedSinogramPoint,
  ProjectionResult,
} from '../types/tomography';
import {
  computePartialVolumeWeight,
  computeSingleProjection,
  isPointInPrimitive,
  TISSUE_SPECS,
} from '../engine/radonEngine';

interface ObjectGeometryWindowProps {
  primitives: PhantomPrimitive[];
  params: AcquisitionParams;
  currentProjection: ProjectionResult;
  selectedPrimitiveId: string | null;
  onSelectPrimitive: (id: string | null) => void;
  onUpdatePrimitivePosition: (id: string, centerX: number, centerY: number) => void;
  probedPoint: ProbedSinogramPoint | null;
  isDark: boolean;
  showRayLines: boolean;
  onToggleRayLines: () => void;
}

export const ObjectGeometryWindow: React.FC<ObjectGeometryWindowProps> = ({
  primitives,
  params,
  currentProjection,
  selectedPrimitiveId,
  onSelectPrimitive,
  onUpdatePrimitivePosition,
  probedPoint,
  isDark,
  showRayLines,
  onToggleRayLines,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zSlabCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [hoverCoordsMm, setHoverCoordsMm] = useState<{ x: number; y: number } | null>(null);

  // Convert canvas pixel coordinates to phantom mm coordinates [-135, +135]
  const canvasToMm = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;
    const worldSpan = 270; // [-135mm, +135mm]
    const xMm = (normX - 0.5) * worldSpan;
    const yMm = (0.5 - normY) * worldSpan; // +Y is up (anterior)
    return { xMm, yMm };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { xMm, yMm } = canvasToMm(e.clientX, e.clientY, canvas);

    // Hit-test primitives from smallest area to largest area so inner inclusions are easy to grab
    const sorted = [...primitives]
      .filter((p) => p.visible)
      .sort((a, b) => a.radiusX * a.radiusY - b.radiusX * b.radiusY);

    for (const prim of sorted) {
      if (isPointInPrimitive(xMm, yMm, prim)) {
        onSelectPrimitive(prim.id);
        setDraggingId(prim.id);
        setDragOffset({ dx: xMm - prim.centerX, dy: yMm - prim.centerY });
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { xMm, yMm } = canvasToMm(e.clientX, e.clientY, canvas);
    setHoverCoordsMm({ x: Math.round(xMm), y: Math.round(yMm) });

    if (draggingId) {
      const clampedX = Math.max(-78, Math.min(78, Math.round(xMm - dragOffset.dx)));
      const clampedY = Math.max(-78, Math.min(78, Math.round(yMm - dragOffset.dy)));
      onUpdatePrimitivePosition(draggingId, clampedX, clampedY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingId) {
      setDraggingId(null);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Draw main 2D Gantry & Object Geometry Canvas
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

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 275; // 1 mm -> pixels

    const mmToPxX = (xMm: number) => cx + xMm * scale;
    const mmToPxY = (yMm: number) => cy - yMm * scale;

    // 1. Background fill
    ctx.fillStyle = isDark ? '#0B0F19' : '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // 2. Polar & Cartesian calibration grid
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.16)';
    ctx.lineWidth = 1;

    // Concentric FOV rings at r = 50mm and r = 100mm (FOV boundary)
    [50, 100].forEach((rMm, idx) => {
      ctx.beginPath();
      if (idx === 1) {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.arc(cx, cy, rMm * scale, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Outer Gantry Ring at r = 118mm
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, 118 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair axes x = 0, y = 0
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(100, 116, 139, 0.18)';
    ctx.beginPath();
    ctx.moveTo(mmToPxX(-115), cy);
    ctx.lineTo(mmToPxX(115), cy);
    ctx.moveTo(cx, mmToPxY(-115));
    ctx.lineTo(cx, mmToPxY(115));
    ctx.stroke();

    // Axis degree labels on gantry ring
    ctx.fillStyle = isDark ? '#64748B' : '#475569';
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+X (0°)', mmToPxX(127), cy);
    ctx.fillText('+Y (90°)', cx, mmToPxY(127));
    ctx.fillText('-X (180°)', mmToPxX(-127), cy);

    // 3. Draw Phantom Primitives (sorted largest to smallest so inner inclusions render on top)
    const sortedPrims = [...primitives]
      .filter((p) => p.visible)
      .sort((a, b) => b.radiusX * b.radiusY - a.radiusX * a.radiusY);

    for (const prim of sortedPrims) {
      const pvWeight = computePartialVolumeWeight(
        params.sliceThicknessMm,
        params.sliceZOffsetMm,
        prim.zCenterMm,
        prim.zThicknessMm
      );

      ctx.save();
      ctx.translate(mmToPxX(prim.centerX), mmToPxY(prim.centerY));
      ctx.rotate((-prim.tiltDeg * Math.PI) / 180);

      // Map Hounsfield Units (-1000 to +2000) to grayscale clinical CT luminance
      const huNorm = Math.max(0, Math.min(1, (prim.hu + 1000) / 2400));
      const lum = Math.round(18 + huNorm * 225);
      // Modulate alpha slightly if partial volume overlap is < 100%
      const alpha = 0.25 + 0.7 * Math.max(0.15, pvWeight);

      ctx.fillStyle = `rgba(${lum}, ${lum}, ${Math.min(255, lum + 8)}, ${alpha.toFixed(2)})`;
      const isSelected = prim.id === selectedPrimitiveId;
      const spec = TISSUE_SPECS[prim.tissueType];

      ctx.strokeStyle = isSelected
        ? '#F59E0B'
        : pvWeight < 0.99
          ? '#38BDF8'
          : spec?.strokeHex || '#94A3B8';
      ctx.lineWidth = isSelected ? 2.2 : 1.2;

      const rxPx = Math.max(2, prim.radiusX * scale);
      const ryPx = Math.max(2, prim.radiusY * scale);

      ctx.beginPath();
      if (prim.shape === 'ellipse') {
        ctx.ellipse(0, 0, rxPx, ryPx, 0, 0, Math.PI * 2);
      } else {
        ctx.rect(-rxPx, -ryPx, rxPx * 2, ryPx * 2);
      }
      ctx.fill();
      ctx.stroke();

      // If selected, draw center reticle and polar radius line
      if (isSelected) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // If a primitive is selected, draw dashed polar vector from isocenter (0,0) to (x0, y0)
    const selectedPrim = primitives.find((p) => p.id === selectedPrimitiveId && p.visible);
    if (selectedPrim && (Math.abs(selectedPrim.centerX) > 1 || Math.abs(selectedPrim.centerY) > 1)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mmToPxX(selectedPrim.centerX), mmToPxY(selectedPrim.centerY));
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw X-Ray Beam Paths & Detector Array for Current Gantry Angle
    const rays = currentProjection.rays;
    const maxAtten = Math.max(0.5, currentProjection.maxAttenuation);

    if (showRayLines && rays.length > 0) {
      // Sample ~32 rays visually so canvas remains crisp even at 256 bins
      const stride = Math.max(1, Math.floor(rays.length / 36));
      for (let i = 0; i < rays.length; i += stride) {
        const r = rays[i];
        const normAtten = Math.min(1, r.attenuation / maxAtten);
        ctx.strokeStyle = isDark
          ? `rgba(6, 182, 212, ${(0.12 + 0.35 * normAtten).toFixed(2)})`
          : `rgba(2, 132, 199, ${(0.14 + 0.38 * normAtten).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mmToPxX(r.x1), mmToPxY(r.y1));
        ctx.lineTo(mmToPxX(r.x2), mmToPxY(r.y2));
        ctx.stroke();
      }
    }

    // 5. Draw Source Bar / Focal Spot and Opposite Detector Array with Live Projection Profile
    const thetaRad = (params.currentAngleDeg * Math.PI) / 180;
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);
    const dirX = -sinT;
    const dirY = cosT;

    if (params.beamMode === 'parallel') {
      // Source Emitter Bar at -118mm along dir
      const srcCenterX = -118 * dirX;
      const srcCenterY = -118 * dirY;
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(mmToPxX(srcCenterX - 100 * cosT), mmToPxY(srcCenterY - 100 * sinT));
      ctx.lineTo(mmToPxX(srcCenterX + 100 * cosT), mmToPxY(srcCenterY + 100 * sinT));
      ctx.stroke();

      // Detector Array Bar at +118mm along dir
      const detCenterX = 118 * dirX;
      const detCenterY = 118 * dirY;
      ctx.strokeStyle = isDark ? '#94A3B8' : '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mmToPxX(detCenterX - 100 * cosT), mmToPxY(detCenterY - 100 * sinT));
      ctx.lineTo(mmToPxX(detCenterX + 100 * cosT), mmToPxY(detCenterY + 100 * sinT));
      ctx.stroke();

      // Draw miniature elevated attenuation shadow curve directly behind the detector bar!
      ctx.strokeStyle = '#06B6D4';
      ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const firstRay = rays[0];
      if (firstRay) {
        ctx.moveTo(
          mmToPxX(detCenterX + firstRay.sMm * cosT),
          mmToPxY(detCenterY + firstRay.sMm * sinT)
        );
        for (let i = 0; i < rays.length; i++) {
          const r = rays[i];
          const heightMm = (r.attenuation / maxAtten) * 18;
          const px = mmToPxX(detCenterX + r.sMm * cosT + heightMm * dirX);
          const py = mmToPxY(detCenterY + r.sMm * sinT + heightMm * dirY);
          ctx.lineTo(px, py);
        }
        const lastRay = rays[rays.length - 1];
        ctx.lineTo(
          mmToPxX(detCenterX + lastRay.sMm * cosT),
          mmToPxY(detCenterY + lastRay.sMm * sinT)
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      // Fan-Beam Source Focal Spot
      const dSoVisual = 122; // Clamped slightly outside gantry ring so focal spot is always visible
      const sx = -dSoVisual * dirX;
      const sy = -dSoVisual * dirY;

      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(mmToPxX(sx), mmToPxY(sy), 6, 0, Math.PI * 2);
      ctx.fill();

      // Detector Arc on opposite side
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < rays.length; i++) {
        const r = rays[i];
        if (i === 0) ctx.moveTo(mmToPxX(r.x2), mmToPxY(r.y2));
        else ctx.lineTo(mmToPxX(r.x2), mmToPxY(r.y2));
      }
      ctx.stroke();
    }

    // 6. If user is probing a specific (s, θ) point in the Sinogram or Projection window, highlight that exact ray!
    if (probedPoint) {
      const probeProj =
        Math.abs(probedPoint.angleDeg - params.currentAngleDeg) < 0.01
          ? currentProjection
          : computeSingleProjection(primitives, params, probedPoint.angleDeg);
      const probeRay =
        probeProj.rays[Math.min(probeProj.rays.length - 1, Math.max(0, probedPoint.binIndex))];

      if (probeRay) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(mmToPxX(probeRay.x1), mmToPxY(probeRay.y1));
        ctx.lineTo(mmToPxX(probeRay.x2), mmToPxY(probeRay.y2));
        ctx.stroke();

        // Draw detector hit dot
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(mmToPxX(probeRay.x2), mmToPxY(probeRay.y2), 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    primitives,
    params,
    currentProjection,
    selectedPrimitiveId,
    probedPoint,
    isDark,
    showRayLines,
  ]);

  // Draw companion Axial Z-Slab Cross-Section Diagram (illustrating Slice Thickness Δz & Partial Volume)
  useEffect(() => {
    const canvas = zSlabCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 420;
    const height = canvas.clientHeight || 68;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = isDark ? '#080C14' : '#F1F5F9';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const xScale = (width - 80) / 200; // [-100mm, +100mm]
    const zScale = (height - 16) / 26; // [-13mm, +13mm]

    // Draw center z = 0 axis line
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, cy);
    ctx.lineTo(width - 40, cy);
    ctx.stroke();

    // Draw primitives in (x, z) cross-section
    const visiblePrims = primitives.filter((p) => p.visible);
    for (const prim of visiblePrims) {
      const px = cx + prim.centerX * xScale;
      const rw = Math.max(3, prim.radiusX * xScale);
      const pz = cy - prim.zCenterMm * zScale;
      const rh = Math.max(2, (prim.zThicknessMm / 2) * zScale);

      const isSelected = prim.id === selectedPrimitiveId;
      ctx.fillStyle = isSelected
        ? 'rgba(245, 158, 11, 0.45)'
        : isDark
          ? 'rgba(148, 163, 184, 0.28)'
          : 'rgba(71, 85, 105, 0.25)';
      ctx.strokeStyle = isSelected
        ? '#F59E0B'
        : isDark
          ? 'rgba(226, 232, 240, 0.45)'
          : 'rgba(51, 65, 85, 0.5)';
      ctx.lineWidth = isSelected ? 1.5 : 1;

      ctx.beginPath();
      ctx.rect(px - rw, pz - rh, rw * 2, rh * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw active Collimated X-Ray Slice Slab [z0 - Δz/2, z0 + Δz/2]
    const slabCenterY = cy - params.sliceZOffsetMm * zScale;
    const slabHalfH = Math.max(1.5, (params.sliceThicknessMm / 2) * zScale);

    ctx.fillStyle = 'rgba(6, 182, 212, 0.18)';
    ctx.fillRect(32, slabCenterY - slabHalfH, width - 64, slabHalfH * 2);

    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(32, slabCenterY - slabHalfH);
    ctx.lineTo(width - 32, slabCenterY - slabHalfH);
    ctx.moveTo(32, slabCenterY + slabHalfH);
    ctx.lineTo(width - 32, slabCenterY + slabHalfH);
    ctx.stroke();

    // Labels
    ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Z-SLAB', 6, 14);
    ctx.fillStyle = '#06B6D4';
    ctx.fillText(`Δz=${params.sliceThicknessMm.toFixed(1)}mm`, 6, height - 8);
  }, [primitives, params.sliceThicknessMm, params.sliceZOffsetMm, selectedPrimitiveId, isDark]);

  const selectedPrim = primitives.find((p) => p.id === selectedPrimitiveId);
  const selectedPvWeight = selectedPrim
    ? computePartialVolumeWeight(
        params.sliceThicknessMm,
        params.sliceZOffsetMm,
        selectedPrim.zCenterMm,
        selectedPrim.zThicknessMm
      )
    : null;

  return (
    <section className="flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>WINDOW 01</span>
            <span aria-hidden="true">·</span>
            <span>SPATIAL DOMAIN μ(x, y, z)</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Object &amp; Projection Geometry
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleRayLines}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showRayLines
                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title="Toggle X-Ray Beam Lines"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Rays</span>
          </button>
        </div>
      </div>

      {/* Interactive 2D Gantry Canvas */}
      <div className="relative flex-1 min-h-[310px] w-full select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoverCoordsMm(null)}
          className="w-full h-full min-h-[310px] cursor-grab active:cursor-grabbing block"
        />

        {/* Top-left live gantry telemetry overlay */}
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-0.5 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-800/80 text-xs font-mono">
          <div className="text-slate-900 dark:text-slate-100 font-semibold">
            θ = {params.currentAngleDeg.toFixed(1)}°
            <span className="text-slate-400 dark:text-slate-500 mx-1.5">·</span>
            <span className="text-cyan-600 dark:text-cyan-400 uppercase">{params.beamMode}</span>
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-[11px]">
            {hoverCoordsMm
              ? `Cursor: (${hoverCoordsMm.x} mm, ${hoverCoordsMm.y} mm)`
              : 'Drag any phantom inclusion to move'}
          </div>
        </div>

        {/* Selected Primitive Mini Readout */}
        {selectedPrim && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-xs px-3 py-1.5 rounded-md border border-amber-500/40 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Move className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {selectedPrim.label}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
              <span>
                ({selectedPrim.centerX}, {selectedPrim.centerY}) mm
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedPrim.hu} HU</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-600 dark:text-cyan-400">
                PV: {Math.round((selectedPvWeight ?? 1) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Companion Axial Slice Thickness (Z-Slab) Cross Section */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080C14] px-3 py-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            Axial Collimation Cross-Section (X–Z Plane)
          </span>
          <span className="font-mono">
            Collimator Δz = {params.sliceThicknessMm.toFixed(1)} mm · z₀ ={' '}
            {params.sliceZOffsetMm >= 0 ? `+${params.sliceZOffsetMm.toFixed(1)}` : params.sliceZOffsetMm.toFixed(1)} mm
          </span>
        </div>
        <canvas ref={zSlabCanvasRef} className="w-full h-[64px] rounded border border-slate-200/70 dark:border-slate-800/80 block" />
      </div>
    </section>
  );
};
