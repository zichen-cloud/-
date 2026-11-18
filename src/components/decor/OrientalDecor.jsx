/* ============================================================
 * 东方背景装饰 OrientalDecor
 * ------------------------------------------------------------
 * 三个主题页（我的非遗创作空间 / AI 非遗文创工作台 / AI 图像识别）
 * 共用的背景元素，让页面与设计稿的氛围一致：
 *   Mountains  远山叠嶂（anchor='top' 顶部雾化，anchor='bottom' 底部压脚）
 *   ScrollArt  悬挂卷轴（木轴 + 绢面 + 水墨小山 + 朱砂印）
 *   CloudMotif 祥云纹（线描）
 * 全部是纯装饰：pointer-events-none + aria-hidden，不参与交互与读屏。
 * ============================================================ */
import { useId } from 'react'

/* 水墨山水长卷底图（AI 生成的青绿远山 + 云雾，浅宣纸底） */
const INK_BAND = '/images/decor/ink-band.jpg'

/* 山水长卷横带：顶部用则下缘化开，页脚用则上下都化开，避免出现硬边 */
export function InkBand({ className = '', anchor = 'top', flip = false, src = INK_BAND }) {
  const isBottom = anchor === 'bottom'
  const mask = isBottom
    ? 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.85) 38%, #000 82%, transparent 100%)'
    : 'linear-gradient(to bottom, #000 0%, #000 58%, transparent 100%)'
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <img
        src={src}
        alt=""
        draggable="false"
        className="h-full w-full object-cover object-bottom mix-blend-multiply"
        style={{
          maskImage: mask,
          WebkitMaskImage: mask,
          transform: flip ? 'scaleX(-1)' : undefined,
          opacity: isBottom ? 0.9 : 0.7,
        }}
      />
    </div>
  )
}

/* 五重山峦：由远及近层层叠压，山形取自国画长卷的连绵起伏 */
const RIDGE_FAR =
  'M0 214 C 70 206 108 150 168 146 C 228 142 262 186 320 190 C 378 194 412 148 472 142 C 532 136 570 182 630 188 C 690 194 724 150 784 144 C 844 138 880 184 940 190 C 1000 196 1036 152 1096 146 C 1156 140 1194 186 1254 192 C 1314 198 1352 158 1412 152 L1440 150 L1440 360 L0 360 Z'
const RIDGE_MID =
  'M0 268 C 80 258 128 208 200 204 C 272 200 316 244 388 250 C 460 256 504 210 576 204 C 648 198 692 244 764 250 C 836 256 880 212 952 206 C 1024 200 1068 246 1140 252 C 1212 258 1258 214 1330 208 C 1372 205 1414 212 1440 214 L1440 360 L0 360 Z'
const RIDGE_NEAR =
  'M0 320 C 90 312 150 278 250 274 C 350 270 404 306 504 312 C 604 318 662 286 762 282 C 862 278 918 312 1018 318 C 1118 324 1176 292 1276 288 C 1348 285 1408 300 1440 304 L1440 360 L0 360 Z'
const RIDGE_FRONT =
  'M0 352 C 120 346 210 330 330 328 C 450 326 520 344 640 348 C 760 352 830 336 950 334 C 1070 332 1140 348 1260 350 C 1340 351 1400 348 1440 346 L1440 360 L0 360 Z'

/* 山脊线（开路径，用于勾出墨线轮廓） */
const LINE_FAR =
  'M0 214 C 70 206 108 150 168 146 C 228 142 262 186 320 190 C 378 194 412 148 472 142 C 532 136 570 182 630 188 C 690 194 724 150 784 144 C 844 138 880 184 940 190 C 1000 196 1036 152 1096 146 C 1156 140 1194 186 1254 192 C 1314 198 1352 158 1412 152 L1440 150'
const LINE_MID =
  'M0 268 C 80 258 128 208 200 204 C 272 200 316 244 388 250 C 460 256 504 210 576 204 C 648 198 692 244 764 250 C 836 256 880 212 952 206 C 1024 200 1068 246 1140 252 C 1212 258 1258 214 1330 208 C 1372 205 1414 212 1440 214'
const LINE_NEAR =
  'M0 320 C 90 312 150 278 250 274 C 350 270 404 306 504 312 C 604 318 662 286 762 282 C 862 278 918 312 1018 318 C 1118 324 1176 292 1276 288 C 1348 285 1408 300 1440 304'

/* 淡水墨山水长卷：五重山峦 + 墨线勾边 + 山腰云雾 + 前景芦苇 */
export function Mountains({ className = '', anchor = 'top' }) {
  const uid = useId().replace(/:/g, '')
  const isBottom = anchor === 'bottom'
  return (
    <svg
      className={className}
      viewBox="0 0 1440 360"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        {/* 远山：极淡的青灰，往画面内侧化开 */}
        <linearGradient id={`${uid}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DCE8DA" stopOpacity={isBottom ? 0 : 0.55} />
          <stop offset="0.5" stopColor="#DCE8DA" stopOpacity={isBottom ? 0.3 : 0.42} />
          <stop offset="1" stopColor="#DCE8DA" stopOpacity={isBottom ? 0.5 : 0} />
        </linearGradient>
        <linearGradient id={`${uid}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C3D5BF" stopOpacity={isBottom ? 0 : 0.5} />
          <stop offset="0.55" stopColor="#C3D5BF" stopOpacity={isBottom ? 0.32 : 0.36} />
          <stop offset="1" stopColor="#C3D5BF" stopOpacity={isBottom ? 0.48 : 0} />
        </linearGradient>
        <linearGradient id={`${uid}-near`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A8C1A4" stopOpacity={isBottom ? 0 : 0.46} />
          <stop offset="0.6" stopColor="#A8C1A4" stopOpacity={isBottom ? 0.34 : 0.34} />
          <stop offset="1" stopColor="#A8C1A4" stopOpacity={isBottom ? 0.5 : 0} />
        </linearGradient>
        <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#90AC8D" stopOpacity={isBottom ? 0 : 0.42} />
          <stop offset="0.5" stopColor="#90AC8D" stopOpacity={isBottom ? 0.34 : 0.34} />
          <stop offset="1" stopColor="#90AC8D" stopOpacity={isBottom ? 0.5 : 0} />
        </linearGradient>
        {/* 雲雾柔化 */}
        <filter id={`${uid}-mist`} x="-25%" y="-120%" width="150%" height="340%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id={`${uid}-haze`} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* 远山：只留轮廓与一层淡墨 */}
      <path d={RIDGE_FAR} fill={`url(#${uid}-far)`} />
      <path d={LINE_FAR} stroke="#B9CDB5" strokeOpacity={isBottom ? 0.18 : 0.3} strokeWidth="1.4" />

      {/* 中景山脉：实体山体 + 勾边，山脚被云雾吃掉 */}
      <path d={RIDGE_MID} fill={`url(#${uid}-mid)`} />
      <path d={LINE_MID} stroke="#9CB497" strokeOpacity={isBottom ? 0.3 : 0.4} strokeWidth="1.6" />
      <g filter={`url(#${uid}-mist)`} opacity={isBottom ? 0.55 : 0.85}>
        <ellipse cx="260" cy="252" rx="250" ry="26" fill="#FFFCF4" />
        <ellipse cx="760" cy="256" rx="310" ry="24" fill="#FFFCF4" />
        <ellipse cx="1230" cy="250" rx="240" ry="24" fill="#FFFCF4" />
      </g>

      {/* 近景山脉：墨色略重，皴笔更明显 */}
      <path d={RIDGE_NEAR} fill={`url(#${uid}-near)`} />
      <path d={LINE_NEAR} stroke="#84A07F" strokeOpacity={isBottom ? 0.35 : 0.46} strokeWidth="1.8" />
      <g filter={`url(#${uid}-haze)`} opacity="0.4">
        <path d={LINE_NEAR} stroke="#7E9979" strokeWidth="5" transform="translate(0 7)" />
      </g>

      {/* 前景低丘：压住画面底部 */}
      <path d={RIDGE_FRONT} fill={`url(#${uid}-front)`} />

      {/* 山脚云雾：横着的一条薄雾，让山与纸面衔接 */}
      <g filter={`url(#${uid}-mist)`} opacity={isBottom ? 0.5 : 0.7}>
        <ellipse cx="360" cy="318" rx="300" ry="18" fill="#FFFDF7" />
        <ellipse cx="1080" cy="324" rx="320" ry="16" fill="#FFFDF7" />
      </g>

      {/* 前景芦苇：只在页脚出现，添一点生趣 */}
      {isBottom && (
        <g stroke="#7E9A7B" strokeLinecap="round" opacity="0.34">
          <path d="M84 360 C 82 340 76 322 64 306" strokeWidth="1.4" />
          <path d="M104 360 C 106 338 112 320 124 304" strokeWidth="1.2" />
          <path d="M130 360 C 128 344 122 330 112 318" strokeWidth="1.1" />
          <path d="M138 344 C 150 336 160 330 172 328" strokeWidth="1" />
          <path d="M1310 360 C 1314 338 1322 320 1336 306" strokeWidth="1.4" />
          <path d="M1288 360 C 1284 340 1276 324 1264 310" strokeWidth="1.2" />
          <path d="M1262 360 C 1266 344 1272 332 1282 322" strokeWidth="1" />
          <path d="M1272 340 C 1258 332 1246 328 1232 326" strokeWidth="1" />
        </g>
      )}
    </svg>
  )
}

export function ScrollArt({ className = '' }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="0 0 280 400" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-silk`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FCF7EA" />
          <stop offset="1" stopColor="#F0E4CB" />
        </linearGradient>
      </defs>

      <g transform="translate(56 20) rotate(12 84 176)">
        {/* 挂绳与吊环 */}
        <path d="M84 0 v26" stroke="#C3B191" strokeWidth="1.4" />
        <circle cx="84" cy="6" r="5" stroke="#C3B191" strokeWidth="1.4" />

        {/* 上木轴 */}
        <rect x="-4" y="26" width="176" height="16" rx="8" fill="#E9DCC0" stroke="#C6B189" strokeWidth="1.2" />
        <circle cx="-4" cy="34" r="7" fill="#DACAA7" stroke="#C6B189" strokeWidth="1" />
        <circle cx="172" cy="34" r="7" fill="#DACAA7" stroke="#C6B189" strokeWidth="1" />

        {/* 绢面 */}
        <rect x="10" y="42" width="148" height="250" rx="4" fill={`url(#${uid}-silk)`} stroke="#DCCDAF" strokeWidth="1" />
        <rect x="19" y="51" width="130" height="232" rx="2" stroke="#E7DBBF" strokeWidth="1" />

        {/* 绢面上的水墨小山与题字留白 */}
        <path
          d="M30 214 C 44 190 56 200 68 182 C 80 164 92 190 106 178 C 120 166 132 186 146 174 L146 238 L30 238 Z"
          fill="#A9C1AC"
          opacity="0.55"
        />
        <path d="M30 244 C 52 232 72 240 94 232 C 116 224 132 236 146 230" stroke="#9CB6A1" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        <path
          d="M44 84 h44 M44 102 h30 M44 120 h40 M44 138 h26"
          stroke="#B9A88A"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />

        {/* 下木轴 */}
        <rect x="-4" y="292" width="176" height="16" rx="8" fill="#E9DCC0" stroke="#C6B189" strokeWidth="1.2" />
        <circle cx="-4" cy="300" r="7" fill="#DACAA7" stroke="#C6B189" strokeWidth="1" />
        <circle cx="172" cy="300" r="7" fill="#DACAA7" stroke="#C6B189" strokeWidth="1" />
      </g>

      {/* 朱砂印 */}
      <g transform="translate(196 300) rotate(-7)">
        <rect width="34" height="34" rx="4" fill="#B23A2E" opacity="0.72" />
        <path d="M9 10h16M9 21h16M13 10v18M22 10v18" stroke="#FCF8EF" strokeWidth="2" opacity="0.9" />
      </g>
    </svg>
  )
}

export function CloudMotif({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 64" fill="none" aria-hidden="true">
      <path
        d="M18 42c-8 0-14-6-14-13S10 16 18 16c1-9 10-15 19-12 6-10 21-9 25 3 10-4 21 4 20 15 8 1 12 7 10 13-2 6-8 9-15 7H18Z"
        fill="#7FA391"
        opacity="0.28"
      />
      <path d="M14 52c14 7 34 7 48 0 8-4 17-4 22 0" stroke="#7FA391" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}
