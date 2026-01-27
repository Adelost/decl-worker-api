/**
 * Side effect types for task lifecycle events.
 */

import type { Task } from "./task.js";

export type Effect =
  | ToastEffect
  | WebhookEffect
  | NotifyEffect
  | EnqueueEffect
  | InvalidateEffect
  | EmitEffect;

export interface ToastEffect {
  $event: "toast";
  text: string;
  variant?: "success" | "error" | "warning" | "info";
}

export interface WebhookEffect {
  $event: "webhook";
  url: string;
  method?: "POST" | "PUT" | "PATCH";
  headers?: Record<string, string>;
}

export interface NotifyEffect {
  $event: "notify";
  channel: "slack" | "email" | "discord";
  message: string;
  target?: string;
}

export interface EnqueueEffect {
  $event: "enqueue";
  task: Task;
}

export interface InvalidateEffect {
  $event: "invalidate";
  path?: string;
  tags?: string[];
}

export interface EmitEffect {
  $event: "emit";
  event: string;
  data?: unknown;
}
