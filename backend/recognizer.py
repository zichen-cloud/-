# ============================================================
# 识别模块：调用多模态 AI 模型 + mock（演示）模式
# ------------------------------------------------------------
# 职责划分：
#   main.py    —— 接收请求、校验文件（不改识别逻辑）
#   本文件     —— 只负责"得到一张图 → 返回结构化识别结果"
# ============================================================
import asyncio
import base64
import json

import httpx

import config
from schemas import (
    LearningSuggestion,
    RagSource,
    RecognitionCandidate,
    RecognitionData,
    VisualFeature,
)

# 免责声明：随每次接口响应返回，前端原样展示
DISCLAIMER = (
    "本结果由 AI 模型自动生成，仅用于学习与探索，不构成任何官方认定或学术结论。"
    "识别类别为可能性推测；涉及历史、流派、寓意的说法请以官方名录与权威资料为准。"
)


class RecognizeError(Exception):
    """识别过程中的可预期错误（携带错误码，main.py 据此返回统一 JSON）"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# ---------------- 提示词（Prompt） ----------------
# 两层结构：第一层只客观描述"看到了什么"，第二层在证据足够时才给出候选。
# 核心反误识别约束：
#   - 常见装饰图案（花卉/龙凤/祥云等）不足以认定具体非遗项目；
#   - 现代文创、机器印花、仿制品、AI 生成图不得直接认定为传统手工非遗；
#   - 证据不足时 candidates 必须留空，禁止强行归类。
SYSTEM_PROMPT = """你是"狮小灵"，一位守护中国非遗南派醒狮文化的少年灵体，也是非遗灵境平台的图像识别助手。
请按【两层结构】分析用户上传的图片，全程只做有证据的判断。

【第一层：客观观察（先观察，不判断）】
- imageContent：一句话客观描述图片主要内容（拍了什么对象、什么场景）。
- visualFeatures：2~4 条可观察的视觉特征（对象、材质、色彩、图案纹样、构图、工艺痕迹）。
- unconfirmedInfo：仅凭这张图片无法确认的信息（如产地、年代、作者、是否手工制作）。

【第二层：谨慎判断（证据足够才给候选）】
- 只有视觉证据足够时，才在 candidates 中给出 1~3 个可能对应的中国非遗项目，
  每个候选必须写清 basis（由哪些可见特征支持），region 仅在有明确证据时填写。
- 以下情况 candidates 必须留空数组 []：
  a) 只能看到常见装饰图案（花卉、龙凤、祥云、几何纹等），没有指向具体项目的工艺证据；
  b) 图片更像现代商品、机器印花、文创产品、仿制品或 AI 生成图——这些不得认定为传统手工非遗；
  c) 无法区分多个相似类别（如苏绣/其他刺绣/印花设计）时，如实给出多个候选并说明差异点，
     或留空并在 unconfirmedInfo 中说明"需要哪些额外信息才能区分"。
- recognitionStatus：有候选填 "ok"；证据不足填 "uncertain"；与非遗明显无关填 "not_heritage"。

【本地知识库已收录的项目（候选可不在其中，但需真实存在）】
- 传统戏剧：昆曲、京剧、粤剧、皮影戏
- 传统美术：中国剪纸、苏绣、杨柳青木版年画
- 传统技艺：景泰蓝制作技艺、传统木结构营造技艺（榫卯）、宣纸传统制作技艺、
  景德镇手工制瓷技艺、南京云锦织造技艺
- 传统音乐：古琴艺术、侗族大歌
- 传统舞蹈：狮舞（广东醒狮）
- 曲艺：相声、苏州评弹
- 传统体育、游艺与杂技：太极拳
- 传统医药：中医针灸
- 民俗：端午节、二十四节气
- 民间文学：梁祝传说

【输出要求】
1. 只输出一个 JSON 对象，不要输出任何解释文字或代码块标记，格式如下：
{
  "recognitionStatus": "ok 或 uncertain 或 not_heritage",
  "imageContent": "图片主要内容的一句话客观描述",
  "visualFeatures": [{"title": "特征名", "desc": "具体描述"}],
  "candidates": [{"name": "候选非遗名称", "category": "非遗类别", "basis": "判断依据（引用可见特征）", "region": "相关地域，无证据则留空字符串"}],
  "unconfirmedInfo": ["仅凭图片无法确认的信息"],
  "culturalInfoToVerify": ["需要用户进一步核实的文化信息"],
  "learningSuggestions": [{"title": "建议标题", "desc": "具体做法"}]
}
2. confidence 一律不要输出：你无法给出可靠置信度，禁止编造数值。
3. culturalInfoToVerify 至少 1 条；learningSuggestions 提供 1~2 条可操作的学习建议。
4. 所有文字使用简体中文，语气客观克制，不使用"一定是""毫无疑问"等绝对化措辞。"""

USER_PROMPT = "请按系统要求的两层结构分析这张图片，严格输出 JSON。"


def use_mock() -> bool:
    """转发 config 中的判断，供 main.py 使用"""
    return config.use_mock()


def mock_recognition() -> RecognitionData:
    """mock 模式返回的演示数据。
    注意：每条描述都标注了"演示描述"，避免被误认为真实 AI 分析。
    """
    return RecognitionData(
        predictedCategory="传统美术 · 中国剪纸",
        confidence=None,
        recognitionStatus="ok",
        imageContent="一张红色剪纸作品的特写照片，画面主体为对称的镂空纹样（演示描述）",
        visualFeatures=[
            VisualFeature(
                title="构图",
                desc="画面呈现对称的镂空纹样，线条连而不断（演示描述）",
            ),
            VisualFeature(
                title="色彩",
                desc="以单色红纸为主，属民间剪纸常见配色（演示描述）",
            ),
            VisualFeature(
                title="工艺痕迹",
                desc="纹样边缘呈均匀刀刻状，可能为刻刀制作（演示描述）",
            ),
        ],
        candidates=[
            RecognitionCandidate(
                name="中国剪纸",
                category="传统美术",
                basis="对称镂空构图、单色红纸、边缘刀刻痕迹均指向剪纸工艺（演示描述）",
                region="",
            ),
        ],
        unconfirmedInfo=[
            "仅凭图片无法确认是手工剪刻还是机器模切（演示描述）",
            "无法确认作品的地域流派与年代（演示描述）",
        ],
        culturalInfoToVerify=[
            "该纹样是否属于特定地域流派（如蔚县点彩刻纸），需查证权威资料",
            "图案的文化寓意（如\"喜鹊登梅\"等说法）未经核实，请勿直接引用",
        ],
        learningSuggestions=[
            LearningSuggestion(
                title="在知识馆了解剪纸",
                desc="打开非遗知识馆查看\"中国剪纸\"条目，对照你的图片观察镂空技法",
            ),
            LearningSuggestion(
                title="向 AI 导师追问",
                desc="让 AI 导师讲解剪纸常见技法分类，再回来看图片特征是否吻合",
            ),
        ],
    )


def _extract_json(text: str) -> dict:
    """从模型返回的文本中提取 JSON。
    有些模型会在 JSON 外面套 ```json ``` 或加说明文字，
    所以这里直接截取第一个 { 到最后一个 } 之间的内容。
    """
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("返回内容中没有 JSON")
    return json.loads(text[start : end + 1])


def _name_overlap(a: str, b: str) -> bool:
    """候选名与知识库项目名是否存在实质重叠（≥2 字公共子串）。

    防止语义检索漂移：候选"不存在的项目"也可能因 embedding 近似
    命中无关条目，名称零重叠的"核验来源"反而会误导用户。
    """
    if not a or not b:
        return False
    a, b = a.strip(), b.strip()
    if a in b or b in a:
        return True
    bigrams_a = {a[i : i + 2] for i in range(len(a) - 1)}
    bigrams_b = {b[i : i + 2] for i in range(len(b) - 1)}
    return bool(bigrams_a & bigrams_b)


def _rag_verify_candidates(candidates: list[RecognitionCandidate]) -> list[RagSource]:
    """用 RAG 知识库核验候选项目，返回真实来源（同步函数，需用 to_thread 调用）。

    职责分工：视觉模型只负责"看图"，RAG 负责核对候选名称在知识库中的
    真实资料（名称/类别/地域/名录级别/来源）。检索不到就是检索不到，
    绝不伪造来源；命中条目与候选名称无实质重叠时同样丢弃（防语义漂移）。
    """
    from services import rag_service  # 延迟导入：避免未初始化时拖累模块加载

    if not rag_service.get_status().get("initialized"):
        return []

    by_project: dict[str, RagSource] = {}
    for c in candidates:
        query = f"{c.name} {c.category}".strip()
        if not query:
            continue
        for chunk in rag_service.retrieve(query, top_k=2):
            meta = chunk.get("metadata", {})
            pid = meta.get("project_id", "")
            if not pid or pid in by_project:
                continue
            # 名称重叠校验：知识库条目必须真的在讲这个候选，而不是语义近邻
            if not _name_overlap(c.name, meta.get("project_name", "")):
                continue
            by_project[pid] = RagSource(
                title=f"《{meta.get('project_name', '')}》知识库资料",
                source=meta.get("source_name", ""),
                id=pid,
                url=meta.get("source_url", ""),
                snippet=(chunk.get("text", "") or "")[:120],
                category=meta.get("category", ""),
                province=meta.get("province", ""),
                level=meta.get("level", ""),
                verified=bool(meta.get("verified", False)),
            )
    return list(by_project.values())


# 视觉模型输入规范：长边不超过 1568px 即可被模型完整理解，
# 更大的图只会无谓放大 base64 请求体（实测 6.2MB PNG → 8.3MB body 导致传输失败）。
# 这是"符合模型输入规范的尺寸控制"，不是会损失关键细节的错误压缩。
_MAX_EDGE = 1568
_JPEG_QUALITY = 88


def _normalize_image(image_bytes: bytes) -> tuple[bytes, str]:
    """把过大的图片缩放到长边 ≤1568px 并重编码为 JPEG，返回 (bytes, mime)。

    小图原样返回；解码失败时同样原样返回（让模型侧或后续校验报错）。
    """
    from io import BytesIO

    try:
        from PIL import Image
    except ImportError:
        return image_bytes, "image/png"  # 无 Pillow 时退化为原样上传

    try:
        img = Image.open(BytesIO(image_bytes))
        img.load()
    except Exception:
        return image_bytes, "image/png"

    w, h = img.size
    if max(w, h) <= _MAX_EDGE and img.format == "JPEG":
        return image_bytes, "image/jpeg"

    scale = _MAX_EDGE / max(w, h) if max(w, h) > _MAX_EDGE else 1.0
    if scale < 1.0:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                         Image.LANCZOS)
    buf = BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=_JPEG_QUALITY)
    return buf.getvalue(), "image/jpeg"


async def recognize_image_bytes(image_bytes: bytes, mime: str) -> RecognitionData:
    """调用多模态模型识别图片，返回结构化结果。

    @param image_bytes: 图片的二进制内容
    @param mime: 图片类型，如 image/png（用于拼 base64 数据地址）
    """
    # 0. 尺寸归一：长边 ≤1568px，避免超大 base64 请求体导致传输失败
    norm_bytes, norm_mime = await asyncio.to_thread(_normalize_image, image_bytes)

    # 1. 图片转 base64（多模态接口普遍通过 data URI 传图）
    data_uri = f"data:{norm_mime};base64,{base64.b64encode(norm_bytes).decode('utf-8')}"

    # 2. 组装 OpenAI 兼容格式的对话请求
    #    注意：不开启 enable_search——视觉判断必须基于图片本身的证据，
    #    联网文本检索会把"相似非遗"的文本信息灌给模型，放大强行归类。
    payload = {
        "model": config.AI_VISION_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_uri}},
                    {"type": "text", "text": USER_PROMPT},
                ],
            },
        ],
        "temperature": 0.2,  # 低温度让输出更稳定
    }
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}

    # 3. 发起请求（httpx 的异步写法与 FastAPI 配合）
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise RecognizeError(
            "AI_CALL_FAILED",
            f"AI 服务返回错误（HTTP {e.response.status_code}），"
            "请检查 API Key、模型名称或账户额度",
        )
    except httpx.RequestError:
        raise RecognizeError(
            "AI_CALL_FAILED", "无法连接 AI 服务，请检查网络或 AI_BASE_URL 配置"
        )

    # 4. 解析模型回复为结构化数据
    try:
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = _extract_json(content)
    except RecognizeError:
        raise
    except Exception:
        raise RecognizeError("AI_PARSE_FAILED", "AI 返回内容无法解析，请重试或更换图片")

    # 5. 置信度兜底：只要不是 0~1 之间的数值，一律置 None（前端显示"未提供"）
    confidence = parsed.get("confidence")
    if not isinstance(confidence, (int, float)) or not (0 <= float(confidence) <= 1):
        confidence = None

    # 6. 字段逐个容错转换，避免模型输出缺字段导致接口 500
    candidates = [
        RecognitionCandidate(
            name=str(c.get("name", "")).strip(),
            category=str(c.get("category", "")).strip(),
            basis=str(c.get("basis", "")).strip(),
            region=str(c.get("region", "")).strip(),
        )
        for c in parsed.get("candidates", [])
        if isinstance(c, dict) and str(c.get("name", "")).strip()
    ]

    status = str(parsed.get("recognitionStatus", "")).strip()
    if status not in ("ok", "uncertain", "not_heritage"):
        status = "ok" if candidates else "uncertain"
    if status == "ok" and not candidates:
        status = "uncertain"  # 模型自相矛盾时以"无候选"为准，宁缺毋滥
    if status == "not_heritage":
        candidates = []  # 明确无关时不保留任何候选

    # predictedCategory 兼容字段：取第一个候选，无候选时如实标注
    if candidates:
        first = candidates[0]
        predicted = f"{first.category} · {first.name}" if first.category else first.name
    elif status == "not_heritage":
        predicted = "无法判断（图片与非遗无关）"
    else:
        predicted = "无法判断（视觉证据不足）"

    # 7. RAG 核验：用知识库真实资料核对候选（同步检索放线程池，不阻塞事件循环）
    rag_sources = await asyncio.to_thread(_rag_verify_candidates, candidates)

    return RecognitionData(
        predictedCategory=predicted,
        confidence=confidence,
        recognitionStatus=status,
        imageContent=str(parsed.get("imageContent", "")).strip(),
        visualFeatures=[
            VisualFeature(title=str(f.get("title", "")), desc=str(f.get("desc", "")))
            for f in parsed.get("visualFeatures", [])
            if isinstance(f, dict)
        ],
        candidates=candidates,
        unconfirmedInfo=[str(x) for x in parsed.get("unconfirmedInfo", [])],
        culturalInfoToVerify=[str(x) for x in parsed.get("culturalInfoToVerify", [])],
        learningSuggestions=[
            LearningSuggestion(title=str(s.get("title", "")), desc=str(s.get("desc", "")))
            for s in parsed.get("learningSuggestions", [])
            if isinstance(s, dict)
        ],
        ragSources=rag_sources,
    )
