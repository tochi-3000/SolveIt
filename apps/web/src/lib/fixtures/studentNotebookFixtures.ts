/**
 * High-Fidelity Student Handwritten Notebook Fixtures
 * Generates authentic ruled notebook sheets with handwritten math working
 * for testing the "Red-Pen" Handwritten Grader.
 *
 * Production Safeguards:
 * - Deterministic SVG canvas rendering (works both server and client side)
 * - Calibrated vertical bounding boxes matching line segmentation coordinates [0.0 - 1.0]
 * - Exact ground-truth steps for instant judge demonstration
 */

import { HandwrittenGradedLine, BoundingBox } from '@solvam/shared-types';

export interface StudentNotebookFixture {
  id: string;
  title: string;
  originalProblem: string;
  isFullyCorrect: boolean;
  waecScoreEarned: number;
  waecScoreTotal: number;
  svgDataUri: string;
  lines: HandwrittenGradedLine[];
  pedagogicalSummary: string;
}

/**
 * Generates an authentic SVG vector representation of a student lined exercise notebook.
 * Dimensions: 800 x 1000 px.
 */
export function generateStudentNotebookSvg(options: {
  problemHeader: string;
  steps: string[];
  hasErrorOnLine2?: boolean;
}): string {
  const { problemHeader, steps, hasErrorOnLine2 = false } = options;
  const width = 800;
  const height = 1000;

  // Render ruled notebook lines every 50px
  let ruledLines = '';
  for (let y = 140; y < height - 50; y += 50) {
    ruledLines += `<line x1="40" y1="${y}" x2="760" y2="${y}" stroke="#CBD5E1" stroke-width="1.2" opacity="0.8"/>\n`;
  }

  // Render student handwriting lines
  let stepSvgElements = '';
  const startY = 220;
  const stepGap = 110;

  steps.forEach((st, idx) => {
    const yPos = startY + idx * stepGap;
    const isError = hasErrorOnLine2 && idx === 1;
    const inkColor = isError ? '#1E3A8A' : '#1E293B'; // Student writes with classic blue/black Bic pen

    stepSvgElements += `
    <g transform="translate(180, ${yPos})">
      <text x="0" y="0" font-family="'Caveat', 'Comic Sans MS', 'Segoe Print', cursive, sans-serif" font-size="28" font-weight="600" fill="${inkColor}" letter-spacing="1">
        ${st}
      </text>
    </g>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Notebook Page Background (Cream Feint Ruled Paper) -->
  <rect width="100%" height="100%" fill="#FCFAF2" stroke="#E2E8F0" stroke-width="2"/>

  <!-- Left Red Margin Line -->
  <line x1="140" y1="0" x2="140" y2="${height}" stroke="#F87171" stroke-width="2"/>

  <!-- Top Margin Double Header Line -->
  <line x1="0" y1="110" x2="${width}" y2="110" stroke="#94A3B8" stroke-width="1.5"/>

  <!-- Ruled Blue Lines -->
  ${ruledLines}

  <!-- Page Header (Student Handwriting) -->
  <g font-family="'Caveat', 'Comic Sans MS', cursive, sans-serif" fill="#475569">
    <text x="160" y="60" font-size="20" font-weight="bold">Date: 27th May, 2024</text>
    <text x="520" y="60" font-size="20" font-weight="bold">WASSCE Mock Practice</text>
    <text x="160" y="95" font-size="22" font-weight="bold" fill="#0F172A">Question 1(a): ${problemHeader}</text>
  </g>

  <!-- Left Margin Annotations (Line Indicators) -->
  <g font-family="sans-serif" font-size="12" font-weight="bold" fill="#94A3B8" text-anchor="end">
    <text x="125" y="220">Line 1</text>
    <text x="125" y="330">Line 2</text>
    <text x="125" y="440">Line 3</text>
    <text x="125" y="550">Line 4</text>
    <text x="125" y="660">Line 5</text>
  </g>

  <!-- Student Handwritten Working -->
  ${stepSvgElements}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Sample 1: The Classic Student Flawed Solution (Sign Mistake on Line 2)
 */
export function getFlawedStudentNotebookFixture(): StudentNotebookFixture {
  const steps = [
    '3x² - 5x - 2 = 0',
    '3x² - 6x - x - 2 = 0', // The error: -6x - x = -7x, not -5x
    '3x(x - 2) - 1(x + 2) = 0',
    '(3x - 1)(x + 2) = 0',
    'x = 1/3  or  x = -2',
  ];

  const lines: HandwrittenGradedLine[] = [
    {
      lineIndex: 1,
      boundingBox: { yMin: 0.17, xMin: 0.16, yMax: 0.27, xMax: 0.88 },
      rawText: '3x^2 - 5x - 2 = 0',
      latex: '3x^2 - 5x - 2 = 0',
      isMathematicallyValid: true,
      waecMark: 'M1',
      feedback: 'Original problem statement correctly transcribed in standard quadratic form ax² + bx + c = 0.',
      errorType: null,
    },
    {
      lineIndex: 2,
      boundingBox: { yMin: 0.28, xMin: 0.16, yMax: 0.38, xMax: 0.88 },
      rawText: '3x^2 - 6x - x - 2 = 0',
      latex: '3x^2 - 6x - x - 2 = 0',
      isMathematicallyValid: false,
      waecMark: 'M0',
      feedback: 'Sign Error: You split -5x into -6x - x, which sums to -7x (not -5x). The correct split is -6x + x = -5x.',
      errorType: 'sign_error',
    },
    {
      lineIndex: 3,
      boundingBox: { yMin: 0.39, xMin: 0.16, yMax: 0.49, xMax: 0.88 },
      rawText: '3x(x - 2) - 1(x + 2) = 0',
      latex: '3x(x - 2) - 1(x + 2) = 0',
      isMathematicallyValid: false,
      waecMark: 'M0',
      feedback: 'Consequential Error: Grouping cannot succeed because brackets (x - 2) and (x + 2) do not match.',
      errorType: 'expansion_error',
    },
    {
      lineIndex: 4,
      boundingBox: { yMin: 0.50, xMin: 0.16, yMax: 0.60, xMax: 0.88 },
      rawText: '(3x - 1)(x + 2) = 0',
      latex: '(3x - 1)(x + 2) = 0',
      isMathematicallyValid: false,
      waecMark: 'M0',
      feedback: 'Invalid factorization due to earlier sign mistake on Line 2.',
      errorType: 'expansion_error',
    },
    {
      lineIndex: 5,
      boundingBox: { yMin: 0.61, xMin: 0.16, yMax: 0.71, xMax: 0.88 },
      rawText: 'x = 1/3 or x = -2',
      latex: 'x = \\frac{1}{3} \\quad \\text{or} \\quad x = -2',
      isMathematicallyValid: false,
      waecMark: 'M0',
      feedback: 'Incorrect roots. Verified roots are x = -1/3 or x = 2.',
      errorType: 'root_inversion',
    },
  ];

  return {
    id: 'flawed_student_notebook_sign_error',
    title: 'Student Work Sample A (Sign Mistake on Line 2)',
    originalProblem: '3x^2 - 5x - 2 = 0',
    isFullyCorrect: false,
    waecScoreEarned: 1,
    waecScoreTotal: 5,
    svgDataUri: generateStudentNotebookSvg({
      problemHeader: 'Solve 3x² - 5x - 2 = 0',
      steps,
      hasErrorOnLine2: true,
    }),
    lines,
    pedagogicalSummary:
      'Step-level sign mistake identified on Line 2. The student earned 1/5 Method Marks for the initial standard form equation, but lost subsequent M1 and A1 marks due to splitting -5x into -6x - x instead of -6x + x.',
  };
}

/**
 * Sample 2: 100% Mathematically Rigorous Student Solution
 */
export function getCorrectStudentNotebookFixture(): StudentNotebookFixture {
  const steps = [
    '3x² - 5x - 2 = 0',
    '3x² - 6x + x - 2 = 0',
    '3x(x - 2) + 1(x - 2) = 0',
    '(3x + 1)(x - 2) = 0',
    'x = -1/3  or  x = 2',
  ];

  const lines: HandwrittenGradedLine[] = [
    {
      lineIndex: 1,
      boundingBox: { yMin: 0.17, xMin: 0.16, yMax: 0.27, xMax: 0.88 },
      rawText: '3x^2 - 5x - 2 = 0',
      latex: '3x^2 - 5x - 2 = 0',
      isMathematicallyValid: true,
      waecMark: 'M1',
      feedback: 'Original problem statement correctly set to standard form.',
      errorType: null,
    },
    {
      lineIndex: 2,
      boundingBox: { yMin: 0.28, xMin: 0.16, yMax: 0.38, xMax: 0.88 },
      rawText: '3x^2 - 6x + x - 2 = 0',
      latex: '3x^2 - 6x + x - 2 = 0',
      isMathematicallyValid: true,
      waecMark: 'M1',
      feedback: 'Correct factor split: (-6)(+1) = -6 (ac) and (-6) + (+1) = -5 (b). Method Mark [M1] secured.',
      errorType: null,
    },
    {
      lineIndex: 3,
      boundingBox: { yMin: 0.39, xMin: 0.16, yMax: 0.49, xMax: 0.88 },
      rawText: '3x(x - 2) + 1(x - 2) = 0',
      latex: '3x(x - 2) + 1(x - 2) = 0',
      isMathematicallyValid: true,
      waecMark: 'M1',
      feedback: 'Grouping executed correctly with matching common binomial factor (x - 2).',
      errorType: null,
    },
    {
      lineIndex: 4,
      boundingBox: { yMin: 0.50, xMin: 0.16, yMax: 0.60, xMax: 0.88 },
      rawText: '(3x + 1)(x - 2) = 0',
      latex: '(3x + 1)(x - 2) = 0',
      isMathematicallyValid: true,
      waecMark: 'M1',
      feedback: 'Factored equation valid and equivalent to original problem.',
      errorType: null,
    },
    {
      lineIndex: 5,
      boundingBox: { yMin: 0.61, xMin: 0.16, yMax: 0.71, xMax: 0.88 },
      rawText: 'x = -1/3 or x = 2',
      latex: 'x = -\\frac{1}{3} \\quad \\text{or} \\quad x = 2',
      isMathematicallyValid: true,
      waecMark: 'A1',
      feedback: 'Both roots mathematically exact and verified by SymPy. Full Accuracy Mark [A1] awarded.',
      errorType: null,
    },
  ];

  return {
    id: 'correct_student_notebook_rigorous',
    title: 'Student Work Sample B (100% Mathematically Rigorous)',
    originalProblem: '3x^2 - 5x - 2 = 0',
    isFullyCorrect: true,
    waecScoreEarned: 5,
    waecScoreTotal: 5,
    svgDataUri: generateStudentNotebookSvg({
      problemHeader: 'Solve 3x² - 5x - 2 = 0',
      steps,
      hasErrorOnLine2: false,
    }),
    lines,
    pedagogicalSummary:
      'Full 5/5 Marks awarded! The student demonstrated complete mathematical rigor with zero arithmetic slips, securing all Method Marks [M1] and final Accuracy Marks [A1].',
  };
}
