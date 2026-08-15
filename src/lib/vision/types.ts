export type VisionMode = "off" | "camera" | "screen" | "both";
export type VisionSource = "camera" | "screen";

export interface VisionFrame {
  source: VisionSource;
  /** base64, no "data:image/...;base64," prefix */
  data: string;
  mediaType: "image/jpeg";
  capturedAt: number;
}

export interface AnalyzeVisionInput {
  frames: VisionFrame[];
  /** What the user said, if this analysis was triggered by speech. */
  transcript?: string;
  conversationId?: string | null;
}

export interface AnalyzeVisionResult {
  reply: string;
  conversationId: string | null;
}

/**
 * Provider-agnostic contract for turning visual frames (+ optional
 * speech) into a response. The default implementation reuses Claude's
 * existing vision + chat pipeline (Phase 5) frame-by-frame; a future
 * provider backed by a persistent realtime multimodal socket (see
 * README notes) would implement the same interface without any caller
 * changes — nothing outside `lib/vision` needs to know which is active.
 */
export interface VisionProvider {
  readonly name: string;
  analyze(input: AnalyzeVisionInput): Promise<AnalyzeVisionResult>;
}
