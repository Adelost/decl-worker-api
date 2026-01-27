#!/usr/bin/env python3
"""
Generate TypeScript types from Python task decorators.

Usage:
    python scripts/gen_types.py
    pnpm gen:types
"""

import sys
import inspect
import re
from pathlib import Path
from typing import get_type_hints, Optional, Union, Generator
from datetime import datetime

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))

from tasks.decorator import list_tasks, CATEGORIES, clear_registry
from tasks.discovery import discover_tasks, reset_discovery


def python_type_to_typescript(py_type) -> str:
    """Convert Python type annotation to TypeScript type."""
    if py_type is None or py_type is type(None):
        return "null"

    # Handle string annotations
    if isinstance(py_type, str):
        py_type_str = py_type
    else:
        py_type_str = str(py_type)

    # Basic type mappings
    type_map = {
        "str": "string",
        "int": "number",
        "float": "number",
        "bool": "boolean",
        "None": "null",
        "NoneType": "null",
        "dict": "Record<string, unknown>",
        "list": "unknown[]",
        "Any": "unknown",
    }

    # Check for Optional
    if "Optional[" in py_type_str:
        inner = re.search(r"Optional\[(.+)\]", py_type_str)
        if inner:
            return f"{python_type_to_typescript(inner.group(1))} | null"

    # Check for Union
    if "Union[" in py_type_str:
        inner = re.search(r"Union\[(.+)\]", py_type_str)
        if inner:
            types = [t.strip() for t in inner.group(1).split(",")]
            return " | ".join(python_type_to_typescript(t) for t in types)

    # Check for list[X]
    if "list[" in py_type_str:
        inner = re.search(r"list\[(.+)\]", py_type_str)
        if inner:
            return f"{python_type_to_typescript(inner.group(1))}[]"

    # Check for dict[X, Y]
    if "dict[" in py_type_str:
        inner = re.search(r"dict\[(.+),\s*(.+)\]", py_type_str)
        if inner:
            key_type = python_type_to_typescript(inner.group(1))
            val_type = python_type_to_typescript(inner.group(2))
            return f"Record<{key_type}, {val_type}>"

    # Check for Generator
    if "Generator" in py_type_str:
        return "AsyncGenerator<unknown>"

    # Direct mapping
    for py, ts in type_map.items():
        if py in py_type_str:
            return ts

    return "unknown"


def get_function_params(func) -> list[dict]:
    """Extract parameter info from function signature."""
    params = []
    sig = inspect.signature(func)

    try:
        hints = get_type_hints(func)
    except Exception:
        hints = {}

    for name, param in sig.parameters.items():
        if name in ("self", "cls"):
            continue

        param_info = {
            "name": name,
            "required": param.default is inspect.Parameter.empty,
            "default": None if param.default is inspect.Parameter.empty else param.default,
        }

        # Get type
        if name in hints:
            param_info["type"] = python_type_to_typescript(hints[name])
        elif param.annotation is not inspect.Parameter.empty:
            param_info["type"] = python_type_to_typescript(param.annotation)
        else:
            param_info["type"] = "unknown"

        params.append(param_info)

    return params


def generate_typescript() -> str:
    """Generate TypeScript types from registered tasks."""
    tasks = list_tasks()

    # Sort tasks by name
    tasks = sorted(tasks, key=lambda t: t.name)

    lines = [
        "/**",
        " * Auto-generated TypeScript types from Python task decorators.",
        f" * Generated: {datetime.now().isoformat()}",
        " * DO NOT EDIT MANUALLY - run `pnpm gen:types` to regenerate.",
        " */",
        "",
        "// =============================================================================",
        "// Task Names",
        "// =============================================================================",
        "",
    ]

    # TaskName union type
    task_names = [f'  | "{t.name}"' for t in tasks]
    lines.append("export type TaskName =")
    lines.extend(task_names)
    lines.append(";")
    lines.append("")

    # =============================================================================
    # Category namespace
    # =============================================================================
    lines.extend([
        "// =============================================================================",
        "// Categories",
        "// =============================================================================",
        "",
        "export namespace Category {",
    ])

    for category in CATEGORIES:
        cat_tasks = [t for t in tasks if t.category == category]
        if cat_tasks:
            type_name = category.capitalize()
            task_union = " | ".join(f'"{t.name}"' for t in cat_tasks)
            lines.append(f"  export type {type_name} = {task_union};")

    lines.append("}")
    lines.append("")

    # =============================================================================
    # Capabilities namespace
    # =============================================================================
    lines.extend([
        "// =============================================================================",
        "// Capabilities",
        "// =============================================================================",
        "",
        "export namespace Capability {",
    ])

    # Collect all capabilities
    cap_to_tasks: dict[str, list[str]] = {}
    for t in tasks:
        for cap in t.capabilities:
            if cap not in cap_to_tasks:
                cap_to_tasks[cap] = []
            cap_to_tasks[cap].append(t.name)

    for cap in sorted(cap_to_tasks.keys()):
        type_name = cap.replace("-", "").replace("_", "").capitalize()
        task_union = " | ".join(f'"{n}"' for n in cap_to_tasks[cap])
        lines.append(f"  export type {type_name} = {task_union};")

    lines.append("}")
    lines.append("")

    # =============================================================================
    # Task Payloads
    # =============================================================================
    lines.extend([
        "// =============================================================================",
        "// Task Payloads (input parameters)",
        "// =============================================================================",
        "",
        "export interface TaskPayloads {",
    ])

    for t in tasks:
        try:
            params = get_function_params(t.func)
        except Exception:
            params = []

        if params:
            lines.append(f'  "{t.name}": {{')
            for p in params:
                optional = "?" if not p["required"] else ""
                lines.append(f'    {p["name"]}{optional}: {p["type"]};')
            lines.append("  };")
        else:
            lines.append(f'  "{t.name}": Record<string, unknown>;')

    lines.append("}")
    lines.append("")

    # =============================================================================
    # Task Metadata
    # =============================================================================
    lines.extend([
        "// =============================================================================",
        "// Task Metadata",
        "// =============================================================================",
        "",
        "export interface TaskMetadata {",
        "  name: string;",
        "  category: string;",
        "  capabilities: string[];",
        "  gpu: string | null;",
        "  timeout: number;",
        "  streaming: boolean;",
        "  description: string;",
        "}",
        "",
        "export const TASK_METADATA: Record<TaskName, TaskMetadata> = {",
    ])

    for t in tasks:
        gpu_str = f'"{t.gpu}"' if t.gpu else "null"
        caps_str = ", ".join(f'"{c}"' for c in t.capabilities)
        desc = t.description.replace('"', '\\"')

        lines.extend([
            f'  "{t.name}": {{',
            f'    name: "{t.name}",',
            f'    category: "{t.category}",',
            f'    capabilities: [{caps_str}],',
            f'    gpu: {gpu_str},',
            f'    timeout: {t.timeout},',
            f'    streaming: {"true" if t.streaming else "false"},',
            f'    description: "{desc}",',
            '  },',
        ])

    lines.append("};")
    lines.append("")

    # =============================================================================
    # Utility types
    # =============================================================================
    lines.extend([
        "// =============================================================================",
        "// Utility Types",
        "// =============================================================================",
        "",
        "/** Get payload type for a specific task */",
        "export type PayloadFor<T extends TaskName> = TaskPayloads[T];",
        "",
        "/** Tasks requiring GPU */",
    ])

    gpu_tasks = [t.name for t in tasks if t.gpu]
    if gpu_tasks:
        lines.append(f"export type GpuTask = {' | '.join(f'\"{n}\"' for n in gpu_tasks)};")
    else:
        lines.append("export type GpuTask = never;")
    lines.append("")

    # Streaming tasks
    streaming_tasks = [t.name for t in tasks if t.streaming]
    if streaming_tasks:
        lines.append(f"export type StreamingTask = {' | '.join(f'\"{n}\"' for n in streaming_tasks)};")
    else:
        lines.append("export type StreamingTask = never;")
    lines.append("")

    return "\n".join(lines)


def main():
    """Main entry point."""
    # Discover all tasks
    clear_registry()
    reset_discovery()
    count = discover_tasks()

    print(f"Discovered {count} tasks")

    # Generate TypeScript
    ts_content = generate_typescript()

    # Write to file
    output_path = Path(__file__).parent.parent / "packages/core/src/types/generated.ts"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content)

    print(f"Generated: {output_path}")
    print(f"Total tasks: {len(list_tasks())}")


if __name__ == "__main__":
    main()
