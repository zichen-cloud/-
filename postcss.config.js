// PostCSS 配置
// 作用：Tailwind CSS 需要借助 PostCSS 才能把工具类编译进最终的 CSS
// 注意：这个文件必须存在，否则 Tailwind 样式不会生效
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}, // 自动补全浏览器前缀，兼容更多浏览器
  },
}
