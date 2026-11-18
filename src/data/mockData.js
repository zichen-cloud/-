/* ============================================================
 * 首页专用静态数据
 * ------------------------------------------------------------
 * 注意：非遗项目数据在 src/data/heritage.json（22 项，与后端
 *       RAG 知识库同步），通过 heritageService.js 统一访问。
 * 首页统计数字不再写死，由 Home.jsx 从真实数据实时计算。
 * 本文件只保留 Hero 主视觉图描述与 AI 能力入口数据。
 * ============================================================ */

/* 首页 Hero 主视觉的图片描述（由 utils/image.js 拼接成图片地址） */
export const heroImagePrompt =
  '中国传统工艺与人工智能融合的现代水墨插画，宣纸质感，淡雅朱砂红与墨色，大量留白，意境悠远，无文字'

/* 首页"AI 能力"板块数据。icon 对应 Home.jsx 中定义的内联 SVG 图标 */
export const aiFeatures = [
  {
    id: 'chat',
    path: '/chat',
    icon: 'chat',
    title: 'AI 非遗导师',
    desc: '基于本地非遗知识库的 RAG 检索问答，回答附上原文片段与资料来源，知识不足时坦诚相告，绝不编造。',
    actionText: '开始对话',
  },
  {
    id: 'recognize',
    path: '/recognize',
    icon: 'scan',
    title: 'AI 图像识别',
    desc: '多模态视觉模型解读非遗图片：推测技艺类别、描述纹样特征，并给出需要核实的信息与学习建议。',
    actionText: '上传识别',
  },
  {
    id: 'studio',
    path: '/studio',
    icon: 'brush',
    title: '文化创作工坊',
    desc: '生成式 AI 全流程创作：文创提案 → 效果图 → 3D 展示 → 介绍视频 → AI 配音，作品可保存回味。',
    actionText: '进入工坊',
  },
]
