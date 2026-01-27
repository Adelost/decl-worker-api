"""
Qwen LLM tasks.

SAMMA interface som OpenAI - drop-in replacement!
"""

from typing import Generator

from ..decorator import task

# Använder SAMMA schema som OpenAI
from ...schemas.chat import ChatPayload, ChatResponse, Message


@task(
    name="qwen.chat",
    category="think",
    capabilities=["chat", "generate"],
    gpu="A10G",  # Qwen kör lokalt på GPU
    timeout=120,
)
def chat(payload: ChatPayload) -> ChatResponse:
    """
    Chat completion using Qwen (local GPU).

    Accepterar EXAKT samma payload som openai.chat!
    """
    # Konvertera till Qwen-format internt
    from transformers import AutoModelForCausalLM, AutoTokenizer

    model_name = "Qwen/Qwen2-7B-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name, device_map="auto")

    # Bygg prompt från messages
    prompt = _build_prompt(payload.messages)

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=payload.max_tokens or 512,
        temperature=payload.temperature,
        do_sample=payload.temperature > 0,
    )

    response_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

    return ChatResponse(
        content=response_text,
        model=model_name,
        usage={"total_tokens": len(outputs[0])},
    )


@task(
    name="qwen.chat_stream",
    category="think",
    capabilities=["chat", "generate", "stream"],
    gpu="A10G",
    timeout=120,
    streaming=True,
)
def chat_stream(payload: ChatPayload) -> Generator[ChatResponse, None, None]:
    """Streaming chat with Qwen."""
    from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
    from threading import Thread

    model_name = "Qwen/Qwen2-7B-Instruct"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name, device_map="auto")

    prompt = _build_prompt(payload.messages)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    streamer = TextIteratorStreamer(tokenizer, skip_special_tokens=True)

    thread = Thread(target=model.generate, kwargs={
        **inputs,
        "max_new_tokens": payload.max_tokens or 512,
        "streamer": streamer,
    })
    thread.start()

    for text in streamer:
        yield ChatResponse(
            content=text,
            model=model_name,
            is_partial=True,
        )


def _build_prompt(messages: list[Message]) -> str:
    """Convert standard messages to Qwen prompt format."""
    parts = []
    for msg in messages:
        if msg.role == "system":
            parts.append(f"<|im_start|>system\n{msg.content}<|im_end|>")
        elif msg.role == "user":
            parts.append(f"<|im_start|>user\n{msg.content}<|im_end|>")
        elif msg.role == "assistant":
            parts.append(f"<|im_start|>assistant\n{msg.content}<|im_end|>")
    parts.append("<|im_start|>assistant\n")
    return "\n".join(parts)
