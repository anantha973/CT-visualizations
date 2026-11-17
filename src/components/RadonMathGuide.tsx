import React from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';
import { MathFormula } from './MathFormula';

interface RadonMathGuideProps {
  onApplyLabScenario: (
    scenarioId: 'sinusoid' | 'partial_volume' | 'fan_vs_parallel' | 'anisotropy'
  ) => void;
}

export const RadonMathGuide: React.FC<RadonMathGuideProps> = ({ onApplyLabScenario }) => {
  const concepts = [
    {
      index: '01',
      title: 'Beer–Lambert Attenuation & The Radon Line Integral',
      tex: 'p_\\theta(s) = -\\ln\\!\\left(\\frac{I(s,\\theta)}{I_0}\\right) = \\iint_{\\mathbb{R}^2} \\mu(x,y)\\,\\delta(x\\cos\\theta + y\\sin\\theta - s)\\,dx\\,dy',
      summary:
        'An X-ray beam passing through heterogeneous anatomical organs (heart myocardium, aerated lung parenchyma, cortical bone) undergoes exponential photon attenuation governed by the linear attenuation coefficient μ(x,y) [cm⁻¹]. Taking the negative natural logarithm of the transmitted intensity ratio converts multiplicative photon survival into a linear path integral along the ray L(s,θ). Each horizontal row of the CT sinogram is this 1D detector profile p_θ(s) recorded at gantry angle θ.',
      scenarioId: 'anisotropy' as const,
      scenarioButton: 'Load Anatomical Heart & Lungs Thorax',
    },
    {
      index: '02',
      title: 'Sinusoidal Trajectories in Radon Space',
      tex: 's(\\theta) = x_0\\cos\\theta + y_0\\sin\\theta = r_0\\cos(\\theta - \\phi_0)',
      summary:
        'Why is it called a "Sinogram"? A compact anatomical structure (such as a coronary artery calcification or pineal gland concretion) located at Cartesian coordinate (x₀, y₀)—or polar coordinate (r₀, φ₀)—projects onto detector channel s(θ) = x₀ cosθ + y₀ sinθ as the gantry rotates. Structures at the gantry isocenter (r₀ = 0) trace a straight vertical line at s = 0, whereas peripheral organs trace sinusoids whose amplitude equals r₀ and whose phase encodes φ₀.',
      scenarioId: 'sinusoid' as const,
      scenarioButton: 'Inspect Polar Phase & Amplitude',
    },
    {
      index: '03',
      title: 'Axial Slice Thickness (Δz) & Partial Volume Averaging',
      tex: '\\bar{\\mu}_{\\text{eff}}(x,y;\\Delta z) = \\frac{1}{\\Delta z}\\int_{z_0 - \\Delta z/2}^{z_0 + \\Delta z/2} \\mu(x,y,z)\\,dz',
      summary:
        'Clinical CT detectors collimate the X-ray beam to a finite axial slice thickness Δz (typically 0.5 mm to 10 mm). When a high-contrast coronary plaque or brain calcification is thinner than Δz (dz < Δz), its linear attenuation is averaged over the full collimated slab height, depressing peak sinogram intensity and reducing diagnostic contrast.',
      scenarioId: 'partial_volume' as const,
      scenarioButton: 'Run Partial Volume Δz Experiment',
    },
    {
      index: '04',
      title: 'Parallel-Beam vs. 3rd-Generation Fan-Beam Rebinning',
      tex: 'g(\\gamma, \\beta) = p\\!\\left(D_{SO}\\sin\\gamma,\\; \\beta + \\gamma\\right)',
      summary:
        'First-generation translate-rotate scanners acquired parallel projections p(s,θ). Modern diagnostic CT systems rotate a wide fan beam of angle γ emitted from a focal spot at distance D_SO from the isocenter. A fan-beam ray at fan angle γ and source angle β corresponds to a parallel ray at angle θ = β + γ and detector offset s = D_SO sinγ, warping off-center sinusoids asymmetrically.',
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
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Master&apos;s Curriculum · Topic 01 Mathematical Formulation</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Physical &amp; Mathematical Foundations of CT Sinogram Formation
          </h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
          Click any guided classroom experiment below to configure the anatomical phantom, slice collimation, and gantry geometry for live demonstration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        {concepts.map((item) => (
          <div
            key={item.index}
            className="flex flex-col justify-between bg-slate-50 dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-xl p-5"
          >
            <div>
              <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                {item.index}. Conceptual Derivation
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {item.title}
              </h3>

              <div className="my-3.5 px-4 py-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-cyan-200 overflow-x-auto text-center">
                <MathFormula tex={item.tex} displayMode />
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
