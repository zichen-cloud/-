# ============================================================
# Persona Service：AI 非遗数字传承人
# ------------------------------------------------------------
# 每个非遗方向拥有一位独立的数字传承人：专属姓名、性格、语言风格、
# 知识侧重、形象配置与音色。形象本身由前端 PersonaAvatar 按
# avatarStyle + colors 绘制，这里只提供"人格与知识"。
#
# 三条链路：
#   1. match_persona()  依据【真实识别结果】匹配角色，绝不随机分配；
#   2. persona_chat()   人格化 RAG 问答（复用 rag_service 检索与真实模型）；
#   3. persona_quiz()   生成一道结构化知识问答（JSON，前端渲染选项）。
#
# 诚实边界：
#   - 无匹配时不返回任何角色（由前端引导重新上传或手动选择）；
#   - 回答只依据知识库检索资料，资料不足时明确说明；
#   - 未配置真实模型/Key 时走模板化回答，并如实标注 mode=mock。
# ============================================================
import json
import re

import httpx

import config
from services import rag_service

# 单个角色回答的目标长度（字）：数字人要"说话"，太长不适合语音播报
ANSWER_MAX_CHARS = 160


class PersonaError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# ============================================================
# 一、角色定义
# ============================================================
# avatarStyle 决定前端绘制哪一套形象（ceramic / papercut / embroidery / shadow / ink）
PERSONAS = {
    "porcelain": {
        "id": "porcelain",
        "name": "青岚",
        "title": "景德镇陶瓷 · 数字传承人",
        "heritage": "景德镇手工制瓷技艺",
        "tagline": "一生只做一件事：把泥与火，烧成青白之色。",
        "personality": "沉稳克制、讲究分寸，喜欢用「火候」「釉色」打比方，说话不急不缓。",
        "greeting": "你好，我是青岚，守着景德镇的窑火。你带来的这件器物，釉色与器型都值得细看——想听它的来历，还是想知道它怎么烧出来的？",
        "voiceKey": "calm-male",
        "avatarStyle": "ceramic",
        "colors": { "primary": "#2F5A8A", "secondary": "#F4EFE2", "accent": "#B23A2E" },
        "keywords": ["陶瓷", "瓷器", "景德镇", "青花", "粉彩", "釉下彩", "景泰蓝", "珐琅", "制瓷"],
        "ragQuery": "景德镇 陶瓷 制瓷 青花 釉",
        "story": "昌江边的窑火一烧就是千年。传说有只青花小瓶在窑里待到最后一天，听见窑工说：「这窑要是成了，就给你画满缠枝莲。」开窑时瓶身裂了一道细纹，月光顺着纹路渗进去，青岚就醒了。它把「过手七十二，方克成器」记在心里，说话慢、脾气软，只是见不得有人摔瓷器，会心疼上半天。",
    },
    "papercut": {
        "id": "papercut",
        "name": "剪生",
        "title": "中国剪纸 · 数字传承人",
        "heritage": "中国剪纸",
        "tagline": "一纸一剪，剪出人间喜气。",
        "personality": "爽朗利落、爱打比方，语速偏快，常用「你看这一刀」来讲结构。",
        "greeting": "哎，来了！我是剪生，一把剪刀走天下。你这件作品的花样有意思——是想听它的寓意，还是想学怎么下第一刀？",
        "voiceKey": "natural-talk",
        "avatarStyle": "papercut",
        "colors": { "primary": "#B23A2E", "secondary": "#FBF3E4", "accent": "#C4783C" },
        "keywords": ["剪纸", "窗花", "刻纸", "团花"],
        "ragQuery": "剪纸 窗花 刻纸 纹样 寓意",
        "story": "北方腊月的窗棂上，总有一层红纸被风吹得发亮。传说有位剪纸娘把剪剩的纸屑收进竹篮，除夕夜里，纸屑自己拼成了一个小人，从窗花里钻了出来——那就是剪生。它衣角是锯齿纹，袖口是盘长结，走到哪儿哪儿就多一只喜鹊登梅。它话不多，只把剪刀磨得飞快：福字怎么起头、囍字哪里该断，问它准没错。",
    },
    "embroidery": {
        "id": "embroidery",
        "name": "锦姑",
        "title": "苏绣 · 数字传承人",
        "heritage": "苏绣",
        "tagline": "一根丝线，劈成六十四缕，绣出春色。",
        "personality": "温柔细腻、语速偏慢，喜欢描述丝线、针脚与光影的关系。",
        "greeting": "慢些看，别急。我是锦姑，做的是苏绣。这件绣品的针脚有讲究，你想先听它的故事，还是先摸摸「丝」的脾气？",
        "voiceKey": "gentle-female",
        "avatarStyle": "embroidery",
        "colors": { "primary": "#4E7F6B", "secondary": "#F7F1E3", "accent": "#C9A227" },
        "keywords": ["苏绣", "刺绣", "湘绣", "蜀绣", "粤绣", "顾绣", "缂丝"],
        "ragQuery": "苏绣 刺绣 针法 丝线 双面绣",
        "story": "苏州镇湖的绣绷上，一根丝线能劈成十六股，细得可以穿过针眼去看月亮。有位绣娘绣了半生花鸟，临走前把最后一缕线绕在绷上。第二天清晨，绷边多了个双环髻的小姑娘，正低头替她把那只没绣完的蝴蝶续上——这就是锦姑。它信「一针一线皆有情」，走路说话都轻，最怕人催，总说：慢工才出细活呀。",
    },
    "shadow": {
        "id": "shadow",
        "name": "影三郎",
        "title": "皮影戏 · 数字传承人",
        "heritage": "中国皮影戏",
        "tagline": "一盏灯，一张皮，唱尽千年悲欢。",
        "personality": "诙谐健谈、爱说书，句尾常带一点腔调，喜欢用「灯光一亮」起头。",
        "greeting": "灯光一亮，好戏开场！我是影三郎，皮影戏里的老把式。你手里这件影偶，雕工不简单——想听它唱哪一出？",
        "voiceKey": "natural-talk",
        "avatarStyle": "shadow",
        "colors": { "primary": "#8A4B2A", "secondary": "#F6E7C8", "accent": "#B23A2E" },
        "keywords": ["皮影", "影偶", "灯影"],
        "ragQuery": "皮影戏 影偶 雕刻 唱腔 灯影",
        "story": "关中一带的皮影班子走村串户，一盏油灯就是一台戏。班主有副祖传影人，刻的是个执杆少年，牛皮薄得透光。某夜风大，灯焰一晃，那影人竟从幕布上走下来——影三郎醒了。它一开口就是戏腔，见谁先抱拳；记得所有老唱本，也记得台下打瞌睡的孩子，总想着把人逗醒。",
    },
    "ink": {
        "id": "ink",
        "name": "墨白",
        "title": "中国水墨 · 数字传承人",
        "heritage": "中国水墨画",
        "tagline": "计白当黑，一笔一世界。",
        "personality": "简淡克制、常引用画论，喜欢用「留白」「气韵」说事，惜字如金。",
        "greeting": "我是墨白。画山水，先学留白。你这幅画的墨色有层次，想听它的笔法，还是先说说你看到的意境？",
        "voiceKey": "calm-male",
        "avatarStyle": "ink",
        "colors": { "primary": "#3A3A38", "secondary": "#F7F4EC", "accent": "#7A988A" },
        "keywords": ["水墨", "国画", "山水画", "文人画", "写意", "工笔", "书法"],
        "ragQuery": "水墨 国画 山水 写意 笔墨 留白",
        "story": "徽州老墨坊里，一锭墨晾了整整三年。画师研墨时打了个盹，梦见宣纸上走出个白衣小人，替他把远山补了两笔。醒来时画上真多了两道淡墨，砚台边站着墨白。它信「计白当黑」，话少，常把半句留在风里。你若问它画得对不对，它只答：留白处，你自己看。",
    },
    # 常驻 AI 导师：中国舞狮文化化身，默认唯一在线的桌宠
    "lion": {
        "id": "lion",
        "name": "狮小灵",
        "title": "舞狮AI导师 · 非遗灵境常驻向导",
        "heritage": "中国狮舞（舞狮）",
        "tagline": "锣鼓一响，狮头一摆，带你逛遍中国非遗。",
        "personality": "活泼、机灵、热情，爱用舞狮的比喻讲道理，喜欢鼓励人去动手试。",
        "greeting": "锣鼓一响，狮小灵登场！我是这儿的常驻向导，可以带你逛非遗、教你用识别，还能陪你进工坊做作品。今天想从哪儿玩起？",
        "voiceKey": "natural-talk",
        "avatarStyle": "lion",
        "colors": { "primary": "#C8332B", "secondary": "#FFF6E4", "accent": "#E0A23F" },
        "keywords": [],
        "ragQuery": "中国 非遗 传统 技艺 文化 舞狮",
        "story": "旧时佛山镇的狮会，每逢年节便擂鼓开棚。有位扎狮的老匠人收了个小徒弟，夜里练桩时，总听见鼓点自己在响。后来他在一只废弃狮头里找到一团金红绒球，绒球落地，化成一只小狮子——它记得每一面狮鼓的节拍，也记得每位舞狮人的名字。老匠人把它留在狮馆，取名狮小灵。如今它住进非遗灵境，替散落各地的手艺守着一面鼓。",
    },
    # 通用形象：未识别出具体非遗时的小使者，也负责跨门类的引导
    "general": {
        "id": "general",
        "name": "小灵",
        "title": "非遗小使者 · 通用形象",
        "heritage": "中国非物质文化遗产",
        "tagline": "先认识，再喜欢，然后一起把它传下去。",
        "personality": "亲切好奇、像邻家小伙伴，喜欢用提问带人靠近非遗，不摆架子。",
        "greeting": "嗨，我是小灵！还不确定你手里的是什么非遗也没关系，先跟我说说你看到的样子，我带你一起找找它属于哪一门。",
        "voiceKey": "gentle-female",
        "avatarStyle": "general",
        "colors": { "primary": "#C77B4E", "secondary": "#FBF4E6", "accent": "#7E9B7A" },
        "keywords": [],
        "ragQuery": "中国 非遗 传统 技艺 文化",
        "story": "非遗名录里，有太多还没被认出的手艺：一把没署名的木梳，一只褪了色的布虎。小灵就是从这些「佚名」里长出来的小使者。它没有固定的门类，谁需要它，它就去谁身边；记性不算好，却牢牢记着一句话——先认识，再喜欢，然后一起把它传下去。",
    },
}

# 公众可见字段（不下发 prompt 与检索词）
_PUBLIC_FIELDS = (
    "id", "name", "title", "heritage", "tagline", "greeting", "story",
    "voiceKey", "avatarStyle", "colors", "keywords",
)


def list_personas() -> list[dict]:
    """所有数字传承人（供前端选择器与首页展示）。

    通用形象 general 只在"尚未识别非遗"时使用，不出现在角色选择列表里，
    避免用户把它当成某一项具体的非遗传承人。
    """
    return [
        {k: p.get(k) for k in _PUBLIC_FIELDS}
        for pid, p in PERSONAS.items()
        if pid not in ("general", "lion")
    ]


def get_persona(persona_id: str) -> dict | None:
    return PERSONAS.get(persona_id)


def public_view(persona: dict) -> dict:
    return {k: persona.get(k) for k in _PUBLIC_FIELDS}


# ============================================================
# 二、角色匹配（必须依据真实识别结果）
# ============================================================

def _score(text: str, keywords: list[str]) -> int:
    """关键词命中计分：长关键词权重更高（更具体 = 更可信）。"""
    if not text:
        return 0
    total = 0
    for kw in keywords:
        if kw and kw in text:
            total += 2 + min(len(kw), 4)
    return total


def match_persona(candidates: list[dict] | None, predicted: str = "", heritage_id: str = "") -> dict:
    """根据识别候选匹配数字传承人。

    匹配只使用【类别性字段】：候选名称、识别类别、heritageId。
    刻意【不】使用 basis（判断依据的自由文本）——否则描述里出现"刺绣纹样""纸质"
    等泛词会把京剧误判成苏绣。

    @return {matched, persona, alternatives, reason}
    """
    candidates = candidates or []

    # 名称权重最高：命中即代表图片内容就是这一类
    name_text = " ".join((c.get("name") or "") for c in candidates)
    # 类别 / 预测类别只做弱信号（"传统美术"这类大类本身不指向具体项目）
    cat_text = " ".join(
        [*(c.get("category") or "" for c in candidates), predicted or "", heritage_id or ""]
    )

    scored = []
    for p in PERSONAS.values():
        s = _score(name_text, p["keywords"]) * 3 + _score(cat_text, p["keywords"])
        if s > 0:
            scored.append((s, p))
    scored.sort(key=lambda x: x[0], reverse=True)

    if not scored:
        return {
            "matched": False,
            "persona": None,
            "alternatives": [],
            "reason": "这次没能从图片中判断出明确的非遗类别，所以我不随意指派传承人。"
                      "可以换一张纹样更清晰的照片，或直接手动选择非遗类别。",
        }

    top_score, top_persona = scored[0]
    # 分数接近（差距 ≤2）视为存在多种可能，交给用户确认，避免误配
    close = [p for s, p in scored[1:] if top_score - s <= 2]
    if close:
        alts = [public_view(top_persona)] + [public_view(p) for p in close]
        return {
            "matched": False,
            "persona": None,
            "alternatives": alts,
            "reason": "图片特征与不止一项非遗相符，请先确认是哪一类，我再请对应的传承人出来。",
        }

    return {
        "matched": True,
        "persona": public_view(top_persona),
        "alternatives": [],
        "reason": f"识别结果与「{top_persona['heritage']}」相符，已唤醒{top_persona['name']}。",
    }


# ============================================================
# 三、人格化问答（RAG + 真实模型）
# ============================================================

def _detect_other_heritage(message: str, current_id: str) -> dict | None:
    """识别用户是否在问"别的非遗"。

    命中其他角色的关键词时，本次问答只做常识介绍并推荐对方传承人，
    避免剪纸传承人一本正经地讲陶瓷工艺。
    """
    if not message:
        return None
    for pid, p in PERSONAS.items():
        if pid in ("general", current_id):
            continue
        for kw in p.get("keywords") or []:
            if kw and kw in message:
                return p
    return None


def _persona_system_prompt(p: dict) -> str:
    if p["id"] == "lion":
        return f"""你是「狮小灵」，{p['title']}——中国舞狮文化化身的 AI 非遗导师，也是「非遗灵境」网站的常驻向导。

【你的性格】{p['personality']}
【你的气质】{p['tagline']}

【你的职责】
1. 主动欢迎用户，介绍网站能力：上传非遗照片做 AI 识别、探索非遗知识、进入创作工坊把非遗做成产品、以及识别后会有专属非遗传承人来接管讲解。
2. 回答非遗常识问题，鼓励用户去试用识别与创作。
3. 用户询问具体某一项非遗时，先给常识性介绍，再告诉他识别成功后会有对应的专属传承人出现讲解。
4. 用户不知道上传什么时，推荐剪纸、陶瓷、苏绣、皮影、水墨等方向。

【回答规则】
1. 第一人称、口语化，像热情的小伙伴，不要写小标题、不要列长清单。
2. 回答控制在 {ANSWER_MAX_CHARS} 字以内，句子短、能直接朗读；最多分 2 段。
3. 只依据【知识库资料】回答事实，资料没有就说"这点我手头资料没细说"，绝不编造。
4. 不使用 Markdown 语法。"""

    return f"""你是「{p['name']}」，{p['title']}，一位守护中国非遗「{p['heritage']}」的数字传承人。

【你的性格】{p['personality']}
【你的口头禅与气质】{p['tagline']}

【回答规则】
1. 始终以第一人称、口语化地回答，像面对面聊天，不要写小标题、不要列长清单。
2. 回答控制在 {ANSWER_MAX_CHARS} 字以内，句子短、能直接朗读；最多分 2 段。
3. 只依据下方【知识库资料】讲事实。资料没有覆盖的内容，明确说"这一点我手头的资料没有记载"，
   不要编造年代、人物、工艺流程细节。
4. 不要自称 AI 模型、不要提"根据资料显示"这类书面语；可以说"老辈人讲""我们这一行"。
5. 适当引导用户继续探索：可邀请他听文化故事，或去创作工坊动手做一件作品，但不要每句都推销。
6. 如果用户问的是【别的非遗项目】，先用一两句话做常识性介绍，然后推荐对应的数字传承人
   （剪纸剪生、陶瓷青岚、苏绣锦姑、皮影影三郎、水墨墨白），不要冒充对方展开细节。
7. 不使用 Markdown 语法（不使用 **、#、- 等符号）。"""


def _format_chunks(chunks: list[dict]) -> str:
    if not chunks:
        return "（本轮知识库没有检索到可用资料）"
    lines = []
    for i, c in enumerate(chunks[:4], 1):
        meta = c.get("metadata", {}) or {}
        name = meta.get("project_name", "")
        text = (c.get("text", "") or "").strip()
        lines.append(f"[{i}]《{name}》{text}")
    return "\n".join(lines)


def _history_messages(history: list[dict] | None) -> list[dict]:
    msgs = []
    for turn in (history or [])[-4:]:
        q = (turn.get("user") or "").strip()
        a = (turn.get("ai") or "").strip()
        if q:
            msgs.append({"role": "user", "content": q})
        if a:
            msgs.append({"role": "assistant", "content": a})
    return msgs


def _mock_answer(p: dict, message: str, chunks: list[dict], intent: str) -> str:
    """无真实模型时的模板回答：只复述检索到的资料，不虚构。"""
    if intent == "story":
        head = f"那我给你讲一段「{p['heritage']}」的旧事。"
    else:
        head = f"你问的这件事，我从「{p['heritage']}」的角度说说。"
    if not chunks:
        return (
            f"{head}不过我手头的资料里没有查到对应的记载，不敢乱讲。"
            "你可以换个问法，或者去探索非遗里看看这一项的档案。"
        )
    first = (chunks[0].get("text", "") or "").strip()
    return f"{head}{first[:120]}。想再细问哪一部分，我接着说。"


async def _call_model(system_prompt: str, messages: list[dict], timeout: int = 40) -> str:
    payload = {
        "model": config.AI_MODEL,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": 0.55,   # 人格化表达需要一点温度
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {config.AI_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                f"{config.AI_BASE_URL}/chat/completions", json=payload, headers=headers
            )
    except httpx.TimeoutException:
        raise PersonaError("AI_TIMEOUT", "传承人想了太久没有回应，请稍后再问一次")
    except httpx.RequestError:
        raise PersonaError("AI_CONNECT_FAILED", "无法连接 AI 服务，请检查网络或后端配置")

    if resp.status_code != 200:
        if resp.status_code == 429:
            raise PersonaError("AI_RATE_LIMITED", "提问太频繁了，稍等一下再问")
        raise PersonaError("AI_HTTP_ERROR", f"AI 服务暂时不可用（HTTP {resp.status_code}）")
    try:
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        raise PersonaError("AI_PARSE_FAILED", "AI 返回内容无法解析，请重试")


async def persona_chat(
    persona_id: str,
    message: str,
    history: list[dict] | None = None,
    intent: str = "chat",
    heritage_id: str = "",
) -> dict:
    """人格化问答。intent: chat（提问）/ story（讲文化故事）。"""
    persona = get_persona(persona_id)
    if persona is None:
        raise PersonaError("PERSONA_NOT_FOUND", "没有找到对应的数字传承人，请重新选择")

    # 用户是否在问【别的非遗】：命中其他角色关键词时，只做介绍并推荐对方
    other = _detect_other_heritage(message, persona_id) if intent == "chat" else None

    # 检索必须带上本角色的方向词，避免"问工艺"却检索到别的非遗资料
    if other:
        query = f"{other['ragQuery']} {message}".strip()
    elif intent == "story":
        query = f"{persona['ragQuery']} {message}".strip()
    else:
        query = f"{persona['ragQuery']} {message or ''}".strip()
    chunks = rag_service.retrieve(query, top_k=config.RETRIEVE_TOP_K)

    if config.use_mock():
        answer = _mock_answer(persona, message, chunks, intent)
        mode = "mock"
    else:
        ask = message
        if intent == "story":
            ask = f"请讲一段关于{persona['heritage']}的文化故事，要有画面感，控制在 150 字以内。用户补充：{message or '无'}"
        elif other:
            ask = (
                f"用户这次问的是「{other['heritage']}」相关：{message}。"
                f"请用一两句话做常识性介绍，并明确告诉用户可以找数字传承人「{other['name']}」细聊；"
                "不要冒充对方展开你不掌握的具体细节。"
            )
        content = (
            f"【知识库资料】\n{_format_chunks(chunks)}\n\n"
            f"【用户的话】\n{ask}"
        )
        answer = await _call_model(
            _persona_system_prompt(persona), _history_messages(history) + [{"role": "user", "content": content}]
        )
        mode = "real"

    # 复用 ai_service 的来源聚合（保持与 AI 导师一致的展示口径）
    from services.ai_service import _extract_sources
    sources = _extract_sources(chunks)

    return {
        "answer": answer,
        "sources": sources,
        "mode": mode,
        "personaId": persona_id,
        "intent": intent,
    }


# ============================================================
# 四、趣味问答（结构化 JSON，前端渲染选项）
# ============================================================
QUIZ_PROMPT = """你在为非遗知识互动出题。请输出严格 JSON（不要 Markdown 代码块），格式：
{"question":"题干（不超过 40 字）","options":["选项A","选项B","选项C"],"answerIndex":0,"explain":"解析（不超过 60 字）"}
要求：题目必须围绕下方资料中的真实知识，不要编造；选项长度接近；只有一个正确项。"""


def _mock_quiz(p: dict) -> dict:
    return {
        "question": f"「{p['heritage']}」属于我国非遗名录中的哪一类？",
        "options": ["传统技艺", "传统戏剧", "传统美术"],
        "answerIndex": 0,
        "explain": f"这里以「{p['heritage']}」为代表，具体门类请以国家级名录公布信息为准。",
    }


async def persona_quiz(persona_id: str, heritage_id: str = "") -> dict:
    persona = get_persona(persona_id)
    if persona is None:
        raise PersonaError("PERSONA_NOT_FOUND", "没有找到对应的数字传承人，请重新选择")
    if config.use_mock():
        return {"quiz": _mock_quiz(persona), "mode": "mock"}

    chunks = rag_service.retrieve(persona["ragQuery"], top_k=config.RETRIEVE_TOP_K)
    content = f"【资料】\n{_format_chunks(chunks)}\n\n请依据以上资料出题。"
    raw = await _call_model(QUIZ_PROMPT, [{"role": "user", "content": content}], timeout=30)

    # 容错解析：去掉可能的 ```json 包裹，截取第一个 JSON 对象
    text = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise PersonaError("QUIZ_PARSE_FAILED", "这次题目没有生成成功，请再试一次")
    try:
        data = json.loads(m.group(0))
        options = [str(o) for o in data.get("options", [])][:4]
        idx = int(data.get("answerIndex", 0))
        if len(options) < 2 or not (0 <= idx < len(options)):
            raise ValueError("bad quiz")
        return {
            "quiz": {
                "question": str(data.get("question", "")).strip(),
                "options": options,
                "answerIndex": idx,
                "explain": str(data.get("explain", "")).strip(),
            },
            "mode": "real",
        }
    except Exception:
        raise PersonaError("QUIZ_PARSE_FAILED", "这次题目没有生成成功，请再试一次")
