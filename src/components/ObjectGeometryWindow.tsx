import React, { useEffect, useRef, useState } from 'react';
import { Eye, Layers, Move } from 'lucide-react';
import {
  AcquisitionParams,
  PhantomPrimitive,
  ProbedSinogramPoint,
  ProjectionResult,
} from '../types/tomography';
import {
  ANATOMICAL_CONTOURS,
  computePartialVolumeWeight,
  computeSingleProjection,
  isPointInPrimitive,
  TISSUE_SPECS,
} from '../engine/radonEngine';
import { MathFormula } from './MathFormula';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zSlabContainerRef = useRef<HTMLDivElement | null>(null);
  const zSlabCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 400, h: 300 });
  const [zSlabSize, setZSlabSize] = useState<{ w: number; h: number }>({ w: 400, h: 52 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [hoverCoordsMm, setHoverCoordsMm] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const mainEl = containerRef.current;
    const zEl = zSlabContainerRef.current;
    if (!mainEl && !zEl) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.floor(width);
        const h = Math.floor(height);
        if (entry.target === mainEl && w > 0 && h > 0) {
          setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        } else if (entry.target === zEl && w > 0 && h > 0) {
          setZSlabSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        }
      }
    });

    if (mainEl) observer.observe(mainEl);
    if (zEl) observer.observe(zEl);
    return () => observer.disconnect();
  }, []);

  const canvasToMm = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const scale = Math.min(rect.width, rect.height) / 275;
    const xMm = (clientX - rect.left - cx) / scale;
    const yMm = (cy - (clientY - rect.top)) / scale;
    return { xMm, yMm };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { xMm, yMm } = canvasToMm(e.clientX, e.clientY, canvas);

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

  // Draw main 2D Gantry & Anatomical Object Geometry Canvas
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

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 275;

    const mmToPxX = (xMm: number) => cx + xMm * scale;
    const mmToPxY = (yMm: number) => cy - yMm * scale;

    // 1. Background fill
    ctx.fillStyle = isDark ? '#0B0F19' : '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // 2. Polar & Cartesian calibration grid
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.16)';
    ctx.lineWidth = 1;

    [50, 100].forEach((rMm, idx) => {
      ctx.beginPath();
      if (idx === 1) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
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

    // Axis degree labels in clean sans-serif
    ctx.fillStyle = isDark ? '#64748B' : '#475569';
    ctx.font = '600 10px "Plus Jakarta Sans", "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+x (0°)', mmToPxX(126), cy);
    ctx.fillText('+y (90°)', cx, mmToPxY(126));
    ctx.fillText('−x (180°)', mmToPxX(-126), cy);

    // 3. Draw Phantom & Anatomical Primitives
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

      const huNorm = Math.max(0, Math.min(1, (prim.hu + 1000) / 2400));
      const lum = Math.round(18 + huNorm * 225);
      const alpha = 0.3 + 0.66 * Math.max(0.15, pvWeight);

      ctx.fillStyle = `rgba(${lum}, ${lum}, ${Math.min(255, lum + 10)}, ${alpha.toFixed(2)})`;
      const isSelected = prim.id === selectedPrimitiveId;
      const spec = TISSUE_SPECS[prim.tissueType];

      ctx.strokeStyle = isSelected
        ? '#F59E0B'
        : pvWeight < 0.99
          ? '#38BDF8'
          : spec?.strokeHex || '#94A3B8';
      ctx.lineWidth = isSelected ? 2.2 : 1.3;

      const rxPx = Math.max(2, prim.radiusX * scale);
      const ryPx = Math.max(2, prim.radiusY * scale);

      ctx.beginPath();
      if (prim.shape === 'ellipse') {
        ctx.ellipse(0, 0, rxPx, ryPx, 0, 0, Math.PI * 2);
      } else if (prim.shape === 'rectangle') {
        ctx.rect(-rxPx, -ryPx, rxPx * 2, ryPx * 2);
      } else {
        const contour = ANATOMICAL_CONTOURS[prim.shape];
        if (contour && contour.length > 0) {
          for (let i = 0; i < contour.length; i++) {
            const px = contour[i][0] * rxPx;
            const py = -contour[i][1] * ryPx; // flip Y so +Y is anterior (up)
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
      }
      ctx.fill();
      ctx.stroke();

      // Draw authentic internal anatomical details (bronchial/vascular trees, cerebral sulci, spinal canal)
      if (prim.shape === 'lung_right' || prim.shape === 'lung_left') {
        const sign = prim.shape === 'lung_right' ? -1 : 1;
        ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.4)';
        ctx.lineWidth = 1;
        // Oblique fissure & vascular tree branches from hilum
        ctx.beginPath();
        ctx.moveTo(sign * -0.25 * rxPx, 0);
        ctx.quadraticCurveTo(sign * 0.25 * rxPx, -0.2 * ryPx, sign * 0.62 * rxPx, -0.58 * ryPx);
        ctx.moveTo(sign * 0.1 * rxPx, -0.15 * ryPx);
        ctx.lineTo(sign * 0.55 * rxPx, -0.18 * ryPx);
        ctx.moveTo(sign * -0.25 * rxPx, 0);
        ctx.quadraticCurveTo(sign * 0.28 * rxPx, 0.22 * ryPx, sign * 0.6 * rxPx, 0.56 * ryPx);
        ctx.moveTo(sign * 0.15 * rxPx, 0.18 * ryPx);
        ctx.lineTo(sign * 0.52 * rxPx, 0.25 * ryPx);
        ctx.stroke();
      } else if (prim.shape === 'brain_left' || prim.shape === 'brain_right') {
        const sign = prim.shape === 'brain_left' ? -1 : 1;
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.38)' : 'rgba(71, 85, 105, 0.38)';
        ctx.lineWidth = 1;
        // Cortical sulci infoldings
        [-0.55, -0.25, 0.15, 0.48].forEach((yNorm, idx) => {
          ctx.beginPath();
          const xOuter = sign * (0.85 - Math.abs(yNorm) * 0.32) * rxPx;
          const xInner = sign * (0.48 - (idx % 2) * 0.12) * rxPx;
          ctx.moveTo(xOuter, yNorm * ryPx);
          ctx.quadraticCurveTo(
            (xOuter + xInner) * 0.5,
            (yNorm + 0.06) * ryPx,
            xInner,
            (yNorm - 0.04) * ryPx
          );
          ctx.stroke();
        });
      } else if (prim.shape === 'vertebra') {
        // Central spinal canal foramen inside the vertebra
        ctx.fillStyle = isDark ? '#0F172A' : '#CBD5E1';
        ctx.beginPath();
        ctx.ellipse(0, 0.06 * ryPx, 0.22 * rxPx, 0.18 * ryPx, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (prim.shape === 'heart' && prim.tissueType === 'soft_tissue') {
        // Subtle coronary sulcus & interventricular septum contour
        ctx.strokeStyle = isDark ? 'rgba(248, 250, 252, 0.22)' : 'rgba(15, 23, 42, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-0.15 * rxPx, -0.55 * ryPx);
        ctx.quadraticCurveTo(0.05 * rxPx, 0, 0.35 * rxPx, 0.55 * ryPx);
        ctx.stroke();
      }

      if (isSelected) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Selected polar vector
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

    // 4. Draw X-Ray Beam Paths & Detector Array
    const rays = currentProjection.rays;
    const maxAtten = Math.max(0.5, currentProjection.maxAttenuation);

    if (showRayLines && rays.length > 0) {
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

    // 5. Source Bar / Focal Spot & Detector Array
    const thetaRad = (params.currentAngleDeg * Math.PI) / 180;
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);
    const dirX = -sinT;
    const dirY = cosT;

    if (params.beamMode === 'parallel') {
      const srcCenterX = -118 * dirX;
      const srcCenterY = -118 * dirY;
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(mmToPxX(srcCenterX - 100 * cosT), mmToPxY(srcCenterY - 100 * sinT));
      ctx.lineTo(mmToPxX(srcCenterX + 100 * cosT), mmToPxY(srcCenterY + 100 * sinT));
      ctx.stroke();

      const detCenterX = 118 * dirX;
      const detCenterY = 118 * dirY;
      ctx.strokeStyle = isDark ? '#94A3B8' : '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mmToPxX(detCenterX - 100 * cosT), mmToPxY(detCenterY - 100 * sinT));
      ctx.lineTo(mmToPxX(detCenterX + 100 * cosT), mmToPxY(detCenterY + 100 * sinT));
      ctx.stroke();

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
          const heightMm = (r.attenuation / maxAtten) * 16;
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
      const dSoVisual = 122;
      const sx = -dSoVisual * dirX;
      const sy = -dSoVisual * dirY;

      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(mmToPxX(sx), mmToPxY(sy), 6, 0, Math.PI * 2);
      ctx.fill();

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

    // 6. Probed single ray highlight
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

        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(mmToPxX(probeRay.x2), mmToPxY(probeRay.y2), 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [
    canvasSize,
    primitives,
    params,
    currentProjection,
    selectedPrimitiveId,
    probedPoint,
    isDark,
    showRayLines,
  ]);

  // Draw companion Axial Z-Slab Cross-Section Diagram
  useEffect(() => {
    const canvas = zSlabCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = zSlabSize.w;
    const height = zSlabSize.h;
    if (width <= 0 || height <= 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = isDark ? '#080C14' : '#F1F5F9';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const xScale = (width - 80) / 200;
    const zScale = (height - 12) / 26;

    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, cy);
    ctx.lineTo(width - 40, cy);
    ctx.stroke();

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

    ctx.fillStyle = isDark ? '#94A3B8' : '#475569';
    ctx.font = '600 9.5px "Plus Jakarta Sans", "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Z-Slab', 6, 12);
    ctx.fillStyle = '#06B6D4';
    ctx.fillText(`Δz = ${params.sliceThicknessMm.toFixed(1)}`, 6, height - 6);
  }, [zSlabSize, primitives, params.sliceThicknessMm, params.sliceZOffsetMm, selectedPrimitiveId, isDark]);

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
    <section className="flex flex-col h-full w-full min-h-0 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Window Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Window 01</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">
              Spatial Domain <MathFormula tex="\mu(x, y, z)" />
            </span>
          </div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            Object &amp; Projection Geometry
          </h2>
        </div>

        <button
          type="button"
          onClick={onToggleRayLines}
          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
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

      {/* Interactive 2D Gantry Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full select-none overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => setHoverCoordsMm(null)}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing block"
        />

        {/* Top-left live gantry telemetry overlay */}
        <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-0.5 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xs px-2.5 py-1 rounded-md border border-slate-200/80 dark:border-slate-800/80 text-xs tabular-nums">
          <div className="text-slate-900 dark:text-slate-100 font-semibold flex items-center gap-1.5">
            <MathFormula tex={`\\theta = ${params.currentAngleDeg.toFixed(1)}^\\circ`} />
            <span className="text-slate-400 dark:text-slate-500">·</span>
            <span className="text-cyan-600 dark:text-cyan-400 capitalize">{params.beamMode}-Beam</span>
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-[11px]">
            {hoverCoordsMm
              ? `(${hoverCoordsMm.x} mm, ${hoverCoordsMm.y} mm)`
              : 'Drag any anatomical organ to reposition'}
          </div>
        </div>

        {/* Selected Primitive Mini Readout */}
        {selectedPrim && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-xs px-2.5 py-1 rounded-md border border-amber-500/40 text-xs tabular-nums">
            <div className="flex items-center gap-1.5 truncate">
              <Move className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {selectedPrim.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
              <span>
                ({selectedPrim.centerX}, {selectedPrim.centerY}) mm
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedPrim.hu} HU</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                PV: {Math.round((selectedPvWeight ?? 1) * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Companion Axial Slice Thickness (Z-Slab) Cross Section */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080C14] px-3 py-1.5 shrink-0">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 tabular-nums">
          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
            <Layers className="w-3 h-3 text-cyan-500" />
            Axial Collimation (<MathFormula tex="x\text{--}z" /> Plane)
          </span>
          <span>
            <MathFormula tex={`\\Delta z = ${params.sliceThicknessMm.toFixed(1)}\\text{ mm}`} /> ·{' '}
            <MathFormula
              tex={`z_0 = ${
                params.sliceZOffsetMm >= 0
                  ? `+${params.sliceZOffsetMm.toFixed(1)}`
                  : params.sliceZOffsetMm.toFixed(1)
              }\\text{ mm}`}
            />
          </span>
        </div>
        <div
          ref={zSlabContainerRef}
          className="relative w-full h-[46px] rounded border border-slate-200/70 dark:border-slate-800/80 overflow-hidden"
        >
          <canvas ref={zSlabCanvasRef} className="absolute inset-0 w-full h-full block" />
        </div>
      </div>
    </section>
  );
};
