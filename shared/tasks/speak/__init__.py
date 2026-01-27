"""
TTS/audio output tasks - speak category.

Tasks for speech synthesis: OpenAI TTS, ElevenLabs, Chatterbox, etc.
"""

from . import openai_tts
from . import elevenlabs
from . import chatterbox

__all__ = [
    "openai_tts",
    "elevenlabs",
    "chatterbox",
]
