// Tailwind CSS 配置文件
// 作用：定义"新中式"设计规范（颜色、字体、动画等），之后可在任意 className 中使用
/** @type {import('tailwindcss').Config} */
export default {
  // content：告诉 Tailwind 去哪些文件里扫描用到的类名
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 宣纸底色：页面主背景，温暖的米白
        paper: '#FAF7F1',
        // 墨色：正文文字（DEFAULT 表示直接用 text-ink）
        ink: {
          DEFAULT: '#2A2722',
          soft: '#57524A', // 次级文字
          mute: '#8A8378', // 辅助说明文字
        },
        // 朱砂红：品牌主色，取自印章/宫墙红，克制地用作点缀
        cinnabar: {
          DEFAULT: '#B23A2E',
          dark: '#8F2D23', // 按钮悬停深色
          light: '#C96254',
        },
        celadon: {
          DEFAULT: '#5F7D6E', // 青瓷绿：辅助色
          dark: '#4A6659',
        },
        gold: {
          DEFAULT: '#B08D4F', // 鎏金：少量点缀
          dark: '#8A6D3B', // 金色提示文字（底色上的可读深色）
        },
        line: '#E8E1D5', // 卡片/分割线的暖灰边框
      },
      fontFamily: {
        // 标题用宋体（文化感），正文用黑体（现代、易读）
        serif: ['"Noto Serif SC"', '"Songti SC"', 'SimSun', 'serif'],
        sans: [
          '"Noto Sans SC"',
          'system-ui',
          '-apple-system',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      keyframes: {
        // 元素自下而上淡入（用于首页 Hero 入场动画）
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Hero 墨点粒子的缓慢漂浮（低透明度，不喧宾夺主）
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        // 页面切换的整体淡入（MainLayout 内容容器，仅透明度不位移，
        // 与页面内部 fade-up 的位移入场叠加后过渡更自然）
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // 数字长卷缓慢横移（背景图左右游移，仿佛展开画卷）
        scrollPan: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        // 水墨晕染：色斑缓慢漂移并轻微呼吸缩放（首页动态背景）
        inkDrift: {
          '0%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(2.5%,-2.2%,0) scale(1.09)' },
          '100%': { transform: 'translate3d(0,0,0) scale(1)' },
        },
        // 宣纸/釉面光泽缓慢扫过（克制的一次性高光，不循环闪烁）
        sheen: {
          '0%': { transform: 'translateX(-70%) skewX(-14deg)', opacity: '0' },
          '18%': { opacity: '0.35' },
          '45%': { opacity: '0' },
          '100%': { transform: 'translateX(170%) skewX(-14deg)', opacity: '0' },
        },
        // 画卷展开：从中间向两侧揭开（数字传承人出场）
        scrollOpen: {
          '0%': { clipPath: 'inset(0 50% 0 50%)', opacity: '0.2' },
          '100%': { clipPath: 'inset(0 0 0 0)', opacity: '1' },
        },
        // 角色登场：上浮淡入
        personaIn: {
          '0%': { opacity: '0', transform: 'translateY(22px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.7s ease both',
        float: 'float 10s ease-in-out infinite',
        'fade-in': 'fadeIn 0.45s ease both',
        'scroll-pan': 'scrollPan 40s linear infinite alternate',
        'ink-drift': 'inkDrift 24s ease-in-out infinite',
        'ink-drift-slow': 'inkDrift 38s ease-in-out infinite',
        sheen: 'sheen 9s ease-in-out infinite',
        'scroll-open': 'scrollOpen 0.85s cubic-bezier(0.22,0.61,0.36,1) both',
        'persona-in': 'personaIn 0.6s cubic-bezier(0.22,0.61,0.36,1) both',
      },
    },
  },
  plugins: [],
}
