# ============================================================
# ASR Service：数字传承人「语音提问」的语音识别
# ------------------------------------------------------------
# 复用后端已配置的百炼账号（AI_API_KEY），调用 qwen3-asr-flash 做语音转文字。
# 音频先经 FFmpeg 统一转成 16kHz 单声道 wav，再以 base64 data URL 提交，
# 避免依赖公网可访问的临时文件地址。
#
# 未配置 Key 或服务不可用时抛出带中文说明的 ASRError，
# 前端据此提示用户改用文字提问，绝不伪造识别结果。
# ============================================================
import asyncio
import base64
import json
import os
import subprocess
import tempfile
import uuid

import httpx

import config
from services.video_service import resolve_ffmpeg

ASR_MODEL = os.getenv("ASR_MODEL", "qwen3-asr-flash")
_ASR_ENDPOINT = "/api/v1/services/aigc/multimodal-generation/generation"
_MAX_SECONDS = 30  # 单次语音提问最长 30 秒


class ASRError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _to_wav(src_path: str, dest_path: str) -> None:
    """把任意浏览器录音格式转成 16kHz / 单声道 / 16bit wav（FFmpeg）。"""
    ffmpeg = resolve_ffmpeg()
    cmd = [
        ffmpeg, "-y", "-i", src_path,
        "-ac", "1", "-ar", "16000", "-sample_fmt", "s16",
        "-t", str(_MAX_SECONDS),
        dest_path,
    ]
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if proc.returncode != 0 or not os.path.isfile(dest_path):
        raise ASRError("ASR_AUDIO_CONVERT_FAILED", "录音格式转换失败，请重新录制")


def _convert_sync(src_path: str) -> str:
    tmp_dir = tempfile.gettempdir()
    dest = os.path.join(tmp_dir, f"asr_{uuid.uuid4().hex[:8]}.wav")
    _to_wav(src_path, dest)
    return dest


async def transcribe(audio_bytes: bytes, filename: str = "voice.webm") -> dict:
    """语音转文字。

    @return {text, mode, durationHint}
    """
    if not config.AI_API_KEY:
        raise ASRError("ASR_NOT_CONFIGURED", "语音识别服务未配置，请改用文字提问")
    if not audio_bytes:
        raise ASRError("ASR_EMPTY_AUDIO", "没有收到录音内容，请重新录制")

    suffix = os.path.splitext(filename)[1] or ".webm"
    src = os.path.join(tempfile.gettempdir(), f"asr_src_{uuid.uuid4().hex[:8]}{suffix}")
    with open(src, "wb") as f:
        f.write(audio_bytes)
    wav_path = None
    try:
        wav_path = await asyncio.to_thread(_convert_sync, src)
        with open(wav_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
    finally:
        for p in (src, wav_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass

    payload = {
        "model": ASR_MODEL,
        "input": {
            "messages": [
                {"role": "user", "content": [{"audio": f"data:audio/wav;base64,{b64}"}]}
            ]
        },
        "parameters": {"asr_options": {"enable_itn": True, "language": "zh"}},
    }
    headers = {
        "Authorization": f"Bearer {config.AI_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                f"{config.DASHSCOPE_BASE_URL}{_ASR_ENDPOINT}", json=payload, headers=headers
            )
    except httpx.TimeoutException:
        raise ASRError("ASR_TIMEOUT", "语音识别超时，请重试或改用文字提问")
    except httpx.RequestError:
        raise ASRError("ASR_CONNECT_FAILED", "无法连接语音识别服务，请改用文字提问")

    if resp.status_code != 200:
        if resp.status_code in (401, 403):
            raise ASRError("ASR_UNAUTHORIZED", "语音识别服务鉴权失败，请检查 API Key 权限")
        raise ASRError("ASR_HTTP_ERROR", f"语音识别服务返回错误（HTTP {resp.status_code}）")

    try:
        data = resp.json()
        text = (
            data["output"]["choices"][0]["message"]["content"][0]["text"]
        ).strip()
    except Exception:
        raise ASRError("ASR_PARSE_FAILED", "语音识别结果无法解析，请改用文字提问")

    if not text:
        raise ASRError("ASR_EMPTY_RESULT", "这段录音里没有识别到清晰的话，请靠近麦克风再试")

    return {"text": text, "mode": "real"}


def asr_ready() -> bool:
    """是否具备语音识别的调用条件（Key 可用且音频处理工具存在）。"""
    if not config.AI_API_KEY:
        return False
    try:
        resolve_ffmpeg()
        return True
    except Exception:
        return False


# 便于调试时直接打印检查（不在业务代码中调用）
if __name__ == "__main__":
    print(json.dumps({"ready": asr_ready(), "model": ASR_MODEL}, ensure_ascii=False))
