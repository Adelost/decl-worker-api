/**
 * Unit tests for core types.
 */

import { feature, rule, unit, expect } from "bdd-vitest";
import type { Task, Effect, Backend, ResourceRequirements } from "../src/index.js";

feature("Task type", () => {
  unit("allows minimal task definition", {
    given: ["a minimal task", () => ({
      type: "llm.chat",
      payload: { prompt: "Hello" },
    }) satisfies Task],
    then: ["has correct fields", (task) => {
      expect(task.type).toBe("llm.chat");
      expect(task.payload).toEqual({ prompt: "Hello" });
      expect(task.backend).toBeUndefined();
    }],
  });

  unit("allows full task definition", {
    given: ["a fully specified task", () => ({
      id: "task-123",
      type: "llm.chat",
      backend: "modal",
      queue: "gpu",
      priority: 10,
      payload: { prompt: "Hello", model: "gpt-4" },
      resources: {
        gpu: "T4",
        vram: 8000,
        timeout: 120,
      },
      retry: {
        attempts: 3,
        backoff: "exponential",
        delay: 1000,
      },
      onSuccess: [{ $event: "toast", text: "Done!" }],
      onError: [{ $event: "webhook", url: "https://example.com/error" }],
    }) satisfies Task],
    then: ["has all fields populated", (task) => {
      expect(task.id).toBe("task-123");
      expect(task.backend).toBe("modal");
      expect(task.queue).toBe("gpu");
      expect(task.resources?.gpu).toBe("T4");
      expect(task.retry?.attempts).toBe(3);
      expect(task.onSuccess).toHaveLength(1);
    }],
  });

  unit("allows pipeline task with steps", {
    given: ["a task with steps", () => ({
      type: "video-analysis",
      payload: { url: "https://example.com/video.mp4" },
      steps: [
        { task: "process.download", input: { url: "{{payload.url}}" } },
        { task: "audio.transcribe", input: { path: "{{steps.0.result}}" } },
        { task: "llm.summarize", input: { text: "{{steps.1.result}}" }, optional: true },
      ],
    }) satisfies Task],
    then: ["has correct steps", (task) => {
      expect(task.steps).toHaveLength(3);
      expect(task.steps![0].task).toBe("process.download");
      expect(task.steps![2].optional).toBe(true);
    }],
  });
});

feature("Effect types", () => {
  unit.outline("allows effect type", [
    { name: "toast", $event: "toast", extra: { text: "Task completed!", variant: "success" } },
    { name: "webhook", $event: "webhook", extra: { url: "https://example.com/hook", method: "POST", headers: { "X-Custom": "value" } } },
    { name: "notify", $event: "notify", extra: { channel: "slack", message: "Task completed", target: "#general" } },
    { name: "enqueue", $event: "enqueue", extra: { task: { type: "llm.summarize", payload: { text: "{{result}}" } } } },
    { name: "invalidate", $event: "invalidate", extra: { path: "/api/data", tags: ["cache"] } },
    { name: "emit", $event: "emit", extra: { event: "custom-event", data: { key: "value" } } },
  ], {
    given: (row) => ({ $event: row.$event, ...row.extra }) as Effect,
    when: (effect) => effect,
    then: (effect, _, row) => {
      expect(effect.$event).toBe(row.$event);
    },
  });
});

feature("ResourceRequirements type", () => {
  unit("allows GPU requirement as boolean", {
    given: ["boolean GPU resource", () => ({
      gpu: true,
      timeout: 300,
    }) satisfies ResourceRequirements],
    then: ["gpu is boolean", (resources) => {
      expect(resources.gpu).toBe(true);
    }],
  });

  unit("allows GPU requirement as string", {
    given: ["string GPU resource", () => ({
      gpu: "A100",
      vram: 40000,
      ram: 32000,
      cpu: 4,
    }) satisfies ResourceRequirements],
    then: ["has specific GPU model", (resources) => {
      expect(resources.gpu).toBe("A100");
      expect(resources.vram).toBe(40000);
    }],
  });
});
