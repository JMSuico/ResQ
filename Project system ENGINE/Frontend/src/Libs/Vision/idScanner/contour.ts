/**
 * ResQTrack Incident AI System Detection -- DIP Core Geometry & Segmentation
 * Module: contour.ts
 *
 * Contour Approximation & Card Quad Segmentation:
 * - Topological border tracing algorithm (Moore-Neighbor border following)
 * - Recursive Ramer-Douglas-Peucker line simplification
 * - Cross-product convexity verification
 * - Shoelace formula polygon area calculation
 * - Multi-criteria ID card quadrilateral localization and scoring
 *
 * Standards:
 * - Strict TypeScript with ZERO 'any'
 * - 100% Universal Lambda syntax (`=>`)
 * - High-efficiency typed arrays (Uint8Array, Int32Array, Float64Array)
 */

import { Point2D, HoughLine, houghLines, clusterLines, findLineIntersections } from './cannyHough';
import { orderCorners } from './homography';

export interface CardQuadResult {
  corners: Point2D[];
  score: number;
  aspect: number;
}

/**
 * Traces topological borders of binary foreground components (values > 0)
 * using the 8-connected Moore-Neighbor border tracing algorithm.
 *
 * Returns an array of continuous contour loops, where each loop is an array of Point2D.
 */
export const traceContours = (
  binary: Uint8Array,
  width: number,
  height: number
): Point2D[][] => {
  const total = width * height;
  const visited = new Uint8Array(total);
  const contours: Point2D[][] = [];

  // Clockwise neighborhood offsets: Left, Top-Left, Top, Top-Right, Right, Bottom-Right, Bottom, Bottom-Left
  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x;
      if (binary[idx] === 0 || visited[idx] === 1) continue;

      // Check if this foreground pixel is on an outer/inner border (at least one 4-neighbor is 0)
      const isBorder =
        binary[rowOffset + (x - 1)] === 0 ||
        binary[rowOffset + (x + 1)] === 0 ||
        binary[(y - 1) * width + x] === 0 ||
        binary[(y + 1) * width + x] === 0;

      if (!isBorder) continue;

      // Start border tracing
      const startX = x;
      const startY = y;
      const contour: Point2D[] = [];

      let currX = startX;
      let currY = startY;
      let checkDir = 0; // Start searching from Left
      let steps = 0;
      const maxSteps = Math.max(1000, (width + height) * 4);

      do {
        contour.push({ x: currX, y: currY });
        visited[currY * width + currX] = 1;

        let foundNext = false;
        let nextX = currX;
        let nextY = currY;
        let nextDir = checkDir;

        for (let i = 0; i < 8; i++) {
          const dir = (checkDir + i) % 8;
          const nx = currX + dx[dir];
          const ny = currY + dy[dir];

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (binary[ny * width + nx] > 0) {
              nextX = nx;
              nextY = ny;
              // Backtrack entry direction for Jacob's stopping criterion
              nextDir = (dir + 5) % 8;
              foundNext = true;
              break;
            }
          }
        }

        if (!foundNext) {
          break;
        }

        currX = nextX;
        currY = nextY;
        checkDir = nextDir;
        steps++;
      } while (
        (currX !== startX || currY !== startY) &&
        steps < maxSteps
      );

      // Filter out micro-noise contours
      if (contour.length >= 8) {
        contours.push(contour);
      }
    }
  }

  return contours;
};

/**
 * Recursive Ramer-Douglas-Peucker line simplification algorithm.
 * Reduces the number of vertices in a polyline within an epsilon tolerance threshold.
 */
export const douglasPeucker = (
  points: Point2D[],
  epsilon: number
): Point2D[] => {
  if (points.length <= 2) {
    return points.slice();
  }

  let maxDist = 0;
  let index = 0;
  const pStart = points[0];
  const pEnd = points[points.length - 1];

  const dx = pEnd.x - pStart.x;
  const dy = pEnd.y - pStart.y;
  const lineLenSq = dx * dx + dy * dy;

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    let dist = 0;

    if (lineLenSq === 0) {
      dist = Math.hypot(pt.x - pStart.x, pt.y - pStart.y);
    } else {
      const num = Math.abs(
        dy * pt.x - dx * pt.y + pEnd.x * pStart.y - pEnd.y * pStart.x
      );
      dist = num / Math.sqrt(lineLenSq);
    }

    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [pStart, pEnd];
  }
};

/**
 * Simplifies a closed contour polygon using Douglas-Peucker by first splitting
 * at the maximum distance point from the origin.
 */
export const simplifyClosedContour = (
  contour: Point2D[],
  epsilon: number
): Point2D[] => {
  if (contour.length < 4) return contour.slice();

  // Find the point furthest from contour[0]
  const p0 = contour[0];
  let maxD = -1;
  let maxIdx = 0;

  for (let i = 1; i < contour.length; i++) {
    const d = Math.hypot(contour[i].x - p0.x, contour[i].y - p0.y);
    if (d > maxD) {
      maxD = d;
      maxIdx = i;
    }
  }

  if (maxIdx === 0 || maxIdx >= contour.length - 1) {
    return douglasPeucker(contour, epsilon);
  }

  // Split into two halves, simplify each, then concatenate
  const half1 = contour.slice(0, maxIdx + 1);
  const half2 = contour.slice(maxIdx).concat([p0]);

  const sim1 = douglasPeucker(half1, epsilon);
  const sim2 = douglasPeucker(half2, epsilon);

  const merged = sim1.slice(0, sim1.length - 1).concat(sim2.slice(0, sim2.length - 1));
  return merged;
};

/**
 * Computes polygon area using Gauss's Shoelace formula:
 * Area = 0.5 * |sum(x_i * y_{i+1} - x_{i+1} * y_i)|
 */
export const polygonArea = (pts: Point2D[]): number => {
  const n = pts.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) * 0.5;
};

/**
 * Verifies if a 4-vertex quadrilateral is convex using the sign of cross products:
 *   CP_i = (P_i - P_{prev}) x (P_{next} - P_i)
 * All cross products must have strictly the same non-zero sign.
 */
export const isQuadConvex = (pts: Point2D[]): boolean => {
  if (pts.length !== 4) return false;

  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const pPrev = pts[(i + 3) % 4];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % 4];

    const dx1 = pCurr.x - pPrev.x;
    const dy1 = pCurr.y - pPrev.y;
    const dx2 = pNext.x - pCurr.x;
    const dy2 = pNext.y - pCurr.y;

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) < 1e-5) {
      // Degenerate/collinear edge
      return false;
    }

    const currentSign = cross > 0 ? 1 : -1;
    if (sign === 0) {
      sign = currentSign;
    } else if (currentSign !== sign) {
      return false;
    }
  }

  return true;
};

/**
 * Bridges 1-2 pixel corner gaps in edge maps using 3x3 morphological closing (dilation).
 */
const closeEdgeGaps = (edges: Uint8Array, width: number, height: number): Uint8Array => {
  const total = width * height;
  const closed = new Uint8Array(total);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      if (edges[row + x] > 0) {
        closed[row + x] = 255;
        closed[row + (x - 1)] = 255;
        closed[row + (x + 1)] = 255;
        closed[(y - 1) * width + x] = 255;
        closed[(y + 1) * width + x] = 255;
      }
    }
  }

  return closed;
};

/**
 * Computes the 2D Convex Hull of a set of 2D points using Andrew's Monotone Chain algorithm (O(n log n)).
 */
export const computeConvexHull = (points: Point2D[]): Point2D[] => {
  if (points.length <= 3) {
    return points.slice();
  }

  // Sort points lexicographically by x, then y
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const n = sorted.length;
  const hull: Point2D[] = new Array(2 * n);
  let k = 0;

  // Build lower hull
  for (let i = 0; i < n; i++) {
    while (
      k >= 2 &&
      (hull[k - 1].x - hull[k - 2].x) * (sorted[i].y - hull[k - 2].y) -
        (hull[k - 1].y - hull[k - 2].y) * (sorted[i].x - hull[k - 2].x) <= 0
    ) {
      k--;
    }
    hull[k++] = sorted[i];
  }

  // Build upper hull
  for (let i = n - 2, t = k + 1; i >= 0; i--) {
    while (
      k >= t &&
      (hull[k - 1].x - hull[k - 2].x) * (sorted[i].y - hull[k - 2].y) -
        (hull[k - 1].y - hull[k - 2].y) * (sorted[i].x - hull[k - 2].x) <= 0
    ) {
      k--;
    }
    hull[k++] = sorted[i];
  }

  // Omit the duplicate closing vertex
  return hull.slice(0, Math.max(0, k - 1));
};

/**
 * Recovers the 4 dominant corner vertices from a convex hull polygon,
 * making card detection resilient to finger occlusions or chamfered edges.
 */
export const fitQuadFromHull = (hull: Point2D[]): Point2D[] | null => {
  if (hull.length < 4) {
    return null;
  }
  if (hull.length === 4) {
    return isQuadConvex(hull) ? hull : null;
  }

  // Progressively prune vertices that contribute the least area until 4 vertices remain
  const pts = hull.slice();
  while (pts.length > 4) {
    let minArea = Infinity;
    let removeIdx = 0;
    const m = pts.length;

    for (let i = 0; i < m; i++) {
      const pPrev = pts[(i - 1 + m) % m];
      const pCurr = pts[i];
      const pNext = pts[(i + 1) % m];

      const triangleArea = Math.abs(
        (pCurr.x - pPrev.x) * (pNext.y - pPrev.y) -
        (pNext.x - pPrev.x) * (pCurr.y - pPrev.y)
      ) * 0.5;

      if (triangleArea < minArea) {
        minArea = triangleArea;
        removeIdx = i;
      }
    }

    pts.splice(removeIdx, 1);
  }

  if (pts.length === 4 && isQuadConvex(pts)) {
    return pts;
  }
  return null;
};

export interface PerimeterEdgeSupportResult {
  totalSupport: number;
  sideSupports: number[];
  passed: boolean;
}

/**
 * Verifies whether a candidate quadrilateral has sufficient continuous edge support
 * along its 4 perimeter boundaries, preventing phantom Hough intersections on background clutter.
 */
export const computePerimeterEdgeSupport = (
  edges: Uint8Array,
  quad: Point2D[],
  width: number,
  height: number
): PerimeterEdgeSupportResult => {
  if (quad.length !== 4) {
    return { totalSupport: 0, sideSupports: [0, 0, 0, 0], passed: false };
  }

  const K = 32;
  const sideSupports: number[] = [0, 0, 0, 0];

  for (let m = 0; m < 4; m++) {
    const p1 = quad[m];
    const p2 = quad[(m + 1) % 4];
    let matchedSamples = 0;

    for (let k = 0; k < K; k++) {
      // Sample between 10% and 90% along the side to skip rounded corners or fingertips
      const t = 0.10 + 0.80 * (k / (K - 1));
      const sx = Math.round((1 - t) * p1.x + t * p2.x);
      const sy = Math.round((1 - t) * p1.y + t * p2.y);

      let foundEdge = false;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = sy + dy;
        if (ny < 0 || ny >= height) continue;
        const rowOff = ny * width;
        for (let dx = -2; dx <= 2; dx++) {
          const nx = sx + dx;
          if (nx < 0 || nx >= width) continue;
          if (edges[rowOff + nx] > 0) {
            foundEdge = true;
            break;
          }
        }
        if (foundEdge) break;
      }
      if (foundEdge) {
        matchedSamples++;
      }
    }
    sideSupports[m] = matchedSamples / K;
  }

  const totalSupport = (sideSupports[0] + sideSupports[1] + sideSupports[2] + sideSupports[3]) / 4;
  const strongSides = sideSupports.filter((s) => s >= 0.30).length;
  const passed = totalSupport >= 0.35 && (strongSides >= 2 || totalSupport >= 0.45);

  return { totalSupport, sideSupports, passed };
};

/**
 * Evaluates the interior region of candidate card quadrilateral for optical signatures:
 * - Projective bilinear sampling strictly inside the quad (zero border leakage)
 * - 12-zone spatial activity distribution (eliminates single-beam bunk beds & wall seams)
 * - Directional 2D stroke anisotropy (printed text and portraits have both H and V strokes)
 * - Illumination-adaptive Weber contrast threshold (passes dim/warm indoor IDs while rejecting blank walls)
 */
export const verifyCardInteriorSignature = (
  edges: Uint8Array,
  quad: Point2D[],
  width: number,
  height: number,
  gray?: Float32Array
): boolean => {
  if (quad.length !== 4) return false;

  const tl = quad[0];
  const tr = quad[1];
  const br = quad[2];
  const bl = quad[3];

  // Grid dimensions for bilinear interior sampling: 48 horizontal x 32 vertical = 1536 sample points
  const nu = 48;
  const nv = 32;
  const totalSamples = nu * nv;

  let rawEdgeHits = 0;
  const blockRows = 3;
  const blockCols = 4;
  const blockHits = new Int32Array(blockRows * blockCols);
  const blockCounts = new Int32Array(blockRows * blockCols);
  const blockLumSum = new Float64Array(blockRows * blockCols);
  const blockLumSq = new Float64Array(blockRows * blockCols);

  let sumLum = 0;
  let sumLumSq = 0;
  let gradU = 0;
  let gradV = 0;

  const rowLum = new Float32Array(nu);

  for (let iv = 0; iv < nv; iv++) {
    const v = 0.12 + 0.76 * (iv / (nv - 1));
    const blockR = Math.min(blockRows - 1, Math.floor((iv / nv) * blockRows));
    let prevColLum = 0;

    for (let iu = 0; iu < nu; iu++) {
      const u = 0.12 + 0.76 * (iu / (nu - 1));
      const blockC = Math.min(blockCols - 1, Math.floor((iu / nu) * blockCols));
      const blockIdx = blockR * blockCols + blockC;

      // Bilinear perspective mapping
      const px = Math.round((1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x);
      const py = Math.round((1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y);

      if (px < 0 || px >= width || py < 0 || py >= height) continue;

      const pIdx = py * width + px;
      if (edges[pIdx] > 0) {
        rawEdgeHits++;
        blockHits[blockIdx]++;
      }
      blockCounts[blockIdx]++;

      if (gray && gray.length === width * height) {
        const lum = gray[pIdx];
        sumLum += lum;
        sumLumSq += lum * lum;
        blockLumSum[blockIdx] += lum;
        blockLumSq[blockIdx] += lum * lum;

        if (iu > 0) {
          gradU += Math.abs(lum - prevColLum);
        }
        if (iv > 0) {
          gradV += Math.abs(lum - rowLum[iu]);
        }
        prevColLum = lum;
        rowLum[iu] = lum;
      }
    }
  }

  const rawEdgeRatio = rawEdgeHits / totalSamples;
  // Real ID cards have internal text lines, portrait, chip, or barcodes yielding >= 1.5% edge points
  if (rawEdgeRatio < 0.015 || rawEdgeRatio > 0.65) {
    return false;
  }

  // 12-Zone Spatial Distribution: Count blocks with active edge presence and local contrast
  let activeBlocks = 0;
  let sumBlockVar = 0;

  for (let b = 0; b < blockRows * blockCols; b++) {
    const count = blockCounts[b];
    if (count <= 0) continue;
    const bEdgeRatio = blockHits[b] / count;
    let bVar = 0;
    if (gray && gray.length === width * height) {
      const bMean = blockLumSum[b] / count;
      bVar = Math.max(0, blockLumSq[b] / count - bMean * bMean);
      sumBlockVar += bVar;
    }
    // Block is active if it has structural edges or variance
    if (bEdgeRatio >= 0.012 || bVar >= 25.0) {
      activeBlocks++;
    }
  }

  // A card has header, body, portrait and barcode spreading across multiple zones (>= 4 active zones).
  // A single linear wall shadow or bunk bed bar crosses only 1 or 2 blocks.
  if (activeBlocks < 4) {
    return false;
  }

  // If grayscale luminance buffer is provided, check contrast and 2D stroke anisotropy
  if (gray && gray.length === width * height) {
    const mean = sumLum / totalSamples;
    const globalVariance = Math.max(0, sumLumSq / totalSamples - mean * mean);
    const meanBlockVar = sumBlockVar / (blockRows * blockCols);

    // Illumination-adaptive variance threshold (calibrated for dim/warm indoor lighting)
    const minVar = Math.max(36.0, Math.min(120.0, 130.0 * Math.pow(mean / 128.0, 2)));

    if (globalVariance < minVar && meanBlockVar < 28.0) {
      return false;
    }

    // Directional stroke anisotropy: printed text and faces have both horizontal and vertical edges
    const maxGrad = Math.max(gradU, gradV);
    const minGrad = Math.min(gradU, gradV);
    if (maxGrad > 0) {
      const anisotropy = minGrad / (maxGrad + 1e-5);
      if (anisotropy < 0.16) {
        return false;
      }
    }
  }

  return true;
};

/**
 * Finds the optimal ID card quadrilateral candidate from a binary edge map anywhere in the camera feed.
 * Unconstrained full-frame detection:
 * 1. Finger-occlusion resilient convex-hull 4-corner extraction
 * 2. Multi-scale Douglas-Peucker contour simplification
 * 3. Multi-pair Hough line intersection grid search
 * 4. Projective bilinear interior text/stroke density & 12-zone spatial verification
 * 5. Full-frame area coverage [0.04, 0.96] anywhere in viewport
 *
 * Returns the highest scoring CardQuadResult or null if no valid card quad is detected.
 */
export const findCardQuad = (
  edges: Uint8Array,
  width: number,
  height: number,
  targetRatios: number[] = [1.5858, 1.4205, 1.25],
  gray?: Float32Array
): CardQuadResult | null => {
  const totalArea = width * height;
  const candidates: CardQuadResult[] = [];

  // Bridge small Canny corner gaps to form closed contours
  const bridgedEdges = closeEdgeGaps(edges, width, height);
  const contours = traceContours(bridgedEdges, width, height);

  for (const contour of contours) {
    // Calculate perimeter
    let perimeter = 0;
    for (let i = 0; i < contour.length; i++) {
      const next = contour[(i + 1) % contour.length];
      perimeter += Math.hypot(next.x - contour[i].x, next.y - contour[i].y);
    }

    if (perimeter < 70) continue;

    // Strategy A: Multi-scale Douglas-Peucker simplification
    const epsilons = [
      0.015 * perimeter,
      0.02 * perimeter,
      0.03 * perimeter,
      0.04 * perimeter,
      0.05 * perimeter,
      0.065 * perimeter,
    ];

    for (const eps of epsilons) {
      let quad = simplifyClosedContour(contour, eps);

      if (
        quad.length === 5 &&
        Math.hypot(quad[0].x - quad[4].x, quad[0].y - quad[4].y) < 14
      ) {
        quad = quad.slice(0, 4);
      }

      // If simplified contour has extra vertices (e.g. from holding fingers), apply convex hull quad fitting
      if (quad.length > 4 && quad.length <= 12) {
        const hull = computeConvexHull(quad);
        const fitted = fitQuadFromHull(hull);
        if (fitted && fitted.length === 4) {
          quad = fitted;
        }
      }

      if (quad.length !== 4) continue;

      const ordered = orderCorners(quad);
      const cleanQuad = [ordered.tl, ordered.tr, ordered.br, ordered.bl];

      if (!isQuadConvex(cleanQuad)) continue;

      const area = polygonArea(cleanQuad);
      const areaRatio = area / totalArea;
      // Allow card anywhere from 4% to 96% of the frame (full-frame unconstrained)
      if (areaRatio < 0.04 || areaRatio > 0.96) continue;

      // Compute side lengths & perspective symmetry
      const s0 = Math.hypot(cleanQuad[1].x - cleanQuad[0].x, cleanQuad[1].y - cleanQuad[0].y);
      const s1 = Math.hypot(cleanQuad[2].x - cleanQuad[1].x, cleanQuad[2].y - cleanQuad[1].y);
      const s2 = Math.hypot(cleanQuad[3].x - cleanQuad[2].x, cleanQuad[3].y - cleanQuad[2].y);
      const s3 = Math.hypot(cleanQuad[0].x - cleanQuad[3].x, cleanQuad[0].y - cleanQuad[3].y);

      const oppRatio02 = Math.min(s0, s2) / Math.max(s0, s2);
      const oppRatio13 = Math.min(s1, s3) / Math.max(s1, s3);
      if (oppRatio02 < 0.55 || oppRatio13 < 0.55) continue;

      const avgW = (s0 + s2) * 0.5;
      const avgH = (s1 + s3) * 0.5;
      if (avgW <= 0 || avgH <= 0) continue;

      const aspect = Math.max(avgW, avgH) / Math.min(avgW, avgH);
      if (aspect < 1.16 || aspect > 2.10) continue;

      // Check corner angles
      let validAngles = true;
      for (let i = 0; i < 4; i++) {
        const prev = cleanQuad[(i + 3) % 4];
        const curr = cleanQuad[i];
        const next = cleanQuad[(i + 1) % 4];
        const v1x = prev.x - curr.x;
        const v1y = prev.y - curr.y;
        const v2x = next.x - curr.x;
        const v2y = next.y - curr.y;
        const dot = v1x * v2x + v1y * v2y;
        const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
        if (mag > 0) {
          const cosAngle = Math.abs(dot / mag);
          if (cosAngle > 0.58) {
            validAngles = false;
            break;
          }
        }
      }
      if (!validAngles) continue;

      // Check aspect ratio match against targets
      let minDiff = Infinity;
      for (const tr of targetRatios) {
        const diff = Math.abs(aspect - tr) / tr;
        if (diff < minDiff) minDiff = diff;
      }

      const aspectScore = Math.max(0, 1.0 - minDiff * 2.8);
      // Plateau area score
      const areaScore =
        areaRatio < 0.10
          ? (areaRatio - 0.04) / 0.06
          : areaRatio <= 0.78
          ? 1.0
          : Math.max(0, (0.96 - areaRatio) / 0.18);

      // Check perimeter edge support
      const edgeSupport = computePerimeterEdgeSupport(bridgedEdges, cleanQuad, width, height);
      if (edgeSupport.totalSupport < 0.38) continue;

      // Strictly verify interior text-stroke & graphic content using raw edges
      const hasValidInterior = verifyCardInteriorSignature(edges, cleanQuad, width, height, gray);
      if (!hasValidInterior) continue;

      const score =
        0.35 * aspectScore +
        0.30 * edgeSupport.totalSupport +
        0.20 * 1.0 +
        0.15 * areaScore;
      candidates.push({ corners: cleanQuad, score, aspect });
    }

    // Strategy B: Direct Convex Hull of contour (widened range for full-frame support)
    if (contour.length >= 40 && contour.length <= 3600) {
      const hull = computeConvexHull(contour);
      const fitted = fitQuadFromHull(hull);
      if (fitted && fitted.length === 4) {
        const ordered = orderCorners(fitted);
        const cleanQuad = [ordered.tl, ordered.tr, ordered.br, ordered.bl];

        if (isQuadConvex(cleanQuad)) {
          const area = polygonArea(cleanQuad);
          const areaRatio = area / totalArea;

          if (areaRatio >= 0.04 && areaRatio <= 0.96) {
            const s0 = Math.hypot(cleanQuad[1].x - cleanQuad[0].x, cleanQuad[1].y - cleanQuad[0].y);
            const s1 = Math.hypot(cleanQuad[2].x - cleanQuad[1].x, cleanQuad[2].y - cleanQuad[1].y);
            const s2 = Math.hypot(cleanQuad[3].x - cleanQuad[2].x, cleanQuad[3].y - cleanQuad[2].y);
            const s3 = Math.hypot(cleanQuad[0].x - cleanQuad[3].x, cleanQuad[0].y - cleanQuad[3].y);

            const oppRatio02 = Math.min(s0, s2) / Math.max(s0, s2);
            const oppRatio13 = Math.min(s1, s3) / Math.max(s1, s3);
            if (oppRatio02 >= 0.55 && oppRatio13 >= 0.55) {
              const avgW = (s0 + s2) * 0.5;
              const avgH = (s1 + s3) * 0.5;
              const aspect = Math.max(avgW, avgH) / Math.min(avgW, avgH);

              if (aspect >= 1.16 && aspect <= 2.10) {
                let validAngles = true;
                for (let i = 0; i < 4; i++) {
                  const prev = cleanQuad[(i + 3) % 4];
                  const curr = cleanQuad[i];
                  const next = cleanQuad[(i + 1) % 4];
                  const dot = (prev.x - curr.x) * (next.x - curr.x) + (prev.y - curr.y) * (next.y - curr.y);
                  const mag = Math.hypot(prev.x - curr.x, prev.y - curr.y) * Math.hypot(next.x - curr.x, next.y - curr.y);
                  if (mag > 0 && Math.abs(dot / mag) > 0.58) {
                    validAngles = false;
                    break;
                  }
                }

                if (validAngles) {
                  let minDiff = Infinity;
                  for (const tr of targetRatios) {
                    const diff = Math.abs(aspect - tr) / tr;
                    if (diff < minDiff) minDiff = diff;
                  }

                  const aspectScore = Math.max(0, 1.0 - minDiff * 2.8);
                  const areaScore =
                    areaRatio < 0.10
                      ? (areaRatio - 0.04) / 0.06
                      : areaRatio <= 0.78
                      ? 1.0
                      : Math.max(0, (0.96 - areaRatio) / 0.18);
                  const edgeSupport = computePerimeterEdgeSupport(bridgedEdges, cleanQuad, width, height);

                  if (edgeSupport.totalSupport >= 0.38) {
                    const hasValidInterior = verifyCardInteriorSignature(edges, cleanQuad, width, height, gray);
                    if (hasValidInterior) {
                      const score =
                        0.35 * aspectScore +
                        0.30 * edgeSupport.totalSupport +
                        0.20 * 1.0 +
                        0.15 * areaScore;
                      candidates.push({ corners: cleanQuad, score, aspect });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Strategy C: Multi-pair Hough line intersection grid search
  if (candidates.length === 0 || candidates.every((c) => c.score < 0.45)) {
    const lines = houghLines(edges, width, height, 0.18);
    const { horizontal, vertical } = clusterLines(lines);

    if (horizontal.length >= 2 && vertical.length >= 2) {
      const topH = horizontal.slice(0, Math.min(4, horizontal.length));
      const topV = vertical.slice(0, Math.min(4, vertical.length));

      // Test pairs of horizontal and vertical lines
      for (let hi = 0; hi < topH.length - 1; hi++) {
        for (let hj = hi + 1; hj < topH.length; hj++) {
          for (let vi = 0; vi < topV.length - 1; vi++) {
            for (let vj = vi + 1; vj < topV.length; vj++) {
              const pairH = [topH[hi], topH[hj]];
              const pairV = [topV[vi], topV[vj]];
              const pts = findLineIntersections(pairH, pairV, width, height);

              if (pts.length === 4) {
                const ordered = orderCorners(pts);
                const quad = [ordered.tl, ordered.tr, ordered.br, ordered.bl];

                if (isQuadConvex(quad)) {
                  const area = polygonArea(quad);
                  const areaRatio = area / totalArea;

                  if (areaRatio >= 0.04 && areaRatio <= 0.96) {
                    const s0 = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
                    const s1 = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);
                    const s2 = Math.hypot(quad[3].x - quad[2].x, quad[3].y - quad[2].y);
                    const s3 = Math.hypot(quad[0].x - quad[3].x, quad[0].y - quad[3].y);

                    const oppRatio02 = Math.min(s0, s2) / Math.max(s0, s2);
                    const oppRatio13 = Math.min(s1, s3) / Math.max(s1, s3);
                    if (oppRatio02 >= 0.55 && oppRatio13 >= 0.55) {
                      const avgW = (s0 + s2) * 0.5;
                      const avgH = (s1 + s3) * 0.5;
                      const aspect = Math.max(avgW, avgH) / Math.min(avgW, avgH);

                      if (aspect >= 1.16 && aspect <= 2.10) {
                        let minDiff = Infinity;
                        for (const tr of targetRatios) {
                          const diff = Math.abs(aspect - tr) / tr;
                          if (diff < minDiff) minDiff = diff;
                        }

                        const aspectScore = Math.max(0, 1.0 - minDiff * 2.8);
                        const areaScore =
                          areaRatio < 0.10
                            ? (areaRatio - 0.04) / 0.06
                            : areaRatio <= 0.78
                            ? 1.0
                            : Math.max(0, (0.96 - areaRatio) / 0.18);

                        const edgeSupport = computePerimeterEdgeSupport(bridgedEdges, quad, width, height);
                        if (edgeSupport.totalSupport >= 0.38) {
                          const hasValidInterior = verifyCardInteriorSignature(edges, quad, width, height, gray);
                          if (hasValidInterior) {
                            const score =
                              0.35 * aspectScore +
                              0.30 * edgeSupport.totalSupport +
                              0.20 * 1.0 +
                              0.15 * areaScore;
                            candidates.push({ corners: quad, score, aspect });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
};
