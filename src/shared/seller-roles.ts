/**
 * 🛡️ 2026-05-21 Phase D-5: 셀러 role 마스터 (single source of truth).
 *
 * 영구 룰 (CLAUDE.md):
 *   - seller_type 직접 비교 (`=== 'influencer'`) 금지
 *   - 항상 isInfluencer() / isStoreOwner() helper 사용
 *   - 라벨 변경 시 본 파일만 수정 → 전체 UI 자동 반영
 *
 * 새 role 추가 시:
 *   1. SELLER_ROLES 에 entry 추가
 *   2. 끝 (UI 메뉴/페이지가 자동 분기 — RoleGate 사용 시)
 *
 * 라이브커머스 + 오프라인 공동구매 통합 컨텍스트:
 *   - influencer: 라이브 / 인스타 / 카톡으로 가게 voucher 홍보 → 본인 commission (딜)
 *   - store_owner: 본인 매장 voucher 등록 + 매직링크로 QR 스캔 → 현금 정산
 *   - both: 본인 매장 + 다른 가게 홍보 둘 다
 */

export type SellerRole = 'influencer' | 'store_owner' | 'both'

interface RoleMeta {
  label: string             // UI 표시
  emoji: string
  shortLabel: string        // 짧은 라벨 (badge 등)
  defaultPayout: 'deal' | 'cash' | 'deal+cash'
  canBroadcast: boolean     // 라이브 송출 가능?
  canRegisterStore: boolean // 본인 매장 voucher 등록 가능?
  canPromote: boolean       // 다른 매장 홍보 가능?
  description: string
}

export const SELLER_ROLES: Record<SellerRole, RoleMeta> = {
  influencer: {
    label: '🎤 인플루언서',
    emoji: '🎤',
    shortLabel: '인플루언서',
    defaultPayout: 'deal',
    canBroadcast: true,
    canRegisterStore: false,
    canPromote: true,
    description: '라이브 / 인스타 / 카톡으로 매장 공구 홍보 → commission (딜) 적립',
  },
  store_owner: {
    label: '🏪 매장 사장님',
    emoji: '🏪',
    shortLabel: '매장',
    defaultPayout: 'cash',
    canBroadcast: false,
    canRegisterStore: true,
    canPromote: false,
    description: '본인 매장 voucher 등록 + QR 스캔으로 사용 확인 → 현금 정산',
  },
  both: {
    label: '🎤🏪 인플루언서 + 매장',
    emoji: '🎤🏪',
    shortLabel: '겸업',
    defaultPayout: 'deal+cash',
    canBroadcast: true,
    canRegisterStore: true,
    canPromote: true,
    description: '본인 매장 운영 + 다른 매장 홍보 둘 다 (가장 강력)',
  },
}

// ── Helpers (모든 if/else 분기는 여기 함수만 사용) ──
export function isInfluencer(role: string | null | undefined): boolean {
  return role === 'influencer' || role === 'both'
}
export function isStoreOwner(role: string | null | undefined): boolean {
  return role === 'store_owner' || role === 'both'
}
export function isBoth(role: string | null | undefined): boolean {
  return role === 'both'
}
export function getRoleMeta(role: string | null | undefined): RoleMeta {
  if (role && role in SELLER_ROLES) return SELLER_ROLES[role as SellerRole]
  return SELLER_ROLES.influencer  // graceful default
}
export function getRoleLabel(role: string | null | undefined): string {
  return getRoleMeta(role).label
}
export function getRoleShortLabel(role: string | null | undefined): string {
  return getRoleMeta(role).shortLabel
}

// ── Permission helpers ──
export function canBroadcast(role: string | null | undefined): boolean {
  return getRoleMeta(role).canBroadcast
}
export function canRegisterStore(role: string | null | undefined): boolean {
  return getRoleMeta(role).canRegisterStore
}
export function canPromote(role: string | null | undefined): boolean {
  return getRoleMeta(role).canPromote
}

// ── Browser-side: localStorage 에서 현재 seller_type 읽기 ──
export function getCurrentSellerRole(): SellerRole {
  if (typeof window === 'undefined') return 'influencer'
  const stored = localStorage.getItem('seller_type')
  if (stored && stored in SELLER_ROLES) return stored as SellerRole
  return 'influencer'  // graceful default
}

// 외부 컨벤션 명칭 (한국 시장 컨벤션):
//   "셀러" = 인플루언서 (라이브커머스 컨벤션)
//   "사장님" = 매장 owner (오프라인 공구 컨벤션)
//   "에이전시" = 매니징 조직
// docs/AGENCY_POLICY.md 참조.
