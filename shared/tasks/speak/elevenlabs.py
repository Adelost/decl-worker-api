"""
ElevenLabs TTS tasks.
High-quality voice synthesis with cloning support.
"""

from typing import Optional
import os

from ..decorator import task


@task(
    name="elevenlabs.synthesize",
    category="speak",
    capabilities=["synthesize", "tts"],
    gpu=None,
    timeout=120,
)
def synthesize(
    text: str,
    voice_id: str = "21m00Tcm4TlvDq8ikWAM",  # Rachel
    model_id: str = "eleven_multilingual_v2",
    stability: float = 0.5,
    similarity_boost: float = 0.75,
    output_path: Optional[str] = None,
) -> str:
    """Synthesize speech using ElevenLabs."""
    import requests
    import time

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable not set")

    if output_path is None:
        output_path = f"/tmp/tts_elevenlabs_{int(time.time())}.mp3"

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key,
    }

    data = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
        },
    }

    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()

    with open(output_path, "wb") as f:
        f.write(response.content)

    return output_path


@task(
    name="elevenlabs.clone_voice",
    category="speak",
    capabilities=["clone", "voice"],
    gpu=None,
    timeout=300,
)
def clone_voice(
    name: str,
    audio_paths: list[str],
    description: str = "",
) -> str:
    """Clone a voice from audio samples."""
    import requests

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable not set")

    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": api_key}

    files = []
    for path in audio_paths:
        files.append(("files", open(path, "rb")))

    data = {
        "name": name,
        "description": description,
    }

    response = requests.post(url, headers=headers, data=data, files=files)
    response.raise_for_status()

    # Close file handles
    for _, f in files:
        f.close()

    return response.json()["voice_id"]


def list_voices() -> list[dict]:
    """List available ElevenLabs voices."""
    import requests

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable not set")

    url = "https://api.elevenlabs.io/v1/voices"
    headers = {"xi-api-key": api_key}

    response = requests.get(url, headers=headers)
    response.raise_for_status()

    data = response.json()

    return [
        {
            "id": v["voice_id"],
            "name": v["name"],
            "description": v.get("description", ""),
            "labels": v.get("labels", {}),
        }
        for v in data.get("voices", [])
    ]
