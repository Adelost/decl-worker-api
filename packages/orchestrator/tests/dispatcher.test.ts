/**
 * Unit tests for task dispatcher.
 */

import { vi } from "vitest";
import { feature, rule, unit, expect } from "bdd-vitest";
import { processTask } from "../src/engine/dispatcher.js";
import {
  registerBackend,
  clearBackends,
  type Backend,
  type Task,
} from "@dwa/core";

function createMockBackend(name: string): Backend {
  return {
    name,
    execute: vi.fn().mockImplementation(async (task: Task) => ({
      result: `Executed ${task.type}`,
      payload: task.payload,
    })),
    getStatus: vi.fn().mockResolvedValue({ id: "1", status: "completed" }),
    isHealthy: vi.fn().mockResolvedValue(true),
  };
}

const withBackend = () => {
  clearBackends();
  const mockBackend = createMockBackend("modal");
  registerBackend(mockBackend);
  return mockBackend;
};

feature("Task Dispatcher", () => {
  rule("processTask - single task", () => {
    unit("executes a simple task", {
      given: ["a registered backend", withBackend],
      when: ["processing a task", (mockBackend) =>
        processTask({
          type: "llm.chat",
          backend: "modal",
          payload: { prompt: "Hello" },
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["backend executed and returned result", ({ result, mockBackend }) => {
        expect(result).toEqual({
          result: "Executed llm.chat",
          payload: { prompt: "Hello" },
        });
        expect(mockBackend.execute).toHaveBeenCalledWith(
          expect.objectContaining({ type: "llm.chat" }),
        );
      }],
      cleanup: clearBackends,
    });

    unit("calls progress callback", {
      given: ["a registered backend", withBackend],
      when: ["processing with progress callback", () => {
        const onProgress = vi.fn();
        return processTask(
          { type: "llm.chat", backend: "modal", payload: { prompt: "Hello" } },
          onProgress,
        ).then(() => onProgress);
      }],
      then: ["single task has no progress updates", (onProgress) => {
        expect(onProgress).not.toHaveBeenCalled();
      }],
      cleanup: clearBackends,
    });
  });

  rule("processTask - pipeline", () => {
    unit("executes pipeline steps in order", {
      given: ["a backend with chained results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "/tmp/audio.mp3" })
          .mockResolvedValueOnce({ result: "Transcribed text" })
          .mockResolvedValueOnce({ result: "Summary" });
        return mockBackend;
      }],
      when: ["processing a 3-step pipeline", (mockBackend) =>
        processTask({
          type: "video-pipeline",
          backend: "modal",
          payload: { url: "https://example.com/video.mp4" },
          steps: [
            { task: "process.download", input: { url: "{{payload.url}}" } },
            { task: "audio.transcribe", input: { path: "{{steps.0.result}}" } },
            { task: "llm.summarize", input: { text: "{{steps.1.result}}" } },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["all 3 steps executed with chained results", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(3);
        const r = result as { steps: unknown[]; finalResult: unknown };
        expect(r.steps).toEqual([
          { result: "/tmp/audio.mp3" },
          { result: "Transcribed text" },
          { result: "Summary" },
        ]);
        expect(r.finalResult).toEqual({ result: "Summary" });
      }],
      cleanup: clearBackends,
    });

    unit("reports progress for pipeline steps", {
      given: ["a backend with 2 results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockResolvedValueOnce({ result: "step2" });
        return mockBackend;
      }],
      when: ["processing with progress callback", () => {
        const onProgress = vi.fn();
        return processTask(
          {
            type: "pipeline",
            backend: "modal",
            payload: {},
            steps: [{ task: "step1" }, { task: "step2" }],
          },
          onProgress,
        ).then(() => onProgress);
      }],
      then: ["progress reported at 0% and 50%", (onProgress) => {
        expect(onProgress).toHaveBeenCalledWith(0);
        expect(onProgress).toHaveBeenCalledWith(50);
      }],
      cleanup: clearBackends,
    });

    unit("resolves template variables", {
      given: ["a backend with specific results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ path: "/tmp/file.txt", size: 1024 })
          .mockResolvedValueOnce({ result: "processed" });
        return mockBackend;
      }],
      when: ["processing pipeline with templates", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: { inputPath: "/data/input.txt" },
          steps: [
            { task: "process.copy", input: { source: "{{payload.inputPath}}" } },
            { task: "process.analyze", input: { file: "{{steps.0.path}}" } },
          ],
        }).then(() => mockBackend)
      ],
      then: ["templates resolved from payload and prior steps", (mockBackend) => {
        expect(mockBackend.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
          payload: { source: "/data/input.txt" },
        }));
        expect(mockBackend.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({
          payload: { file: "/tmp/file.txt" },
        }));
      }],
      cleanup: clearBackends,
    });

    unit("continues on optional step failure", {
      given: ["a backend where step 2 fails", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockRejectedValueOnce(new Error("Optional step failed"))
          .mockResolvedValueOnce({ result: "step3" });
        return mockBackend;
      }],
      when: ["processing pipeline with optional failure", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [
            { task: "step1" },
            { task: "step2", optional: true },
            { task: "step3" },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["optional step skipped, step3 completed", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(3);
        const r = result as { steps: unknown[]; finalResult: unknown };
        expect(r.steps).toHaveLength(3);
        expect(r.steps[0]).toEqual({ result: "step1" });
        expect((r.steps[1] as { skipped: boolean }).skipped).toBe(true);
        expect(r.steps[2]).toEqual({ result: "step3" });
        expect(r.finalResult).toEqual({ result: "step3" });
      }],
      cleanup: clearBackends,
    });

    unit("fails on non-optional step failure", {
      given: ["a backend where step 2 fails", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockRejectedValueOnce(new Error("Step failed"));
        return mockBackend;
      }],
      when: ["processing pipeline with required failure", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [
            { task: "step1" },
            { task: "step2" },
            { task: "step3" },
          ],
        }).catch((e: Error) => ({ error: e, mockBackend }))
      ],
      then: ["throws and only 2 steps executed", (result) => {
        const r = result as { error: Error; mockBackend: Backend };
        expect(r.error.message).toContain("Step failed");
        expect(r.mockBackend.execute).toHaveBeenCalledTimes(2);
      }],
      cleanup: clearBackends,
    });
  });

  rule("processTask - runWhen conditional execution", () => {
    unit("skips steps with runWhen='on-demand'", {
      given: ["a backend with 2 results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockResolvedValueOnce({ result: "step3" });
        return mockBackend;
      }],
      when: ["processing pipeline with on-demand step", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [
            { id: "a", task: "step1" },
            { id: "b", task: "step2", runWhen: "on-demand", dependsOn: ["a"] },
            { id: "c", task: "step3", dependsOn: ["a"] },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["on-demand step skipped", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(2);
        const r = result as { stepResults: Record<string, unknown>; stepStatus: Array<{ id: string; status: string }> };
        expect(r.stepResults["b"]).toEqual({ skipped: true, reason: "on-demand" });
        expect(r.stepStatus.find(s => s.id === "b")?.status).toBe("skipped");
      }],
      cleanup: clearBackends,
    });

    unit("skips steps when template condition is falsy", {
      given: ["a backend with 1 result", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" });
        return mockBackend;
      }],
      when: ["processing pipeline with falsy condition", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: { includeOptional: false },
          steps: [
            { id: "a", task: "step1" },
            { id: "b", task: "step2", runWhen: "{{payload.includeOptional}}", dependsOn: ["a"] },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["conditional step skipped", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(1);
        const r = result as { stepResults: Record<string, unknown> };
        expect(r.stepResults["b"]).toEqual({
          skipped: true,
          reason: "condition-false",
          condition: "{{payload.includeOptional}}",
        });
      }],
      cleanup: clearBackends,
    });

    unit("runs steps when template condition is truthy", {
      given: ["a backend with 2 results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockResolvedValueOnce({ result: "step2" });
        return mockBackend;
      }],
      when: ["processing pipeline with truthy condition", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: { includeOptional: true },
          steps: [
            { id: "a", task: "step1" },
            { id: "b", task: "step2", runWhen: "{{payload.includeOptional}}", dependsOn: ["a"] },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["both steps executed", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(2);
        const r = result as { stepResults: Record<string, unknown> };
        expect(r.stepResults["b"]).toEqual({ result: "step2" });
      }],
      cleanup: clearBackends,
    });

    unit("runs steps with runWhen='always' (default behavior)", {
      given: ["a backend with 2 results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockResolvedValueOnce({ result: "step2" });
        return mockBackend;
      }],
      when: ["processing pipeline with always condition", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [
            { id: "a", task: "step1" },
            { id: "b", task: "step2", runWhen: "always", dependsOn: ["a"] },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["both steps executed", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(2);
        const r = result as { stepResults: Record<string, unknown> };
        expect(r.stepResults["b"]).toEqual({ result: "step2" });
      }],
      cleanup: clearBackends,
    });
  });

  rule("processTask - runWhen in sequential mode", () => {
    unit("skips steps with runWhen condition in sequential mode", {
      given: ["a backend with 2 results", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn()
          .mockResolvedValueOnce({ result: "step1" })
          .mockResolvedValueOnce({ result: "step3" });
        return mockBackend;
      }],
      when: ["processing sequential pipeline with falsy condition", (mockBackend) =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: { skip: false },
          steps: [
            { task: "step1" },
            { task: "step2", runWhen: "{{payload.skip}}" },
            { task: "step3" },
          ],
        }).then((result) => ({ result, mockBackend }))
      ],
      then: ["conditional step skipped", ({ result, mockBackend }) => {
        expect(mockBackend.execute).toHaveBeenCalledTimes(2);
        const r = result as { steps: unknown[]; stepStatus: Array<{ id: string; status: string }> };
        expect(r.steps[1]).toEqual({
          skipped: true,
          reason: "condition-false",
          condition: "{{payload.skip}}",
        });
        expect(r.stepStatus[1].status).toBe("skipped");
      }],
      cleanup: clearBackends,
    });
  });

  rule("processTask - timeout enforcement", () => {
    unit("times out step after specified seconds", {
      given: ["a slow backend (100ms)", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ result: "done" }), 100)),
        );
        return mockBackend;
      }],
      then: ["rejects with timeout error", async () => {
        await expect(processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [{ id: "slow", task: "slow.task", timeout: 0.01 }],
        })).rejects.toThrow('"slow" timed out after 10ms');
      }],
      cleanup: clearBackends,
    });

    unit("completes before timeout", {
      given: ["a fast backend (10ms)", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ result: "done" }), 10)),
        );
      }],
      when: ["processing with generous timeout", () =>
        processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [{ id: "fast", task: "fast.task", timeout: 1 }],
        })
      ],
      then: ["succeeds with result", (result) => {
        const r = result as { stepResults: Record<string, unknown> };
        expect(r.stepResults["fast"]).toEqual({ result: "done" });
      }],
      cleanup: clearBackends,
    });

    unit("uses task.resources.timeout as fallback", {
      given: ["a slow backend (100ms)", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ result: "done" }), 100)),
        );
      }],
      then: ["rejects with timeout from resources", async () => {
        await expect(processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          resources: { timeout: 0.01 },
          steps: [{ id: "slow", task: "slow.task" }],
        })).rejects.toThrow('"slow" timed out after 10ms');
      }],
      cleanup: clearBackends,
    });

    unit("times out in sequential mode", {
      given: ["a slow backend (100ms)", () => {
        const mockBackend = withBackend();
        mockBackend.execute = vi.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ result: "done" }), 100)),
        );
      }],
      then: ["rejects with step_0 timeout", async () => {
        await expect(processTask({
          type: "pipeline",
          backend: "modal",
          payload: {},
          steps: [{ task: "slow.task", timeout: 0.01 }],
        })).rejects.toThrow('"step_0" timed out after 10ms');
      }],
      cleanup: clearBackends,
    });
  });
});
