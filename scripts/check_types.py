#!/usr/bin/env python3
"""
Check if generated TypeScript types are up-to-date.

Usage:
    python scripts/check_types.py
    pnpm check:types

Returns exit code 1 if types are out of date.
"""

import sys
import re
import hashlib
from pathlib import Path

# Add shared to path
sys.path.insert(0, str(Path(__file__).parent.parent / "shared"))


def strip_timestamp(content: str) -> str:
    """Remove timestamp line from generated content for consistent hashing."""
    return re.sub(r'\n \* Generated: .+\n', '\n', content)


def get_current_hash() -> str:
    """Get hash of current generated.ts file."""
    output_path = Path(__file__).parent.parent / "packages/core/src/types/generated.ts"
    if not output_path.exists():
        return ""
    content = strip_timestamp(output_path.read_text())
    return hashlib.md5(content.encode()).hexdigest()


def generate_and_get_hash() -> str:
    """Generate new types and return hash."""
    from tasks.decorator import list_tasks, CATEGORIES, clear_registry
    from tasks.discovery import discover_tasks, reset_discovery

    # Import the generator
    sys.path.insert(0, str(Path(__file__).parent))
    from gen_types import generate_typescript

    # Discover tasks
    clear_registry()
    reset_discovery()
    discover_tasks()

    # Generate TypeScript
    ts_content = generate_typescript()
    content = strip_timestamp(ts_content)
    return hashlib.md5(content.encode()).hexdigest()


def main():
    """Check if types are up-to-date."""
    current_hash = get_current_hash()
    new_hash = generate_and_get_hash()

    if current_hash == new_hash:
        print("✓ TypeScript types are up-to-date")
        return 0
    else:
        print("✗ TypeScript types are out of date!")
        print("  Run 'pnpm gen:types' to update them.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
