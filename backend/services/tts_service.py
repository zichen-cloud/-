# ============================================================
# TTS Service：创作工坊 · AI 配音文字转语音（阶段四，独立服务模块）
# ------------------------------------------------------------
# 对接阿里云百炼「Qwen-TTS 非实时语音合成」：
#   POST {TTS_BASE_URL}/api/v1/services/aigc/multimodal-generation/generation
#   body: {"model": "qwen3-tts-flash",
#          "input": {"text": "...", "voice": "Serena", "language_type": "Chinese"}}
#   -> output.audio.url（音频文件地址，24 小时有效）→ 立刻下载转存到本地
#
# 设计原则（与 image_service / video_service 一致）：
#   1. API Key 只从后端环境变量读取，绝不出现在前端；
#   2. 未配置 Key 时直接抛出明确的中文错误，绝不伪造音频生成成功；
#   3. 逐句独立调用（单句失败不污染其他句），串行提交避免限流；
#   4. 语速不依赖模型参数：下载后用 FFmpeg atempo 统一调速并转成 mp3；
#   5. 每句音频单独保存，供视频合成时按分镜精确对齐。
# ============================================================
import asyncio
import os
import re
import shutil
import uuid

import httpx

import config


class TTSError(Exception):
    """TTS 业务异常（路由层捕获后转成中文 JSON 错误）。"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# 音色表：前端选择项 → 百炼系统音色 voice id（2026-09 官方音色列表核实）
#   gentle-female 温柔女声：Serena 苏瑶，"温柔小姐姐"
#   calm-male     沉稳男声：Neil 阿闻，字正腔圆的新闻主持人，适合产品/纪录片解说
#   natural-talk  自然讲解：Cherry 芊悦，阳光积极、亲切自然
VOICES = {
    "gentle-female": {"voiceId": "Serena", "name": "温柔女声", "desc": "苏瑶 · 温柔亲切"},
    "calm-male": {"voiceId": "Neil", "name": "沉稳男声", "desc": "阿闻 · 字正腔圆的解说腔"},
    "natural-talk": {"voiceId": "Cherry", "name": "自然讲解", "desc": "芊悦 · 阳光亲切"},
}
DEFAULT_VOICE = "gentle-female"

# 语速表：前端选择项 → FFmpeg atempo 系数（保持音高不变，1.0 为原速）
SPEEDS = {
    "slow": {"atempo": 0.9, "name": "慢速"},
    "normal": {"atempo": 1.0, "name": "正常"},
    "fast": {"atempo": 1.12, "name": "稍快"},
}
DEFAULT_SPEED = "normal"

# 单句口播长度上限（按实测朗读时长反推：约 4 字/秒，单句 ≤14 字才能保证
# 4 句加留白后成片不超过 16 秒；超长句在这里被中文错误拦下，引导用户精简）
MAX_SENTENCE_CHARS = 14

# 统计"实际会被朗读出来的字数"时剔除的标点与空白（与旁白 prompt 的口径一致）
_PUNCT_RE = re.compile(r"[\s，。！？、；：,.!?;:…—“”‘’\"'（）()【】《》<>·\-]")


def _spoken_len(text: str) -> int:
    """实际朗读音节数：剔除空白与标点后的字符数。"""
    return len(_PUNCT_RE.sub("", text))

_TTS_ENDPOINT = "/api/v1/services/aigc/multimodal-generation/generation"


def ensure_dirs() -> None:
    os.makedirs(config.AUDIO_DIR, exist_ok=True)


def resolve_audio_path(url_or_name: str) -> str | None:
    """把 /api/files/audio/xxx.mp3 形式的地址安全解析为本地路径（防目录穿越）。"""
    if not url_or_name:
        return None
    name = os.path.basename(url_or_name)
    if not name or "/" in name or "\\" in name:
        return None
    path = os.path.join(config.AUDIO_DIR, name)
    return path if os.path.isfile(path) else None


def _ffmpeg_exe() -> str:
    """定位完整版 ffmpeg（与 video_service 同一查找顺序）。"""
    candidates = []
    if config.FFMPEG_PATH:
        candidates.append(config.FFMPEG_PATH)
    hit = shutil.which("ffmpeg")
    if hit:
        candidates.append(hit)
    try:
        import imageio_ffmpeg

        p = imageio_ffmpeg.get_ffmpeg_exe()
        if p and os.path.isfile(p):
            candidates.append(p)
    except Exception:
        pass
    for c in candidates:
        if c and os.path.isfile(c):
            return c
    raise TTSError(
        "FFMPEG_NOT_FOUND",
        "未找到可用的 FFmpeg，无法处理配音音频。请在后端虚拟环境运行 "
        "pip install imageio-ffmpeg，或安装 FFmpeg 并加入系统 PATH。",
    )


async def _probe_duration(path: str) -> float:
    """用 ffmpeg -i 解析音频时长（秒）；不依赖 ffprobe 是否存在。"""
    proc = await asyncio.create_subprocess_exec(
        _ffmpeg_exe(), "-hide_banner", "-i", path,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    text = stderr.decode("utf-8", "ignore")
    m = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", text)
    if not m:
        return 0.0
    h, mm, ss = m.groups()
    return int(h) * 3600 + int(mm) * 60 + float(ss)


async def _call_tts_api(client: httpx.AsyncClient, text: str, voice_id: str) -> str:
    """调用百炼 Qwen-TTS 非实时接口，返回音频临时 URL（24 小时有效）。"""
    payload = {
        "model": config.TTS_MODEL,
        "input": {
            "text": text,
            "voice": voice_id,
            "language_type": "Chinese",
        },
    }
    headers = {"Authorization": f"Bearer {config.TTS_API_KEY}"}
    try:
        resp = await client.post(
            f"{config.TTS_BASE_URL}{_TTS_ENDPOINT}",
            json=payload,
            headers=headers,
        )
    except httpx.TimeoutException:
        raise TTSError("TTS_TIMEOUT", f"语音合成超时（超过 {config.TTS_TIMEOUT_S} 秒），请稍后重试")
    except httpx.RequestError:
        raise TTSError(
            "TTS_CONNECT_FAILED",
            "无法连接语音合成服务，请检查网络或 backend/.env 中的 TTS_BASE_URL 是否正确",
        )

    if resp.status_code != 200:
        detail = ""
        try:
            detail = (resp.json().get("message") or "")[:160]
        except Exception:
            detail = (resp.text or "")[:160]
        if resp.status_code == 401:
            raise TTSError("TTS_UNAUTHORIZED", "语音服务返回 401：API Key 无效或已过期，请检查 backend/.env 中的 TTS_API_KEY / AI_API_KEY")
        if resp.status_code == 404:
            raise TTSError("TTS_NOT_FOUND", f"语音服务返回 404：模型「{config.TTS_MODEL}」或音色不可用，请检查配置或是否已开通该模型")
        if resp.status_code == 429:
            raise TTSError("TTS_RATE_LIMITED", "语音服务返回 429：请求过于频繁或账户额度不足，请稍后再试")
        if resp.status_code == 400:
            raise TTSError("TTS_BAD_REQUEST", f"语音服务拒绝了请求：{detail or '请检查文本与音色参数'}")
        raise TTSError("TTS_HTTP_ERROR", f"语音服务返回错误（HTTP {resp.status_code}）：{detail}")

    try:
        data = resp.json()
        audio_url = data["output"]["audio"]["url"]
        if not audio_url:
            # 个别错误以 200 返回但带 code/message
            msg = data.get("message") or "语音服务未返回音频地址"
            raise TTSError("TTS_EMPTY_RESULT", msg)
        return audio_url
    except TTSError:
        raise
    except (ValueError, KeyError, TypeError):
        raise TTSError("TTS_PARSE_FAILED", "语音服务返回内容无法解析，请稍后重试")


async def _download_audio(client: httpx.AsyncClient, url: str, dest: str) -> None:
    """下载 TTS 返回的临时音频地址到本地（跟随 OSS 重定向）。"""
    try:
        resp = await client.get(url, follow_redirects=True)
    except httpx.RequestError:
        raise TTSError("TTS_DOWNLOAD_FAILED", "配音音频下载失败（网络异常），请稍后重试")
    if resp.status_code != 200 or not resp.content:
        raise TTSError("TTS_DOWNLOAD_FAILED", f"配音音频下载失败（HTTP {resp.status_code}），请稍后重试")
    with open(dest, "wb") as f:
        f.write(resp.content)


async def _transcode_with_speed(src: str, dest: str, atempo: float) -> None:
    """用 FFmpeg 统一转成 44.1kHz 单声道 mp3，并按 atempo 调整语速（保持音高）。"""
    # atempo 单级有效范围 0.5~100；0.9/1.0/1.12 均在范围内
    af = f"atempo={atempo:.3f}" if abs(atempo - 1.0) > 1e-3 else "anull"
    proc = await asyncio.create_subprocess_exec(
        _ffmpeg_exe(), "-y", "-i", src,
        "-af", af, "-ar", "44100", "-ac", "1",
        "-c:a", "libmp3lame", "-b:a", "128k",
        dest,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0 or not os.path.isfile(dest):
        tail = stderr.decode("utf-8", "ignore")[-200:]
        raise TTSError("TTS_AUDIO_PROCESS_FAILED", f"配音音频处理失败：{tail.strip() or 'FFmpeg 转码异常'}")


async def synthesize_sentences(sentences: list[str], voice_key: str, speed_key: str) -> dict:
    """逐句合成配音并保存为本地 mp3。

    @param sentences 旁白句数组（与视频分镜一一对应）
    @param voice_key VOICES 中的键
    @param speed_key SPEEDS 中的键
    @return {audioId, sentenceUrls, durations, totalDuration, voice, voiceName, speed, speedName, mode}
    """
    # ---- 前置校验：未配置 Key 绝不伪造音频 ----
    if not config.is_tts_ready():
        raise TTSError(
            "TTS_NOT_CONFIGURED",
            "后端尚未配置真实语音合成服务（TTS）。请在 backend/.env 中填写 TTS_API_KEY"
            "（或填写已开通 Qwen-TTS 的 AI_API_KEY）后重启后端；"
            "当前可先用「试听旁白」听浏览器朗读效果，但无法生成可合成进视频的配音。",
        )

    voice = VOICES.get(voice_key)
    if voice is None:
        raise TTSError("TTS_BAD_VOICE", f"不支持的音色：{voice_key}，可选：{', '.join(VOICES)}")
    speed = SPEEDS.get(speed_key)
    if speed is None:
        raise TTSError("TTS_BAD_SPEED", f"不支持的语速：{speed_key}，可选：{', '.join(SPEEDS)}")

    cleaned = [s.strip() for s in sentences]
    if not cleaned or any(not s for s in cleaned):
        raise TTSError("TTS_EMPTY_TEXT", "每一句旁白都需要填写内容后再生成配音")
    for i, s in enumerate(cleaned, 1):
        n = _spoken_len(s)
        if n > MAX_SENTENCE_CHARS:
            raise TTSError(
                "TTS_TEXT_TOO_LONG",
                f"第 {i} 句旁白有 {n} 个字（不含标点），超过单句上限 {MAX_SENTENCE_CHARS} 字。"
                "短片每句建议 6-12 字，请精简后再生成配音",
            )

    ensure_dirs()
    stamp = uuid.uuid4().hex[:10]
    urls, durations = [], []

    # 逐句独立调用 + 串行，避免百炼限流；单句失败即整体失败并指明第几句
    async with httpx.AsyncClient(timeout=config.TTS_TIMEOUT_S) as client:
        for i, text in enumerate(cleaned, 1):
            try:
                audio_url = await _call_tts_api(client, text, voice["voiceId"])
                raw_path = os.path.join(config.AUDIO_DIR, f"{stamp}_raw{i}")
                mp3_name = f"{stamp}_s{i}.mp3"
                mp3_path = os.path.join(config.AUDIO_DIR, mp3_name)
                await _download_audio(client, audio_url, raw_path)
                await _transcode_with_speed(raw_path, mp3_path, speed["atempo"])
                dur = await _probe_duration(mp3_path)
                if dur <= 0.1:
                    raise TTSError("TTS_AUDIO_PROCESS_FAILED", f"第 {i} 句配音时长异常，请重新生成")
            finally:
                # 原始下载件用后即删，只保留转码后的 mp3
                raw_path = os.path.join(config.AUDIO_DIR, f"{stamp}_raw{i}")
                if os.path.exists(raw_path):
                    try:
                        os.remove(raw_path)
                    except OSError:
                        pass

            urls.append(f"/api/files/audio/{mp3_name}")
            durations.append(round(dur, 2))
            # 句间小间隔，降低触发限流的概率
            if i < len(cleaned):
                await asyncio.sleep(0.4)

    return {
        "audioId": stamp,
        "sentenceUrls": urls,
        "durations": durations,
        "totalDuration": round(sum(durations), 2),
        "voice": voice_key,
        "voiceName": voice["name"],
        "speed": speed_key,
        "speedName": speed["name"],
        "mode": "real",
    }


# ============================================================
# 数字传承人语音（阶段二新增）
# ------------------------------------------------------------
# 与"视频旁白"不同：数字人说的是完整的一句话/一段话，不适用 14 字上限，
# 因此这里按标点切分为 ≤60 字的播报段，逐段合成后返回多段音频，
# 前端按顺序播放，实现"边说边动"的说话状态。
# ============================================================
SPEECH_MAX_SEGMENT = 60  # 单段播报字数上限（按朗读节奏，约 12-15 秒）


def _split_speech(text: str) -> list[str]:
    """把一段话按中文标点切成适合朗读的短段（每段 ≤ SPEECH_MAX_SEGMENT 字）。"""
    text = (text or "").strip()
    if not text:
        return []
    parts = re.split(r"(?<=[。！？；!?;])", text)
    segments, buf = [], ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(buf) + len(part) <= SPEECH_MAX_SEGMENT:
            buf += part
        else:
            if buf:
                segments.append(buf)
            # 单句本身超长时按逗号再切，避免超长段被服务拒绝
            while len(part) > SPEECH_MAX_SEGMENT:
                cut = max(part.rfind("，", 0, SPEECH_MAX_SEGMENT), part.rfind(",", 0, SPEECH_MAX_SEGMENT))
                cut = cut if cut > 10 else SPEECH_MAX_SEGMENT
                segments.append(part[:cut + 1])
                part = part[cut + 1:]
            buf = part
    if buf:
        segments.append(buf)
    return segments[:6]  # 单次最多 6 段，避免回答过长导致等待过久


async def _synthesize_segment(
    client: httpx.AsyncClient,
    text: str,
    voice_id: str,
    stamp: str,
    index: int,
    sem: asyncio.Semaphore,
) -> tuple[str, float]:
    """合成单个播报段（带一次重试），返回 (本地地址, 时长)。

    并发上限由 sem 控制，避免一次性请求过多触发上游限流；
    429 / 5xx / 超时属于临时错误，重试一次能显著减少"点了没声音"的情况。
    """
    async with sem:
        last_error: TTSError | None = None
        for attempt in range(2):
            raw_path = os.path.join(config.AUDIO_DIR, f"{stamp}_raw{index}")
            mp3_name = f"{stamp}_v{index}.mp3"
            mp3_path = os.path.join(config.AUDIO_DIR, mp3_name)
            try:
                audio_url = await _call_tts_api(client, text, voice_id)
                await _download_audio(client, audio_url, raw_path)
                # 传承人语音保持原速，避免变速造成的机械感
                await _transcode_with_speed(raw_path, mp3_path, 1.0)
                dur = await _probe_duration(mp3_path)
                if dur <= 0.1:
                    raise TTSError("TTS_AUDIO_PROCESS_FAILED", "语音合成结果时长异常，请重试")
                return f"/api/files/audio/{mp3_name}", round(dur, 2)
            except TTSError as e:
                last_error = e
                retryable = e.code in (
                    "TTS_RATE_LIMITED", "TTS_HTTP_ERROR", "TTS_TIMEOUT",
                    "TTS_DOWNLOAD_FAILED", "TTS_PARSE_FAILED",
                )
                if retryable and attempt == 0:
                    await asyncio.sleep(0.8)
                    continue
                raise
            finally:
                if os.path.exists(raw_path):
                    try:
                        os.remove(raw_path)
                    except OSError:
                        pass
        raise last_error or TTSError("TTS_HTTP_ERROR", "语音合成失败，请重试")


async def synthesize_speech(text: str, voice_key: str = DEFAULT_VOICE) -> dict:
    """数字传承人朗读：一段话 → 多段 mp3。

    多段并行合成（并发 2），并按原顺序返回，既降低等待时间，
    也保证前端按段落顺序播放不会串句。

    @return {audioId, segmentUrls, durations, totalDuration, voice, voiceName, mode}
    """
    if not config.is_tts_ready():
        raise TTSError(
            "TTS_NOT_CONFIGURED",
            "语音合成服务未配置，数字传承人暂时只能用文字与你交流。"
            "请在 backend/.env 填写 TTS_API_KEY（或已开通 Qwen-TTS 的 AI_API_KEY）后重启后端。",
        )
    voice = VOICES.get(voice_key)
    if voice is None:
        raise TTSError("TTS_BAD_VOICE", f"不支持的音色：{voice_key}")

    segments = _split_speech(text)
    if not segments:
        raise TTSError("TTS_EMPTY_TEXT", "没有可朗读的内容")

    ensure_dirs()
    stamp = uuid.uuid4().hex[:10]
    sem = asyncio.Semaphore(2)
    async with httpx.AsyncClient(timeout=config.TTS_TIMEOUT_S) as client:
        results = await asyncio.gather(
            *[
                _synthesize_segment(client, seg, voice["voiceId"], stamp, i, sem)
                for i, seg in enumerate(segments, 1)
            ]
        )

    urls = [url for url, _ in results]
    durations = [dur for _, dur in results]
    return {
        "audioId": stamp,
        "segmentUrls": urls,
        "durations": durations,
        "totalDuration": round(sum(durations), 2),
        "voice": voice_key,
        "voiceName": voice["name"],
        "mode": "real",
    }
