/**
 * Execution utilities for task dispatch.
 * Handles sleep/backoff, timeouts, and retry logic.
 */

import type { Task } from "@dwa/core";

/**
 * Sleep helper for retry backoff.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute with timeout. Rejects if execution exceeds timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`"${label}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

/**
 * Execute a task with retry logic.
 */
export async function executeWithRetry(
  task: Task,
  executor: () => Promise<unknown>,
  onRetry?: (attempt: number, maxAttempts: number) => void
): Promise<unknown> {
  const retry = task.retry;
  if (!retry || !retry.attempts || retry.attempts <= 1) {
    return executor();
  }

  let lastError: Error | undefined;
  const delay = retry.delay || 1000;

  for (let attempt = 1; attempt <= retry.attempts; attempt++) {
    // Report retry attempt
    onRetry?.(attempt, retry.attempts);

    try {
      return await executor();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retry.attempts) {
        const backoffDelay =
          retry.backoff === "exponential"
            ? delay * Math.pow(2, attempt - 1)
            : delay;
        await sleep(backoffDelay);
      }
    }
  }

  throw lastError;
}
