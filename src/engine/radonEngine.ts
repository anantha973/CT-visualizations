import {
  AcquisitionParams,
  PhantomPreset,
  PhantomPrimitive,
  PrimitiveShape,
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
    label: 'Air / Bronchial Lumen',
    defaultHu: -1000,
    muCmInv: 0.0,
    fillHex: '#0f172a',
    strokeHex: '#475569',
    description: 'Zero X-ray attenuation cavity (trachea, paranasal sinus, or background air)',
  },
  lung: {
    id: 'lung',
    label: 'Lung Parenchyma',
    defaultHu: -720,
    muCmInv: huToMu(-720),
    fillHex: '#1e3a5f',
    strokeHex: '#38bdf8',
    description: 'Aerated pulmonary alveolar tissue with vascular branching',
  },
  adipose: {
    id: 'adipose',
    label: 'Adipose / Epicardial Fat',
    defaultHu: -90,
    muCmInv: huToMu(-90),
    fillHex: '#422006',
    strokeHex: '#f59e0b',
    description: 'Subcutaneous or pericardial lipid tissue slightly below water density',
  },
  water: {
    id: 'water',
    label: 'CSF / Water Reference',
    defaultHu: 0,
    muCmInv: MU_WATER_CM_INV,
    fillHex: '#1e293b',
    strokeHex: '#06b6d4',
    description: 'Cerebrospinal fluid & calibration standard (0 HU, μ = 0.192 cm⁻¹)',
  },
  soft_tissue: {
    id: 'soft_tissue',
    label: 'Myocardium / Brain Cortex',
    defaultHu: 45,
    muCmInv: huToMu(45),
    fillHex: '#334155',
    strokeHex: '#94a3b8',
    description: 'Cardiac muscle, cerebral gray/white matter, or mediastinal tissue',
  },
  cancellous_bone: {
    id: 'cancellous_bone',
    label: 'Contrast Blood / Trabecular',
    defaultHu: 320,
    muCmInv: huToMu(320),
    fillHex: '#78350f',
    strokeHex: '#fbbf24',
    description: 'Iodinated ventricular blood pool or spongy medullary bone matrix',
  },
  cortical_bone: {
    id: 'cortical_bone',
    label: 'Cortical Bone (Skull / Spine)',
    defaultHu: 1000,
    muCmInv: huToMu(1000),
    fillHex: '#e2e8f0',
    strokeHex: '#f8fafc',
    description: 'Dense cranial calvarium, vertebral body, or rib cortex',
  },
  titanium: {
    id: 'titanium',
    label: 'Calcified Plaque / Titanium',
    defaultHu: 2100,
    muCmInv: huToMu(2100),
    fillHex: '#fef08a',
    strokeHex: '#eab308',
    description: 'Coronary artery calcification, pineal concretion, or metallic stent',
  },
};

/**
 * Generates high-resolution, anatomically accurate normalized 2D polygon contours in [-1, 1] x [-1, 1]
 * for genuine organ cross-sections (Heart, Right Lung, Left Lung with Cardiac Notch, Left/Right Cerebral
 * Hemispheres with cortical gyri/sulci and Sylvian fissure, Butterfly Lateral Ventricles, and Thoracic Vertebra).
 */
function buildAnatomicalContours(): Record<
  Exclude<PrimitiveShape, 'ellipse' | 'rectangle'>,
  Array<[number, number]>
> {
  // 1. Anatomical Heart Contour (Axial 4-Chamber / Ventricular Apex Silhouette with AV groove indentations)
  const heart: Array<[number, number]> = [];
  const N = 72;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    // Parametric anatomical axial cardiac contour:
    // Bulges anterolaterally toward the left ventricular apex (+X, +Y),
    // rounded right atrium (-X), flat posterior LA border (-Y), and gentle interventricular / AV grooves
    const baseR =
      0.82 +
      0.16 * Math.cos(t - 0.65) - // Left ventricular apex prominence
      0.08 * Math.cos(2 * (t + 0.4)) + // Ovoid elongation along cardiac axis
      0.06 * Math.cos(3 * (t - 0.7)) - // Right atrial / RV outflow contour
      0.035 * Math.cos(4 * (t - 0.2)); // Subtle AV sulcus indentation
    const x = baseR * Math.cos(t) + 0.08 * Math.pow(Math.max(0, Math.sin(t)), 2);
    const y = baseR * Math.sin(t) - 0.05 * Math.cos(2 * t);
    heart.push([Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]);
  }

  // 2. Anatomical Right Lung (In radiological CT convention, patient's Right Lung is on viewer's Left (-X):
  // convex lateral costal wall on -X, flat/concave medial mediastinal wall on +X with hilar invagination)
  const lung_right: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    let x: number;
    const y = 0.95 * sinT - 0.06 * Math.sin(2 * t);

    if (cosT <= 0) {
      // Lateral costal pleura (smooth rib-cage curve)
      x = cosT * (0.96 + 0.06 * Math.sin(t));
    } else {
      // Medial mediastinal surface with hilar indentation around y = 0 and anterior/posterior rounding
      const hilarNotch = 0.42 * Math.exp(-Math.pow(sinT / 0.36, 2));
      const mediastinalFlat = 0.52 * cosT * (1 - hilarNotch);
      x = mediastinalFlat - 0.12 * Math.exp(-Math.pow((sinT + 0.1) / 0.32, 2));
    }
    lung_right.push([x, y]);
  }

  // 3. Anatomical Left Lung (Viewer's Right (+X): convex lateral costal wall on +X,
  // deep anteromedial Cardiac Notch on -X/+Y where the heart apex indents the left lung!)
  const lung_left: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    let x: number;
    const y = 0.95 * sinT - 0.05 * Math.sin(2 * t);

    if (cosT >= 0) {
      // Lateral costal pleura
      x = cosT * (0.96 + 0.05 * Math.sin(t));
    } else {
      // Medial mediastinal border with deep anterior Cardiac Notch (sinT > -0.15) + hilar indentation
      const cardiacNotch = 0.65 * Math.exp(-Math.pow((sinT - 0.28) / 0.42, 2));
      const hilarIndent = 0.35 * Math.exp(-Math.pow((sinT + 0.12) / 0.28, 2));
      x = cosT * 0.54 * (1 - Math.max(cardiacNotch, hilarIndent)) + 0.22 * cardiacNotch;
    }
    lung_left.push([x, y]);
  }

  // 4. Anatomical Left Cerebral Hemisphere (Viewer's Left (-X) or Right: D-shaped hemisphere
  // with flat medial longitudinal fissure, deep lateral Sylvian fissure, and cortical gyri/sulci undulations)
  const brain_left: Array<[number, number]> = [];
  const NB = 84;
  for (let i = 0; i < NB; i++) {
    const t = (i / NB) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const y = 0.96 * sinT;
    let x: number;

    if (cosT >= 0) {
      // Flat medial interhemispheric fissure wall (falx cerebri) with slight central corpus callosum indentation
      const callosalIndent = 0.16 * Math.exp(-Math.pow(sinT / 0.35, 2));
      x = 0.12 * cosT - callosalIndent;
    } else {
      // Lateral convex pial surface with cortical gyri/sulci ripples + deep Sylvian fissure at sinT ≈ 0.1
      const sylvianFissure = 0.26 * Math.exp(-Math.pow((sinT - 0.12) / 0.16, 2));
      const gyriRipples = 0.045 * Math.cos(11 * t) + 0.025 * Math.sin(17 * t);
      x = cosT * (0.95 - sylvianFissure + gyriRipples);
    }
    brain_left.push([x, y]);
  }

  // 5. Anatomical Right Cerebral Hemisphere (Mirror image of brain_left across X = 0)
  const brain_right: Array<[number, number]> = brain_left
    .map(([x, y]): [number, number] => [-x, y])
    .reverse();

  // 6. Butterfly-Shaped Cerebral Lateral Ventricles
  const brain_ventricle: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    // Twin anterior frontal horns & posterior trigones pinched at the midline septum pellucidum
    const pinch = 1 - 0.62 * Math.exp(-Math.pow(cosT / 0.34, 2));
    const wingFlare = 0.28 * Math.cos(2 * t);
    const x = 0.92 * cosT * (1 + 0.15 * sinT * sinT);
    const y = (0.78 * sinT * pinch + wingFlare * sinT) + 0.12 * cosT * cosT;
    brain_ventricle.push([x, Math.max(-1, Math.min(1, y))]);
  }

  // 7. Anatomical Thoracic Vertebra (Anterior rounded vertebral body, bilateral transverse processes,
  // posterior arch & sharp downward spinous process)
  const vertebra: Array<[number, number]> = [];
  for (let i = 0; i < NB; i++) {
    const t = (i / NB) * Math.PI * 2;
    // Angle t measured from +X: +Y (t=pi/2) is anterior vertebral body,
    // t=0 and t=pi are lateral transverse processes, t=3pi/2 (-Y) is long posterior spinous process
    const anteriorBody = 0.56 * Math.exp(-Math.pow(Math.atan2(Math.sin(t) - 1, Math.cos(t)) / 0.9, 2));
    const rightTransverse = 0.48 * Math.exp(-Math.pow((t - 0.15) / 0.24, 2)) + 0.48 * Math.exp(-Math.pow((t - Math.PI * 2 - 0.15) / 0.24, 2));
    const leftTransverse = 0.48 * Math.exp(-Math.pow((t - (Math.PI - 0.15)) / 0.24, 2));
    const spinousProcess = 0.68 * Math.exp(-Math.pow((t - 1.5 * Math.PI) / 0.18, 2));
    const r = Math.min(1.0, 0.36 + anteriorBody * 0.5 + rightTransverse + leftTransverse + spinousProcess);
    vertebra.push([r * Math.cos(t), r * Math.sin(t)]);
  }

  return {
    heart,
    lung_right,
    lung_left,
    brain_left,
    brain_right,
    brain_ventricle,
    vertebra,
  };
}

export const ANATOMICAL_CONTOURS = buildAnatomicalContours();

export const PHANTOM_PRESETS: PhantomPreset[] = [
  {
    id: 'anatomical-thorax-heart-lungs',
    name: 'Anatomical Thorax: Heart, Lungs & Spine',
    shortLabel: 'Heart & Lungs (CT)',
    subtitle: 'True anatomical right/left lungs with cardiac notch, 4-chamber heart, aorta & vertebra',
    description:
      'Authentic axial thoracic CT cross-section featuring anatomical Right and Left Lungs (with cardiac notch and hilar curvature), the oblique Heart with left/right ventricular chambers, descending thoracic aorta, sternum, rib cortex, and a realistic thoracic vertebra with spinous and transverse processes.',
    pedagogicalTakeaway:
      'Observe how the large aerated Left and Right Lungs (-720 HU) carve deep asymmetric attenuation valleys on either side of the dense central Heart (+45 to +320 HU) and posterior Vertebral Column (+1000 HU).',
    primitives: [
      {
        id: 'ath-body-wall',
        label: 'Thoracic Chest Wall',
        shape: 'ellipse',
        tissueType: 'soft_tissue',
        hu: 40,
        mu: huToMu(40),
        centerX: 0,
        centerY: 0,
        radiusX: 88,
        radiusY: 64,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ath-lung-right',
        label: 'Right Lung (Anatomical 3-Lobe Contour)',
        shape: 'lung_right',
        tissueType: 'lung',
        hu: -740,
        mu: huToMu(-740),
        centerX: -38,
        centerY: 2,
        radiusX: 36,
        radiusY: 46,
        tiltDeg: 4,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ath-lung-left',
        label: 'Left Lung (With Cardiac Notch)',
        shape: 'lung_left',
        tissueType: 'lung',
        hu: -740,
        mu: huToMu(-740),
        centerX: 38,
        centerY: 0,
        radiusX: 35,
        radiusY: 45,
        tiltDeg: -4,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ath-heart-myocardium',
        label: 'Heart (Myocardium & Pericardial Silhouette)',
        shape: 'heart',
        tissueType: 'soft_tissue',
        hu: 55,
        mu: huToMu(55),
        centerX: 11,
        centerY: 14,
        radiusX: 28,
        radiusY: 25,
        tiltDeg: 28,
        zCenterMm: 0,
        zThicknessMm: 18,
        visible: true,
      },
      {
        id: 'ath-lv-chamber',
        label: 'Left Ventricular Chamber (Contrast Blood)',
        shape: 'heart',
        tissueType: 'cancellous_bone',
        hu: 310,
        mu: huToMu(310),
        centerX: 17,
        centerY: 15,
        radiusX: 13,
        radiusY: 11,
        tiltDeg: 28,
        zCenterMm: 0,
        zThicknessMm: 16,
        visible: true,
      },
      {
        id: 'ath-rv-chamber',
        label: 'Right Ventricular Cavity',
        shape: 'brain_ventricle',
        tissueType: 'cancellous_bone',
        hu: 260,
        mu: huToMu(260),
        centerX: 2,
        centerY: 23,
        radiusX: 12,
        radiusY: 6.5,
        tiltDeg: -18,
        zCenterMm: 0,
        zThicknessMm: 16,
        visible: true,
      },
      {
        id: 'ath-descending-aorta',
        label: 'Descending Thoracic Aorta',
        shape: 'ellipse',
        tissueType: 'cancellous_bone',
        hu: 340,
        mu: huToMu(340),
        centerX: 12,
        centerY: -18,
        radiusX: 7.5,
        radiusY: 7.5,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ath-vertebra',
        label: 'Thoracic Vertebra (T7 Body & Spinous Process)',
        shape: 'vertebra',
        tissueType: 'cortical_bone',
        hu: 1050,
        mu: huToMu(1050),
        centerX: 0,
        centerY: -36,
        radiusX: 24,
        radiusY: 22,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'ath-sternum',
        label: 'Sternum Body (Cortical Bone)',
        shape: 'rectangle',
        tissueType: 'cortical_bone',
        hu: 920,
        mu: huToMu(920),
        centerX: 0,
        centerY: 54,
        radiusX: 12,
        radiusY: 4,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 18,
        visible: true,
      },
    ],
  },
  {
    id: 'anatomical-brain-ct',
    name: 'Anatomical Brain CT: Cortex, Gyri & Ventricles',
    shortLabel: 'Anatomical Brain',
    subtitle: 'Left & Right cerebral hemispheres with cortical gyri, Sylvian fissure & butterfly ventricles',
    description:
      'Detailed cranial CT slice replacing simplified circles with folded Left and Right Cerebral Hemispheres (featuring cortical sulci/gyri and the lateral Sylvian fissure), butterfly-shaped Lateral Ventricles filled with CSF, deep Basal Ganglia / Thalami, and a calcified Pineal Gland.',
    pedagogicalTakeaway:
      'Compare the high-attenuation cranial calvarium (+1050 HU) with the folded cerebral hemispheres (+42 HU), CSF-filled butterfly ventricles (0 HU), and the sub-slice pineal gland calcification (+1600 HU).',
    primitives: [
      {
        id: 'br-skull-outer',
        label: 'Cranial Calvarium (Skull Bone)',
        shape: 'ellipse',
        tissueType: 'cortical_bone',
        hu: 1080,
        mu: huToMu(1080),
        centerX: 0,
        centerY: 0,
        radiusX: 70,
        radiusY: 88,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'br-subarachnoid-csf',
        label: 'Subarachnoid CSF Space',
        shape: 'ellipse',
        tissueType: 'water',
        hu: 5,
        mu: huToMu(5),
        centerX: 0,
        centerY: 0,
        radiusX: 64,
        radiusY: 82,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'br-hemi-left',
        label: 'Left Cerebral Hemisphere (Gyri & Sulci)',
        shape: 'brain_left',
        tissueType: 'soft_tissue',
        hu: 45,
        mu: huToMu(45),
        centerX: -4,
        centerY: 0,
        radiusX: 59,
        radiusY: 78,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'br-hemi-right',
        label: 'Right Cerebral Hemisphere (Gyri & Sulci)',
        shape: 'brain_right',
        tissueType: 'soft_tissue',
        hu: 45,
        mu: huToMu(45),
        centerX: 4,
        centerY: 0,
        radiusX: 59,
        radiusY: 78,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'br-lateral-ventricles',
        label: 'Butterfly Lateral Ventricles (CSF)',
        shape: 'brain_ventricle',
        tissueType: 'lung',
        hu: -180,
        mu: huToMu(-180),
        centerX: 0,
        centerY: 6,
        radiusX: 26,
        radiusY: 32,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 16,
        visible: true,
      },
      {
        id: 'br-pineal-calc',
        label: 'Pineal Gland Calcification (Thin Z = 2.5 mm)',
        shape: 'ellipse',
        tissueType: 'titanium',
        hu: 1650,
        mu: huToMu(1650),
        centerX: 0,
        centerY: -18,
        radiusX: 5.5,
        radiusY: 5.5,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 2.5,
        visible: true,
      },
    ],
  },
  {
    id: 'anatomical-cardiac-ct',
    name: 'Focused Cardiac CT: Chambers, Septum & Coronary Plaque',
    shortLabel: 'Cardiac 4-Chamber',
    subtitle: 'High-resolution anatomical heart phantom with LV/RV myocardium, blood pool & LAD calcification',
    description:
      'Dedicated cardiac CT angiography (CCTA) phantom isolating the oblique heart silhouette, thick Left Ventricular Myocardium, contrast-opacified Left and Right Ventricular chambers, Ascending Aorta, and a thin-slice Left Anterior Descending (LAD) coronary calcification.',
    pedagogicalTakeaway:
      'Watch how the dense LAD Coronary Calcification (+1900 HU, dz = 2 mm) traces a sharp high-intensity sinusoid over the broad cardiac chamber profile—and see how increasing Slice Thickness Δz blurs its contrast via Partial Volume Averaging.',
    primitives: [
      {
        id: 'card-pericardium',
        label: 'Pericardial Sac & Epicardial Contour',
        shape: 'heart',
        tissueType: 'adipose',
        hu: -65,
        mu: huToMu(-65),
        centerX: 0,
        centerY: 0,
        radiusX: 68,
        radiusY: 60,
        tiltDeg: 24,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'card-myocardium',
        label: 'Ventricular Myocardium Wall',
        shape: 'heart',
        tissueType: 'soft_tissue',
        hu: 60,
        mu: huToMu(60),
        centerX: 2,
        centerY: 0,
        radiusX: 60,
        radiusY: 52,
        tiltDeg: 24,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'card-lv-lumen',
        label: 'Left Ventricle Blood Pool (Contrast)',
        shape: 'heart',
        tissueType: 'cancellous_bone',
        hu: 380,
        mu: huToMu(380),
        centerX: 16,
        centerY: 4,
        radiusX: 28,
        radiusY: 24,
        tiltDeg: 24,
        zCenterMm: 0,
        zThicknessMm: 18,
        visible: true,
      },
      {
        id: 'card-rv-lumen',
        label: 'Right Ventricle Crescent Chamber',
        shape: 'brain_ventricle',
        tissueType: 'cancellous_bone',
        hu: 290,
        mu: huToMu(290),
        centerX: -18,
        centerY: 16,
        radiusX: 25,
        radiusY: 14,
        tiltDeg: -22,
        zCenterMm: 0,
        zThicknessMm: 18,
        visible: true,
      },
      {
        id: 'card-aorta-root',
        label: 'Aortic Root (Outflow Tract)',
        shape: 'ellipse',
        tissueType: 'cancellous_bone',
        hu: 410,
        mu: huToMu(410),
        centerX: -4,
        centerY: -16,
        radiusX: 14,
        radiusY: 14,
        tiltDeg: 0,
        zCenterMm: 0,
        zThicknessMm: 20,
        visible: true,
      },
      {
        id: 'card-lad-plaque',
        label: 'LAD Coronary Calcified Plaque (dz = 2.0 mm)',
        shape: 'ellipse',
        tissueType: 'titanium',
        hu: 1950,
        mu: huToMu(1950),
        centerX: 8,
        centerY: 32,
        radiusX: 5.5,
        radiusY: 3.5,
        tiltDeg: 35,
        zCenterMm: 0,
        zThicknessMm: 2.0,
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
    id: 'partial-volume-z-slab',
    name: 'Axial Slice Thickness & Partial Volume Phantom',
    shortLabel: 'Slice Thickness (Δz)',
    subtitle: 'Sub-millimeter and thin-slab high-Z discs at staggered axial z-depths',
    description:
      'Designed specifically to teach the Partial Volume Artifact along the scanner z-axis. Contains four high-density structures with axial thicknesses of 1.5 mm, 3.0 mm, 6.0 mm, and 20.0 mm.',
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
 * with a rotated ellipse, rectangle, or non-convex anatomical organ polygon contour.
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
  }

  // Fast bounding-box check in [-a, +a] x [-b, +b]
  let tMin = 0;
  let tMax = rayLen;

  if (Math.abs(lux) < 1e-9) {
    if (lox < -a * 1.05 || lox > a * 1.05) return 0;
  } else {
    const tx1 = (-a * 1.05 - lox) / lux;
    const tx2 = (a * 1.05 - lox) / lux;
    tMin = Math.max(tMin, Math.min(tx1, tx2));
    tMax = Math.min(tMax, Math.max(tx1, tx2));
  }

  if (Math.abs(luy) < 1e-9) {
    if (loy < -b * 1.05 || loy > b * 1.05) return 0;
  } else {
    const ty1 = (-b * 1.05 - loy) / luy;
    const ty2 = (b * 1.05 - loy) / luy;
    tMin = Math.max(tMin, Math.min(ty1, ty2));
    tMax = Math.min(tMax, Math.max(ty1, ty2));
  }

  if (tMax <= tMin) return 0;

  if (prim.shape === 'rectangle') {
    // Exact box [-a, +a] x [-b, +b]
    let rMin = 0;
    let rMax = rayLen;
    if (Math.abs(lux) >= 1e-9) {
      const tx1 = (-a - lox) / lux;
      const tx2 = (a - lox) / lux;
      rMin = Math.max(rMin, Math.min(tx1, tx2));
      rMax = Math.min(rMax, Math.max(tx1, tx2));
    } else if (Math.abs(lox) > a) {
      return 0;
    }
    if (Math.abs(luy) >= 1e-9) {
      const ty1 = (-b - loy) / luy;
      const ty2 = (b - loy) / luy;
      rMin = Math.max(rMin, Math.min(ty1, ty2));
      rMax = Math.min(rMax, Math.max(ty1, ty2));
    } else if (Math.abs(loy) > b) {
      return 0;
    }
    return Math.max(0, rMax - rMin);
  }

  // Exact Ray-Polygon Intersection for Anatomical Organ Contours
  const contour = ANATOMICAL_CONTOURS[prim.shape];
  if (!contour || contour.length < 3) return 0;

  const hits: number[] = [];
  const nVerts = contour.length;

  for (let i = 0; i < nVerts; i++) {
    const p1 = contour[i];
    const p2 = contour[(i + 1) % nVerts];

    const xA = p1[0] * a;
    const yA = p1[1] * b;
    const ex = (p2[0] - p1[0]) * a;
    const ey = (p2[1] - p1[1]) * b;

    // Solve lox + t * lux = xA + s * ex, loy + t * luy = yA + s * ey
    const det = lux * ey - luy * ex;
    if (Math.abs(det) < 1e-10) continue;

    const rx = xA - lox;
    const ry = yA - loy;

    const sEdge = (lux * ry - luy * rx) / det;
    if (sEdge >= 0 && sEdge < 1) {
      const tRay = (ex * ry - ey * rx) / det;
      hits.push(tRay);
    }
  }

  if (hits.length < 2) return 0;
  hits.sort((u, v) => u - v);

  let totalChordMm = 0;
  for (let k = 0; k + 1 < hits.length; k += 2) {
    const segStart = Math.max(0, hits[k]);
    const segEnd = Math.min(rayLen, hits[k + 1]);
    if (segEnd > segStart) {
      totalChordMm += segEnd - segStart;
    }
  }

  return totalChordMm;
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
  }
  if (prim.shape === 'rectangle') {
    return Math.abs(lx) <= a && Math.abs(ly) <= b;
  }

  // Normalized coordinates (nx, ny) in [-1, 1]
  const nx = lx / a;
  const ny = ly / b;
  if (Math.abs(nx) > 1.05 || Math.abs(ny) > 1.05) return false;

  const contour = ANATOMICAL_CONTOURS[prim.shape];
  if (!contour) return false;

  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const xi = contour[i][0];
    const yi = contour[i][1];
    const xj = contour[j][0];
    const yj = contour[j][1];
    const intersect =
      yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes the 1D projection profile p_theta(s) for a given gantry angle.
 */
export function computeSingleProjection(
  primitives: PhantomPrimitive[],
  params: AcquisitionParams,
  angleDeg: number
): ProjectionResult {
  const fovRadiusMm = 100;
  const gantryDistanceMm = 118;
  const thetaRad = (angleDeg * Math.PI) / 180;
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  const visiblePrims = primitives.filter((p) => p.visible);

  // Determine parent enclosing primitive for each primitive so nested cavities/chambers replace background density accurately
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
    const u = (2 * k) / (numBins - 1) - 1;
    const sMm = u * fovRadiusMm;

    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    if (params.beamMode === 'parallel') {
      const dirX = -sinT;
      const dirY = cosT;
      x1 = sMm * cosT - gantryDistanceMm * dirX;
      y1 = sMm * sinT - gantryDistanceMm * dirY;
      x2 = sMm * cosT + gantryDistanceMm * dirX;
      y2 = sMm * sinT + gantryDistanceMm * dirY;
    } else {
      const dirX = -sinT;
      const dirY = cosT;
      const dSo = Math.max(130, params.sourceIsoDistMm);
      const maxGammaRad = ((params.fanAngleDeg * Math.PI) / 180) * 0.5;
      const gamma = u * maxGammaRad;

      const rayAngle = thetaRad + Math.PI / 2 + gamma;
      const rux = Math.cos(rayAngle);
      const ruy = Math.sin(rayAngle);

      const sx = -dSo * dirX;
      const sy = -dSo * dirY;

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
        const chordCm = chordMm / 10;
        sumAtten += netMu * chordCm;
        sumThinAtten += netThinMu * chordCm;
        primitiveContributions[prim.id][k] = Math.max(0, rawMu * chordCm);
      }
    }

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
    return x0 * cosT + y0 * sinT;
  } else {
    const dSo = Math.max(130, params.sourceIsoDistMm);
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
    const r = Math.round(255 * Math.min(1, Math.max(0, -0.35 + 1.45 * c * c)));
    const g = Math.round(255 * Math.min(1, Math.max(0, 0.05 + 0.9 * c)));
    const b = Math.round(
      255 * Math.min(1, Math.max(0, 0.33 + 0.8 * Math.sin(c * Math.PI * 0.85) - 0.35 * c))
    );
    return [r, g, b];
  }
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
