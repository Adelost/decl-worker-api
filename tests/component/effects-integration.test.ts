/**
 * E2E tests for effects integration.
 */

import { vi } from "vitest";
import { feature, rule, component, expect } from "bdd-vitest";
import type { Effect, Task } from "@dwa/core";
import { runEffects, type EffectContext } from "../../packages/orchestrator/src/engine/effects.js";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockTask: Task = {
  id: "task-123",
  type: "llm.chat",
  payload: { prompt: "Hello" },
};

interface EmitterCtx {
  toastEvents: unknown[];
  invalidateEvents: unknown[];
  customEvents: unknown[];
}

const withEmitters = (): EmitterCtx => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true });

  const ctx: EmitterCtx = {
    toastEvents: [],
    invalidateEvents: [],
    customEvents: [],
  };

  globalThis.__toastEmitter = {
    emit: (_event: string, data: unknown) => ctx.toastEvents.push({ event: _event, data }),
  };
  globalThis.__invalidateEmitter = {
    emit: (_event: string, data: unknown) => ctx.invalidateEvents.push({ event: _event, data }),
  };
  globalThis.__eventEmitter = {
    emit: (_event: string, data: unknown) => ctx.customEvents.push({ event: _event, data }),
  };

  return ctx;
};

const cleanupEmitters = () => {
  delete globalThis.__toastEmitter;
  delete globalThis.__invalidateEmitter;
  delete globalThis.__eventEmitter;
};

feature("Effects Integration", () => {
  rule("Webhook Effects", () => {
    component("sends webhook with task result", {
      given: ["emitters configured", withEmitters],
      when: ["running webhook with result", () =>
        runEffects(
          [{ $event: "webhook", url: "https://api.example.com/callback" }],
          { task: mockTask, jobId: "job-456", result: { answer: "Paris is the capital of France" } },
        )
      ],
      then: ["fetch called with result payload", () => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, options] = mockFetch.mock.calls[0];
        expect(url).toBe("https://api.example.com/callback");
        expect(options.method).toBe("POST");
        const body = JSON.parse(options.body);
        expect(body.task.id).toBe("task-123");
        expect(body.result).toEqual({ answer: "Paris is the capital of France" });
      }],
      cleanup: cleanupEmitters,
    });

    component("sends webhook with error on failure", {
      given: ["emitters configured", withEmitters],
      when: ["running webhook with error context", () =>
        runEffects(
          [{ $event: "webhook", url: "https://api.example.com/errors" }],
          { task: mockTask, jobId: "job-456", error: "API rate limit exceeded" },
        )
      ],
      then: ["body includes error", () => {
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.error).toBe("API rate limit exceeded");
      }],
      cleanup: cleanupEmitters,
    });

    component("handles webhook failure gracefully", {
      given: ["emitters with failing fetch", () => {
        const ctx = withEmitters();
        mockFetch.mockRejectedValueOnce(new Error("Network error"));
        return ctx;
      }],
      when: ["running webhook + toast", (ctx) =>
        runEffects(
          [
            { $event: "webhook", url: "https://api.example.com/callback" },
            { $event: "toast", text: "Done!" },
          ],
          { task: mockTask, jobId: "job-456" },
        ).then(() => ctx)
      ],
      then: ["toast still emitted", (ctx) => {
        expect(ctx.toastEvents).toHaveLength(1);
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("Toast Effects", () => {
    component("emits success toast", {
      given: ["emitters configured", withEmitters],
      when: ["running success toast", (ctx) =>
        runEffects(
          [{ $event: "toast", text: "Task completed!", variant: "success" }],
          { task: mockTask },
        ).then(() => ctx)
      ],
      then: ["toast event captured", (ctx) => {
        expect(ctx.toastEvents).toHaveLength(1);
        expect(ctx.toastEvents[0]).toEqual({
          event: "toast",
          data: { text: "Task completed!", variant: "success", taskId: "task-123" },
        });
      }],
      cleanup: cleanupEmitters,
    });

    component("emits error toast", {
      given: ["emitters configured", withEmitters],
      when: ["running error toast", (ctx) =>
        runEffects(
          [{ $event: "toast", text: "Something went wrong", variant: "error" }],
          { task: mockTask, error: "Failed" },
        ).then(() => ctx)
      ],
      then: ["error toast captured", (ctx) => {
        expect(ctx.toastEvents[0]).toEqual({
          event: "toast",
          data: { text: "Something went wrong", variant: "error", taskId: "task-123" },
        });
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("Invalidate Effects", () => {
    component("emits path invalidation", {
      given: ["emitters configured", withEmitters],
      when: ["running path invalidation", (ctx) =>
        runEffects(
          [{ $event: "invalidate", path: "/api/users" }],
          { task: mockTask },
        ).then(() => ctx)
      ],
      then: ["invalidation event captured", (ctx) => {
        expect(ctx.invalidateEvents).toHaveLength(1);
        expect(ctx.invalidateEvents[0]).toEqual({
          event: "invalidate",
          data: { path: "/api/users", tags: undefined, taskId: "task-123" },
        });
      }],
      cleanup: cleanupEmitters,
    });

    component("emits tag invalidation", {
      given: ["emitters configured", withEmitters],
      when: ["running tag invalidation", (ctx) =>
        runEffects(
          [{ $event: "invalidate", tags: ["users", "profiles"] }],
          { task: mockTask },
        ).then(() => ctx)
      ],
      then: ["tag invalidation captured", (ctx) => {
        expect(ctx.invalidateEvents[0]).toEqual({
          event: "invalidate",
          data: { path: undefined, tags: ["users", "profiles"], taskId: "task-123" },
        });
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("Custom Emit Effects", () => {
    component("emits custom event with data", {
      given: ["emitters configured", withEmitters],
      when: ["running custom emit", (ctx) =>
        runEffects(
          [{ $event: "emit", event: "analysis-complete", data: { documentId: "doc-123", pageCount: 10 } }],
          { task: mockTask },
        ).then(() => ctx)
      ],
      then: ["custom event captured", (ctx) => {
        expect(ctx.customEvents).toHaveLength(1);
        expect(ctx.customEvents[0]).toEqual({
          event: "analysis-complete",
          data: { data: { documentId: "doc-123", pageCount: 10 }, taskId: "task-123" },
        });
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("Effect Chains", () => {
    component("executes all effects in sequence", {
      given: ["emitters configured", withEmitters],
      when: ["running 7 effects", (ctx) =>
        runEffects([
          { $event: "toast", text: "Starting..." },
          { $event: "webhook", url: "https://api.example.com/start" },
          { $event: "emit", event: "task-started" },
          { $event: "toast", text: "Processing..." },
          { $event: "webhook", url: "https://api.example.com/end" },
          { $event: "invalidate", path: "/api/data" },
          { $event: "toast", text: "Done!" },
        ], { task: mockTask, result: { success: true } }).then(() => ctx)
      ],
      then: ["all effect types fired", (ctx) => {
        expect(ctx.toastEvents).toHaveLength(3);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(ctx.customEvents).toHaveLength(1);
        expect(ctx.invalidateEvents).toHaveLength(1);
      }],
      cleanup: cleanupEmitters,
    });

    component("continues after individual effect failure", {
      given: ["emitters with first webhook failing", () => {
        const ctx = withEmitters();
        mockFetch
          .mockRejectedValueOnce(new Error("First webhook failed"))
          .mockResolvedValueOnce({ ok: true });
        return ctx;
      }],
      when: ["running effects with failure", (ctx) =>
        runEffects([
          { $event: "webhook", url: "https://api.example.com/fail" },
          { $event: "toast", text: "Still running" },
          { $event: "webhook", url: "https://api.example.com/success" },
        ], { task: mockTask }).then(() => ctx)
      ],
      then: ["remaining effects still fired", (ctx) => {
        expect(ctx.toastEvents).toHaveLength(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      }],
      cleanup: cleanupEmitters,
    });
  });
});
