"""
Shared schemas - Single source of truth for Python AND TypeScript.

These Pydantic models define the contract between frontend and backend.
TypeScript types are auto-generated from these.
"""

from .chat import Message, ChatPayload, ChatResponse
from .media import ImageRef, VideoRef, AudioRef
from .common import TaskResult, TaskError

__all__ = [
    # Chat
    "Message",
    "ChatPayload",
    "ChatResponse",
    # Media references (never raw data!)
    "ImageRef",
    "VideoRef",
    "AudioRef",
    # Common
    "TaskResult",
    "TaskError",
]
