/**
 * Tests for DWA dashboard client.
 */

import { vi } from "vitest";
import { feature, rule, component, expect } from "bdd-vitest";
import { createDWAClient } from "../src/lib/client.js";

let mockFetch: ReturnType<typeof vi.fn>;

const withMockFetch = () => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
};

const cleanupFetch = () => {
  vi.unstubAllGlobals();
};

feature("DWA Client", () => {
  rule("createDWAClient", () => {
    component("creates a client with default config", {
      given: ["mock fetch", withMockFetch],
      when: ["creating client", () => createDWAClient({ baseUrl: "http://localhost:3000" })],
      then: ["has default state", (client) => {
        expect(client.status).toBe("disconnected");
        expect(client.jobs.data).toBeNull();
        expect(client.currentJob).toBeNull();
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("fetchJobs", () => {
    component("fetches jobs from API", {
      given: ["mock fetch returning jobs", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: "task-1", status: "running", type: "video.process" },
            { id: "task-2", status: "completed", type: "audio.transcribe" },
          ],
        });
      }],
      when: ["fetching jobs", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        await client.fetchJobs();
        return client;
      }],
      then: ["jobs are populated", (client) => {
        expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/tasks");
        expect(client.jobs.data).toHaveLength(2);
        expect(client.jobs.data![0].taskId).toBe("task-1");
        expect(client.jobs.data![0].status).toBe("running");
        expect(client.status).toBe("connected");
      }],
      cleanup: cleanupFetch,
    });

    component("handles fetch error", {
      given: ["mock fetch that rejects", () => {
        withMockFetch();
        mockFetch.mockRejectedValueOnce(new Error("Network error"));
      }],
      when: ["fetching jobs", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        await client.fetchJobs();
        return client;
      }],
      then: ["error state is set", (client) => {
        expect(client.jobs.error).toBeInstanceOf(Error);
        expect(client.jobs.error!.message).toBe("Network error");
        expect(client.status).toBe("error");
      }],
      cleanup: cleanupFetch,
    });

    component("handles HTTP error", {
      given: ["mock fetch returning 500", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });
      }],
      when: ["fetching jobs", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        await client.fetchJobs();
        return client;
      }],
      then: ["error state with status code", (client) => {
        expect(client.jobs.error).toBeInstanceOf(Error);
        expect(client.jobs.error!.message).toContain("500");
        expect(client.status).toBe("error");
      }],
      cleanup: cleanupFetch,
    });

    component("passes query parameters", {
      given: ["mock fetch returning empty", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      }],
      when: ["fetching with filters", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        await client.fetchJobs({ queue: "gpu", status: "running", limit: 10 });
      }],
      then: ["URL includes query params", () => {
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/tasks?queue=gpu&status=running&limit=10",
        );
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("fetchJobDetail", () => {
    component("fetches single job detail", {
      given: ["mock fetch returning detail", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "task-123",
            status: "running",
            type: "pipeline",
            steps: [{ id: "s1", task: "download" }],
            stepStatus: [{ id: "s1", task: "download", status: "completed" }],
          }),
        });
      }],
      when: ["fetching job detail", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        await client.fetchJobDetail("task-123");
        return client;
      }],
      then: ["detail is populated", (client) => {
        expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/tasks/task-123");
        expect(client.currentJob).not.toBeNull();
        expect(client.currentJob!.taskId).toBe("task-123");
        expect(client.currentJob!.steps).toHaveLength(1);
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("cancelTask", () => {
    component("sends DELETE request to cancel task", {
      given: ["mock fetch for cancel + refresh", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({ ok: true });
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      }],
      when: ["cancelling task", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        return client.cancelTask("task-123");
      }],
      then: ["returns true and sends DELETE", (result) => {
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/tasks/task-123",
          { method: "DELETE" },
        );
      }],
      cleanup: cleanupFetch,
    });

    component("returns false on cancel error", {
      given: ["mock fetch that rejects", () => {
        withMockFetch();
        mockFetch.mockRejectedValueOnce(new Error("Cancel failed"));
      }],
      when: ["cancelling task", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        return client.cancelTask("task-123");
      }],
      then: ["returns false", (result) => {
        expect(result).toBe(false);
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("retryTask", () => {
    component("sends POST request to retry task", {
      given: ["mock fetch for retry + refresh", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ taskId: "task-456" }),
        });
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
      }],
      when: ["retrying task", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        return client.retryTask("task-123");
      }],
      then: ["returns new task ID", (newTaskId) => {
        expect(newTaskId).toBe("task-456");
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/tasks/task-123/retry",
          { method: "POST" },
        );
      }],
      cleanup: cleanupFetch,
    });

    component("returns null on retry error", {
      given: ["mock fetch that rejects", () => {
        withMockFetch();
        mockFetch.mockRejectedValueOnce(new Error("Retry failed"));
      }],
      when: ["retrying task", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        return client.retryTask("task-123");
      }],
      then: ["returns null", (result) => {
        expect(result).toBeNull();
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("selectStep", () => {
    component("updates selected step ID", {
      given: ["mock fetch", withMockFetch],
      when: ["selecting and deselecting steps", () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        const initial = client.selectedStepId;
        client.selectStep("step-1");
        const selected = client.selectedStepId;
        client.selectStep(null);
        const cleared = client.selectedStepId;
        return { initial, selected, cleared };
      }],
      then: ["step selection works", (result) => {
        expect(result.initial).toBeNull();
        expect(result.selected).toBe("step-1");
        expect(result.cleared).toBeNull();
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("subscribe", () => {
    component("notifies listener on state changes", {
      given: ["mock fetch returning a job", () => {
        withMockFetch();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: "task-1", status: "running" }],
        });
      }],
      when: ["subscribing and fetching", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        const listener = vi.fn();
        const unsubscribe = client.subscribe(listener);
        await client.fetchJobs();
        unsubscribe();
        return listener;
      }],
      then: ["listener was called", (listener) => {
        expect(listener).toHaveBeenCalled();
      }],
      cleanup: cleanupFetch,
    });

    component("allows unsubscribe", {
      given: ["mock fetch returning empty", () => {
        withMockFetch();
        mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      }],
      when: ["unsubscribing then fetching", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000" });
        const listener = vi.fn();
        const unsubscribe = client.subscribe(listener);
        unsubscribe();
        await client.fetchJobs();
        const callCount = listener.mock.calls.length;
        await client.fetchJobs();
        return { callCount, finalCount: listener.mock.calls.length };
      }],
      then: ["no additional calls after unsubscribe", (result) => {
        expect(result.finalCount).toBe(result.callCount);
      }],
      cleanup: cleanupFetch,
    });
  });

  rule("polling", () => {
    component("starts polling with interval", {
      given: ["fake timers and mock fetch", () => {
        vi.useFakeTimers();
        withMockFetch();
        mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      }],
      when: ["starting polling and advancing time", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000", pollInterval: 1000 });
        client.startPolling();
        const afterStart = mockFetch.mock.calls.length;
        await vi.advanceTimersByTimeAsync(1000);
        const afterFirst = mockFetch.mock.calls.length;
        await vi.advanceTimersByTimeAsync(1000);
        const afterSecond = mockFetch.mock.calls.length;
        client.stopPolling();
        return { afterStart, afterFirst, afterSecond };
      }],
      then: ["fetch called on each interval", (result) => {
        expect(result.afterStart).toBe(1);
        expect(result.afterFirst).toBe(2);
        expect(result.afterSecond).toBe(3);
      }],
      cleanup: () => {
        vi.useRealTimers();
        cleanupFetch();
      },
    });

    component("stops polling when stopPolling is called", {
      given: ["fake timers and mock fetch", () => {
        vi.useFakeTimers();
        withMockFetch();
        mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      }],
      when: ["starting and stopping polling", async () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000", pollInterval: 1000 });
        client.startPolling();
        const afterStart = mockFetch.mock.calls.length;
        client.stopPolling();
        await vi.advanceTimersByTimeAsync(5000);
        return { afterStart, afterAdvance: mockFetch.mock.calls.length };
      }],
      then: ["no additional calls after stop", (result) => {
        expect(result.afterStart).toBe(1);
        expect(result.afterAdvance).toBe(1);
      }],
      cleanup: () => {
        vi.useRealTimers();
        cleanupFetch();
      },
    });

    component("does not start polling twice", {
      given: ["fake timers and mock fetch", () => {
        vi.useFakeTimers();
        withMockFetch();
        mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
      }],
      when: ["calling startPolling twice", () => {
        const client = createDWAClient({ baseUrl: "http://localhost:3000", pollInterval: 1000 });
        client.startPolling();
        client.startPolling();
        const callCount = mockFetch.mock.calls.length;
        client.stopPolling();
        return callCount;
      }],
      then: ["only one initial fetch", (callCount) => {
        expect(callCount).toBe(1);
      }],
      cleanup: () => {
        vi.useRealTimers();
        cleanupFetch();
      },
    });
  });
});
