/**
 * Resource requirements and pool types for task execution.
 */

export interface ResourceRequirements {
  /** GPU requirement - true for any GPU, or specific model like "T4", "A100" */
  gpu?: boolean | string;
  /** VRAM requirement in MB */
  vram?: number;
  /** RAM requirement in MB */
  ram?: number;
  /** CPU cores requirement */
  cpu?: number;
  /** Timeout in seconds */
  timeout?: number;
}

export interface GpuInfo {
  name: string;
  vram: number;
  available: boolean;
}

export interface ResourcePool {
  gpus: GpuInfo[];
  ram: { total: number; available: number };
  vram: { total: number; available: number };
}
