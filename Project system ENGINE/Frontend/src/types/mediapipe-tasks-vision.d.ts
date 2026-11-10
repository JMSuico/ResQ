// [Layer: Types / Declarations]
// Responsibility: Ambient type declarations for @mediapipe/tasks-vision.
// Guarantees zero TS2307 compilation errors across all machines, IDEs, and fresh clones,
// resolving TypeScript 5+ module resolution compatibility with MediaPipe's export definition.

declare module '@mediapipe/tasks-vision' {
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface Category {
    index: number;
    score: number;
    categoryName: string;
    displayName: string;
  }

  export interface Classifications {
    categories: Category[];
    headIndex?: number;
    headName?: string;
  }

  export interface Matrix {
    rows: number;
    columns: number;
    data: Float32Array | number[];
  }

  export interface FaceLandmarkerResult {
    faceLandmarks: NormalizedLandmark[][];
    faceBlendshapes?: Classifications[];
    facialTransformationMatrixes?: Matrix[];
  }

  export interface FaceLandmarkerOptions {
    baseOptions?: {
      modelAssetPath?: string;
      modelAssetBuffer?: Uint8Array;
      delegate?: 'CPU' | 'GPU';
    };
    runningMode?: 'IMAGE' | 'VIDEO';
    numFaces?: number;
    minFaceDetectionConfidence?: number;
    minFacePresenceConfidence?: number;
    minTrackingConfidence?: number;
    outputFaceBlendshapes?: boolean;
    outputFacialTransformationMatrixes?: boolean;
  }

  export class FaceLandmarker {
    static createFromOptions(
      visionTasksResolver: unknown,
      options: FaceLandmarkerOptions
    ): Promise<FaceLandmarker>;
    detectForVideo(
      videoFrame: HTMLVideoElement | HTMLCanvasElement,
      timestampMs: number
    ): FaceLandmarkerResult;
    close(): void;
  }

  export class FilesetResolver {
    static forVisionTasks(wasmPath: string): Promise<unknown>;
  }
}
