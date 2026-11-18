/* ============================================================
 * 创作工坊 · 表单选项常量
 * ------------------------------------------------------------
 * 把"可选项"单独放在一个文件，团队维护时只改这里：
 *   - themes：       非遗主题（剪纸 / 刺绣 / 传统纹样 …）
 *   - createTypes：  创作类型（做什么用的设计）
 *   - styles：       视觉风格
 *
 * 内容原则（重要）：
 *   元素描述只写"视觉形式特征"（形状、色彩、排列方式），
 *   不写未经核实的历史年代、起源故事与文化寓意。
 * ============================================================ */

/* ---------------- 非遗主题 ---------------- */
export const themes = [
  {
    id: 'paper-cutting',
    name: '剪纸',
    tagline: '红纸镂空 · 线条相连',
    icon: 'scissors',
    // 该主题可抽取的视觉元素（供 mock 方案的"传统元素说明"使用）
    elements: [
      {
        name: '对称镂空造型',
        desc: '沿对折线剪出左右对称的外形，内部镂空形成图底关系，注意线条之间保留连接点。',
      },
      {
        name: '锯齿纹与月牙纹',
        desc: '细密锯齿适合表现毛发与纹理，弧形缺口（月牙形）适合表现花瓣与卷草，是常见的剪纸刀法语言。',
      },
    ],
    // 该主题的参考配色（设计建议色值，非文物考据色）
    palette: [
      { name: '剪纸红', hex: '#C0392B' },
      { name: '宣纸白', hex: '#FAF7F1' },
      { name: '墨黑', hex: '#2A2722' },
    ],
  },
  {
    id: 'embroidery',
    name: '刺绣',
    tagline: '丝线光泽 · 细腻针法',
    icon: 'needle',
    elements: [
      {
        name: '丝线渐变层次',
        desc: '用邻近色丝线套色叠加，形成柔和的明暗过渡，模拟刺绣平齐细密的观感。',
      },
      {
        name: '花鸟折枝构图',
        desc: '以折枝花、禽鸟为主体，留出大面积"水路"（留白），主体集中而不铺满画面。',
      },
    ],
    palette: [
      { name: '藕粉', hex: '#D8A7B1' },
      { name: '天青', hex: '#8FB4C4' },
      { name: '月白', hex: '#EEF2F0' },
    ],
  },
  {
    id: 'traditional-pattern',
    name: '传统纹样',
    tagline: '祥云缠枝 · 连续纹样',
    icon: 'pattern',
    elements: [
      {
        name: '二方连续带饰',
        desc: '把一个单元纹样向左右重复排列形成带状，适合做边框、包装腰封与纺织品边缘。',
      },
      {
        name: '卷曲流动的线条',
        desc: '以螺旋卷曲、首尾呼应的线条构成云纹或缠枝形态，线条粗细均匀、走向圆转。',
      },
    ],
    palette: [
      { name: '黛蓝', hex: '#3E5C76' },
      { name: '鎏金', hex: '#B08D4F' },
      { name: '米白', hex: '#F2EDE3' },
    ],
  },
  {
    id: 'cloisonne',
    name: '景泰蓝纹样',
    tagline: '掐丝分色 · 釉色饱满',
    icon: 'enamel',
    elements: [
      {
        name: '金属线分区',
        desc: '用细线条模拟铜丝掐出的轮廓，把画面分割成一个个可填色的封闭区域。',
      },
      {
        name: '高饱和平涂色块',
        desc: '在分区内填入宝蓝、朱砂、松石绿等饱和色，色块之间不渐变，边界清晰。',
      },
    ],
    palette: [
      { name: '珐琅宝蓝', hex: '#1F5A8A' },
      { name: '朱砂', hex: '#B23A2E' },
      { name: '松石绿', hex: '#4E9D8E' },
    ],
  },
  {
    id: 'shadow-play',
    name: '皮影',
    tagline: '牛皮镂刻 · 侧影透光',
    icon: 'puppet',
    elements: [
      {
        name: '正侧面轮廓',
        desc: '人物取正侧面（五分脸）造型，五官概括夸张，外轮廓连贯、辨识度高。',
      },
      {
        name: '镂空花纹透光',
        desc: '在人物服饰区域镂刻细密花纹，模拟灯光穿过皮片形成的明暗点阵。',
      },
    ],
    palette: [
      { name: '牛皮黄', hex: '#D9A441' },
      { name: '赭石', hex: '#9C5A2E' },
      { name: '幕布深红', hex: '#5C2018' },
    ],
  },
  /* ---- 以下主题与知识库 21 项对齐 ---- */
  {
    id: 'lion-dance',
    name: '醒狮',
    tagline: '红金狮头 · 采青登高',
    icon: 'lion',
    elements: [
      { name: '狮头造型', desc: '额高眼大、色彩艳丽，以红金为主色调，狮角高耸。' },
      { name: '采青动作', desc: '狮队通过腾跃、上桩等动作采下悬挂的青菜，寓意吉利。' },
    ],
    palette: [
      { name: '醒狮红', hex: '#C0392B' },
      { name: '鎏金', hex: '#B08D4F' },
      { name: '墨色', hex: '#2A2722' },
    ],
  },
  {
    id: 'peking-opera',
    name: '京剧',
    tagline: '生旦净丑 · 唱念做打',
    icon: 'mask',
    elements: [
      { name: '脸谱色彩', desc: '红忠白奸黑刚直，色彩直接暗示人物性格。' },
      { name: '水袖身段', desc: '长袖善舞，通过袖子的抛、抖、甩表达情绪。' },
    ],
    palette: [
      { name: '脸谱红', hex: '#C0392B' },
      { name: '皂色', hex: '#2A2722' },
      { name: '金线黄', hex: '#D4A94E' },
    ],
  },
  {
    id: 'guqin',
    name: '古琴',
    tagline: '七弦十三徽 · 文人雅乐',
    icon: 'music',
    elements: [
      { name: '琴身线条', desc: '狭长琴身，面板微拱，线条简洁流畅。' },
      { name: '徽位标记', desc: '十三枚螺钿徽位沿琴面排列，标记泛音位置。' },
    ],
    palette: [
      { name: '漆黑', hex: '#1A1A1A' },
      { name: '螺钿白', hex: '#E8E0D0' },
      { name: '断纹金', hex: '#8B7355' },
    ],
  },
  {
    id: 'taijiquan',
    name: '太极拳',
    tagline: '以柔克刚 · 连绵不断',
    icon: 'taiji',
    elements: [
      { name: '圆弧运动', desc: '动作以腰为轴，四肢走圆弧，连绵不断。' },
      { name: '阴阳对比', desc: '虚实分明，动静相生，如阴阳鱼般互补。' },
    ],
    palette: [
      { name: '太极白', hex: '#F5F0E8' },
      { name: '玄黑', hex: '#2A2722' },
      { name: '青灰', hex: '#8C9BAB' },
    ],
  },
  {
    id: 'acupuncture',
    name: '中医针灸',
    tagline: '经络腧穴 · 毫针艾灸',
    icon: 'needle',
    elements: [
      { name: '经络线路', desc: '以线条标注人体经络走向，穴位以点标记。' },
      { name: '艾草燃烧', desc: '艾绒燃烧产生温热，烟雾袅袅上升。' },
    ],
    palette: [
      { name: '艾绒黄', hex: '#D4A94E' },
      { name: '经络青', hex: '#4A7B9D' },
      { name: '宣纸白', hex: '#FAF7F1' },
    ],
  },
  {
    id: 'dragon-boat',
    name: '端午节',
    tagline: '龙舟竞渡 · 粽叶飘香',
    icon: 'boat',
    elements: [
      { name: '龙舟造型', desc: '狭长船身，龙头高昂，船身绘有鳞片纹。' },
      { name: '粽叶包裹', desc: '箬叶或苇叶包裹糯米，捆扎成三角或四角形。' },
    ],
    palette: [
      { name: '艾草绿', hex: '#6B8E5A' },
      { name: '粽叶青', hex: '#4A7B5D' },
      { name: '朱砂红', hex: '#B23A2E' },
    ],
  },
  {
    id: 'solar-terms',
    name: '二十四节气',
    tagline: '春雨惊春 · 清谷天',
    icon: 'calendar',
    elements: [
      { name: '节气物候', desc: '每个节气对应特定动植物变化，如"桃始华""蝉始鸣"。' },
      { name: '农事场景', desc: '播种、收获、祭祀等场景随节气轮转。' },
    ],
    palette: [
      { name: '立春嫩绿', hex: '#8FBF6B' },
      { name: '冬至藏青', hex: '#2C4A6B' },
      { name: '秋分金黄', hex: '#D4A94E' },
    ],
  },
  {
    id: 'xuan-paper',
    name: '宣纸',
    tagline: '纸寿千年 · 青檀稻草',
    icon: 'paper',
    elements: [
      { name: '纤维纹理', desc: '青檀皮与稻草纤维交织，形成细密纹理。' },
      { name: '帘纹痕迹', desc: '捞纸时竹帘留下的平行细线，是手工纸的标志。' },
    ],
    palette: [
      { name: '宣纸白', hex: '#FAF7F1' },
      { name: '青檀褐', hex: '#8B7355' },
      { name: '稻草黄', hex: '#D4C5A9' },
    ],
  },
  {
    id: 'jingdezhen',
    name: '景德镇瓷器',
    tagline: '七十二道工序 · 白如玉',
    icon: 'porcelain',
    elements: [
      { name: '青花钴料', desc: '钴料在素坯上绘出蓝色纹样，罩透明釉烧成。' },
      { name: '器型曲线', desc: '瓶、罐、碗等器型讲究口、颈、腹、足的比例关系。' },
    ],
    palette: [
      { name: '青花蓝', hex: '#2C5F8A' },
      { name: '瓷白', hex: '#F5F5F0' },
      { name: '釉里红', hex: '#B23A2E' },
    ],
  },
  {
    id: 'dong-choir',
    name: '侗族大歌',
    tagline: '多声部合唱 · 无指挥',
    icon: 'music',
    elements: [
      { name: '鼓楼建筑', desc: '侗寨中心的木质鼓楼，层层叠叠的檐角。' },
      { name: '歌队围坐', desc: '歌队围坐成圈，无指挥无伴奏自然和声。' },
    ],
    palette: [
      { name: '鼓楼木色', hex: '#8B6914' },
      { name: '侗布蓝', hex: '#2C4A6B' },
      { name: '银饰白', hex: '#E8E0D0' },
    ],
  },
  {
    id: 'xiangsheng',
    name: '相声',
    tagline: '说学逗唱 · 包袱不断',
    icon: 'microphone',
    elements: [
      { name: '折扇醒目', desc: '演员手持折扇，既是道具也是表演节奏的一部分。' },
      { name: '长衫马褂', desc: '传统相声演员着长衫，颜色多素雅。' },
    ],
    palette: [
      { name: '长衫灰', hex: '#8C9BAB' },
      { name: '醒目红', hex: '#C0392B' },
      { name: '纸扇白', hex: '#FAF7F1' },
    ],
  },
  {
    id: 'suzhou-pingtan',
    name: '苏州评弹',
    tagline: '吴侬软语 · 三弦琵琶',
    icon: 'music',
    elements: [
      { name: '三弦琵琶', desc: '演员自弹自唱，三弦与琵琶音色互补。' },
      { name: '书场氛围', desc: '茶馆书场，一桌二椅，听众品茗听书。' },
    ],
    palette: [
      { name: '琵琶木色', hex: '#8B6914' },
      { name: '旗袍青', hex: '#4A7B9D' },
      { name: '茶色', hex: '#A68B5B' },
    ],
  },
  {
    id: 'yangliuqing',
    name: '杨柳青年画',
    tagline: '半印半绘 · 胖娃娃',
    icon: 'painting',
    elements: [
      { name: '胖娃娃形象', desc: '圆脸胖身，怀抱鲤鱼或莲花，寓意吉祥。' },
      { name: '套色印刷', desc: '木版套印后手工彩绘，色彩明快柔和。' },
    ],
    palette: [
      { name: '年画红', hex: '#C0392B' },
      { name: '娃娃粉', hex: '#F5D0D0' },
      { name: '柳青绿', hex: '#6B8E5A' },
    ],
  },
  {
    id: 'liangzhu',
    name: '梁祝传说',
    tagline: '化蝶双飞 · 千古爱情',
    icon: 'butterfly',
    elements: [
      { name: '蝴蝶意象', desc: '两只蝴蝶翩翩起舞，象征爱情的升华。' },
      { name: '书院场景', desc: '古代书院的窗棂、书案、柳枝等元素。' },
    ],
    palette: [
      { name: '蝶翅蓝', hex: '#4A7B9D' },
      { name: '书院青', hex: '#6B8E5A' },
      { name: '桃花粉', hex: '#F5D0D0' },
    ],
  },
  {
    id: 'yueju-opera',
    name: '粤剧',
    tagline: '南国红豆 · 红船子弟',
    icon: 'mask',
    elements: [
      { name: '粤剧头饰', desc: '华丽的水钻头面，珠花与流苏摇曳。' },
      { name: '戏服刺绣', desc: '广绣戏服，金银线绣出龙凤图案。' },
    ],
    palette: [
      { name: '粤剧红', hex: '#C0392B' },
      { name: '金线黄', hex: '#D4A94E' },
      { name: '粤绣蓝', hex: '#2C5F8A' },
    ],
  },
]

/* ---------------- 创作类型（设计用在哪） ---------------- */
export const createTypes = [
  { id: 'merch', name: '文创周边', hint: '帆布袋、笔记本、徽章等实物周边的平面设计' },
  { id: 'poster', name: '海报插画', hint: '活动或展览的竖版主视觉海报' },
  { id: 'wallpaper', name: '数字壁纸', hint: '手机或电脑桌面的数字背景图' },
  { id: 'packaging', name: '礼品包装', hint: '礼盒、手提袋或包装纸图案' },
]

/* ---------------- 产品类型（效果图与 3D 展示的具体载体） ----------------
 * 阶段一用于效果图；阶段二会为每类产品匹配对应的 3D 模型。
 * 说明文字只描述版式适配，不涉及文化含义。 */
export const productTypes = [
  { id: 'tote-bag', name: '帆布袋', hint: '单面印花，适合主体纹样', icon: 'bag' },
  { id: 'mug', name: '马克杯', hint: '杯身环绕的横向图案', icon: 'cup' },
  { id: 'phone-case', name: '手机壳', hint: '竖版小尺寸，主体要突出', icon: 'phone' },
  { id: 'bookmark', name: '书签', hint: '窄长构图，适合竖向纹样', icon: 'bookmark' },
  { id: 'fridge-magnet', name: '冰箱贴', hint: '方形小画面，图案要完整', icon: 'magnet' },
  { id: 'cushion', name: '抱枕方巾', hint: '方形居中构图，四周留边', icon: 'cushion' },
]

/* ---------------- 视觉风格 ---------------- */
export const styles = [
  {
    id: 'minimal',
    name: '极简现代',
    hint: '大量留白，仅保留一到两个核心图形',
    // 风格对应的构图建议（mock 使用）
    composition: [
      '主体缩小并置于画面一侧，留出至少一半留白，信息文字与主体保持宽松间距',
      '全图控制在两到三个颜色内，用单色突出非遗主体',
    ],
  },
  {
    id: 'guochao',
    name: '国潮撞色',
    hint: '高饱和对比色，年轻有冲击力',
    composition: [
      '主体放大居中或略微倾斜，形成强烈视觉焦点',
      '用互补色制造撞色对比，文字可做竖向排版呼应传统版式',
    ],
  },
  {
    id: 'ink-wash',
    name: '水墨淡彩',
    hint: '墨色晕染与淡雅设色',
    composition: [
      '用墨色浓淡层次代替硬边框，主体边缘做晕染虚化处理',
      '遵循疏密对比：密集细节集中在一处，其余区域大面积留白',
    ],
  },
  {
    id: 'flat',
    name: '扁平插画',
    hint: '几何概括、色块平涂',
    composition: [
      '把传统元素概括为简单几何形，用统一粗细的线条串联',
      '采用分层色块表现前后关系，每层颜色明度拉开',
    ],
  },
]

/* 生成中的分步文案（让等待过程更像真实 AI 应用） */
export const generatingSteps = [
  '解析创作需求',
  '匹配传统视觉元素',
  '组织配色与构图',
  '生成设计方案',
]

/* 产品效果图生成的分步文案（真实 AI 文案 + 效果图，耗时更长） */
export const proposalSteps = [
  '解析产品与设计要求',
  '生成 3 套差异化设计提案',
  '渲染产品效果图',
  '整理非遗元素说明',
]

/* 便捷查询函数：根据 id 找到选项对象 */
export function getThemeById(id) {
  return themes.find((t) => t.id === id)
}
export function getCreateTypeById(id) {
  return createTypes.find((t) => t.id === id)
}
export function getProductTypeById(id) {
  return productTypes.find((t) => t.id === id)
}
export function getStyleById(id) {
  return styles.find((s) => s.id === id)
}

/* ============================================================
 * 知识馆 → 创作工坊 的主题映射（阶段五：打通"探索→创作"链路）
 * ------------------------------------------------------------
 * heritage.json 的项目 id 与工坊主题 id 大部分同名，少数不同：
 *   - 命名差异：suzhou-embroidery→embroidery、dragon-boat-festival→dragon-boat 等
 *   - 工坊无对应主题时归入最接近的主题（昆曲归戏曲、榫卯/云锦归纹样丝织）
 * 映射结果必须存在于 themes 中（getThemeById 可命中），否则返回 null。
 * ============================================================ */
const HERITAGE_TO_THEME = {
  // 同名主题（知识馆 id = 工坊主题 id）
  'paper-cutting': 'paper-cutting',
  cloisonne: 'cloisonne',
  'shadow-play': 'shadow-play',
  'lion-dance': 'lion-dance',
  'peking-opera': 'peking-opera',
  guqin: 'guqin',
  taijiquan: 'taijiquan',
  acupuncture: 'acupuncture',
  'solar-terms': 'solar-terms',
  xiangsheng: 'xiangsheng',
  'suzhou-pingtan': 'suzhou-pingtan',
  'xuan-paper': 'xuan-paper',
  'dong-choir': 'dong-choir',
  // 命名差异
  'suzhou-embroidery': 'embroidery',
  'dragon-boat-festival': 'dragon-boat',
  'liangzhu-legend': 'liangzhu',
  'jingdezhen-porcelain': 'jingdezhen',
  'yangliuqing-newyear-painting': 'yangliuqing',
  'yueju-cantonese-opera': 'yueju-opera',
  // 工坊无对应主题，归入最接近的
  kunqu: 'peking-opera', // 戏曲类：脸谱、水袖、行头元素相通
  sunmao: 'traditional-pattern', // 木作榫卯 → 传统纹样
  yunjin: 'embroidery', // 云锦织造 → 丝织刺绣工艺
}

/* 详情页"使用该非遗元素创作"用的映射查询：找不到时返回 null */
export function getThemeForHeritage(heritageId) {
  const themeId = HERITAGE_TO_THEME[heritageId]
  if (!themeId) return null
  return getThemeById(themeId) ? themeId : null
}
