"""
Shared task implementations for worker-ai-dsl.

Tasks are organized by category and use the @task decorator for auto-registration.

Categories:
- see/      Vision tasks (yolo, sam2, florence, depth, siglip, faces)
- hear/     Audio tasks (whisper, diarize)
- think/    LLM tasks (openai)
- speak/    TTS tasks (openai_tts, elevenlabs, chatterbox, sesame)
- get/      Input tasks (download, rss)
- transform/ Utility tasks (convert, chunk, image)
- find/     Search tasks (semantic, multimodal, vector)
- watch/    Video tasks (analyze, scenes, tracking)
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
