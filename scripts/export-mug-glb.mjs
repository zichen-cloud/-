/* ============================================================
 * 一次性资产构建脚本：生成真实 GLB 马克杯模型
 * ------------------------------------------------------------
 * 运行：node scripts/export-mug-glb.mjs
 * 产出：public/models/mug.glb
 *
 * 坐标约定与前端程序化 MugModel 完全一致（杯身中心在原点，
 * 杯底 y=-0.95），ProductModel 加载后可落到统一地面基线。
 *
 * 网格命名很关键：前端会把设计纹样定向替换到名字含 body 的
 * 网格（杯身），把手/内壁/口沿保持本色——以此验证
 * 「真实 GLB 加载 + 主体贴图替换」整条链路。
 * ============================================================ */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/* Node 环境缺少 FileReader（GLTFExporter 打包 GLB 时用它读 Blob），补最小 polyfill */
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = buffer
          this.onload?.()
          this.onloadend?.()
        })
        .catch((err) => {
          this.onerror?.(err)
          this.onloadend?.()
        })
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'public', 'models', 'mug.glb')

const ceramic = new THREE.MeshStandardMaterial({
  color: 0xf4efe6,
  roughness: 0.55,
  metalness: 0.04,
  side: THREE.DoubleSide,
})
const innerMat = new THREE.MeshStandardMaterial({ color: 0xcfc7b5, roughness: 0.9, side: THREE.BackSide })
const bottomMat = new THREE.MeshStandardMaterial({ color: 0xede6d6, roughness: 0.8 })

function mesh(name, geometry, material) {
  const m = new THREE.Mesh(geometry, material)
  m.name = name
  m.castShadow = true
  m.receiveShadow = true
  return m
}

const scene = new THREE.Scene()
const cup = new THREE.Group()
cup.name = 'heritage-mug'

// 杯身（开口，贴图替换目标）
cup.add(mesh('cup-body', new THREE.CylinderGeometry(0.78, 0.66, 1.9, 64, 1, true), ceramic))
// 内壁
const inside = mesh('cup-inside', new THREE.CylinderGeometry(0.68, 0.6, 1.8, 48, 1, true), innerMat)
inside.position.y = -0.02
cup.add(inside)
// 杯底
const bottom = mesh('cup-bottom', new THREE.CircleGeometry(0.66, 48), bottomMat)
bottom.rotation.x = -Math.PI / 2
bottom.position.y = -0.95
cup.add(bottom)
// 口沿细环
const rim = mesh('cup-rim', new THREE.TorusGeometry(0.78, 0.035, 16, 64), ceramic)
rim.rotation.x = Math.PI / 2
rim.position.y = 0.95
cup.add(rim)
// 把手
const handle = mesh('cup-handle', new THREE.TorusGeometry(0.42, 0.09, 18, 48), ceramic)
handle.rotation.y = Math.PI / 2
handle.scale.y = 1.25
handle.position.set(0.82, 0.05, 0)
cup.add(handle)

scene.add(cup)

/* 导出为二进制 GLB */
const exporter = new GLTFExporter()

exporter.parse(
  scene,
  async (result) => {
    await mkdir(dirname(OUT_PATH), { recursive: true })
    const buffer = Buffer.from(result)
    await writeFile(OUT_PATH, buffer)
    console.log(`[OK] GLB 已生成：${OUT_PATH}（${(buffer.length / 1024).toFixed(1)} KB）`)
  },
  (err) => {
    console.error('[FAIL] GLB 导出失败：', err)
    process.exitCode = 1
  },
  { binary: true },
)
