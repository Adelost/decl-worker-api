/**
 * Auto-generated from JSON Schema - DO NOT EDIT
 * Generated: 2026-01-27T19:36:39.276214
 * Source: schemas/*.schema.json
 */

// === Chat Types ===

/** A single message in a conversation */
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  /** Optional image URL for multimodal */
  image_url?: string | null;
}

/** Standard payload for ALL chat providers (OpenAI, Qwen, Llama, etc) */
export interface ChatPayload {
  messages: Message[];
  temperature?: number;
  max_tokens?: number | null;
  top_p?: number | null;
  stop?: unknown[] | null;
}

/** Standard response from all chat providers */
export interface ChatResponse {
  content: string;
  model: string;
  usage?: Record<string, unknown> | null;
  /** True for streaming partial responses */
  is_partial?: boolean;
}

// === Media Reference Types ===

/** Reference to an image file */
export interface ImageRef {
  /** S3/GCS/HTTP URL to image */
  url: string;
  format?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Reference to a video file */
export interface VideoRef {
  /** S3/GCS/HTTP URL to video */
  url: string;
  format?: string | null;
  duration_seconds?: number | null;
  fps?: number | null;
  width?: number | null;
  height?: number | null;
}

/** Reference to an audio file */
export interface AudioRef {
  /** S3/GCS/HTTP URL to audio */
  url: string;
  format?: string | null;
  duration_seconds?: number | null;
  sample_rate?: number | null;
  channels?: number | null;
}

/** Payload for vision tasks (YOLO, SAM2, etc) */
export interface VisionPayload {
  image: ImageRef;
  confidence?: number;
}

/** Payload for audio transcription */
export interface TranscriptionPayload {
  audio: AudioRef;
  /** ISO 639-1 language code */
  language?: string | null;
  word_timestamps?: boolean;
}
