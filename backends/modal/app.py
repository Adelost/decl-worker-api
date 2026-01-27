"""
Modal backend for worker-ai-dsl.
Auto-discovers tasks from the registry and routes to appropriate handlers.
"""

import modal
import sys
from pathlib import Path
from typing import Optional

# Add shared tasks to path
shared_path = Path(__file__).parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

app = modal.App("worker-ai-dsl")

# ============================================================================
# Modal Images for different resource profiles
# ============================================================================

# CPU image for API-based tasks (no GPU)
cpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "openai>=1.0.0",
        "httpx",
        "feedparser",
        "yt-dlp",
        "pydub",
        "requests",
    )
    .apt_install("ffmpeg")
)

# GPU T4 image for medium GPU tasks
gpu_t4_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",
        "transformers>=4.35.0",
        "ultralytics>=8.0.0",
        "timm",
        "opencv-python-headless",
        "pillow",
        "numpy",
        "sentence-transformers>=2.2.0",
    )
    .apt_install("ffmpeg")
)

# GPU A10G image for larger models (SAM2, SDXL, Chatterbox)
gpu_a10g_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",
        "torchaudio",
        "transformers>=4.35.0",
        "diffusers>=0.24.0",
        "accelerate>=0.25.0",
        "safetensors",
        "opencv-python-headless",
        "numpy",
    )
    .apt_install("ffmpeg")
)

# Whisper image (specialized for audio transcription)
whisper_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "faster-whisper>=1.0.0",
        "pyannote.audio>=3.0.0",
        "pydub",
        "torch>=2.0.0",
    )
)

# Face detection image
face_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "insightface>=0.7.0",
        "onnxruntime-gpu",
        "opencv-python-headless",
        "numpy",
        "scikit-learn",
    )
)


# ============================================================================
# Resource Profile Definitions
# ============================================================================

PROFILES = {
    "cpu": {
        "image": cpu_image,
        "gpu": None,
        "timeout": 300,
        "secrets": [modal.Secret.from_name("openai-secret")],
    },
    "gpu_t4": {
        "image": gpu_t4_image,
        "gpu": "T4",
        "timeout": 600,
        "secrets": [],
    },
    "gpu_a10g": {
        "image": gpu_a10g_image,
        "gpu": "A10G",
        "timeout": 900,
        "secrets": [],
    },
    "whisper": {
        "image": whisper_image,
        "gpu": "T4",
        "timeout": 600,
        "secrets": [],
    },
    "faces": {
        "image": face_image,
        "gpu": "T4",
        "timeout": 300,
        "secrets": [],
    },
}


def get_profile_for_task(task_name: str, gpu: Optional[str]) -> str:
    """Determine the resource profile for a task."""
    # Special cases based on task name patterns
    if "whisper" in task_name or "diarize" in task_name:
        return "whisper"
    if "faces" in task_name or "face" in task_name:
        return "faces"

    # Based on GPU requirement
    if gpu is None:
        return "cpu"
    if gpu == "A10G" or gpu == "A100":
        return "gpu_a10g"
    return "gpu_t4"


# ============================================================================
# Profile-based Executor Functions
# ============================================================================

@app.function(
    image=cpu_image,
    timeout=300,
    secrets=[modal.Secret.from_name("openai-secret")],
)
def run_cpu_task(task_name: str, payload: dict) -> dict:
    """Execute CPU/API tasks."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task

    ensure_discovered()
    meta = get_task(task_name)

    if not meta:
        raise ValueError(f"Unknown task: {task_name}")

    result = meta.func(**payload)
    return {"result": result, "task_type": task_name}


@app.function(
    image=gpu_t4_image,
    gpu="T4",
    timeout=600,
)
def run_gpu_t4_task(task_name: str, payload: dict) -> dict:
    """Execute T4 GPU tasks."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task

    ensure_discovered()
    meta = get_task(task_name)

    if not meta:
        raise ValueError(f"Unknown task: {task_name}")

    result = meta.func(**payload)
    return {"result": result, "task_type": task_name}


@app.function(
    image=gpu_a10g_image,
    gpu="A10G",
    timeout=900,
)
def run_gpu_a10g_task(task_name: str, payload: dict) -> dict:
    """Execute A10G GPU tasks."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task

    ensure_discovered()
    meta = get_task(task_name)

    if not meta:
        raise ValueError(f"Unknown task: {task_name}")

    result = meta.func(**payload)
    return {"result": result, "task_type": task_name}


@app.function(
    image=whisper_image,
    gpu="T4",
    timeout=600,
)
def run_whisper_task(task_name: str, payload: dict) -> dict:
    """Execute Whisper/diarization tasks."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task

    ensure_discovered()
    meta = get_task(task_name)

    if not meta:
        raise ValueError(f"Unknown task: {task_name}")

    result = meta.func(**payload)
    return {"result": result, "task_type": task_name}


@app.function(
    image=face_image,
    gpu="T4",
    timeout=300,
)
def run_face_task(task_name: str, payload: dict) -> dict:
    """Execute face detection/recognition tasks."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task

    ensure_discovered()
    meta = get_task(task_name)

    if not meta:
        raise ValueError(f"Unknown task: {task_name}")

    result = meta.func(**payload)
    return {"result": result, "task_type": task_name}


# Profile to executor mapping
PROFILE_EXECUTORS = {
    "cpu": run_cpu_task,
    "gpu_t4": run_gpu_t4_task,
    "gpu_a10g": run_gpu_a10g_task,
    "whisper": run_whisper_task,
    "faces": run_face_task,
}


# ============================================================================
# Main Dispatch Function
# ============================================================================

@app.function(image=cpu_image)
def dispatch(task_type: str, payload: dict) -> dict:
    """
    Dispatch a task to the appropriate handler based on registry metadata.

    Args:
        task_type: Task type identifier (e.g., "yolo.detect", "openai.chat")
                   Also accepts aliases (e.g., "llm.chat", "vision.yolo.detect")
        payload: Task payload/arguments

    Returns:
        Task result
    """
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task, get_registry

    ensure_discovered()
    meta = get_task(task_type)

    if not meta:
        # List available tasks for error message
        available = sorted(get_registry().keys())
        raise ValueError(
            f"Unknown task type: {task_type}. "
            f"Available tasks: {len(available)}. "
            f"Examples: {', '.join(available[:5])}"
        )

    # Determine which executor to use
    profile = get_profile_for_task(meta.name, meta.gpu)
    executor = PROFILE_EXECUTORS.get(profile, run_cpu_task)

    return executor.remote(task_type, payload)


# ============================================================================
# Utility Functions
# ============================================================================

@app.function(image=cpu_image)
def health() -> dict:
    """Health check endpoint."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import list_tasks

    ensure_discovered()

    return {
        "status": "healthy",
        "backend": "modal",
        "available_tasks": len(list_tasks()),
    }


@app.function(image=cpu_image)
def list_all_tasks() -> dict:
    """List all available tasks with metadata."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import list_tasks, CATEGORIES

    ensure_discovered()
    tasks = list_tasks()

    # Group by category
    by_category = {cat: [] for cat in CATEGORIES}
    for task in tasks:
        by_category[task.category].append({
            "name": task.name,
            "gpu": task.gpu,
            "capabilities": task.capabilities,
            "aliases": task.aliases,
            "description": task.description,
        })

    # Remove empty categories
    by_category = {k: v for k, v in by_category.items() if v}

    return {
        "total": len(tasks),
        "categories": by_category,
    }


@app.function(image=cpu_image)
def get_task_info(task_name: str) -> dict:
    """Get detailed info about a specific task."""
    from tasks.discovery import ensure_discovered
    from tasks.decorator import get_task

    ensure_discovered()
    meta = get_task(task_name)

    if not meta:
        return {"error": f"Unknown task: {task_name}"}

    return meta.to_dict()


# ============================================================================
# CLI Entrypoint
# ============================================================================

@app.local_entrypoint()
def main(
    task_type: str = "",
    payload: str = "{}",
    list_all: bool = False,
    task_info: str = "",
):
    """
    Run a task from the command line.

    Usage:
        modal run app.py --task-type yolo.detect --payload '{"image_path": "/path/to/image.jpg"}'
        modal run app.py --list-all
        modal run app.py --task-info yolo.detect
    """
    import json

    if list_all:
        result = list_all_tasks.remote()
        print(json.dumps(result, indent=2))
        return

    if task_info:
        result = get_task_info.remote(task_info)
        print(json.dumps(result, indent=2))
        return

    if not task_type:
        print("Usage:")
        print("  modal run app.py --task-type <type> --payload '<json>'")
        print("  modal run app.py --list-all")
        print("  modal run app.py --task-info <task-name>")
        print()
        print("Examples:")
        print("  modal run app.py --task-type yolo.detect --payload '{\"image_path\": \"test.jpg\"}'")
        print("  modal run app.py --task-type openai.chat --payload '{\"prompt\": \"Hello\"}'")
        return

    payload_dict = json.loads(payload)
    result = dispatch.remote(task_type, payload_dict)
    print(json.dumps(result, indent=2))


# ============================================================================
# Web Endpoints
# ============================================================================

@app.function(image=cpu_image)
@modal.web_endpoint(method="POST")
def run_task(request: dict) -> dict:
    """
    HTTP endpoint for running tasks.

    POST body:
        {
            "task_type": "yolo.detect",
            "payload": {"image_path": "/path/to/image.jpg"}
        }
    """
    task_type = request.get("task_type")
    payload = request.get("payload", {})

    if not task_type:
        return {"error": "task_type is required"}

    try:
        return dispatch.remote(task_type, payload)
    except Exception as e:
        return {"error": str(e)}


@app.function(image=cpu_image)
@modal.web_endpoint(method="GET")
def health_check() -> dict:
    """HTTP health check endpoint."""
    return health.remote()


@app.function(image=cpu_image)
@modal.web_endpoint(method="GET")
def tasks_list() -> dict:
    """HTTP endpoint to list available tasks."""
    return list_all_tasks.remote()
