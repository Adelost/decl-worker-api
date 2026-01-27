"""
Audio input tasks - hear category.

Tasks for audio perception: transcription, diarization, language detection, etc.
"""

from . import whisper
from . import diarize

__all__ = [
    "whisper",
    "diarize",
]
