"""
Worker decorator for DWA.

Define workers declaratively with Pydantic schemas:

    from pydantic import BaseModel
    from dwa import worker

    class Input(BaseModel):
        image_path: str
        confidence: float = 0.5

    class Output(BaseModel):
        detections: list[dict]
        count: int

    @worker(name="my-detector", input=Input, output=Output, gpu="T4")
    def detect(input: Input) -> Output:
        # Your implementation
        return Output(detections=[...], count=5)
"""

from dataclasses import dataclass, field
from typing import Callable, Type, Optional, Any, TypeVar, Generic
from functools import wraps

try:
    from pydantic import BaseModel
except ImportError:
    BaseModel = None  # type: ignore


# Type variables for input/output
I = TypeVar("I")
O = TypeVar("O")


@dataclass
class WorkerDef(Generic[I, O]):
    """Worker definition with schema and handler."""

    name: str
    input_schema: Type[I]
    output_schema: Type[O]
    handler: Callable[[I], O]
    gpu: Optional[str] = None
    timeout: int = 300
    memory: Optional[str] = None
    description: str = ""
    version: str = "1.0"
    retry_attempts: int = 3
    retry_backoff: str = "exponential"

    def to_json_schema(self) -> dict:
        """Convert to JSON Schema for TypeScript interop."""
        input_schema = {}
        output_schema = {}

        if BaseModel and issubclass(self.input_schema, BaseModel):
            input_schema = self.input_schema.model_json_schema()
        if BaseModel and issubclass(self.output_schema, BaseModel):
            output_schema = self.output_schema.model_json_schema()

        return {
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "input": input_schema,
            "output": output_schema,
            "gpu": self.gpu,
            "timeout": self.timeout,
            "memory": self.memory,
            "retry": {
                "attempts": self.retry_attempts,
                "backoff": self.retry_backoff,
            },
        }

    def validate_input(self, data: dict) -> I:
        """Validate and parse input data."""
        if BaseModel and issubclass(self.input_schema, BaseModel):
            return self.input_schema.model_validate(data)
        return data  # type: ignore

    def validate_output(self, data: Any) -> O:
        """Validate output data."""
        if BaseModel and issubclass(self.output_schema, BaseModel):
            if isinstance(data, self.output_schema):
                return data
            return self.output_schema.model_validate(data)
        return data  # type: ignore

    def execute(self, input_data: dict) -> dict:
        """Execute worker with validation."""
        # Validate input
        validated_input = self.validate_input(input_data)

        # Execute handler
        result = self.handler(validated_input)

        # Validate and serialize output
        validated_output = self.validate_output(result)

        if BaseModel and isinstance(validated_output, BaseModel):
            return validated_output.model_dump()
        return result


# Global worker registry
_WORKER_REGISTRY: dict[str, WorkerDef] = {}


def worker(
    name: str,
    input: Type[I],
    output: Type[O],
    gpu: Optional[str] = None,
    timeout: int = 300,
    memory: Optional[str] = None,
    description: Optional[str] = None,
    version: str = "1.0",
    retry_attempts: int = 3,
    retry_backoff: str = "exponential",
) -> Callable[[Callable[[I], O]], Callable[[I], O]]:
    """
    Decorator to register a worker.

    Args:
        name: Unique worker name
        input: Pydantic model for input validation
        output: Pydantic model for output validation
        gpu: GPU requirement (None, "T4", "A10G", "A100")
        timeout: Timeout in seconds
        memory: Memory requirement (e.g., "512Mi", "2Gi")
        description: Human-readable description
        version: Worker version
        retry_attempts: Number of retry attempts
        retry_backoff: Backoff strategy ("fixed" or "exponential")

    Returns:
        Decorated function
    """

    def decorator(func: Callable[[I], O]) -> Callable[[I], O]:
        # Extract description from docstring if not provided
        desc = description or (func.__doc__ or "").split("\n")[0].strip()

        # Create worker definition
        worker_def = WorkerDef(
            name=name,
            input_schema=input,
            output_schema=output,
            handler=func,
            gpu=gpu,
            timeout=timeout,
            memory=memory,
            description=desc,
            version=version,
            retry_attempts=retry_attempts,
            retry_backoff=retry_backoff,
        )

        # Register
        _WORKER_REGISTRY[name] = worker_def

        # Attach metadata to function
        @wraps(func)
        def wrapper(input_data: I) -> O:
            return func(input_data)

        wrapper._worker_def = worker_def  # type: ignore
        return wrapper

    return decorator


def get_worker(name: str) -> Optional[WorkerDef]:
    """Get a worker by name."""
    return _WORKER_REGISTRY.get(name)


def list_workers() -> list[WorkerDef]:
    """List all registered workers."""
    return list(_WORKER_REGISTRY.values())


def get_registry() -> dict[str, WorkerDef]:
    """Get the full worker registry."""
    return _WORKER_REGISTRY


def clear_registry() -> None:
    """Clear the worker registry (for testing)."""
    _WORKER_REGISTRY.clear()


def export_schemas() -> list[dict]:
    """Export all worker schemas as JSON Schema."""
    return [w.to_json_schema() for w in _WORKER_REGISTRY.values()]
