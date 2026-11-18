# ============================================================
# 数据结构定义（Pydantic 模型）
# ------------------------------------------------------------
# Pydantic 是 FastAPI 自带的数据校验库：定义好字段和类型后，
# 返回给前端的就是结构固定、可预期的 JSON。
# 前端可以完全按照这里的字段名来编写界面。
# ============================================================
from typing import List, Optional

from pydantic import BaseModel


class VisualFeature(BaseModel):
    """一条视觉特征描述"""

    title: str  # 特征名，如"构图 / 色彩 / 工艺痕迹"
    desc: str   # 具体描述


class LearningSuggestion(BaseModel):
    """一条学习建议"""

    title: str  # 建议标题
    desc: str   # 具体做法


class RecognitionCandidate(BaseModel):
    """一个候选非遗项目（仅当视觉证据足够时才返回；证据不足时列表为空）"""

    name: str = ""       # 候选非遗名称，如"苏绣"（可以是知识库未收录的项目）
    category: str = ""   # 非遗类别，如"传统美术"
    basis: str = ""      # 判断依据：哪些【可见视觉特征】支持该候选
    region: str = ""     # 相关地域（仅在有明确证据时填写，否则留空）


class RagSource(BaseModel):
    """RAG 核验来源：知识库中与候选相关的真实资料"""

    title: str = ""
    source: str = ""     # 来源机构
    id: str = ""         # 项目 id（前端可链到 /heritage/:id）
    url: str = ""        # 原始链接（可能为空）
    snippet: str = ""    # 原文片段
    category: str = ""
    province: str = ""
    level: str = ""      # 名录级别
    verified: bool = False


class RecognitionData(BaseModel):
    """识别结果主体"""

    predictedCategory: str  # 推测的技艺类别，如"传统美术 · 剪纸"（无候选时为"无法判断"）
    # 置信度：多数对话式模型不提供可靠置信度，
    # 因此默认 None，前端显示"未提供"，【绝不编造数值】
    confidence: Optional[float] = None
    visualFeatures: List[VisualFeature] = []
    culturalInfoToVerify: List[str] = []       # 需要核实的文化信息
    learningSuggestions: List[LearningSuggestion] = []
    # ---- 阶段二新增（全部带默认值，与旧前端兼容）----
    recognitionStatus: str = "ok"            # ok（有候选）| uncertain（证据不足）| not_heritage（与非遗无关）
    imageContent: str = ""                   # 第一层观察：图片主要内容的客观描述
    candidates: List[RecognitionCandidate] = []  # 第二层判断：候选非遗（可多选，可为空）
    unconfirmedInfo: List[str] = []          # 仅凭图片无法确认的信息
    ragSources: List[RagSource] = []         # 候选的知识库核验来源（真实检索，不伪造）


class ErrorInfo(BaseModel):
    """错误信息"""

    code: str     # 错误码，如 INVALID_FILE_TYPE，前端可据此做针对性提示
    message: str  # 人类可读的错误说明


class RecognitionResponse(BaseModel):
    """接口统一响应结构（成功和失败都用同一个外壳）"""

    ok: bool                      # 请求是否成功
    mode: str                     # 本次结果的来源："mock"（演示）或 "ai"（真实模型）
    data: Optional[RecognitionData] = None
    error: Optional[ErrorInfo] = None
    disclaimer: str               # 免责声明：AI 结果不是官方认定
