/**
 * Unit tests for backend registry.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerBackend,
  unregisterBackend,
  getBackend,
  getAllBackends,
  selectBackend,
  clearBackends,
  type Backend,
  type Task,
} from "../src/index.js";

// Mock backend factory
function createMockBackend(name: string, healthy = true): Backend {
  return {
    name,
    execute: vi.fn().mockResolvedValue({ result: "success" }),
    getStatus: vi.fn().mockResolvedValue({ id: "1", status: "completed" }),
    isHealthy: vi.fn().mockResolvedValue(healthy),
  };
}

describe("Backend Registry", () => {
  beforeEach(() => {
    clearBackends();
  });

  describe("registerBackend", () => {
    it("should register a backend", () => {
      const backend = createMockBackend("modal");
      registerBackend(backend);

      expect(getBackend("modal")).toBe(backend);
    });

    it("should overwrite existing backend with same name", () => {
      const backend1 = createMockBackend("modal");
      const backend2 = createMockBackend("modal");

      registerBackend(backend1);
      registerBackend(backend2);

      expect(getBackend("modal")).toBe(backend2);
    });
  });

  describe("unregisterBackend", () => {
    it("should remove a registered backend", () => {
      const backend = createMockBackend("modal");
      registerBackend(backend);

      const result = unregisterBackend("modal");

      expect(result).toBe(true);
      expect(getBackend("modal")).toBeUndefined();
    });

    it("should return false for non-existent backend", () => {
      const result = unregisterBackend("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getBackend", () => {
    it("should return undefined for non-existent backend", () => {
      expect(getBackend("nonexistent")).toBeUndefined();
    });

    it("should return registered backend", () => {
      const backend = createMockBackend("ray");
      registerBackend(backend);

      expect(getBackend("ray")).toBe(backend);
    });
  });

  describe("getAllBackends", () => {
    it("should return empty array when no backends registered", () => {
      expect(getAllBackends()).toEqual([]);
    });

    it("should return all registered backends", () => {
      const modal = createMockBackend("modal");
      const ray = createMockBackend("ray");

      registerBackend(modal);
      registerBackend(ray);

      const backends = getAllBackends();

      expect(backends).toHaveLength(2);
      expect(backends).toContain(modal);
      expect(backends).toContain(ray);
    });
  });

  describe("selectBackend", () => {
    it("should select specified backend when not auto", async () => {
      const modal = createMockBackend("modal");
      const ray = createMockBackend("ray");

      registerBackend(modal);
      registerBackend(ray);

      const task: Task = {
        type: "llm.chat",
        backend: "ray",
        payload: { prompt: "Hello" },
      };

      const selected = await selectBackend(task);

      expect(selected).toBe(ray);
    });

    it("should throw for unregistered specified backend", async () => {
      const task: Task = {
        type: "llm.chat",
        backend: "modal",
        payload: { prompt: "Hello" },
      };

      await expect(selectBackend(task)).rejects.toThrow('Backend "modal" not registered');
    });

    it("should throw for unhealthy specified backend", async () => {
      const modal = createMockBackend("modal", false);
      registerBackend(modal);

      const task: Task = {
        type: "llm.chat",
        backend: "modal",
        payload: { prompt: "Hello" },
      };

      await expect(selectBackend(task)).rejects.toThrow('Backend "modal" is not healthy');
    });

    it("should auto-select first healthy backend", async () => {
      const unhealthy = createMockBackend("modal", false);
      const healthy = createMockBackend("ray", true);

      registerBackend(unhealthy);
      registerBackend(healthy);

      const task: Task = {
        type: "llm.chat",
        backend: "auto",
        payload: { prompt: "Hello" },
      };

      const selected = await selectBackend(task);

      expect(selected).toBe(healthy);
    });

    it("should auto-select when no backend specified", async () => {
      const modal = createMockBackend("modal");
      registerBackend(modal);

      const task: Task = {
        type: "llm.chat",
        payload: { prompt: "Hello" },
      };

      const selected = await selectBackend(task);

      expect(selected).toBe(modal);
    });

    it("should throw when no healthy backend available for auto", async () => {
      const unhealthy1 = createMockBackend("modal", false);
      const unhealthy2 = createMockBackend("ray", false);

      registerBackend(unhealthy1);
      registerBackend(unhealthy2);

      const task: Task = {
        type: "llm.chat",
        backend: "auto",
        payload: { prompt: "Hello" },
      };

      await expect(selectBackend(task)).rejects.toThrow("No healthy backend available");
    });
  });

  describe("clearBackends", () => {
    it("should remove all backends", () => {
      registerBackend(createMockBackend("modal"));
      registerBackend(createMockBackend("ray"));

      clearBackends();

      expect(getAllBackends()).toHaveLength(0);
    });
  });
});
