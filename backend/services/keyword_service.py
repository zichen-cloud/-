# ============================================================
# 关键词检索服务：本地 BM25（第三阶段）
# ------------------------------------------------------------
# 与向量检索互补：
#   向量检索擅长语义相近（"端午节吃什么" → 粽子制作）；
#   BM25 擅长精确关键词（"采青"、"减字谱" 这类专有名词/术语）。
#
# 中文分词：不引入 jieba 等新依赖，直接用连续双字（bigram）切词。
#   中文词语多为 2~4 字，bigram 能覆盖"昆曲/针法/采青"等术语，
#   且与知识库构建零成本同步。
#
# 索引在内存中维护（127 块规模很小），数据源是 Chroma 集合：
#   rag_service 在 导入/重建/upsert/delete 后调用 build() 刷新。
# ============================================================
import math
import re
from collections import Counter

# BM25 经典参数
K1 = 1.5
B = 0.75


def _tokenize(text: str) -> list[str]:
    """中文 bigram 切词：去空白后取连续双字。"""
    t = re.sub(r"\s+", "", text or "")
    return [t[i : i + 2] for i in range(len(t) - 1)]


class BM25Index:
    """极简 BM25Okapi 实现，足够支撑百~千级文档的本地检索。"""

    def __init__(self):
        self.ids: list[str] = []
        self.tf: list[Counter] = []     # 每篇文档的词频
        self.dl: list[int] = []         # 每篇文档长度（词数）
        self.df: Counter = Counter()    # 每个词的文档频率
        self.n = 0                      # 文档数
        self.avgdl = 0.0                # 平均文档长度

    def build(self, ids: list[str], texts: list[str]) -> None:
        self.ids = list(ids)
        self.tf = []
        self.dl = []
        self.df = Counter()
        for text in texts:
            counts = Counter(_tokenize(text))
            self.tf.append(counts)
            self.dl.append(sum(counts.values()))
            for term in counts:
                self.df[term] += 1
        self.n = len(self.ids)
        self.avgdl = sum(self.dl) / self.n if self.n else 0.0

    def search(self, query: str, top_k: int) -> list[dict]:
        """返回 [{"id", "score"}]，按 BM25 分数降序，只含 score > 0 的文档。"""
        if self.n == 0:
            return []
        terms = set(_tokenize(query))
        if not terms:
            return []
        scores = []
        for i in range(self.n):
            score = 0.0
            tf_i, dl_i = self.tf[i], self.dl[i]
            for term in terms:
                f = tf_i.get(term, 0)
                if f == 0:
                    continue
                df = self.df[term]
                idf = math.log(1 + (self.n - df + 0.5) / (df + 0.5))
                score += idf * (f * (K1 + 1)) / (f + K1 * (1 - B + B * dl_i / self.avgdl))
            if score > 0:
                scores.append({"id": self.ids[i], "score": score})
        scores.sort(key=lambda x: x["score"], reverse=True)
        return scores[:top_k]
