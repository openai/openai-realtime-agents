export class FilesetResolver {
  static async forVisionTasks() { return {}; }
}
export class FaceDetector {
  static async createFromOptions() { return new FaceDetector(); }
  async detectForVideo() { return []; }
}
