/**
 * Unit tests for backend registry.
 */

import { vi } from "vitest";
import { feature, rule, unit, expect } from "bdd-vitest";
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

function createMockBackend(name: string, healthy = true): Backend {
  return {
    name,
    execute: vi.fn().mockResolvedValue({ result: "success" }),
    getStatus: vi.fn().mockResolvedValue({ id: "1", status: "completed" }),
    isHealthy: vi.fn().mockResolvedValue(healthy),
  };
}

const withCleanRegistry = () => {
  clearBackends();
};

feature("Backend Registry", () => {
  rule("registerBackend", () => {
    unit("registers a backend", {
      given: ["a clean registry", withCleanRegistry],
      when: ["registering a backend", () => {
        const backend = createMockBackend("modal");
        registerBackend(backend);
        return backend;
      }],
      then: ["backend is retrievable", (backend) => {
        expect(getBackend("modal")).toBe(backend);
      }],
      cleanup: clearBackends,
    });

    unit("overwrites existing backend with same name", {
      given: ["a clean registry", withCleanRegistry],
      when: ["registering two backends with same name", () => {
        const backend1 = createMockBackend("modal");
        const backend2 = createMockBackend("modal");
        registerBackend(backend1);
        registerBackend(backend2);
        return backend2;
      }],
      then: ["second backend wins", (backend2) => {
        expect(getBackend("modal")).toBe(backend2);
      }],
      cleanup: clearBackends,
    });
  });

  rule("unregisterBackend", () => {
    unit("removes a registered backend", {
      given: ["a registered backend", () => {
        clearBackends();
        registerBackend(createMockBackend("modal"));
      }],
      when: ["unregistering it", () => unregisterBackend("modal")],
      then: ["returns true and backend is gone", (result) => {
        expect(result).toBe(true);
        expect(getBackend("modal")).toBeUndefined();
      }],
      cleanup: clearBackends,
    });

    unit("returns false for non-existent backend", {
      given: ["a clean registry", withCleanRegistry],
      when: ["unregistering non-existent", () => unregisterBackend("nonexistent")],
      then: ["returns false", (result) => {
        expect(result).toBe(false);
      }],
      cleanup: clearBackends,
    });
  });

  rule("getBackend", () => {
    unit("returns undefined for non-existent backend", {
      given: ["a clean registry", withCleanRegistry],
      then: ["returns undefined", () => {
        expect(getBackend("nonexistent")).toBeUndefined();
      }],
      cleanup: clearBackends,
    });

    unit("returns registered backend", {
      given: ["a registered backend", () => {
        clearBackends();
        const backend = createMockBackend("ray");
        registerBackend(backend);
        return backend;
      }],
      then: ["backend is returned", (backend) => {
        expect(getBackend("ray")).toBe(backend);
      }],
      cleanup: clearBackends,
    });
  });

  rule("getAllBackends", () => {
    unit("returns empty array when no backends registered", {
      given: ["a clean registry", withCleanRegistry],
      then: ["empty array", () => {
        expect(getAllBackends()).toEqual([]);
      }],
      cleanup: clearBackends,
    });

    unit("returns all registered backends", {
      given: ["two registered backends", () => {
        clearBackends();
        const modal = createMockBackend("modal");
        const ray = createMockBackend("ray");
        registerBackend(modal);
        registerBackend(ray);
        return { modal, ray };
      }],
      then: ["both are returned", (ctx) => {
        const backends = getAllBackends();
        expect(backends).toHaveLength(2);
        expect(backends).toContain(ctx.modal);
        expect(backends).toContain(ctx.ray);
      }],
      cleanup: clearBackends,
    });
  });

  rule("selectBackend", () => {
    unit("selects specified backend when not auto", {
      given: ["two healthy backends", () => {
        clearBackends();
        const modal = createMockBackend("modal");
        const ray = createMockBackend("ray");
        registerBackend(modal);
        registerBackend(ray);
        return ray;
      }],
      when: ["selecting ray explicitly", (ray) => {
        const task: Task = { type: "llm.chat", backend: "ray", payload: { prompt: "Hello" } };
        return selectBackend(task);
      }],
      then: ["ray is selected", (selected, ray) => {
        expect(selected).toBe(ray);
      }],
      cleanup: clearBackends,
    });

    unit("throws for unregistered specified backend", {
      given: ["a clean registry", withCleanRegistry],
      then: ["throws not registered", async () => {
        const task: Task = { type: "llm.chat", backend: "modal", payload: { prompt: "Hello" } };
        await expect(selectBackend(task)).rejects.toThrow('Backend "modal" not registered');
      }],
      cleanup: clearBackends,
    });

    unit("throws for unhealthy specified backend", {
      given: ["an unhealthy backend", () => {
        clearBackends();
        registerBackend(createMockBackend("modal", false));
      }],
      then: ["throws not healthy", async () => {
        const task: Task = { type: "llm.chat", backend: "modal", payload: { prompt: "Hello" } };
        await expect(selectBackend(task)).rejects.toThrow('Backend "modal" is not healthy');
      }],
      cleanup: clearBackends,
    });

    unit("auto-selects first healthy backend", {
      given: ["one unhealthy and one healthy", () => {
        clearBackends();
        registerBackend(createMockBackend("modal", false));
        const healthy = createMockBackend("ray", true);
        registerBackend(healthy);
        return healthy;
      }],
      when: ["selecting with auto", (healthy) => {
        const task: Task = { type: "llm.chat", backend: "auto", payload: { prompt: "Hello" } };
        return selectBackend(task);
      }],
      then: ["healthy backend is selected", (selected, healthy) => {
        expect(selected).toBe(healthy);
      }],
      cleanup: clearBackends,
    });

    unit("auto-selects when no backend specified", {
      given: ["a registered backend", () => {
        clearBackends();
        const modal = createMockBackend("modal");
        registerBackend(modal);
        return modal;
      }],
      when: ["selecting without backend field", (modal) => {
        const task: Task = { type: "llm.chat", payload: { prompt: "Hello" } };
        return selectBackend(task);
      }],
      then: ["available backend is selected", (selected, modal) => {
        expect(selected).toBe(modal);
      }],
      cleanup: clearBackends,
    });

    unit("throws when no healthy backend available for auto", {
      given: ["only unhealthy backends", () => {
        clearBackends();
        registerBackend(createMockBackend("modal", false));
        registerBackend(createMockBackend("ray", false));
      }],
      then: ["throws no healthy", async () => {
        const task: Task = { type: "llm.chat", backend: "auto", payload: { prompt: "Hello" } };
        await expect(selectBackend(task)).rejects.toThrow("No healthy backend available");
      }],
      cleanup: clearBackends,
    });
  });

  rule("clearBackends", () => {
    unit("removes all backends", {
      given: ["two registered backends", () => {
        clearBackends();
        registerBackend(createMockBackend("modal"));
        registerBackend(createMockBackend("ray"));
      }],
      when: ["clearing", () => clearBackends()],
      then: ["no backends remain", () => {
        expect(getAllBackends()).toHaveLength(0);
      }],
    });
  });
});
