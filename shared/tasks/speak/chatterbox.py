"""
Chatterbox TTS tasks.
Local multilingual TTS with voice cloning (GPU required).
"""

from typing import Optional

from ..decorator import task


# Global model cache
_model = None
_model_type = None


def _get_model(model_type: str = "multilingual", device: str = "cuda"):
    """Get or create Chatterbox model."""
    global _model, _model_type

    if _model is None or _model_type != model_type:
        if _model is not None:
            del _model
            import torch
            torch.cuda.empty_cache()

        from chatterbox.tts import ChatterboxTTS

        if model_type == "turbo":
            _model = ChatterboxTTS.from_pretrained("chatterbox-turbo", device=device)
        else:
            _model = ChatterboxTTS.from_pretrained("chatterbox-multilingual", device=device)

        _model_type = model_type

    return _model


@task(
    name="chatterbox.synthesize",
    category="speak",
    capabilities=["synthesize", "tts", "multilingual"],
    gpu="A10G",
    timeout=300,
)
def synthesize(
    text: str,
    voice_ref: Optional[str] = None,
    lang: str = "en",
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    temperature: float = 0.8,
    model_type: str = "multilingual",
    device: str = "cuda",
    output_path: Optional[str] = None,
) -> str:
    """Synthesize speech using Chatterbox (local GPU)."""
    import torchaudio
    import time

    if output_path is None:
        output_path = f"/tmp/tts_chatterbox_{int(time.time())}.wav"

    model = _get_model(model_type, device)

    if voice_ref:
        wav = model.generate(
            text,
            audio_prompt_path=voice_ref,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            temperature=temperature,
        )
    else:
        wav = model.generate(
            text,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            temperature=temperature,
        )

    torchaudio.save(output_path, wav.unsqueeze(0).cpu(), model.sr)
    return output_path


@task(
    name="chatterbox.synthesize_turbo",
    category="speak",
    capabilities=["synthesize", "tts", "fast"],
    gpu="T4",
    timeout=120,
)
def synthesize_turbo(
    text: str,
    voice_ref: Optional[str] = None,
    exaggeration: float = 0.5,
    device: str = "cuda",
    output_path: Optional[str] = None,
) -> str:
    """Synthesize using Chatterbox Turbo (faster, English only)."""
    return synthesize(
        text=text,
        voice_ref=voice_ref,
        exaggeration=exaggeration,
        model_type="turbo",
        device=device,
        output_path=output_path,
    )


@task(
    name="chatterbox.clone_voice",
    category="speak",
    capabilities=["clone", "voice"],
    gpu=None,
    timeout=60,
)
def clone_voice(
    audio_path: str,
    output_path: Optional[str] = None,
) -> str:
    """Extract voice reference for cloning."""
    import torchaudio
    import time

    if output_path is None:
        output_path = f"/tmp/voice_ref_{int(time.time())}.wav"

    waveform, sample_rate = torchaudio.load(audio_path)

    if sample_rate != 24000:
        resampler = torchaudio.transforms.Resample(sample_rate, 24000)
        waveform = resampler(waveform)

    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    torchaudio.save(output_path, waveform, 24000)
    return output_path


def list_languages() -> list[dict]:
    """List supported languages for multilingual model."""
    return [
        {"code": "en", "name": "English"},
        {"code": "sv", "name": "Swedish"},
        {"code": "de", "name": "German"},
        {"code": "fr", "name": "French"},
        {"code": "es", "name": "Spanish"},
        {"code": "it", "name": "Italian"},
        {"code": "pt", "name": "Portuguese"},
        {"code": "nl", "name": "Dutch"},
        {"code": "pl", "name": "Polish"},
        {"code": "ru", "name": "Russian"},
        {"code": "zh", "name": "Chinese"},
        {"code": "ja", "name": "Japanese"},
        {"code": "ko", "name": "Korean"},
    ]


def clear_cache():
    """Clear model cache to free VRAM."""
    global _model, _model_type
    _model = None
    _model_type = None

    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
