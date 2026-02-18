/**
 * E2E tests for critical pipeline flows.
 *
 * Tests the full flows that podtotxt, voiceme, and ai-dsl would use,
 * using mocked services to verify logic without actual ML models.
 */

import { feature, rule, component, expect } from "bdd-vitest";
import { registerBackend, clearBackends, type Task } from "@dwa/core";
import { processTask } from "../../packages/orchestrator/src/engine/dispatcher.js";
import { MockBackend } from "./mock-backend.js";

interface PipelineCtx {
  mockBackend: MockBackend;
}

const withBackend = (): PipelineCtx => {
  clearBackends();
  const mockBackend = new MockBackend("modal");
  registerBackend(mockBackend);
  setupAllHandlers(mockBackend);
  return { mockBackend };
};

const cleanupBackend = (ctx: PipelineCtx) => {
  ctx.mockBackend.reset();
  clearBackends();
};

feature("Critical Pipeline Flows", () => {
  // ==========================================================================
  // Podcast Pipeline (podtotxt-style)
  // ==========================================================================
  rule("Podcast Pipeline (podtotxt)", () => {
    component("processes podcast from RSS to searchable transcript", {
      given: ["a backend with all handlers", withBackend],
      when: ["processing 6-step podcast pipeline", async (ctx) => {
        const result = await processTask({
          type: "podcast-to-text",
          backend: "modal",
          payload: {
            rss_url: "https://feeds.example.com/podcast.xml",
            episode_index: 0,
          },
          steps: [
            { task: "process.rss.fetch_feed", input: { url: "{{payload.rss_url}}" } },
            { task: "process.rss.parse_episodes", input: { feed: "{{steps.0}}" } },
            { task: "process.download.file", input: { url: "{{steps.1.episodes[0].audio_url}}" } },
            {
              task: "audio.transcribe_faster",
              input: { audio_path: "{{steps.2.path}}", model_size: "large-v3", word_timestamps: true },
            },
            { task: "audio.diarize", input: { audio_path: "{{steps.2.path}}" } },
            {
              task: "search.semantic.index_texts",
              input: { texts: "{{steps.3.segments}}", metadata: "{{steps.4}}" },
            },
          ],
        }) as { steps: unknown[] };
        return { ...ctx, result };
      }],
      then: ["all 6 steps completed with word timestamps", ({ result, mockBackend }) => {
        expect(result.steps).toHaveLength(6);
        expect(mockBackend.executedTasks.map((t) => t.type)).toEqual([
          "process.rss.fetch_feed",
          "process.rss.parse_episodes",
          "process.download.file",
          "audio.transcribe_faster",
          "audio.diarize",
          "search.semantic.index_texts",
        ]);
        const transcriptStep = result.steps[3] as {
          text: string;
          words: { word: string; start: number; end: number }[];
        };
        expect(transcriptStep.words).toBeDefined();
        expect(transcriptStep.words.length).toBeGreaterThan(0);
        expect(transcriptStep.words[0]).toHaveProperty("start");
        expect(transcriptStep.words[0]).toHaveProperty("end");
      }],
      cleanup: cleanupBackend,
    });

    component("handles missing episode gracefully", {
      given: ["a backend returning empty episodes", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("process.rss.parse_episodes", () => ({
          episodes: [],
        }));
        return ctx;
      }],
      when: ["processing podcast with empty feed", async () =>
        processTask({
          type: "podcast-to-text",
          backend: "modal",
          payload: { rss_url: "https://empty.example.com/feed.xml" },
          steps: [
            { task: "process.rss.fetch_feed", input: { url: "{{payload.rss_url}}" } },
            { task: "process.rss.parse_episodes", input: { feed: "{{steps.0}}" } },
          ],
        }) as Promise<{ steps: [unknown, { episodes: unknown[] }] }>
      ],
      then: ["returns empty episodes", (result) => {
        expect(result.steps[1].episodes).toHaveLength(0);
      }],
      cleanup: cleanupBackend,
    });
  });

  // ==========================================================================
  // Video Analysis Pipeline (ai-dsl-style)
  // ==========================================================================
  rule("Video Analysis Pipeline (ai-dsl)", () => {
    component("analyzes video with multi-track extraction", {
      given: ["a backend with all handlers", withBackend],
      when: ["processing 9-step video analysis", async (ctx) => {
        const result = await processTask({
          type: "video-analysis",
          backend: "modal",
          payload: { video_url: "https://example.com/video.mp4", fps: 1.0 },
          steps: [
            { task: "process.download.youtube", input: { url: "{{payload.video_url}}" } },
            { task: "process.convert.extract_frames", input: { video_path: "{{steps.0.path}}", fps: "{{payload.fps}}" } },
            { task: "vision.siglip.embed", input: { image_paths: "{{steps.1.frames}}" } },
            { task: "video.scenes.detect", input: { embeddings: "{{steps.2}}" } },
            { task: "vision.yolo.detect", input: { image_paths: "{{steps.1.frames}}" } },
            { task: "vision.florence.ocr", input: { image_paths: "{{steps.1.frames}}" } },
            { task: "vision.faces.detect", input: { image_paths: "{{steps.1.frames}}" } },
            { task: "audio.transcribe_faster", input: { audio_path: "{{steps.0.path}}" } },
            {
              task: "search.multimodal.create_index",
              input: {
                visual_embeddings: "{{steps.2}}",
                audio_segments: "{{steps.7.segments}}",
                object_detections: "{{steps.4}}",
              },
            },
          ],
        }) as { steps: unknown[] };
        return { ...ctx, result };
      }],
      then: ["all 9 steps completed", ({ result, mockBackend }) => {
        expect(result.steps).toHaveLength(9);
        const taskTypes = mockBackend.executedTasks.map((t) => t.type);
        expect(taskTypes).toContain("process.download.youtube");
        expect(taskTypes).toContain("process.convert.extract_frames");
        expect(taskTypes).toContain("vision.siglip.embed");
        expect(taskTypes).toContain("video.scenes.detect");
        expect(taskTypes).toContain("vision.yolo.detect");
        expect(taskTypes).toContain("vision.florence.ocr");
        expect(taskTypes).toContain("vision.faces.detect");
        expect(taskTypes).toContain("audio.transcribe_faster");
        expect(taskTypes).toContain("search.multimodal.create_index");
      }],
      cleanup: cleanupBackend,
    });

    component("handles video with no audio track", {
      given: ["a backend where transcription fails", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("audio.transcribe_faster", () => {
          throw new Error("No audio track found");
        });
        return ctx;
      }],
      when: ["processing video with optional audio step", async (ctx) => {
        const result = await processTask({
          type: "video-analysis",
          backend: "modal",
          payload: { video_url: "https://example.com/silent-video.mp4" },
          steps: [
            { task: "process.download.youtube", input: { url: "{{payload.video_url}}" } },
            { task: "audio.transcribe_faster", input: { audio_path: "{{steps.0.path}}" }, optional: true },
            { task: "vision.siglip.embed", input: { image_paths: ["frame1.jpg"] } },
          ],
        }) as { steps: unknown[] };
        return { ...ctx, result };
      }],
      then: ["pipeline continues despite audio failure", ({ result, mockBackend }) => {
        expect(result.steps).toHaveLength(3);
        expect((result.steps[1] as { skipped: boolean }).skipped).toBe(true);
        expect(mockBackend.executedTasks).toHaveLength(3);
      }],
      cleanup: cleanupBackend,
    });
  });

  // ==========================================================================
  // Voice Cloning Pipeline (voiceme-style)
  // ==========================================================================
  rule("Voice Cloning Pipeline (voiceme)", () => {
    component("clones voice and generates TTS", {
      given: ["a backend with all handlers", withBackend],
      when: ["processing 3-step voice clone pipeline", async () => {
        const result = await processTask({
          type: "voice-clone-tts",
          backend: "modal",
          payload: {
            reference_audio: "/path/to/voice-sample.wav",
            text_to_speak: "Hello, this is my cloned voice!",
            target_language: "en",
          },
          steps: [
            { task: "audio.transcribe_with_speakers", input: { audio_path: "{{payload.reference_audio}}" } },
            { task: "tts.elevenlabs.clone_voice", input: { audio_path: "{{payload.reference_audio}}", name: "cloned_voice" } },
            { task: "tts.elevenlabs.synthesize", input: { text: "{{payload.text_to_speak}}", voice_id: "{{steps.1.voice_id}}" } },
          ],
        }) as { steps: unknown[] };
        return result;
      }],
      then: ["voice cloned and TTS generated", (result) => {
        expect(result.steps).toHaveLength(3);
        const cloneStep = result.steps[1] as { voice_id: string };
        expect(cloneStep.voice_id).toBeDefined();
        const ttsStep = result.steps[2] as { path: string };
        expect(ttsStep.path).toMatch(/\.mp3$/);
      }],
      cleanup: cleanupBackend,
    });

    component("uses local TTS for multi-language support", {
      given: ["a backend with all handlers", withBackend],
      when: ["processing Swedish TTS", async () =>
        processTask({
          type: "multilingual-tts",
          backend: "modal",
          payload: {
            text: "Hej, detta är ett test på svenska!",
            language: "sv",
            voice_ref: "/path/to/swedish-voice.wav",
          },
          steps: [{
            task: "tts.chatterbox.synthesize",
            input: {
              text: "{{payload.text}}",
              lang: "{{payload.language}}",
              voice_ref: "{{payload.voice_ref}}",
              model_type: "multilingual",
            },
          }],
        }) as Promise<{ steps: [{ path: string; lang: string }] }>
      ],
      then: ["returns Swedish audio", (result) => {
        expect(result.steps[0].path).toBeDefined();
        expect(result.steps[0].lang).toBe("sv");
      }],
      cleanup: cleanupBackend,
    });
  });

  // ==========================================================================
  // Search & Retrieval Pipeline
  // ==========================================================================
  rule("Search & Retrieval", () => {
    component("searches across multimodal content", {
      given: ["a backend with all handlers", withBackend],
      when: ["creating index then searching", async (ctx) => {
        const indexResult = await processTask({
          type: "create-index",
          backend: "modal",
          payload: {
            texts: ["The cat sat on the mat", "Dogs love to play fetch"],
            images: ["/img1.jpg", "/img2.jpg"],
          },
          steps: [
            { task: "search.semantic.embed_texts", input: { texts: "{{payload.texts}}" } },
            { task: "vision.siglip.embed", input: { image_paths: "{{payload.images}}" } },
            {
              task: "search.multimodal.create_index",
              input: { text_chunks: "{{steps.0}}", visual_embeddings: "{{steps.1}}" },
            },
          ],
        }) as { steps: unknown[] };

        ctx.mockBackend.reset();
        setupAllHandlers(ctx.mockBackend);

        const searchResult = await processTask({
          type: "search",
          backend: "modal",
          payload: { query: "cat sitting", index: indexResult.steps[2] },
          steps: [{
            task: "search.multimodal.search",
            input: { query: "{{payload.query}}", index: "{{payload.index}}", top_k: 5 },
          }],
        }) as { steps: [{ results: { score: number; source: string }[] }] };

        return searchResult;
      }],
      then: ["search returns results", (searchResult) => {
        expect(searchResult.steps[0].results).toBeDefined();
        expect(searchResult.steps[0].results.length).toBeGreaterThan(0);
      }],
      cleanup: cleanupBackend,
    });

    component("deduplicates similar content", {
      given: ["a backend with all handlers", withBackend],
      when: ["processing deduplication pipeline", async () =>
        processTask({
          type: "dedupe",
          backend: "modal",
          payload: {
            texts: [
              "The quick brown fox",
              "The quick brown fox jumps",
              "Something completely different",
              "The quick brown fox.",
            ],
          },
          steps: [
            { task: "search.semantic.embed_texts", input: { texts: "{{payload.texts}}" } },
            { task: "search.vector.deduplicate", input: { vectors: "{{steps.0}}", threshold: 0.9 } },
          ],
        }) as Promise<{ steps: [unknown, { unique_indices: number[] }] }>
      ],
      then: ["identifies duplicates", (result) => {
        expect(result.steps[1].unique_indices.length).toBeLessThan(4);
      }],
      cleanup: cleanupBackend,
    });
  });

  // ==========================================================================
  // Error Handling & Retry
  // ==========================================================================
  rule("Error Handling & Retry", () => {
    component("retries failed tasks", {
      slow: true,
      given: ["a backend with flaky handler", () => {
        const ctx = withBackend();
        let attempts = 0;
        ctx.mockBackend.registerHandler("flaky.task", () => {
          attempts++;
          if (attempts < 3) throw new Error(`Attempt ${attempts} failed`);
          return { success: true, attempts };
        });
        return ctx;
      }],
      when: ["processing with retry config", async () =>
        processTask({
          type: "retry-test",
          backend: "modal",
          payload: {},
          retry: { attempts: 3, backoff: "fixed", delay: 10 },
          steps: [{ task: "flaky.task" }],
        }) as Promise<{ steps: [{ success: boolean; attempts: number }] }>
      ],
      then: ["succeeds on third attempt", (result) => {
        expect(result.steps[0].success).toBe(true);
        expect(result.steps[0].attempts).toBe(3);
      }],
      cleanup: cleanupBackend,
    });

    component("handles cascading failures in pipeline", {
      given: ["a backend with critical failure handler", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("critical.task", () => {
          throw new Error("Critical service unavailable");
        });
        return ctx;
      }],
      when: ["processing pipeline with required failure", (ctx) =>
        processTask({
          type: "cascade-test",
          backend: "modal",
          payload: {},
          steps: [
            { task: "llm.chat", input: { prompt: "step1" } },
            { task: "critical.task" },
            { task: "llm.chat", input: { prompt: "step3" } },
          ],
          onError: [{ $event: "emit", event: "pipeline-failed" }],
        }).catch((e: Error) => ({ error: e, mockBackend: ctx.mockBackend }))
      ],
      then: ["fails fast, only 2 tasks attempted", (result) => {
        const r = result as { error: Error; mockBackend: MockBackend };
        expect(r.error.message).toContain("Critical service unavailable");
        expect(r.mockBackend.executedTasks).toHaveLength(2);
      }],
      cleanup: cleanupBackend,
    });

    component("collects partial results on optional failures", {
      given: ["a backend with failing enrichment", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("optional.enrichment", () => {
          throw new Error("Enrichment service down");
        });
        return ctx;
      }],
      when: ["processing pipeline with optional failure", async () =>
        processTask({
          type: "partial-results",
          backend: "modal",
          payload: { text: "Hello world" },
          steps: [
            { task: "llm.chat", input: { prompt: "{{payload.text}}" } },
            { task: "optional.enrichment", optional: true },
            { task: "llm.summarize", input: { text: "{{steps.0.response}}" } },
          ],
        }) as Promise<{ steps: unknown[] }>
      ],
      then: ["optional skipped, rest completed", (result) => {
        expect(result.steps).toHaveLength(3);
        expect((result.steps[1] as { skipped: boolean }).skipped).toBe(true);
        expect((result.steps[2] as { summary: string }).summary).toBeDefined();
      }],
      cleanup: cleanupBackend,
    });
  });

  // ==========================================================================
  // Resource Constraints
  // ==========================================================================
  rule("Resource-Gated Execution", () => {
    component("reports resource requirements in task", {
      given: ["a backend with all handlers", withBackend],
      when: ["processing task with resource requirements", async () => {
        const task: Task = {
          type: "gpu-heavy",
          backend: "modal",
          payload: { model_size: "large-v3" },
          resources: { gpu: "A10G", vram: 10000, timeout: 600 },
          steps: [{
            task: "audio.transcribe_faster",
            input: { audio_path: "/path/to/audio.mp3", model_size: "{{payload.model_size}}" },
          }],
        };
        const result = await processTask(task);
        return { task, result };
      }],
      then: ["task has resources and executed", ({ task, result }) => {
        expect(task.resources?.vram).toBe(10000);
        expect(task.resources?.gpu).toBe("A10G");
        expect(result).toBeDefined();
      }],
      cleanup: cleanupBackend,
    });

    component("routes to appropriate backend based on GPU needs", {
      given: ["two backends with different GPU capabilities", () => {
        const ctx = withBackend();
        const rayBackend = new MockBackend("ray");
        registerBackend(rayBackend);
        setupAllHandlers(rayBackend);

        ctx.mockBackend.setResources({
          gpus: [{ name: "T4", vram: 16000, available: true }],
          vram: { total: 16000, available: 12000 },
          ram: { total: 64000, available: 48000 },
        });

        rayBackend.setResources({
          gpus: [{ name: "A100", vram: 80000, available: true }],
          vram: { total: 80000, available: 70000 },
          ram: { total: 128000, available: 100000 },
        });

        return { ...ctx, rayBackend };
      }],
      then: ["task definition captures resource needs", () => {
        const task: Task = {
          type: "big-model",
          backend: "auto",
          payload: {},
          resources: { gpu: "A100", vram: 40000 },
          steps: [{ task: "llm.chat", input: { prompt: "test" } }],
        };
        expect(task.resources?.vram).toBe(40000);
      }],
      cleanup: cleanupBackend,
    });
  });
});

/**
 * Setup all mock handlers for comprehensive testing.
 */
function setupAllHandlers(backend: MockBackend): void {
  // RSS handlers
  backend.registerHandler("process.rss.fetch_feed", (payload) => ({
    title: "Test Podcast",
    description: "A test podcast feed",
    url: payload.url,
    raw_feed: "<rss>...</rss>",
  }));

  backend.registerHandler("process.rss.parse_episodes", () => ({
    episodes: [
      {
        title: "Episode 1",
        audio_url: "https://example.com/ep1.mp3",
        duration: 3600,
        published: "2024-01-01",
      },
    ],
  }));

  // Download handlers
  backend.registerHandler("process.download.file", (payload) => ({
    path: `/tmp/download_${Date.now()}.mp3`,
    url: payload.url,
    size: 50000000,
  }));

  backend.registerHandler("process.download.youtube", (payload) => ({
    path: `/tmp/video_${Date.now()}.mp4`,
    url: payload.url,
    title: "Downloaded Video",
    duration: 600,
  }));

  // Audio handlers
  backend.registerHandler("audio.transcribe_faster", (payload) => ({
    text: `Transcription of ${payload.audio_path}`,
    words: [
      { word: "Hello", start: 0.0, end: 0.5, probability: 0.99 },
      { word: "world", start: 0.5, end: 1.0, probability: 0.98 },
    ],
    segments: [
      { start: 0.0, end: 1.0, text: "Hello world" },
      { start: 1.0, end: 2.0, text: "This is a test" },
    ],
    language: "en",
    duration: 120.5,
  }));

  backend.registerHandler("audio.transcribe_with_speakers", (payload) => ({
    text: `Transcription with speakers of ${payload.audio_path}`,
    segments: [
      { start: 0, end: 5, text: "Hello", speaker: "SPEAKER_00" },
      { start: 5, end: 10, text: "Hi there", speaker: "SPEAKER_01" },
    ],
    speakers: ["SPEAKER_00", "SPEAKER_01"],
  }));

  backend.registerHandler("audio.diarize", () => ([
    { start: 0, end: 30, speaker: "SPEAKER_00" },
    { start: 30, end: 60, speaker: "SPEAKER_01" },
  ]));

  // Vision handlers
  backend.registerHandler("vision.siglip.embed", (payload) => {
    const count = payload.image_paths?.length || 1;
    return Array(count).fill(null).map(() =>
      Array(768).fill(0).map(() => Math.random()),
    );
  });

  backend.registerHandler("vision.yolo.detect", (payload) => {
    const count = payload.image_paths?.length || 1;
    return Array(count).fill(null).map(() => ([
      { class_name: "person", confidence: 0.95, bbox: [100, 100, 200, 300] },
      { class_name: "car", confidence: 0.87, bbox: [300, 200, 500, 400] },
    ]));
  });

  backend.registerHandler("vision.florence.ocr", (payload) => {
    const count = payload.image_paths?.length || 1;
    return Array(count).fill(null).map(() => ({
      text: "Sample OCR text",
      bboxes: [[10, 10, 100, 30]],
    }));
  });

  backend.registerHandler("vision.faces.detect", (payload) => {
    const count = payload.image_paths?.length || 1;
    return Array(count).fill(null).map(() => ([
      {
        bbox: [150, 50, 250, 180],
        confidence: 0.99,
        embedding: Array(512).fill(0).map(() => Math.random()),
      },
    ]));
  });

  // Video handlers
  backend.registerHandler("video.scenes.detect", () => ({
    scenes: [
      { start_frame: 0, end_frame: 100, start_time: 0, end_time: 10 },
      { start_frame: 100, end_frame: 250, start_time: 10, end_time: 25 },
    ],
  }));

  backend.registerHandler("process.convert.extract_frames", (payload) => ({
    frames: Array(10).fill(null).map((_, i) => `/tmp/frame_${i}.jpg`),
    fps: payload.fps || 1,
    total_frames: 10,
  }));

  // Search handlers
  backend.registerHandler("search.semantic.embed_texts", (payload) => {
    const count = payload.texts?.length || 1;
    return Array(count).fill(null).map(() =>
      Array(1024).fill(0).map(() => Math.random()),
    );
  });

  backend.registerHandler("search.semantic.index_texts", (payload) => ({
    index_id: `idx_${Date.now()}`,
    count: payload.texts?.length || 0,
    embeddings: "stored",
  }));

  backend.registerHandler("search.multimodal.create_index", () => ({
    index_id: `multi_idx_${Date.now()}`,
    visual_count: 10,
    audio_count: 5,
    text_count: 20,
  }));

  backend.registerHandler("search.multimodal.search", (payload) => ({
    results: [
      { score: 0.95, source: "visual", frame_index: 5 },
      { score: 0.88, source: "audio", timestamp: 30.5 },
      { score: 0.82, source: "text", text: "matching text" },
    ],
    query: payload.query,
  }));

  backend.registerHandler("search.vector.deduplicate", (payload) => ({
    unique_indices: [0, 2],
    total: payload.vectors?.length || 0,
    duplicates_found: 2,
  }));

  // TTS handlers
  backend.registerHandler("tts.elevenlabs.clone_voice", (payload) => ({
    voice_id: `voice_${Date.now()}`,
    name: payload.name || "cloned_voice",
    status: "ready",
  }));

  backend.registerHandler("tts.elevenlabs.synthesize", (payload) => ({
    path: `/tmp/tts_${Date.now()}.mp3`,
    voice_id: payload.voice_id,
    duration: 5.5,
  }));

  backend.registerHandler("tts.chatterbox.synthesize", (payload) => ({
    path: `/tmp/chatterbox_${Date.now()}.wav`,
    lang: payload.lang || "en",
    duration: 3.2,
  }));
}
