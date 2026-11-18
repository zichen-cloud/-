# ============================================================
# Video Service：创作工坊 · 产品介绍视频合成（阶段三，独立服务模块）
# ------------------------------------------------------------
# 与图片服务（image_service）平级，两种模式由 backend/.env 的 VIDEO_MODE 控制：
#
#   VIDEO_MODE=demo（默认）
#       本地合成：Pillow 渲染 4 张分镜字幕卡 → FFmpeg 拼接成 10-15 秒短片。
#       素材 = 已生成的产品效果图 + AI/模板生成的分镜旁白字幕；
#       每一帧都带「演示视频 · 非真实AI生成」角标，绝不伪装成真实视频生成模型的产物。
#       FFmpeg 不可用时返回明确的中文报错，不伪造成功结果。
#
#   VIDEO_MODE=real
#       真实视频生成服务（预留，默认关闭）。接口位置已留好，见 _run_real()。
#
# 任务模型：generate-video 接口立即返回 taskId，合成在后台异步进行，
# 前端轮询 video-status/{taskId} 获取 status / progress / 失败原因 / 视频地址。
# ============================================================
import asyncio
import os
import re
import shutil
import subprocess
import tempfile
import uuid

import config
from services import image_service, tts_service, video_providers
from services.ai_service import ChatError, generate_video_script
from services.task_store import video_task_store

# 视频相关业务异常（路由层捕获后转成中文 JSON 错误）
class VideoError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# 演示视频统一声明（响应里也会带，前端展示共用同一口径）
VIDEO_DISCLAIMER = (
    "本视频由本地演示流程生成（FFmpeg 将产品效果图与字幕合成为短片），"
    "用于展示设计提案，不是真实视频生成模型的产物；"
    "片中非遗相关表述仅为设计层面的说明，历史源流与文化寓意请以权威资料为准。"
)

# 视频画幅：1280×720 横版，30fps
_W, _H = 1280, 720
_FPS = 30
_XFADE_S = 0.5  # 相邻分镜之间的淡入淡出时长（秒）
_AUDIO_GAP_S = 0.3  # 每句旁白前后的留白（秒），用于和分镜画面精确对齐

# 分镜卡渲染放大系数：以 1.5 倍分辨率（1920×1080）绘制字幕卡，
# 为 zoompan 镜头推近预留画质余量——推近是裁切放大，1.5 倍底图在
# 最大 1.15 倍推近下仍能保持输出 720p 的清晰度（文字不软化）。
_RS = 1.5
_RW, _RH = int(_W * _RS), int(_H * _RS)  # 渲染分辨率 1920×1080

# 字幕卡配色（与前端纸墨色系一致）
_PAPER = (250, 247, 241)
_INK = (42, 39, 34)
_INK_SOFT = (120, 112, 100)
_AMBER = (180, 116, 34)


def get_video_task(task_id: str) -> dict | None:
    """查询任务状态（路由层用）；已完成的历史任务重启后仍可查到。"""
    return video_task_store.get(task_id)


def list_video_tasks(limit: int | None = None) -> list[dict]:
    """按创建时间倒序返回历史视频任务（阶段五：任务持久化）。"""
    return video_task_store.list(limit or config.TASK_LIST_LIMIT)


def start_video_task(context: dict) -> str:
    """登记一个视频合成任务并立即返回 taskId，合成在后台异步执行。

    任务记录先落盘（data/tasks/{taskId}.json）再启动后台协程，
    因此后端重启后已完成/失败的记录仍可查询；重启时仍在排队/合成中的
    任务会在 task_store.load_all() 中被标记为「中断」。

    @param context {title, themeName, productTypeName, styleName,
                    proposalTitle, concept, elements, imageUrl, colorPalette,
                    audioSentenceUrls?, audioDurations?, audioSentences?, ...}
    """
    task_id = f"video_{uuid.uuid4().hex[:12]}"
    video_task_store.create(task_id, {
        "status": "queued",   # queued → processing → done / failed
        "progress": 0.05,
        "message": "已加入合成队列",
        "error": "",
        "videoUrl": "",
        "duration": 0,
        "mode": config.VIDEO_MODE if config.VIDEO_MODE in ("demo", "real") else "demo",
        "scriptMode": "",
        "script": None,
        "hasAudio": bool(context.get("audioSentenceUrls")),
        "voiceName": context.get("voiceName", ""),
        "speedName": context.get("speedName", ""),
    })
    asyncio.get_event_loop().create_task(_run_task(task_id, context))
    return task_id


def _update(task_id: str, **patch) -> None:
    video_task_store.update(task_id, **patch)


# ============================================================
# 一、FFmpeg 环境检测
# ============================================================

# 注意：Trae 编辑器自带的 ffmpeg 是裁剪版（缺少 concat/overlay/xfade 等），
# 不能用于视频合成，因此【不】把它列为兜底候选。
def _imageio_ffmpeg() -> str | None:
    """imageio-ffmpeg 包内置的完整 ffmpeg（pip install imageio-ffmpeg 即得）。"""
    try:
        import imageio_ffmpeg

        path = imageio_ffmpeg.get_ffmpeg_exe()
        return path if path and os.path.isfile(path) else None
    except Exception:
        return None


def resolve_ffmpeg() -> str:
    """定位 ffmpeg 可执行文件：FFMPEG_PATH 配置 → 系统 PATH → imageio-ffmpeg 内置副本。

    找不到时抛出带中文指引的 VideoError，绝不静默伪造成功。
    """
    candidates = []
    if config.FFMPEG_PATH:
        candidates.append(config.FFMPEG_PATH)
    path_hit = shutil.which("ffmpeg")
    if path_hit:
        candidates.append(path_hit)
    bundled = _imageio_ffmpeg()
    if bundled:
        candidates.append(bundled)

    for c in candidates:
        if c and os.path.isfile(c):
            return c

    raise VideoError(
        "FFMPEG_NOT_FOUND",
        "未找到可用的 FFmpeg，无法合成视频。可选方案（任选其一后重启后端）："
        "① 在后端虚拟环境运行 pip install imageio-ffmpeg（自带完整 ffmpeg）；"
        "② 安装 FFmpeg 并加入系统 PATH；"
        "③ 在 backend/.env 设置 FFMPEG_PATH 指向完整版 ffmpeg.exe"
        "（注意：Trae 自带的精简版 ffmpeg 缺少拼接/叠图滤镜，不可用）。",
    )


def _resolve_image_path(image_url: str) -> str | None:
    """把 /api/files/generated/xxx.png 形式的地址安全解析为本地路径（防目录穿越）。"""
    if not image_url:
        return None
    name = os.path.basename(image_url)
    if not name or "." not in name:
        return None
    path = os.path.join(config.GENERATED_DIR, name)
    return path if os.path.isfile(path) else None


# ============================================================
# 二、Demo 模式：Pillow 渲染分镜字幕卡
# ============================================================

def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    """按像素宽度把中文文本折行。"""
    lines, current = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(current)
            current = ""
            continue
        if draw.textlength(current + ch, font=font) > max_width and current:
            lines.append(current)
            current = ch
        else:
            current += ch
    if current:
        lines.append(current)
    return lines


def _demo_badge(draw, s: float = 1.0, width: int | None = None) -> None:
    """右上角「演示视频」角标：每一帧都带，明确区分真实生成结果。

    @param s 渲染放大系数（分镜卡按 1920×1080 绘制时 s=1.5）
    @param width 画布宽度，默认输出画幅 _W
    """
    label = "演示视频 · 非真实AI生成"
    font = image_service._font(int(24 * s))
    w = draw.textlength(label, font=font)
    pad_x, pad_y = 16 * s, 8 * s
    x0 = (width or _W) - w - pad_x * 2 - 32 * s
    y0 = 28 * s
    draw.rounded_rectangle(
        (x0, y0, x0 + w + pad_x * 2, y0 + 24 * s + pad_y * 2),
        radius=18 * s, fill=_AMBER,
    )
    draw.text((x0 + pad_x, y0 + pad_y - 1), label, font=font, fill=(255, 255, 255))


def _paste_product_card(img, draw, image_path: str | None, box: tuple) -> None:
    """把产品效果图放入指定区域（等比缩放 + 白卡衬底）。"""
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    draw.rounded_rectangle(box, radius=24, fill=(255, 255, 255), outline=(224, 216, 204), width=3)
    if not image_path:
        draw.text((x0 + 40, y0 + bh // 2 - 20), "（无产品图）",
                  font=image_service._font(32), fill=_INK_SOFT)
        return
    try:
        from PIL import Image
        prod = Image.open(image_path).convert("RGB")
        prod.thumbnail((bw - 48, bh - 48))
        px = x0 + (bw - prod.width) // 2
        py = y0 + (bh - prod.height) // 2
        img.paste(prod, (px, py))
    except Exception:
        draw.text((x0 + 40, y0 + bh // 2 - 20), "（产品图读取失败）",
                  font=image_service._font(32), fill=_INK_SOFT)


def _paste_cover(img, image_path: str, box: tuple) -> None:
    """把产品图等比放大裁切铺满指定区域（全屏背景用，cover 语义）。"""
    from PIL import Image
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    prod = Image.open(image_path).convert("RGB")
    scale = max(bw / prod.width, bh / prod.height)
    prod = prod.resize((int(prod.width * scale + 0.5), int(prod.height * scale + 0.5)), Image.LANCZOS)
    cx = (prod.width - bw) // 2
    cy = (prod.height - bh) // 2
    img.paste(prod.crop((cx, cy, cx + bw, cy + bh)), (x0, y0))


def _paste_detail_crop(img, draw, image_path: str | None, box: tuple) -> None:
    """工艺细节特写：裁切产品图中心 60% 区域放大放入卡片，突出纹样质感。"""
    from PIL import Image
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    draw.rounded_rectangle(box, radius=24, fill=(255, 255, 255), outline=(224, 216, 204), width=3)
    if not image_path:
        draw.text((x0 + 40, y0 + bh // 2 - 20), "（无产品图）",
                  font=image_service._font(32), fill=_INK_SOFT)
        return
    try:
        prod = Image.open(image_path).convert("RGB")
        cw, ch = int(prod.width * 0.6), int(prod.height * 0.6)
        cx, cy = (prod.width - cw) // 2, (prod.height - ch) // 2
        prod = prod.crop((cx, cy, cx + cw, cy + ch))
        prod.thumbnail((bw - 48, bh - 48), Image.LANCZOS)
        img.paste(prod, (x0 + (bw - prod.width) // 2, y0 + (bh - prod.height) // 2))
    except Exception:
        draw.text((x0 + 40, y0 + bh // 2 - 20), "（产品图读取失败）",
                  font=image_service._font(32), fill=_INK_SOFT)


def _render_segment_frame(
    dest: str,
    *,
    kind: str,             # opening | content | closing
    index: int,            # content 分镜序号（1 起）
    total: int,            # content 分镜总数
    scene: dict,           # {subtitle, narration}
    video_title: str,
    image_path: str | None,
    main_color: tuple,
    dark_color: tuple,
) -> None:
    """渲染一张 1920×1080 分镜字幕卡（1.5 倍底图，为 zoompan 推近预留画质）。

    版式差异化（五段叙事）：
      opening       → 居中大标题 + 中央产品亮相
      content 第1段（文化来源）→ 产品图全屏铺底 + 渐变压暗 + 左下大字（海报感）
      content 第2段（工艺细节）→ 左文案 + 右侧纹样特写（裁切放大）
      content 其他（现代生活）→ 左文案 + 右产品卡
      closing       → 品牌口号居中
    """
    from PIL import Image, ImageDraw

    s = _RS
    P = lambda v: int(v * s)                       # 坐标/尺寸缩放
    F = lambda size: image_service._font(int(size * s))  # 字号缩放

    img = Image.new("RGB", (_RW, _RH), _PAPER)
    d = ImageDraw.Draw(img)

    # 顶部品牌条 + 演示角标 + 底部装饰线（所有版式共用）
    d.text((P(48), P(36)), "非遗灵境 · 创作工坊", font=F(28), fill=_INK_SOFT)
    _demo_badge(d, s, _RW)
    d.rectangle((0, _RH - P(10), _RW, _RH), fill=main_color)

    if kind == "opening":
        title_font, sub_font = F(60), F(38)
        if image_path:
            _paste_product_card(img, d, image_path, (P(480), P(390), P(800), P(640)))
        tw = d.textlength(video_title, font=title_font)
        d.text(((_RW - tw) / 2, P(200)), video_title, font=title_font, fill=dark_color)
        sub = scene.get("subtitle", "")
        sw = d.textlength(sub, font=sub_font)
        d.text(((_RW - sw) / 2, P(310)), sub, font=sub_font, fill=main_color)
        tip, tip_font = "产品介绍短片", F(26)
        tiw = d.textlength(tip, font=tip_font)
        d.text(((_RW - tiw) / 2, P(590 if image_path else 660)), tip, font=tip_font, fill=_INK_SOFT)
    elif kind == "closing":
        brand_font = F(72)
        bw_ = d.textlength("非遗灵境", font=brand_font)
        d.text(((_RW - bw_) / 2, P(240)), "非遗灵境", font=brand_font, fill=dark_color)
        sub = scene.get("subtitle", "")
        sub_font = F(40)
        sw = d.textlength(sub, font=sub_font)
        d.text(((_RW - sw) / 2, P(380)), sub, font=sub_font, fill=main_color)
        note, note_font = "数字设计参考 · 与传统工艺实物有本质区别", F(26)
        nw = d.textlength(note, font=note_font)
        d.text(((_RW - nw) / 2, P(560)), note, font=note_font, fill=_INK_SOFT)
    elif kind == "content" and index == 1 and image_path:
        # —— 文化来源：全屏产品图铺底 + 自上而下渐变压暗 + 左下文案 ——
        try:
            _paste_cover(img, image_path, (0, 0, _RW, _RH))
            overlay = Image.new("L", (1, _RH))
            for y in range(_RH):
                # 上 25% 几乎透明 → 底部 85% 不透明深色，保证左下文字可读
                t = max(0.0, (y / _RH - 0.25) / 0.75)
                overlay.putpixel((0, y), int(220 * t))
            dark_layer = Image.new("RGB", (_RW, _RH), dark_color)
            img.paste(dark_layer, (0, 0), overlay.resize((_RW, _RH)))
            d = ImageDraw.Draw(img)
            _demo_badge(d, s, _RW)
            # 分镜序号胶囊
            chip, chip_font = f"{index:02d} / {total:02d}", F(26)
            cw = d.textlength(chip, font=chip_font)
            d.rounded_rectangle((P(80), P(430), P(80) + cw + P(32), P(430) + P(44)),
                                radius=P(22), fill=(255, 255, 255, 60))
            d.text((P(96), P(438)), chip, font=chip_font, fill=(250, 247, 241))
            sub_font = F(56)
            d.text((P(80), P(500)), scene.get("subtitle", "")[:14], font=sub_font, fill=(255, 255, 255))
            nar_font = F(30)
            lines = _wrap_text(d, scene.get("narration", ""), nar_font, P(700))[:3]
            y = P(590)
            for line in lines:
                d.text((P(80), y), line, font=nar_font, fill=(240, 235, 226))
                y += P(48)
        except Exception:
            # 全屏版式失败时降级为通用内容版式
            _render_content_card(img, d, P, F, index, total, scene, image_path, main_color, dark_color)
    elif kind == "content" and index == 2:
        # —— 工艺细节：左文案 + 右侧纹样特写（中心裁切放大）——
        _paste_detail_crop(img, d, image_path, (P(700), P(96), P(1190), P(586)))
        _render_content_text(d, P, F, index, total, scene, main_color, dark_color)
    else:
        # —— 现代生活等通用内容版式：左文案 + 右产品卡 ——
        _render_content_card(img, d, P, F, index, total, scene, image_path, main_color, dark_color)

    img.save(dest, format="PNG")


def _render_content_text(d, P, F, index: int, total: int, scene: dict,
                         main_color: tuple, dark_color: tuple) -> None:
    """内容分镜的左侧文案区（序号胶囊 + 大字字幕 + 折行旁白）。"""
    chip, chip_font = f"{index:02d} / {total:02d}", F(26)
    cw = d.textlength(chip, font=chip_font)
    d.rounded_rectangle((P(80), P(120), P(80) + cw + P(32), P(164)),
                        radius=P(20), fill=image_service._lighten(main_color, 0.75))
    d.text((P(96), P(128)), chip, font=chip_font, fill=dark_color)
    sub_font = F(54)
    d.text((P(80), P(210)), scene.get("subtitle", "")[:14], font=sub_font, fill=main_color)
    nar_font = F(32)
    lines = _wrap_text(d, scene.get("narration", ""), nar_font, P(560))[:5]
    y = P(320)
    for line in lines:
        d.text((P(80), y), line, font=nar_font, fill=_INK)
        y += P(52)


def _render_content_card(img, d, P, F, index: int, total: int, scene: dict,
                         image_path: str | None, main_color: tuple, dark_color: tuple) -> None:
    """通用内容版式：左文案 + 右产品卡。"""
    _paste_product_card(img, d, image_path, (P(700), P(96), P(1190), P(586)))
    _render_content_text(d, P, F, index, total, scene, main_color, dark_color)


# ============================================================
# 三、Demo 模式：FFmpeg 合成（分镜卡 + xfade 淡入淡出转场）
# ------------------------------------------------------------
# 每张分镜卡作为一个 -loop 1 -t <时长> 的静态图输入，
# 滤镜链先把每路统一成 1280×720@30fps，再用 xfade 串起 0.5 秒淡入淡出转场。
# （没用 concat demuxer：部分裁剪版 ffmpeg 不带它，多输入方式兼容性更好。）
# ============================================================

def _run_ffmpeg_with_progress(cmd: list, task_id: str, total_out: float) -> tuple[int, str]:
    """在线程内启动 FFmpeg 并解析 stdout 进度，返回 (exit_code, stderr_tail)。

    stderr 写入临时文件而不是管道：FFmpeg 在循环输入 + zoompan 场景下会
    持续输出告警，若先读 stdout、结束后再读 stderr，stderr 管道缓冲区
    （Windows 约 64KB）会被填满，FFmpeg 阻塞在写 stderr 上形成死锁。
    """
    stderr_file = tempfile.TemporaryFile()
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=stderr_file)
    try:
        if proc.stdout is not None:
            for line in iter(proc.stdout.readline, b""):
                text = line.decode("utf-8", "ignore").strip()
                if text.startswith("out_time_ms="):
                    try:
                        secs = int(text.split("=", 1)[1]) / 1_000_000
                        _update(
                            task_id,
                            progress=min(0.95, 0.4 + 0.55 * (secs / total_out)),
                            message=f"FFmpeg 合成中（{secs:.0f}/{total_out:.0f} 秒）",
                        )
                    except ValueError:
                        pass
    finally:
        rc = proc.wait()
    stderr_file.seek(0)
    stderr_tail = stderr_file.read().decode("utf-8", "ignore")[-300:]
    stderr_file.close()
    return rc, stderr_tail


async def _compose_demo(task_id: str, context: dict, script: dict) -> dict:
    """demo 合成主流程：渲染分镜卡 → xfade 转场拼接 → 输出 mp4。"""
    ffmpeg = resolve_ffmpeg()
    image_path = _resolve_image_path(context.get("imageUrl", ""))
    palette = context.get("colorPalette") or []
    colors = [image_service._hex_to_rgb(c.get("hex", "")) for c in palette[:3] if isinstance(c, dict)]
    while len(colors) < 3:
        colors.append((192, 57, 43))
    dark = sorted(colors, key=image_service._luminance)[0]
    main = image_service._ensure_deep(colors[0], dark)

    scenes = script["scenes"]
    n = len(scenes)
    # 按时长配置等比缩放分镜时长（分镜结构固定 2/4/4/2 ≈ 12 秒）——画面基础时长
    total_in = sum(float(s.get("seconds", 3)) for s in scenes) or 12.0
    scale = config.VIDEO_DURATION_S / total_in
    base_durations = [max(1.0, float(s.get("seconds", 3)) * scale) for s in scenes]

    # ---- 阶段四：有配音时按句长放宽分镜，并校验音频文件 ----
    audio_urls = context.get("audioSentenceUrls") or []
    audio_durs = context.get("audioDurations") or []
    audio_sentences = context.get("audioSentences") or []
    audio_paths: list[str] = []
    has_audio = bool(audio_urls)
    if has_audio:
        if len(audio_urls) != n or len(audio_durs) != n:
            raise VideoError(
                "AUDIO_INVALID",
                f"配音为 {len(audio_urls)} 句、时长数据 {len(audio_durs)} 条，"
                f"但视频有 {n} 个分镜，数量不一致，请重新生成配音后再合成",
            )
        for i, u in enumerate(audio_urls, 1):
            p = tts_service.resolve_audio_path(u)
            if p is None:
                raise VideoError(
                    "AUDIO_FILE_MISSING",
                    f"第 {i} 句配音文件不存在或已被清理，请重新生成配音后再合成有声视频",
                )
            audio_paths.append(p)
        # 音频比画面短时不拉长画面；音频比画面长时按句长放宽该镜（句前/句尾各留 0.3s）
        durations = [
            max(base, float(dur) + 2 * _AUDIO_GAP_S)
            for base, dur in zip(base_durations, audio_durs)
        ]
        total_out = sum(durations) - _XFADE_S * (n - 1)
        if total_out > config.VIDEO_WITH_AUDIO_MAX_S:
            raise VideoError(
                "AUDIO_TOO_LONG",
                f"按当前旁白合成约需 {total_out:.1f} 秒，超过短片上限 "
                f"{config.VIDEO_WITH_AUDIO_MAX_S:.0f} 秒。请精简旁白（总口播建议不超过 13 秒）"
                "后重新生成配音，再合成有声视频",
            )
    else:
        durations = base_durations
        total_out = sum(durations) - _XFADE_S * (n - 1)

    # 有配音时，用最终旁白文本覆盖分镜卡字幕，保证「听到的句子」与画面字幕一致
    render_scenes = scenes
    if has_audio and len(audio_sentences) == n:
        render_scenes = [dict(s) for s in scenes]
        for i, sentence in enumerate(audio_sentences):
            sentence = str(sentence).strip()
            if not sentence:
                continue
            if i == 0 or i == n - 1:
                # 开场 / 收尾卡只有居中副标题，直接显示该句口播
                render_scenes[i]["subtitle"] = sentence
            else:
                # 内容卡：大字短标题保留，正文区显示口播原句
                render_scenes[i]["narration"] = sentence

    # ---- 渲染 5 张分镜卡（1920×1080，为镜头推近预留 1.5 倍画质）----
    _update(task_id, message="正在绘制分镜字幕卡", progress=0.3)
    os.makedirs(config.VIDEO_DIR, exist_ok=True)
    stamp = uuid.uuid4().hex[:10]
    seg_files = []
    content_total = n - 2  # 去掉开场与收尾
    for i, scene in enumerate(render_scenes):
        kind = "opening" if i == 0 else "closing" if i == n - 1 else "content"
        dest = os.path.join(config.VIDEO_DIR, f"{stamp}_seg{i}.png")
        await asyncio.to_thread(
            _render_segment_frame,
            dest,
            kind=kind,
            index=i, total=content_total,
            scene=scene,
            video_title=script.get("videoTitle", ""),
            image_path=image_path if kind != "closing" else None,
            main_color=main, dark_color=dark,
        )
        seg_files.append(dest)
    _update(task_id, progress=0.4, message="正在启动 FFmpeg 合成")

    # ---- 多输入：每张分镜卡一个 -loop 1 -t <时长> 静态图输入（30fps 喂给 zoompan）----
    inputs: list[str] = []
    for p, d in zip(seg_files, durations):
        inputs += ["-framerate", str(_FPS), "-loop", "1", "-t", f"{d:.2f}", "-i", p]
    # 有声视频：4 句配音 mp3 作为额外输入（输入序号 n .. 2n-1）
    if has_audio:
        for p in audio_paths:
            inputs += ["-i", p]

    # ---- 视频滤镜链：每路先做 zoompan 镜头运动（推近/拉远交替），再 xfade 串接 ----
    # 分镜卡按 1920×1080 渲染（1.5 倍底图），zoompan 裁切放大到 1280×720 后
    # 画质无损；相邻分镜交替推近/拉远，模拟镜头呼吸感，避免静态 PPT 感。
    filters = []
    for i in range(n):
        if i % 2 == 0:
            zexpr = "min(1+0.0018*on,1.15)"   # 缓慢推近
        else:
            zexpr = "max(1.15-0.0018*on,1.0)"  # 缓慢拉远
        filters.append(
            f"[{i}:v]scale={_RW}:{_RH},fps={_FPS},"
            f"zoompan=z='{zexpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d=1:s={_W}x{_H}:fps={_FPS},format=yuv420p,setsar=1[s{i}]"
        )
    # 第 i 次转场的 offset = 前 i 段累计时长 - i × 转场时长
    acc = 0.0
    prev = "s0"
    for i in range(1, n):
        acc += durations[i - 1]
        offset = acc - _XFADE_S * i
        out_label = f"x{i}"
        filters.append(
            f"[{prev}][s{i}]xfade=transition=fade:duration={_XFADE_S}:offset={offset:.2f}[{out_label}]"
        )
        prev = out_label
    map_target = f"[{prev}]"

    # ---- 音频滤镜链（阶段四）----
    # xfade 时间轴上，第 i 镜的绝对起点 = 前 i 镜时长之和 - i×转场时长；
    # 该句旁白在镜内再延后 0.3s 起播。用 adelay 把 4 句放到各自起点，
    # amix 混成一条完整音轨（normalize=0 保证人声音量不被稀释），
    # 最后 atrim 到与视频完全等长——音频短不拉长，音频长已在前面按时长放宽画面。
    if has_audio:
        starts = []
        acc2 = 0.0
        for i in range(n):
            starts.append(acc2 - _XFADE_S * i)
            acc2 += durations[i]
        mix_labels = []
        for i in range(n):
            delay_ms = int(round((starts[i] + _AUDIO_GAP_S) * 1000))
            filters.append(
                f"[{n + i}:a]aresample=44100,aformat=channel_layouts=mono,"
                f"adelay={delay_ms}[av{i}]"
            )
            mix_labels.append(f"[av{i}]")
        filters.append(
            "".join(mix_labels)
            + f"amix=inputs={n}:duration=longest:normalize=0,"
            + f"volume=1.0,atrim=end={total_out:.3f},asetpts=N/SR/TB[aout]"
        )

    out_name = f"{stamp}.mp4"
    out_path = os.path.join(config.VIDEO_DIR, out_name)
    cmd = [
        ffmpeg, "-y",
        *inputs,
        "-filter_complex", ";".join(filters),
        "-map", map_target,
    ]
    if has_audio:
        # AAC 128kbps 人声清晰；-shortest 以视频/音频较短者为准兜底
        cmd += ["-map", "[aout]", "-c:a", "aac", "-b:a", "128k", "-shortest"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-progress", "pipe:1", "-nostats",
        out_path,
    ]

    # ---- 执行并解析进度（out_time_ms 实际单位是微秒） ----
    # 注意：uvicorn --reload 在 Windows 下使用 SelectorEventLoop，
    # 不支持 asyncio 子进程；改为线程内 subprocess.Popen，与事件循环解耦。
    rc, stderr_tail = await asyncio.to_thread(
        _run_ffmpeg_with_progress, cmd, task_id, total_out
    )

    # 清理分镜卡（只保留成片）
    for p in seg_files:
        try:
            os.remove(p)
        except OSError:
            pass

    if rc != 0 or not os.path.isfile(out_path):
        raise VideoError(
            "FFMPEG_FAILED",
            f"FFmpeg 合成失败（退出码 {rc}）。{stderr_tail.strip() or '请检查 FFmpeg 是否完整可用'}",
        )

    return {
        "videoUrl": f"/api/files/videos/{out_name}",
        "duration": round(total_out, 1),
        "mode": "demo",
        "hasAudio": has_audio,
    }


# ============================================================
# 四、Real 模式预留：真实视频生成服务（默认关闭）
# ------------------------------------------------------------
# 计划接入文生视频服务（如百炼 wanx2.1-t2v 系列，异步任务 + 轮询，模式与
# image_service 的万相调用一致）。开通后在 backend/.env 设置：
#   VIDEO_MODE=real
#   VIDEO_API_KEY=...（不填则复用 AI_API_KEY）
#   VIDEO_MODEL=wanx2.1-t2v-turbo
# 未接入前调用会返回明确的中文错误，绝不回退伪装成 demo 结果。
# ============================================================

async def _run_real(task_id: str, context: dict, script: dict) -> dict:
    """真实视频生成：通过 Provider 适配层走「提交 → 轮询 → 下载」异步编排。

    任务状态更新 / 持久化 / 前端轮询契约与 demo 模式完全一致；
    供应商相关的 HTTP 细节全部隔离在 services/video_providers.py。
    当前 Provider 的 submit/poll 为预留骨架（抛 VIDEO_REAL_NOT_READY），
    接入后本函数无需修改即可运行。

    注意：真实模型成片时长由模型决定，与四句式 TTS 旁白的时长模型尚不匹配；
    「真实成片 + 配音混音」作为接入真实模型后的后续项（download 后可复用
    demo 路径的 adelay/amix 音频链做后处理），此处暂返回无声真实成片。
    """
    provider = video_providers.get_video_provider()
    if not config.is_real_video_mode() or not provider.is_configured():
        raise VideoError(
            "VIDEO_REAL_NOT_READY",
            "真实视频生成服务尚未就绪：请确认已开通视频生成模型，"
            "并在 backend/.env 中设置 VIDEO_MODE=real 与有效的 VIDEO_API_KEY。"
            "当前请使用 VIDEO_MODE=demo 的本地合成。",
        )

    _update(task_id, progress=0.30, message="正在提交真实视频生成任务")
    prompt = video_providers.build_prompt(context, script)
    try:
        remote_task_id = await provider.submit(context, script, prompt)

        # 轮询直到成功 / 失败 / 总超时
        loop = asyncio.get_event_loop()
        started = loop.time()
        while True:
            await asyncio.sleep(config.VIDEO_POLL_INTERVAL_S)
            st = await provider.poll(remote_task_id)

            if st.status == "succeeded" and st.video_url:
                break
            if st.status == "failed":
                raise VideoError(
                    "VIDEO_GENERATE_FAILED",
                    st.raw.get("message") if isinstance(st.raw, dict) else ""
                    or "真实视频生成失败，请稍后重试或更换画面描述",
                )

            elapsed = loop.time() - started
            if elapsed > config.VIDEO_TASK_TIMEOUT_S:
                raise VideoError(
                    "VIDEO_TIMEOUT",
                    f"真实视频生成超过 {int(config.VIDEO_TASK_TIMEOUT_S)} 秒仍未完成，"
                    "请稍后重试（可在「历史任务」中查看任务状态）",
                )
            # 供应商不回进度时，在 0.32~0.9 之间按耗时线性估算
            est = min(0.9, 0.32 + 0.58 * elapsed / config.VIDEO_TASK_TIMEOUT_S)
            _update(task_id, progress=max(est, st.progress), message="真实模型正在生成画面")

        _update(task_id, progress=0.92, message="正在下载视频成片")
        out_name = f"{uuid.uuid4().hex[:10]}.mp4"
        out_path = os.path.join(config.VIDEO_DIR, out_name)
        await provider.download(st.video_url, out_path)
        duration = _probe_media_duration(out_path)

        return {
            "videoUrl": f"/api/files/videos/{out_name}",
            "duration": round(duration, 1),
            "mode": "real",
            "hasAudio": False,  # 见函数注释：真实成片混音为接入后的后续项
        }
    except video_providers.VideoProviderError as e:
        raise VideoError(e.code, e.message) from e


def _probe_media_duration(path: str) -> float:
    """用 ffmpeg -i 的输出解析媒体时长（视频/音频通用，失败返回 0）。"""
    try:
        ffmpeg = resolve_ffmpeg()
        proc = subprocess.run(
            [ffmpeg, "-hide_banner", "-i", path],
            capture_output=True, text=True, timeout=30,
        )
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr or "")
        if not m:
            return 0.0
        h, mm, ss = m.groups()
        return int(h) * 3600 + int(mm) * 60 + float(ss)
    except Exception:
        return 0.0


# ============================================================
# 五、任务主流程
# ============================================================

async def _run_task(task_id: str, context: dict) -> None:
    if get_video_task(task_id) is None:
        return
    try:
        # 1. 生成脚本文案（标题 / 介绍 / 分镜旁白字幕）
        _update(task_id, status="processing", progress=0.15, message="正在生成视频文案与分镜")
        try:
            script, script_mode = await generate_video_script(context)
        except ChatError as e:
            raise VideoError(e.code, e.message)
        _update(task_id, script=script, scriptMode=script_mode, progress=0.25)

        # 2. 合成视频
        if config.is_real_video_mode():
            result = await _run_real(task_id, context, script)
        else:
            result = await _compose_demo(task_id, context, script)

        _update(
            task_id,
            status="done",
            progress=1.0,
            message="合成完成",
            videoUrl=result["videoUrl"],
            duration=result["duration"],
            mode=result["mode"],
            hasAudio=result.get("hasAudio", False),
        )
    except VideoError as e:
        _update(task_id, status="failed", error=e.message, message="合成失败")
    except Exception:
        _update(task_id, status="failed", error="视频合成出现异常，请稍后重试", message="合成失败")
