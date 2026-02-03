/**
 * Template resolution for pipeline step inputs.
 * Resolves "{{payload.url}}" and "{{steps.download.path}}" style templates
 * against a context object using dot-notation path traversal.
 */

/**
 * Get a nested value from an object using dot notation.
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Resolve a single template string like "{{steps.scenes.keyframes}}".
 */
export function resolveTemplate(
  template: string,
  context: Record<string, unknown>
): unknown {
  if (template.startsWith("{{") && template.endsWith("}}")) {
    const path = template.slice(2, -2).trim();
    return getNestedValue(context, path);
  }
  return template;
}

/**
 * Resolve template strings like "{{payload.url}}" or "{{steps.download.path}}".
 */
export function resolveTemplates(
  input: Record<string, string>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value === "string" &&
      value.startsWith("{{") &&
      value.endsWith("}}")
    ) {
      const path = value.slice(2, -2).trim();
      resolved[key] = getNestedValue(context, path);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}
