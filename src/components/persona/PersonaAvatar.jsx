/* ============================================================
 * PersonaAvatar：非遗萌宠形象（纯 SVG，2 头身 Q 版）
 * ------------------------------------------------------------
 * 设计目标：像"非遗盲盒手办"——大头、圆脸、小短手，一眼能认出是
 * 哪一门非遗，而不是同一个卡通人换衣服。
 *
 * 每个角色都有独立的设计语言：
 *   papercut   剪生  双丸子 + 窗花头饰 + 锯齿裙摆 + 团花背光 + 大剪刀
 *   ceramic    青岚  圆髻 + 小青花瓶发冠 + 云肩 + 缠枝纹 + 抱瓷瓶
 *   embroidery 锦姑  双环髻 + 金簪流苏 + 缠枝襦裙 + 绣绷与丝线
 *   shadow     影三郎 镂空锯齿冠 + 半透明皮影身 + 灯影幕 + 皮影杆
 *   ink        墨白  高髻 + 墨带 + 宽袖墨袍 + 墨晕 + 毛笔
 *   general    小灵  云朵发饰 + 卷轴披风 + 小灯笼（未识别时的通用形象）
 *
 * 八种状态驱动表情与动作：
 *   idle 待机（角色专属待机动作 + 眨眼）· greeting 挥手 · happy 跳跃
 *   thinking 歪头 · speaking 说话 · listening 聆听 · shy 害羞 · goodbye 告别
 *
 * 全部动画为 CSS 变换/透明度，GPU 合成；系统开启"减弱动态效果"时静止。
 * ============================================================ */

import { useState } from 'react'

const SKIN = '#FBE6D4'

const LOOK = {
  papercut: {
    skin: SKIN, primary: '#C0392B', dark: '#8E2318', light: '#FFF4E4',
    hair: '#2C2420', accent: '#E0A23F', glow: 'rgba(192,57,43,0.30)',
  },
  ceramic: {
    skin: '#FBE9DA', primary: '#2F5A8A', dark: '#1E3D61', light: '#F8F5EC',
    hair: '#23262B', accent: '#C9A227', glow: 'rgba(47,90,138,0.26)',
  },
  embroidery: {
    skin: '#FBE7D9', primary: '#4E7F6B', dark: '#335B4B', light: '#F9F4E8',
    hair: '#3B3126', accent: '#D0A32B', glow: 'rgba(78,127,107,0.26)',
  },
  shadow: {
    skin: '#F6DDB2', primary: '#C0682E', dark: '#7E3A17', light: '#FCEBD2',
    hair: '#3A2416', accent: '#B23A2E', glow: 'rgba(232,170,74,0.34)',
  },
  ink: {
    skin: '#FBE7D6', primary: '#3B3B38', dark: '#1D1D1B', light: '#F6F2E8',
    hair: '#211F1C', accent: '#7A988A', glow: 'rgba(58,58,56,0.22)',
  },
  general: {
    skin: SKIN, primary: '#C77B4E', dark: '#96562F', light: '#FCF5E7',
    hair: '#3A2E24', accent: '#7E9B7A', glow: 'rgba(199,123,78,0.28)',
  },
  /* 狮小灵：中国红 + 鎏金，南狮醒狮造型 */
  lion: {
    skin: '#FFF3DF', primary: '#C8332B', dark: '#8E1D18', light: '#FFF8EA',
    hair: '#3A2416', accent: '#E0A23F', gold: '#F6D27E', glow: 'rgba(224,162,63,0.34)',
  },
}

/* 待机时的角色专属小动作 */
const ROLE_MOTION = {
  papercut: 'pv-hop',
  ceramic: 'pv-sway',
  embroidery: 'pv-sway-slow',
  shadow: 'pv-theatre',
  ink: 'pv-float',
  general: 'pv-breathe',
}

const STATE_MOTION = {
  idle: '',
  greeting: 'pv-nod',
  happy: 'pv-jump',
  thinking: 'pv-tilt',
  speaking: 'pv-bob',
  listening: 'pv-lean',
  shy: 'pv-shy',
  goodbye: 'pv-nod',
  cheering: 'pv-jump',
  sleeping: 'pv-sleep',
}

/* 狮小灵的专属待机：呼吸 + 摇头 + 摇尾，全部在各自图层上完成 */
const LION_STATE_MOTION = {
  idle: 'pv-lion-idle',
  greeting: 'pv-hop',
  happy: 'pv-lion-happy',
  thinking: 'pv-lean',
  speaking: 'pv-bob',
  listening: 'pv-lean',
  shy: 'pv-shy',
  goodbye: 'pv-nod',
  cheering: 'pv-lion-cheer',
  sleeping: 'pv-sleep',
}

/* ------------------------- 五官 ------------------------- */
function Eyes({ state, c }) {
  if (state === 'happy' || state === 'shy') {
    // 开心：弯成月牙；害羞：闭眼向下弯
    const down = state === 'shy'
    return (
      <g stroke={c.hair} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d={down ? 'M95 122q7 6 14 0' : 'M95 120q7-7 14 0'} />
        <path d={down ? 'M131 122q7 6 14 0' : 'M131 120q7-7 14 0'} />
      </g>
    )
  }
  const lift = state === 'thinking' ? -1.8 : 0
  const big = state === 'listening' ? 0.5 : 0
  return (
    <g className="pv-eyes">
      <g fill={c.hair}>
        <ellipse cx="102" cy={119 + lift} rx={6.2 + big} ry={7.4 + big} />
        <ellipse cx="138" cy={119 + lift} rx={6.2 + big} ry={7.4 + big} />
        {/* 虹膜留白，让眼神有神 */}
        <circle cx="104.4" cy={116.4 + lift} r="2.2" fill="#fff" opacity="0.95" />
        <circle cx="140.4" cy={116.4 + lift} r="2.2" fill="#fff" opacity="0.95" />
        <circle cx="100" cy={121.6 + lift} r="1.1" fill="#fff" opacity="0.6" />
        <circle cx="136" cy={121.6 + lift} r="1.1" fill="#fff" opacity="0.6" />
      </g>
    </g>
  )
}

function Mouth({ state, c }) {
  if (state === 'speaking') {
    return <ellipse className="pv-mouth" cx="120" cy="144" rx="6.4" ry="3.4" fill={c.accent} opacity="0.9" />
  }
  if (state === 'happy') {
    return (
      <g>
        <path d="M111 141q9 11 18 0Z" fill={c.accent} opacity="0.9" />
        <path d="M114 145q6 4 12 0" stroke="#fff" strokeWidth="1.4" fill="none" opacity="0.75" />
      </g>
    )
  }
  if (state === 'shy') {
    return <path d="M115 143q5 4 10 0" stroke={c.accent} strokeWidth="2.2" fill="none" strokeLinecap="round" />
  }
  if (state === 'listening') {
    return <circle cx="120" cy="144" r="2.6" fill={c.accent} opacity="0.72" />
  }
  if (state === 'thinking') {
    return <path d="M116 144h8" stroke={c.accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
  }
  return <path d="M113 143q7 4 14 0" stroke={c.accent} strokeWidth="2.2" fill="none" strokeLinecap="round" />
}

function Face({ state, c }) {
  const shy = state === 'shy'
  return (
    <g>
      {/* 眉 */}
      <g stroke={c.hair} strokeWidth="2.6" strokeLinecap="round" opacity="0.8">
        <path d={state === 'thinking' ? 'M94 105q8-6 15-1' : 'M94 106q8-5 15-1'} />
        <path d={state === 'thinking' ? 'M131 104q8-5 15 1' : 'M131 105q8-4 15 1'} />
      </g>
      <Eyes state={state} c={c} />
      {/* 腮红 */}
      <ellipse cx="86" cy="136" rx={shy ? 10 : 7.5} ry={shy ? 5.6 : 4} fill={c.accent} opacity={shy ? 0.5 : 0.24} />
      <ellipse cx="154" cy="136" rx={shy ? 10 : 7.5} ry={shy ? 5.6 : 4} fill={c.accent} opacity={shy ? 0.5 : 0.24} />
      <Mouth state={state} c={c} />
    </g>
  )
}

/* ------------------------- 身体 ------------------------- */
function Hands({ state, c }) {
  const waving = state === 'greeting' || state === 'goodbye'
  return (
    <g>
      {/* 左手 */}
      <rect x="66" y="198" width="15" height="28" rx="7.5" fill={c.primary} opacity="0.9" />
      <circle cx="73.5" cy="228" r="9" fill={c.skin} />
      {/* 右手：打招呼 / 告别时抬起挥动 */}
      <g className={waving ? 'pv-wave' : ''} style={{ transformOrigin: '166px 198px' }}>
        {waving ? (
          <g>
            <rect x="159" y="168" width="15" height="30" rx="7.5" fill={c.primary} opacity="0.9" transform="rotate(20 166 183)" />
            <circle cx="172" cy="164" r="9.5" fill={c.skin} />
          </g>
        ) : (
          <g>
            <rect x="159" y="198" width="15" height="28" rx="7.5" fill={c.primary} opacity="0.9" />
            <circle cx="166.5" cy="228" r="9" fill={c.skin} />
          </g>
        )}
      </g>
    </g>
  )
}

function Feet({ c }) {
  return (
    <g fill={c.dark} opacity="0.85">
      <ellipse cx="100" cy="266" rx="14" ry="7" />
      <ellipse cx="140" cy="266" rx="14" ry="7" />
    </g>
  )
}

function Body({ style, c }) {
  switch (style) {
    /* 剪纸：红小袄 + 团花围兜 + 锯齿裙摆 */
    case 'papercut':
      return (
        <g>
          <path d="M120 168c-30 0-50 20-54 54l-3 20h114l-3-20c-4-34-24-54-54-54Z" fill={c.primary} />
          <path
            d="M66 240l9-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 8-9 8 9 9-9"
            stroke={c.light}
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
            opacity="0.95"
          />
          {/* 白色围兜 + 团花 */}
          <path d="M103 168q17 13 34 0l-6 44h-22Z" fill={c.light} />
          <g stroke={c.primary} fill="none" strokeWidth="1.8" opacity="0.9">
            <circle cx="120" cy="196" r="8.5" />
            <path d="M120 187v18M111.5 196h17M114 190l12 12M126 190l-12 12" />
          </g>
          {/* 衣襟盘扣 */}
          <circle cx="120" cy="178" r="2.4" fill={c.accent} />
        </g>
      )
    /* 陶瓷：白釉长袍 + 青花云肩 + 缠枝纹 */
    case 'ceramic':
      return (
        <g>
          <path d="M120 168c-31 0-52 22-55 56l-2 18h114l-2-18c-3-34-24-56-55-56Z" fill={c.light} stroke={c.primary} strokeWidth="1.6" />
          {/* 云肩 */}
          <path d="M120 166c-20 0-34 10-38 20 10 8 20 10 38 10s28-2 38-10c-4-10-18-20-38-20Z" fill={c.primary} opacity="0.92" />
          <path d="M120 170c-12 0-22 6-26 13 8 5 16 6 26 6s18-1 26-6c-4-7-14-13-26-13Z" fill={c.light} opacity="0.55" />
          {/* 青花缠枝纹 */}
          <g stroke={c.primary} strokeWidth="1.7" fill="none" opacity="0.85">
            <path d="M78 214q14-11 26 0M136 214q14-11 26 0M86 232q12-9 22 0M132 232q12-9 22 0" />
            <circle cx="92" cy="208" r="2.2" fill={c.primary} stroke="none" />
            <circle cx="148" cy="208" r="2.2" fill={c.primary} stroke="none" />
          </g>
          {/* 腰封 */}
          <rect x="88" y="222" width="64" height="9" rx="4.5" fill={c.primary} opacity="0.9" />
          <rect x="115" y="218" width="10" height="17" rx="3" fill={c.accent} opacity="0.9" />
        </g>
      )
    /* 苏绣：绿色襦裙 + 金色滚边 + 胸前缠枝花 */
    case 'embroidery':
      return (
        <g>
          <path d="M120 168c-30 0-50 20-53 54l-3 20h112l-3-20c-3-34-23-54-53-54Z" fill={c.primary} />
          {/* 上襦与裙的分界 */}
          <path d="M70 216h100" stroke={c.light} strokeWidth="2.4" opacity="0.8" />
          <path d="M72 240h96" stroke={c.accent} strokeWidth="2" opacity="0.75" />
          {/* 交领 */}
          <path d="M104 170l16 22 16-22" stroke={c.light} strokeWidth="6" fill="none" strokeLinejoin="round" opacity="0.9" />
          <path d="M120 192v34" stroke={c.accent} strokeWidth="1.8" opacity="0.7" />
          {/* 缠枝小花 */}
          <g fill={c.light} opacity="0.9">
            <circle cx="88" cy="206" r="3.4" />
            <circle cx="80" cy="200" r="2.2" />
            <circle cx="96" cy="200" r="2.2" />
            <circle cx="152" cy="206" r="3.4" />
            <circle cx="144" cy="200" r="2.2" />
            <circle cx="160" cy="200" r="2.2" />
          </g>
          <g stroke={c.accent} strokeWidth="1.6" fill="none" opacity="0.8">
            <path d="M80 210q-6 8-2 14M160 210q6 8 2 14M100 230q8 6 18 2M140 230q-8 6-18 2" />
          </g>
        </g>
      )
    /* 皮影：半透明彩绘镂空身 */
    case 'shadow':
      return (
        <g opacity="0.94">
          {/* 皮影特有的侧身披风轮廓 */}
          <path d="M120 168c-28 0-48 18-54 50l-6 24h60l6-30 6 30h56l-6-24c-6-32-26-50-54-50Z" fill={c.primary} />
          <path d="M120 168c-28 0-48 18-54 50l-6 24h60l6-30 6 30h56l-6-24c-6-32-26-50-54-50Z" fill="none" stroke={c.dark} strokeWidth="2" />
          {/* 镂空纹样 */}
          <g fill={c.light} opacity="0.55">
            <circle cx="92" cy="206" r="4" />
            <circle cx="92" cy="222" r="3" />
            <circle cx="92" cy="236" r="2.4" />
            <path d="M138 200l8 8-8 8-8-8Z" />
            <path d="M152 224l8 8-8 8-8-8Z" />
          </g>
          {/* 彩色分色块，模仿皮影上色 */}
          <path d="M120 176h34l-6 22h-28Z" fill={c.accent} opacity="0.55" />
          <path d="M86 218h34l-6 20H82Z" fill={c.accent} opacity="0.35" />
        </g>
      )
    /* 水墨：宽袖墨袍 + 宣纸内衬 */
    case 'ink':
      return (
        <g>
          <path d="M120 168c-32 0-54 22-57 56l-2 18h118l-2-18c-3-34-25-56-57-56Z" fill={c.primary} />
          {/* 墨色渐隐边缘 */}
          <path d="M120 168c-32 0-54 22-57 56l-2 18h118l-2-18c-3-34-25-56-57-56Z" fill={`url(#ink-fade-${style})`} opacity="0.6" />
          {/* 宣纸内衬交领 */}
          <path d="M102 170l18 26 18-26" stroke={c.light} strokeWidth="7" fill="none" strokeLinejoin="round" />
          <path d="M120 196v34" stroke={c.light} strokeWidth="2" opacity="0.5" />
          {/* 淡墨点缀 */}
          <g opacity="0.3" fill="#fff">
            <circle cx="88" cy="222" r="5" />
            <circle cx="150" cy="236" r="3.4" />
          </g>
          <path d="M78 242h84" stroke={c.light} strokeWidth="3" opacity="0.35" />
        </g>
      )
    /* 通用：米白小袍 + 橙色围巾 + 小卷轴披风 */
    default:
      return (
        <g>
          <path d="M120 168c-29 0-49 20-52 54l-2 20h108l-2-20c-3-34-23-54-52-54Z" fill={c.light} stroke={c.primary} strokeWidth="1.6" />
          {/* 围巾 */}
          <path d="M101 172q19 12 38 0l4 12q-23 14-46 0Z" fill={c.primary} />
          <path d="M136 186q10 12 4 24" stroke={c.primary} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
          {/* 卷轴 */}
          <g transform="translate(88 212)">
            <rect x="0" y="0" width="64" height="26" rx="5" fill="#FFFDF6" stroke={c.dark} strokeWidth="1.6" />
            <rect x="-5" y="-2" width="7" height="30" rx="3.5" fill={c.dark} />
            <rect x="62" y="-2" width="7" height="30" rx="3.5" fill={c.dark} />
            <path d="M12 9h40M12 17h28" stroke={c.dark} strokeWidth="1.6" opacity="0.45" />
          </g>
        </g>
      )
  }
}

/* ------------------------- 头发 / 头饰 ------------------------- */
function Hair({ style, c, state }) {
  const head = <ellipse cx="120" cy="116" rx="46" ry="44" fill={c.skin} />
  switch (style) {
    case 'papercut':
      return (
        <g>
          {head}
          {/* 双丸子 */}
          <circle cx="74" cy="86" r="15" fill={c.hair} />
          <circle cx="166" cy="86" r="15" fill={c.hair} />
          <circle cx="74" cy="86" r="6" fill={c.accent} opacity="0.75" />
          <circle cx="166" cy="86" r="6" fill={c.accent} opacity="0.75" />
          {/* 齐刘海 */}
          <path d="M74 104q46-44 92 0q-6-40-46-40t-46 40Z" fill={c.hair} />
          {/* 窗花额饰 */}
          <g transform="translate(120 92)">
            <path d="M0-12 10-4 6 8h-12L-10-4Z" fill={c.primary} />
            <path d="M0-7 6-2 3 6h-6L-6-2Z" fill={c.light} opacity="0.9" />
            <circle cx="0" cy="0" r="2" fill={c.primary} />
            <path d="M-24-2 24-2" stroke={c.accent} strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      )
    case 'ceramic':
      return (
        <g>
          {head}
          {/* 圆髻 */}
          <ellipse cx="120" cy="76" rx="30" ry="24" fill={c.hair} />
          <path d="M76 106q44-38 88 0q-8-36-44-36t-44 36Z" fill={c.hair} />
          {/* 头顶小青花瓶（发冠） */}
          <g transform="translate(120 44)">
            <path d="M-9 18c-4 0-7 4-7 8 0 7 5 12 16 12s16-5 16-12c0-4-3-8-7-8h-4V8h-10Z" fill={c.light} stroke={c.primary} strokeWidth="2" />
            <rect x="-4" y="0" width="8" height="9" rx="2" fill={c.light} stroke={c.primary} strokeWidth="2" />
            <path d="M-9 22q9 4 18 0M-6 28q6 3 12 0" stroke={c.primary} strokeWidth="1.6" fill="none" />
          </g>
          {/* 青花发簪 */}
          <path d="M88 88l-14 12" stroke={c.primary} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="72" cy="102" r="3.4" fill={c.primary} />
        </g>
      )
    case 'embroidery':
      return (
        <g>
          {head}
          {/* 双环髻 */}
          <circle cx="90" cy="74" r="14" fill={c.hair} />
          <circle cx="150" cy="74" r="14" fill={c.hair} />
          <circle cx="90" cy="74" r="6" fill="none" stroke={c.accent} strokeWidth="2" />
          <circle cx="150" cy="74" r="6" fill="none" stroke={c.accent} strokeWidth="2" />
          <path d="M76 106q44-36 88 0q-10-36-44-36t-44 36Z" fill={c.hair} />
          {/* 金簪 */}
          <path d="M120 68l26-14" stroke={c.accent} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="148" cy="52" r="4" fill={c.accent} />
          {/* 耳侧丝线流苏 */}
          <g stroke={c.accent} strokeWidth="1.6" fill="none" opacity="0.85">
            <path d="M76 122q-8 12-4 22M164 122q8 12 4 22" />
            <circle cx="72" cy="146" r="2.2" fill={c.accent} stroke="none" />
            <circle cx="168" cy="146" r="2.2" fill={c.accent} stroke="none" />
          </g>
        </g>
      )
    case 'shadow':
      return (
        <g>
          {head}
          {/* 镂空锯齿冠 */}
          <path d="M74 100q46-40 92 0l-6-26-10 10-8-16-10 12-8-16-8 16-10-12-8 16-10-10Z" fill={c.dark} />
          <path d="M86 88h68" stroke={c.light} strokeWidth="2.4" opacity="0.75" />
          <circle cx="120" cy="74" r="4.6" fill={c.accent} />
          <circle cx="120" cy="74" r="2" fill={c.light} opacity="0.9" />
          {/* 侧鬓 */}
          <path d="M76 110q-6 18 2 30" stroke={c.hair} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
        </g>
      )
    case 'ink':
      return (
        <g>
          {head}
          {/* 高髻 */}
          <path d="M92 74q28-32 56 0q-6-24-28-24t-28 24Z" fill={c.hair} />
          <ellipse cx="120" cy="58" rx="18" ry="12" fill={c.hair} />
          <path d="M76 104q44-38 88 0q-8-34-44-34t-44 34Z" fill={c.hair} />
          {/* 飘动的墨带 */}
          <path d="M150 62q26 10 30 34" stroke={c.hair} strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.85" />
          <path d="M150 62q22 14 24 32" stroke={c.accent} strokeWidth="2.4" fill="none" opacity="0.6" />
          <path d="M76 112q-10 16-8 32" stroke={c.hair} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
      )
    default:
      return (
        <g>
          {head}
          {/* 云朵发饰 */}
          <path d="M76 102q44-40 88 0q-8-36-44-36t-44 36Z" fill={c.hair} />
          <g transform="translate(120 58)">
            <path d="M-18 8a10 10 0 0 1 10-10 12 12 0 0 1 22-2 10 10 0 0 1 8 12Z" fill={c.light} stroke={c.primary} strokeWidth="2" />
            <circle cx="-6" cy="4" r="1.8" fill={c.primary} />
            <circle cx="6" cy="2" r="1.8" fill={c.primary} />
            {/* 小灯笼 */}
            <g transform="translate(0 -18)">
              <path d="M0 4v6" stroke={c.dark} strokeWidth="1.6" />
              <ellipse cx="0" cy="-3" rx="7" ry="8" fill={c.primary} />
              <path d="M-7-3h14" stroke={c.light} strokeWidth="1.4" opacity="0.8" />
              <path d="M0 5v4" stroke={c.accent} strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </g>
        </g>
      )
  }
}

/* ------------------------- 背景装饰 ------------------------- */
function Backdrop({ style, c, state }) {
  switch (style) {
    case 'papercut':
      return (
        <g opacity="0.6">
          <circle cx="120" cy="140" r="96" fill="none" stroke={c.primary} strokeWidth="1.6" strokeDasharray="6 8" />
          <g className="pv-spin" style={{ transformOrigin: '120px 140px' }} opacity="0.55">
            <path
              d="M120 52c14 22 36 26 58 24-22 14-26 36-24 58-14-22-36-26-58-24 22-14 26-36 24-58Z"
              fill={c.primary}
              opacity="0.22"
            />
          </g>
          <circle cx="120" cy="140" r="76" fill="none" stroke={c.accent} strokeWidth="1.2" opacity="0.5" />
        </g>
      )
    case 'ceramic':
      return (
        <g opacity="0.75">
          <circle cx="120" cy="146" r="94" fill={c.primary} opacity="0.08" />
          <circle cx="120" cy="146" r="80" fill="none" stroke={c.primary} strokeWidth="1.4" strokeDasharray="3 7" opacity="0.5" />
          {/* 冰裂纹 */}
          <g stroke={c.primary} strokeWidth="1.1" opacity="0.28" fill="none">
            <path d="M44 92l26 22-14 26M196 92l-26 22 14 26" />
            <path d="M50 190l22-16M190 190l-22-16" />
          </g>
        </g>
      )
    case 'embroidery':
      return (
        <g>
          {/* 绣绷双环 */}
          <circle cx="120" cy="146" r="88" fill="none" stroke={c.primary} strokeWidth="3.2" opacity="0.28" />
          <circle cx="120" cy="146" r="80" fill="none" stroke={c.accent} strokeWidth="1.4" strokeDasharray="2 6" opacity="0.5" />
          {/* 飘出的丝线 */}
          <g stroke={c.accent} strokeWidth="1.6" fill="none" opacity="0.5">
            <path d="M28 120q30 10 26 44" />
            <path d="M212 120q-30 10-26 44" />
          </g>
        </g>
      )
    case 'shadow':
      return (
        <g>
          {/* 灯影幕的暖光 */}
          <circle cx="120" cy="150" r="92" fill={c.glow} opacity="0.55" />
          <circle cx="120" cy="150" r="72" fill="none" stroke={c.accent} strokeWidth="1.4" strokeDasharray="4 8" opacity="0.45" />
          <g stroke={c.dark} strokeWidth="1.2" opacity="0.22" fill="none">
            <path d="M40 200h160M40 120h160" />
          </g>
        </g>
      )
    case 'lion':
      return (
        <g opacity="0.85">
          {/* 暖金灯晕 + 红金纸屑，呼应舞狮锣鼓的热闹 */}
          <circle cx="120" cy="150" r="94" fill={c.accent} opacity="0.1" />
          <circle cx="120" cy="150" r="78" fill="none" stroke={c.accent} strokeWidth="1.4" strokeDasharray="3 8" opacity="0.5" />
          <g fill={c.primary} opacity="0.4">
            <rect x="46" y="86" width="7" height="7" rx="1.5" transform="rotate(20 49 89)" />
            <rect x="186" y="118" width="6" height="6" rx="1.5" transform="rotate(-16 189 121)" />
            <rect x="58" y="208" width="5" height="5" rx="1.5" transform="rotate(30 60 210)" />
            <circle cx="192" cy="206" r="3" />
          </g>
          <g stroke={c.gold} strokeWidth="1.4" fill="none" opacity="0.45">
            <path d="M40 156q10-8 20 0M180 156q10-8 20 0" />
          </g>
        </g>
      )
    case 'ink':
      return (
        <g opacity="0.6">
          <circle cx="120" cy="146" r="94" fill={c.primary} opacity="0.06" />
          <g fill={c.primary} opacity="0.14">
            <ellipse cx="66" cy="96" rx="22" ry="15" />
            <ellipse cx="182" cy="188" rx="18" ry="12" />
            <ellipse cx="78" cy="200" rx="12" ry="8" />
          </g>
          <circle cx="120" cy="146" r="82" fill="none" stroke={c.primary} strokeWidth="1.2" strokeDasharray="2 9" opacity="0.4" />
        </g>
      )
    default:
      return (
        <g opacity="0.7">
          <circle cx="120" cy="146" r="94" fill={c.primary} opacity="0.08" />
          <circle cx="120" cy="146" r="80" fill="none" stroke={c.accent} strokeWidth="1.4" strokeDasharray="4 8" opacity="0.5" />
          {/* 小祥云 */}
          <g stroke={c.primary} strokeWidth="1.6" fill="none" opacity="0.45">
            <path d="M42 108q-10 0-10-9t10-9q2-10 12-10t12 10q10 0 10 9t-10 9Z" />
            <path d="M186 196q-8 0-8-7t8-7q2-8 10-8t10 8q8 0 8 7t-8 7Z" />
          </g>
        </g>
      )
  }
}

/* ------------------------- 随身物件 ------------------------- */
function Prop({ style, c, state }) {
  const waving = state === 'greeting' || state === 'goodbye'
  switch (style) {
    case 'papercut':
      return (
        <g transform="translate(182 232) rotate(-18)" opacity="0.95">
          <g stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M0 0l26-30M0 0l26 30" />
            <circle cx="-5" cy="-6" r="5" strokeWidth="2.6" />
            <circle cx="-5" cy="6" r="5" strokeWidth="2.6" />
          </g>
          <circle cx="0" cy="0" r="2.6" fill={c.accent} />
        </g>
      )
    case 'ceramic':
      return (
        <g transform="translate(120 244)" opacity="0.95">
          <path d="M-16 0c-2-8 2-14 6-16v-6h20v6c4 2 8 8 6 16-2 8-8 12-16 12s-14-4-16-12Z" fill={c.light} stroke={c.primary} strokeWidth="2" />
          <path d="M-8 4q8 5 16 0M-6-6h12" stroke={c.primary} strokeWidth="1.6" fill="none" />
        </g>
      )
    case 'embroidery':
      return (
        <g transform="translate(76 240)" opacity="0.95">
          <circle cx="0" cy="0" r="17" fill={c.light} stroke={c.dark} strokeWidth="3" />
          <circle cx="0" cy="0" r="12" fill="none" stroke={c.accent} strokeWidth="1.2" strokeDasharray="2 3" />
          <path d="M-8 4q8-8 16 0" stroke={c.primary} strokeWidth="1.8" fill="none" />
          <path d="M14 12q12 6 10 18" stroke={c.accent} strokeWidth="1.6" fill="none" strokeDasharray="3 3" />
        </g>
      )
    case 'shadow':
      return (
        <g opacity="0.9">
          <path d="M186 246l16-74" stroke={c.dark} strokeWidth="3" strokeLinecap="round" />
          <path d="M202 172l8-6-2 9Z" fill={c.accent} />
          <circle cx="190" cy="238" r="4" fill={c.dark} />
        </g>
      )
    case 'ink':
      return (
        <g transform="translate(186 224) rotate(24)" opacity="0.95">
          <rect x="-3" y="0" width="6" height="46" rx="3" fill={c.hair} />
          <path d="M-4 46l4 14 4-14Z" fill={c.accent} />
          <rect x="-5" y="-6" width="10" height="8" rx="3" fill={c.accent} />
        </g>
      )
    default:
      return waving ? (
        <g transform="translate(60 244)" opacity="0.9">
          <circle cx="0" cy="0" r="10" fill={c.accent} opacity="0.85" />
          <path d="M0-14v-8" stroke={c.dark} strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : null
  }
}

/* ------------------------- 狮小灵（舞狮 IP） ------------------------- */
function LionScene({ c, state }) {
  const sleeping = state === 'sleeping'
  const closedEyes = sleeping || state === 'happy' || state === 'cheering'
  const waving = state === 'greeting' || state === 'goodbye' || state === 'cheering'
  const speaking = state === 'speaking'
  // 一圈卷毛鬃狮：金色与米白交替，形成南狮醒狮的轮廓
  const mane = Array.from({ length: 14 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 14 - Math.PI / 2
    return {
      x: 120 + Math.cos(a) * 60,
      y: 110 + Math.sin(a) * 55,
      r: i % 2 === 0 ? 13 : 10,
      fill: i % 2 === 0 ? c.accent : c.light,
    }
  })
  return (
    <g>
      {/* 狮尾 */}
      <g className="pv-lion-tail" style={{ transformOrigin: '166px 236px' }}>
        <path d="M164 238q26 2 32 20" stroke={c.accent} strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="199" cy="262" r="13" fill={c.accent} />
        <circle cx="199" cy="262" r="7" fill={c.light} />
        <circle cx="195" cy="258" r="2.4" fill={c.primary} />
      </g>

      {/* 身体：小舞狮袍 */}
      <path d="M120 168c-29 0-47 19-51 50l-3 26h108l-3-26c-4-31-22-50-51-50Z" fill={c.primary} />
      <path
        d="M120 168c-18 0-32 9-37 20 12 7 24 9 37 9s25-2 37-9c-5-11-19-20-37-20Z"
        fill={c.accent}
        opacity="0.95"
      />
      <path
        d="M120 172c-11 0-20 5-25 12 7 4 15 5 25 5s18-1 25-5c-5-7-14-12-25-12Z"
        fill={c.light}
        opacity="0.35"
      />
      {/* 金色腰带与祥云 */}
      <rect x="86" y="220" width="68" height="10" rx="5" fill={c.accent} />
      <rect x="114" y="216" width="12" height="18" rx="4" fill={c.light} opacity="0.85" />
      <g stroke={c.gold} strokeWidth="1.8" fill="none" opacity="0.8">
        <path d="M78 246q8-8 16 0q8-8 16 0M132 246q8-8 16 0q8-8 16 0" />
      </g>
      {/* 胸前铃铛 */}
      <circle cx="120" cy="200" r="10" fill={c.accent} stroke={c.dark} strokeWidth="1.6" />
      <path d="M113 199h14M120 190v20" stroke={c.dark} strokeWidth="1.3" opacity="0.55" />
      <circle cx="120" cy="207" r="2" fill={c.dark} />

      {/* 爪：打招呼 / 加油时抬起挥动 */}
      <ellipse cx="82" cy="226" rx="12" ry="11" fill={c.light} stroke={c.accent} strokeWidth="2.4" />
      <path d="M76 224q6 4 12 0" stroke={c.accent} strokeWidth="1.6" fill="none" />
      <g className={waving ? 'pv-lion-paw' : ''} style={{ transformOrigin: '158px 224px' }}>
        {waving ? (
          <g>
            <path d="M154 222q12-16 18-32" stroke={c.primary} strokeWidth="9" strokeLinecap="round" fill="none" />
            <ellipse cx="175" cy="185" rx="12" ry="11" fill={c.light} stroke={c.accent} strokeWidth="2.4" />
          </g>
        ) : (
          <g>
            <ellipse cx="158" cy="226" rx="12" ry="11" fill={c.light} stroke={c.accent} strokeWidth="2.4" />
            <path d="M152 224q6 4 12 0" stroke={c.accent} strokeWidth="1.6" fill="none" />
          </g>
        )}
      </g>

      {/* 小靴 */}
      <g fill={c.dark}>
        <ellipse cx="102" cy="264" rx="15" ry="8" />
        <ellipse cx="138" cy="264" rx="15" ry="8" />
      </g>
      <path d="M88 261h28M124 261h28" stroke={c.accent} strokeWidth="2" opacity="0.8" />

      {/* 狮头：思考时歪头 */}
      <g className={state === 'thinking' ? 'pv-lion-tilt' : ''} style={{ transformOrigin: '120px 150px' }}>
        {/* 鬃毛 */}
        {mane.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={m.fill} stroke={c.gold} strokeWidth="1.2" />
        ))}

        {/* 耳朵 */}
        <circle cx="66" cy="70" r="13" fill={c.primary} stroke={c.accent} strokeWidth="3" />
        <circle cx="174" cy="70" r="13" fill={c.primary} stroke={c.accent} strokeWidth="3" />
        <circle cx="66" cy="70" r="5" fill={c.gold} />
        <circle cx="174" cy="70" r="5" fill={c.gold} />

        {/* 脸盘 */}
        <ellipse cx="120" cy="110" rx="48" ry="44" fill={c.primary} />
        <ellipse cx="120" cy="120" rx="34" ry="28" fill={c.light} opacity="0.14" />

        {/* 独角与额纹 */}
        <path d="M120 34l8 20h-16Z" fill={c.accent} stroke={c.dark} strokeWidth="1.4" />
        <circle cx="120" cy="32" r="6" fill={c.gold} />
        <path d="M120 62q-9 10 0 18q9-8 0-18Z" fill={c.gold} opacity="0.9" />

        {/* 金卷眉 */}
        <path d="M86 88q10-12 22-4q6 5-2 9" stroke={c.gold} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M154 88q-10-12-22-4q-6 5 2 9" stroke={c.gold} strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* 眼睛：睡 / 开心时弯眼 */}
        {closedEyes ? (
          <g stroke={c.dark} strokeWidth="3" fill="none" strokeLinecap="round">
            <path d="M90 104q10 8 20 0" />
            <path d="M130 104q10 8 20 0" />
          </g>
        ) : (
          <g className="pv-eyes">
            <ellipse cx="100" cy="102" rx="12" ry="11" fill="#fff" stroke={c.accent} strokeWidth="2.4" />
            <ellipse cx="140" cy="102" rx="12" ry="11" fill="#fff" stroke={c.accent} strokeWidth="2.4" />
            <circle cx="100" cy="104" r="6" fill={c.dark} />
            <circle cx="140" cy="104" r="6" fill={c.dark} />
            <circle cx="102" cy="101" r="2.3" fill="#fff" />
            <circle cx="142" cy="101" r="2.3" fill="#fff" />
            <circle cx="97" cy="107" r="1.2" fill="#fff" opacity="0.7" />
            <circle cx="137" cy="107" r="1.2" fill="#fff" opacity="0.7" />
          </g>
        )}

        {/* 狮鼻 */}
        <path d="M106 120q14-9 28 0q-3 12-14 12t-14-12Z" fill={c.gold} stroke={c.dark} strokeWidth="1.2" />
        <circle cx="113" cy="124" r="2.4" fill={c.dark} />
        <circle cx="127" cy="124" r="2.4" fill={c.dark} />

        {/* 嘴：说话时开合 */}
        {speaking ? (
          <ellipse className="pv-mouth" cx="120" cy="146" rx="13" ry="5" fill="#7E1310" />
        ) : (
          <path
            d={sleeping ? 'M112 148h16' : 'M104 142q16 14 32 0'}
            stroke="#7E1310"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
        )}
      </g>
    </g>
  )
}

/* 生成式角色立绘（Q 版盲盒风，真透明背景）——优先使用，加载失败时回退到 SVG */
const PORTRAITS = {
  lion: '/images/personas/lion.png',
  papercut: '/images/personas/papercut.png',
  ceramic: '/images/personas/ceramic.png',
  embroidery: '/images/personas/embroidery.png',
  shadow: '/images/personas/shadow.png',
  ink: '/images/personas/ink.png',
}

/* 图片模式下仍保留整身动作，让角色不是一张静态贴图 */
const MOTION_CSS = `
  @keyframes pv-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
  @keyframes pv-hop { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-8px) } 60% { transform: translateY(-3px) } }
  @keyframes pv-bob { 0%,100% { transform: translateY(0) rotate(-.5deg) } 50% { transform: translateY(-3px) rotate(.5deg) } }
  @keyframes pv-nod { 0% { transform: translateY(-8px) scale(.98); opacity: .65 } 100% { transform: translateY(0) scale(1); opacity: 1 } }
  @keyframes pv-jump { 0%,100% { transform: translateY(0) rotate(0) } 25% { transform: translateY(-18px) rotate(-3deg) } 55% { transform: translateY(-4px) rotate(2deg) } 75% { transform: translateY(-11px) rotate(-2deg) } }
  @keyframes pv-lean { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-1.6deg) translateY(1px) } }
  @keyframes pv-sway { 0%,100% { transform: rotate(-1.4deg) } 50% { transform: rotate(1.4deg) } }
  @keyframes pv-sway-slow { 0%,100% { transform: rotate(-1deg) translateY(0) } 50% { transform: rotate(1deg) translateY(-3px) } }
  @keyframes pv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
  @keyframes pv-theatre { 0%,100% { transform: rotate(-2.4deg) translateY(0) } 50% { transform: rotate(2.4deg) translateY(-4px) } }
  @keyframes pv-shy { 0%,100% { transform: rotate(-2deg) translateY(2px) } 50% { transform: rotate(2deg) translateY(0) } }
  @keyframes pv-lion-idle { 0%,100% { transform: translateY(0) rotate(-1deg) } 50% { transform: translateY(-5px) rotate(1deg) } }
  @keyframes pv-lion-happy { 0%,100% { transform: translateY(0) rotate(0) } 30% { transform: translateY(-15px) rotate(-4deg) } 60% { transform: translateY(-2px) rotate(3deg) } 80% { transform: translateY(-9px) rotate(-2deg) } }
  @keyframes pv-lion-cheer { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-13px) rotate(3deg) } }
  @keyframes pv-sleep { 0%,100% { transform: translateY(0) scale(.99) } 50% { transform: translateY(-3px) scale(1) } }
  @keyframes pv-think { 0%,100% { opacity: .25; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-2px) } }
  @keyframes pv-ring { 0% { transform: translate(-50%,-50%) scale(.75); opacity: .45 } 100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0 } }
  @keyframes pv-zzz { 0%,100% { opacity: .35; transform: translateY(0) } 50% { opacity: .9; transform: translateY(-4px) } }
  @keyframes pv-heart { 0%,100% { transform: translateY(0) scale(.9); opacity: .5 } 50% { transform: translateY(-5px) scale(1.1); opacity: 1 } }
  .pv-breathe { animation: pv-breathe 5.5s ease-in-out infinite }
  .pv-hop { animation: pv-hop 2.6s ease-in-out infinite }
  .pv-bob { animation: pv-bob 1.6s ease-in-out infinite }
  .pv-nod { animation: pv-nod .6s cubic-bezier(.22,.61,.36,1) both }
  .pv-jump { animation: pv-jump 1.5s ease-in-out infinite }
  .pv-lean { animation: pv-lean 2.4s ease-in-out infinite }
  .pv-sway { animation: pv-sway 5s ease-in-out infinite }
  .pv-sway-slow { animation: pv-sway-slow 6.4s ease-in-out infinite }
  .pv-float { animation: pv-float 5.8s ease-in-out infinite }
  .pv-theatre { animation: pv-theatre 4.2s ease-in-out infinite }
  .pv-shy { animation: pv-shy 2.4s ease-in-out infinite }
  .pv-lion-idle { animation: pv-lion-idle 4.6s ease-in-out infinite }
  .pv-lion-happy { animation: pv-lion-happy 1.8s ease-in-out infinite }
  .pv-lion-cheer { animation: pv-lion-cheer 1.1s ease-in-out infinite }
  .pv-sleep { animation: pv-sleep 4.2s ease-in-out infinite }
  .pv-think { animation: pv-think 1.1s ease-in-out infinite }
  .pv-ring { animation: pv-ring 1.8s ease-out infinite }
  .pv-zzz { animation: pv-zzz 2.6s ease-in-out infinite }
  .pv-heart { animation: pv-heart 2.2s ease-in-out infinite }
  @media (prefers-reduced-motion: reduce) {
    .pv-breathe, .pv-hop, .pv-bob, .pv-nod, .pv-jump, .pv-lean, .pv-sway, .pv-sway-slow,
    .pv-float, .pv-theatre, .pv-shy, .pv-lion-idle, .pv-lion-happy, .pv-lion-cheer,
    .pv-sleep, .pv-think, .pv-ring, .pv-zzz, .pv-heart { animation: none !important }
  }
`

/* ------------------------- 主组件 ------------------------- */
export default function PersonaAvatar({ persona, state = 'idle', size = 300 }) {
  const styleKey = persona?.avatarStyle || 'ink'
  const style = LOOK[styleKey] ? styleKey : 'ink'
  const c = LOOK[style]
  const isLion = style === 'lion'
  const idleMotion = isLion ? 'pv-lion-idle' : ROLE_MOTION[style] || 'pv-breathe'
  const motion = isLion
    ? LION_STATE_MOTION[state] || idleMotion
    : state === 'idle'
      ? idleMotion
      : STATE_MOTION[state] || idleMotion
  const shadowTranslucent = style === 'shadow'
  const portrait = PORTRAITS[style]
  const [imgFailed, setImgFailed] = useState(false)

  /* 优先使用生成的角色立绘（已是真透明 PNG，无白底），加载失败时回退到 SVG */
  if (portrait && !imgFailed) {
    return (
      <div className="relative select-none" style={{ width: size, height: size }} aria-hidden="true">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle at 50% 46%, ${c.glow} 0%, transparent 70%)` }}
        />
        {state === 'listening' && (
          <>
            <span className="pv-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: c.primary }} />
            <span className="pv-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: c.accent, animationDelay: '0.6s' }} />
          </>
        )}
        <img
          src={portrait}
          alt={persona?.name || ''}
          draggable={false}
          onError={() => setImgFailed(true)}
          className={`relative h-full w-full object-contain ${motion}`}
          style={{
            transformOrigin: '50% 88%',
            filter: 'drop-shadow(0 10px 14px rgba(42,39,34,0.18))',
          }}
        />
        {state === 'thinking' && (
          <div className="absolute right-1 top-3 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
            <span className="pv-think inline-block h-1.5 w-1.5 rounded-full bg-ink/60" />
            <span className="pv-think ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ink/60" style={{ animationDelay: '0.2s' }} />
            <span className="pv-think ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ink/60" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
        {state === 'sleeping' && (
          <span className="pv-zzz absolute right-4 top-4 font-serif text-sm font-semibold" style={{ color: c.accent }}>
            z Z
          </span>
        )}
        {state === 'shy' && (
          <span className="pv-heart absolute right-4 top-2 text-lg" style={{ color: c.accent }}>
            ♥
          </span>
        )}
        <style>{MOTION_CSS}</style>
      </div>
    )
  }

  return (
    <div className="relative select-none" style={{ width: size, height: size }} aria-hidden="true">
      {/* 背后柔光 */}
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle at 50% 46%, ${c.glow} 0%, transparent 70%)` }}
      />
      {/* 聆听声波 */}
      {state === 'listening' && (
        <>
          <span className="pv-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: c.primary }} />
          <span className="pv-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: c.accent, animationDelay: '0.6s' }} />
        </>
      )}

      <svg viewBox="0 0 240 300" className={`relative h-full w-full ${motion}`} style={shadowTranslucent ? { filter: 'drop-shadow(0 6px 10px rgba(120,70,20,.28))' } : undefined}>
        <defs>
          <linearGradient id={`ink-fade-${style}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {isLion ? (
          <>
            <Backdrop style="lion" c={c} state={state} />
            <LionScene c={c} state={state} />
          </>
        ) : (
          <>
            <Backdrop style={style} c={c} state={state} />

            {/* 脚与身体 */}
            <Feet c={c} />
            <Body style={style} c={c} />
            <Hands state={state} c={c} />

            {/* 脖子 */}
            <rect x="110" y="150" width="20" height="20" rx="9" fill={c.skin} />
            <path d="M110 160h20" stroke={c.skin} strokeWidth="2" opacity="0.5" />

            {/* 头（thinking 时歪头） */}
            <g className={state === 'thinking' ? 'pv-head-tilt' : ''} style={{ transformOrigin: '120px 150px' }}>
              <Hair style={style} c={c} state={state} />
              <Face state={state} c={c} />
            </g>

            <Prop style={style} c={c} state={state} />
          </>
        )}
      </svg>

      {/* 思考气泡 */}
      {state === 'thinking' && (
        <div className="absolute right-1 top-3 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
          <span className="pv-think inline-block h-1.5 w-1.5 rounded-full bg-ink/60" />
          <span className="pv-think ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ink/60" style={{ animationDelay: '0.2s' }} />
          <span className="pv-think ml-1 inline-block h-1.5 w-1.5 rounded-full bg-ink/60" style={{ animationDelay: '0.4s' }} />
        </div>
      )}

      {/* 打盹的 Zzz */}
      {state === 'sleeping' && (
        <span className="pv-zzz absolute right-4 top-4 font-serif text-sm font-semibold" style={{ color: c.accent }}>
          z Z
        </span>
      )}

      {/* 害羞时头顶的小心跳 */}
      {state === 'shy' && (
        <span className="pv-heart absolute right-4 top-2 text-lg" style={{ color: c.accent }}>
          ♥
        </span>
      )}

      <style>{`
        @keyframes pv-breathe { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes pv-hop { 0%,100% { transform: translateY(0) } 40% { transform: translateY(-7px) } 60% { transform: translateY(-3px) } }
        @keyframes pv-bob { 0%,100% { transform: translateY(0) rotate(-0.4deg) } 50% { transform: translateY(-3px) rotate(0.4deg) } }
        @keyframes pv-nod { 0% { transform: translateY(-8px) scale(0.98); opacity: .6 } 100% { transform: translateY(0) scale(1); opacity: 1 } }
        @keyframes pv-jump { 0%,100% { transform: translateY(0) rotate(0) } 25% { transform: translateY(-16px) rotate(-3deg) } 55% { transform: translateY(-4px) rotate(2deg) } 75% { transform: translateY(-10px) rotate(-2deg) } }
        @keyframes pv-lean { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-1.6deg) translateY(1px) } }
        @keyframes pv-tilt { 0% { transform: rotate(0deg) } 100% { transform: rotate(0deg) } }
        @keyframes pv-head-tilt { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(-7deg) } }
        @keyframes pv-sway { 0%,100% { transform: rotate(-1.4deg) } 50% { transform: rotate(1.4deg) } }
        @keyframes pv-sway-slow { 0%,100% { transform: rotate(-1deg) translateY(0) } 50% { transform: rotate(1deg) translateY(-3px) } }
        @keyframes pv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes pv-theatre { 0%,100% { transform: rotate(-2.4deg) translateY(0) } 50% { transform: rotate(2.4deg) translateY(-4px) } }
        @keyframes pv-shy { 0%,100% { transform: rotate(-2deg) translateY(2px) } 50% { transform: rotate(2deg) translateY(0) } }
        @keyframes pv-wave { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(16deg) } }
        @keyframes pv-mouth { 0% { ry: 2.2px } 100% { ry: 6.6px } }
        @keyframes pv-think { 0%,100% { opacity: .25; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-2px) } }
        @keyframes pv-ring { 0% { transform: translate(-50%,-50%) scale(.75); opacity: .45 } 100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0 } }
        @keyframes pv-spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        @keyframes pv-blink { 0%,92%,100% { transform: scaleY(1) } 95%,97% { transform: scaleY(.08) } }
        @keyframes pv-heart { 0%,100% { transform: translateY(0) scale(.9); opacity: .5 } 50% { transform: translateY(-5px) scale(1.1); opacity: 1 } }
        .pv-breathe { animation: pv-breathe 5.5s ease-in-out infinite }
        .pv-hop { animation: pv-hop 2.6s ease-in-out infinite }
        .pv-bob { animation: pv-bob 1.6s ease-in-out infinite }
        .pv-nod { animation: pv-nod .6s cubic-bezier(.22,.61,.36,1) both }
        .pv-jump { animation: pv-jump 1.5s ease-in-out infinite }
        .pv-lean { animation: pv-lean 2.4s ease-in-out infinite }
        .pv-sway { animation: pv-sway 5s ease-in-out infinite }
        .pv-sway-slow { animation: pv-sway-slow 6.4s ease-in-out infinite }
        .pv-float { animation: pv-float 5.8s ease-in-out infinite }
        .pv-theatre { animation: pv-theatre 4.2s ease-in-out infinite }
        .pv-shy { animation: pv-shy 2.4s ease-in-out infinite }
        .pv-wave { animation: pv-wave 1.1s ease-in-out infinite; transform-origin: 166px 198px }
        .pv-head-tilt { animation: pv-head-tilt 3s ease-in-out infinite }
        .pv-mouth { animation: pv-mouth .28s ease-in-out infinite alternate }
        .pv-think { animation: pv-think 1.1s ease-in-out infinite }
        .pv-ring { animation: pv-ring 1.8s ease-out infinite }
        .pv-spin { animation: pv-spin 40s linear infinite }
        .pv-eyes { animation: pv-blink 5.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center }
        .pv-heart { animation: pv-heart 2.2s ease-in-out infinite }
        @keyframes pv-lion-idle { 0%,100% { transform: translateY(0) rotate(-1deg) } 50% { transform: translateY(-5px) rotate(1deg) } }
        @keyframes pv-lion-happy { 0%,100% { transform: translateY(0) rotate(0) } 30% { transform: translateY(-14px) rotate(-4deg) } 60% { transform: translateY(-2px) rotate(3deg) } 80% { transform: translateY(-8px) rotate(-2deg) } }
        @keyframes pv-lion-cheer { 0%,100% { transform: translateY(0) rotate(-3deg) } 50% { transform: translateY(-12px) rotate(3deg) } }
        @keyframes pv-lion-tail { 0%,100% { transform: rotate(-12deg) } 50% { transform: rotate(14deg) } }
        @keyframes pv-lion-paw { 0%,100% { transform: rotate(-10deg) } 50% { transform: rotate(18deg) } }
        @keyframes pv-lion-tilt { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(-9deg) } }
        @keyframes pv-sleep { 0%,100% { transform: translateY(0) scale(.99) } 50% { transform: translateY(-3px) scale(1) } }
        @keyframes pv-zzz { 0%,100% { opacity: .35; transform: translateY(0) } 50% { opacity: .9; transform: translateY(-4px) } }
        .pv-lion-idle { animation: pv-lion-idle 4.6s ease-in-out infinite }
        .pv-lion-happy { animation: pv-lion-happy 1.8s ease-in-out infinite }
        .pv-lion-cheer { animation: pv-lion-cheer 1.1s ease-in-out infinite }
        .pv-lion-tail { animation: pv-lion-tail 2.4s ease-in-out infinite }
        .pv-lion-paw { animation: pv-lion-paw 1s ease-in-out infinite }
        .pv-lion-tilt { animation: pv-lion-tilt 3s ease-in-out infinite }
        .pv-sleep { animation: pv-sleep 4.2s ease-in-out infinite }
        .pv-zzz { animation: pv-zzz 2.6s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .pv-breathe, .pv-hop, .pv-bob, .pv-nod, .pv-jump, .pv-lean, .pv-sway, .pv-sway-slow,
          .pv-float, .pv-theatre, .pv-shy, .pv-wave, .pv-head-tilt, .pv-mouth, .pv-think,
          .pv-ring, .pv-spin, .pv-eyes, .pv-heart,
          .pv-lion-idle, .pv-lion-happy, .pv-lion-cheer, .pv-lion-tail,
          .pv-lion-paw, .pv-lion-tilt, .pv-sleep, .pv-zzz { animation: none !important }
        }
      `}</style>
    </div>
  )
}
