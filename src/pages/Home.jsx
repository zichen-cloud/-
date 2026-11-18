/* ============================================================
 * 首页 Home（2026-10 博物馆风改版）
 * ------------------------------------------------------------
 * 结构（对照设计稿）：
 *   ① Banner：水墨山水古画底 + 右侧水墨松树 + 中央标题
 *      （3 组文案自动轮播，圆点可点）
 *   ② 功能入口：AI 导师 / 数字传承人 / AI 识图 / 探索非遗 / 创作工坊 / 作品展厅
 *   ③ 典藏精选：卷轴轮播（10 幅非遗画作，中间放大，可切换）
 *   ④ 数字长卷：苏绣山水长卷，缓慢横移如展卷
 *   ⑤ 结尾 CTA
 *
 * 图片资产均在 public/images/home/ 下（AI 生成 + 本地后处理去背）。
 * ============================================================ */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllItems } from '../data/heritageService.js'
import Reveal from '../components/common/Reveal.jsx'
import DynamicHeritageBackground from '../components/home/DynamicHeritageBackground.jsx'
import HeritageHotspots from '../components/home/HeritageHotspots.jsx'

/* 功能入口（图标用内联 SVG，朱砂线描风） */
const ENTRIES = [
  { to: '/chat', label: 'AI 导师', icon: 'chat' },
  { to: '/persona', label: '数字传承人', icon: 'persona' },
  { to: '/recognize', label: 'AI 识图', icon: 'scan' },
  { to: '/heritage', label: '探索非遗', icon: 'compass' },
  { to: '/studio', label: '创作工坊', icon: 'brush' },
  { to: '/gallery', label: '作品展厅', icon: 'frame' },
]

/* 典藏精选 · 10 幅非遗主题画作（to：相关非遗深链，无对应则去知识馆） */
const PAINTINGS = [
  { src: '/images/home/painting-kunqu.jpg', title: '水袖惊鸿', cat: '昆曲 · 传统戏剧', to: '/heritage/kunqu' },
  { src: '/images/home/painting-papercut.jpg', title: '剪出繁花', cat: '剪纸 · 传统美术', to: '/heritage/paper-cutting' },
  { src: '/images/home/painting-cloisonne.jpg', title: '景泰蓝韵', cat: '景泰蓝 · 传统技艺', to: '/heritage/cloisonne' },
  { src: '/images/home/painting-suzhou.jpg', title: '苏绣春色', cat: '苏绣 · 传统美术', to: '/heritage/suzhou-embroidery' },
  { src: '/images/home/painting-shadow.jpg', title: '光影皮偶', cat: '皮影戏 · 传统戏剧', to: '/heritage/shadow-play' },
  { src: '/images/home/painting-lion.jpg', title: '瑞狮腾跃', cat: '醒狮 · 传统舞蹈', to: '/heritage/lion-dance' },
  { src: '/images/home/painting-lotus.jpg', title: '荷塘鹭影', cat: '工笔花鸟 · 传统美术', to: '/heritage' },
  { src: '/images/home/painting-shanshui.jpg', title: '青绿山水', cat: '青绿山水 · 传统美术', to: '/heritage' },
  { src: '/images/home/painting-calligraphy.jpg', title: '静观自得', cat: '书法 · 传统美术', to: '/heritage' },
  { src: '/images/home/painting-facemask.jpg', title: '脸谱春秋', cat: '京剧脸谱 · 传统戏剧', to: '/heritage/kunqu' },
]

export default function Home() {
  const items = getAllItems()

  /* Banner 文案轮播（3 组，6 秒一切，圆点可点） */
  const slides = [
    { title: '非遗灵境', sub: 'AI，让千年非遗走进当代生活' },
    { title: '探索千年技艺', sub: `${items.length} 项非遗档案，从昆曲到皮影，等你发现` },
    { title: '创作你的非遗', sub: 'AI 设计提案 · 3D 产品预览 · 一分钟成片' },
  ]
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 6000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* 典藏精选轮播：active 居中放大 */
  const [active, setActive] = useState(0)
  const prevPainting = () => setActive((a) => (a - 1 + PAINTINGS.length) % PAINTINGS.length)
  const nextPainting = () => setActive((a) => (a + 1) % PAINTINGS.length)

  return (
    <div
      className="bg-paper pb-20"
      style={{ backgroundImage: "url('/images/home/paper-texture.jpg')", backgroundSize: '720px' }}
    >
      {/* ============ ① Banner ============ */}
      <section className="relative isolate overflow-hidden border-b border-line/60">
        {/* 水墨山水古画底：降低不透明度，只作为氛围底 */}
        <div className="absolute inset-0 bg-[url('/images/home/banner-ink.jpg')] bg-cover bg-center opacity-[0.88]" />
        {/* 动态层：远山/近山漂移 + 云雾流动 + 祥云纹样 + 金色微粒 + 滚动视差
            （全部位于内容下方，装饰强度很低，不遮挡标题与按钮） */}
        <DynamicHeritageBackground variant="ink" className="opacity-90" />
        {/* 中央宣纸光晕：提高标题区对比度，让文字从画面中"浮"出来 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 58% 52% at 50% 46%, rgba(250,247,241,0.92) 0%, rgba(250,247,241,0.72) 42%, rgba(250,247,241,0.28) 70%, rgba(250,247,241,0) 100%)',
          }}
        />
        {/* 顶部/底部渐隐，和导航栏、下方功能区自然衔接 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-paper/60 to-transparent" />

        <div className="relative mx-auto flex h-[500px] max-w-6xl items-center px-6 md:h-[600px]">
          {/* 右侧水墨松树（透明 PNG，已降低透明度，避免压过标题） */}
          <img
            src="/images/home/ink-pine.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute right-[-2%] top-[4%] hidden h-[84%] -scale-x-100 opacity-55 lg:block"
          />

          {/* 中央标题块（居中，移动端与桌面端一致） */}
          <div className="relative z-10 mx-auto w-full max-w-2xl text-center">
            {/* key 触发动画重放，slide 切换时文案淡入 */}
            <div key={slide} className="animate-fade-up">
              <p className="text-xs font-medium tracking-[0.35em] text-ink-mute">
                HERITAGE × AI · 中国非物质文化遗产
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <h1 className="font-serif text-5xl font-bold tracking-wide text-ink md:text-6xl">
                  {slides[slide].title}
                </h1>
                {/* 朱砂印章角标 */}
                <span
                  className="mt-2 hidden h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cinnabar font-serif text-[13px] leading-none text-white shadow-md sm:flex"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  灵境
                </span>
              </div>
              <p className="mt-4 text-base leading-relaxed text-ink-soft md:text-lg">
                {slides[slide].sub}
              </p>
            </div>

            {/* 轮播圆点 */}
            <div className="mt-7 flex justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`切换到第 ${i + 1} 幅`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === slide ? 'w-6 bg-cinnabar' : 'w-2 bg-ink/20 hover:bg-ink/35'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 背景上的可点击纹样热点：点开非遗知识卡，可跳转详情页
            （只有这些小按钮可点击，背景本身仍不拦截鼠标） */}
        <HeritageHotspots />
      </section>

      {/* ============ ② 功能入口 ============ */}
      <Reveal className="container-page py-10">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-5">
          {ENTRIES.map((e) => (
            <Link
              key={e.label}
              to={e.to}
              className="group relative flex flex-col items-center rounded-2xl border border-line bg-white/85 px-3 py-6 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:border-cinnabar/30 hover:shadow-[0_14px_34px_rgba(38,36,31,0.12)]"
            >
              {/* 朱砂角印 */}
              <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-[3px] bg-cinnabar/90" />
              <span className="text-cinnabar transition group-hover:scale-110">
                <GateIcon name={e.icon} />
              </span>
              <span className="mt-3 font-serif text-sm font-semibold text-ink">{e.label}</span>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* ============ ③ 典藏精选（卷轴轮播） ============ */}
      <Reveal className="container-page relative isolate py-10">
        {/* 剪纸团花暗纹：只在本区块背后缓慢浮动 */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <DynamicHeritageBackground variant="papercut" layers={['pattern']} intensity={0.55} />
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Masterpieces</p>
            <h2 className="section-title mt-2">典藏精选</h2>
          </div>
          <Link to="/heritage" className="shrink-0 text-sm text-ink-soft transition hover:text-cinnabar">
            查看全部 {items.length} 项 →
          </Link>
        </div>

        <div className="mt-8 flex items-center gap-3 sm:gap-6">
          <button
            onClick={prevPainting}
            aria-label="上一幅"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white/85 text-ink-soft transition hover:border-cinnabar/40 hover:text-cinnabar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>

          {/* 三幅卷轴：active 居中放大，两侧缩小压暗（仅渲染相邻 3 幅） */}
          <div className="flex flex-1 items-center justify-center gap-4 overflow-hidden sm:gap-8">
            {[
              PAINTINGS[(active - 1 + PAINTINGS.length) % PAINTINGS.length],
              PAINTINGS[active],
              PAINTINGS[(active + 1) % PAINTINGS.length],
            ].map((p, slot) => {
              // slot 0 = 左侧（上一幅），1 = 中间（当前），2 = 右侧（下一幅）
              const isActive = slot === 1
              const targetIndex = (active + slot - 1 + PAINTINGS.length) % PAINTINGS.length
              const card = (
                <div
                  className={`relative shrink-0 transition-all duration-500 ${
                    isActive ? 'w-[62%] sm:w-[340px]' : 'w-[30%] scale-90 opacity-60 sm:w-[210px]'
                  }`}
                >
                  {/* 卷轴上杆 */}
                  <div className="h-2.5 rounded-full bg-gradient-to-b from-[#8A6D3B] to-[#5C4525] shadow-sm" />
                  {/* 画纸 */}
                  <div
                    className="border-x-2 border-[#D9CFBB] bg-[#F6F1E4] p-2 shadow-[0_16px_40px_rgba(38,36,31,0.16)]"
                    style={{ backgroundImage: "url('/images/home/paper-texture.jpg')", backgroundSize: '480px' }}
                  >
                    <img
                      src={p.src}
                      alt={p.title}
                      className="w-full rounded-sm border border-[#E4DCCB] object-cover"
                      loading={isActive ? 'eager' : 'lazy'}
                    />
                    {isActive && (
                      <div className="py-2.5 text-center">
                        <p className="font-serif text-base font-semibold text-ink">{p.title}</p>
                        <p className="mt-0.5 text-xs text-ink-mute">{p.cat}</p>
                      </div>
                    )}
                  </div>
                  {/* 卷轴下杆 */}
                  <div className="h-2.5 rounded-full bg-gradient-to-b from-[#8A6D3B] to-[#5C4525] shadow-sm" />
                </div>
              )
              // 仅当前幅可点击跳转，两侧幅点击 = 切换到它
              return isActive ? (
                <Link key={`center-${p.title}`} to={p.to} className="contents" aria-label={`查看${p.title}相关内容`}>
                  {card}
                </Link>
              ) : (
                <button
                  key={`side-${p.title}`}
                  onClick={() => setActive(targetIndex)}
                  className="contents"
                  aria-label={`切换到${p.title}`}
                >
                  {card}
                </button>
              )
            })}
          </div>

          <button
            onClick={nextPainting}
            aria-label="下一幅"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white/85 text-ink-soft transition hover:border-cinnabar/40 hover:text-cinnabar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        {/* 轮播圆点 */}
        <div className="mt-6 flex justify-center gap-2">
          {PAINTINGS.map((p, i) => (
            <button
              key={p.title}
              onClick={() => setActive(i)}
              aria-label={`切换到${p.title}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === active ? 'w-6 bg-cinnabar' : 'w-2 bg-ink/20 hover:bg-ink/35'
              }`}
            />
          ))}
        </div>
      </Reveal>

      {/* ============ ④ 数字长卷（苏绣山水） ============ */}
      <Reveal className="container-page relative isolate py-10">
        {/* 刺绣纹样暗纹 */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <DynamicHeritageBackground variant="embroidery" layers={['pattern']} intensity={0.5} />
        </div>
        <div className="text-center">
          <p className="eyebrow">Digital Scroll</p>
          <h2 className="section-title mt-2">数字典藏 · 苏绣长卷</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-mute">
            以数字方式记录、研究与传承非遗之美——苏绣丝线织就山水，长卷徐徐展开。
          </p>
        </div>
        {/* 长卷外框：深色木框 + 缓慢横移的卷心 */}
        <div className="mt-8 rounded-lg bg-gradient-to-b from-[#6B5136] to-[#4A3826] p-2.5 shadow-[0_18px_48px_rgba(38,36,31,0.22)] sm:p-3">
          <div className="relative h-[200px] overflow-hidden rounded-sm border border-[#3A2C1D] sm:h-[280px]">
            <div className="absolute inset-0 animate-scroll-pan bg-[url('/images/home/embroidery-scroll.jpg')] bg-cover bg-center" />
          </div>
        </div>
      </Reveal>

      {/* ============ ⑤ 结尾 CTA：宣纸画卷 + 淡墨远山 ============ */}
      <Reveal className="container-page pt-10">
        <div className="relative overflow-hidden rounded-3xl border border-line/70 bg-gradient-to-b from-[#FCF7EB] via-[#F8F1E1] to-[#F2E8D6] px-6 py-16 text-center md:py-20">
          {/* 底部水墨远山：化进纸面，只作氛围 */}
          <img
            src="/images/decor/ink-band.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-36 w-full select-none object-cover opacity-45 mix-blend-multiply md:h-44"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, #000 70%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 70%)',
            }}
          />
          {/* 内框细线：取传统立轴装裱的双线 */}
          <div className="pointer-events-none absolute inset-3 rounded-2xl border border-gold/25" />
          <div className="pointer-events-none absolute inset-[14px] rounded-[14px] border border-gold/15" />

          {/* 右下角朱砂篆印 */}
          <span
            className="absolute bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-[3px] bg-cinnabar/90 font-serif text-[13px] leading-none text-white/95 shadow-sm md:bottom-8 md:right-8"
            style={{ writingMode: 'vertical-rl', letterSpacing: '0.1em' }}
            aria-hidden="true"
          >
            非遗
          </span>

          <div className="relative z-10">
            <p className="text-[11px] font-medium tracking-[0.35em] text-ink-mute">HERITAGE × AI</p>
            <p className="mt-3 font-serif text-2xl font-semibold tracking-wide text-ink sm:text-3xl">
              让千年非遗，走进当代生活
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
              从探索一项技艺，到亲手创作一件作品——非遗灵境陪你完成这段旅程。
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/heritage" className="btn-primary">
                探索非遗
              </Link>
              <Link to="/studio" className="btn-ghost">
                开始创作
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  )
}

/* 功能入口图标（内联 SVG，线描） */
function GateIcon({ name }) {
  const common = {
    width: 34,
    height: 34,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'chat': // AI 导师：对话气泡
      return (
        <svg {...common}>
          <path d="M20 12a8 8 0 1 1-3.2-6.4L21 4l-1.2 3.6A8 8 0 0 1 20 12Z" />
          <path d="M8.5 11.5h7M8.5 14h4.5" />
        </svg>
      )
    case 'persona': // 数字传承人：人物半身像
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.2" />
          <path d="M5.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
          <path d="M9 8.2c0-1.7 1.3-3 3-3s3 1.3 3 3" />
        </svg>
      )
    case 'scan': // AI 识图：取景框
      return (
        <svg {...common}>
          <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'compass': // 探索非遗：罗盘
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5Z" />
        </svg>
      )
    case 'brush': // 创作工坊：毛笔
      return (
        <svg {...common}>
          <path d="M20 4c-4 2-9.5 6.5-12 10l2 2c3.5-2.5 8-8 10-12Z" />
          <path d="M8 14c-1.5.5-3 2-3.5 4.5 2.5-.5 4-2 4.5-3.5" />
          <path d="M4.5 18.5 3 21" />
        </svg>
      )
    default: // 作品展厅：画框
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="1.5" />
          <path d="M4 15l4.5-4.5 3.5 3.5 3-3L20 16" />
          <circle cx="9.5" cy="9" r="1.2" />
        </svg>
      )
  }
}
