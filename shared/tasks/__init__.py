"""
Shared task implementations for declarative-worker-api.

Tasks are organized by DATA TYPE and use the @task decorator for auto-registration.

Data types:
- video/    Video processing (extract frames, transcode, scene detection)
- audio/    Audio processing (convert, transcribe, TTS, diarize)
- image/    Image processing (transform, detect objects)
- text/     Text processing (chunk, LLM)
- data/     Data operations (fetch, RSS, semantic search)

Each module contains both generic operations and AI-enhanced operations.
"""

from .decorator import task, get_task, list_tasks, CATEGORIES
from .discovery import discover_tasks, reset_discovery

__all__ = [
    "task",
    "get_task",
    "list_tasks",
    "discover_tasks",
    "reset_discovery",
    "CATEGORIES",
]
