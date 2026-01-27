#!/usr/bin/env python3
"""
Generate TypeScript AND Python from JSON Schema.

JSON Schema = Single Source of Truth

Usage:
    pnpm gen:all

This generates:
    - packages/core/src/types/schemas.ts (TypeScript)
    - shared/schemas/generated.py (Python/Pydantic)

Dependencies:
    pip install datamodel-code-generator
    npm install json-schema-to-typescript
"""

import subprocess
import json
from pathlib import Path
from datetime import datetime


ROOT = Path(__file__).parent.parent
SCHEMA_DIR = ROOT / "schemas"
TS_OUTPUT = ROOT / "packages/core/src/types/schemas.ts"
PY_OUTPUT = ROOT / "shared/schemas/generated.py"


def generate_typescript():
    """Generate TypeScript from JSON Schema using json-schema-to-typescript."""
    print("Generating TypeScript...")

    ts_lines = [
        "/**",
        " * Auto-generated from JSON Schema - DO NOT EDIT",
        f" * Generated: {datetime.now().isoformat()}",
        " * Source: schemas/*.schema.json",
        " */",
        "",
    ]

    # Process each schema file
    for schema_file in sorted(SCHEMA_DIR.glob("*.schema.json")):
        with open(schema_file) as f:
            schema = json.load(f)

        title = schema.get("title", schema_file.stem)
        ts_lines.append(f"// === {title} ===")
        ts_lines.append("")

        # Generate interfaces from definitions
        for name, definition in schema.get("definitions", {}).items():
            ts_lines.extend(json_schema_to_ts_interface(name, definition))
            ts_lines.append("")

    TS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    TS_OUTPUT.write_text("\n".join(ts_lines))
    print(f"  → {TS_OUTPUT}")


def json_schema_to_ts_interface(name: str, schema: dict) -> list[str]:
    """Convert a JSON Schema definition to TypeScript interface."""
    lines = []

    desc = schema.get("description", "")
    if desc:
        lines.append(f"/** {desc} */")

    lines.append(f"export interface {name} {{")

    required = set(schema.get("required", []))

    for prop_name, prop_schema in schema.get("properties", {}).items():
        ts_type = json_type_to_ts(prop_schema)
        optional = "" if prop_name in required else "?"
        prop_desc = prop_schema.get("description", "")

        if prop_desc:
            lines.append(f"  /** {prop_desc} */")
        lines.append(f"  {prop_name}{optional}: {ts_type};")

    lines.append("}")
    return lines


def json_type_to_ts(schema: dict) -> str:
    """Convert JSON Schema type to TypeScript type."""
    if "$ref" in schema:
        # Extract type name from #/definitions/TypeName
        return schema["$ref"].split("/")[-1]

    schema_type = schema.get("type")

    # Handle union types like ["string", "null"]
    if isinstance(schema_type, list):
        types = []
        for t in schema_type:
            if t == "null":
                types.append("null")
            else:
                types.append(json_type_to_ts({"type": t}))
        return " | ".join(types)

    # Handle enums
    if "enum" in schema:
        enum_values = [f'"{v}"' if isinstance(v, str) else str(v)
                      for v in schema["enum"] if v is not None]
        if None in schema["enum"]:
            enum_values.append("null")
        return " | ".join(enum_values)

    # Basic type mapping
    type_map = {
        "string": "string",
        "integer": "number",
        "number": "number",
        "boolean": "boolean",
        "null": "null",
        "object": "Record<string, unknown>",
    }

    if schema_type == "array":
        items = schema.get("items", {})
        item_type = json_type_to_ts(items)
        return f"{item_type}[]"

    if schema_type == "object" and "properties" in schema:
        # Inline object
        props = []
        for k, v in schema["properties"].items():
            props.append(f"{k}: {json_type_to_ts(v)}")
        return "{ " + "; ".join(props) + " }"

    return type_map.get(schema_type, "unknown")


def generate_python():
    """Generate Python Pydantic models from JSON Schema."""
    print("Generating Python (Pydantic)...")

    # Check if datamodel-code-generator is installed
    try:
        subprocess.run(["datamodel-codegen", "--version"],
                      capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  ⚠ datamodel-code-generator not installed")
        print("  Run: pip install datamodel-code-generator")
        return

    # Combine all schemas
    combined = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "definitions": {},
    }

    for schema_file in SCHEMA_DIR.glob("*.schema.json"):
        with open(schema_file) as f:
            schema = json.load(f)
        combined["definitions"].update(schema.get("definitions", {}))

    # Write combined schema
    combined_path = SCHEMA_DIR / "_combined.json"
    with open(combined_path, "w") as f:
        json.dump(combined, f, indent=2)

    # Generate Python
    PY_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    subprocess.run([
        "datamodel-codegen",
        "--input", str(combined_path),
        "--input-file-type", "jsonschema",
        "--output", str(PY_OUTPUT),
        "--output-model-type", "pydantic_v2.BaseModel",
        "--use-standard-collections",
        "--use-union-operator",
        "--target-python-version", "3.11",
    ], check=True)

    # Clean up
    combined_path.unlink()

    print(f"  → {PY_OUTPUT}")


def main():
    print(f"JSON Schema → TypeScript + Python")
    print(f"Source: {SCHEMA_DIR}/*.schema.json")
    print()

    generate_typescript()
    generate_python()

    print()
    print("Done!")


if __name__ == "__main__":
    main()
