"""
Common schemas for all tasks.
"""

from typing import Any, Optional, Generic, TypeVar
from datetime import datetime
from pydantic import BaseModel, Field
import uuid


T = TypeVar("T")


class TaskResult(BaseModel, Generic[T]):
    """
    Standard wrapper for all task results.

    Ger konsekvent format för:
    - Framgång/fel
    - Timing
    - Spårning (trace_id)
    """

    success: bool
    data: Optional[T] = None
    error: Optional[str] = None

    # Metadata
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_name: str
    started_at: datetime
    completed_at: datetime
    duration_ms: int

    # Spårning
    trace_id: Optional[str] = None  # För att följa request genom systemet


class TaskError(BaseModel):
    """Structured error information."""

    code: str  # "TIMEOUT", "GPU_OOM", "INVALID_INPUT", etc.
    message: str
    details: Optional[dict] = None

    # För retry-logik
    retryable: bool = False
    suggested_wait_ms: Optional[int] = None


# === Data tracking ===


class TaskLog(BaseModel):
    """
    Loggpost för varje task-körning.

    Sparas till databas för:
    - Debugging
    - Analytics
    - Billing
    """

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_name: str
    payload_hash: str  # SHA256 av input (för deduplication)

    # Timing
    queued_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Status
    status: str  # "queued", "running", "completed", "failed"
    result_url: Optional[str] = None  # S3 URL till resultat
    error: Optional[TaskError] = None

    # Resources
    worker_id: Optional[str] = None
    gpu_type: Optional[str] = None
    gpu_memory_mb: Optional[int] = None

    # Spårning
    trace_id: str
    parent_task_id: Optional[str] = None  # För pipelines
