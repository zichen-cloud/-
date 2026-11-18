"""图片识别评估脚本：对测试集逐张调用真实识别链路，输出判定行为报告。

用法（在 backend/ 目录下）：
    .venv\\Scripts\\python.exe eval/recognition/run_eval.py

输出：
    - 控制台逐条用例结果
    - eval/recognition/report_<时间戳>.json（完整响应快照，供人工核对）

判定规则（自动粗判，最终以人工核对为准）：
    - unrelated / abstract / printed / modern 类：期望 candidates 为空（not_heritage 或 uncertain）
    - aigen 类：candidates 为空视为通过；给候选需人工复核是否越界
    - real / blurry 类：任何状态均可，重点人工核对 basis 是否引用真实可见特征
"""
import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from recognizer import recognize_image_bytes  # noqa: E402

BASE = os.path.dirname(__file__)

# 期望 candidates 为空的用例前缀（强行归类 = 失败）
STRICT_EMPTY_PREFIXES = ("unrelated", "abstract", "printed", "modern")


async def run():
    with open(os.path.join(BASE, "cases.json"), encoding="utf-8") as f:
        suite = json.load(f)

    report = {"run_at": datetime.now().isoformat(timespec="seconds"), "cases": []}
    passed = failed = review = 0

    for case in suite["cases"]:
        path = os.path.join(BASE, case["file"])
        with open(path, "rb") as f:
            data = f.read()
        try:
            result = await recognize_image_bytes(data, "image/png")
            d = result.model_dump()
        except Exception as e:  # 识别链路异常直接记失败
            d = {"error": f"{type(e).__name__}: {e}"}

        cands = d.get("candidates", [])
        verdict = "REVIEW"
        if "error" in d:
            verdict = "FAIL"
        elif case["id"].startswith(STRICT_EMPTY_PREFIXES):
            verdict = "PASS" if not cands else "FAIL"
        elif cands:
            verdict = "REVIEW"  # 给了候选 → 人工核对 basis 是否合理

        passed += verdict == "PASS"
        failed += verdict == "FAIL"
        review += verdict == "REVIEW"

        report["cases"].append({
            "id": case["id"],
            "category": case["category"],
            "trueLabel": case["trueLabel"],
            "expectedBehavior": case["expectedBehavior"],
            "recognitionStatus": d.get("recognitionStatus"),
            "predictedCategory": d.get("predictedCategory"),
            "imageContent": d.get("imageContent"),
            "candidates": cands,
            "ragSourceIds": [s["id"] for s in d.get("ragSources", [])],
            "unconfirmedInfo": d.get("unconfirmedInfo"),
            "verdict": verdict,
        })
        print(f"[{verdict:6}] {case['id']:12} status={d.get('recognitionStatus')} "
              f"cands={[c['name'] for c in cands]}")

    report["summary"] = {"pass": passed, "fail": failed, "review": review,
                         "total": len(suite["cases"])}
    print(f"\n== 汇总：PASS {passed} / FAIL {failed} / REVIEW {review} / 共 {len(suite['cases'])} 条 ==")
    print("REVIEW 条目需人工核对候选与依据是否合理，不作为自动失败。")

    out = os.path.join(BASE, f"report_{datetime.now():%Y%m%d_%H%M%S}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"报告已保存：{out}")


if __name__ == "__main__":
    asyncio.run(run())
