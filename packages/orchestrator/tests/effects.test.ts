/**
 * Unit tests for effect handlers.
 */

import { vi } from "vitest";
import { feature, rule, component, expect } from "bdd-vitest";
import { runEffects, type EffectContext } from "../src/engine/effects.js";
import type { Effect, Task } from "@dwa/core";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockTask: Task = {
  id: "task-123",
  type: "llm.chat",
  payload: { prompt: "Hello" },
};

const baseContext: EffectContext = {
  task: mockTask,
  jobId: "job-456",
};

const withEmitters = () => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true });
  globalThis.__toastEmitter = { emit: vi.fn() };
  globalThis.__invalidateEmitter = { emit: vi.fn() };
  globalThis.__eventEmitter = { emit: vi.fn() };
};

const cleanupEmitters = () => {
  delete globalThis.__toastEmitter;
  delete globalThis.__invalidateEmitter;
  delete globalThis.__eventEmitter;
};

feature("Effect Handlers", () => {
  rule("toast effect", () => {
    component("emits toast event", {
      given: ["emitters configured", withEmitters],
      when: ["running toast effect", () =>
        runEffects([{ $event: "toast", text: "Task completed!", variant: "success" }], baseContext)
      ],
      then: ["toast emitter called", () => {
        expect(globalThis.__toastEmitter?.emit).toHaveBeenCalledWith("toast", {
          text: "Task completed!",
          variant: "success",
          taskId: "task-123",
        });
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("webhook effect", () => {
    component("calls webhook with POST by default", {
      given: ["emitters configured", withEmitters],
      when: ["running webhook effect", () =>
        runEffects(
          [{ $event: "webhook", url: "https://example.com/hook" }],
          { ...baseContext, result: { data: "test" } },
        )
      ],
      then: ["fetch called with POST and payload", () => {
        expect(mockFetch).toHaveBeenCalledWith("https://example.com/hook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        });
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.task).toEqual(mockTask);
        expect(body.result).toEqual({ data: "test" });
      }],
      cleanup: cleanupEmitters,
    });

    component("uses specified HTTP method", {
      given: ["emitters configured", withEmitters],
      when: ["running webhook with PUT", () =>
        runEffects([{ $event: "webhook", url: "https://example.com/hook", method: "PUT" }], baseContext)
      ],
      then: ["fetch uses PUT", () => {
        expect(mockFetch).toHaveBeenCalledWith(
          "https://example.com/hook",
          expect.objectContaining({ method: "PUT" }),
        );
      }],
      cleanup: cleanupEmitters,
    });

    component("includes custom headers", {
      given: ["emitters configured", withEmitters],
      when: ["running webhook with headers", () =>
        runEffects([{
          $event: "webhook",
          url: "https://example.com/hook",
          headers: { "X-Custom": "value", Authorization: "Bearer token" },
        }], baseContext)
      ],
      then: ["fetch has merged headers", () => {
        expect(mockFetch).toHaveBeenCalledWith(
          "https://example.com/hook",
          expect.objectContaining({
            headers: {
              "Content-Type": "application/json",
              "X-Custom": "value",
              Authorization: "Bearer token",
            },
          }),
        );
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("invalidate effect", () => {
    component("emits invalidate event with path", {
      given: ["emitters configured", withEmitters],
      when: ["running invalidate effect", () =>
        runEffects([{ $event: "invalidate", path: "/api/data" }], baseContext)
      ],
      then: ["invalidate emitter called with path", () => {
        expect(globalThis.__invalidateEmitter?.emit).toHaveBeenCalledWith("invalidate", {
          path: "/api/data",
          tags: undefined,
          taskId: "task-123",
        });
      }],
      cleanup: cleanupEmitters,
    });

    component("emits invalidate event with tags", {
      given: ["emitters configured", withEmitters],
      when: ["running invalidate with tags", () =>
        runEffects([{ $event: "invalidate", tags: ["users", "cache"] }], baseContext)
      ],
      then: ["invalidate emitter called with tags", () => {
        expect(globalThis.__invalidateEmitter?.emit).toHaveBeenCalledWith("invalidate", {
          path: undefined,
          tags: ["users", "cache"],
          taskId: "task-123",
        });
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("emit effect", () => {
    component("emits custom event", {
      given: ["emitters configured", withEmitters],
      when: ["running emit effect", () =>
        runEffects([{ $event: "emit", event: "custom-event", data: { key: "value" } }], baseContext)
      ],
      then: ["event emitter called", () => {
        expect(globalThis.__eventEmitter?.emit).toHaveBeenCalledWith("custom-event", {
          data: { key: "value" },
          taskId: "task-123",
        });
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("multiple effects", () => {
    component("runs all effects in order", {
      given: ["emitters configured", withEmitters],
      when: ["running multiple effects", () =>
        runEffects([
          { $event: "toast", text: "Starting..." },
          { $event: "webhook", url: "https://example.com/hook" },
          { $event: "toast", text: "Done!" },
        ], baseContext)
      ],
      then: ["all handlers called", () => {
        expect(globalThis.__toastEmitter?.emit).toHaveBeenCalledTimes(2);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }],
      cleanup: cleanupEmitters,
    });

    component("continues on effect error", {
      given: ["emitters with failing webhook", () => {
        withEmitters();
        mockFetch.mockRejectedValueOnce(new Error("Network error"));
      }],
      when: ["running effects with failure", () =>
        runEffects([
          { $event: "webhook", url: "https://example.com/hook" },
          { $event: "toast", text: "Done!" },
        ], baseContext)
      ],
      then: ["toast still called after webhook failure", () => {
        expect(globalThis.__toastEmitter?.emit).toHaveBeenCalled();
      }],
      cleanup: cleanupEmitters,
    });
  });

  rule("context interpolation", () => {
    component("interpolates error message in notify", {
      given: ["emitters configured", withEmitters],
      when: ["running notify with interpolation", () =>
        runEffects(
          [{ $event: "notify", channel: "slack", message: "Error: {{error}}" }],
          { ...baseContext, error: "Connection failed" },
        )
      ],
      then: ["does not throw", () => {
        // notify handler logs but doesn't emit (no webhook configured)
      }],
      cleanup: cleanupEmitters,
    });
  });
});
