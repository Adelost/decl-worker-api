/**
 * Sequential pipeline processor (legacy mode for backward compatibility).
 * Steps execute one at a time in order.
 */

import type { Task } from "@dwa/core";
import { selectBackend } from "@dwa/core";
import type {
  ProgressCallback,
  StepStatus,
  PipelineResult,
  PipelineEventType,
  PipelineEventCallback,
} from "./dispatcher.js";
import { withTimeout, executeWithRetry } from "./execution.js";
import { resolveTemplate, resolveTemplates } from "./templates.js";

/**
 * Process pipeline sequentially (legacy mode for backward compatibility).
 */
export async function processPipelineSequential(
  task: Task,
  onProgress?: ProgressCallback,
  onEvent?: PipelineEventCallback
): Promise<PipelineResult> {
  const pipelineStart = Date.now();
  const steps = task.steps!;
  const stepResults: unknown[] = [];
  const stepStatuses: StepStatus[] = [];
  const context = {
    payload: task.payload,
    steps: stepResults,
  };

  // Helper to emit events
  const emit = (type: PipelineEventType, stepId?: string, data?: unknown) => {
    if (onEvent) {
      const step = stepId ? steps[parseInt(stepId.replace("step_", ""))] : undefined;
      onEvent({
        type,
        stepId,
        stepTask: step?.task,
        timestamp: new Date(),
        data,
      });
    }
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepId = `step_${i}`;
    const progress = Math.round((i / steps.length) * 100);
    onProgress?.(progress);

    const status: StepStatus = {
      id: stepId,
      task: step.task,
      status: "pending",
      startedAt: new Date(),
    };
    stepStatuses.push(status);

    // Check runWhen condition BEFORE marking as running
    if (step.runWhen && step.runWhen !== "always") {
      if (step.runWhen === "on-demand") {
        status.status = "skipped";
        status.completedAt = new Date();
        status.duration = 0;
        stepResults.push({ skipped: true, reason: "on-demand" });
        emit("step:complete", stepId, { skipped: true });
        continue;
      }

      const conditionResult = resolveTemplate(step.runWhen, context);
      if (!conditionResult) {
        status.status = "skipped";
        status.completedAt = new Date();
        status.duration = 0;
        stepResults.push({ skipped: true, reason: "condition-false", condition: step.runWhen });
        emit("step:complete", stepId, { skipped: true, condition: step.runWhen });
        continue;
      }
    }

    status.status = "running";
    emit("step:start", stepId);

    try {
      const resolvedInput = resolveTemplates(step.input || {}, context);

      const stepTask: Task = {
        type: step.task,
        backend: task.backend,
        payload: resolvedInput,
        resources: step.resources || task.resources,
        retry: step.retry || task.retry,
      };

      const executeBackend = async () => {
        const backend = await selectBackend(stepTask);
        return executeWithRetry(stepTask, () => backend.execute(stepTask), (attempt) => {
          status.retryAttempt = attempt;
        });
      };

      // Get timeout from step or task resources
      const timeoutSeconds = step.timeout || task.resources?.timeout;
      const result = timeoutSeconds
        ? await withTimeout(executeBackend(), timeoutSeconds * 1000, stepId)
        : await executeBackend();

      stepResults.push(result);
      context.steps = stepResults;

      status.status = "completed";
      status.completedAt = new Date();
      status.duration = status.completedAt.getTime() - status.startedAt!.getTime();
      status.result = result;
      emit("step:complete", stepId, result);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (step.optional) {
        stepResults.push({ error: errorMsg, skipped: true });
        status.status = "skipped";
        status.completedAt = new Date();
        status.duration = status.completedAt.getTime() - status.startedAt!.getTime();
        status.error = errorMsg;
        emit("step:error", stepId, { error: errorMsg, optional: true });
        continue;
      }

      status.status = "failed";
      status.completedAt = new Date();
      status.duration = status.completedAt.getTime() - status.startedAt!.getTime();
      status.error = errorMsg;
      emit("step:error", stepId, { error: errorMsg });
      throw error;
    }
  }

  const totalDuration = Date.now() - pipelineStart;
  emit("pipeline:complete", undefined, { totalDuration, stepCount: steps.length });

  // Build stepResults record for compatibility
  const stepResultsRecord: Record<string, unknown> = {};
  stepResults.forEach((result, i) => {
    stepResultsRecord[`step_${i}`] = result;
  });

  return {
    steps: stepResults,
    stepResults: stepResultsRecord,
    stepStatus: stepStatuses,
    finalResult: stepResults[stepResults.length - 1],
    totalDuration,
    parallelGroups: [], // Sequential has no parallel groups
  };
}
