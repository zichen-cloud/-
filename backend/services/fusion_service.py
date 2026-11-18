# ============================================================
# Fusion Service：多非遗跨文化融合创作（阶段三）
# ------------------------------------------------------------
# 与"单一非遗创作"（studio_service）并列的独立业务逻辑：
#   1. 对用户选择的 2-3 项非遗，先做【文化要素拆解】（各自纹样、色彩、
#      工艺、可融合点），再产出【融合方案】——明确标注哪些元素来自哪一项、
#      如何融合、创新点是什么，避免元素堆砌；
#   2. 复用 image_service 生成效果图，复用既有 3D / 视频链路做后续展示。
#
# 融合比例（ratios）：控制"主次关系"而不是图片叠加透明度，
# 会转换成提示词里的强调程度（如"以剪纸为主，青花为辅"）。
# ============================================================
import json
import re

import httpx

import config
from services import image_service, rag_service

MAX_HERITAGES = 3
MIN_HERITAGES = 2


class FusionError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


FUSION_SYSTEM_PROMPT = """你是非遗灵境平台的 AI 文创设计师，专长是「跨文化融合设计」。

你的任务不是把两件东西拼在一起，而是先读懂每项非遗的文化语言，再找到它们之间真正能对话的部分。

【必须遵守】
1. 只依据【知识库资料】描述非遗事实（历史、工艺、纹样、色彩）；资料没写的内容不要编造。
2. 每个方案必须清楚交代：哪些元素来自第一项非遗、哪些来自第二项（或第三项）、两者如何结合、
   创新点在哪里。禁止只说"融合了两种文化"这种空话。三项融合时，第三项的元素必须放进 fromC。
   参与融合的非遗数量与用户选择严格一致，不要凭空增加来源。
3. 融合要有主次：按用户给定的比例决定谁做主视觉、谁做辅助，不能平均用力。
4. 生成的成品必须是【一件真实可做的产品】——器型、材质、装饰都要说清楚，不能是抽象的图案。
5. 不使用 Markdown，只输出 JSON。"""


def _ratio_text(heritages: list[dict], ratios: list[int]) -> str:
    """把融合比例翻译成"主 / 辅"的自然语言约束。"""
    if not heritages:
        return ""
    rs = list(ratios or [])
    if len(rs) != len(heritages):
        rs = [round(100 / len(heritages))] * len(heritages)
    pairs = sorted(zip(heritages, rs), key=lambda x: x[1], reverse=True)
    parts = [f"{h['name']} {r}%" for h, r in pairs]
    main = pairs[0][0]["name"]
    return (
        "用户设定的融合比例：" + "、".join(parts) + "。"
        f"请以「{main}」作为主视觉与主工艺，其余作为辅助元素；"
        "比例代表设计上的主次与占比，不是图片叠加的透明度。"
    )


def _facts(heritages: list[dict]) -> str:
    """为每项非遗各检索一段资料，拼成事实依据。"""
    blocks = []
    for h in heritages:
        query = f"{h.get('name', '')} {h.get('category', '')}".strip()
        chunks = rag_service.retrieve(query, top_k=3)
        texts = []
        for c in chunks[:3]:
            meta = c.get("metadata", {}) or {}
            t = (c.get("text", "") or "").strip()
            if t:
                texts.append(f"《{meta.get('project_name', '')}》{t}")
        if texts:
            blocks.append(f"【{h.get('name', '')}】\n" + "\n".join(texts))
        else:
            blocks.append(f"【{h.get('name', '')}】（知识库暂无该项目的详细资料，请只做设计层面的表述，不要编造史实）")
    return "\n\n".join(blocks)


def _build_prompt(heritages: list[dict], product_name: str, style_name: str, ratios: list[int], idea: str, count: int) -> str:
    names = "、".join(h["name"] for h in heritages)
    return f"""【知识库资料】
{_facts(heritages)}

【本次创作参数】
参与融合的非遗：{names}
产品载体：{product_name or "文创产品"}
设计风格：{style_name or "新中式"}
{_ratio_text(heritages, ratios)}
用户补充想法：{idea or "无"}

请输出严格 JSON（不要代码块），结构：
{{
  "themeName": "这次融合的主题名（6-12 字）",
  "analysis": [
    {{"heritage": "非遗名", "elements": ["代表性纹样/符号"], "colors": ["色彩体系"], "craft": "材料与工艺", "potential": "可融合点"}}
  ],
  "proposals": [
    {{
      "proposalTitle": "作品名（6-12 字）",
      "concept": "设计理念（80-140 字，说清融合逻辑）",
      "colorPalette": [{{"name": "颜色名", "hex": "#RRGGBB"}}],
      "fromA": ["来自第一项非遗的元素"],
      "fromB": ["来自第二项非遗的元素"],
      "fromC": ["来自第三项非遗的元素（只有三项融合时才填，两项时给空数组）"],
      "how": "两者如何结合（60-100 字，讲清构图/工艺/结构上的处理）",
      "innovation": "创新点（30-60 字）",
      "imagePrompt": "用于文生图的中文提示词：描述产品形态、材质、纹样布局、配色、光线与摄影角度，150 字以内，不要出现文字或水印"
    }}
  ]
}}

要求：
- analysis 必须正好 {len(heritages)} 条，与参与融合的非遗一一对应；
- proposals 必须正好 {count} 条，三个方案要有明显差异（主次互换或工艺不同）；
- colorPalette 每套 3 个颜色，hex 必须真实可用；
- fromA / fromB 各至少 1 条，必须具体到纹样或工艺，不能写"文化元素"这类空话；
- 三项融合时 fromC 至少 1 条；两项融合时 fromC 输出空数组。"""


def _extract_json(raw: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.MULTILINE).strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise FusionError("FUSION_PARSE_FAILED", "融合方案解析失败，请重试")
    try:
        return json.loads(m.group(0))
    except Exception:
        raise FusionError("FUSION_PARSE_FAILED", "融合方案解析失败，请重试")


async def _call_model(prompt: str) -> str:
    payload = {
        "model": config.AI_MODEL,
        "messages": [
            {"role": "system", "content": FUSION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.7,
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=100) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions", json=payload, headers=headers
            )
    except httpx.TimeoutException:
        raise FusionError("AI_TIMEOUT", "AI 融合分析超时，请减少非遗数量或稍后重试")
    except httpx.RequestError:
        raise FusionError("AI_CONNECT_FAILED", "无法连接 AI 服务，请检查网络")
    if resp.status_code != 200:
        raise FusionError("AI_HTTP_ERROR", f"AI 服务暂时不可用（HTTP {resp.status_code}）")
    try:
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        raise FusionError("AI_PARSE_FAILED", "AI 返回内容无法解析，请重试")


def _normalize(data: dict, heritages: list[dict], count: int) -> dict:
    """校验并补齐模型输出，避免前端拿到残缺结构。"""
    analysis = []
    raw_analysis = data.get("analysis") or []
    # 优先按非遗名匹配，模型偶尔会打乱条目顺序；匹配不到再退回按索引
    by_name = {}
    for item in raw_analysis:
        if isinstance(item, dict):
            key = str(item.get("heritage") or "").strip()
            if key:
                by_name[key] = item
    for i, h in enumerate(heritages):
        item = by_name.get(h["name"])
        if not item and i < len(raw_analysis) and isinstance(raw_analysis[i], dict):
            item = raw_analysis[i]
        item = item or {}
        analysis.append({
            "heritage": h["name"],
            "elements": [str(x) for x in (item.get("elements") or [])][:4],
            "colors": [str(x) for x in (item.get("colors") or [])][:4],
            "craft": str(item.get("craft") or ""),
            "potential": str(item.get("potential") or ""),
        })

    proposals = []
    for p in (data.get("proposals") or [])[:count]:
        if not isinstance(p, dict):
            continue
        palette = []
        for c in (p.get("colorPalette") or [])[:4]:
            hexv = str(c.get("hex") or "").strip()
            if re.fullmatch(r"#[0-9a-fA-F]{6}", hexv):
                palette.append({"name": str(c.get("name") or ""), "hex": hexv})
        if len(palette) < 3:
            palette = [
                {"name": "朱砂", "hex": "#B23A2E"},
                {"name": "宣纸", "hex": "#F6F1E4"},
                {"name": "墨色", "hex": "#2A2722"},
            ]
        proposals.append({
            "proposalTitle": str(p.get("proposalTitle") or "未命名方案"),
            "concept": str(p.get("concept") or ""),
            "colorPalette": palette,
            "fromA": [str(x) for x in (p.get("fromA") or [])][:4],
            "fromB": [str(x) for x in (p.get("fromB") or [])][:4],
            "fromC": [str(x) for x in (p.get("fromC") or [])][:4] if len(heritages) >= 3 else [],
            "how": str(p.get("how") or ""),
            "innovation": str(p.get("innovation") or ""),
            "imagePrompt": str(p.get("imagePrompt") or ""),
            "imageUrl": "",
            "mode": "",
        })

    if not proposals:
        raise FusionError("FUSION_EMPTY", "这次没有生成出可用的融合方案，请调整组合后再试")

    return {
        "themeName": str(data.get("themeName") or "跨界融合"),
        "analysis": analysis,
        "proposals": proposals,
    }


def _mock_fusion(heritages: list[dict], product_name: str, count: int) -> dict:
    """演示模式：用模板给出结构完整的融合分析（明确标注 mode=mock）。"""
    a, b = heritages[0]["name"], heritages[1]["name"]
    analysis = [
        {"heritage": h["name"], "elements": ["代表性纹样"], "colors": ["传统色系"],
         "craft": "传统手工技艺", "potential": "可提取纹样与色彩用于产品表面装饰"}
        for h in heritages
    ]
    proposals = []
    themes = ["纹样共生", "双色叠韵", "器上双绝"]
    for i in range(count):
        proposals.append({
            "proposalTitle": f"{a}×{b}·{themes[i % len(themes)]}",
            "concept": f"以{a}的纹样语言为骨架，借{b}的色彩与工艺气质作衬托，"
                       f"在{product_name or '文创产品'}上形成可读的东方秩序。",
            "colorPalette": [
                {"name": "朱砂", "hex": "#B23A2E"},
                {"name": "宣纸", "hex": "#F6F1E4"},
                {"name": "青绿", "hex": "#4E7F6B"},
            ],
            "fromA": [f"{a}的构图与主纹样"],
            "fromB": [f"{b}的色彩体系与装饰细节"],
            "fromC": [],
            "how": "主纹样占据主体面积，副元素收敛在边饰与口沿处，形成主次分明的层次。",
            "innovation": "用两种非遗的工艺逻辑叠加，而非纹样的简单拼贴。",
            "imagePrompt": f"{product_name or '文创产品'}，融合{a}纹样与{b}色彩，"
                            "新中式，柔和自然光，产品摄影，纯净背景",
            "imageUrl": "",
            "mode": "mock",
        })
    return {"themeName": f"{a} · {b}", "analysis": analysis, "proposals": proposals}


async def analyze(heritages: list[dict], *, product_name: str, style_name: str,
                  ratios: list[int], idea: str, count: int = 2) -> dict:
    """跨文化融合分析：返回要素拆解 + 融合方案（不含图片）。"""
    if not (MIN_HERITAGES <= len(heritages) <= MAX_HERITAGES):
        raise FusionError(
            "FUSION_BAD_SELECTION",
            f"请选择 {MIN_HERITAGES}-{MAX_HERITAGES} 项非遗进行融合",
        )

    if config.use_mock():
        result = _mock_fusion(heritages, product_name, count)
        result["mode"] = "mock"
        return result

    prompt = _build_prompt(heritages, product_name, style_name, ratios, idea, count)
    raw = await _call_model(prompt)
    data = _extract_json(raw)
    result = _normalize(data, heritages, count)
    result["mode"] = "real"
    return result


async def generate_images(proposals: list[dict], *, theme_name: str,
                          product_name: str, style_name: str, on_progress=None) -> dict:
    """为融合方案生成效果图（复用 image_service 的双模式实现）。

    真实图像模型无权限/额度不足时，自动降级为「本地演示图」并明确告知用户，
    保证融合创作流程可用，同时不把演示图伪装成真实生成结果。

    @return {proposals: [...], notice: str}
    """
    briefs = [
        {
            "proposalTitle": p.get("proposalTitle", ""),
            "concept": p.get("concept", ""),
            "colorPalette": p.get("colorPalette") or [],
            "imagePrompt": p.get("imagePrompt", ""),
        }
        for p in proposals
    ]
    notice = ""
    try:
        images = await image_service.generate_proposal_images(
            briefs,
            theme_name=theme_name or "跨界融合",
            product_name=product_name or "文创产品",
            style_name=style_name or "新中式",
            on_progress=on_progress,
        )
    except Exception as e:
        msg = str(e)
        fallback_signal = any(k in msg for k in ("403", "无权", "额度", "配额", "未开通", "quota"))
        if not fallback_signal:
            raise FusionError("IMAGE_GENERATE_FAILED", f"效果图生成失败：{msg}")
        # 权限类失败 → 本地演示图（带水印，界面标注「演示图」）
        try:
            images = await image_service.generate_proposal_images(
                briefs,
                theme_name=theme_name or "跨界融合",
                product_name=product_name or "文创产品",
                style_name=style_name or "新中式",
                force_demo=True,
            )
            notice = "当前账号的图像模型暂不可用，已改用本地演示图（带「演示图」角标），仅作构图参考。"
        except Exception as e2:
            raise FusionError("IMAGE_GENERATE_FAILED", f"效果图生成失败：{e2}")

    merged = []
    for p, img in zip(proposals, images):
        merged.append({**p, "imageUrl": img.get("url", ""), "mode": img.get("mode", "")})
    return {"proposals": merged, "notice": notice}
