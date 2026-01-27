/**
 * Unit tests for core types.
 */

import { describe, it, expect } from "vitest";
import type { Task, Effect, Backend, ResourceRequirements } from "../src/index.js";

describe("Task type", () => {
  it("should allow minimal task definition", () => {
    const task: Task = {
      type: "llm.chat",
      payload: { prompt: "Hello" },
    };

    expect(task.type).toBe("llm.chat");
    expect(task.payload).toEqual({ prompt: "Hello" });
    expect(task.backend).toBeUndefined();
  });

  it("should allow full task definition", () => {
    const task: Task = {
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
    };

    expect(task.id).toBe("task-123");
    expect(task.backend).toBe("modal");
    expect(task.queue).toBe("gpu");
    expect(task.resources?.gpu).toBe("T4");
    expect(task.retry?.attempts).toBe(3);
    expect(task.onSuccess).toHaveLength(1);
  });

  it("should allow pipeline task with steps", () => {
    const task: Task = {
      type: "video-analysis",
      payload: { url: "https://example.com/video.mp4" },
      steps: [
        { task: "process.download", input: { url: "{{payload.url}}" } },
        { task: "audio.transcribe", input: { path: "{{steps.0.result}}" } },
        { task: "llm.summarize", input: { text: "{{steps.1.result}}" }, optional: true },
      ],
    };

    expect(task.steps).toHaveLength(3);
    expect(task.steps![0].task).toBe("process.download");
    expect(task.steps![2].optional).toBe(true);
  });
});

describe("Effect types", () => {
  it("should allow toast effect", () => {
    const effect: Effect = {
      $event: "toast",
      text: "Task completed!",
      variant: "success",
    };

    expect(effect.$event).toBe("toast");
  });

  it("should allow webhook effect", () => {
    const effect: Effect = {
      $event: "webhook",
      url: "https://example.com/hook",
      method: "POST",
      headers: { "X-Custom": "value" },
    };

    expect(effect.$event).toBe("webhook");
  });

  it("should allow notify effect", () => {
    const effect: Effect = {
      $event: "notify",
      channel: "slack",
      message: "Task completed",
      target: "#general",
    };

    expect(effect.$event).toBe("notify");
  });

  it("should allow enqueue effect", () => {
    const effect: Effect = {
      $event: "enqueue",
      task: {
        type: "llm.summarize",
        payload: { text: "{{result}}" },
      },
    };

    expect(effect.$event).toBe("enqueue");
  });

  it("should allow invalidate effect", () => {
    const effect: Effect = {
      $event: "invalidate",
      path: "/api/data",
      tags: ["cache"],
    };

    expect(effect.$event).toBe("invalidate");
  });

  it("should allow emit effect", () => {
    const effect: Effect = {
      $event: "emit",
      event: "custom-event",
      data: { key: "value" },
    };

    expect(effect.$event).toBe("emit");
  });
});

describe("ResourceRequirements type", () => {
  it("should allow GPU requirement as boolean", () => {
    const resources: ResourceRequirements = {
      gpu: true,
      timeout: 300,
    };

    expect(resources.gpu).toBe(true);
  });

  it("should allow GPU requirement as string", () => {
    const resources: ResourceRequirements = {
      gpu: "A100",
      vram: 40000,
      ram: 32000,
      cpu: 4,
    };

    expect(resources.gpu).toBe("A100");
    expect(resources.vram).toBe(40000);
  });
});
