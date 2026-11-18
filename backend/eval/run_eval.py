# ============================================================
# 非遗问答评测脚本（第五阶段）
# ------------------------------------------------------------
# 运行方式：cd backend && .venv\Scripts\python.exe -m eval.run_eval
#
# 评测指标：
#   1. 检索命中率：相关问题命中期望文档 / 无关问题返回空
#   2. Recall@K：期望文档是否出现在 top_k 结果中
#   3. 无答案处理正确率：无关问题的空返回比例
#   4. 弱证据比例：keyword_only 命中占比（仅混合检索）
#   5. 分类别统计：按基础知识/专有名词/地区/技艺/多轮/无答案/混淆汇总
#
# 对比模式：
#   - HYBRID_SEARCH=0（纯向量）
#   - HYBRID_SEARCH=1（混合检索）
# ============================================================
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from services import rag_service

TEST_SET = os.path.join(os.path.dirname(__file__), "questions.json")

top_k = config.RETRIEVE_TOP_K


def load_cases() -> list[dict]:
    with open(TEST_SET, "r", encoding="utf-8") as f:
        return json.load(f)["cases"]


def evaluate_one(case: dict) -> dict:
    """评测单个用例，返回详细结果。"""
    question = case["question"]
    expected = case["expected_docs"]
    behavior = case["expected_behavior"]
    hits = rag_service.retrieve(question, top_k=top_k)

    got_docs = [h["metadata"].get("doc_id") for h in hits]
    hit_set = set(got_docs)
    expected_set = set(expected)

    # 命中判定
    if behavior in ("hit", "hit_any"):
        matched = bool(expected_set & hit_set) if expected else not hit_set
    elif behavior == "reject":
        matched = not hit_set
    elif behavior == "reject_or_weak":
        # 可以接受空返回或 keyword_only
        if not hit_set:
            matched = True
            status = "empty"
        elif all(h.get("distance") is None for h in hits):
            matched = True
            status = "keyword_only"
        else:
            matched = False
            status = "unexpected_vector_hit"
    else:
        matched = False
        status = "unknown"

    # recall@K：期望文档出现在结果中；无期望文档时，空返回或 keyword_only 视为正确召回
    if expected:
        recall_k = bool(expected_set & hit_set)
    else:
        recall_k = matched  # 无期望时与命中判定保持一致（keyword_only 可接受）

    # 弱证据检查
    is_keyword_only = bool(hits) and all(h.get("distance") is None for h in hits)

    return {
        "id": case["id"],
        "question": question,
        "category": case["category"],
        "hits": len(hits),
        "got_docs": got_docs,
        "matched": matched,
        "recall_k": recall_k,
        "keyword_only": is_keyword_only,
    }


def run_suite(label: str, hybrid: bool) -> list[dict]:
    config.HYBRID_SEARCH = hybrid
    print(f"\n{'='*70}\n模式：{label}  (HYBRID_SEARCH={int(hybrid)})\n{'='*70}")
    results = []
    for case in load_cases():
        r = evaluate_one(case)
        results.append(r)
        status = "PASS" if r["matched"] else "FAIL"
        hit_str = "empty" if not r["got_docs"] else ",".join(r["got_docs"][:3])
        print(
            f"  [{status}] {case['id']} ({case['category']}) {case['question']:<18}"
            f" -> {hit_str}"
        )
    return results


def summarize(results: list[dict], label: str) -> dict:
    total = len(results)
    passed = sum(1 for r in results if r["matched"])
    recall_hits = sum(1 for r in results if r["recall_k"])
    rejects_ok = sum(
        1 for r in results
        if r["category"] == "无答案" and r["matched"]
    )
    reject_total = sum(1 for r in results if r["category"] == "无答案")
    keyword_only_count = sum(1 for r in results if r["keyword_only"])
    has_hits = sum(1 for r in results if r["hits"] > 0)

    by_cat: dict[str, dict] = {}
    for r in results:
        cat = r["category"]
        if cat not in by_cat:
            by_cat[cat] = {"total": 0, "pass": 0}
        by_cat[cat]["total"] += 1
        if r["matched"]:
            by_cat[cat]["pass"] += 1

    summary = {
        "label": label,
        "total": total,
        "hit_rate": passed / total if total else 0,
        "recall_at_k": recall_hits / total if total else 0,
        "reject_accuracy": rejects_ok / reject_total if reject_total else 0,
        "keyword_only_rate": keyword_only_count / has_hits if has_hits else 0,
        "by_category": {k: {"rate": v["pass"] / v["total"]} for k, v in by_cat.items()},
    }
    return summary


def print_summary(s: dict):
    print(f"\n--- {s['label']} 汇总 ---")
    print(f"  总用例数     : {s['total']}")
    print(f"  检索命中率   : {s['hit_rate']:.1%}")
    print(f"  Recall@K     : {s['recall_at_k']:.1%}")
    print(f"  无答案正确率 : {s['reject_accuracy']:.1%}")
    print(f"  弱证据占比   : {s['keyword_only_rate']:.1%} (在有命中的用例中)")
    print("  分类别命中率:")
    for cat, v in s["by_category"].items():
        print(f"    {cat:<10} : {v['rate']:.0%}")


def main():
    import datetime

    results_vector = run_suite("纯向量检索", hybrid=False)
    results_hybrid = run_suite("混合检索", hybrid=True)

    s_vec = summarize(results_vector, "纯向量")
    s_hyb = summarize(results_hybrid, "混合检索")

    print_summary(s_vec)
    print_summary(s_hyb)

    # 差异分析
    print(f"\n{'='*70}\n差异对比（混合 - 向量）\n{'='*70}")
    print(f"  检索命中率   : {s_hyb['hit_rate'] - s_vec['hit_rate']:+.1%}")
    print(f"  Recall@K     : {s_hyb['recall_at_k'] - s_vec['recall_at_k']:+.1%}")
    print(f"  无答案正确率 : {s_hyb['reject_accuracy'] - s_vec['reject_accuracy']:+.1%}")

    for case, rv, rh in zip(load_cases(), results_vector, results_hybrid):
        if rv["matched"] != rh["matched"]:
            label = "改善" if rh["matched"] else "退化"
            print(f"  [{label}] {case['id']} {case['question']}")
            print(f"    向量 -> {rv['got_docs']}")
            print(f"    混合 -> {rh['got_docs']}")

    # 保存报告到 JSON（带时间戳，便于历史对比）
    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "config": {
            "top_k": top_k,
            "hybrid_search": config.HYBRID_SEARCH,
            "retrieve_candidates": config.RETRIEVE_CANDIDATES,
            "rrf_k": config.RRF_K,
            "bm25_min_score": config.BM25_MIN_SCORE,
        },
        "vector_only": {"summary": s_vec, "details": results_vector},
        "hybrid": {"summary": s_hyb, "details": results_hybrid},
    }
    report_path = os.path.join(
        os.path.dirname(__file__),
        f"report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
    )
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n报告已保存：{report_path}")


if __name__ == "__main__":
    main()
