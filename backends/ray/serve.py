"""
Ray Serve endpoint for worker-ai-dsl.
Wraps shared tasks with Ray infrastructure.

Usage:
    ray start --head
    python serve.py
"""

import ray
from ray import serve
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
from pathlib import Path

# Add shared tasks to path
shared_path = Path(__file__).parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

# Initialize Ray
ray.init(address="auto", ignore_reinit_error=True)

app = FastAPI()


class TaskRequest(BaseModel):
    type: str
    payload: dict


class TaskResponse(BaseModel):
    result: dict | str | list | None = None
    error: str | None = None
    task_type: str | None = None


@serve.deployment(
    num_replicas=2,
    ray_actor_options={"num_cpus": 1},
)
@serve.ingress(app)
class TaskRouter:
    """Main task router deployment."""

    def __init__(self):
        # Lazy load handlers
        self._handlers = None

    def _get_handlers(self):
        if self._handlers is None:
            from tasks import llm, audio, image

            self._handlers = {
                # LLM tasks
                "llm.chat": llm.chat,
                "llm.embed": llm.embed,
                "llm.summarize": llm.summarize,
                "llm.extract": llm.extract,
                # Audio tasks (API-based)
                "audio.transcribe": audio.transcribe,
                "audio.tts": audio.tts,
                # Image tasks (API-based)
                "image.generate": image.generate,
                "image.describe": image.describe,
                "image.edit": image.edit,
            }
        return self._handlers

    @app.post("/task")
    async def run_task(self, request: TaskRequest) -> TaskResponse:
        """Execute a task."""
        handlers = self._get_handlers()
        handler = handlers.get(request.type)

        if not handler:
            available = ", ".join(sorted(handlers.keys()))
            return TaskResponse(
                error=f"Unknown task type: {request.type}. Available: {available}"
            )

        try:
            result = handler(**request.payload)
            return TaskResponse(result=result, task_type=request.type)
        except Exception as e:
            return TaskResponse(error=str(e), task_type=request.type)

    @app.get("/health")
    async def health(self):
        """Health check endpoint."""
        return {"status": "healthy", "backend": "ray"}

    @app.get("/tasks")
    async def list_tasks(self):
        """List available tasks."""
        handlers = self._get_handlers()
        return {"tasks": sorted(handlers.keys())}


# GPU deployment for heavy workloads
@serve.deployment(
    num_replicas=1,
    ray_actor_options={"num_gpus": 1},
)
class GpuTaskRunner:
    """GPU task runner for heavy ML workloads."""

    def __init__(self):
        self._handlers = None

    def _get_handlers(self):
        if self._handlers is None:
            from tasks import image, audio

            self._handlers = {
                "image.generate_sd": image.generate_sd,
                "image.generate_sdxl": image.generate_sdxl,
                "audio.transcribe_local": audio.transcribe_local,
            }
        return self._handlers

    async def run(self, task_type: str, payload: dict) -> TaskResponse:
        handlers = self._get_handlers()
        handler = handlers.get(task_type)

        if not handler:
            return TaskResponse(error=f"Unknown GPU task: {task_type}")

        try:
            result = handler(**payload)
            return TaskResponse(result=result, task_type=task_type)
        except Exception as e:
            return TaskResponse(error=str(e), task_type=task_type)


def main():
    """Start the Ray Serve application."""
    serve.run(TaskRouter.bind(), name="worker-ai-dsl", route_prefix="/")
    print("Ray Serve started on http://localhost:8000")

    # Keep running
    import time
    while True:
        time.sleep(60)


if __name__ == "__main__":
    main()
