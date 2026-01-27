/**
 * Auto-generated TypeScript types from Python task decorators.
 * Generated: 2026-01-27T19:17:12.092453
 * DO NOT EDIT MANUALLY - run `pnpm gen:types` to regenerate.
 */

// =============================================================================
// Task Names
// =============================================================================

export type TaskName =
  | "chatterbox.clone_voice"
  | "chatterbox.synthesize"
  | "chatterbox.synthesize_turbo"
  | "chunk.sentences"
  | "chunk.text"
  | "convert.audio"
  | "convert.video"
  | "diarize.speakers"
  | "diarize.with_transcript"
  | "download.batch"
  | "download.file"
  | "download.youtube"
  | "elevenlabs.clone_voice"
  | "elevenlabs.synthesize"
  | "openai.chat"
  | "openai.chat_stream"
  | "openai.classify"
  | "openai.embed"
  | "openai.extract"
  | "openai.summarize"
  | "openai.translate"
  | "openai.tts"
  | "openai.tts_hd"
  | "rss.fetch"
  | "video.analyze"
  | "video.analyze_quick"
  | "video.detect_scenes"
  | "video.extract_audio"
  | "video.extract_frames"
  | "whisper.detect_language"
  | "whisper.transcribe"
  | "whisper.transcribe_openai"
  | "whisper.transcribe_stream"
  | "yolo.detect"
  | "yolo.detect_batch"
  | "yolo.pose"
  | "yolo.segment"
  | "yolo.track"
;

// =============================================================================
// Categories
// =============================================================================

export namespace Category {
  export type See = "yolo.detect" | "yolo.detect_batch" | "yolo.pose" | "yolo.segment" | "yolo.track";
  export type Hear = "diarize.speakers" | "diarize.with_transcript" | "whisper.detect_language" | "whisper.transcribe" | "whisper.transcribe_openai" | "whisper.transcribe_stream";
  export type Think = "openai.chat" | "openai.chat_stream" | "openai.classify" | "openai.embed" | "openai.extract" | "openai.summarize" | "openai.translate";
  export type Speak = "chatterbox.clone_voice" | "chatterbox.synthesize" | "chatterbox.synthesize_turbo" | "elevenlabs.clone_voice" | "elevenlabs.synthesize" | "openai.tts" | "openai.tts_hd";
  export type Get = "download.batch" | "download.file" | "download.youtube" | "rss.fetch";
  export type Transform = "chunk.sentences" | "chunk.text" | "convert.audio" | "convert.video";
  export type Watch = "video.analyze" | "video.analyze_quick" | "video.detect_scenes" | "video.extract_audio" | "video.extract_frames";
}

// =============================================================================
// Capabilities
// =============================================================================

export namespace Capability {
  export type Analyze = "video.analyze" | "video.analyze_quick";
  export type Api = "whisper.transcribe_openai";
  export type Audio = "convert.audio" | "video.extract_audio";
  export type Batch = "download.batch" | "yolo.detect_batch";
  export type Chat = "openai.chat" | "openai.chat_stream";
  export type Chunk = "chunk.sentences" | "chunk.text";
  export type Classify = "openai.classify";
  export type Clone = "chatterbox.clone_voice" | "elevenlabs.clone_voice";
  export type Convert = "convert.audio" | "convert.video";
  export type Detect = "video.detect_scenes" | "whisper.detect_language" | "yolo.detect" | "yolo.detect_batch";
  export type Diarize = "diarize.speakers" | "diarize.with_transcript";
  export type Download = "download.batch" | "download.file" | "download.youtube";
  export type Embed = "openai.embed";
  export type Extract = "openai.extract" | "video.extract_audio" | "video.extract_frames";
  export type Fast = "chatterbox.synthesize_turbo" | "video.analyze_quick";
  export type Fetch = "rss.fetch";
  export type Frames = "video.extract_frames";
  export type Generate = "openai.chat" | "openai.chat_stream";
  export type Hd = "openai.tts_hd";
  export type Http = "download.file";
  export type Instances = "yolo.segment";
  export type Keypoints = "yolo.pose";
  export type Language = "whisper.detect_language";
  export type Multilingual = "chatterbox.synthesize";
  export type Objects = "yolo.detect" | "yolo.detect_batch" | "yolo.track";
  export type Pose = "yolo.pose";
  export type Rss = "rss.fetch";
  export type Scenes = "video.detect_scenes";
  export type Segment = "yolo.segment";
  export type Sentences = "chunk.sentences";
  export type Speakers = "diarize.speakers" | "diarize.with_transcript";
  export type Stream = "openai.chat_stream" | "whisper.transcribe_stream";
  export type Structure = "openai.extract";
  export type Summarize = "openai.summarize";
  export type Synthesize = "chatterbox.synthesize" | "chatterbox.synthesize_turbo" | "elevenlabs.synthesize" | "openai.tts" | "openai.tts_hd";
  export type Text = "chunk.text";
  export type Track = "yolo.track";
  export type Transcribe = "diarize.with_transcript" | "whisper.transcribe" | "whisper.transcribe_openai" | "whisper.transcribe_stream";
  export type Translate = "openai.translate";
  export type Tts = "chatterbox.synthesize" | "chatterbox.synthesize_turbo" | "elevenlabs.synthesize" | "openai.tts" | "openai.tts_hd";
  export type Vectors = "openai.embed";
  export type Video = "convert.video" | "video.analyze" | "video.analyze_quick" | "yolo.track";
  export type Voice = "chatterbox.clone_voice" | "elevenlabs.clone_voice";
  export type Youtube = "download.youtube";
}

// =============================================================================
// Task Payloads (input parameters)
// =============================================================================

export interface TaskPayloads {
  "chatterbox.clone_voice": {
    audio_path: string;
    output_path?: string | null;
  };
  "chatterbox.synthesize": {
    text: string;
    voice_ref?: string | null;
    lang?: string;
    exaggeration?: number;
    cfg_weight?: number;
    temperature?: number;
    model_type?: string;
    device?: string;
    output_path?: string | null;
  };
  "chatterbox.synthesize_turbo": {
    text: string;
    voice_ref?: string | null;
    exaggeration?: number;
    device?: string;
    output_path?: string | null;
  };
  "chunk.sentences": {
    text: string;
    max_sentences?: number;
    overlap_sentences?: number;
  };
  "chunk.text": {
    text: string;
    chunk_size?: number;
    overlap?: number;
    separator?: string;
  };
  "convert.audio": {
    input_path: string;
    output_format?: string;
    output_path?: string | null;
    sample_rate?: number | null;
    channels?: number | null;
  };
  "convert.video": {
    input_path: string;
    output_format?: string;
    output_path?: string | null;
    resolution?: string | null;
    codec?: string | null;
  };
  "diarize.speakers": {
    audio_path: string;
    num_speakers?: number | null;
  };
  "diarize.with_transcript": {
    audio_path: string;
    model_size?: string;
    num_speakers?: number | null;
    device?: string;
  };
  "download.batch": {
    urls: string[];
    output_dir?: string;
  };
  "download.file": {
    url: string;
    output_path?: string | null;
    output_dir?: string | null;
    timeout?: number;
  };
  "download.youtube": {
    url: string;
    output_dir?: string;
    format?: string;
    extract_audio?: boolean;
  };
  "elevenlabs.clone_voice": {
    name: string;
    audio_paths: string[];
    description?: string;
  };
  "elevenlabs.synthesize": {
    text: string;
    voice_id?: string;
    model_id?: string;
    stability?: number;
    similarity_boost?: number;
    output_path?: string | null;
  };
  "openai.chat": {
    prompt: string;
    model?: string;
    system?: string | null;
    temperature?: number;
    max_tokens?: number | null;
  };
  "openai.chat_stream": {
    prompt: string;
    model?: string;
    system?: string | null;
    temperature?: number;
  };
  "openai.classify": {
    text: string;
    categories: string[];
    model?: string;
  };
  "openai.embed": {
    text: string[];
    model?: string;
  };
  "openai.extract": {
    text: string;
    schema: Record<string, unknown>;
    model?: string;
  };
  "openai.summarize": {
    text: string;
    max_length?: number;
    style?: string;
  };
  "openai.translate": {
    text: string;
    target_language: string;
    source_language?: string | null;
    model?: string;
  };
  "openai.tts": {
    text: string;
    voice?: string;
    model?: string;
    speed?: number;
    output_path?: string | null;
  };
  "openai.tts_hd": {
    text: string;
    voice?: string;
    speed?: number;
    output_path?: string | null;
  };
  "rss.fetch": {
    feed_url: string;
    limit?: number | null;
  };
  "video.analyze": {
    video_path: string;
    tracks?: string[] | null;
    fps?: number;
    max_frames?: number | null;
    device?: string;
  };
  "video.analyze_quick": {
    video_path: string;
    device?: string;
  };
  "video.detect_scenes": {
    video_path: string;
    threshold?: number;
    min_scene_len?: number;
    fps?: number;
    device?: string;
  };
  "video.extract_audio": {
    video_path: string;
    output_path?: string | null;
    output_format?: string;
  };
  "video.extract_frames": {
    video_path: string;
    output_dir?: string | null;
    fps?: number;
    start_time?: number | null;
    end_time?: number | null;
  };
  "whisper.detect_language": {
    audio_path: string;
    model_size?: string;
    device?: string;
  };
  "whisper.transcribe": {
    audio_path: string;
    model_size?: string;
    language?: string | null;
    word_timestamps?: boolean;
    vad_filter?: boolean;
    device?: string;
    compute_type?: string;
  };
  "whisper.transcribe_openai": {
    audio_path: string;
    model?: string;
    language?: string | null;
    prompt?: string | null;
  };
  "whisper.transcribe_stream": {
    audio_path: string;
    model_size?: string;
    language?: string | null;
    device?: string;
  };
  "yolo.detect": {
    image_path: string;
    model?: string;
    conf?: number;
    iou?: number;
    classes?: number[] | null;
    device?: string;
  };
  "yolo.detect_batch": {
    image_paths: string[];
    model?: string;
    conf?: number;
    device?: string;
  };
  "yolo.pose": {
    image_path: string;
    model?: string;
    conf?: number;
    device?: string;
  };
  "yolo.segment": {
    image_path: string;
    model?: string;
    conf?: number;
    device?: string;
  };
  "yolo.track": {
    video_path: string;
    model?: string;
    conf?: number;
    tracker?: string;
    device?: string;
  };
}

// =============================================================================
// Task Metadata
// =============================================================================

export interface TaskMetadata {
  name: string;
  category: string;
  capabilities: string[];
  gpu: string | null;
  timeout: number;
  streaming: boolean;
  description: string;
}

export const TASK_METADATA: Record<TaskName, TaskMetadata> = {
  "chatterbox.clone_voice": {
    name: "chatterbox.clone_voice",
    category: "speak",
    capabilities: ["clone", "voice"],
    gpu: null,
    timeout: 60,
    streaming: false,
    description: "Extract voice reference for cloning.",
  },
  "chatterbox.synthesize": {
    name: "chatterbox.synthesize",
    category: "speak",
    capabilities: ["synthesize", "tts", "multilingual"],
    gpu: "A10G",
    timeout: 300,
    streaming: false,
    description: "Synthesize speech using Chatterbox (local GPU).",
  },
  "chatterbox.synthesize_turbo": {
    name: "chatterbox.synthesize_turbo",
    category: "speak",
    capabilities: ["synthesize", "tts", "fast"],
    gpu: "T4",
    timeout: 120,
    streaming: false,
    description: "Synthesize using Chatterbox Turbo (faster, English only).",
  },
  "chunk.sentences": {
    name: "chunk.sentences",
    category: "transform",
    capabilities: ["chunk", "sentences"],
    gpu: null,
    timeout: 60,
    streaming: false,
    description: "Split text into sentence-based chunks.",
  },
  "chunk.text": {
    name: "chunk.text",
    category: "transform",
    capabilities: ["chunk", "text"],
    gpu: null,
    timeout: 60,
    streaming: false,
    description: "Split text into overlapping chunks.",
  },
  "convert.audio": {
    name: "convert.audio",
    category: "transform",
    capabilities: ["convert", "audio"],
    gpu: null,
    timeout: 300,
    streaming: false,
    description: "Convert audio to different format.",
  },
  "convert.video": {
    name: "convert.video",
    category: "transform",
    capabilities: ["convert", "video"],
    gpu: null,
    timeout: 600,
    streaming: false,
    description: "Convert video to different format.",
  },
  "diarize.speakers": {
    name: "diarize.speakers",
    category: "hear",
    capabilities: ["diarize", "speakers"],
    gpu: "T4",
    timeout: 600,
    streaming: false,
    description: "Speaker diarization - identify who speaks when.",
  },
  "diarize.with_transcript": {
    name: "diarize.with_transcript",
    category: "hear",
    capabilities: ["diarize", "speakers", "transcribe"],
    gpu: "T4",
    timeout: 900,
    streaming: false,
    description: "Transcribe audio with speaker diarization.",
  },
  "download.batch": {
    name: "download.batch",
    category: "get",
    capabilities: ["download", "batch"],
    gpu: null,
    timeout: 900,
    streaming: false,
    description: "Download multiple files.",
  },
  "download.file": {
    name: "download.file",
    category: "get",
    capabilities: ["download", "http"],
    gpu: null,
    timeout: 300,
    streaming: false,
    description: "Download a file from URL.",
  },
  "download.youtube": {
    name: "download.youtube",
    category: "get",
    capabilities: ["download", "youtube"],
    gpu: null,
    timeout: 600,
    streaming: false,
    description: "Download video/audio from YouTube.",
  },
  "elevenlabs.clone_voice": {
    name: "elevenlabs.clone_voice",
    category: "speak",
    capabilities: ["clone", "voice"],
    gpu: null,
    timeout: 300,
    streaming: false,
    description: "Clone a voice from audio samples.",
  },
  "elevenlabs.synthesize": {
    name: "elevenlabs.synthesize",
    category: "speak",
    capabilities: ["synthesize", "tts"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Synthesize speech using ElevenLabs.",
  },
  "openai.chat": {
    name: "openai.chat",
    category: "think",
    capabilities: ["chat", "generate"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Chat completion using OpenAI API.",
  },
  "openai.chat_stream": {
    name: "openai.chat_stream",
    category: "think",
    capabilities: ["chat", "generate", "stream"],
    gpu: null,
    timeout: 120,
    streaming: true,
    description: "Chat completion with streaming output.",
  },
  "openai.classify": {
    name: "openai.classify",
    category: "think",
    capabilities: ["classify"],
    gpu: null,
    timeout: 60,
    streaming: false,
    description: "Classify text into one or more categories.",
  },
  "openai.embed": {
    name: "openai.embed",
    category: "think",
    capabilities: ["embed", "vectors"],
    gpu: null,
    timeout: 60,
    streaming: false,
    description: "Generate embeddings for text.",
  },
  "openai.extract": {
    name: "openai.extract",
    category: "think",
    capabilities: ["extract", "structure"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Extract structured data from text according to a schema.",
  },
  "openai.summarize": {
    name: "openai.summarize",
    category: "think",
    capabilities: ["summarize"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Summarize text using LLM.",
  },
  "openai.translate": {
    name: "openai.translate",
    category: "think",
    capabilities: ["translate"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Translate text to target language.",
  },
  "openai.tts": {
    name: "openai.tts",
    category: "speak",
    capabilities: ["synthesize", "tts"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Synthesize speech using OpenAI TTS.",
  },
  "openai.tts_hd": {
    name: "openai.tts_hd",
    category: "speak",
    capabilities: ["synthesize", "tts", "hd"],
    gpu: null,
    timeout: 120,
    streaming: false,
    description: "Synthesize high-quality speech using OpenAI TTS-HD.",
  },
  "rss.fetch": {
    name: "rss.fetch",
    category: "get",
    capabilities: ["fetch", "rss"],
    gpu: null,
    timeout: 60,
    streaming: false,
    description: "Fetch and parse RSS feed.",
  },
  "video.analyze": {
    name: "video.analyze",
    category: "watch",
    capabilities: ["analyze", "video"],
    gpu: "T4",
    timeout: 1800,
    streaming: false,
    description: "Full video analysis pipeline.",
  },
  "video.analyze_quick": {
    name: "video.analyze_quick",
    category: "watch",
    capabilities: ["analyze", "video", "fast"],
    gpu: "T4",
    timeout: 600,
    streaming: false,
    description: "Quick video analysis - visual + audio only.",
  },
  "video.detect_scenes": {
    name: "video.detect_scenes",
    category: "watch",
    capabilities: ["detect", "scenes"],
    gpu: "T4",
    timeout: 600,
    streaming: false,
    description: "Detect scene changes in video.",
  },
  "video.extract_audio": {
    name: "video.extract_audio",
    category: "watch",
    capabilities: ["extract", "audio"],
    gpu: null,
    timeout: 300,
    streaming: false,
    description: "Extract audio from video.",
  },
  "video.extract_frames": {
    name: "video.extract_frames",
    category: "watch",
    capabilities: ["extract", "frames"],
    gpu: null,
    timeout: 300,
    streaming: false,
    description: "Extract frames from video.",
  },
  "whisper.detect_language": {
    name: "whisper.detect_language",
    category: "hear",
    capabilities: ["detect", "language"],
    gpu: "T4",
    timeout: 60,
    streaming: false,
    description: "Detect spoken language in audio.",
  },
  "whisper.transcribe": {
    name: "whisper.transcribe",
    category: "hear",
    capabilities: ["transcribe"],
    gpu: "T4",
    timeout: 600,
    streaming: false,
    description: "Transcribe audio using faster-whisper.",
  },
  "whisper.transcribe_openai": {
    name: "whisper.transcribe_openai",
    category: "hear",
    capabilities: ["transcribe", "api"],
    gpu: null,
    timeout: 300,
    streaming: false,
    description: "Transcribe audio using OpenAI Whisper API.",
  },
  "whisper.transcribe_stream": {
    name: "whisper.transcribe_stream",
    category: "hear",
    capabilities: ["transcribe", "stream"],
    gpu: "T4",
    timeout: 600,
    streaming: true,
    description: "Transcribe audio with streaming segment output.",
  },
  "yolo.detect": {
    name: "yolo.detect",
    category: "see",
    capabilities: ["detect", "objects"],
    gpu: "T4",
    timeout: 300,
    streaming: false,
    description: "Detect objects in image using YOLO.",
  },
  "yolo.detect_batch": {
    name: "yolo.detect_batch",
    category: "see",
    capabilities: ["detect", "objects", "batch"],
    gpu: "T4",
    timeout: 600,
    streaming: false,
    description: "Batch detection for multiple images.",
  },
  "yolo.pose": {
    name: "yolo.pose",
    category: "see",
    capabilities: ["pose", "keypoints"],
    gpu: "T4",
    timeout: 300,
    streaming: false,
    description: "Pose estimation using YOLO-Pose.",
  },
  "yolo.segment": {
    name: "yolo.segment",
    category: "see",
    capabilities: ["segment", "instances"],
    gpu: "T4",
    timeout: 300,
    streaming: false,
    description: "Instance segmentation using YOLO-Seg.",
  },
  "yolo.track": {
    name: "yolo.track",
    category: "see",
    capabilities: ["track", "objects", "video"],
    gpu: "T4",
    timeout: 600,
    streaming: false,
    description: "Track objects in video using YOLO + ByteTrack.",
  },
};

// =============================================================================
// Utility Types
// =============================================================================

/** Get payload type for a specific task */
export type PayloadFor<T extends TaskName> = TaskPayloads[T];

/** Tasks requiring GPU */
export type GpuTask = "chatterbox.synthesize" | "chatterbox.synthesize_turbo" | "diarize.speakers" | "diarize.with_transcript" | "video.analyze" | "video.analyze_quick" | "video.detect_scenes" | "whisper.detect_language" | "whisper.transcribe" | "whisper.transcribe_stream" | "yolo.detect" | "yolo.detect_batch" | "yolo.pose" | "yolo.segment" | "yolo.track";

export type StreamingTask = "openai.chat_stream" | "whisper.transcribe_stream";
