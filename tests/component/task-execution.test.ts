/**
 * E2E tests for task execution flow.
 */

import { vi } from "vitest";
import { feature, rule, component, expect } from "bdd-vitest";
import { registerBackend, clearBackends, type Task } from "@dwa/core";
import { processTask } from "../../packages/orchestrator/src/engine/dispatcher.js";
import { MockBackend } from "./mock-backend.js";

interface BackendCtx {
  mockBackend: MockBackend;
}

const withBackend = (): BackendCtx => {
  clearBackends();
  const mockBackend = new MockBackend("modal");
  registerBackend(mockBackend);
  return { mockBackend };
};

const cleanupBackend = (ctx: BackendCtx) => {
  ctx.mockBackend.reset();
  clearBackends();
};

feature("Task Execution", () => {
  rule("LLM Tasks", () => {
    component("executes llm.chat task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing a chat task", (ctx) =>
        processTask({
          type: "llm.chat",
          backend: "modal",
          payload: { prompt: "What is the capital of France?", model: "gpt-4" },
        }).then((result) => ({ ...ctx, result }))
      ],
      then: ["returns mock response", ({ result, mockBackend }) => {
        expect(result).toEqual({
          response: "Mock response to: What is the capital of France?",
          model: "gpt-4",
        });
        expect(mockBackend.executedTasks).toHaveLength(1);
      }],
      cleanup: cleanupBackend,
    });

    component("executes llm.embed task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing an embed task", () =>
        processTask({ type: "llm.embed", backend: "modal", payload: { text: "Hello world" } })
      ],
      then: ["returns embedding vector", (result) => {
        const r = result as { embedding: number[] };
        expect(r.embedding).toHaveLength(1536);
        expect(r.embedding.every((n) => typeof n === "number")).toBe(true);
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });

    component("executes llm.summarize task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing a summarize task", () =>
        processTask({
          type: "llm.summarize",
          backend: "modal",
          payload: { text: "Lorem ipsum ".repeat(100), max_length: 100 },
        })
      ],
      then: ["returns summary", (result) => {
        expect((result as { summary: string }).summary).toContain("Summary of text");
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });
  });

  rule("Audio Tasks", () => {
    component("executes audio.transcribe task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing a transcribe task", () =>
        processTask({
          type: "audio.transcribe",
          backend: "modal",
          payload: { audio_path: "/path/to/audio.mp3", language: "en" },
        })
      ],
      then: ["returns transcription", (result) => {
        expect((result as { text: string }).text).toContain("Transcription of /path/to/audio.mp3");
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });

    component("executes audio.tts task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing a TTS task", () =>
        processTask({
          type: "audio.tts",
          backend: "modal",
          payload: { text: "Hello, world!", voice: "alloy" },
        })
      ],
      then: ["returns audio path", (result) => {
        expect((result as { path: string }).path).toMatch(/\/tmp\/tts_\d+\.mp3/);
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });
  });

  rule("Image Tasks", () => {
    component("executes image.generate task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing an image generation task", () =>
        processTask({
          type: "image.generate",
          backend: "modal",
          payload: { prompt: "A beautiful sunset", size: "1024x1024" },
        })
      ],
      then: ["returns CDN URL", (result) => {
        expect((result as { url: string }).url).toMatch(/^https:\/\/mock-cdn\.example\.com\/image_\d+\.png$/);
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });

    component("executes image.describe task", {
      given: ["a registered mock backend", withBackend],
      when: ["processing an image describe task", () =>
        processTask({
          type: "image.describe",
          backend: "modal",
          payload: { image_path: "/path/to/image.png" },
        })
      ],
      then: ["returns description", (result) => {
        expect((result as { description: string }).description).toContain("Description of image");
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });
  });

  rule("Pipeline Tasks", () => {
    component("executes video analysis pipeline", {
      given: ["a backend with download handler", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("process.download", (payload) => ({
          path: `/tmp/video_${Date.now()}.mp4`,
          url: payload.url,
        }));
        return ctx;
      }],
      when: ["processing a 3-step pipeline", (ctx) =>
        processTask({
          type: "video-analysis",
          backend: "modal",
          payload: { url: "https://example.com/video.mp4" },
          steps: [
            { task: "process.download", input: { url: "{{payload.url}}" } },
            { task: "audio.transcribe", input: { audio_path: "{{steps.0.path}}" } },
            { task: "llm.summarize", input: { text: "{{steps.1.text}}" } },
          ],
        }).then((result) => ({ ...ctx, result }))
      ],
      then: ["all 3 steps executed in order", ({ result, mockBackend }) => {
        const r = result as { steps: unknown[]; finalResult: { summary: string } };
        expect(r.steps).toHaveLength(3);
        expect(mockBackend.executedTasks).toHaveLength(3);
        expect(mockBackend.executedTasks[0].type).toBe("process.download");
        expect(mockBackend.executedTasks[1].type).toBe("audio.transcribe");
        expect(mockBackend.executedTasks[2].type).toBe("llm.summarize");
      }],
      cleanup: cleanupBackend,
    });

    component("handles optional step failure gracefully", {
      given: ["a backend with failing optional handler", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("optional.task", () => {
          throw new Error("This task always fails");
        });
        return ctx;
      }],
      when: ["processing pipeline with optional failure", () =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [
            { task: "llm.chat", input: { prompt: "step1" } },
            { task: "optional.task", optional: true },
            { task: "llm.chat", input: { prompt: "step3" } },
          ],
        })
      ],
      then: ["optional step is skipped, rest complete", (result) => {
        const r = result as { steps: unknown[] };
        expect(r.steps).toHaveLength(3);
        const step1 = r.steps[1] as { error: string; skipped: boolean };
        expect(step1.skipped).toBe(true);
        expect(step1.error).toContain("This task always fails");
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });

    component("fails fast on required step failure", {
      given: ["a backend with failing required handler", () => {
        const ctx = withBackend();
        ctx.mockBackend.registerHandler("failing.task", () => {
          throw new Error("Critical failure");
        });
        return ctx;
      }],
      when: ["processing pipeline with required failure", (ctx) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [
            { task: "llm.chat", input: { prompt: "step1" } },
            { task: "failing.task" },
            { task: "llm.chat", input: { prompt: "step3" } },
          ],
        }).catch((e: Error) => ({ error: e, mockBackend: ctx.mockBackend }))
      ],
      then: ["throws and stops execution", (result) => {
        const r = result as { error: Error; mockBackend: MockBackend };
        expect(r.error.message).toContain("Critical failure");
        expect(r.mockBackend.executedTasks).toHaveLength(2);
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });
  });

  rule("Backend Selection", () => {
    component("auto-selects healthy backend", {
      given: ["unhealthy modal + healthy ray", () => {
        const ctx = withBackend();
        const rayBackend = new MockBackend("ray");
        ctx.mockBackend.setHealthy(false);
        registerBackend(rayBackend);
        return { ...ctx, rayBackend };
      }],
      when: ["processing with auto backend", (ctx) =>
        processTask({
          type: "llm.chat",
          backend: "auto",
          payload: { prompt: "Hello" },
        }).then(() => ctx)
      ],
      then: ["ray backend was used", (ctx) => {
        expect(ctx.rayBackend.executedTasks).toHaveLength(1);
        expect(ctx.mockBackend.executedTasks).toHaveLength(0);
      }],
      cleanup: cleanupBackend,
    });

    component("throws when specified backend is unhealthy", {
      given: ["an unhealthy backend", () => {
        const ctx = withBackend();
        ctx.mockBackend.setHealthy(false);
        return ctx;
      }],
      then: ["rejects with not healthy", async () => {
        await expect(processTask({
          type: "llm.chat",
          backend: "modal",
          payload: { prompt: "Hello" },
        })).rejects.toThrow('Backend "modal" is not healthy');
      }],
      cleanup: cleanupBackend,
    });
  });

  rule("Progress Reporting", () => {
    component("reports progress for pipeline steps", {
      given: ["a registered mock backend", withBackend],
      when: ["processing 4-step pipeline with progress callback", () => {
        const progressUpdates: number[] = [];
        return processTask(
          {
            type: "pipeline",
            backend: "modal",
            payload: {},
            steps: [
              { task: "llm.chat", input: { prompt: "1" } },
              { task: "llm.chat", input: { prompt: "2" } },
              { task: "llm.chat", input: { prompt: "3" } },
              { task: "llm.chat", input: { prompt: "4" } },
            ],
          },
          (progress) => progressUpdates.push(progress),
        ).then(() => progressUpdates);
      }],
      then: ["progress updates are 0, 25, 50, 75", (progressUpdates) => {
        expect(progressUpdates).toEqual([0, 25, 50, 75]);
      }],
      cleanup: (ctx) => cleanupBackend(ctx),
    });
  });
});
