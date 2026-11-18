/* ============================================================
 * 创作工坊图标集（内联 SVG，无需第三方图标库）
 * 用法：<StudioIcon name="scissors" className="text-cinnabar" />
 * ============================================================ */
const PATHS = {
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M8.2 8.2 20 18M8.2 15.8 20 6M14 12h.01" />
    </>
  ),
  needle: (
    <>
      <path d="M3 21 18 6" />
      <path d="m16 4 4 4-3 3-4-4z" />
      <path d="M19 3c1.5 1.5 1.5 3 0 4" />
    </>
  ),
  pattern: (
    <>
      <path d="M4 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
      <path d="M4 11c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
    </>
  ),
  enamel: (
    <>
      <path d="M10 3h4v4l4 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8l4-3z" />
      <path d="M10 7h4" />
    </>
  ),
  puppet: (
    <>
      <circle cx="12" cy="6" r="3" />
      <path d="M9 10c-2 2-3 5-3 9M15 10c2 2 3 5 3 9M12 9v10" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" />
      <path d="M19 3v3M5 18v3M20.5 18.5l1 2.5-2.5 1 1-2.5z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-5.3L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14 5.3L20 16" />
      <path d="M16 16h4v4" />
    </>
  ),
  save: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h7V3M8 21v-7h8v7" />
    </>
  ),
  check: <path d="M5 12.5 10 17l9-10" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2 0-1.5-1-2-1-3 0-1.1.9-2 2-2h2a4 4 0 0 0 4-4c0-3.9-4-7-9-7Z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="15.5" cy="9" r="1" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  /* ---- 新增主题图标 ---- */
  lion: (
    <>
      <circle cx="12" cy="10" r="5" />
      <path d="M8 15c-1 2-2 4-2 6M16 15c1 2 2 4 2 6M12 15v6" />
      <circle cx="9" cy="9" r="0.5" fill="currentColor" />
      <circle cx="15" cy="9" r="0.5" fill="currentColor" />
      <path d="M12 5c0-2 2-3 3-3" />
    </>
  ),
  mask: (
    <>
      <path d="M4 6c0 8 3 14 8 14s8-6 8-14" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M9 14c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l12-2v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  taiji: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a4.5 4.5 0 0 1 0 9 4.5 4.5 0 0 0 0 9" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  boat: (
    <>
      <path d="M4 18c4-1 12-1 16 0" />
      <path d="M6 18c0-4 2-8 6-10 4 2 6 6 6 10" />
      <path d="M12 8V4M9 6l3-2 3 2" />
    </>
  ),
  paper: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  porcelain: (
    <>
      <path d="M8 3h8l-1 5c3 1 4 4 4 7 0 4-3 6-7 6s-7-2-7-6c0-3 1-6 4-7L8 3z" />
      <path d="M8 3h8" />
    </>
  ),
  butterfly: (
    <>
      <path d="M12 8c-2-4-6-5-8-3s0 6 3 7c-3 1-4 4-2 5s5 0 7-3" />
      <path d="M12 8c2-4 6-5 8-3s0 6-3 7c3 1 4 4 2 5s-5 0-7-3" />
      <path d="M12 8v10" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  microphone: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
    </>
  ),
  painting: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="M3 15l5-4 4 3 5-4 4 3" />
    </>
  ),
  /* ---- 产品类型图标 ---- */
  bag: (
    <>
      <path d="M5 8h14l-1 13H6L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  cup: (
    <>
      <path d="M5 6h11v8a5 5 0 0 1-5 5 5 5 0 0 1-5-5V6z" />
      <path d="M16 8h2.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M4 21h13M8 3v2M12 3v2" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  bookmark: (
    <>
      <path d="M6 3h12v18l-6-4-6 4V3z" />
      <path d="M9 8h6" />
    </>
  ),
  magnet: (
    <>
      <path d="M6 3v8a6 6 0 0 0 12 0V3" />
      <path d="M6 3h4v7H6zM14 3h4v7h-4z" />
    </>
  ),
  cushion: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="4" />
      <path d="M7 10v4M17 10v4M12 9.5v5" />
    </>
  ),
  /* ---- 工作台通用图标 ---- */
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2 21 7v10l-9 5-9-5V7l9-5z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-4 4 3 3-2 4 3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
}

export default function StudioIcon({ name, size = 22, className = '', strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name] ?? PATHS.sparkle}
    </svg>
  )
}
