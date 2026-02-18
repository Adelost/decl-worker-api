/**
 * Tests for dashboard data transforms.
 */

import { feature, rule, unit, expect } from "bdd-vitest";
import {
  stepsToDAGNodes,
  apiTaskToJobItem,
  apiTaskToJobDetail,
  countByStatus,
  type StepStatus,
  type ApiTask,
  type ApiTaskDetail,
  type JobListItem,
} from "../src/lib/transforms.js";

feature("Dashboard Transforms", () => {
  rule("stepsToDAGNodes", () => {
    unit("converts steps to DAG nodes with pending status by default", {
      given: ["steps without status", () => ({
        steps: [
          { id: "download", task: "process.download" },
          { id: "process", task: "ai.analyze", dependsOn: ["download"] },
        ],
        stepStatus: [] as StepStatus[],
      })],
      when: ["converting to nodes", (ctx) => stepsToDAGNodes(ctx.steps, ctx.stepStatus)],
      then: ["nodes have pending status", (nodes) => {
        expect(nodes).toHaveLength(2);
        expect(nodes[0]).toEqual({
          id: "download",
          label: "process.download",
          status: "pending",
          progress: undefined,
          duration: undefined,
          dependsOn: undefined,
          error: undefined,
          retryAttempt: undefined,
          retryMax: undefined,
          optional: undefined,
        });
        expect(nodes[1].dependsOn).toEqual(["download"]);
      }],
    });

    unit("applies step status to nodes", {
      given: ["steps with status", () => ({
        steps: [
          { id: "step1", task: "task1" },
          { id: "step2", task: "task2" },
        ],
        stepStatus: [
          { id: "step1", task: "task1", status: "completed", duration: 1500 },
          { id: "step2", task: "task2", status: "running", startedAt: new Date() },
        ] as StepStatus[],
      })],
      when: ["converting to nodes", (ctx) => stepsToDAGNodes(ctx.steps, ctx.stepStatus)],
      then: ["nodes reflect status", (nodes) => {
        expect(nodes[0].status).toBe("completed");
        expect(nodes[0].duration).toBe(1500);
        expect(nodes[1].status).toBe("running");
        expect(nodes[1].progress).toBeDefined();
      }],
    });

    unit("includes retry info from step config", {
      given: ["step with retry config", () => ({
        steps: [{ id: "retry-step", task: "flaky.task", retry: { attempts: 3 } }],
        stepStatus: [{ id: "retry-step", task: "flaky.task", status: "running", retryAttempt: 2 }] as StepStatus[],
      })],
      when: ["converting to nodes", (ctx) => stepsToDAGNodes(ctx.steps, ctx.stepStatus)],
      then: ["node has retry info", (nodes) => {
        expect(nodes[0].retryAttempt).toBe(2);
        expect(nodes[0].retryMax).toBe(3);
      }],
    });

    unit("includes error info for failed steps", {
      given: ["a failed step", () => ({
        steps: [{ id: "fail", task: "might.fail" }],
        stepStatus: [{ id: "fail", task: "might.fail", status: "failed", error: "Connection timeout" }] as StepStatus[],
      })],
      when: ["converting to nodes", (ctx) => stepsToDAGNodes(ctx.steps, ctx.stepStatus)],
      then: ["node has error", (nodes) => {
        expect(nodes[0].status).toBe("failed");
        expect(nodes[0].error).toBe("Connection timeout");
      }],
    });

    unit("marks optional steps", {
      given: ["an optional step", () => ({
        steps: [{ id: "opt", task: "optional.task", optional: true }],
        stepStatus: [] as StepStatus[],
      })],
      when: ["converting to nodes", (ctx) => stepsToDAGNodes(ctx.steps, ctx.stepStatus)],
      then: ["node is optional", (nodes) => {
        expect(nodes[0].optional).toBe(true);
      }],
    });

    unit("generates IDs for steps without explicit IDs", {
      given: ["steps without IDs", () => ({
        steps: [{ task: "task1" }, { task: "task2" }],
        stepStatus: [] as StepStatus[],
      })],
      when: ["converting to nodes", (ctx) => stepsToDAGNodes(ctx.steps, ctx.stepStatus)],
      then: ["auto-generates step_N IDs", (nodes) => {
        expect(nodes[0].id).toBe("step_0");
        expect(nodes[1].id).toBe("step_1");
      }],
    });
  });

  rule("apiTaskToJobItem", () => {
    unit("converts API task to job list item", {
      given: ["a running API task", () => ({
        id: "task-123",
        status: "running",
        type: "video.process",
        queue: "gpu",
        progress: 45,
        createdAt: "2024-01-15T10:00:00Z",
        startedAt: "2024-01-15T10:00:05Z",
      }) as ApiTask],
      when: ["converting to job item", (apiTask) => apiTaskToJobItem(apiTask)],
      then: ["maps all fields", (item) => {
        expect(item.taskId).toBe("task-123");
        expect(item.type).toBe("video.process");
        expect(item.status).toBe("running");
        expect(item.queue).toBe("gpu");
        expect(item.progress).toBe(45);
        expect(item.createdAt).toBeInstanceOf(Date);
        expect(item.startedAt).toBeInstanceOf(Date);
      }],
    });

    unit.outline("maps status correctly", [
      { name: "pending → queued", inputStatus: "pending", expectedStatus: "queued" },
      { name: "completed → completed", inputStatus: "completed", expectedStatus: "completed" },
      { name: "failed → failed", inputStatus: "failed", expectedStatus: "failed" },
      { name: "cancelled → failed", inputStatus: "cancelled", expectedStatus: "failed" },
    ], {
      given: (row) => ({ id: "1", status: row.inputStatus }) as ApiTask,
      when: (apiTask) => apiTaskToJobItem(apiTask),
      then: (item, _, row) => {
        expect(item.status).toBe(row.expectedStatus);
      },
    });

    unit("defaults type to unknown", {
      given: ["task without type", () => ({ id: "1", status: "running" }) as ApiTask],
      when: ["converting to job item", (apiTask) => apiTaskToJobItem(apiTask)],
      then: ["type is unknown", (item) => {
        expect(item.type).toBe("unknown");
      }],
    });
  });

  rule("apiTaskToJobDetail", () => {
    unit("converts API task detail to job detail", {
      given: ["a completed task detail", () => ({
        id: "task-456",
        status: "completed",
        type: "pipeline",
        result: { output: "success" },
        totalDuration: 5000,
        steps: [{ id: "s1", task: "t1" }],
        stepStatus: [{ id: "s1", task: "t1", status: "completed" }],
      }) as ApiTaskDetail],
      when: ["converting to job detail", (apiTask) => apiTaskToJobDetail(apiTask)],
      then: ["maps all fields", (detail) => {
        expect(detail.taskId).toBe("task-456");
        expect(detail.status).toBe("completed");
        expect(detail.result).toEqual({ output: "success" });
        expect(detail.totalDuration).toBe(5000);
        expect(detail.steps).toHaveLength(1);
        expect(detail.stepStatus).toHaveLength(1);
      }],
    });

    unit("includes error for failed tasks", {
      given: ["a failed task detail", () => ({
        id: "1",
        status: "failed",
        error: "Task execution failed",
      }) as ApiTaskDetail],
      when: ["converting to job detail", (apiTask) => apiTaskToJobDetail(apiTask)],
      then: ["has error message", (detail) => {
        expect(detail.status).toBe("failed");
        expect(detail.error).toBe("Task execution failed");
      }],
    });
  });

  rule("countByStatus", () => {
    const jobs: JobListItem[] = [
      { taskId: "1", type: "t", status: "running" },
      { taskId: "2", type: "t", status: "running" },
      { taskId: "3", type: "t", status: "queued" },
      { taskId: "4", type: "t", status: "completed" },
      { taskId: "5", type: "t", status: "completed" },
      { taskId: "6", type: "t", status: "completed" },
      { taskId: "7", type: "t", status: "failed" },
    ];

    unit.outline("counts by status", [
      { name: "running → 2", status: "running" as const, expected: 2, jobs },
      { name: "queued → 1", status: "queued" as const, expected: 1, jobs },
      { name: "completed → 3", status: "completed" as const, expected: 3, jobs },
      { name: "failed → 1", status: "failed" as const, expected: 1, jobs },
      { name: "empty list → 0", status: "running" as const, expected: 0, jobs: [] as JobListItem[] },
    ], {
      given: (row) => row.jobs,
      when: (jobList, row) => countByStatus(jobList, row.status),
      then: (count, _, row) => {
        expect(count).toBe(row.expected);
      },
    });
  });
});
