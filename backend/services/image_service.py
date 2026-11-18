# ============================================================
# Image Service：创作工坊 · 产品效果图生成（独立服务模块）
# ------------------------------------------------------------
# 与聊天用的文本模型完全分开，两种模式由 backend/.env 的 IMAGE_MODE 控制：
#
#   IMAGE_MODE=demo（默认）
#       用本地 Pillow 绘制带「演示图」水印的占位图。
#       零成本、不联网、绝不伪装成 AI 真实生成。
#
#   IMAGE_MODE=real
#       调用阿里云百炼「通义万相」文生图（wanx2.1-t2i-turbo 等）。
#       万相是【异步任务】接口：先创建任务拿 task_id，再轮询任务状态，
#       成功后返回的图片 URL 只有 24 小时有效期，所以这里会立刻下载转存到
#       backend/storage/generated/，前端始终访问我们自己转存的地址。
#
# 安全：参考图上传经过 类型白名单 → PIL 结构校验 → 尺寸阈值 → 重编码剥离元数据。
# ============================================================
import asyncio
import io
import os
import uuid
from datetime import datetime

import httpx
from PIL import Image, ImageDraw, ImageFont

import config

# 图片相关业务异常（路由层捕获后转成中文 JSON 错误）
class ImageError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# 演示图统一声明（响应里也会带，前端角标/免责声明共用同一口径）
DEMO_IMAGE_NOTE = "演示图 · 非真实 AI 生成"
IMAGE_DISCLAIMER = (
    "本效果图为 AI 辅助生成的数字设计参考（demo 模式下为带水印的本地演示图），"
    "与非遗传承人以传统技艺手工完成的工艺实物有本质区别；"
    "它不代表任何非遗项目的官方设计、授权或鉴定结果，传统元素的历史源流与文化寓意请以权威资料为准。"
)

# 参考图尺寸阈值（防止超大图 / 解压炸弹）
MIN_SIDE = 64
MAX_SIDE = 8000


def ensure_dirs() -> None:
    """确保存储目录存在（应用启动时调用一次即可）。"""
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
    os.makedirs(config.GENERATED_DIR, exist_ok=True)


# ============================================================
# 一、参考图上传（校验 + 重编码）
# ============================================================

def save_reference_image(contents: bytes, content_type: str) -> dict:
    """校验并保存用户上传的参考图，重编码为 PNG（顺带剥离 EXIF 等元数据）。

    @return {referenceId, url, width, height}
    """
    if not contents:
        raise ImageError("EMPTY_FILE", "上传的文件是空的，请重新选择图片")

    # 1. PIL 结构校验：verify() 校验文件头与编码，重新 open + load() 真正解码像素
    try:
        checker = Image.open(io.BytesIO(contents))
        checker.verify()
        im = Image.open(io.BytesIO(contents))
        im.load()
    except Exception:
        raise ImageError("INVALID_IMAGE", "文件不是有效的图片（可能已损坏或伪装成图片），请更换后重试")

    # 2. 像素尺寸阈值
    width, height = im.size
    if width < MIN_SIDE or height < MIN_SIDE:
        raise ImageError("IMAGE_TOO_SMALL", f"图片尺寸过小（边长至少 {MIN_SIDE} 像素），请更换更清晰的参考图")
    if width > MAX_SIDE or height > MAX_SIDE:
        raise ImageError("IMAGE_TOO_LARGE", f"图片尺寸过大（边长不能超过 {MAX_SIDE} 像素），请压缩后再上传")

    # 3. 统一转成 RGB/RGBA 后重编码为 PNG（剥离全部元数据，P/CMYK 等模式也能正常存）
    if im.mode not in ("RGB", "RGBA", "L"):
        im = im.convert("RGBA")

    reference_id = f"ref_{uuid.uuid4().hex}.png"
    dest = os.path.join(config.UPLOAD_DIR, reference_id)
    im.save(dest, format="PNG", optimize=True)

    return {
        "referenceId": reference_id,
        "url": f"/api/files/uploads/{reference_id}",
        "width": width,
        "height": height,
    }


def resolve_reference_path(reference_id: str) -> str | None:
    """把前端回传的 referenceId 安全地解析为服务器路径（防目录穿越）。"""
    if not reference_id:
        return None
    # 只取文件名部分，拒绝任何带路径分隔符的输入
    safe_name = os.path.basename(reference_id)
    if safe_name != reference_id or not safe_name.startswith("ref_"):
        raise ImageError("INVALID_REFERENCE", "参考图标识无效，请重新上传参考图")
    path = os.path.join(config.UPLOAD_DIR, safe_name)
    if not os.path.isfile(path):
        raise ImageError("REFERENCE_NOT_FOUND", "参考图已过期或不存在，请重新上传")
    return path


# ============================================================
# 二、Demo 模式：本地绘制带水印的演示效果图
# ============================================================

# Windows 常见中文字体（按优先级尝试），都找不到时退回 Pillow 默认字体
_FONT_CANDIDATES = (
    "C:/Windows/Fonts/msyh.ttc",    # 微软雅黑
    "C:/Windows/Fonts/simhei.ttf",  # 黑体
    "C:/Windows/Fonts/simsun.ttc",  # 宋体
)
_font_cache: dict[int, ImageFont.FreeTypeFont | ImageFont.ImageFont] = {}


def _font(size: int):
    """按字号加载字体（带缓存）。"""
    if size in _font_cache:
        return _font_cache[size]
    for path in _FONT_CANDIDATES:
        if os.path.isfile(path):
            try:
                font = ImageFont.truetype(path, size)
                _font_cache[size] = font
                return font
            except Exception:
                continue
    font = ImageFont.load_default()
    _font_cache[size] = font
    return font


def _hex_to_rgb(hex_color: str, fallback: tuple = (192, 57, 43)) -> tuple:
    try:
        h = hex_color.lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return fallback


def _lighten(rgb: tuple, ratio: float = 0.82) -> tuple:
    """把颜色向白色混合，得到浅色版本（用于背景/色块）。"""
    return tuple(int(c + (250 - c) * ratio) for c in rgb)


def _mix(c1: tuple, c2: tuple, t: float) -> tuple:
    """把 c1 向 c2 混合（t 为 c2 的占比，0~1）。"""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def _luminance(rgb: tuple) -> float:
    """感知明度（0~255，越小越深），用来保证文字/底色有足够对比。"""
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def _ensure_deep(rgb: tuple, anchor: tuple, ceiling: int = 185) -> tuple:
    """颜色过浅时向深色 anchor 混合，保证作为装饰/文字时仍看得清。"""
    if _luminance(rgb) <= ceiling:
        return rgb
    return _mix(rgb, anchor, 0.5)


def _draw_triangle_band(draw: ImageDraw.ImageDraw, y: int, color: tuple, width: int) -> None:
    """画一条小三角锯齿装饰带（呼应剪纸锯齿纹的形式语言，仅作装饰）。"""
    step = 36
    for x in range(0, width + step, step):
        draw.polygon([(x, y), (x + step // 2, y + 14), (x + step, y)], fill=color)


def _render_demo_image(
    dest: str,
    *,
    index: int,
    theme_name: str,
    product_name: str,
    style_name: str,
    palette: list[dict],
    reference_path: str | None,
) -> None:
    """绘制一张 1024×1024 的演示提案图，带明显水印，绝不与真实生成混淆。"""
    W = H = 1024
    raw_colors = [_hex_to_rgb(c.get("hex", "")) for c in palette[:3]]
    while len(raw_colors) < 3:
        raw_colors.append((192, 57, 43))
    # 按明度排序：dark 最深（用于文字与水印条，保证对比），pale 最浅
    by_light = sorted(raw_colors, key=_luminance)
    dark = by_light[0]
    # 主装饰色：模型给的主色若太浅，则向深色靠拢，避免装饰块消失在白底上
    main = _ensure_deep(raw_colors[0], dark)
    sub = _ensure_deep(raw_colors[1], dark, ceiling=200)

    img = Image.new("RGB", (W, H), (250, 247, 241))
    d = ImageDraw.Draw(img)

    # ---- 三种差异化版式布局（让 3 张演示提案看起来不一样） ----
    layout = index % 3
    if layout == 0:
        # 布局一：上方大圆 + 侧方小圆
        d.ellipse((250, 90, 774, 614), fill=_lighten(main, 0.55))
        d.ellipse((120, 300, 300, 480), fill=_lighten(sub, 0.35))
        d.ellipse((720, 480, 940, 700), fill=_lighten(dark, 0.7))
        _draw_triangle_band(d, 640, main, W)
    elif layout == 1:
        # 布局二：对角色块
        d.rectangle((0, 0, 470, 470), fill=_lighten(main, 0.62))
        d.ellipse((560, 120, 950, 510), fill=_lighten(sub, 0.35))
        d.rectangle((90, 560, 470, 940), fill=_lighten(dark, 0.72))
        _draw_triangle_band(d, 500, sub, W)
    else:
        # 布局三：横向色带 + 居中圆环
        d.rectangle((0, 120, W, 250), fill=_lighten(main, 0.55))
        d.rectangle((0, 720, W, 850), fill=_lighten(sub, 0.5))
        d.ellipse((292, 292, 732, 732), outline=main, width=18)
        d.ellipse((420, 420, 604, 604), fill=_lighten(dark, 0.7))

    # ---- 中央信息卡 ----
    card = (152, 330, 872, 700)
    d.rounded_rectangle(card, radius=36, fill=(255, 255, 255), outline=_lighten(dark, 0.55), width=3)

    f_title = _font(58)
    f_mid = _font(38)
    f_small = _font(30)

    def _center(text: str, y: int, font, fill):
        bbox = d.textbbox((0, 0), text, font=font)
        x = (W - (bbox[2] - bbox[0])) // 2
        d.text((x, y), text, font=font, fill=fill)

    _center(f"演示提案 {index + 1:02d}", 380, f_title, dark)
    # 产品类型选填：无产品时副标题只显示主题，避免出现"主题 · "的空尾巴
    _center(" · ".join(p for p in (theme_name, product_name) if p), 470, f_mid, main)
    _center(f"{style_name}风格设计方向", 540, f_small, (120, 112, 100))

    # ---- 参考图缩略（用户上传了参考图时，贴在卡片下方，表示已纳入参考） ----
    if reference_path and os.path.isfile(reference_path):
        try:
            ref = Image.open(reference_path).convert("RGB")
            ref.thumbnail((150, 150))
            rx, ry = 800 - ref.width, 620
            img.paste(ref, (rx, ry))
            d.rectangle((rx, ry, rx + ref.width, ry + ref.height), outline=main, width=3)
            d.text((620, 670), "已参考上传图", font=_font(26), fill=(120, 112, 100))
        except Exception:
            pass

    # ---- 底部水印条（最关键：明确告知这不是真实 AI 生成图） ----
    d.rectangle((0, 880, W, H), fill=dark)
    _center(DEMO_IMAGE_NOTE, 918, _font(42), (255, 255, 255))
    d.text((40, 30), "非遗灵境 · 创作工坊", font=_font(28), fill=(120, 112, 100))
    d.text((W - 300, 36), datetime.now().strftime("%Y-%m-%d"), font=_font(26), fill=(160, 152, 140))

    img.save(dest, format="PNG")


# ============================================================
# 三、对外主入口
# ============================================================

async def generate_proposal_images(
    briefs: list[dict],
    *,
    theme_name: str,
    product_name: str,
    style_name: str,
    reference_path: str | None = None,
    force_demo: bool = False,
    on_progress=None,
) -> list[dict]:
    """为每个提案生成一张效果图。

    @param briefs: [{proposalTitle, concept, colorPalette:[{hex,...}]}]
    @param force_demo: 强制走本地演示绘制（用于真实服务无权限时的降级，
                       图片会带「演示图」水印，不冒充真实生成结果）
    @param on_progress: 可选回调 (已完成数, 总数)，用于长任务展示进度
    @return [{url, mode, model}]，顺序与 briefs 一一对应
    """
    ensure_dirs()
    stamp = uuid.uuid4().hex[:10]

    # ---- 真实模式：百炼通义万相（异步任务） ----
    if config.is_real_image_mode() and not force_demo:
        return await _wanx_generate(
            briefs,
            stamp=stamp,
            theme_name=theme_name,
            product_name=product_name,
            style_name=style_name,
            on_progress=on_progress,
        )

    # ---- Demo 模式：本地绘制占位图（在线程里跑，避免阻塞事件循环） ----
    results = []
    for i, brief in enumerate(briefs):
        filename = f"{stamp}_p{i + 1}.png"
        dest = os.path.join(config.GENERATED_DIR, filename)
        palette = brief.get("colorPalette") or [{"hex": "#C0392B"}, {"hex": "#D8A7B1"}, {"hex": "#2A2722"}]
        await asyncio.to_thread(
            _render_demo_image,
            dest,
            index=i,
            theme_name=theme_name,
            product_name=product_name,
            style_name=style_name,
            palette=palette,
            reference_path=reference_path,
        )
        results.append({
            "url": f"/api/files/generated/{filename}",
            "mode": "demo",
            "model": "",
        })
        if on_progress:
            on_progress(i + 1, len(briefs))
    return results


# ============================================================
# 四、Real 模式：阿里云百炼 · 通义万相 wan2.7-image（真实生成）
# ------------------------------------------------------------
# 官方接口（2026-10-15 用真实 Key 实测核实）：
#   POST {BASE}/api/v1/services/aigc/multimodal-generation/generation
#   body: {"model": "wan2.7-image",
#          "input": {"messages": [{"role": "user",
#                    "content": [{"text": "提示词"}]}]}}
#   —— 【同步】接口：提交后等待约 40~90 秒直接返回结果，不支持 X-DashScope-Async。
#   返回 output.choices[0].message.content = [{"type":"image","image":"https://..."}]
#   图片 URL 为 OSS 临时地址（数小时有效），立刻下载转存到 backend/storage/generated/。
#
# 注意：
#   - 旧 wanx2.1-t2i-turbo/plus 异步接口与模型均已下线（2026-10 实测 404），
#     单张图生成耗时 40~90s，3 张图并行提交由后端任务化处理（见 studio.py）。
#   - 图生图需要参考图是公网可访问的 URL，本地地址百炼访问不到，
#     故暂不把参考图传给万相；等接入 OSS 等公网存储后再开启。
#   - 失败会返回中文错误，绝不回退伪装成功。
# ============================================================

def _build_wanx_prompt(brief: dict, *, theme_name: str, product_name: str, style_name: str) -> str:
    """把结构化提案拼成万相文生图提示词。

    产品类型选填：有具体产品时产出"产品效果图"（商业摄影质感）；
    无产品时产出"纯视觉创作图"（海报/插画等，不虚构产品载体）。
    """
    if product_name:
        return (
            f"中国非物质文化遗产主题文创产品效果图：{product_name}设计，"
            f"灵感来自{theme_name}，{style_name}风格。{brief.get('concept', '')}"
            f"产品正面居中展示，干净的浅色背景，商业产品摄影质感，高清，无文字水印。"
        )
    return (
        f"中国非物质文化遗产主题视觉创作：灵感来自{theme_name}，{style_name}风格。"
        f"{brief.get('concept', '')}"
        f"画面主体完整居中，干净的浅色背景，高清印刷质感，无文字水印。"
    )


async def _wan2_invoke(client: httpx.AsyncClient, prompt: str) -> str:
    """同步调用 wan2.7-image 生成一张图，返回图片临时 URL。

    单张耗时 40~90 秒，超时上限由 IMAGE_SYNC_TIMEOUT_S 控制。
    """
    url = f"{config.IMAGE_BASE_URL}/api/v1/services/aigc/multimodal-generation/generation"
    headers = {
        "Authorization": f"Bearer {config.IMAGE_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": config.IMAGE_MODEL,
        "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
    }
    try:
        resp = await client.post(url, json=body, headers=headers, timeout=config.IMAGE_SYNC_TIMEOUT_S)
    except (httpx.TimeoutException, httpx.HTTPError) as e:
        raise ImageError(
            "IMAGE_SYNC_TIMEOUT" if isinstance(e, httpx.TimeoutException) else "IMAGE_HTTP_ERROR",
            f"图片生成{'超时（超过 ' + str(config.IMAGE_SYNC_TIMEOUT_S) + ' 秒），请稍后重试' if isinstance(e, httpx.TimeoutException) else '服务连接失败，请稍后重试'}",
        )
    if resp.status_code != 200:
        await _raise_wanx_http_error(resp)
    try:
        content = resp.json()["output"]["choices"][0]["message"]["content"]
        for item in content:
            if item.get("type") == "image" and item.get("image"):
                return item["image"]
        raise ImageError("IMAGE_RESULT_EMPTY", "图片生成成功但未返回图片地址，请重试")
    except ImageError:
        raise
    except Exception:
        raise ImageError("IMAGE_PARSE_FAILED", "图片服务返回格式异常，请稍后重试")


async def _download_to_storage(client: httpx.AsyncClient, img_url: str, filename: str) -> None:
    """把万相返回的临时图片 URL（24 小时有效）下载转存到本地 generated 目录。"""
    resp = await client.get(img_url)
    if resp.status_code != 200 or not resp.content:
        raise ImageError("IMAGE_DOWNLOAD_FAILED", "生成图下载失败，请稍后重试")
    # 简单的图片魔数校验（PNG / JPEG）
    head = resp.content[:8]
    is_png = head.startswith(b"\x89PNG\r\n\x1a\n")
    is_jpeg = head[:2] == b"\xff\xd8"
    if not (is_png or is_jpeg):
        raise ImageError("IMAGE_BAD_CONTENT", "生成图内容异常，已放弃保存")
    dest = os.path.join(config.GENERATED_DIR, filename)
    with open(dest, "wb") as f:
        f.write(resp.content)


async def _raise_wanx_http_error(resp: httpx.Response) -> None:
    """把万相 HTTP 错误转成中文 ImageError（不回显 Key）。"""
    if resp.status_code == 401:
        raise ImageError("IMAGE_UNAUTHORIZED", "图片服务返回 401：API Key 无效或未开通对应图像模型")
    if resp.status_code == 404:
        raise ImageError("IMAGE_NOT_FOUND", f"图片服务返回 404：模型名「{config.IMAGE_MODEL}」或接口地址有误")
    if resp.status_code == 429:
        raise ImageError("IMAGE_RATE_LIMITED", "图片服务返回 429：请求过于频繁或免费额度已用完，请稍后重试")
    if resp.status_code == 403:
        raise ImageError("IMAGE_ACCESS_DENIED", "图片服务返回 403：当前账号无权调用该图像模型，请在百炼控制台确认开通状态")
    detail = resp.text[:160] if resp.text else ""
    raise ImageError("IMAGE_HTTP_ERROR", f"图片服务返回错误（HTTP {resp.status_code}）：{detail}")


async def _wanx_generate(
    briefs: list[dict],
    *,
    stamp: str,
    theme_name: str,
    product_name: str,
    style_name: str,
    on_progress=None,
) -> list[dict]:
    """并行调用 wan2.7-image：每个提案一张图（同步接口单张 40~90s，并行总耗时≈单张）。"""
    prompts = [
        _build_wanx_prompt(brief, theme_name=theme_name, product_name=product_name, style_name=style_name)
        for brief in briefs
    ]
    total = len(prompts)
    done = 0

    async def _one(prompt: str) -> str:
        nonlocal done
        img_url = await _wan2_invoke(client, prompt)
        done += 1
        if on_progress:
            try:
                on_progress(done, total)
            except Exception:
                pass
        return img_url

    async with httpx.AsyncClient(timeout=config.IMAGE_SYNC_TIMEOUT_S + 30) as client:
        # 先并行生成，拿到 URL 后逐张下载转存（下载很快，串行即可）
        img_urls = await asyncio.gather(*[_one(p) for p in prompts])
        for i, img_url in enumerate(img_urls):
            filename = f"{stamp}_p{i + 1}.png"
            await _download_to_storage(client, img_url, filename)
    return [
        {"url": f"/api/files/generated/{stamp}_p{i + 1}.png", "mode": "real", "model": config.IMAGE_MODEL}
        for i in range(len(briefs))
    ]
