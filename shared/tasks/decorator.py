"""
Task decorator and registry for auto-registration.

Usage:
    from tasks.decorator import task

    @task(
        name="yolo.detect",
        category="see",
        capabilities=["detect", "objects"],
        gpu="T4",
    )
    def detect(image_path: str, conf: float = 0.25) -> list[dict]:
        ...
"""

from typing import Callable, Optional, Any, Union
from functools import wraps

from .types import TaskMeta, ChunkConfig


# Global task registry
_TASK_REGISTRY: dict[str, TaskMeta] = {}


def task(
    name: str,
    category: str,
    capabilities: list[str] = None,
    gpu: Optional[str] = None,
    timeout: int = 300,
    streaming: bool = False,
    chunk: Optional[Union[dict, ChunkConfig]] = None,
) -> Callable:
    """
    Decorator to register a task function.

    Args:
        name: Task name (e.g., 'yolo.detect')
        category: Task category ('see', 'hear', 'think', 'speak', 'get', 'transform', 'find', 'watch')
        capabilities: List of capabilities (e.g., ['detect', 'objects'])
        gpu: GPU type required (None, 'T4', 'A10G', 'A100')
        timeout: Task timeout in seconds
        streaming: Whether this task yields results incrementally
        chunk: Chunking configuration for long-running tasks

    Returns:
        Decorated function with _task_meta attribute
    """
    capabilities = capabilities or []

    # Convert dict to ChunkConfig if needed
    chunk_config = None
    if chunk is not None:
        if isinstance(chunk, dict):
            chunk_config = ChunkConfig(
                input_field=chunk.get("input", chunk.get("input_field", "")),
                default_size=chunk.get("default_size", "10m"),
                overlap=chunk.get("overlap", "0s"),
                merge_strategy=chunk.get("merge", chunk.get("merge_strategy", "concat")),
            )
        else:
            chunk_config = chunk

    def decorator(func: Callable) -> Callable:
        # Extract description from docstring
        description = ""
        if func.__doc__:
            # Get first line of docstring
            lines = func.__doc__.strip().split("\n")
            description = lines[0].strip()

        # Create metadata
        meta = TaskMeta(
            name=name,
            category=category,
            func=func,
            capabilities=capabilities,
            gpu=gpu,
            timeout=timeout,
            streaming=streaming,
            chunk=chunk_config,
            description=description,
        )

        # Register task
        _TASK_REGISTRY[name] = meta

        # Attach metadata to function
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        wrapper._task_meta = meta
        return wrapper

    return decorator


def get_registry() -> dict[str, TaskMeta]:
    """Get the global task registry."""
    return _TASK_REGISTRY


def get_task(name: str) -> Optional[TaskMeta]:
    """Get a task by name (or alias)."""
    return _TASK_REGISTRY.get(name)


def list_tasks() -> list[TaskMeta]:
    """List all unique tasks (excluding aliases)."""
    seen_names = set()
    tasks = []
    for meta in _TASK_REGISTRY.values():
        if meta.name not in seen_names:
            seen_names.add(meta.name)
            tasks.append(meta)
    return tasks


def list_by_category(category: str) -> list[TaskMeta]:
    """List all tasks in a category."""
    return [t for t in list_tasks() if t.category == category]


def list_by_capability(capability: str) -> list[TaskMeta]:
    """List all tasks with a specific capability."""
    return [t for t in list_tasks() if capability in t.capabilities]


def list_gpu_tasks() -> list[TaskMeta]:
    """List all tasks requiring GPU."""
    return [t for t in list_tasks() if t.is_gpu_task]


def list_streaming_tasks() -> list[TaskMeta]:
    """List all streaming tasks."""
    return [t for t in list_tasks() if t.streaming]


def list_chunked_tasks() -> list[TaskMeta]:
    """List all tasks with chunking support."""
    return [t for t in list_tasks() if t.is_chunked]


def clear_registry() -> None:
    """Clear the task registry (for testing)."""
    _TASK_REGISTRY.clear()


# Categories
CATEGORIES = [
    "see",       # Vision tasks
    "hear",      # Audio input tasks
    "think",     # LLM/reasoning tasks
    "speak",     # TTS/audio output tasks
    "get",       # Input/download tasks
    "transform", # Utility/conversion tasks
    "find",      # Search tasks
    "watch",     # Video tasks
]


def validate_category(category: str) -> bool:
    """Check if a category is valid."""
    return category in CATEGORIES
