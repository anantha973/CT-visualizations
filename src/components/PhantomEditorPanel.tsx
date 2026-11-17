import React from 'react';
import { Eye, EyeOff, Plus, RotateCcw, Sliders, Trash2 } from 'lucide-react';
import {
  PhantomPreset,
  PhantomPrimitive,
  PrimitiveShape,
  TissueType,
} from '../types/tomography';
import { huToMu, PHANTOM_PRESETS, TISSUE_SPECS } from '../engine/radonEngine';
import { MathFormula } from './MathFormula';

interface PhantomEditorPanelProps {
  activePresetId: string;
  onSelectPreset: (preset: PhantomPreset) => void;
  onResetPreset: () => void;
  primitives: PhantomPrimitive[];
  selectedPrimitiveId: string | null;
  onSelectPrimitive: (id: string | null) => void;
  onUpdatePrimitive: (id: string, patch: Partial<PhantomPrimitive>) => void;
  onAddPrimitive: (shape: PrimitiveShape) => void;
  onDeletePrimitive: (id: string) => void;
}

const SHAPE_LABELS: Record<PrimitiveShape, string> = {
  heart: 'Anatomical Heart',
  lung_right: 'Anatomical Right Lung',
  lung_left: 'Anatomical Left Lung (Cardiac Notch)',
  brain_left: 'Left Cerebral Hemisphere (Gyri)',
  brain_right: 'Right Cerebral Hemisphere (Gyri)',
  brain_ventricle: 'Butterfly Lateral Ventricles',
  vertebra: 'Thoracic Vertebra (Spinous Process)',
  ellipse: 'Elliptical Cylinder',
  rectangle: 'Rectangular Bar',
};

export const PhantomEditorPanel: React.FC<PhantomEditorPanelProps> = ({
  activePresetId,
  onSelectPreset,
  onResetPreset,
  primitives,
  selectedPrimitiveId,
  onSelectPrimitive,
  onUpdatePrimitive,
  onAddPrimitive,
  onDeletePrimitive,
}) => {
  const activePreset =
    PHANTOM_PRESETS.find((p) => p.id === activePresetId) || PHANTOM_PRESETS[0];
  const selectedPrim =
    primitives.find((p) => p.id === selectedPrimitiveId) || primitives[0] || null;

  const handleTissueChange = (primId: string, tissueType: TissueType) => {
    const spec = TISSUE_SPECS[tissueType];
    onUpdatePrimitive(primId, {
      tissueType,
      hu: spec.defaultHu,
      mu: spec.muCmInv,
    });
  };

  const handleHuChange = (primId: string, newHu: number) => {
    onUpdatePrimitive(primId, {
      hu: newHu,
      mu: huToMu(newHu),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      {/* Left 4 cols: Preset Selector & Pedagogical Context */}
      <div className="lg:col-span-4 flex flex-col justify-between gap-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-4 lg:pb-0 lg:pr-5">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
              01. Anatomical &amp; Physics Phantoms
            </span>
            <button
              type="button"
              onClick={onResetPreset}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Organ Positions</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {PHANTOM_PRESETS.map((preset) => {
              const isSelected = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-slate-900 dark:text-slate-100'
                      : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{preset.name}</span>
                    <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 tabular-nums shrink-0">
                      {preset.primitives.length} structures
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {preset.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clinical / Physics Takeaway Box */}
        <div className="bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Tomographic Observation
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {activePreset.pedagogicalTakeaway}
          </p>
        </div>
      </div>

      {/* Middle 4 cols: Organ / Structure Layer List & Quick Add Controls */}
      <div className="lg:col-span-4 flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 pb-4 lg:pb-0 lg:pr-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
            02. Anatomical Structures ({primitives.length})
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onAddPrimitive('heart')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Heart</span>
            </button>
            <button
              type="button"
              onClick={() => onAddPrimitive('lung_left')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Lung</span>
            </button>
            <button
              type="button"
              onClick={() => onAddPrimitive('brain_left')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Brain</span>
            </button>
            <button
              type="button"
              onClick={() => onAddPrimitive('ellipse')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Lesion</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 max-h-[290px] overflow-y-auto pr-1">
          {primitives.map((prim) => {
            const isSelected = prim.id === selectedPrim?.id;
            return (
              <div
                key={prim.id}
                onClick={() => onSelectPrimitive(prim.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 text-slate-900 dark:text-slate-100'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate">{prim.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{prim.hu >= 0 ? `+${prim.hu}` : prim.hu} HU</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <MathFormula tex={`\\mu = ${prim.mu.toFixed(3)}\\text{ cm}^{-1}`} />
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <MathFormula tex={`dz = ${prim.zThicknessMm}\\text{ mm}`} />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdatePrimitive(prim.id, { visible: !prim.visible });
                    }}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                    title={prim.visible ? 'Hide Organ' : 'Show Organ'}
                  >
                    {prim.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                  {primitives.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePrimitive(prim.id);
                      }}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete Organ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 4 cols: Selected Organ Density (HU / μ) & Spatial Geometry Inspector */}
      <div className="lg:col-span-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
            03. Selected Organ Parameters
          </span>
          {selectedPrim && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {SHAPE_LABELS[selectedPrim.shape]}
            </span>
          )}
        </div>

        {selectedPrim ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Organ / Structure Name
                </label>
                <input
                  type="text"
                  value={selectedPrim.label}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, { label: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Anatomical Contour
                </label>
                <select
                  value={selectedPrim.shape}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, {
                      shape: e.target.value as PrimitiveShape,
                    })
                  }
                  className="w-full px-2 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {Object.entries(SHAPE_LABELS).map(([shapeKey, label]) => (
                    <option key={shapeKey} value={shapeKey}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tissue Material
                </label>
                <select
                  value={selectedPrim.tissueType}
                  onChange={(e) =>
                    handleTissueChange(selectedPrim.id, e.target.value as TissueType)
                  }
                  className="w-full px-2 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {Object.values(TISSUE_SPECS).map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.label} ({spec.defaultHu >= 0 ? `+${spec.defaultHu}` : spec.defaultHu} HU)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Density / Hounsfield Unit Slider */}
            <div className="bg-slate-50 dark:bg-[#0B0F19] p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1 tabular-nums">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Radiodensity &amp; Linear Attenuation (<MathFormula tex="\mu" />)
                </span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                  {selectedPrim.hu >= 0 ? `+${selectedPrim.hu}` : selectedPrim.hu} HU ·{' '}
                  <MathFormula tex={`\\mu = ${selectedPrim.mu.toFixed(3)}\\text{ cm}^{-1}`} />
                </span>
              </div>
              <input
                type="range"
                min={-1000}
                max={2400}
                step={10}
                value={selectedPrim.hu}
                onChange={(e) => handleHuChange(selectedPrim.id, Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-0.5 tabular-nums">
                <span>Air (−1000 HU)</span>
                <span>Water (0 HU)</span>
                <span>Bone (+1000 HU)</span>
                <span>Plaque (+2400 HU)</span>
              </div>
            </div>

            {/* Spatial & Axial Sliders */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 tabular-nums">
              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Center <MathFormula tex="x_0" />
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedPrim.centerX} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={-75}
                  max={75}
                  step={1}
                  value={selectedPrim.centerX}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, { centerX: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Center <MathFormula tex="y_0" />
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedPrim.centerY} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={-75}
                  max={75}
                  step={1}
                  value={selectedPrim.centerY}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, { centerY: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Width Scale (<MathFormula tex="a" />)
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedPrim.radiusX} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={90}
                  step={0.5}
                  value={selectedPrim.radiusX}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, { radiusX: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Height Scale (<MathFormula tex="b" />)
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedPrim.radiusY} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={90}
                  step={0.5}
                  value={selectedPrim.radiusY}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, { radiusY: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    In-Plane Orientation (<MathFormula tex="\alpha" />)
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedPrim.tiltDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={1}
                  value={selectedPrim.tiltDeg}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, { tiltDeg: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Axial Slab Depth (<MathFormula tex="dz" />)
                  </span>
                  <span className="font-medium text-cyan-600 dark:text-cyan-400">
                    {selectedPrim.zThicknessMm.toFixed(1)} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={24.0}
                  step={0.5}
                  value={selectedPrim.zThicknessMm}
                  onChange={(e) =>
                    onUpdatePrimitive(selectedPrim.id, {
                      zThicknessMm: Number(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 text-xs">
            <Sliders className="w-6 h-6 mb-2 text-slate-400" />
            Select any organ from the list or click directly inside Window 01 to edit its density and anatomical geometry.
          </div>
        )}
      </div>
    </div>
  );
};
