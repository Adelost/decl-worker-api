"""
Media reference schemas.

VIKTIGT: Vi skickar ALDRIG rådata (base64) över JSON.
Istället skickar vi referenser (URLs/paths) till filer.

Flow:
1. Frontend laddar upp fil → S3/GCS → får URL
2. Frontend skickar URL i payload
3. Backend laddar ner direkt till GPU-minne
4. Backend returnerar URL till resultat
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, HttpUrl


class ImageRef(BaseModel):
    """Reference to an image file."""

    url: str = Field(description="S3/GCS/HTTP URL to image")
    format: Optional[Literal["jpg", "png", "webp"]] = None
    width: Optional[int] = None
    height: Optional[int] = None


class VideoRef(BaseModel):
    """Reference to a video file."""

    url: str = Field(description="S3/GCS/HTTP URL to video")
    format: Optional[Literal["mp4", "webm", "mov"]] = None
    duration_seconds: Optional[float] = None
    fps: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None


class AudioRef(BaseModel):
    """Reference to an audio file."""

    url: str = Field(description="S3/GCS/HTTP URL to audio")
    format: Optional[Literal["mp3", "wav", "flac", "m4a"]] = None
    duration_seconds: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None


# === Payloads som använder media refs ===


class VisionPayload(BaseModel):
    """Payload for vision tasks (YOLO, SAM2, etc)."""

    image: ImageRef
    confidence: float = Field(default=0.25, ge=0, le=1)


class VideoPayload(BaseModel):
    """Payload for video tasks."""

    video: VideoRef
    fps: int = Field(default=30, ge=1, le=120)
    start_time: Optional[float] = None
    end_time: Optional[float] = None


class TranscriptionPayload(BaseModel):
    """Payload for audio transcription."""

    audio: AudioRef
    language: Optional[str] = None  # ISO 639-1 code
    word_timestamps: bool = False
