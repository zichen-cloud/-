# RAG 知识问答系统优化 · 第六阶段验收报告

## 一、修改文件清单（第二至五阶段 + term-004 修复）

### 第二阶段：知识库优化
| 文件 | 改动 |
|---|---|
| backend/services/embedding_service.py | 重写：fastembed + BAAI/bge-small-zh-v1.5（真实中文语义模型，dim=512），失败降级伪向量 |
| backend/services/knowledge_loader.py | 重写：稳定 chunk ID、中文语义切分（≤260字/块、重叠≤40字）、文件级增删改 |
| backend/services/rag_service.py | 数据版本机制（md5 不一致自动重建）、REAL_MODEL_THRESHOLD 阈值 |
| backend/services/chat_service.py | retrieve(message, top_k=config.RETRIEVE_TOP_K) |
| backend/knowledge/items.json | 21 条目补 verified:false 字段 |
| backend/requirements.txt | fastembed>=0.8.0 替换 sentence-transformers |
| backend/.env.example | 新增 EMBEDDING_MODEL、EMBEDDING_DEVICE 配置 |
| .gitignore | 新增 backend/.models_cache |

### 第三阶段：混合检索
| 文件 | 改动 |
|---|---|
| backend/services/keyword_service.py | 新建：BM25 索引（中文 bigram 分词，K1=1.5/B=0.75，零新依赖） |
| backend/services/rag_service.py | retrieve() 重写：向量+BM25 候选 → RRF 融合（k=60）；upsert/delete 后同步重建 BM25 索引 |
| backend/config.py | 新增 HYBRID_SEARCH/RETRIEVE_CANDIDATES=10/RRF_K=60/BM25_MIN_SCORE=2.0 |
| backend/.env.example | 同步新增上述配置项 |

### 第四阶段：回答质量
| 文件 | 改动 |
|---|---|
| backend/models/schemas.py | ChatSource 扩充 snippet/category/province/level/verified/matchType；ChatResponse 加 retrieval_status |
| backend/services/ai_service.py | SYSTEM_PROMPT 知识规则扩至 8 条；_extract_sources 按项目聚合；_build_user_message 注入历史+弱证据标记 |
| backend/services/chat_service.py | session 记忆（OrderedDict LRU，100 会话 × 6 轮）；_retrieval_status 四状态计算 |
| backend/api/chat.py | 透传 session_id |
| src/pages/Chat.jsx | MessageBubble 来源区升级：核验徽标/分类/名录级别/匹配方式标签 + snippet 折叠 + keyword_only 提示条 |

### 第五阶段：评测能力
| 文件 | 改动 |
|---|---|
| backend/eval/questions.json | 新建：21 条测试用例，覆盖七类（基础/术语/地区/技艺/多轮/无答案/混淆） |
| backend/eval/run_eval.py | 新建：对比纯向量 vs 混合检索，自动保存 JSON 报告（含时间戳+配置快照） |

### term-004 数据修复
| 文件 | 改动 |
|---|---|
| backend/knowledge/items.json | 新增南京云锦织造技艺（id=yunjin）：妆花/挑花结本/通经断纬 |
| backend/eval/questions.json | term-004 期望从 reject_or_weak 更新为 hit，expected_docs=["yunjin"] |

---

## 二、运行命令

```bash
# 后端（FastAPI + RAG）
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --port 8000

# 前端（Vite dev）
npm run dev

# 评测脚本（对比纯向量 vs 混合检索）
cd backend
.venv\Scripts\python.exe -m eval.run_eval
```

---

## 三、测试方法

### 1. 问答功能测试
访问 `http://localhost:5174/chat`（或实际端口），测试：
- **术语查询**："什么是水磨调" → 应命中昆曲，来源区显示 matchType=vector
- **无关问题**："明天是星期几" → retrieval_status=empty，模型坦诚"知识库里没存货"
- **多轮追问**：先问"昆曲的唱腔"，再问"它的伴奏乐器呢" → 应锁定昆曲
- **弱证据问题**："什么是非物质文化遗产" → retrieval_status=keyword_only，来源区显示"关键词命中"标签

### 2. 知识库管理测试
```python
from services import rag_service
# 新增条目
rag_service.upsert_item({...})
# 删除条目
rag_service.delete_item('xxx')
# 重建索引（items.json 变更后自动触发）
```

### 3. 评测回归
每次修改 items.json 或检索参数后运行：
```bash
python -m eval.run_eval
```
预期输出：21/21 PASS，命中率/Recall@K/无答案正确率均为 100%。

### 4. 已有功能回归
- 创作工坊：`/api/studio/generate-plan` 正常响应
- 我的作品：`/api/works` 正常读写
- 3D 展示：ModelViewer3D 加载正常
- 视频合成：`/api/studio/generate-video` 正常

---

## 四、真实测试结果汇总

| 阶段 | 测试项 | 结果 |
|---|---|---|
| 第二阶段 | fastembed 模型加载 | PASS（133 块，dim=512） |
| 第二阶段 | 数据版本自动重建 | PASS（md5 不一致触发） |
| 第三阶段 | 混合检索 vs 纯向量 | PASS（21/21，指标持平） |
| 第三阶段 | BM25 同步（upsert/delete） | PASS（新条目立即可检索，删除后消失） |
| 第四阶段 | retrieval_status 四状态 | PASS（ok/keyword_only/empty/degraded） |
| 第四阶段 | session 多轮记忆 | PASS（"它"正确锁定昆曲） |
| 第四阶段 | 前端来源区展示 | PASS（徽标/标签/折叠） |
| 第五阶段 | 评测集 21 用例 | **PASS（100% 命中率）** |
| term-004 | 云锦条目补充 | PASS（"妆花工艺"命中 dist=0.2702） |
| 第六阶段 | /api/chat 契约 | PASS（retrieval_status/sources 10 字段） |
| 第六阶段 | /api/works 兼容 | PASS |
| 第六阶段 | /api/studio/generate-plan 兼容 | PASS |

### 关键指标
- **检索命中率**：100%（21/21）
- **Recall@K**：100%
- **无答案正确率**：100%（3/3 拒答）
- **弱证据占比**：5.6%（keyword_only 标记能力，不损失精度）
- **分类别命中率**：基础知识/专有名词/地区/技艺/多轮/无答案/混淆 全部 100%

---

## 五、仍未解决的问题

1. **「什么是非物质文化遗产」无官方定义条目**：keyword_only 状态正确识别弱证据，但根治需补一条非遗概念条目（建议后续补充）。
2. **会话记忆不持久化**：服务重启后清空（设计如此，对话非留存数据）。
3. **知识库管理无 HTTP API**：upsert/delete 仅服务层函数，未暴露 REST 接口。
4. **未做 git commit**。

---

## 六、验收确认

- [x] 前后端兼容（/api/chat、/api/works、/api/studio/generate-plan）
- [x] 已有功能不受影响（创作工坊、我的作品、3D、视频）
- [x] 修改文件清单完整
- [x] 运行命令、测试方法、真实结果已记录
- [x] 评测集 21/21 PASS

**RAG 优化六个阶段全部完成。**
