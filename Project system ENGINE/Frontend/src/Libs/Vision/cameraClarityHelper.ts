// [Layer: Libs/Vision]
// Responsibility: Shared client-side Laplacian edge variance and dynamic camera clarity threshold calculator.
// Complies with Universal Lambdas (=>), zero 'any', and zero emojis.

export const DEFAULT_CLARITY_THRESHOLD = 70.0;
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

const SD_RESOLUTION_THRESHOLD = 640 * 480;
const HD_RESOLUTION_THRESHOLD = 1920 * 1080;
const LOW_LIGHT_LUMINANCE_CUTOFF = 45;
const HIGH_GLARE_LUMINANCE_CUTOFF = 215;
const LOW_FRAMERATE_CUTOFF = 20;

export const computeLaplacianVariance = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { variance: number; meanLuminance: number } => {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const gray = new Float32Array(width * height);
    let totalLuminance = 0;

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[i / 4] = lum;
      totalLuminance += lum;
    }

    const meanLuminance = totalLuminance / (width * height);

    let sum = 0;
    let sumSq = 0;
    let sampleCount = 0;

    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = y * width + x;
        const laplacian =
          -gray[idx - width - 1] -
          gray[idx - width] -
          gray[idx - width + 1] -
          gray[idx - 1] +
          8 * gray[idx] -
          gray[idx + 1] -
          gray[idx + width - 1] -
          gray[idx + width] -
          gray[idx + width + 1];

        sum += laplacian;
        sumSq += laplacian * laplacian;
        sampleCount++;
      }
    }

    if (sampleCount === 0) return { variance: 100, meanLuminance: 128 };
    const mean = sum / sampleCount;
    const variance = sumSq / sampleCount - mean * mean;
    return {
      variance: Math.round(variance * 10) / 10,
      meanLuminance: Math.round(meanLuminance * 10) / 10
    };
  } catch {
    return { variance: 100, meanLuminance: 128 };
  }
};

export const calculateDynamicClarityThreshold = (
  width: number,
  height: number,
  meanLuminance: number,
  trackSettings?: MediaTrackSettings,
  baseThreshold: number = DEFAULT_CLARITY_THRESHOLD
): { threshold: number; reasoning: string } => {
  let multiplier = 1.0;
  const factors: string[] = [`Base: ${baseThreshold}`];

  const totalPixels = width * height;
  if (totalPixels >= HD_RESOLUTION_THRESHOLD) {
    multiplier *= 1.15;
    factors.push('1080p+ (+15%)');
  } else if (totalPixels <= SD_RESOLUTION_THRESHOLD) {
    multiplier *= 0.85;
    factors.push('SD Sensor (-15%)');
  }

  if (meanLuminance < LOW_LIGHT_LUMINANCE_CUTOFF) {
    const lowLightScale = Math.max(0.65, meanLuminance / LOW_LIGHT_LUMINANCE_CUTOFF);
    multiplier *= lowLightScale;
    factors.push(`Night/Low-Light (${Math.round((lowLightScale - 1) * 100)}%)`);
  } else if (meanLuminance > HIGH_GLARE_LUMINANCE_CUTOFF) {
    multiplier *= 0.90;
    factors.push('Glare (-10%)');
  }

  if (trackSettings?.frameRate && trackSettings.frameRate < LOW_FRAMERATE_CUTOFF) {
    multiplier *= 0.90;
    factors.push('Low FPS (-10%)');
  }

  const dynamicThreshold = Math.round(baseThreshold * multiplier * 10) / 10;
  return {
    threshold: dynamicThreshold,
    reasoning: factors.join(' · ')
  };
};
