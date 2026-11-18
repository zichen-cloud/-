/* ============================================================
 * CameraRig：旋转 / 缩放 / 视角切换
 * ------------------------------------------------------------
 * - OrbitControls：鼠标左键旋转、滚轮缩放（阻尼顺滑），平移关闭
 * - 视角按钮切换时，相机在 useFrame 里平滑 lerp 到预设位置
 *   （不直接调用 controls.reset，规避 drei ref 类型差异）
 * ============================================================ */
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

/* 视角动画器：targetPos 变化时把相机平滑移过去 */
function ViewAnimator({ targetPos, controlsRef, lookAtY }) {
  const { camera } = useThree()

  // 窄屏（手机竖屏）水平视野不足，按画幅比适度拉远（上限 1.5），
  // 拉远过多会让小件产品在画面中过小
  const target = useMemo(() => {
    const v = new THREE.Vector3(...targetPos)
    if (camera.aspect < 1) {
      v.multiplyScalar(Math.min(1.5, 1 / camera.aspect))
    }
    return v
  }, [targetPos, camera.aspect])

  const lookAt = useMemo(() => new THREE.Vector3(0, lookAtY, 0), [lookAtY])
  const animating = useRef(true)

  useEffect(() => {
    animating.current = true
  }, [targetPos, lookAtY])

  useFrame(() => {
    const controls = controlsRef.current
    if (animating.current) {
      camera.position.lerp(target, 0.12)
      controls?.target.lerp(lookAt, 0.12)
      controls?.update()
      if (camera.position.distanceTo(target) < 0.03) {
        animating.current = false
      }
    }
  })

  return null
}

export default function CameraRig({ targetPos, autoRotate, lookAtY = 0 }) {
  const controlsRef = useRef(null)

  return (
    <>
      <ViewAnimator targetPos={targetPos} controlsRef={controlsRef} lookAtY={lookAtY} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={1.6}
        minDistance={1.2}
        maxDistance={9}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI * 0.62}
      />
    </>
  )
}
