"""
OpenAI TTS tasks.
Cloud-based text-to-speech synthesis.
"""

from typing import Optional

from ..decorator import task


@task(
    name="openai.tts",
    category="speak",
    capabilities=["synthesize", "tts"],
    gpu=None,
    timeout=120,
)
def synthesize(
    text: str,
    voice: str = "alloy",
    model: str = "tts-1",
    speed: float = 1.0,
    output_path: Optional[str] = None,
) -> str:
    """Synthesize speech using OpenAI TTS."""
    import openai
    import time

    if output_path is None:
        output_path = f"/tmp/tts_openai_{int(time.time())}.mp3"

    response = openai.audio.speech.create(
        model=model,
        voice=voice,
        input=text,
        speed=speed,
    )

    response.stream_to_file(output_path)
    return output_path


@task(
    name="openai.tts_hd",
    category="speak",
    capabilities=["synthesize", "tts", "hd"],
    gpu=None,
    timeout=120,
)
def synthesize_hd(
    text: str,
    voice: str = "alloy",
    speed: float = 1.0,
    output_path: Optional[str] = None,
) -> str:
    """Synthesize high-quality speech using OpenAI TTS-HD."""
    return synthesize(
        text=text,
        voice=voice,
        model="tts-1-hd",
        speed=speed,
        output_path=output_path,
    )


def list_voices() -> list[dict]:
    """List available OpenAI TTS voices."""
    return [
        {"id": "alloy", "name": "Alloy", "description": "Neutral, balanced"},
        {"id": "echo", "name": "Echo", "description": "Male, warm"},
        {"id": "fable", "name": "Fable", "description": "British, storyteller"},
        {"id": "onyx", "name": "Onyx", "description": "Male, deep"},
        {"id": "nova", "name": "Nova", "description": "Female, energetic"},
        {"id": "shimmer", "name": "Shimmer", "description": "Female, soft"},
    ]
