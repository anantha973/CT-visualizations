import React from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';

interface RadonMathGuideProps {
  onApplyLabScenario: (scenarioId: 'sinusoid' | 'partial_volume' | 'fan_vs_parallel' | 'anisotropy') => void;
}

export const RadonMathGuide: React.FC<RadonMathGuideProps> = ({ onApplyLabScenario }) => {
  const concepts = [
    {
      index: '01',
      title: 'Beer-Lambert Attenuation & The Radon Line Integral',
      formula: 'p_θ(s) = -ln( I(s,θ) / I₀ ) = ∫∫ μ(x,y) δ(x cosθ + y sinθ - s) dx dy',
      summary:
        'An X-ray beam passing through heterogeneous tissue undergoes exponential photon attenuation governed by the linear attenuation coefficient μ(x,y) [cm⁻¹]. Taking the negative natural logarithm of the transmitted intensity ratio converts multiplicative photon survival into a linear path integral along the ray L(s,θ). Each horizontal row of the CT sinogram is literally this 1D detector profile p_θ(s) recorded at gantry angle θ.',
      scenarioId: 'sinusoid' as const,
      scenarioButton: 'Load Point-Source Sinusoid Lab',
    },
    {
      index: '02',
      title: 'Sinusoidal Trajectories in Radon Space',
      formula: 's(θ) = x₀ cosθ + y₀ sinθ = r₀ cos(θ - φ₀)',
      summary:
        'Why is it called a "Sinogram"? A compact object located at Cartesian coordinate (x₀, y₀)—or polar coordinate (r₀, φ₀)—projects onto detector channel s(θ) = x₀ cosθ + y₀ sinθ as the gantry rotates. Objects at the gantry isocenter (r₀ = 0) trace a straight vertical column at s = 0, whereas peripheral objects trace sinusoids whose amplitude equals their radial offset r₀ and whose phase encodes their angular sector φ₀.',
      scenarioId: 'sinusoid' as const,
      scenarioButton: 'Inspect Polar Phase & Amplitude',
    },
    {
      index: '03',
      title: 'Axial Slice Thickness (Δz) & Partial Volume Artifact',
      formula: 'μ_eff(x,y; Δz) = (1 / Δz) ∫_{z₀ - Δz/2}^{z₀ + Δz/2} μ(x,y,z) dz',
      summary:
        'Clinical CT detectors collimate the X-ray beam to a finite axial slice thickness Δz (typically 0.5 mm to 10 mm). When a high-contrast calcification or lesion is thinner than Δz (dz < Δz), its linear attenuation is averaged over the full collimated slab height, depressing peak sinogram intensity and blurring subtle tissue boundaries.',
      scenarioId: 'partial_volume' as const,
      scenarioButton: 'Run Partial Volume Δz Experiment',
    },
    {
      index: '04',
      title: 'Parallel-Beam vs. 3rd-Generation Fan-Beam Rebinning',
      formula: 'g(γ, β) = p( D_SO sinγ , β + γ )',
      summary:
        'First-generation translate-rotate scanners acquired true parallel projections p(s,θ). Modern diagnostic CT systems rotate a wide fan beam of angle γ emitted from a single focal spot at distance D_SO from the isocenter. A fan-beam ray at fan angle γ and source angle β corresponds to a parallel ray at angle θ = β + γ and detector offset s = D_SO sinγ, warping off-center sinusoids asymmetrically.',
      scenarioId: 'fan_vs_parallel' as const,
      scenarioButton: 'Compare Fan-Beam Warp',
    },
  ];

  return (
    <section
      id="math-reference"
      className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
            <span>MASTER&apos;S CURRICULUM · TOPIC 01 MATHEMATICAL FORMULATION</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Physical &amp; Mathematical Foundations of CT Sinogram Formation
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
          Click any guided classroom experiment below to automatically configure the phantom, slice collimation, and gantry geometry for live demonstration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        {concepts.map((item) => (
          <div
            key={item.index}
            className="flex flex-col justify-between bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-xl p-5"
          >
            <div>
              <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                {item.index}. CONCEPTUAL DERIVATION
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {item.title}
              </h3>

              <div className="my-3 px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-cyan-300 overflow-x-auto">
                {item.formula}
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.summary}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-end">
              <button
                type="button"
                onClick={() => onApplyLabScenario(item.scenarioId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 hover:bg-cyan-600 dark:hover:bg-cyan-600 transition-colors whitespace-nowrap shrink-0"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>{item.scenarioButton}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
