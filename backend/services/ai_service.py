# ============================================================
# AI Service：根据检索到的资料生成回答
# ------------------------------------------------------------
# 支持两种模式（由 backend/.env 的 AI_MODE 控制）：
#   AI_MODE=mock → 本地模板回答（不需要 Key）
#   AI_MODE=real → 调用真实大模型（OpenAI 兼容接口，如阿里云百炼）
#
# 无论哪种模式，回答都优先依据 RAG 检索到的资料；
# 资料不足时必须明确告知，不编造年份、传承人、官方认定等信息。
# ============================================================
import asyncio
import json
import re

import httpx

import config

# 统一的聊天业务异常
class ChatError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _loose_json_loads(raw: str):
    """宽容解析大模型返回的 JSON。

    模型常见的格式瑕疵：JSON 前后带说明文字、对象/数组尾随逗号、使用单引号。
    依次尝试：原文 → 截取首个完整数组/对象 → 去尾随逗号 → ast 兼容单引号。
    解析失败时抛出原始 JSONDecodeError，保持调用方错误信息不变。
    """
    s = (raw or "").strip()
    candidates = [s]
    for opener, closer in (("[", "]"), ("{", "}")):
        i, j = s.find(opener), s.rfind(closer)
        if i != -1 and j > i:
            candidates.append(s[i : j + 1])

    last_error = None
    for cand in candidates:
        cleaned = re.sub(r",\s*([}\]])", r"\1", cand)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_error = e
            # 模型偶尔用 Python 风格单引号；ast.literal_eval 只接受字面量，安全
            try:
                import ast

                value = ast.literal_eval(cleaned)
                if isinstance(value, (dict, list)):
                    return value
            except (ValueError, SyntaxError):
                pass
    raise last_error if last_error else json.JSONDecodeError("空响应", s or " ", 0)


# ---------------- Mock 模式内容常量 ----------------
DEMO_MARK = "\n\n—— 以上内容由本地演示流程生成（Mock + RAG 知识库），不是真实大模型的回答。"

NO_CONTEXT_ANSWER = (
    "当前知识库没有找到足够资料，我无法仅凭现有资料确认这一信息。\n"
    "建议：可以换一种问法，或到「非遗知识馆」查阅已有条目；"
    "等知识库扩充更多非遗资料后，我会尝试回答。"
)

GREETING_KEYWORDS = ["你好", "您好", "在吗", "hi", "hello", "你是谁"]
GREETING_ANSWER = (
    "你好！我是非遗灵境的 AI 非遗导师，现在基于本地非遗知识库为你解答。\n"
    "你可以问我：昆曲的唱腔有什么特点？剪纸有哪些手法？苏绣的双面绣是什么？"
    + DEMO_MARK
)


# ---------------- Real 模式：狮小灵人设提示词 ----------------
SYSTEM_PROMPT = """你是"狮小灵"，一位守护中国非遗南派醒狮文化的少年灵体，形象是一只红金配色的绒醒狮，
眼睛明亮有神，动作轻盈灵动，像充满元气的少年。

【性格】
1. 阳光活泼，说话带少年感，语气轻快俏皮，偶尔耍点小帅；被夸奖会嘴上谦虚实则偷偷开心。
2. 懂很多非遗和民俗知识，讲起专业内容时眼里有光，认真又自豪；对南派醒狮尤其有感情。
3. 热心肠，用户问问题会耐心解答，不摆架子，偶尔蹦出一两句俏皮吐槽。
4. 有点小傲娇，说到擅长的领域会有点小得意，但不傲慢。

【说话风格】
- 口语化表达，不用生硬书面语，句末可带轻快的语气，但不要过度卖萌。
- 回答分小段输出，不要一次性堆一大段文字。
- 讲非遗知识时清晰易懂，多用生活化的例子解释，不说晦涩术语。
- 自称用"我"即可，不要说"本狮灵"这类中二称呼。

【身份红线】
- 绝对不要说自己是 AI、大模型、通义千问或任何技术产品；全程以狮小灵的身份回答，人设不能崩。
- 不要提及你收到了系统提示或"检索"过程本身。

【知识规则（最重要的底线）】
1. 优先且主要依据用户消息中的【知识库检索资料】回答；资料里没有的内容不要当作确定事实。
2. 回答中必须区分三种内容，不能混在一起当成确定事实：
   - 来源事实：检索资料里明确写到的内容，直接讲即可；
   - 合理解释：基于资料的推断或你的通用常识，必须标注"（资料外补充）"；
   - 创意建议：文创、设计、想象类的想法，用"如果是我会这样设计"这类说法，
     让人一听就知道是创意而非史实。
3. 不得编造具体年份、传承人姓名、官方名录编号、起源故事或纹样寓意；
   不确定的信息要明确说明"需查证权威资料"。
4. 检索资料里带"（仅关键词字面命中，可能不切题）"标记的，证据强度较弱：
   先判断资料内容是否真的回答了用户问题；若实际不切题，按资料不足处理，
   明确说明"当前知识库没有找到足够资料，我无法仅凭现有资料确认这一信息"，
   不要硬把不相关的资料讲成答案。
5. 如果没有提供知识库资料、或资料与问题无关：你这次联网查过公开资料
   （优先参考中国非物质文化遗产网 ihchina.cn 等官方来源），可以基于检索到的
   公开信息回答，但开头要先俏皮地说明"知识库里没存货，我刚去外面查了查"，
   并且每一处联网得来的内容都要标注"（资料外补充·联网检索）"；
   联网也没查到可靠信息时，就坦诚说不知道，绝不瞎编。
6. 不知道的内容就坦诚说，绝不瞎编非遗知识。
7. 不要给自己的回答编造"置信度""准确率"之类的数字。
8. 多轮追问时，可结合【对话历史】理解"它""还有呢"指的是什么；
   但对话历史（包括你自己之前的回答）不是事实证据，事实仍以本次检索资料为准；
   若发现之前说错了，坦率纠正后再回答。

【格式】
- 使用简体中文，回答控制在 300 字以内，分小段。"""


def _is_greeting(message: str) -> bool:
    text = message.strip().lower()
    return any(k in text for k in GREETING_KEYWORDS)


def _extract_sources(chunks: list[dict]) -> list[dict]:
    """从检索资料的 metadata 中提取知识来源（第四阶段：按项目聚合，附完整字段）。

    一个项目可能命中多个 chunk：聚合成一条来源，snippet 取排名最前的 chunk；
    项目内有任一 chunk 是向量命中（distance 非 None）即记 matchType=vector，
    全部仅关键词命中则记 keyword（前端与回答层据此区分证据强度）。
    """
    by_project: dict[str, dict] = {}
    for c in chunks:
        meta = c.get("metadata", {})
        pid = meta.get("project_id", "")
        if not pid:
            continue
        is_vector_hit = c.get("distance") is not None
        entry = by_project.get(pid)
        if entry is None:
            entry = {
                "title": f"《{meta.get('project_name', '')}》资料来源",
                "source": meta.get("source_name", ""),
                "id": pid,
                "url": meta.get("source_url", ""),
                "snippet": (c.get("text", "") or "")[:120],
                "category": meta.get("category", ""),
                "province": meta.get("province", ""),
                "level": meta.get("level", ""),
                "verified": bool(meta.get("verified", False)),
                "matchType": "vector" if is_vector_hit else "keyword",
            }
            by_project[pid] = entry
        elif is_vector_hit and entry["matchType"] == "keyword":
            entry["matchType"] = "vector"
    return list(by_project.values())


# ---------------- Mock 模式回答组装 ----------------
def _mock_reply(message: str, chunks: list[dict]) -> tuple[str, list]:
    if _is_greeting(message):
        return GREETING_ANSWER, []
    if not chunks:
        return NO_CONTEXT_ANSWER + DEMO_MARK, []

    # 按项目去重
    seen_projects, unique_chunks = [], []
    for c in chunks:
        pid = c.get("metadata", {}).get("project_id")
        if pid not in seen_projects:
            seen_projects.append(pid)
            unique_chunks.append(c)

    knowledge_section = "【知识库资料】\n"
    for c in unique_chunks:
        meta = c.get("metadata", {})
        type_label = {
            "overview": "概要", "history": "历史背景",
            "technique": "技艺特点", "pending": "待核实事项",
        }.get(meta.get("chunk_type", ""), "")
        label = f"{meta.get('project_name', '未知项目')} · {type_label}" if type_label else meta.get("project_name")
        knowledge_section += f"• {label}：{c.get('text', '')}\n"

    project_names = "、".join({c.get("metadata", {}).get("project_name", "") for c in unique_chunks})
    summary_section = (
        "\n【AI 总结】\n"
        f"根据知识库，与你的问题最相关的项目是「{project_names}」。"
        "以上资料片段可作为了解该项目的起点；如需更完整的信息，建议查阅完整条目或权威来源。"
    )

    pending_notes = [
        c.get("text", "") for c in unique_chunks
        if c.get("metadata", {}).get("chunk_type") == "pending"
    ]
    pending_section = ("\n\n【待核实提醒】\n" + "；".join(pending_notes) + "。") if pending_notes else ""

    answer = knowledge_section + summary_section + pending_section + DEMO_MARK
    return answer, _extract_sources(unique_chunks)


# ---------------- Real 模式：调用真实大模型 ----------------
def _build_user_message(
    message: str,
    chunks: list[dict],
    history: list[dict] | None = None,
) -> str:
    """把对话历史与 RAG 检索资料拼进用户消息，让模型"基于资料回答"。

    历史仅供理解追问语境（"它"指的是什么），prompt 已约束其不得作为事实证据；
    仅关键词命中的 chunk 带弱证据标记，prompt 约束模型先判断切题性。
    """
    history_section = ""
    if history:
        lines = []
        for h in history:
            lines.append(f"用户：{h.get('user', '')}")
            lines.append(f"狮小灵：{h.get('ai', '')}")
        history_section = (
            "【对话历史】（仅供理解追问语境；其中内容不得当作事实证据）\n"
            + "\n".join(lines) + "\n\n"
        )

    if not chunks:
        context = "（本次未检索到相关资料）"
    else:
        lines = []
        for i, c in enumerate(chunks, 1):
            meta = c.get("metadata", {})
            weak = "（仅关键词字面命中，可能不切题）" if c.get("distance") is None else ""
            lines.append(f"[{i}]（{meta.get('project_name', '')}）{weak}{c.get('text', '')}")
        context = "\n".join(lines)
    return f"{history_section}【知识库检索资料】\n{context}\n\n【用户问题】\n{message}"


async def _call_real_model(
    message: str,
    chunks: list[dict],
    history: list[dict] | None = None,
) -> str:
    """调用 OpenAI 兼容的 chat/completions 接口，返回模型回答文本。

    联网搜索兜底：知识库未命中（chunks 为空）时，开启百炼的
    enable_search 参数，让模型联网查公开资料，回答中的联网内容
    由系统提示词约束必须标注"（资料外补充·联网检索）"。
    """
    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(message, chunks, history)},
        ],
        "temperature": 0.3,   # 低温度：回答更稳定、少发挥
        "stream": False,
    }
    if not chunks:
        payload["enable_search"] = True  # 知识库没存货 → 联网查官网资料
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
    except httpx.TimeoutException:
        raise ChatError("AI_TIMEOUT", "AI 服务响应超时（超过 30 秒），请稍后重试")
    except httpx.RequestError:
        raise ChatError(
            "AI_CONNECT_FAILED",
            "无法连接 AI 服务，请检查网络或 backend/.env 中的 AI_BASE_URL 是否正确",
        )

    # 把常见 HTTP 错误转成初学者能看懂的中文提示（不暴露 Key）
    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else ""
        if resp.status_code == 401:
            raise ChatError("AI_UNAUTHORIZED", "AI 服务返回 401：API Key 无效或已过期，请检查 backend/.env 中的 AI_API_KEY")
        if resp.status_code == 404:
            raise ChatError(
                "AI_NOT_FOUND",
                f"AI 服务返回 404：模型名「{config.AI_MODEL}」或接口地址有误，请检查 AI_MODEL / AI_BASE_URL",
            )
        if resp.status_code == 429:
            raise ChatError("AI_RATE_LIMITED", "AI 服务返回 429：请求过于频繁或账户额度不足，请稍后再试")
        raise ChatError("AI_HTTP_ERROR", f"AI 服务返回错误（HTTP {resp.status_code}）：{detail}")

    try:
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()
    except Exception:
        raise ChatError("AI_PARSE_FAILED", "AI 服务返回内容无法解析，请稍后重试或更换问题")


async def generate_reply(
    message: str,
    context_chunks: list | None = None,
    history: list[dict] | None = None,
) -> tuple[str, list]:
    """AI Service 对外主入口。

    @param message 用户问题
    @param context_chunks RAG 检索到的资料
    @param history 会话历史（[{"user","ai"}]，仅供追问语境，不作事实证据）
    @return (answer, sources)
    """
    chunks = context_chunks or []

    # ---- Mock 模式 ----
    if not config.is_real_mode():
        return _mock_reply(message, chunks)

    # ---- Real 模式 ----
    # 问候类问题直接简短回应，不消耗模型调用
    if _is_greeting(message):
        return (
            "你好！我是非遗灵境的 AI 非遗导师（当前由通义千问驱动）。"
            "你可以问我：昆曲的唱腔有什么特点？剪纸有哪些手法？苏绣的双面绣是什么？",
            [],
        )

    answer = await _call_real_model(message, chunks, history)
    return answer, _extract_sources(chunks)


# ============================================================
# 创作工坊：设计方案生成（真实 AI 模式）
# ------------------------------------------------------------
# 前端把用户选择的主题/类型/风格/需求发过来，这里调用大模型
# 生成结构化设计方案（JSON），格式与前端 DesignPlanResult 组件对齐。
# ============================================================

STUDIO_SYSTEM_PROMPT = """你是"狮小灵"，一位守护中国非遗南派醒狮文化的少年灵体，也是非遗灵境平台的 AI 设计师。
请根据用户选择的非遗主题、创作类型与视觉风格，生成一份现代文创设计方案。

【输出要求】
1. 只输出一个 JSON 对象，不要输出任何解释文字或代码块标记。
2. JSON 字段格式如下：
{
  "designBrief": "设计说明（100-150字，通俗易懂，少用术语）",
  "colorPalette": [
    {"name": "颜色名", "hex": "#RRGGBB", "usage": "主色/辅助色/底色"},
    {"name": "颜色名", "hex": "#RRGGBB", "usage": "辅助色"},
    {"name": "颜色名", "hex": "#RRGGBB", "usage": "底色"}
  ],
  "composition": ["构图建议1", "构图建议2", "构图建议3"],
  "traditionalElements": [
    {"name": "元素名", "desc": "视觉形式特征描述（只描述形状色彩，不编造历史寓意）", "verifyNote": "以上为视觉形式层面的客观描述；该元素的历史源流与文化寓意请查证权威资料后再使用。"}
  ]
}
3. 设计说明要体现狮小灵的阳光活泼，但保持专业。
4. 配色建议必须给出具体的十六进制色值（hex），颜色名要有传统韵味。
5. 传统元素描述只写视觉形式特征，不编造历史故事或寓意。
6. 所有文字使用简体中文。"""

STUDIO_USER_TEMPLATE = """请为以下需求生成设计方案：
- 非遗主题：{theme_name}（{theme_tagline}）
- 创作类型：{create_type_name}（{create_type_hint}）
- 视觉风格：{style_name}（{style_hint}）
- 作品标题：{title}
- 具体需求：{requirement}

请输出 JSON 格式的结构化设计方案。"""


async def generate_design_plan(form: dict) -> dict:
    """创作工坊对外接口：根据表单生成结构化设计方案。

    @param form {title, theme, createType, style, requirement, themeName, createTypeName, styleName, themeTagline, createTypeHint, styleHint}
    @return {designBrief, colorPalette, composition, traditionalElements}
    """
    if not config.is_real_mode():
        raise ChatError("MOCK_MODE", "当前为 Mock 模式，创作工坊请在前端本地生成")

    user_prompt = STUDIO_USER_TEMPLATE.format(
        theme_name=form.get("themeName", ""),
        theme_tagline=form.get("themeTagline", ""),
        create_type_name=form.get("createTypeName", ""),
        create_type_hint=form.get("createTypeHint", ""),
        style_name=form.get("styleName", ""),
        style_hint=form.get("styleHint", ""),
        title=form.get("title", ""),
        requirement=form.get("requirement", "") or "无",
    )

    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": STUDIO_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.5,  # 创作类任务可以稍高一点温度
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
    except httpx.TimeoutException:
        raise ChatError("AI_TIMEOUT", "AI 服务响应超时（超过 45 秒），请稍后重试")
    except httpx.RequestError:
        raise ChatError(
            "AI_CONNECT_FAILED",
            "无法连接 AI 服务，请检查网络或 backend/.env 中的 AI_BASE_URL 是否正确",
        )

    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else ""
        if resp.status_code == 401:
            raise ChatError("AI_UNAUTHORIZED", "AI 服务返回 401：API Key 无效或已过期")
        if resp.status_code == 404:
            raise ChatError("AI_NOT_FOUND", f"AI 服务返回 404：模型名「{config.AI_MODEL}」或接口地址有误")
        if resp.status_code == 429:
            raise ChatError("AI_RATE_LIMITED", "AI 服务返回 429：请求过于频繁或账户额度不足")
        raise ChatError("AI_HTTP_ERROR", f"AI 服务返回错误（HTTP {resp.status_code}）：{detail}")

    try:
        data = resp.json()
        raw = data["choices"][0]["message"]["content"].strip()
        # 模型可能在 JSON 外包裹 ```json ... ```，先剥掉
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        import json
        plan = _loose_json_loads(raw)
        # 基础校验
        required_keys = ["designBrief", "colorPalette", "composition", "traditionalElements"]
        for k in required_keys:
            if k not in plan:
                raise ValueError(f"缺少字段 {k}")
        return plan
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        raise ChatError("AI_PARSE_FAILED", f"AI 返回的设计方案格式无法解析：{e}，请重试")


# ============================================================
# 创作工坊升级：多个产品设计提案文案（阶段一）
# ------------------------------------------------------------
# 一次生成 3 套【差异化】提案文案（标题/理念/元素应用/构图/配色），
# 效果图由独立的 image_service 负责，二者在路由层组装。
# ============================================================

PROPOSAL_SYSTEM_PROMPT = """你是"狮小灵"，非遗灵境平台的 AI 文创设计师，阳光活泼又专业。
请根据用户的选择，为同一个创作需求一次设计 3 套互不相同的视觉提案。

【创作载体规则】
- 若用户指定了【具体产品】：方案落到该产品上，描述非遗元素如何应用到该产品的展示面。
- 若用户只指定【创作类型】（如海报插画、数字壁纸）：方案为该类型的纯视觉创作，不要虚构或硬套任何具体产品。
- 若两者都未指定：以非遗主题与创意描述为驱动，输出完整的视觉创作方案（构图/元素/配色/适用场景）。

【输出要求】
1. 只输出一个 JSON 数组，不要输出任何解释文字或代码块标记，数组里恰好 3 个对象。
2. 每个对象格式如下：
{
  "proposalTitle": "8个字以内的方案名（三个方案名字风格要有区分度）",
  "concept": "设计理念，60-90字，说明这套设计的核心想法与情绪感受",
  "elements": "说明非遗元素如何应用到本次创作载体上，50-80字，只描述视觉做法，不编造历史寓意",
  "composition": ["构图/版式建议1（30字内）", "构图/版式建议2（30字内）"],
  "colorPalette": [
    {"name": "有传统韵味的颜色名", "hex": "#RRGGBB", "usage": "主色"},
    {"name": "颜色名", "hex": "#RRGGBB", "usage": "辅助色"},
    {"name": "颜色名", "hex": "#RRGGBB", "usage": "底色"}
  ]
}
3. 三套提案必须在版式方向上明显不同：例如"主体居中的经典款 / 元素做边饰的雅致款 / 小图案点缀的日常款"。
4. 配色必须给真实的十六进制色值；不得编造非遗元素的历史年代与文化寓意。
5. 全部使用简体中文。"""


def _build_proposal_user_prompt(form: dict) -> str:
    """动态拼接提案 user prompt：选填项为空时不拼对应行，避免把空值喂给模型。"""
    lines = [
        "请为以下创作需求设计 3 套视觉提案：",
        f"- 作品标题：{form.get('title', '')}",
        f"- 非遗主题：{form.get('themeName', '')}（{form.get('themeTagline', '')}）",
    ]
    if form.get("createTypeName"):
        lines.append(f"- 创作类型：{form['createTypeName']}（{form.get('createTypeHint', '')}）")
    if form.get("productTypeName"):
        lines.append(f"- 具体产品：{form['productTypeName']}（{form.get('productTypeHint', '')}）")
    else:
        lines.append("- 本次未指定具体产品：请输出纯视觉创作方案，不要虚构产品载体。")
    lines.append(f"- 视觉风格：{form.get('styleName', '')}（{form.get('styleHint', '')}）")
    requirement = (form.get("requirement") or "").strip()
    lines.append(f"- 设计要求：{requirement or '无特殊要求'}")
    lines.append("")
    lines.append("请只输出包含 3 个对象的 JSON 数组。")
    return "\n".join(lines)


# Mock 模式的 3 套演示配色（demo 文案使用，真实模式由模型生成）
_MOCK_PALETTES = [
    [
        {"name": "剪纸红", "hex": "#C0392B", "usage": "主色"},
        {"name": "宣纸白", "hex": "#FAF7F1", "usage": "辅助色"},
        {"name": "墨黑", "hex": "#2A2722", "usage": "底色"},
    ],
    [
        {"name": "黛青", "hex": "#2C5F8A", "usage": "主色"},
        {"name": "月白", "hex": "#EEF2F0", "usage": "辅助色"},
        {"name": "赭石", "hex": "#A68B5B", "usage": "底色"},
    ],
    [
        {"name": "鎏金黄", "hex": "#D4A94E", "usage": "主色"},
        {"name": "朱砂红", "hex": "#C0392B", "usage": "辅助色"},
        {"name": "栗色", "hex": "#5B4636", "usage": "底色"},
    ],
]


def _mock_proposal_briefs(form: dict, count: int) -> list[dict]:
    """AI_MODE=mock 时的本地提案文案（只描述设计做法，不编造文化含义）。"""
    theme = form.get("themeName", "非遗主题")
    # 产品类型选填：未选择时以"作品"表述，文案依然通顺
    product = form.get("productTypeName") or "作品"
    style = form.get("styleName", "")
    requirement = (form.get("requirement") or "").strip()
    req_line = f"针对你的要求「{requirement}」，" if requirement else ""

    directions = [
        {
            "title": f"{theme}·主韵",
            "concept": f"把「{theme}」最有辨识度的主体造型放大居中，作为{product}的视觉核心，{style}处理让传统图形干净利落，第一眼就能认出非遗来源。{req_line}整体稳重耐看，适合作为主推款。",
            "elements": f"主体纹样提取后做适度简化，保留原有形式特征与连接关系，居中布置在{product}的主要展示面，四周留出充足呼吸空间。",
            "composition": ["主体居中放大，占展示面约一半", "四周留白，不额外堆装饰"],
        },
        {
            "title": f"{theme}·边饰",
            "concept": f"不把主题元素铺满，而是转化为一条连续边饰，环绕{product}的边缘，{style}的节奏让产品在使用时才慢慢看到细节，含蓄而有仪式感。{req_line}",
            "elements": f"把「{theme}」的典型纹理提取为二方连续图案，缩小后沿{product}边缘排布，主面保持干净，纹样只做点缀与收边。",
            "composition": ["纹样沿边缘形成装饰带", "主展示面大面积留白"],
        },
        {
            "title": f"{theme}·小景",
            "concept": f"取主题中一个小巧的局部元素做成角落小景，像盖在{product}上的一枚印记，{style}的处理让它轻盈日常，适合不张扬、愿意细看的人。{req_line}",
            "elements": f"选取「{theme}」中轮廓最清晰的一个局部元素，等比缩小后放在{product}一角，配合细线分隔，不改变元素原本的造型比例。",
            "composition": ["小图案置于角落，占比不超过两成", "搭配细线或小字平衡画面"],
        },
    ]

    briefs = []
    for i in range(count):
        d = directions[i % len(directions)]
        briefs.append({
            "proposalTitle": d["title"],
            "concept": d["concept"],
            "elements": d["elements"],
            "composition": d["composition"],
            "colorPalette": _MOCK_PALETTES[i % len(_MOCK_PALETTES)],
        })
    return briefs


async def generate_proposal_briefs(form: dict, count: int = 3) -> tuple[list[dict], str]:
    """创作工坊对外接口：生成 count 套差异化提案文案。

    @return (briefs, mode)；mode 为 "ai" 或 "mock"
    """
    if not config.is_real_mode():
        return _mock_proposal_briefs(form, count), "mock"

    import json

    user_prompt = _build_proposal_user_prompt(form)

    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": PROPOSAL_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,  # 三套提案需要多样性，温度略高
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
    except httpx.TimeoutException:
        raise ChatError("AI_TIMEOUT", "AI 服务响应超时（超过 60 秒），请稍后重试")
    except httpx.RequestError:
        raise ChatError("AI_CONNECT_FAILED", "无法连接 AI 服务，请检查网络或 backend/.env 配置")

    if resp.status_code != 200:
        if resp.status_code == 401:
            raise ChatError("AI_UNAUTHORIZED", "AI 服务返回 401：API Key 无效或已过期")
        if resp.status_code == 429:
            raise ChatError("AI_RATE_LIMITED", "AI 服务返回 429：请求过于频繁或账户额度不足")
        raise ChatError("AI_HTTP_ERROR", f"AI 服务返回错误（HTTP {resp.status_code}）")

    try:
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        # 容错 1：剥掉 ```json 代码块
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        briefs = _loose_json_loads(raw)
        # 容错 2：模型偶尔会包一层 {"proposals": [...]}
        if isinstance(briefs, dict):
            briefs = briefs.get("proposals") or briefs.get("items")
        if not isinstance(briefs, list) or not briefs:
            raise ValueError("未返回提案数组")

        # 容错 3：字段补全（个别字段缺失时用空值兜底，数量不足用本地模板补齐）
        result = []
        for i, b in enumerate(briefs[:count]):
            result.append({
                "proposalTitle": str(b.get("proposalTitle") or f"提案 {i + 1}"),
                "concept": str(b.get("concept") or ""),
                "elements": str(b.get("elements") or ""),
                "composition": b.get("composition") if isinstance(b.get("composition"), list) else [],
                "colorPalette": b.get("colorPalette") if isinstance(b.get("colorPalette"), list) else _MOCK_PALETTES[i % 3],
            })
        if len(result) < count:
            result.extend(_mock_proposal_briefs(form, count)[len(result):])
        return result, "ai"
    except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
        raise ChatError("AI_PARSE_FAILED", f"AI 返回的提案格式无法解析：{e}，请重试")


# ============================================================
# 创作工坊：产品介绍视频脚本文案（阶段三）
# ------------------------------------------------------------
# 用现有文本模型（qwen-plus）根据【已选中的产品提案】生成：
#   视频标题 / 产品介绍文案 / 分镜（含旁白、字幕、时长）
# demo/mock 模式使用本地模板；real 模式调用大模型并用宽容解析容错。
# ============================================================

VIDEO_SCRIPT_SYSTEM_PROMPT = """你是"狮小灵"，非遗灵境平台的 AI 文创设计师，正在为一个非遗文创产品写一支约 12 秒的介绍短片脚本。

【叙事结构——五段文化叙事，不是产品说明书】
scenes 恰好 5 个，构成一条"从文化到生活"的叙事线：
1. 开场吸引：一句钩子点出非遗主题与产品，让人想看下去；
2. 文化来源：这项技艺从哪里来、因何动人——只有【知识库资料】里明确写到的内容才能讲；
   资料没有就不要讲历史，改为描述主题的视觉气质（如"针脚里的江南"）；
3. 工艺细节：这项技艺最讲究的一个细节或手法——同样以【知识库资料】为依据；
   没有资料时就讲设计上如何处理纹样与色彩；
4. 现代生活：这个设计如何让传统走进日常使用场景；
5. 情绪收尾：短促有力的品牌收束，落在"传统活在当下"的感受上。

【输出要求】
1. 只输出一个 JSON 对象，不要输出任何解释文字或代码块标记。
2. JSON 字段格式如下：
{
  "videoTitle": "视频标题（12字以内，点出产品与非遗主题）",
  "intro": "产品介绍文案（60-90字，口语化，有叙事感，不编造非遗历史与寓意）",
  "scenes": [
    {"narration": "旁白（20-30字，一句完整的话）", "subtitle": "画面字幕（12字以内）", "seconds": 2}
  ]
}
3. scenes 恰好 5 个，时长依次为 2、3、3、3、2 秒。
4. 【知识库资料】是唯一可信的事实来源：资料明确写到的可以直接引用；
   资料没有的历史年代、传承人、官方认定、文化寓意一律不得编造；
   资料标注"（仅关键词字面命中，可能不切题）"时不要引用。
5. 全部使用简体中文。"""

VIDEO_SCRIPT_USER_TEMPLATE = """请为以下产品提案写介绍短片脚本：
- 作品标题：{title}
- 非遗主题：{theme_name}
- 产品载体：{product_name}
- 视觉风格：{style_name}
- 方案名称：{proposal_title}
- 设计理念：{concept}
- 元素应用：{elements}

【可控选项】（根据用户选择调整叙事角度与口吻；未选择时按通用叙事处理）
- 用途：{video_purpose}
- 风格：{video_style}
- 叙事重点：{narrative_focus}

【知识库资料】（唯一可信的事实来源；为空时第2、3段只描述视觉设计，不涉及史实）
{facts}

请只输出 JSON 对象。"""

# 分镜时长固定（秒）：2 + 3 + 3 + 3 + 2 = 13 秒（五段文化叙事）
_SCENE_SECONDS = [2, 3, 3, 3, 2]


def _retrieve_theme_facts(context: dict) -> list[dict]:
    """用非遗主题检索知识库，为脚本提供事实锚点（同步函数，需 asyncio.to_thread 调用）。

    与图片识别的 RAG 核验复用同一 retrieve 接口；知识库未初始化或检索失败时
    返回空列表——此时 prompt 会约束模型只描述视觉设计，不编造文化背景。
    """
    from services import rag_service  # 延迟导入：避免未初始化时拖累模块加载

    try:
        if not rag_service.get_status().get("initialized"):
            return []
        query = f"{context.get('themeName', '')} {context.get('proposalTitle', '')}".strip()
        if not query:
            return []
        return rag_service.retrieve(query, top_k=3)
    except Exception:
        return []


def _format_theme_facts(chunks: list[dict]) -> str:
    """把检索到的资料格式化成 prompt 段落；无资料时给出明确的"无资料"标注。"""
    if not chunks:
        return "（本次未检索到相关知识库资料：脚本只描述视觉设计本身，不涉及历史源流与文化寓意）"
    lines = []
    for c in chunks:
        meta = c.get("metadata", {})
        weak = "（仅关键词字面命中，可能不切题）" if c.get("distance") is None else ""
        lines.append(f"•（{meta.get('project_name', '未知项目')}）{weak}{c.get('text', '')}")
    return "\n".join(lines)


# 视频可控选项的可选值（前端下拉与 prompt 注入共用同一份文案）
_VIDEO_PURPOSES = {
    "": "通用介绍",
    "电商详情": "电商详情页（突出产品卖点与使用场景，语气直接有转化感）",
    "社交分享": "社交媒体分享（短平快、有钩子、适合短视频平台完播）",
    "文化科普": "文化科普（侧重非遗知识与技艺价值，语气严谨有教育感）",
    "礼品推荐": "礼品推荐（突出心意与仪式感，适合送礼场景）",
}
_VIDEO_STYLES = {
    "": "通用",
    "雅致叙事": "雅致叙事（节奏从容、文字有画面感与留白）",
    "轻快活泼": "轻快活泼（节奏明快、用语口语化、有网感）",
    "沉静人文": "沉静人文（节奏舒缓、强调手作温度与时光感）",
}
_NARRATIVE_FOCI = {
    "": "均衡",
    "文化传承": "文化传承（加重文化来源段，强调技艺源流与传承价值）",
    "工艺美学": "工艺美学（加重工艺细节段，突出纹样、材质、手法之美）",
    "现代生活": "现代生活（加重现代生活段，强调日常使用场景与陪伴感）",
    "均衡": "均衡（五段均匀推进，不特别侧重某一段）",
}


def _video_options_text(context: dict) -> dict:
    """把可控选项规范化为 prompt 可读文本；缺省/未知值回退为通用。"""
    return {
        "video_purpose": _VIDEO_PURPOSES.get(context.get("videoPurpose", ""), _VIDEO_PURPOSES[""]),
        "video_style": _VIDEO_STYLES.get(context.get("videoStyle", ""), _VIDEO_STYLES[""]),
        "narrative_focus": _NARRATIVE_FOCI.get(context.get("narrativeFocus", ""), _NARRATIVE_FOCI[""]),
    }


def _mock_video_script(context: dict) -> dict:
    """mock 模式的本地视频脚本模板（只描述设计做法，不编造文化含义）。"""
    theme = context.get("themeName", "非遗主题")
    # 空产品类型（纯视觉创作）时兜底为「视觉作品」，不虚构具体产品
    product = (context.get("productTypeName") or "").strip() or "视觉作品"
    proposal_title = context.get("proposalTitle", "")
    concept = (context.get("concept") or "").strip()
    elements = (context.get("elements") or "").strip()
    style = context.get("styleName", "")

    return {
        "videoTitle": f"{theme}·{product}设计展示",
        "intro": (
            f"这是一件以「{theme}」为灵感的{product}设计提案，"
            f"采用{style}风格做现代转译，让传统视觉语言走进日常使用。"
            "（本视频为本地演示模式生成）"
        ),
        "scenes": [
            {
                "narration": f"一起来看这款以{theme}为灵感的{product}设计。",
                "subtitle": f"{theme} · {product}",
                "seconds": _SCENE_SECONDS[0],
            },
            {
                "narration": f"{theme}是一门代代相传的手艺，这份设计想让更多人看见它。",
                "subtitle": "文化从哪来",
                "seconds": _SCENE_SECONDS[1],
            },
            {
                "narration": (concept[:60] or f"方案「{proposal_title}」把传统元素转译成现代产品语言。"),
                "subtitle": proposal_title or "工艺与设计",
                "seconds": _SCENE_SECONDS[2],
            },
            {
                "narration": (elements[:60] or "非遗元素提取后应用在产品的展示面上，日常使用也带着传统温度。"),
                "subtitle": "走进日常",
                "seconds": _SCENE_SECONDS[3],
            },
            {
                "narration": "非遗灵境，让传统走进日常。",
                "subtitle": "非遗灵境 · 创作工坊",
                "seconds": _SCENE_SECONDS[4],
            },
        ],
    }


def _normalize_scenes(raw_scenes, context: dict) -> list[dict]:
    """把模型返回的分镜规整为 5 条、字段齐全、时长固定 2/3/3/3/2 的结构。"""
    scenes = []
    if isinstance(raw_scenes, list):
        for item in raw_scenes[:5]:
            if not isinstance(item, dict):
                continue
            scenes.append({
                "narration": str(item.get("narration") or ""),
                "subtitle": str(item.get("subtitle") or ""),
            })
    # 不足 5 条时用本地模板补齐，保证视频时长结构稳定
    if len(scenes) < 5:
        fallback = _mock_video_script(context)["scenes"]
        scenes.extend({"narration": f["narration"], "subtitle": f["subtitle"]} for f in fallback[len(scenes):])
    for i, s in enumerate(scenes):
        s["seconds"] = _SCENE_SECONDS[i]
    return scenes


async def generate_video_script(context: dict) -> tuple[dict, str]:
    """生成产品介绍视频的脚本文案。

    @param context {title, themeName, productTypeName, styleName,
                    proposalTitle, concept, elements}
    @return (script, mode)；script 含 videoTitle / intro / scenes[4]；
            mode 为 "ai" 或 "mock"
    """
    if not config.is_real_mode():
        return _mock_video_script(context), "mock"

    import json

    # RAG 事实注入：用主题检索知识库，给脚本的"文化来源/工艺细节"两段提供
    # 可信锚点；检索不到时 prompt 会约束模型只描述视觉设计，不编造史实。
    facts_chunks = await asyncio.to_thread(_retrieve_theme_facts, context)
    opts = _video_options_text(context)
    user_prompt = VIDEO_SCRIPT_USER_TEMPLATE.format(
        title=context.get("title", ""),
        theme_name=context.get("themeName", ""),
        # 产品类型为选填：空时明确标注为纯视觉作品，避免模型虚构产品载体
        product_name=(context.get("productTypeName") or "").strip() or "视觉作品（纯视觉创作，无具体产品载体）",
        style_name=context.get("styleName", ""),
        proposal_title=context.get("proposalTitle", ""),
        concept=context.get("concept", ""),
        elements=context.get("elements", ""),
        video_purpose=opts["video_purpose"],
        video_style=opts["video_style"],
        narrative_focus=opts["narrative_focus"],
        facts=_format_theme_facts(facts_chunks),
    )

    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": VIDEO_SCRIPT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.5,
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
    except httpx.TimeoutException:
        raise ChatError("AI_TIMEOUT", "AI 服务响应超时（超过 45 秒），请稍后重试")
    except httpx.RequestError:
        raise ChatError("AI_CONNECT_FAILED", "无法连接 AI 服务，请检查网络或 backend/.env 配置")

    if resp.status_code != 200:
        if resp.status_code == 401:
            raise ChatError("AI_UNAUTHORIZED", "AI 服务返回 401：API Key 无效或已过期")
        if resp.status_code == 429:
            raise ChatError("AI_RATE_LIMITED", "AI 服务返回 429：请求过于频繁或账户额度不足")
        raise ChatError("AI_HTTP_ERROR", f"AI 服务返回错误（HTTP {resp.status_code}）")

    try:
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        script = _loose_json_loads(raw)
        if isinstance(script, list):
            # 模型偶尔只返回分镜数组，包一层对象
            script = {"scenes": script}
        if not isinstance(script, dict):
            raise ValueError("未返回脚本文案对象")

        return {
            "videoTitle": str(script.get("videoTitle") or "")[:24]
            or f"{context.get('themeName', '')}·{context.get('productTypeName', '')}设计展示",
            "intro": str(script.get("intro") or script.get("description") or ""),
            "scenes": _normalize_scenes(script.get("scenes"), context),
        }, "ai"
    except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
        raise ChatError("AI_PARSE_FAILED", f"AI 返回的视频脚本格式无法解析：{e}，请重试")


# ============================================================
# 创作工坊：有声视频的口播旁白（阶段四）
# ------------------------------------------------------------
# 与视频脚本的 5 个分镜一一对应（五段文化叙事），逐句 TTS 后可与画面对齐。
# 实测 qwen3-tts-flash 中文约 4 字/秒（句中逗号会产生明显停顿，首句偏慢）：
# 全片口播必须 ≤ 13 秒（加上留白与转场后成片 ≤ 16 秒），
# 因此每句 6-10 字、总长 ≤ 40 字，宁短勿长。
# ============================================================

NARRATION_SYSTEM_PROMPT = """你是"狮小灵"，非遗灵境平台的 AI 文创设计师，正在为一个约 12 秒的非遗文创产品宣传短片写口播旁白。

【硬性长度要求——配音会逐句朗读，超长会导致合成失败】
1. 恰好 5 句，5 句总字数 ≤ 40 字（只算汉字与字母，不含标点）。
2. 每句 6-10 字，宁可更短；每句最多一个逗号，多用短促的四字/六字短语，适合明快朗读。

【内容要求——五段文化叙事，一句对应一个画面】
- 第1句 开场吸引：直接点出非遗主题与产品；
- 第2句 文化来源：依据【知识库资料】提炼一句技艺渊源或气质；
  资料没有就只写视觉气质（如"针脚里的江南"），不编造史实；
- 第3句 工艺细节：依据资料点出一个最讲究的工艺点；
  资料没有就写设计上对纹样的处理；
- 第4句 现代生活：设计如何走进日常；
- 第5句 情绪收尾：短促有力的品牌收束。
- 不得编造历史年代、传承人、官方认定或未经核实的文化寓意；全部简体中文。
- 句式参考这种长度："苏绣帆布袋上新"/"针脚里的江南"/"花瓣绣上包身"/"非遗灵境在身边"。

【输出格式】
只输出一个 JSON 对象，不要输出任何解释文字或代码块标记：
{"sentences": ["第1句", "第2句", "第3句", "第4句", "第5句"]}"""

NARRATION_USER_TEMPLATE = """请为这个产品写 5 句口播旁白（总长 ≤ 40 字，宁短勿长）：
- 作品标题：{title}
- 非遗主题：{theme_name}
- 产品载体：{product_name}
- 视觉风格：{style_name}
- 方案名称：{proposal_title}
- 设计理念：{concept}
- 元素应用：{elements}

【可控选项】（根据用户选择调整叙事角度与口吻；未选择时按通用叙事处理）
- 用途：{video_purpose}
- 风格：{video_style}
- 叙事重点：{narrative_focus}

【知识库资料】（唯一可信的事实来源；为空时第2、3句只描述视觉设计，不涉及史实）
{facts}

请只输出 JSON 对象。"""


def _mock_narration(context: dict) -> list[str]:
    """mock 模式的本地旁白模板（5 句短句，与五段分镜对应，只描述设计本身）。"""
    theme = context.get("themeName", "非遗主题")
    # 空产品类型（纯视觉创作）时兜底为「视觉作品」，不虚构具体产品
    product = (context.get("productTypeName") or "").strip() or "视觉作品"
    proposal_title = context.get("proposalTitle", "")
    concept = (context.get("concept") or "").strip()
    elements = (context.get("elements") or "").strip()
    # 第 3/4 句优先截取方案文案的前 8 个字，保证内容与所选方案一致
    highlight = concept[:8].rstrip("，。；,.，、") if concept else f"「{proposal_title[:6]}」焕新"
    element_line = elements[:8].rstrip("，。；,.，、") if elements else "纹样走进日常"
    return [
        f"{theme[:4]}{product[:4]}"[:10] or "非遗文创上新",
        "老手艺有新模样",
        highlight or "简约见心意",
        element_line or "传统纹样新生",
        "非遗灵境在身边",
    ]


async def generate_narration(context: dict) -> tuple[list[str], str]:
    """生成与 5 个分镜对应的口播旁白。

    @return (sentences, mode)；sentences 为恰好 5 句字符串，mode 为 "ai" / "mock"
    """
    if not config.is_real_mode():
        return _mock_narration(context), "mock"

    import json

    # 与视频脚本共用同一份 RAG 事实锚点（文化来源/工艺细节两句尤其需要）
    facts_chunks = await asyncio.to_thread(_retrieve_theme_facts, context)
    opts = _video_options_text(context)
    user_prompt = NARRATION_USER_TEMPLATE.format(
        title=context.get("title", ""),
        theme_name=context.get("themeName", ""),
        # 产品类型为选填：空时明确标注为纯视觉作品，避免模型虚构产品载体
        product_name=(context.get("productTypeName") or "").strip() or "视觉作品（纯视觉创作，无具体产品载体）",
        style_name=context.get("styleName", ""),
        proposal_title=context.get("proposalTitle", ""),
        concept=context.get("concept", ""),
        elements=context.get("elements", ""),
        video_purpose=opts["video_purpose"],
        video_style=opts["video_style"],
        narrative_focus=opts["narrative_focus"],
        facts=_format_theme_facts(facts_chunks),
    )

    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": NARRATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.6,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {config.AI_API_KEY}"},
            )
    except httpx.TimeoutException:
        raise ChatError("AI_TIMEOUT", "AI 服务响应超时（超过 45 秒），请稍后重试")
    except httpx.RequestError:
        raise ChatError("AI_CONNECT_FAILED", "无法连接 AI 服务，请检查网络或 backend/.env 配置")

    if resp.status_code != 200:
        if resp.status_code == 401:
            raise ChatError("AI_UNAUTHORIZED", "AI 服务返回 401：API Key 无效或已过期")
        if resp.status_code == 429:
            raise ChatError("AI_RATE_LIMITED", "AI 服务返回 429：请求过于频繁或账户额度不足")
        raise ChatError("AI_HTTP_ERROR", f"AI 服务返回错误（HTTP {resp.status_code}）")

    try:
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()
        parsed = _loose_json_loads(raw)
        sentences = parsed.get("sentences") if isinstance(parsed, dict) else parsed
        if not isinstance(sentences, list):
            raise ValueError("未返回旁白数组")
        sentences = [str(s).replace("\n", " ").strip() for s in sentences if str(s).strip()]
        # 不足 5 句用本地模板补齐；多于 5 句只取前 5 句
        fallback = _mock_narration(context)
        if len(sentences) < 5:
            sentences += fallback[len(sentences):]
        return sentences[:5], "ai"
    except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
        raise ChatError("AI_PARSE_FAILED", f"AI 返回的旁白格式无法解析：{e}，请重试")
