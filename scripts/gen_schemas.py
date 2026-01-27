#!/usr/bin/env python3
"""
Generate TypeScript types from Pydantic schemas.

Usage:
    python scripts/gen_schemas.py
    pnpm gen:schemas

This is the SINGLE SOURCE OF TRUTH for types.
Python uses Pydantic directly, TypeScript gets generated types.
"""

import sys
from pathlib import Path
from datetime import datetime
from typing import get_type_hints, get_origin, get_args, Union, Literal
import inspect

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))

from pydantic import BaseModel


def python_type_to_ts(py_type, indent: int = 0) -> str:
    """Convert Python type to TypeScript type."""
    if py_type is None or py_type is type(None):
        return "null"

    origin = get_origin(py_type)
    args = get_args(py_type)

    # Handle Optional[X] -> X | null
    if origin is Union:
        # Check for Optional (Union with None)
        non_none = [a for a in args if a is not type(None)]
        if len(non_none) == 1 and len(args) == 2:
            return f"{python_type_to_ts(non_none[0])} | null"
        return " | ".join(python_type_to_ts(a) for a in args)

    # Handle Literal["a", "b"] -> "a" | "b"
    if origin is Literal:
        return " | ".join(f'"{a}"' if isinstance(a, str) else str(a) for a in args)

    # Handle list[X] -> X[]
    if origin is list:
        inner = args[0] if args else "unknown"
        return f"{python_type_to_ts(inner)}[]"

    # Handle dict[K, V] -> Record<K, V>
    if origin is dict:
        key = python_type_to_ts(args[0]) if args else "string"
        val = python_type_to_ts(args[1]) if len(args) > 1 else "unknown"
        return f"Record<{key}, {val}>"

    # Basic types
    type_map = {
        str: "string",
        int: "number",
        float: "number",
        bool: "boolean",
        datetime: "string",  # ISO format
        bytes: "string",  # base64
    }

    if py_type in type_map:
        return type_map[py_type]

    # Handle string type names
    if isinstance(py_type, str):
        return {
            "str": "string",
            "int": "number",
            "float": "number",
            "bool": "boolean",
        }.get(py_type, "unknown")

    # Check if it's a Pydantic model
    if inspect.isclass(py_type) and issubclass(py_type, BaseModel):
        return py_type.__name__

    return "unknown"


def pydantic_to_typescript(model: type[BaseModel]) -> str:
    """Convert a Pydantic model to TypeScript interface."""
    lines = []
    lines.append(f"export interface {model.__name__} {{")

    # Get field info
    for name, field in model.model_fields.items():
        ts_type = python_type_to_ts(field.annotation)
        optional = "?" if not field.is_required() else ""

        # Add description as comment
        desc = field.description
        if desc:
            lines.append(f"  /** {desc} */")

        lines.append(f"  {name}{optional}: {ts_type};")

    lines.append("}")
    return "\n".join(lines)


def generate_typescript() -> str:
    """Generate all TypeScript types from schemas."""
    # Import all schemas
    from schemas import chat, media, common

    lines = [
        "/**",
        " * Auto-generated TypeScript types from Pydantic schemas.",
        f" * Generated: {datetime.now().isoformat()}",
        " * DO NOT EDIT MANUALLY - run `pnpm gen:schemas` to regenerate.",
        " */",
        "",
        "// =============================================================================",
        "// Chat Types",
        "// =============================================================================",
        "",
    ]

    # Chat types
    lines.append(pydantic_to_typescript(chat.Message))
    lines.append("")
    lines.append(pydantic_to_typescript(chat.ChatPayload))
    lines.append("")
    lines.append(pydantic_to_typescript(chat.ChatResponse))
    lines.append("")

    lines.extend([
        "// =============================================================================",
        "// Media References",
        "// =============================================================================",
        "",
    ])

    # Media types
    lines.append(pydantic_to_typescript(media.ImageRef))
    lines.append("")
    lines.append(pydantic_to_typescript(media.VideoRef))
    lines.append("")
    lines.append(pydantic_to_typescript(media.AudioRef))
    lines.append("")
    lines.append(pydantic_to_typescript(media.VisionPayload))
    lines.append("")
    lines.append(pydantic_to_typescript(media.VideoPayload))
    lines.append("")
    lines.append(pydantic_to_typescript(media.TranscriptionPayload))
    lines.append("")

    lines.extend([
        "// =============================================================================",
        "// Common Types",
        "// =============================================================================",
        "",
    ])

    # Common types
    lines.append(pydantic_to_typescript(common.TaskError))
    lines.append("")
    lines.append(pydantic_to_typescript(common.TaskLog))
    lines.append("")

    # Add utility types
    lines.extend([
        "// =============================================================================",
        "// Utility Types",
        "// =============================================================================",
        "",
        "/** Generic task result wrapper */",
        "export interface TaskResult<T = unknown> {",
        "  success: boolean;",
        "  data: T | null;",
        "  error: string | null;",
        "  task_id: string;",
        "  task_name: string;",
        "  started_at: string;",
        "  completed_at: string;",
        "  duration_ms: number;",
        "  trace_id: string | null;",
        "}",
        "",
        "/** Provider-agnostic chat function type */",
        "export type ChatFn = (payload: ChatPayload) => Promise<ChatResponse>;",
        "",
    ])

    return "\n".join(lines)


def main():
    """Main entry point."""
    ts_content = generate_typescript()

    # Write to file
    output_path = Path(__file__).parent.parent / "packages/core/src/types/schemas.ts"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content)

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    main()
