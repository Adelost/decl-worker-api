"""
Type definitions for the task decorator system.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional, Any, Generator


@dataclass
class ChunkConfig:
    """Configuration for chunking long-running tasks."""

    input_field: str
    """The payload field containing the input to chunk (e.g., 'audio_path')."""

    default_size: str
    """Default chunk size (e.g., '10m' for 10 minutes, '1h' for 1 hour)."""

    overlap: str = "0s"
    """Overlap between chunks (e.g., '5s' for 5 seconds)."""

    merge_strategy: str = "concat"
    """How to merge results: 'concat', 'concat_segments', 'aggregate'."""


@dataclass
class TaskMeta:
    """Metadata for a registered task."""

    name: str
    """Task name (e.g., 'yolo.detect')."""

    category: str
    """Task category (e.g., 'see', 'hear', 'think')."""

    func: Callable[..., Any]
    """The actual task function."""

    capabilities: list[str] = field(default_factory=list)
    """Task capabilities (e.g., ['detect', 'objects'])."""

    gpu: Optional[str] = None
    """GPU type required (None, 'T4', 'A10G', 'A100')."""

    timeout: int = 300
    """Task timeout in seconds."""

    streaming: bool = False
    """Whether this task yields results incrementally."""

    chunk: Optional[ChunkConfig] = None
    """Chunking configuration for long-running tasks."""

    description: str = ""
    """Task description (from docstring)."""

    @property
    def is_gpu_task(self) -> bool:
        """Check if task requires GPU."""
        return self.gpu is not None

    @property
    def is_chunked(self) -> bool:
        """Check if task supports chunking."""
        return self.chunk is not None

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "name": self.name,
            "category": self.category,
            "capabilities": self.capabilities,
            "gpu": self.gpu,
            "timeout": self.timeout,
            "streaming": self.streaming,
            "chunk": {
                "input_field": self.chunk.input_field,
                "default_size": self.chunk.default_size,
                "overlap": self.chunk.overlap,
                "merge_strategy": self.chunk.merge_strategy,
            } if self.chunk else None,
            "description": self.description,
        }
