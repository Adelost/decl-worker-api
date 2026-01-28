/**
 * Worker definition types for DWA.
 *
 * Workers are defined declaratively with Pydantic-style schemas.
 * The schema describes what data the worker accepts and produces.
 */

/**
 * JSON Schema type for describing input/output structure.
 * Compatible with Pydantic's schema generation.
 */
export interface JSONSchema {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * GPU types available for workers.
 */
export type GPUType = "T4" | "A10G" | "A100" | null;

/**
 * Retry configuration for failed workers.
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  attempts: number;
  /** Backoff strategy */
  backoff: "fixed" | "exponential";
  /** Initial delay in milliseconds */
  delay?: number;
  /** Maximum delay for exponential backoff */
  maxDelay?: number;
}

/**
 * Worker schema - the declarative definition of a worker.
 *
 * This is the core type that users define to create workers.
 * Input/output schemas are JSON Schema (generated from Pydantic models).
 */
export interface WorkerSchema {
  /** Unique worker name */
  name: string;

  /** Human-readable description */
  description?: string;

  /** Worker version */
  version?: string;

  /** Input schema (JSON Schema from Pydantic) */
  input: JSONSchema;

  /** Output schema (JSON Schema from Pydantic) */
  output: JSONSchema;

  /** GPU requirement */
  gpu?: GPUType;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Retry configuration */
  retry?: RetryConfig;

  /** Memory requirement (e.g., "512Mi", "2Gi") */
  memory?: string;
}

/**
 * Worker definition - schema plus handler reference.
 *
 * The handler is a string reference to the implementation,
 * allowing language-agnostic worker definitions.
 */
export interface WorkerDef {
  schema: WorkerSchema;

  /**
   * Handler reference.
   * Format: "python://module.function" or "node://module.function"
   */
  handler: string;
}

/**
 * Result of worker execution.
 */
export interface WorkerResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Output data (validated against output schema) */
  data?: unknown;

  /** Error message if failed */
  error?: string;

  /** Execution duration in milliseconds */
  duration?: number;
}

/**
 * Worker execution context.
 */
export interface WorkerContext {
  /** Unique job ID */
  jobId: string;

  /** Worker name */
  worker: string;

  /** Input data */
  input: unknown;

  /** Progress callback */
  onProgress?: (progress: number) => void;
}
