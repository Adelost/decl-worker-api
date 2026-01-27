"""
Chat schemas - Standard format for all LLM providers.

OpenAI, Qwen, Llama, Mistral - alla använder samma format.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    """A single message in a conversation."""

    role: Literal["user", "assistant", "system"]
    content: str

    # Optional: för multimodal (bilder i chatten)
    image_url: Optional[str] = None


class ChatPayload(BaseModel):
    """
    Standard chat payload - works with ANY LLM provider.

    Usage:
        # Frontend skickar samma format oavsett provider
        payload = ChatPayload(
            messages=[Message(role="user", content="Hello!")],
            temperature=0.7
        )

        # Backend: openai.chat, qwen.chat, llama.chat - alla tar emot detta
    """

    messages: list[Message]
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, ge=1)

    # Provider-specifikt (ignoreras om providern inte stödjer det)
    top_p: Optional[float] = Field(default=None, ge=0, le=1)
    stop: Optional[list[str]] = None


class ChatResponse(BaseModel):
    """Standard chat response."""

    content: str
    model: str
    usage: Optional[dict] = None  # tokens used

    # För streaming: partial responses
    is_partial: bool = False
