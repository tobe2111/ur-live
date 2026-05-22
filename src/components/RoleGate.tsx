/**
 * 🛡️ 2026-05-21 Phase D-5: 셀러 role 기반 UI 자동 분기 컴포넌트.
 *
 * 사용:
 *   <RoleGate showFor="influencer"><TrackingLinkCopy /></RoleGate>
 *   <RoleGate showFor="store_owner"><StoreMagicLinkCard /></RoleGate>
 *   <RoleGate showFor={['influencer', 'both']}><LiveBroadcastButton /></RoleGate>
 *
 * 영구성:
 *   - 새 role 추가 시 seller-roles.ts 만 수정 → 자동 작동
 *   - localStorage.seller_type 변경 시 즉시 반영
 */
import { type ReactNode, useEffect, useState } from 'react'
import { isInfluencer, isStoreOwner, getCurrentSellerRole, type SellerRole } from '@/shared/seller-roles'

interface Props {
  showFor: SellerRole | SellerRole[] | 'influencer-or-both' | 'store-or-both'
  children: ReactNode
  fallback?: ReactNode
}

export default function RoleGate({ showFor, children, fallback = null }: Props) {
  // localStorage 변경 감지 (모드 전환 시)
  const [role, setRole] = useState<SellerRole>(() => getCurrentSellerRole())
  useEffect(() => {
    const handler = () => setRole(getCurrentSellerRole())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  let visible = false
  if (showFor === 'influencer-or-both') visible = isInfluencer(role)
  else if (showFor === 'store-or-both') visible = isStoreOwner(role)
  else if (Array.isArray(showFor)) visible = showFor.includes(role)
  else visible = role === showFor

  return <>{visible ? children : fallback}</>
}
