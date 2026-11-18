/* ============================================================
 * ProductModel：3D 模型分发
 * ------------------------------------------------------------
 *   1. 产品配置了 glbUrl → 用 useGLTF 加载【真实 GLB/GLTF 模型】，
 *      克隆材质后把设计纹样替换到主体 mesh（不修改 drei 的模型缓存）。
 *      模型里找不到任何可贴图的网格时抛错，由上层 ErrorBoundary
 *      降级为「静态预览」，绝不拿静态图冒充 3D。
 *   2. 未配置 → 渲染程序化 3D 几何体。
 *
 * 资源释放：卸载时 dispose 克隆材质，并 useGLTF.clear 释放缓存。
 * ============================================================ */
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { GROUND_Y, MODEL_HALF_HEIGHT, PROCEDURAL_MODELS, getTextureRepeat } from './ProceduralModels.jsx'

/* ---------- 真实 GLB 模型 ---------- */

function GltfProductModel({ url, texture }) {
  const { scene } = useGLTF(url)

  // 克隆场景与材质，避免污染 useGLTF 的共享缓存
  const cloned = useMemo(() => {
    const root = scene.clone(true)
    const bodyMeshes = []
    const allMeshes = []

    root.traverse((obj) => {
      if (!obj.isMesh) return
      allMeshes.push(obj)
      obj.castShadow = true
      obj.receiveShadow = true
      // 导出脚本中杯身命名为 cup-body；兼容名字里带 body/main 的网格
      const name = (obj.name || '').toLowerCase()
      if (/(body|main|print|surface)/.test(name)) bodyMeshes.push(obj)
    })

    if (allMeshes.length === 0) {
      throw new Error('GLB 模型中没有可渲染的网格')
    }

    const targets = bodyMeshes.length > 0 ? bodyMeshes : allMeshes
    targets.forEach((mesh) => {
      const apply = (mat) => {
        const m = mat.clone()
        if (texture) {
          m.map = texture
          m.roughness = 0.6
          m.needsUpdate = true
        }
        return m
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(apply)
        : apply(mesh.material)
    })

    return { root, clonedMaterials: targets }
  }, [scene, texture])

  // 卸载释放：克隆的材质与模型缓存
  useEffect(() => {
    return () => {
      cloned.clonedMaterials.forEach((mesh) => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((m) => m?.dispose())
      })
      useGLTF.clear(url)
    }
  }, [cloned, url])

  return <primitive object={cloned.root} />
}

/* ---------- 分发入口 ---------- */

export default function ProductModel({ productType, glbUrl, texture }) {
  // 统一放置：让模型底部落在 GROUND_Y 基线上（GLB 与程序化模型采用同一坐标约定）
  const halfHeight = MODEL_HALF_HEIGHT[productType] ?? 1

  // 1. 真实 GLB 优先
  if (glbUrl) {
    return (
      <group position={[0, GROUND_Y + halfHeight, 0]}>
        <GltfProductModel url={glbUrl} texture={texture} />
      </group>
    )
  }

  // 2. 程序化模型（真 3D 网格）
  const Procedural = PROCEDURAL_MODELS[productType]
  if (!Procedural) {
    // 未知产品：抛出后由 ErrorBoundary 降级为静态预览
    throw new Error(`暂不支持的产品类型：${productType}`)
  }
  return (
    <group position={[0, GROUND_Y + halfHeight, 0]}>
      <Procedural texture={texture} />
    </group>
  )
}

/* 供 Viewer 读取该产品的纹理平铺参数 */
export { getTextureRepeat }

/* 让 drei 在挂载前预加载 GLB（可在路由进入时调用，失败不阻塞渲染） */
export function preloadModel(url) {
  if (url) useGLTF.preload(url)
}
