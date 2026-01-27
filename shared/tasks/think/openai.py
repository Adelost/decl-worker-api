"""
OpenAI LLM tasks.

Uses standard ChatPayload - same as Qwen, Llama, etc.
"""

from typing import Generator
import json

from ..decorator import task

# Standard schema - samma för alla providers!
from ...schemas.chat import ChatPayload, ChatResponse


@task(
    name="openai.chat",
    category="think",
    capabilities=["chat", "generate"],
    gpu=None,  # OpenAI är API-baserat
    timeout=120,
)
def chat(payload: ChatPayload) -> ChatResponse:
    """
    Chat completion using OpenAI API.

    Accepterar standard ChatPayload - samma som qwen.chat!
    """
    import openai

    # Konvertera Pydantic -> OpenAI format
    messages = [{"role": m.role, "content": m.content} for m in payload.messages]

    response = openai.chat.completions.create(
        model="gpt-4",
        messages=messages,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        top_p=payload.top_p,
        stop=payload.stop,
    )

    return ChatResponse(
        content=response.choices[0].message.content,
        model=response.model,
        usage={
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens": response.usage.total_tokens,
        },
    )


@task(
    name="openai.chat_stream",
    category="think",
    capabilities=["chat", "generate", "stream"],
    gpu=None,
    timeout=120,
    streaming=True,
)
def chat_stream(payload: ChatPayload) -> Generator[ChatResponse, None, None]:
    """Streaming chat completion."""
    import openai

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]

    response = openai.chat.completions.create(
        model="gpt-4",
        messages=messages,
        temperature=payload.temperature,
        stream=True,
    )

    for chunk in response:
        if chunk.choices[0].delta.content:
            yield ChatResponse(
                content=chunk.choices[0].delta.content,
                model="gpt-4",
                is_partial=True,
            )


@task(
    name="openai.embed",
    category="think",
    capabilities=["embed", "vectors"],
    gpu=None,
    timeout=60,
)
def embed(
    text: str | list[str],
    model: str = "text-embedding-3-small",
) -> list[float] | list[list[float]]:
    """Generate embeddings for text."""
    import openai

    response = openai.embeddings.create(model=model, input=text)

    if isinstance(text, str):
        return response.data[0].embedding
    return [d.embedding for d in response.data]


@task(
    name="openai.summarize",
    category="think",
    capabilities=["summarize"],
    gpu=None,
    timeout=120,
)
def summarize(text: str, max_length: int = 200, style: str = "concise") -> str:
    """Summarize text using LLM."""
    from ...schemas.chat import Message

    prompts = {
        "concise": f"Summarize in {max_length} chars or less:\n\n{text}",
        "detailed": f"Detailed summary (target: {max_length} chars):\n\n{text}",
        "bullet": f"Summarize as bullet points:\n\n{text}",
    }

    payload = ChatPayload(
        messages=[Message(role="user", content=prompts.get(style, prompts["concise"]))],
        temperature=0.3,
    )

    result = chat(payload)
    return result.content


@task(
    name="openai.extract",
    category="think",
    capabilities=["extract", "structure"],
    gpu=None,
    timeout=120,
)
def extract(text: str, schema: dict) -> dict:
    """Extract structured data from text."""
    from ...schemas.chat import Message

    prompt = f"""Extract information according to this JSON schema:

Schema:
{json.dumps(schema, indent=2)}

Text:
{text}

Respond with valid JSON only."""

    payload = ChatPayload(
        messages=[Message(role="user", content=prompt)],
        temperature=0,
    )

    result = chat(payload)
    return json.loads(result.content)


@task(
    name="openai.classify",
    category="think",
    capabilities=["classify"],
    gpu=None,
    timeout=60,
)
def classify(text: str, categories: list[str]) -> dict:
    """Classify text into categories."""
    from ...schemas.chat import Message

    categories_str = ", ".join(categories)
    prompt = f"""Classify into one of: {categories_str}

Text: {text}

Respond with JSON: {{"category": "...", "confidence": 0.0-1.0, "reasoning": "..."}}"""

    payload = ChatPayload(
        messages=[Message(role="user", content=prompt)],
        temperature=0,
    )

    result = chat(payload)
    return json.loads(result.content)


@task(
    name="openai.translate",
    category="think",
    capabilities=["translate"],
    gpu=None,
    timeout=120,
)
def translate(text: str, target_language: str, source_language: str = None) -> str:
    """Translate text."""
    from ...schemas.chat import Message

    source = f"from {source_language} " if source_language else ""
    prompt = f"Translate {source}to {target_language}. Only output the translation:\n\n{text}"

    payload = ChatPayload(
        messages=[Message(role="user", content=prompt)],
        temperature=0.3,
    )

    result = chat(payload)
    return result.content
