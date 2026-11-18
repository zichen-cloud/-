# ============================================================
# 知识库同步工具：后端 knowledge/items.json → 前端 src/data/heritage.json
# ------------------------------------------------------------
# 背景：后端 RAG 知识库（22 项）比前端演示数据（6 项）多，
#       知识馆需要与 AI 导师掌握的知识保持一致。
#
# 合并规则（方案 A：纯前端同步，不动后端）：
#   1. 以后端 items.json 为内容源（唯一事实来源）
#   2. 前端已有的 imagePrompt（封面图描述）按 id 保留，不覆盖
#   3. 新增条目从 PROMPTS 字典取 imagePrompt
#   4. 剥离前端用不到的 verified 字段，保持前端 schema 干净
#   5. meta 保留前端字段并更新版本号
#
# 运行：python scripts/sync_heritage.py（在项目根目录 d:\feiyi）
# ============================================================
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_PATH = os.path.join(ROOT, "backend", "knowledge", "items.json")
FRONTEND_PATH = os.path.join(ROOT, "src", "data", "heritage.json")

# 新增条目的封面图描述（与已有 6 条的文案风格保持一致：水墨/传统艺术插画 + 宣纸质感 + 留白 + 无文字）
PROMPTS = {
    "lion-dance": "广东南派醒狮水墨插画，红金配色狮头特写，神采飞扬，宣纸质感，少量留白，无文字",
    "peking-opera": "京剧人物插画，华丽戏服与油彩脸谱纹样，浓墨重彩而克制，宣纸质感，无文字",
    "guqin": "古琴静物水墨插画，七弦琴横置案头，一缕轻烟，极简留白，意境悠远，无文字",
    "dong-choir": "侗族大歌插画，侗寨鼓楼与盛装歌队剪影，青黛色调，梯田远山层叠，无文字",
    "taijiquan": "太极拳水墨剪影插画，行云流水的招式动态，阴阳太极意境，大量留白，无文字",
    "acupuncture": "中医针灸文化插画，人体经络铜人与银针意象，古卷与药草点缀，素雅色调，无文字",
    "dragon-boat-festival": "端午龙舟水墨插画，江面龙舟竞渡，粽叶艾草点缀，青绿山水基调，无文字",
    "solar-terms": "二十四节气物候插画，四季农事与自然意象拼合，田园水墨淡彩，无文字",
    "liangzhu-legend": "梁祝传说插画，化蝶意象与江南水乡，双蝶飞舞，淡彩留白，无文字",
    "xiangsheng": "相声表演水墨漫画风插画，长衫人物逗哏捧哏，折扇醒木，茶馆氛围，无文字",
    "suzhou-pingtan": "苏州评弹插画，琵琶三弦说书人，江南书场场景，吴侬软意味境，淡雅色调，无文字",
    "xuan-paper": "宣纸制作技艺插画，晒纸作坊与帘纸工序，皖南山水背景，素白意境，无文字",
    "jingdezhen-porcelain": "景德镇制瓷插画，青花瓷瓶与拉坯工序，窑火意象，青花纹样点缀，无文字",
    "yangliuqing-newyear-painting": "杨柳青年画风格插画，胖娃娃抱鱼传统年画，色彩饱满喜庆，木版肌理，无文字",
    "yueju-cantonese-opera": "粤剧人物插画，花旦戏服头饰，岭南风物背景点缀，浓淡相宜，无文字",
    "yunjin": "南京云锦织造插画，大花楼木织机与金线云纹，妆花色彩华贵，寸锦寸金意境，无文字",
}


def main():
    with open(BACKEND_PATH, encoding="utf-8") as f:
        backend = json.load(f)
    with open(FRONTEND_PATH, encoding="utf-8") as f:
        frontend = json.load(f)

    # 已有前端的 imagePrompt 按 id 留存（后端没有这个字段）
    old_prompts = {it["id"]: it["imagePrompt"] for it in frontend["items"] if it.get("imagePrompt")}

    merged = []
    missing_prompt = []
    for item in backend["items"]:
        out = {k: v for k, v in item.items() if k != "verified"}  # 剥离前端不用的字段
        prompt = old_prompts.get(item["id"]) or PROMPTS.get(item["id"])
        if not prompt:
            missing_prompt.append(item["id"])
        out["imagePrompt"] = prompt or ""
        merged.append(out)

    if missing_prompt:
        raise SystemExit(f"缺少 imagePrompt 的条目：{missing_prompt}，请在 PROMPTS 字典补齐后重跑")

    new_doc = {
        "meta": {
            **frontend["meta"],
            "version": "0.2.0",
            "updatedAt": "2026-10",
            "coverage": backend["meta"].get("coverage", ""),
        },
        "items": merged,
    }

    with open(FRONTEND_PATH, "w", encoding="utf-8") as f:
        json.dump(new_doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    kept = sum(1 for it in merged if it["id"] in old_prompts)
    print(f"同步完成：共 {len(merged)} 项（保留原 imagePrompt {kept} 项，新增 {len(merged) - kept} 项）")


if __name__ == "__main__":
    main()
