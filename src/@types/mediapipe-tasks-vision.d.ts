export class FilesetResolver {
  static forVisionTasks(_: string, __?: any): Promise<any>;
}
export interface FaceDetectorResult {
  keypoints: Array<{x: number; y: number}>;
  boundingBox: {width: number; height: number; originX: number; originY: number};
}
export class FaceDetector {
  static createFromOptions(resolver: any, options: any): Promise<FaceDetector>;
  detectForVideo(video: HTMLVideoElement, timestamp: number): Promise<FaceDetectorResult[]>;
}
