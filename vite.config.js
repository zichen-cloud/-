// Vite 配置文件
// 作用：告诉 Vite 如何启动和构建项目
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // 启用 React 插件（支持 JSX、Fast Refresh 热更新）
  plugins: [react()],
  server: {
    port: 5173, // 本地开发服务器端口
    open: true, // 启动时自动打开浏览器
    // 代理：把 /api 开头的请求转发给 FastAPI 后端
    // 好处：前端请求路径只写 /api/...，不用写完整地址，也不会遇到跨域问题
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
