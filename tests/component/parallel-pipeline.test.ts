/**
 * E2E tests for parallel pipeline execution (DAG-based).
 */

import { feature, rule, component, expect } from "bdd-vitest";
import { registerBackend, clearBackends, type Task } from "@dwa/core";
import { processTask } from "../../packages/orchestrator/src/engine/dispatcher.js";
import { MockBackend } from "./mock-backend.js";

interface PipelineCtx {
  mockBackend: MockBackend;
  executionLog: Array<{ task: string; startTime: number; endTime: number }>;
}

const withTimedBackend = (): PipelineCtx => {
  clearBackends();
  const mockBackend = new MockBackend("modal");
  registerBackend(mockBackend);
  const executionLog: PipelineCtx["executionLog"] = [];
  setupTimingHandlers(mockBackend, executionLog);
  return { mockBackend, executionLog };
};

const cleanupBackend = (ctx: PipelineCtx) => {
  ctx.mockBackend.reset();
  clearBackends();
};

feature("Parallel Pipeline Execution", () => {
  rule("DAG-based parallel execution", () => {
    component("runs independent steps in parallel", {
      slow: true,
      given: ["a timed backend", withTimedBackend],
      when: ["processing two independent steps", async (ctx) => {
        const startTime = Date.now();
        await processTask({
          type: "parallel-test",
          backend: "modal",
          payload: {},
          steps: [
            { id: "a", task: "slow.task" },
            { id: "b", task: "slow.task" },
          ],
        });
        return { ...ctx, totalTime: Date.now() - startTime };
      }],
      then: ["both ran in parallel", ({ totalTime, executionLog }) => {
        expect(totalTime).toBeLessThan(150);
        const timeDiff = Math.abs(executionLog[0].startTime - executionLog[1].startTime);
        expect(timeDiff).toBeLessThan(20);
      }],
      cleanup: cleanupBackend,
    });

    component("respects dependencies and runs sequentially when needed", {
      slow: true,
      given: ["a timed backend", withTimedBackend],
      when: ["processing dependent steps", async (ctx) => {
        await processTask({
          type: "sequential-test",
          backend: "modal",
          payload: {},
          steps: [
            { id: "first", task: "slow.task" },
            { id: "second", task: "slow.task", dependsOn: ["first"] },
          ],
        });
        return ctx;
      }],
      then: ["second started after first completed", ({ executionLog }) => {
        const firstEnd = executionLog.find((e) => e.task === "slow.task")!.endTime;
        const secondStart = executionLog[1].startTime;
        expect(secondStart).toBeGreaterThanOrEqual(firstEnd);
      }],
      cleanup: cleanupBackend,
    });

    component("handles diamond dependency pattern", {
      slow: true,
      given: ["a timed backend", withTimedBackend],
      when: ["processing diamond DAG (A→B+C→D)", async (ctx) => {
        const startTime = Date.now();
        const result = await processTask({
          type: "diamond-test",
          backend: "modal",
          payload: {},
          steps: [
            { id: "A", task: "instant.task" },
            { id: "B", task: "slow.task", dependsOn: ["A"] },
            { id: "C", task: "slow.task", dependsOn: ["A"] },
            { id: "D", task: "instant.task", dependsOn: ["B", "C"] },
          ],
        }) as { steps: unknown[]; stepResults: Record<string, unknown> };
        return { ...ctx, result, totalTime: Date.now() - startTime };
      }],
      then: ["B and C ran in parallel, D completed", ({ result, totalTime }) => {
        expect(result.steps).toHaveLength(4);
        expect(result.stepResults["D"]).toBeDefined();
        expect(totalTime).toBeLessThan(120);
      }],
      cleanup: cleanupBackend,
    });

    component("handles video analysis DAG pattern", {
      slow: true,
      given: ["a timed backend", withTimedBackend],
      when: ["processing 10-step video analysis DAG", async (ctx) => {
        const result = await processTask({
          type: "video-analysis",
          backend: "modal",
          payload: { url: "https://example.com/video.mp4" },
          steps: [
            { id: "download", task: "process.download", input: { url: "{{payload.url}}" } },
            { id: "frames", task: "process.extract_frames", dependsOn: ["download"] },
            { id: "audio", task: "process.extract_audio", dependsOn: ["download"] },
            { id: "siglip", task: "vision.siglip", dependsOn: ["frames"] },
            { id: "yolo", task: "vision.yolo", dependsOn: ["frames"] },
            { id: "florence", task: "vision.florence", dependsOn: ["frames"] },
            { id: "faces", task: "vision.faces", dependsOn: ["frames"] },
            { id: "whisper", task: "audio.whisper", dependsOn: ["audio"] },
            { id: "scenes", task: "video.scenes", dependsOn: ["siglip"] },
            { id: "tags", task: "video.tags", dependsOn: ["scenes"] },
          ],
        }) as { steps: unknown[]; stepResults: Record<string, unknown> };
        return { ...ctx, result };
      }],
      then: ["all 10 steps completed in dependency order", ({ result, executionLog }) => {
        expect(result.steps).toHaveLength(10);
        const getIdx = (id: string) =>
          executionLog.findIndex((e) => e.task.includes(id.split(".").pop()!));
        expect(executionLog[0].task).toContain("download");
        expect(getIdx("scenes")).toBeGreaterThan(getIdx("siglip"));
        expect(getIdx("tags")).toBeGreaterThan(getIdx("scenes"));
      }],
      cleanup: cleanupBackend,
    });

    component("provides results keyed by step ID", {
      given: ["a timed backend", withTimedBackend],
      when: ["processing named steps", async () =>
        processTask({
          type: "named-steps",
          backend: "modal",
          payload: { text: "hello" },
          steps: [
            { id: "embed", task: "llm.embed", input: { text: "{{payload.text}}" } },
            { id: "summarize", task: "llm.summarize", input: { text: "{{payload.text}}" } },
          ],
        }) as Promise<{ steps: unknown[]; stepResults: Record<string, unknown> }>
      ],
      then: ["results accessible by index and ID", (result) => {
        expect(result.steps[0]).toBeDefined();
        expect(result.stepResults["embed"]).toBeDefined();
        expect(result.stepResults["summarize"]).toBeDefined();
      }],
      cleanup: cleanupBackend,
    });

    component("allows referencing results by step ID in templates", {
      given: ["a backend with custom handlers", () => {
        const ctx = withTimedBackend();
        ctx.mockBackend.registerHandler("step.a", () => ({ value: 42 }));
        ctx.mockBackend.registerHandler("step.b", (payload) => ({
          received: payload.fromA,
        }));
        return ctx;
      }],
      when: ["processing pipeline with ID-based templates", async () =>
        processTask({
          type: "reference-by-id",
          backend: "modal",
          payload: {},
          steps: [
            { id: "stepA", task: "step.a" },
            { id: "stepB", task: "step.b", dependsOn: ["stepA"], input: { fromA: "{{steps.stepA.value}}" } },
          ],
        }) as Promise<{ stepResults: Record<string, { received?: number }> }>
      ],
      then: ["step B received value from step A", (result) => {
        expect(result.stepResults["stepB"].received).toBe(42);
      }],
      cleanup: cleanupBackend,
    });

    component("detects circular dependencies", {
      given: ["a timed backend", withTimedBackend],
      then: ["rejects with deadlock", async () => {
        await expect(processTask({
          type: "circular",
          backend: "modal",
          payload: {},
          steps: [
            { id: "a", task: "instant.task", dependsOn: ["b"] },
            { id: "b", task: "instant.task", dependsOn: ["a"] },
          ],
        })).rejects.toThrow("deadlock");
      }],
      cleanup: cleanupBackend,
    });

    component("handles optional failed step in DAG", {
      given: ["a backend with failing handler", () => {
        const ctx = withTimedBackend();
        ctx.mockBackend.registerHandler("failing.task", () => {
          throw new Error("Always fails");
        });
        return ctx;
      }],
      when: ["processing DAG with optional failure", async () =>
        processTask({
          type: "optional-fail",
          backend: "modal",
          payload: {},
          steps: [
            { id: "start", task: "instant.task" },
            { id: "optional", task: "failing.task", dependsOn: ["start"], optional: true },
            { id: "end", task: "instant.task", dependsOn: ["optional"] },
          ],
        }) as Promise<{ stepResults: Record<string, unknown> }>
      ],
      then: ["optional skipped, end still completed", (result) => {
        expect((result.stepResults["optional"] as { skipped: boolean }).skipped).toBe(true);
        expect(result.stepResults["end"]).toBeDefined();
      }],
      cleanup: cleanupBackend,
    });
  });

  rule("forEach iteration", () => {
    component("runs step for each item in array", {
      given: ["a backend with process.item handler", () => {
        const ctx = withTimedBackend();
        ctx.mockBackend.registerHandler("process.item", (payload) => ({
          processed: payload.value,
          doubled: (payload.value as number) * 2,
        }));
        return ctx;
      }],
      when: ["processing forEach over 5 items", async () =>
        processTask({
          type: "foreach-test",
          backend: "modal",
          payload: { items: [1, 2, 3, 4, 5] },
          steps: [{
            id: "process",
            task: "process.item",
            forEach: "{{payload.items}}",
            input: { value: "{{item}}" },
          }],
        }) as Promise<{ stepResults: Record<string, Array<{ processed: number; doubled: number }>> }>
      ],
      then: ["5 results with correct values", (result) => {
        expect(result.stepResults["process"]).toHaveLength(5);
        expect(result.stepResults["process"][0].processed).toBe(1);
        expect(result.stepResults["process"][0].doubled).toBe(2);
        expect(result.stepResults["process"][4].processed).toBe(5);
        expect(result.stepResults["process"][4].doubled).toBe(10);
      }],
      cleanup: cleanupBackend,
    });

    component("provides index in forEach context", {
      given: ["a backend with indexed handler", () => {
        const ctx = withTimedBackend();
        ctx.mockBackend.registerHandler("indexed.task", (payload) => ({
          index: payload.idx,
          value: payload.val,
        }));
        return ctx;
      }],
      when: ["processing forEach with index template", async () =>
        processTask({
          type: "foreach-index",
          backend: "modal",
          payload: { items: ["a", "b", "c"] },
          steps: [{
            id: "indexed",
            task: "indexed.task",
            forEach: "{{payload.items}}",
            input: { val: "{{item}}", idx: "{{index}}" },
          }],
        }) as Promise<{ stepResults: Record<string, Array<{ index: number; value: string }>> }>
      ],
      then: ["index and value correctly passed", (result) => {
        expect(result.stepResults["indexed"][0]).toEqual({ index: 0, value: "a" });
        expect(result.stepResults["indexed"][1]).toEqual({ index: 1, value: "b" });
        expect(result.stepResults["indexed"][2]).toEqual({ index: 2, value: "c" });
      }],
      cleanup: cleanupBackend,
    });

    component("respects forEachConcurrency limit", {
      slow: true,
      given: ["a backend tracking concurrency", () => {
        const ctx = withTimedBackend();
        let maxConcurrent = 0;
        let currentConcurrent = 0;
        ctx.mockBackend.registerHandler("concurrent.task", async () => {
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
          await new Promise((r) => setTimeout(r, 20));
          currentConcurrent--;
          return { ok: true };
        });
        return { ...ctx, getMaxConcurrent: () => maxConcurrent };
      }],
      when: ["processing forEach with concurrency=2", async (ctx) => {
        await processTask({
          type: "concurrency-test",
          backend: "modal",
          payload: { items: [1, 2, 3, 4, 5, 6] },
          steps: [{
            id: "limited",
            task: "concurrent.task",
            forEach: "{{payload.items}}",
            forEachConcurrency: 2,
          }],
        });
        return ctx;
      }],
      then: ["max concurrency was 2 or less", (ctx) => {
        expect(ctx.getMaxConcurrent()).toBeLessThanOrEqual(2);
      }],
      cleanup: cleanupBackend,
    });

    component("uses forEach with scene descriptions pattern", {
      given: ["a backend with scene + describe handlers", () => {
        const ctx = withTimedBackend();
        ctx.mockBackend.registerHandler("video.detect_scenes", () => ({
          scenes: [
            { start: 0, end: 10, keyframe: "/frames/001.jpg" },
            { start: 10, end: 25, keyframe: "/frames/010.jpg" },
            { start: 25, end: 40, keyframe: "/frames/025.jpg" },
          ],
        }));
        ctx.mockBackend.registerHandler("vision.describe", (payload) => ({
          image: payload.image_path,
          description: `A scene showing ${payload.image_path}`,
          regions: [{ label: "person", bbox: [0, 0, 100, 200] }],
        }));
        return ctx;
      }],
      when: ["processing scene detection + forEach describe", async () =>
        processTask({
          type: "scene-descriptions",
          backend: "modal",
          payload: { video: "/video.mp4" },
          steps: [
            { id: "scenes", task: "video.detect_scenes", input: { video_path: "{{payload.video}}" } },
            {
              id: "descriptions",
              task: "vision.describe",
              dependsOn: ["scenes"],
              forEach: "{{steps.scenes.scenes}}",
              input: { image_path: "{{item.keyframe}}" },
            },
          ],
        }) as Promise<{ stepResults: Record<string, unknown> }>
      ],
      then: ["3 scene descriptions generated", (result) => {
        const descriptions = result.stepResults["descriptions"] as Array<{ image: string; description: string }>;
        expect(descriptions).toHaveLength(3);
        expect(descriptions[0].image).toBe("/frames/001.jpg");
        expect(descriptions[1].image).toBe("/frames/010.jpg");
        expect(descriptions[2].image).toBe("/frames/025.jpg");
      }],
      cleanup: cleanupBackend,
    });
  });

  rule("Backward compatibility", () => {
    component("runs sequentially when no IDs or dependsOn", {
      slow: true,
      given: ["a timed backend", withTimedBackend],
      when: ["processing legacy sequential pipeline", async () => {
        const startTime = Date.now();
        await processTask({
          type: "legacy",
          backend: "modal",
          payload: {},
          steps: [
            { task: "slow.task" },
            { task: "slow.task" },
          ],
        });
        return Date.now() - startTime;
      }],
      then: ["total time reflects sequential execution", (totalTime) => {
        expect(totalTime).toBeGreaterThanOrEqual(90);
      }],
      cleanup: cleanupBackend,
    });

    component("still supports {{steps.0.result}} syntax for sequential", {
      given: ["a backend with custom handlers", () => {
        const ctx = withTimedBackend();
        ctx.mockBackend.registerHandler("return.value", () => ({ data: "test" }));
        ctx.mockBackend.registerHandler("use.value", (payload) => ({
          received: payload.input,
        }));
        return ctx;
      }],
      when: ["processing legacy template references", async () =>
        processTask({
          type: "legacy-templates",
          backend: "modal",
          payload: {},
          steps: [
            { task: "return.value" },
            { task: "use.value", input: { input: "{{steps.0.data}}" } },
          ],
        }) as Promise<{ steps: [unknown, { received: string }] }>
      ],
      then: ["step 1 received data from step 0", (result) => {
        expect(result.steps[1].received).toBe("test");
      }],
      cleanup: cleanupBackend,
    });
  });
});

/**
 * Setup handlers that track execution timing.
 */
function setupTimingHandlers(
  backend: MockBackend,
  log: Array<{ task: string; startTime: number; endTime: number }>,
): void {
  backend.registerHandler("slow.task", async () => {
    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 50));
    const endTime = Date.now();
    log.push({ task: "slow.task", startTime, endTime });
    return { completed: true };
  });

  backend.registerHandler("instant.task", () => {
    const now = Date.now();
    log.push({ task: "instant.task", startTime: now, endTime: now });
    return { completed: true };
  });

  const videoHandlers = [
    "process.download", "process.extract_frames", "process.extract_audio",
    "vision.siglip", "vision.yolo", "vision.florence", "vision.faces",
    "audio.whisper", "video.scenes", "video.tags",
  ];

  for (const handler of videoHandlers) {
    backend.registerHandler(handler, async () => {
      const startTime = Date.now();
      await new Promise((r) => setTimeout(r, 10));
      const endTime = Date.now();
      log.push({ task: handler, startTime, endTime });
      return { task: handler, completed: true };
    });
  }

  backend.registerHandler("llm.embed", () => ({
    embedding: Array(10).fill(0.1),
  }));

  backend.registerHandler("llm.summarize", () => ({
    summary: "Test summary",
  }));
}
