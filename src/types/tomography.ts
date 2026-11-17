export type TissueType =
  | 'air'
  | 'lung'
  | 'adipose'
  | 'water'
  | 'soft_tissue'
  | 'cancellous_bone'
  | 'cortical_bone'
  | 'titanium';

export interface TissueSpec {
  id: TissueType;
  label: string;
  defaultHu: number;
  /** Linear attenuation coefficient in cm^-1 at ~70 keV effective energy */
  muCmInv: number;
  fillHex: string;
  strokeHex: string;
  description: string;
}

export type PrimitiveShape =
  | 'ellipse'
  | 'rectangle'
  | 'heart'
  | 'lung_right'
  | 'lung_left'
  | 'brain_left'
  | 'brain_right'
  | 'brain_ventricle'
  | 'vertebra';

export interface PhantomPrimitive {
  id: string;
  label: string;
  shape: PrimitiveShape;
  tissueType: TissueType;
  /** Hounsfield Units (-1000 to +3000) */
  hu: number;
  /** Linear attenuation coefficient mu in cm^-1 */
  mu: number;
  /** X coordinate in mm within [-100, +100] FOV */
  centerX: number;
  /** Y coordinate in mm within [-100, +100] FOV */
  centerY: number;
  /** Semi-axis A (or half-width) in mm */
  radiusX: number;
  /** Semi-axis B (or half-height) in mm */
  radiusY: number;
  /** In-plane rotation angle in degrees */
  tiltDeg: number;
  /** Axial z-center in mm within [-15, +15] */
  zCenterMm: number;
  /** Axial z-thickness (slab height) in mm (0.5 to 25) */
  zThicknessMm: number;
  /** Whether this structure's attenuation is active */
  visible: boolean;
}

export interface PhantomPreset {
  id: string;
  name: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  pedagogicalTakeaway: string;
  primitives: PhantomPrimitive[];
}

export type BeamGeometryMode = 'parallel' | 'fan';

export type SinogramColormap = 'grayscale' | 'viridis' | 'inferno' | 'clinical_cyan';

export interface AcquisitionParams {
  beamMode: BeamGeometryMode;
  /** Current gantry angle in degrees [0, maxAngleDeg] */
  currentAngleDeg: number;
  /** Total angular scan range: 180° (half-scan) or 360° (full-scan) */
  maxAngleDeg: 180 | 360;
  /** Angular step size in degrees */
  angularStepDeg: 1 | 2 | 3 | 5;
  /** Number of detector channels / bins across the 200mm FOV */
  detectorBins: 64 | 128 | 192 | 256;
  /** Collimated axial slice thickness Δz in mm (0.5 to 20 mm) */
  sliceThicknessMm: number;
  /** Axial slice center offset z0 in mm (-10 to +10 mm) */
  sliceZOffsetMm: number;
  /** Source-to-isocenter distance D_SO in mm for Fan-Beam geometry */
  sourceIsoDistMm: number;
  /** Fan beam full arc angle in degrees */
  fanAngleDeg: number;
}

export interface RayGeometry {
  binIndex: number;
  /** Detector position s in mm [-100, +100] (or arc coordinate) */
  sMm: number;
  /** Start point (X-ray source / collimator aperture) in mm */
  x1: number;
  y1: number;
  /** End point (Detector element) in mm */
  x2: number;
  y2: number;
  /** Line integral value p = ∫ μ dl (dimensionless optical depth / attenuation sum) */
  attenuation: number;
  /** Thin-slice (0.5mm) reference attenuation for partial-volume comparison */
  thinSliceAttenuation: number;
}

export interface ProjectionResult {
  angleDeg: number;
  rays: RayGeometry[];
  /** Contribution per primitive ID for the current projection angle */
  primitiveContributions: Record<string, number[]>;
  maxAttenuation: number;
  totalIntegralSum: number;
}

export interface SinogramMatrix {
  anglesDeg: number[];
  detectorCoordsMm: number[];
  /** 2D array [angleIndex][binIndex] of full computed sinogram */
  data: number[][];
  globalMax: number;
}

export interface ProbedSinogramPoint {
  angleIndex: number;
  angleDeg: number;
  binIndex: number;
  sMm: number;
  attenuation: number;
  locked: boolean;
}
