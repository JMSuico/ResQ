/**
 * ResQTrack Classical ID Scanner Connected Component Labeling (CCL) & Layout Analysis
 * Pure zero-ML two-pass union-find algorithm with 8-connectivity.
 * 100% universal lambda syntax, zero 'any', high-performance typed arrays.
 */

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
}

export interface CharBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextLine {
  x: number;
  y: number;
  w: number;
  h: number;
  charBoxes: CharBox[];
}

export interface WordBox {
  x: number;
  y: number;
  w: number;
  h: number;
  charBoxes: CharBox[];
}

export interface ConnectedComponentsResult {
  labels: Int32Array;
  count: number;
  boxes: BoundingBox[];
}

/**
 * Union-Find root lookup with path compression.
 */
const findRoot = (parent: Int32Array, label: number): number => {
  let root = label;
  while (parent[root] !== root) {
    root = parent[root];
  }
  let curr = label;
  while (curr !== root) {
    const next = parent[curr];
    parent[curr] = root;
    curr = next;
  }
  return root;
};

/**
 * Union two component trees by smaller root label.
 */
const unionRoots = (parent: Int32Array, labelA: number, labelB: number): number => {
  const rootA = findRoot(parent, labelA);
  const rootB = findRoot(parent, labelB);
  if (rootA < rootB) {
    parent[rootB] = rootA;
    return rootA;
  } else if (rootB < rootA) {
    parent[rootA] = rootB;
    return rootB;
  }
  return rootA;
};

/**
 * Dynamically resizes parent lookup array when label pool is exhausted.
 */
const growParentArray = (parent: Int32Array<ArrayBuffer>, minRequired: number): Int32Array<ArrayBuffer> => {
  if (minRequired < parent.length) {
    return parent;
  }
  const newSize = Math.max(parent.length * 2, minRequired + 1024);
  const grown = new Int32Array(newSize);
  grown.set(parent);
  return grown;
};

/**
 * Connected Component Labeling using a classical two-pass union-find algorithm with 8-connectivity.
 * Filters out components with area smaller than minArea or larger than maxArea.
 *
 * @param binary 1D Uint8Array representing a binary image (0 = background, >0 = foreground).
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param minArea Minimum component area in pixels (default: 12).
 * @param maxArea Maximum component area in pixels (default: 8000).
 * @returns Result containing sequential 1-based labels array, component count, and bounding boxes.
 */
export const findConnectedComponents = (
  binary: Uint8Array,
  width: number,
  height: number,
  minArea = 12,
  maxArea = 8000
): ConnectedComponentsResult => {
  const totalPixels = width * height;
  if (totalPixels === 0) {
    return {
      labels: new Int32Array(0),
      count: 0,
      boxes: [],
    };
  }

  const labels = new Int32Array(totalPixels);
  let parent = new Int32Array(Math.max(1024, Math.floor(totalPixels / 8)));
  let nextLabel = 1;

  // PASS 1: Assign initial labels and record equivalences using 8-connectivity
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (binary[idx] === 0) {
        continue;
      }

      // Check already-visited 8-neighbors: North-West, North, North-East, West
      let minNeighborRoot = 0;
      const neighborRoots: number[] = [];

      if (y > 0) {
        const northRow = (y - 1) * width;
        // North-West
        if (x > 0) {
          const lNW = labels[northRow + x - 1];
          if (lNW > 0) {
            const r = findRoot(parent, lNW);
            neighborRoots.push(r);
            if (minNeighborRoot === 0 || r < minNeighborRoot) minNeighborRoot = r;
          }
        }
        // North
        const lN = labels[northRow + x];
        if (lN > 0) {
          const r = findRoot(parent, lN);
          neighborRoots.push(r);
          if (minNeighborRoot === 0 || r < minNeighborRoot) minNeighborRoot = r;
        }
        // North-East
        if (x + 1 < width) {
          const lNE = labels[northRow + x + 1];
          if (lNE > 0) {
            const r = findRoot(parent, lNE);
            neighborRoots.push(r);
            if (minNeighborRoot === 0 || r < minNeighborRoot) minNeighborRoot = r;
          }
        }
      }

      // West
      if (x > 0) {
        const lW = labels[rowOffset + x - 1];
        if (lW > 0) {
          const r = findRoot(parent, lW);
          neighborRoots.push(r);
          if (minNeighborRoot === 0 || r < minNeighborRoot) minNeighborRoot = r;
        }
      }

      if (neighborRoots.length === 0) {
        // No connected neighbor found: allocate new label
        parent = growParentArray(parent, nextLabel + 1);
        parent[nextLabel] = nextLabel;
        labels[idx] = nextLabel;
        nextLabel++;
      } else {
        // Connected to one or more neighbors: use smallest root and union all
        labels[idx] = minNeighborRoot;
        for (let i = 0; i < neighborRoots.length; i++) {
          const nr = neighborRoots[i];
          if (nr !== minNeighborRoot) {
            unionRoots(parent, minNeighborRoot, nr);
          }
        }
      }
    }
  }

  // Compress parent pointers to canonical roots
  for (let l = 1; l < nextLabel; l++) {
    parent[l] = findRoot(parent, l);
  }

  // PASS 2: Compute bounding boxes, dimensions, and pixel areas per canonical root
  const rootMinX = new Int32Array(nextLabel).fill(width);
  const rootMinY = new Int32Array(nextLabel).fill(height);
  const rootMaxX = new Int32Array(nextLabel).fill(-1);
  const rootMaxY = new Int32Array(nextLabel).fill(-1);
  const rootAreas = new Int32Array(nextLabel);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const l = labels[rowOffset + x];
      if (l > 0) {
        const root = parent[l];
        if (x < rootMinX[root]) rootMinX[root] = x;
        if (x > rootMaxX[root]) rootMaxX[root] = x;
        if (y < rootMinY[root]) rootMinY[root] = y;
        if (y > rootMaxY[root]) rootMaxY[root] = y;
        rootAreas[root]++;
      }
    }
  }

  // Filter components by area and map canonical roots to contiguous 1-based result IDs
  const rootToResultId = new Int32Array(nextLabel);
  const boxes: BoundingBox[] = [];
  let validCount = 0;

  for (let r = 1; r < nextLabel; r++) {
    if (parent[r] === r) {
      const area = rootAreas[r];
      if (area >= minArea && area <= maxArea) {
        validCount++;
        rootToResultId[r] = validCount;
        boxes.push({
          x: rootMinX[r],
          y: rootMinY[r],
          w: rootMaxX[r] - rootMinX[r] + 1,
          h: rootMaxY[r] - rootMinY[r] + 1,
          area,
        });
      }
    }
  }

  // Final re-indexing in the output labels buffer: valid components receive 1..count, rejected receive 0
  for (let i = 0; i < totalPixels; i++) {
    const l = labels[i];
    if (l > 0) {
      const root = parent[l];
      labels[i] = rootToResultId[root];
    }
  }

  return {
    labels,
    count: validCount,
    boxes,
  };
};

/**
 * Groups character bounding boxes into lines based on vertical overlap (> 50%).
 * Characters within each line are sorted strictly left-to-right.
 * Resulting lines are ordered top-to-bottom.
 *
 * @param boxes Array of bounding boxes with position and dimensions.
 * @returns Array of grouped text lines with bounding boxes and ordered charBoxes.
 */
export const groupBoundingBoxesIntoLines = (
  boxes: { x: number; y: number; w: number; h: number }[]
): TextLine[] => {
  if (boxes.length === 0) {
    return [];
  }

  // Sort boxes primarily by vertical position, secondarily by horizontal position
  const sortedBoxes = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);

  interface LineAccumulator {
    minY: number;
    maxY: number;
    charBoxes: CharBox[];
  }

  const lines: LineAccumulator[] = [];

  for (const box of sortedBoxes) {
    let bestLineIndex = -1;
    let maxOverlapRatio = 0.5; // Threshold strictly > 50%

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const overlapTop = Math.max(box.y, line.minY);
      const overlapBottom = Math.min(box.y + box.h, line.maxY);
      const overlapHeight = Math.max(0, overlapBottom - overlapTop);
      const referenceHeight = Math.min(box.h, line.maxY - line.minY);

      if (referenceHeight > 0) {
        const overlapRatio = overlapHeight / referenceHeight;
        if (overlapRatio > maxOverlapRatio) {
          maxOverlapRatio = overlapRatio;
          bestLineIndex = i;
        }
      }
    }

    if (bestLineIndex >= 0) {
      const matched = lines[bestLineIndex];
      matched.charBoxes.push({ x: box.x, y: box.y, w: box.w, h: box.h });
      matched.minY = Math.min(matched.minY, box.y);
      matched.maxY = Math.max(matched.maxY, box.y + box.h);
    } else {
      lines.push({
        minY: box.y,
        maxY: box.y + box.h,
        charBoxes: [{ x: box.x, y: box.y, w: box.w, h: box.h }],
      });
    }
  }

  // Format each line: sort charBoxes left-to-right and compute tight bounding envelope
  const result: TextLine[] = lines.map((line): TextLine => {
    line.charBoxes.sort((a, b) => a.x - b.x);

    let minX = Number.MAX_SAFE_INTEGER;
    let maxX = Number.MIN_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxY = Number.MIN_SAFE_INTEGER;

    for (const b of line.charBoxes) {
      if (b.x < minX) minX = b.x;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y < minY) minY = b.y;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      charBoxes: line.charBoxes,
    };
  });

  // Sort lines top-to-bottom
  result.sort((a, b) => a.y - b.y || a.x - b.x);

  return result;
};

/**
 * Helper to construct a WordBox wrapping a slice of characters.
 */
const buildWordBox = (chars: CharBox[]): WordBox => {
  let minX = Number.MAX_SAFE_INTEGER;
  let maxX = Number.MIN_SAFE_INTEGER;
  let minY = Number.MAX_SAFE_INTEGER;
  let maxY = Number.MIN_SAFE_INTEGER;

  for (const c of chars) {
    if (c.x < minX) minX = c.x;
    if (c.x + c.w > maxX) maxX = c.x + c.w;
    if (c.y < minY) minY = c.y;
    if (c.y + c.h > maxY) maxY = c.y + c.h;
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    charBoxes: chars,
  };
};

/**
 * Segments a single text line into words when the horizontal gap between
 * adjacent characters exceeds 0.6 * median character width.
 *
 * @param line Text line containing character boxes.
 * @returns Array of segmented words with enclosing bounding boxes.
 */
export const groupWordsInLine = (line: {
  charBoxes: { x: number; y: number; w: number; h: number }[];
}): WordBox[] => {
  if (line.charBoxes.length === 0) {
    return [];
  }

  // Ensure characters are ordered strictly left-to-right
  const chars = [...line.charBoxes].sort((a, b) => a.x - b.x);

  // Compute median character width
  const widths = chars.map((c) => c.w).sort((a, b) => a - b);
  const medianWidth = widths[Math.floor(widths.length / 2)];
  const gapThreshold = Math.max(2, 0.6 * medianWidth);

  const words: WordBox[] = [];
  let currentWordChars: CharBox[] = [chars[0]];

  for (let i = 0; i < chars.length - 1; i++) {
    const current = chars[i];
    const next = chars[i + 1];
    const horizontalGap = next.x - (current.x + current.w);

    if (horizontalGap > gapThreshold) {
      words.push(buildWordBox(currentWordChars));
      currentWordChars = [next];
    } else {
      currentWordChars.push(next);
    }
  }

  if (currentWordChars.length > 0) {
    words.push(buildWordBox(currentWordChars));
  }

  return words;
};
