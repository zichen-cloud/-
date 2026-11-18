# ============================================================
# 聊天接口的数据模型
# ------------------------------------------------------------
# 请求 / 响应结构在这里定义，前端照此编写。
# ============================================================
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """POST /api/chat 的请求体"""

    message: str                      # 用户的问题
    session_id: str = "demo-session"  # 会话标识（第四阶段起用于多轮追问记忆）


class ChatSource(BaseModel):
    """一条知识来源（第四阶段扩充：原文片段 / 分类 / 地区 / 名录级别 / 核验状态 / 匹配方式）。

    新增字段均带默认值，旧前端只读 title/source/url 不受影响。
    """

    title: str   # 资料标题，如"《昆曲》资料来源"
    source: str  # 资料来源名称，如"中国非物质文化遗产网"
    id: str      # 资料在知识库中的项目 id
    url: str = ""          # 资料来源的链接（可选，无则为空串）
    snippet: str = ""      # 原文片段（最相关 chunk 的节选）
    category: str = ""     # 非遗分类，如"传统戏剧"
    province: str = ""     # 省份
    level: str = ""        # 名录级别（国家级 / UNESCO 等）
    verified: bool = False # 核验状态（绝不默认标真）
    matchType: str = "vector"  # vector=语义命中 / keyword=仅关键词字面命中（证据强度弱）


class ChatResponse(BaseModel):
    """POST /api/chat 的响应体（第四阶段：统一响应结构）"""

    answer: str              # AI 回答正文
    sources: List[ChatSource] = []  # 回答依据的知识来源
    mode: str                # "mock"（演示）或 "real"（真实模型）
    # 检索状态：ok=语义命中 / keyword_only=仅关键词字面命中（证据弱）/
    #           empty=知识库无命中 / degraded=检索服务异常降级
    retrieval_status: str = "empty"


# ============================================================
# 创作工坊接口的数据模型
# ============================================================

class StudioPlanRequest(BaseModel):
    """POST /api/studio/generate-plan 的请求体"""

    title: str                    # 作品标题
    theme: str                    # 非遗主题 id
    createType: str               # 创作类型 id
    style: str                    # 视觉风格 id
    requirement: str = ""         # 具体需求（选填）
    # 前端传来的展示名称（用于提示词，避免后端再查一遍）
    themeName: str = ""
    themeTagline: str = ""
    createTypeName: str = ""
    createTypeHint: str = ""
    styleName: str = ""
    styleHint: str = ""


class ColorItem(BaseModel):
    name: str
    hex: str
    usage: str


class ElementItem(BaseModel):
    name: str
    desc: str
    verifyNote: str


class StudioPlan(BaseModel):
    designBrief: str
    colorPalette: List[ColorItem]
    composition: List[str]
    traditionalElements: List[ElementItem]


class StudioPlanResponse(BaseModel):
    """POST /api/studio/generate-plan 的响应体"""

    mode: str                     # "ai" 或 "mock"
    promptSummary: str            # 文生图提示词
    plan: StudioPlan              # 结构化设计方案


# ============================================================
# 创作工坊升级：产品效果图提案（阶段一）
# ============================================================

class ProposalRequest(BaseModel):
    """POST /api/studio/generate-proposals 的请求体"""

    title: str                    # 作品标题
    theme: str                    # 非遗主题 id
    createType: str = ""          # 创作类型 id（选填，空串 = 不选）
    productType: str = ""         # 产品类型 id（选填，帆布袋 / 马克杯 …；空串 = 纯视觉创作）
    style: str                    # 视觉风格 id
    requirement: str = ""         # 设计要求（选填）
    referenceId: str = ""         # 已上传参考图的文件名（由 upload-reference 返回，选填）
    # 前端传来的展示名称（用于提示词，避免后端再维护一份选项表）
    themeName: str = ""
    themeTagline: str = ""
    createTypeName: str = ""
    createTypeHint: str = ""
    productTypeName: str = ""
    productTypeHint: str = ""
    styleName: str = ""
    styleHint: str = ""


class ReferenceUploadResponse(BaseModel):
    """POST /api/studio/upload-reference 的响应体"""

    ok: bool = True
    referenceId: str              # 文件名（后续生成提案时回传）
    url: str                      # 可访问地址 /api/files/uploads/xxx.png
    width: int
    height: int


class ProposalColorItem(BaseModel):
    name: str
    hex: str
    usage: str = ""


class ProposalItem(BaseModel):
    """一个产品设计提案：一张效果图 + 配套文案"""

    id: str
    imageUrl: str                 # 效果图地址（demo 为带水印演示图，real 为万相生成图）
    proposalTitle: str            # 方案标题
    concept: str                  # 设计理念
    elements: str                 # 非遗元素应用说明
    composition: List[str]        # 构图建议
    colorPalette: List[ProposalColorItem]


class ProposalResponse(BaseModel):
    """POST /api/studio/generate-proposals 的响应体"""

    ok: bool = True
    mode: str                     # 文案生成模式："ai" / "mock"
    imageMode: str                # 图片生成模式："real"（万相真实生成）/ "demo"（本地演示图）
    imageModel: str = ""          # real 模式下实际使用的图片模型名
    promptSummary: str            # 文生图提示词摘要
    proposals: List[ProposalItem]
    disclaimer: str = ""          # 数字作品与演示图声明


# ============================================================
# 创作工坊：产品介绍视频（阶段三）
# ============================================================

class VideoRequest(BaseModel):
    """POST /api/studio/generate-video 的请求体（内容为已选中的提案 + 主题上下文）"""

    title: str                    # 作品标题
    themeName: str = ""
    productTypeName: str = ""
    styleName: str = ""
    proposalTitle: str = ""       # 选中的方案名
    concept: str = ""             # 选中的设计理念
    elements: str = ""            # 选中的元素应用说明
    imageUrl: str = ""            # 选中的效果图地址（/api/files/generated/...）
    colorPalette: List[ProposalColorItem] = []
    # 阶段四：配音（为空时合成无声视频；与 5 个分镜一一对应）
    audioSentenceUrls: List[str] = []   # 配音 mp3 的 /api/files/audio/... 地址
    audioDurations: List[float] = []    # 每句配音时长（秒），由 generate-audio 返回
    audioSentences: List[str] = []      # 最终用于朗读的旁白文本（用户可编辑），用于画面字幕
    voiceName: str = ""                 # 音色展示名（仅用于结果标识）
    speedName: str = ""                 # 语速展示名（仅用于结果标识）
    # 阶段五：视频可控选项（可选，缺省时按通用叙事处理）
    videoPurpose: str = ""        # 用途：电商详情 / 社交分享 / 文化科普 / 礼品推荐
    videoStyle: str = ""          # 风格：雅致叙事 / 轻快活泼 / 沉静人文
    narrativeFocus: str = ""      # 叙事重点：文化传承 / 工艺美学 / 现代生活 / 均衡


# ============================================================
# 创作工坊：AI 配音（阶段四）
# ============================================================

class NarrationRequest(BaseModel):
    """POST /api/studio/generate-narration 的请求体"""

    title: str
    themeName: str = ""
    productTypeName: str = ""
    styleName: str = ""
    proposalTitle: str = ""
    concept: str = ""
    elements: str = ""
    # 阶段五：视频可控选项（与视频脚本共用同一组选项）
    videoPurpose: str = ""
    videoStyle: str = ""
    narrativeFocus: str = ""


class NarrationResponse(BaseModel):
    ok: bool = True
    sentences: List[str]          # 恰好 5 句口播旁白
    mode: str                     # ai / mock


class AudioRequest(BaseModel):
    """POST /api/studio/generate-audio 的请求体"""

    sentences: List[str]          # 旁白句数组（与视频分镜一一对应）
    voice: str = "gentle-female"  # gentle-female / calm-male / natural-talk
    speed: str = "normal"         # slow / normal / fast


class AudioResponse(BaseModel):
    ok: bool = True
    audioId: str
    sentenceUrls: List[str]       # 每句一个 mp3 地址
    durations: List[float]        # 每句时长（秒）
    totalDuration: float
    voice: str
    voiceName: str
    speed: str
    speedName: str
    mode: str = "real"


class VideoStartResponse(BaseModel):
    """POST /api/studio/generate-video 的响应体"""

    ok: bool = True
    taskId: str


class VideoScene(BaseModel):
    narration: str                # 旁白
    subtitle: str                 # 画面字幕
    seconds: float                # 该分镜时长（秒）


class VideoStatusResponse(BaseModel):
    """GET /api/studio/video-status/{taskId} 的响应体"""

    ok: bool = True
    status: str                   # queued / processing / done / failed
    progress: float = 0           # 0~1
    message: str = ""             # 当前阶段说明
    error: str = ""               # 失败原因（status=failed 时填充）
    videoUrl: str = ""            # 成片地址（status=done 时填充）
    duration: float = 0           # 成片时长（秒）
    mode: str = ""                # demo / real
    scriptMode: str = ""          # 文案生成模式：ai / mock
    hasAudio: bool = False        # 成片是否包含配音
    voiceName: str = ""           # 音色展示名
    speedName: str = ""           # 语速展示名
    script: dict | None = None    # 脚本文案（videoTitle / intro / scenes）
    disclaimer: str = ""


class VideoTaskItem(BaseModel):
    """历史视频任务列表项（GET /api/studio/video-tasks）"""

    taskId: str
    status: str
    progress: float = 0
    message: str = ""
    error: str = ""
    videoUrl: str = ""
    duration: float = 0
    mode: str = ""
    scriptMode: str = ""
    hasAudio: bool = False
    voiceName: str = ""
    speedName: str = ""
    createdAt: int = 0
    updatedAt: int = 0
    interrupted: bool = False      # 是否因服务重启被标记中断


class VideoTaskListResponse(BaseModel):
    ok: bool = True
    tasks: List[VideoTaskItem]


# ============================================================
# 我的作品：持久化（阶段五）
# ============================================================

class WorkSaveRequest(BaseModel):
    """POST /api/works 的请求体（字段与前端保存结构保持一致，未知字段忽略）

    模型用 pydantic 宽松接收：result 是完整提案对象（含配色等），
    视频相关字段在视频页保存时才填充。
    """

    # 迁移自 localStorage 时可带 id / createdAt；正常新建时由服务端生成
    id: str = ""
    createdAt: int = 0

    title: str
    # 主题 / 类型 / 风格（key + 展示名）
    theme: str = ""
    themeName: str = ""
    createType: str = ""
    createTypeName: str = ""
    productType: str = ""
    productTypeName: str = ""
    style: str = ""
    styleName: str = ""
    requirement: str = ""
    # 提案内容
    promptSummary: str = ""
    designBrief: str = ""
    result: dict = {}
    imageUrl: str = ""
    proposalTitle: str = ""
    mode: str = ""
    imageMode: str = ""
    # 阶段三/四：介绍视频与配音（没有视频时为空）
    videoUrl: str = ""
    duration: float = 0
    hasAudio: bool = False
    voiceName: str = ""
    speedName: str = ""

    model_config = {"extra": "ignore"}


class WorkItem(BaseModel):
    """作品完整记录"""

    id: str
    createdAt: int = 0
    title: str
    theme: str = ""
    themeName: str = ""
    createType: str = ""
    createTypeName: str = ""
    productType: str = ""
    productTypeName: str = ""
    style: str = ""
    styleName: str = ""
    requirement: str = ""
    promptSummary: str = ""
    designBrief: str = ""
    result: dict = {}
    imageUrl: str = ""
    proposalTitle: str = ""
    mode: str = ""
    imageMode: str = ""
    videoUrl: str = ""
    duration: float = 0
    hasAudio: bool = False
    voiceName: str = ""
    speedName: str = ""


class WorkListResponse(BaseModel):
    ok: bool = True
    works: List[WorkItem]


class WorkDeletedResponse(BaseModel):
    ok: bool = True
    id: str


# ============================================================
# 收藏（MySpace 收藏夹）
# ============================================================

class FavoriteCreateRequest(BaseModel):
    """收藏请求：type + targetId，快照由服务端从事实来源生成（防前端伪造）"""
    type: Literal["heritage", "work"]
    targetId: str = Field(..., min_length=1, max_length=80)


class FavoriteItem(BaseModel):
    """一条收藏记录；snapshot 内容按 type 不同（服务端生成的只读快照）"""
    id: str
    type: str
    targetId: str
    createdAt: int = 0
    snapshot: dict = {}


class FavoriteListResponse(BaseModel):
    ok: bool = True
    favorites: List[FavoriteItem]


class FavoriteDeletedResponse(BaseModel):
    ok: bool = True
    id: str


# ============================================================
# AI 学习记录（MySpace 学习档案）
# ============================================================

class StudyLogItem(BaseModel):
    """一次成功问答的学习记录（不含完整答案，仅摘要）"""
    ts: int = 0                      # 提问时间（毫秒时间戳）
    question: str = ""
    answerPreview: str = ""          # 答案前 ~80 字
    retrievalStatus: str = ""        # ok / keyword_only / empty / degraded
    sourceCount: int = 0
    sessionId: str = ""
    mode: str = ""                   # mock / real


class StudyLogListResponse(BaseModel):
    ok: bool = True
    records: List[StudyLogItem]


# ============================================================
# 数字传承人（阶段二）
# ------------------------------------------------------------
# 角色匹配输入直接复用识别结果（candidates），保证"识别 → 角色"同源；
# 对话、出题、朗读、语音识别各自独立，便于模块化替换。
# ============================================================

class PersonaCandidate(BaseModel):
    """识别候选（与 RecognitionCandidate 对齐的精简输入）"""
    name: str = ""
    category: str = ""
    basis: str = ""


class PersonaMatchRequest(BaseModel):
    candidates: List[PersonaCandidate] = []
    predictedCategory: str = ""
    heritageId: str = ""


class PersonaMatchResponse(BaseModel):
    ok: bool = True
    matched: bool = False
    persona: Optional[dict] = None              # 唯一匹配时的角色
    alternatives: List[dict] = []               # 多候选时供用户确认
    reason: str = ""
    error: Optional[dict] = None


class PersonaTurn(BaseModel):
    user: str = ""
    ai: str = ""


class PersonaChatRequest(BaseModel):
    personaId: str
    message: str = ""
    sessionId: str = "persona-session"
    intent: str = "chat"                        # chat | story
    heritageId: str = ""
    history: List[PersonaTurn] = []


class PersonaChatResponse(BaseModel):
    ok: bool = True
    answer: str = ""
    sources: List[ChatSource] = []
    mode: str = ""
    personaId: str = ""
    intent: str = "chat"
    error: Optional[dict] = None


class PersonaQuizResponse(BaseModel):
    ok: bool = True
    quiz: Optional[dict] = None                 # {question, options, answerIndex, explain}
    mode: str = ""
    error: Optional[dict] = None


class PersonaTTSRequest(BaseModel):
    text: str
    voiceKey: str = "gentle-female"


class PersonaTTSResponse(BaseModel):
    ok: bool = True
    segmentUrls: List[str] = []
    durations: List[float] = []
    totalDuration: float = 0
    voiceName: str = ""
    mode: str = ""
    error: Optional[dict] = None


class PersonaListResponse(BaseModel):
    ok: bool = True
    personas: List[dict] = []


class ASRResponse(BaseModel):
    ok: bool = True
    text: str = ""
    mode: str = ""
    error: Optional[dict] = None


# ============================================================
# 多非遗跨界融合创作（阶段三）
# ============================================================

class FusionHeritage(BaseModel):
    id: str = ""
    name: str
    category: str = ""


class FusionAnalyzeRequest(BaseModel):
    heritages: List[FusionHeritage]
    productType: str = "tote-bag"
    productName: str = ""
    styleName: str = ""
    ratios: List[int] = []          # 与 heritages 一一对应，合计 100
    idea: str = ""
    count: int = 2                  # 方案数量（2-3）


class FusionProposal(BaseModel):
    proposalTitle: str = ""
    concept: str = ""
    colorPalette: List[dict] = []
    fromA: List[str] = []
    fromB: List[str] = []
    fromC: List[str] = []           # 第三项非遗的元素来源（仅三项融合时使用）
    how: str = ""
    innovation: str = ""
    imagePrompt: str = ""
    imageUrl: str = ""
    mode: str = ""


class FusionAnalyzeResponse(BaseModel):
    ok: bool = True
    themeName: str = ""
    analysis: List[dict] = []
    proposals: List[FusionProposal] = []
    mode: str = ""
    error: Optional[dict] = None


class FusionImagesRequest(BaseModel):
    proposals: List[FusionProposal]
    themeName: str = ""
    productName: str = ""
    styleName: str = ""


class FusionImagesResponse(BaseModel):
    ok: bool = True
    proposals: List[FusionProposal] = []
    notice: str = ""                # 降级说明（例如真实图像模型不可用时改用演示图）
    error: Optional[dict] = None
