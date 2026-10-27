/**
 * High-Fidelity WAEC Exam Sheet Fixture
 * Generates an authentic West African Examinations Council (WASSCE)
 * General Mathematics Paper 2 sheet with 4 distinct multi-equation questions.
 *
 * Production Safeguards:
 * - Deterministic SVG canvas rendering (works both server and client side)
 * - Calibrated bounding boxes matching SAM 3.1 coordinate normalization [0.0 - 1.0]
 * - Ground-truth LaTeX transcriptions for judge verification
 */

import { SAMSegment } from '@solvam/shared-types';

export interface WaecExamSheetFixture {
  id: string;
  title: string;
  examBody: string;
  subject: string;
  year: string;
  svgDataUri: string;
  segments: SAMSegment[];
}

export const WAEC_2024_GROUND_TRUTH_SEGMENTS: SAMSegment[] = [
  {
    id: 'seg_waec_2024_q1a',
    label: 'Question 1(a): Quadratic Equation (Factorisation)',
    boundingBox: {
      yMin: 0.16,
      xMin: 0.06,
      yMax: 0.32,
      xMax: 0.94,
    },
    confidence: 0.985,
    latexPreview: '3x^2 - 5x - 2 = 0',
  },
  {
    id: 'seg_waec_2024_q1b',
    label: 'Question 1(b): Simultaneous Linear Equations',
    boundingBox: {
      yMin: 0.35,
      xMin: 0.06,
      yMax: 0.52,
      xMax: 0.94,
    },
    confidence: 0.968,
    latexPreview: '\\begin{cases} 2x + 3y = 12 \\\\ 5x - y = 13 \\end{cases}',
  },
  {
    id: 'seg_waec_2024_q2',
    label: 'Question 2: Indices & Exponential Equation',
    boundingBox: {
      yMin: 0.55,
      xMin: 0.06,
      yMax: 0.72,
      xMax: 0.94,
    },
    confidence: 0.952,
    latexPreview: '3^{2x+1} - 28(3^x) + 9 = 0',
  },
  {
    id: 'seg_waec_2024_q3',
    label: 'Question 3: Mensuration of Circle Sector',
    boundingBox: {
      yMin: 0.75,
      xMin: 0.06,
      yMax: 0.93,
      xMax: 0.94,
    },
    confidence: 0.939,
    latexPreview: 'P = 2r + \\frac{\\theta}{360} \\times 2\\pi r, \\quad r=7\\text{ cm}, \\theta=60^\\circ',
  },
];

/**
 * Generates an authentic SVG vector representation of a WAEC exam sheet.
 * Dimensions: 800 x 1100 px (standard A4 aspect ratio).
 */
export function generateWaecExamSheetSvg(): string {
  const width = 800;
  const height = 1100;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Page Background (Authentic Exam Paper Texture) -->
  <rect width="100%" height="100%" fill="#FBFBF8" stroke="#D1D5DB" stroke-width="2"/>

  <!-- WAEC Official Exam Header -->
  <g font-family="serif" text-anchor="middle" fill="#111827">
    <text x="400" y="42" font-size="14" font-weight="bold" letter-spacing="2">THE WEST AFRICAN EXAMINATIONS COUNCIL</text>
    <text x="400" y="64" font-size="18" font-weight="900" letter-spacing="1">WEST AFRICAN SENIOR SCHOOL CERTIFICATE EXAMINATION</text>
    <text x="400" y="85" font-size="13" font-weight="bold">GENERAL MATHEMATICS (CORE) 2 — THEORY</text>
    <text x="400" y="103" font-size="11" font-style="italic" fill="#4B5563">MAY/JUNE 2024 • 2½ HOURS • SECTION A</text>
    <line x1="60" y1="115" x2="740" y2="115" stroke="#111827" stroke-width="1.5"/>
  </g>

  <!-- Exam Instructions -->
  <text x="60" y="138" font-family="sans-serif" font-size="11" font-weight="bold" fill="#374151">Answer all questions in this section. All questions carry equal marks.</text>

  <!-- Question 1(a): Quadratic Equation -->
  <!-- Target Box: yMin: 0.16 (176px), yMax: 0.32 (352px) -->
  <g transform="translate(60, 180)" font-family="serif" fill="#111827">
    <text x="0" y="24" font-size="16" font-weight="bold">1. (a)</text>
    <text x="50" y="24" font-size="15">Solve the quadratic equation by factorisation:</text>
    <text x="140" y="65" font-size="22" font-weight="bold" font-family="'Times New Roman', serif" font-style="italic">3x² - 5x - 2 = 0</text>
    <text x="50" y="105" font-size="13" fill="#4B5563" font-family="sans-serif">Show all working clearly. State both roots of the equation.</text>
    <text x="620" y="105" font-size="12" font-weight="bold" fill="#047857" font-family="sans-serif">[5 marks]</text>
  </g>
  <line x1="60" y1="360" x2="740" y2="360" stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Question 1(b): Simultaneous Equations -->
  <!-- Target Box: yMin: 0.35 (385px), yMax: 0.52 (572px) -->
  <g transform="translate(60, 390)" font-family="serif" fill="#111827">
    <text x="0" y="24" font-size="16" font-weight="bold">(b)</text>
    <text x="50" y="24" font-size="15">Solve simultaneously the pair of linear equations:</text>
    <g transform="translate(140, 45)" font-family="'Times New Roman', serif" font-size="20" font-weight="bold" font-style="italic">
      <text x="0" y="20">2x + 3y = 12</text>
      <text x="0" y="48">5x - y = 13</text>
    </g>
    <text x="50" y="125" font-size="13" fill="#4B5563" font-family="sans-serif">Hence, find the numerical value of (x + 2y).</text>
    <text x="620" y="125" font-size="12" font-weight="bold" fill="#047857" font-family="sans-serif">[5 marks]</text>
  </g>
  <line x1="60" y1="580" x2="740" y2="580" stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Question 2: Indices & Exponential Equation -->
  <!-- Target Box: yMin: 0.55 (605px), yMax: 0.72 (792px) -->
  <g transform="translate(60, 610)" font-family="serif" fill="#111827">
    <text x="0" y="24" font-size="16" font-weight="bold">2.</text>
    <text x="50" y="24" font-size="15">Given the exponential equation:</text>
    <text x="140" y="65" font-size="22" font-weight="bold" font-family="'Times New Roman', serif" font-style="italic">3²ˣ⁺¹ - 28(3ˣ) + 9 = 0</text>
    <text x="50" y="105" font-size="13" fill="#4B5563" font-family="sans-serif">Find the real values of x satisfying the equation.</text>
    <text x="620" y="105" font-size="12" font-weight="bold" fill="#047857" font-family="sans-serif">[8 marks]</text>
  </g>
  <line x1="60" y1="800" x2="740" y2="800" stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,4"/>

  <!-- Question 3: Mensuration of Circle Sector -->
  <!-- Target Box: yMin: 0.75 (825px), yMax: 0.93 (1023px) -->
  <g transform="translate(60, 830)" font-family="serif" fill="#111827">
    <text x="0" y="24" font-size="16" font-weight="bold">3.</text>
    <text x="50" y="24" font-size="15">A sector of a circle of radius 7 cm subtends an angle of 60° at the centre.</text>
    <g transform="translate(140, 50)" font-family="'Times New Roman', serif" font-size="18" font-style="italic">
      <text x="0" y="15">Take π = 22/7. Calculate:</text>
      <text x="20" y="42">(i) The length of the arc of the sector</text>
      <text x="20" y="68">(ii) The perimeter of the complete sector</text>
    </g>
    <text x="620" y="140" font-size="12" font-weight="bold" fill="#047857" font-family="sans-serif">[7 marks]</text>
  </g>

  <!-- Page Footer -->
  <text x="400" y="1075" font-family="sans-serif" font-size="10" text-anchor="middle" fill="#9CA3AF">Turn Over • WASSCE 2024 MATHEMATICS 2 • STRICT CONFIDENTIAL EXAM COPY</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getSampleWaecExamSheet(): WaecExamSheetFixture {
  return {
    id: 'waec-2024-paper-2',
    title: 'WASSCE 2024 General Mathematics Paper 2 (Theory)',
    examBody: 'West African Examinations Council (WAEC)',
    subject: 'General Mathematics (Core)',
    year: '2024',
    svgDataUri: generateWaecExamSheetSvg(),
    segments: WAEC_2024_GROUND_TRUTH_SEGMENTS,
  };
}
