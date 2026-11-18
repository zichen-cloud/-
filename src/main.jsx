// 应用入口文件
// 作用：把 React 组件挂载到 index.html 中的 <div id="root"> 上
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css' // 引入全局样式（含 Tailwind）

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BrowserRouter：开启前端路由，使 /heritage、/chat 等路径可以切换页面 */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
