# ============================================================
# 真实视频生成 Provider 适配层（阶段五预留）
# ------------------------------------------------------------
# 为什么有这一层：
#   阶段三/四的 demo 模式用 FFmpeg 本地合成；真实「文生视频 / 图生视频」
#   模型是异步任务（提交 → 轮询 → 下载成片），供应商和参数将来可能更换。
#   video_service 只依赖本文件的抽象接口（submit/poll/download），
#   任务编排、状态持久化、配音混音、前端展示全部与供应商解耦。
#
# 接入真实模型时的工作量（改这里，其他文件不用动）：
#   1. 按官方最新文档在 DashScopeWanxVideoProvider 的 submit / poll 中
#      填入 HTTP 调用（异步提交头、任务查询、状态码映射）；
#      可直接参考 services/image_service.py 里已写好的万相图片异步实现；
#   2. 在 backend/.env 设置 VIDEO_MODE=real（VIDEO_API_KEY 默认复用 AI_API_KEY，
#      VIDEO_MODEL 已默认 wanx2.1-t2v-turbo，按开通的模型调整）；
#   3. 真实联调一次：401/404/429/超时必须转成中文 VideoProviderError，
#      绝不把失败伪装成成功。
#
# 重要：本文件不硬编码任何【未经官方文档核实】的请求字段与返回路径，
# 避免把猜测写成事实；submit/poll 目前统一抛出 VIDEO_REAL_NOT_READY，
# download 是与供应商无关的通用实现（接哪家都能直接用）。
# ============================================================
import abc
import os
from dataclasses import dataclass

import httpx

import config


class VideoProviderError(Exception):
    """真实视频生成服务错误（video_service 捕获后转成 VideoError 中文响应）。"""

    def __init__(self, code: str, message: str, status_hint: int = 502):
        self.code = code
        self.message = message
        # 给路由层的 HTTP 状态提示（401→配置错误 / 429→限流 / 504→超时…）
        self.status_hint = status_hint
        super().__init__(message)


@dataclass
class ProviderStatus:
    """供应商任务状态的统一结构（各家返回字段在这里归一化）。"""

    status: str                 # queued / running / succeeded / failed
    progress: float = 0.0       # 0~1（供应商不返回进度时由轮询次数估算）
    video_url: str = ""         # succeeded 时的远程成片地址
    raw: dict | None = None     # 原始返回（调试用，不入库）


class VideoGenerationProvider(abc.ABC):
    """真实视频生成供应商的统一协议。"""

    name: str = "base"

    @abc.abstractmethod
    def is_configured(self) -> bool:
        """配置是否齐全（Key / 模型等）。"""

    @abc.abstractmethod
    async def submit(self, context: dict, script: dict, prompt: str) -> str:
        """提交异步生成任务，返回供应商侧的任务 id。"""

    @abc.abstractmethod
    async def poll(self, provider_task_id: str) -> ProviderStatus:
        """查询供应商任务状态。"""

    @abc.abstractmethod
    async def download(self, remote_url: str, dest_path: str) -> None:
        """把供应商成片下载到本地 dest_path。"""


# 统一的「尚未接入」提示，保证默认配置下绝不伪装成功
_NOT_READY_MESSAGE = (
    "真实视频生成接口的适配位置已预留但尚未接入：请在 "
    "backend/services/video_providers.py 的 DashScopeWanxVideoProvider 中"
    "按官方最新文档补全 submit / poll 实现（可参考 image_service.py 的万相图片异步调用），"
    "并在 backend/.env 设置 VIDEO_MODE=real、确认已开通视频生成模型。"
    "当前请继续使用 VIDEO_MODE=demo 的本地合成。"
)


class DashScopeWanxVideoProvider(VideoGenerationProvider):
    """阿里云百炼 · 万相视频生成（wanx 文生/图生视频）。

    submit / poll 为待接入骨架；接入步骤见模块头部注释。
    """

    name = "dashscope-wanx"

    def __init__(self) -> None:
        self._timeout = config.TTS_TIMEOUT_S  # 单次 HTTP 超时复用 60s 配置

    def is_configured(self) -> bool:
        return bool(config.VIDEO_API_KEY) and bool(config.VIDEO_MODEL)

    async def submit(self, context: dict, script: dict, prompt: str) -> str:
        # TODO(接入真实模型)：
        #   POST {config.VIDEO_BASE_URL}/api/v1/services/aigc/...（以官方文档为准）
        #   headers: Authorization: Bearer {config.VIDEO_API_KEY}
        #            X-DashScope-Async: enable
        #   body: {"model": config.VIDEO_MODEL,
        #          "input": {"prompt": prompt, "img_url": context.get("imageUrl") or undefined}}
        #   成功从 output.task_id 取任务 id；
        #   401/403→KEY 无效或未开通；429→限流/欠费；400→参数/模型错误；超时→网络问题。
        raise VideoProviderError("VIDEO_REAL_NOT_READY", _NOT_READY_MESSAGE)

    async def poll(self, provider_task_id: str) -> ProviderStatus:
        # TODO(接入真实模型)：
        #   GET {config.VIDEO_BASE_URL}/api/v1/tasks/{provider_task_id}
        #   output.task_status: PENDING/RUNNING → queued/running
        #                       SUCCEEDED → succeeded，取 output.video_url（注意可能是列表）
        #                       FAILED/UNKNOWN → failed，透传 output.message 为中文/原文
        raise VideoProviderError("VIDEO_REAL_NOT_READY", _NOT_READY_MESSAGE)

    async def download(self, remote_url: str, dest_path: str) -> None:
        """通用下载（与具体供应商无关）：跟随重定向把成片存到本地。"""
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=self._timeout) as client:
                async with client.stream("GET", remote_url) as resp:
                    if resp.status_code != 200:
                        raise VideoProviderError(
                            "VIDEO_DOWNLOAD_FAILED",
                            f"视频成片下载失败（HTTP {resp.status_code}），请稍后重试或重新生成",
                        )
                    tmp = f"{dest_path}.download"
                    with open(tmp, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=1 << 16):
                            if chunk:
                                f.write(chunk)
                    os.replace(tmp, dest_path)
        except httpx.TimeoutException as e:
            raise VideoProviderError(
                "VIDEO_DOWNLOAD_TIMEOUT", "视频成片下载超时，请检查网络后重新生成", 504
            ) from e
        except httpx.HTTPError as e:
            raise VideoProviderError(
                "VIDEO_DOWNLOAD_FAILED", f"视频成片下载失败：{type(e).__name__}", 502
            ) from e


# ---------------- 工厂：未来多供应商在这里选择 ----------------
_provider: VideoGenerationProvider | None = None


def get_video_provider() -> VideoGenerationProvider:
    """返回当前启用的真实视频生成供应商实例。

    接入新供应商时在此按环境变量选择即可，video_service 不感知具体类型。
    """
    global _provider
    if _provider is None:
        _provider = DashScopeWanxVideoProvider()
    return _provider


def build_prompt(context: dict, script: dict) -> str:
    """从已核实的脚本文案与设计上下文构造文生视频提示词。

    只用已生成的设计层面信息（产品/风格/分镜），不添加未经核实的
    历史年代或文化寓意。
    """
    title = (context.get("proposalTitle") or context.get("title") or "").strip()
    product = (context.get("productTypeName") or "").strip()
    style = (context.get("styleName") or "").strip()
    intro = (script.get("intro") or "").strip()
    scenes = script.get("scenes") or []
    scene_text = "；".join(str(s.get("subtitle") or "").strip() for s in scenes if s.get("subtitle"))
    parts = [
        f"{style}{product}宣传短片「{title}」" if product or style else f"宣传短片「{title}」",
        intro,
        scene_text,
        "画面干净、柔和光线、缓慢运镜，适合电商展示",
    ]
    return "，".join(p for p in parts if p)
