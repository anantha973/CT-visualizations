import {
  AcquisitionParams,
  PhantomPreset,
  PhantomPrimitive,
  ProjectionResult,
  RayGeometry,
  SinogramColormap,
  SinogramMatrix,
  TissueSpec,
  TissueType,
} from '../types/tomography';

/**
 * Water linear attenuation coefficient at 70 keV effective diagnostic X-ray beam energy:
 * mu_water ≈ 0.192 cm^-1
 * By definition: HU = 1000 * (mu - mu_water) / mu_water
 * Therefore: mu = mu_water * (1 + HU / 1000)
 */
export const MU_WATER_CM_INV = 0.192;

export function huToMu(hu: number): number {
  return Math.max(0, Number((MU_WATER_CM_INV * (1 + hu / 1000)).toFixed(4)));
}

export function muToHu(mu: number): number {
  return Math.round(((mu - MU_WATER_CM_INV) / MU_WATER_CM_INV) * 1000);
}

export const TISSUE_SPECS: Record<TissueType, TissueSpec> = {
  air: {
    id: 'air',
    label: 'Air Cavity',
    defaultHu: -1000,
    muCmInv: 0.0,
    fillHex: '#0f172a',
    strokeHex: '#475569',
    description: 'Zero X-ray attenuation cavity (trachea, sinus, or background air)',
  },
  lung: {
    id: 'lung',
    label: 'Lung Parenchyma',
    defaultHu: -700,
    muCmInv: huToMu(-700),
    fillHex: '#1e3a5f',
    strokeHex: '#38bdf8',
    description: 'Aerated pulmonary tissue with low linear attenuation',
  },
  adipose: {
    id: 'adipose',
    label: 'Adipose (Fat)',
    defaultHu: -90,
    muCmInv: huToMu(-90),
    fillHex: '#422006',
    strokeHex: '#f59e0b',
    description: 'Subcutaneous or visceral lipid tissue slightly below water density',
  },
  water: {
    id: 'water',
    label: 'Water Reference',
    defaultHu: 0,
    muCmInv: MU_WATER_CM_INV,
    fillHex: '#1e293b',
    strokeHex: '#06b6d4',
    description: 'Calibration standard (0 HU, μ = 0.192 cm⁻¹ at 70 keV)',
  },
  soft_tissue: {
    id: 'soft_tissue',
    label: 'Soft Tissue / Brain',
    defaultHu: 45,
    muCmInv: huToMu(45),
    fillHex: '#334155',
    strokeHex: '#94a3b8',
    description: 'Parenchymal organ, muscle, or cerebral gray/white matter',
  },
  cancellous_bone: {
    id: 'cancellous_bone',
    label: 'Trabecular Bone',
    defaultHu: 350,
    muCmInv: huToMu(350),
    fillHex: '#78350f',
    strokeHex: '#fbbf24',
    description: 'Spongy vertebral or medullary bone matrix',
  },
  cortical_bone: {
    id: 'cortical_bone',
    label: 'Cortical Bone',
    defaultHu: 1000,
    muCmInv: huToMu(1000),
    fillHex: '#e2e8f0',
    strokeHex: '#f8fafc',
    description: 'Dense cranial calvarium or diaphyseal cortex (2× water attenuation)',
  },
  titanium: {
    id: 'titanium',
    label: 'Titanium / High-Z Pin',
    defaultHu: 2200,
    muCmInv: huToMu(2200),
    fillHex: '#fef08a',
    strokeHex: '#eab308',
    description: 'Metallic surgical implant or fiducial calibration wire',
  },
};

export const PHANTOM_PRESETS: PhantomPreset[] = [
  {
    id: 'shepp-logan',
    name: 'Shepp-Logan Head Phantom',
    shortLabel: 'Shepp-Logan',
    subtitle: 'Canonical cranial phantom with calvarium, ventricles & sub-slice lesions',
    description:
      'Standard medical imaging benchmark consisting of a high-attenuation cortical skull ring, soft-tissue brain parenchyma, twin low-density fluid ventricles, and focal high-density lesions of varying axial slice thickness.',
    pedagogicalTakeaway:
      'Observe how the thick outer cortical bone ring generates dominant twin edge peaks in pθ(s) across all angles, while internal ventricles and small focal tumors trace nested sinusoidal ribbons of contrasting amplitude and phase.',
    primitives: [
      {
        id: 'sl-skull',
        label: 'Cortical Skull Calvarium',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 1000,
        mu: huToMu(1000),
        centerX: 0,
        centerY: 0,
        radiusX: 69,
        radiusY: 90,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'sl-brain',
        label: 'Cerebral Parenchyma',
        shape: 'ellipse',
        tissueType: 'soft_tissue',
        hu: 45,
        mu: huToMu(45),
        centerX: 0,
        centerY: -1.8,
        radiusX: 65,
        radiusY: 85,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'sl-ventricle-r',
        label: 'Right Lateral Ventricle',
        shape: 'ellipse',
        tissueType: 'lung',
        hu: -350,
        mu: huToMu(-350),
        centerX: 22,
        centerY: 0,
        radiusX: 11,
        radiusY: 31,
        tiltDeg: -18,
        zCenterMm: 0,
        zThicknessMm: 16,
        visible: true,
      },
      {
        id: 'sl-ventricle-l',
        label: 'Left Lateral Ventricle',
        shape: 'ellipse',
        tissueType: 'lung',
        hu: -350,
        mu: huToMu(-350),
        centerX: -22,
        centerY: 0,
        radiusX: 15,
        radiusY: 40,
        tiltDeg: 18,
        zCenterMm: 0,
        zThicknessMm: 16,
        visible: true,
      },
      {
        id: 'sl-anterior-mass',
        label: 'Anterior Subdural Mass',
        shape: 'ellipse',
        tissueType: 'cancellous_bone',
        hu: 320,
        mu: huToMu(320),
        centerX: 0,
        centerY: 35,
        radiusX: 20,
        radiusY: 24,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 12,
        visible: true,
      },
      {
        id: 'sl-thin-calc',
        label: 'Pineal Micro-Calcification (Thin Z)',
        shape: 'ellipse',
        tissueType: 'titanium',
        hu: 1800,
        mu: huToMu(1800),
        centerX: 0,
        centerY: -12,
        radiusX: 5.5,
        radiusY: 5.5,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 2.5,
        visible: true,
      },
      {
        id: 'sl-occipital-lesion',
        label: 'Occipital Focal Lesion (Thin Z)',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 850,
        mu: huToMu(850),
        centerX: -14,
        centerY: -60,
        radiusX: 8,
        radiusY: 5,
        tiltDeg: 0,
        zCenterMm: 2,
        zThicknessMm: 3.0,
        visible: true,
      },
    ],
  },
  {
    id: 'point-sinusoid-demo',
    name: 'Radon Sinusoid & Phase Calibrator',
    shortLabel: 'Sinusoid Locus',
    subtitle: 'Three discrete high-contrast pins at distinct polar coordinates (r, φ)',
    description:
      'Isolates the fundamental Radon Transform property: a point source at Cartesian (x₀, y₀) or polar (r₀, φ₀) maps to an exact sinusoidal trajectory s(θ) = x₀ cos θ + y₀ sin θ = r₀ cos(θ - φ₀) in the sinogram.',
    pedagogicalTakeaway:
      'A structure at the gantry isocenter (0, 0) forms a straight vertical line at s = 0, whereas increasing radial distance r₀ increases the sinusoid amplitude and changing polar angle φ₀ shifts its vertical phase.',
    primitives: [
      {
        id: 'ps-water-cylinder',
        label: 'PMMA Reference Cylinder',
        shape: 'ellipse',
        tissueType: 'water',
        hu: 0,
        mu: huToMu(0),
        centerX: 0,
        centerY: 0,
        radiusX: 76,
        radiusY: 76,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ps-center-pin',
        label: 'Isocenter Reference Pin (r = 0 mm)',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 900,
        mu: huToMu(900),
        centerX: 0,
        centerY: 0,
        radiusX: 5.5,
        radiusY: 5.5,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ps-pin-quad1',
        label: 'Peripheral Titanium Wire (r = 55 mm, φ = 35°)',
        shape: 'ellipse',
        tissueType: 'titanium',
        hu: 2100,
        mu: huToMu(2100),
        centerX: 45,
        centerY: 32,
        radiusX: 6.5,
        radiusY: 6.5,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ps-pin-quad3',
        label: 'Trabecular Bone Rod (r = 38 mm, φ = -125°)',
        shape: 'ellipse',
        tissueType: 'cancellous_bone',
        hu: 550,
        mu: huToMu(550),
        centerX: -22,
        centerY: -31,
        radiusX: 9,
        radiusY: 9,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
    ],
  },
  {
    id: 'multi-density-calibration',
    name: 'ACR Multi-Density Sensitometry Phantom',
    shortLabel: 'ACR Density',
    subtitle: 'Water bath with 5 sensitometry inserts spanning -1000 HU to +1000 HU',
    description:
      'Models a clinical quality-assurance CT sensitometry module used by medical systems engineers to verify Hounsfield Unit linearity across air, lung, adipose, trabecular bone, and cortical bone inserts.',
    pedagogicalTakeaway:
      'Compare how negative-HU inserts (Air -1000 HU, Lung -700 HU) carve attenuation valleys (shadow deficits) into the background water cylinder profile, while positive-HU bone rods produce sharp additive attenuation spikes.',
    primitives: [
      {
        id: 'acr-bath',
        label: 'Water-Equivalent Body Ring (0 HU)',
        shape: 'ellipse',
        tissueType: 'water',
        hu: 0,
        mu: huToMu(0),
        centerX: 0,
        centerY: 0,
        radiusX: 82,
        radiusY: 82,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'acr-cortical',
        label: 'Cortical Bone Insert (+1000 HU)',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 1000,
        mu: huToMu(1000),
        centerX: 0,
        centerY: 48,
        radiusX: 13,
        radiusY: 13,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'acr-trabecular',
        label: 'Trabecular Bone Insert (+350 HU)',
        shape: 'ellipse',
        tissueType: 'cancellous_bone',
        hu: 350,
        mu: huToMu(350),
        centerX: 46,
        centerY: 15,
        radiusX: 13,
        radiusY: 13,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'acr-adipose',
        label: 'Adipose Insert (-90 HU)',
        shape: 'ellipse',
        tissueType: 'adipose',
        hu: -90,
        mu: huToMu(-90),
        centerX: 28,
        centerY: -39,
        radiusX: 13,
        radiusY: 13,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'acr-lung',
        label: 'Lung Equivalent Insert (-700 HU)',
        shape: 'ellipse',
        tissueType: 'lung',
        hu: -700,
        mu: huToMu(-700),
        centerX: -28,
        centerY: -39,
        radiusX: 13,
        radiusY: 13,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'acr-air',
        label: 'Air Cavity Insert (-1000 HU)',
        shape: 'ellipse',
        tissueType: 'air',
        hu: -1000,
        mu: huToMu(-1000),
        centerX: -46,
        centerY: 15,
        radiusX: 13,
        radiusY: 13,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
    ],
  },
  {
    id: 'partial-volume-z-slab',
    name: 'Axial Slice Thickness & Partial Volume Phantom',
    shortLabel: 'Slice Thickness (Δz)',
    subtitle: 'Sub-millimeter and thin-slab high-Z discs at staggered axial z-depths',
    description:
      'Designed specifically to teach the Partial Volume Artifact along the scanner z-axis. Contains four high-density discs with identical (x, y) diameter but axial thicknesses of 1.5 mm, 3.0 mm, 6.0 mm, and 20.0 mm.',
    pedagogicalTakeaway:
      'Increase the Slice Thickness (Δz) slider from 1 mm to 15 mm: the 20 mm full-depth rod maintains constant projection amplitude, while the 1.5 mm and 3.0 mm thin discs lose up to 85% of their apparent attenuation due to axial volume averaging.',
    primitives: [
      {
        id: 'pv-housing',
        label: 'Soft-Tissue Phantom Housing (+45 HU)',
        shape: 'ellipse',
        tissueType: 'soft_tissue',
        hu: 45,
        mu: huToMu(45),
        centerX: 0,
        centerY: 0,
        radiusX: 80,
        radiusY: 80,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 24,
        visible: true,
      },
      {
        id: 'pv-rod-20mm',
        label: 'Full-Depth Cylinder (dz = 20 mm)',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 1100,
        mu: huToMu(1100),
        centerX: -42,
        centerY: 32,
        radiusX: 11,
        radiusY: 11,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'pv-disc-6mm',
        label: 'Medium Slab Disc (dz = 6.0 mm)',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 1100,
        mu: huToMu(1100),
        centerX: 42,
        centerY: 32,
        radiusX: 11,
        radiusY: 11,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 6.0,
        visible: true,
      },
      {
        id: 'pv-disc-3mm',
        label: 'Thin Calcification Disc (dz = 3.0 mm)',
        shape: 'ellipse',
        tissueType: 'titanium',
        hu: 1600,
        mu: huToMu(1600),
        centerX: -42,
        centerY: -32,
        radiusX: 11,
        radiusY: 11,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 3.0,
        visible: true,
      },
      {
        id: 'pv-disc-1.5mm',
        label: 'Micro-Lesion Coin (dz = 1.5 mm, z₀ = +2 mm)',
        shape: 'ellipse',
        tissueType: 'titanium',
        hu: 2000,
        mu: huToMu(2000),
        centerX: 42,
        centerY: -32,
        radiusX: 11,
        radiusY: 11,
        tiltDeg: 0,
        zCenterMm: 2.0,
        zThicknessMm: 1.5,
        visible: true,
      },
    ],
  },
  {
    id: 'thorax-section',
    name: 'Anatomical Thorax & Rectangular Bar Phantom',
    shortLabel: 'Thorax & Shapes',
    subtitle: 'Elliptical chest wall, aerated lungs, vertebral spine & rectangular bar target',
    description:
      'Combines elliptical and rectangular geometric primitives to demonstrate how anisotropic aspect ratios and flat edges produce sharp projection peaks when aligned parallel to the X-ray beam.',
    pedagogicalTakeaway:
      'Notice how the rectangular sternum/calibration bar produces a narrow, high-amplitude spike at θ = 0° (rays travelling along its long axis) and a wide, flat plateau at θ = 90° (rays perpendicular to its broad face).',
    primitives: [
      {
        id: 'th-body',
        label: 'Thoracic Body Wall',
        shape: 'ellipse',
        tissueType: 'soft_tissue',
        hu: 45,
        mu: huToMu(45),
        centerX: 0,
        centerY: 0,
        radiusX: 88,
        radiusY: 62,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'th-lung-r',
        label: 'Right Lung Field',
        shape: 'ellipse',
        tissueType: 'lung',
        hu: -720,
        mu: huToMu(-720),
        centerX: -36,
        centerY: 4,
        radiusX: 30,
        radiusY: 40,
        tiltDeg: 10,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'th-lung-l',
        label: 'Left Lung Field',
        shape: 'ellipse',
        tissueType: 'lung',
        hu: -720,
        mu: huToMu(-720),
        centerX: 36,
        centerY: 4,
        radiusX: 28,
        radiusY: 38,
        tiltDeg: -10,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'th-heart',
        label: 'Cardiac Mediastinum',
        shape: 'ellipse',
        tissueType: 'soft_tissue',
        hu: 55,
        mu: huToMu(55),
        centerX: 8,
        centerY: 12,
        radiusX: 22,
        radiusY: 26,
        tiltDeg: -15,
        zCenterMm: 0,
        zThicknessMm: 18,
        visible: true,
      },
      {
        id: 'th-spine',
        label: 'Thoracic Vertebral Body',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 950,
        mu: huToMu(950),
        centerX: 0,
        centerY: -36,
        radiusX: 16,
        radiusY: 14,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'th-sternum-bar',
        label: 'Rectangular Calibration Bar / Sternum',
        shape: 'rectangle',
        tissueType: 'titanium',
        hu: 1650,
        mu: huToMu(1650),
        centerX: -34,
        centerY: 10,
        radiusX: 18,
        radiusY: 4.5,
        tiltDeg: 25,
        zCenterMm: 0,
        zThicknessMm: 10,
        visible: true,
      },
    ],
  },
];

/**
 * Computes the axial partial-volume overlap fraction in [0, 1] between the collimated
 * X-ray beam slab [sliceZOffset - sliceThickness/2, sliceZOffset + sliceThickness/2]
 * and a primitive's axial extent [zCenter - zThickness/2, zCenter + zThickness/2].
 */
export function computePartialVolumeWeight(
  sliceThicknessMm: number,
  sliceZOffsetMm: number,
  primitiveZCenterMm: number,
  primitiveZThicknessMm: number
): number {
  const halfSlice = Math.max(0.1, sliceThicknessMm) / 2;
  const beamMinZ = sliceZOffsetMm - halfSlice;
  const beamMaxZ = sliceZOffsetMm + halfSlice;

  const halfPrim = Math.max(0.1, primitiveZThicknessMm) / 2;
  const primMinZ = primitiveZCenterMm - halfPrim;
  const primMaxZ = primitiveZCenterMm + halfPrim;

  const overlapMin = Math.max(beamMinZ, primMinZ);
  const overlapMax = Math.min(beamMaxZ, primMaxZ);
  const overlap = Math.max(0, overlapMax - overlapMin);

  return overlap / Math.max(0.1, sliceThicknessMm);
}

/**
 * Exact 2D analytical chord intersection length (in mm) of a line segment (x1,y1)->(x2,y2)
 * with a rotated ellipse or rectangle.
 */
export function computeRayPrimitiveChordMm(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  prim: PhantomPrimitive
): number {
  if (!prim.visible) return 0;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const rayLen = Math.hypot(dx, dy);
  if (rayLen < 1e-6) return 0;

  // Unit direction vector of the ray
  const ux = dx / rayLen;
  const uy = dy / rayLen;

  // Translate ray origin relative to primitive center
  const ox = x1 - prim.centerX;
  const oy = y1 - prim.centerY;

  // Rotate by -tiltDeg into primitive local coordinates
  const rad = (-prim.tiltDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);

  const lox = ox * cosA - oy * sinA;
  const loy = ox * sinA + oy * cosA;
  const lux = ux * cosA - uy * sinA;
  const luy = ux * sinA + uy * cosA;

  const a = Math.max(0.5, prim.radiusX);
  const b = Math.max(0.5, prim.radiusY);

  if (prim.shape === 'ellipse') {
    // Solve (lox + t*lux)^2 / a^2 + (loy + t*luy)^2 / b^2 = 1
    const A = (lux * lux) / (a * a) + (luy * luy) / (b * b);
    const B = 2 * ((lox * lux) / (a * a) + (loy * luy) / (b * b));
    const C = (lox * lox) / (a * a) + (loy * loy) / (b * b) - 1;

    const disc = B * B - 4 * A * C;
    if (disc <= 0 || A <= 1e-12) return 0;

    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-B - sqrtDisc) / (2 * A);
    const t2 = (-B + sqrtDisc) / (2 * A);

    const tEnter = Math.max(0, Math.min(t1, t2));
    const tExit = Math.min(rayLen, Math.max(t1, t2));
    return Math.max(0, tExit - tEnter);
  } else {
    // Slab intersection with box [-a, +a] x [-b, +b]
    let tMin = 0;
    let tMax = rayLen;

    if (Math.abs(lux) < 1e-9) {
      if (lox < -a || lox > a) return 0;
    } else {
      const tx1 = (-a - lox) / lux;
      const tx2 = (a - lox) / lux;
      tMin = Math.max(tMin, Math.min(tx1, tx2));
      tMax = Math.min(tMax, Math.max(tx1, tx2));
    }

    if (Math.abs(luy) < 1e-9) {
      if (loy < -b || loy > b) return 0;
    } else {
      const ty1 = (-b - loy) / luy;
      const ty2 = (b - loy) / luy;
      tMin = Math.max(tMin, Math.min(ty1, ty2));
      tMax = Math.min(tMax, Math.max(ty1, ty2));
    }

    return Math.max(0, tMax - tMin);
  }
}

/**
 * Checks if a 2D point (x, y) is inside a primitive (used for canvas hit-testing & nested overrides).
 */
export function isPointInPrimitive(x: number, y: number, prim: PhantomPrimitive): boolean {
  if (!prim.visible) return false;
  const ox = x - prim.centerX;
  const oy = y - prim.centerY;
  const rad = (-prim.tiltDeg * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const lx = ox * cosA - oy * sinA;
  const ly = ox * sinA + oy * cosA;
  const a = Math.max(0.5, prim.radiusX);
  const b = Math.max(0.5, prim.radiusY);

  if (prim.shape === 'ellipse') {
    return (lx * lx) / (a * a) + (ly * ly) / (b * b) <= 1;
  } else {
    return Math.abs(lx) <= a && Math.abs(ly) <= b;
  }
}

/**
 * Computes the 1D projection profile p_theta(s) for a given gantry angle.
 * Note on nested structures (e.g. Lung inside Thorax or Air inside Water Bath):
 * If a smaller primitive is contained inside a larger host primitive, its effective
 * differential linear attenuation relative to the enclosing host is (mu_child - mu_host)
 * weighted by its axial partial volume, preventing unrealistic double-counting of background water/tissue!
 */
export function computeSingleProjection(
  primitives: PhantomPrimitive[],
  params: AcquisitionParams,
  angleDeg: number
): ProjectionResult {
  const fovRadiusMm = 100; // [-100mm, +100mm]
  const gantryDistanceMm = 118; // Source/detector plane distance for parallel display
  const thetaRad = (angleDeg * Math.PI) / 180;
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  const visiblePrims = primitives.filter((p) => p.visible);

  // Determine parent enclosing primitive for each primitive (by center containment and larger area)
  const effectiveMuDiffs = visiblePrims.map((prim, idx) => {
    const primArea = prim.radiusX * prim.radiusY;
    let smallestEnclosingParent: PhantomPrimitive | null = null;
    let smallestParentArea = Infinity;

    for (let j = 0; j < visiblePrims.length; j++) {
      if (idx === j) continue;
      const candidate = visiblePrims[j];
      const candArea = candidate.radiusX * candidate.radiusY;
      if (candArea > primArea * 1.15 && isPointInPrimitive(prim.centerX, prim.centerY, candidate)) {
        if (candArea < smallestParentArea) {
          smallestParentArea = candArea;
          smallestEnclosingParent = candidate;
        }
      }
    }

    const pvWeight = computePartialVolumeWeight(
      params.sliceThicknessMm,
      params.sliceZOffsetMm,
      prim.zCenterMm,
      prim.zThicknessMm
    );
    const thinPvWeight = computePartialVolumeWeight(
      0.5,
      params.sliceZOffsetMm,
      prim.zCenterMm,
      prim.zThicknessMm
    );

    if (smallestEnclosingParent) {
      const parentPvWeight = computePartialVolumeWeight(
        params.sliceThicknessMm,
        params.sliceZOffsetMm,
        smallestEnclosingParent.zCenterMm,
        smallestEnclosingParent.zThicknessMm
      );
      const parentThinWeight = computePartialVolumeWeight(
        0.5,
        params.sliceZOffsetMm,
        smallestEnclosingParent.zCenterMm,
        smallestEnclosingParent.zThicknessMm
      );
      // Within the child's axial overlap, it replaces the parent's mu with its own mu
      const netMu = prim.mu * pvWeight - smallestEnclosingParent.mu * Math.min(pvWeight, parentPvWeight);
      const netThinMu =
        prim.mu * thinPvWeight - smallestEnclosingParent.mu * Math.min(thinPvWeight, parentThinWeight);
      return { prim, netMu, netThinMu, rawMu: prim.mu * pvWeight };
    }

    return {
      prim,
      netMu: prim.mu * pvWeight,
      netThinMu: prim.mu * thinPvWeight,
      rawMu: prim.mu * pvWeight,
    };
  });

  const numBins = params.detectorBins;
  const rays: RayGeometry[] = [];
  const primitiveContributions: Record<string, number[]> = {};
  visiblePrims.forEach((p) => {
    primitiveContributions[p.id] = new Array(numBins).fill(0);
  });

  let maxAttenuation = 0;
  let totalIntegralSum = 0;

  for (let k = 0; k < numBins; k++) {
    // Normalized detector coordinate u in [-1, +1]
    const u = (2 * k) / (numBins - 1) - 1;
    const sMm = u * fovRadiusMm;

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    if (params.beamMode === 'parallel') {
      // Parallel ray at offset sMm along detector axis (cosT, sinT),
      // travelling from source plane (-gantryDistanceMm along normal (-sinT, cosT))
      // to detector plane (+gantryDistanceMm along normal (-sinT, cosT))
      const dirX = -sinT;
      const dirY = cosT;
      x1 = sMm * cosT - gantryDistanceMm * dirX;
      y1 = sMm * sinT - gantryDistanceMm * dirY;
      x2 = sMm * cosT + gantryDistanceMm * dirX;
      y2 = sMm * sinT + gantryDistanceMm * dirY;
    } else {
      // Fan-Beam geometry:
      // Focal spot is located at distance sourceIsoDistMm along the source normal:
      // S = -D_SO * dir, where dir = (-sinT, cosT)
      const dirX = -sinT;
      const dirY = cosT;
      const dSo = Math.max(130, params.sourceIsoDistMm);
      // Visual source position on gantry circle (clamped to gantry display radius for rendering,
      // while using exact fan divergence angle gamma_k for ray tracing)
      const maxGammaRad = ((params.fanAngleDeg * Math.PI) / 180) * 0.5;
      const gamma = u * maxGammaRad;

      // Ray angle in global coordinates
      const rayAngle = thetaRad + Math.PI / 2 + gamma;
      const rux = Math.cos(rayAngle);
      const ruy = Math.sin(rayAngle);

      // Focal spot position
      const sx = -dSo * dirX;
      const sy = -dSo * dirY;

      // Clip ray segment to the gantry circle of radius gantryDistanceMm for consistent visual & chord integration
      // Since FOV is within radius 100mm and dSo >= 140mm, ray length 2 * dSo passes completely through the FOV
      const chordSpan = dSo + gantryDistanceMm;
      x1 = sx;
      y1 = sy;
      x2 = sx + chordSpan * rux;
      y2 = sy + chordSpan * ruy;
    }

    let sumAtten = 0;
    let sumThinAtten = 0;

    for (let i = 0; i < effectiveMuDiffs.length; i++) {
      const { prim, netMu, netThinMu, rawMu } = effectiveMuDiffs[i];
      const chordMm = computeRayPrimitiveChordMm(x1, y1, x2, y2, prim);
      if (chordMm > 0) {
        const chordCm = chordMm / 10; // convert mm to cm since mu is in cm^-1
        sumAtten += netMu * chordCm;
        sumThinAtten += netThinMu * chordCm;
        primitiveContributions[prim.id][k] = Math.max(0, rawMu * chordCm);
      }
    }

    // Clamp numerical precision noise to >= 0
    const finalAtten = Math.max(0, sumAtten);
    const finalThinAtten = Math.max(0, sumThinAtten);

    if (finalAtten > maxAttenuation) {
      maxAttenuation = finalAtten;
    }
    totalIntegralSum += finalAtten;

    rays.push({
      binIndex: k,
      sMm,
      x1,
      y1,
      x2,
      y2,
      attenuation: finalAtten,
      thinSliceAttenuation: finalThinAtten,
    });
  }

  return {
    angleDeg,
    rays,
    primitiveContributions,
    maxAttenuation,
    totalIntegralSum,
  };
}

/**
 * Computes the complete 2D Sinogram matrix across all angular steps [0, maxAngleDeg].
 */
export function computeFullSinogram(
  primitives: PhantomPrimitive[],
  params: AcquisitionParams
): SinogramMatrix {
  const anglesDeg: number[] = [];
  for (let a = 0; a <= params.maxAngleDeg; a += params.angularStepDeg) {
    anglesDeg.push(a);
  }

  const numBins = params.detectorBins;
  const detectorCoordsMm: number[] = [];
  for (let k = 0; k < numBins; k++) {
    const u = (2 * k) / (numBins - 1) - 1;
    detectorCoordsMm.push(u * 100);
  }

  const data: number[][] = [];
  let globalMax = 0;

  for (let idx = 0; idx < anglesDeg.length; idx++) {
    const proj = computeSingleProjection(primitives, params, anglesDeg[idx]);
    const row = proj.rays.map((r) => r.attenuation);
    if (proj.maxAttenuation > globalMax) {
      globalMax = proj.maxAttenuation;
    }
    data.push(row);
  }

  return {
    anglesDeg,
    detectorCoordsMm,
    data,
    globalMax: Math.max(0.1, globalMax),
  };
}

/**
 * Computes the theoretical detector bin coordinate s(θ) in mm for a point (x0, y0)
 * at gantry angle θ under Parallel or Fan-Beam geometry.
 */
export function computeTheoreticalSinusoidMm(
  x0: number,
  y0: number,
  angleDeg: number,
  params: AcquisitionParams
): number {
  const thetaRad = (angleDeg * Math.PI) / 180;
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  if (params.beamMode === 'parallel') {
    // Classic Radon transform locus: s(θ) = x0 cos(θ) + y0 sin(θ)
    return x0 * cosT + y0 * sinT;
  } else {
    // Fan-beam projection of point (x0, y0) from source at S = (dSo * sinT, -dSo * cosT)
    const dSo = Math.max(130, params.sourceIsoDistMm);
    // Point coordinates in rotated gantry frame where u-axis is (cosT, sinT) and v-axis is (-sinT, cosT)
    const u = x0 * cosT + y0 * sinT;
    const v = -x0 * sinT + y0 * cosT;
    const gamma = Math.atan2(u, dSo + v);
    const maxGammaRad = ((params.fanAngleDeg * Math.PI) / 180) * 0.5;
    return (gamma / Math.max(0.05, maxGammaRad)) * 100;
  }
}

/**
 * Maps a normalized intensity t in [0, 1] to an [R, G, B] tuple for sinogram rendering.
 */
export function mapSinogramColor(t: number, colormap: SinogramColormap): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  if (colormap === 'grayscale') {
    const v = Math.round(c * 255);
    return [v, v, v];
  }
  if (colormap === 'clinical_cyan') {
    // Deep obsidian -> cobalt -> cyan -> white
    if (c < 0.45) {
      const f = c / 0.45;
      return [Math.round(8 + f * 6), Math.round(14 + f * 118), Math.round(28 + f * 170)];
    } else if (c < 0.82) {
      const f = (c - 0.45) / 0.37;
      return [Math.round(14 + f * 90), Math.round(132 + f * 100), Math.round(198 + f * 48)];
    } else {
      const f = (c - 0.82) / 0.18;
      return [Math.round(104 + f * 151), Math.round(232 + f * 23), Math.round(246 + f * 9)];
    }
  }
  if (colormap === 'viridis') {
    // Approximate Viridis ramp
    const r = Math.round(255 * Math.min(1, Math.max(0, -0.35 + 1.45 * c * c)));
    const g = Math.round(255 * Math.min(1, Math.max(0, 0.05 + 0.9 * c)));
    const b = Math.round(
      255 * Math.min(1, Math.max(0, 0.33 + 0.8 * Math.sin(c * Math.PI * 0.85) - 0.35 * c))
    );
    return [r, g, b];
  }
  // Inferno ramp
  if (c < 0.33) {
    const f = c / 0.33;
    return [Math.round(10 + f * 110), Math.round(7 + f * 18), Math.round(35 + f * 95)];
  } else if (c < 0.66) {
    const f = (c - 0.33) / 0.33;
    return [Math.round(120 + f * 115), Math.round(25 + f * 85), Math.round(130 - f * 85)];
  } else {
    const f = (c - 0.66) / 0.34;
    return [Math.round(235 + f * 20), Math.round(110 + f * 140), Math.round(45 + f * 165)];
  }
}
