/* ============================================================
 * 程序化产品 3D 模型 ProceduralModels
 * ------------------------------------------------------------
 * 全部由 Three.js 标准几何体构成（真 3D 网格，有体积、光照与阴影，
 * 可旋转缩放，绝非图片贴片冒充）。
 *
 * 贴图策略：
 *   - 帆布袋/手机壳/书签/冰箱贴/抱枕：素色产品体 + 正面「印花贴片」
 *   - 马克杯：纹理直接环绕杯身
 * texture 为 null 时（如效果图加载中），印花面退为素色材质。
 * ============================================================ */
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

/* 素体材质（哑光产品胚体） */
function bodyMaterial(color = '#EDE6D8') {
  return (
    <meshStandardMaterial color={color} roughness={0.9} metalness={0.02} />
  )
}

/* 印花贴片材质 */
function PrintMaterial({ texture }) {
  if (!texture) {
    return <meshStandardMaterial color="#F6F1E7" roughness={0.8} />
  }
  return (
    <meshStandardMaterial
      map={texture}
      roughness={0.72}
      metalness={0.01}
      transparent
    />
  )
}

/* ---------------- 帆布袋 ---------------- */
function ToteBagModel({ texture }) {
  return (
    <group>
      {/* 袋身（中心在原点，底部 y=-1.3） */}
      <RoundedBox args={[2.4, 2.6, 0.55]} radius={0.12} smoothness={4} castShadow receiveShadow>
        {bodyMaterial('#E7DFCC')}
      </RoundedBox>
      {/* 正面印花：z 偏移 0.30，大于袋身圆角半径 0.12，避免陷入曲面 */}
      <mesh position={[0, 0, 0.30]} castShadow>
        <planeGeometry args={[1.95, 1.98]} />
        <PrintMaterial texture={texture} />
      </mesh>
      {/* 两个提手（半圆，开口朝下扣在袋口） */}
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 1.32, 0]} castShadow>
          <torusGeometry args={[0.36, 0.055, 16, 40, Math.PI]} />
          <meshStandardMaterial color="#D8CDB4" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

/* ---------------- 马克杯（纹理环绕杯身） ---------------- */
function MugModel({ texture }) {
  return (
    <group>
      {/* 杯身（开口圆柱，中心在原点，底部 y=-0.95） */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.66, 1.9, 64, 1, true]} />
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.55} metalness={0.04} side={THREE.DoubleSide} />
        ) : (
          <meshStandardMaterial color="#F4EFE6" roughness={0.55} metalness={0.04} side={THREE.DoubleSide} />
        )}
      </mesh>
      {/* 内壁（深色，体现空心） */}
      <mesh position={[0, -0.02, 0]}>
        <cylinderGeometry args={[0.68, 0.6, 1.8, 48, 1, true]} />
        <meshStandardMaterial color="#CFC7B5" roughness={0.9} side={THREE.BackSide} />
      </mesh>
      {/* 杯底 */}
      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.66, 48]} />
        <meshStandardMaterial color="#EDE6D6" roughness={0.8} />
      </mesh>
      {/* 把手（环平面转到 YZ 方向） */}
      <mesh position={[0.82, 0.05, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.25, 1]} castShadow>
        <torusGeometry args={[0.42, 0.09, 18, 48]} />
        <meshStandardMaterial color="#F4EFE6" roughness={0.55} metalness={0.04} />
      </mesh>
    </group>
  )
}

/* ---------------- 手机壳 ---------------- */
function PhoneCaseModel({ texture }) {
  return (
    <group position={[0, 0, 0]}>
      <RoundedBox args={[1.35, 2.7, 0.16]} radius={0.15} smoothness={4} castShadow receiveShadow>
        {bodyMaterial('#EDE6D8')}
      </RoundedBox>
      {/* 正面印花（z 偏移大于圆角半径，避免陷入曲面） */}
      <mesh position={[0, -0.1, 0.10]}>
        <planeGeometry args={[1.08, 2.28]} />
        <PrintMaterial texture={texture} />
      </mesh>
      {/* 摄像头 */}
      <mesh position={[-0.4, 1.12, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 32]} />
        <meshStandardMaterial color="#2A2722" roughness={0.35} metalness={0.3} />
      </mesh>
    </group>
  )
}

/* ---------------- 书签 ---------------- */
function BookmarkModel({ texture }) {
  return (
    <group>
      <RoundedBox args={[0.85, 3.3, 0.06]} radius={0.06} smoothness={3} castShadow receiveShadow>
        {bodyMaterial('#EFE8D8')}
      </RoundedBox>
      <mesh position={[0, -0.18, 0.045]}>
        <planeGeometry args={[0.68, 2.7]} />
        <PrintMaterial texture={texture} />
      </mesh>
      {/* 挂孔 */}
      <mesh position={[0, 1.42, 0.036]}>
        <torusGeometry args={[0.085, 0.018, 12, 32]} />
        <meshStandardMaterial color="#B9AE97" roughness={0.6} metalness={0.15} />
      </mesh>
    </group>
  )
}

/* ---------------- 冰箱贴 ---------------- */
function FridgeMagnetModel({ texture }) {
  return (
    <group rotation={[0, 0, 0]}>
      {/* 磁贴本体（轴向朝屏幕的扁圆柱，直径 0.7 接近真实冰箱贴比例） */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.08, 64]} />
        <meshStandardMaterial color="#E9E1CF" roughness={0.85} />
      </mesh>
      {/* 正面图案 */}
      <mesh position={[0, 0, 0.045]}>
        <circleGeometry args={[0.32, 64]} />
        <PrintMaterial texture={texture} />
      </mesh>
    </group>
  )
}

/* ---------------- 抱枕 / 方巾 ---------------- */
function CushionModel({ texture }) {
  return (
    <group>
      <RoundedBox args={[2.7, 2.7, 0.62]} radius={0.3} smoothness={6} castShadow receiveShadow>
        {bodyMaterial('#ECE3D2')}
      </RoundedBox>
      <mesh position={[0, 0, 0.33]}>
        <planeGeometry args={[2.24, 2.24]} />
        <PrintMaterial texture={texture} />
      </mesh>
    </group>
  )
}

/* 产品 → 程序化模型组件 */
export const PROCEDURAL_MODELS = {
  'tote-bag': ToteBagModel,
  mug: MugModel,
  'phone-case': PhoneCaseModel,
  bookmark: BookmarkModel,
  'fridge-magnet': FridgeMagnetModel,
  cushion: CushionModel,
}

/* 产品 → 印花纹理平铺次数（马克杯环绕杯身，横向重复） */
export const TEXTURE_REPEAT = {
  mug: [2, 1],
  'fridge-magnet': [1, 1],
  default: [1, 1],
}

/* 产品模型的「着地半高」：建模时中心在原点，底部 y=-halfHeight。
 * ProductModel 用它把所有产品统一放到同一条地面基线上。 */
export const MODEL_HALF_HEIGHT = {
  'tote-bag': 1.3,
  mug: 0.95,
  'phone-case': 1.35,
  bookmark: 1.65,
  'fridge-magnet': 0.35, // 修正：与圆柱半径一致，避免模型沉底
  cushion: 1.35,
}

/* 统一的地面基线（与场景中 ContactShadows 的高度一致） */
export const GROUND_Y = -1.5

export function getTextureRepeat(productType) {
  return TEXTURE_REPEAT[productType] || TEXTURE_REPEAT.default
}
