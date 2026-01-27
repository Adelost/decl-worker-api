/**
 * Backend registry for managing and selecting execution backends.
 */

import type { Backend, Task } from "./types/index.js";

const backends = new Map<string, Backend>();

/**
 * Register a backend implementation.
 */
export function registerBackend(backend: Backend): void {
  backends.set(backend.name, backend);
}

/**
 * Unregister a backend by name.
 */
export function unregisterBackend(name: string): boolean {
  return backends.delete(name);
}

/**
 * Get a backend by name.
 */
export function getBackend(name: string): Backend | undefined {
  return backends.get(name);
}

/**
 * Get all registered backends.
 */
export function getAllBackends(): Backend[] {
  return Array.from(backends.values());
}

/**
 * Select the best backend for a task.
 * If task.backend is specified (and not "auto"), uses that backend.
 * Otherwise, selects based on health and resource availability.
 */
export async function selectBackend(task: Task): Promise<Backend> {
  // Use specified backend if not "auto"
  if (task.backend && task.backend !== "auto") {
    const backend = backends.get(task.backend);
    if (!backend) {
      throw new Error(`Backend "${task.backend}" not registered`);
    }
    if (!(await backend.isHealthy())) {
      throw new Error(`Backend "${task.backend}" is not healthy`);
    }
    return backend;
  }

  // Auto-select: prioritize based on task requirements
  const healthyBackends: Backend[] = [];

  for (const backend of backends.values()) {
    try {
      if (await backend.isHealthy()) {
        healthyBackends.push(backend);
      }
    } catch {
      // Skip unhealthy backends
    }
  }

  if (healthyBackends.length === 0) {
    throw new Error("No healthy backend available");
  }

  // If task requires GPU, prefer backends with GPU resources
  if (task.resources?.gpu) {
    for (const backend of healthyBackends) {
      if (backend.getResources) {
        const resources = await backend.getResources();
        const availableGpu = resources.gpus.some((g) => g.available);
        if (availableGpu) {
          return backend;
        }
      }
    }
  }

  // Return first healthy backend
  return healthyBackends[0];
}

/**
 * Clear all registered backends.
 */
export function clearBackends(): void {
  backends.clear();
}
