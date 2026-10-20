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
  // 🛡️ 2026-05-28: seller_type 값은 'influencer' 유지 (DB 마이그레이션 회피).
  // 🏷️ 2026-08-26 (대표 확정 — "사람을 인플루언서/대행사로 나누지 않는다. 행위 2개로 말한다"):
  //   사용자 대면 라벨을 신분('크리에이터')에서 **행위**('소개')로 바꾼다. 키는 그대로 —
  //   바꾸는 건 화면에 뜨는 말뿐이고, 그 말이 사람을 부류로 가르지 않게 하는 것이 목적이다.
  influencer: {
    label: '소개',
    emoji: '🎤',
    shortLabel: '소개',
    defaultPayout: 'deal',
    canBroadcast: true,
    canRegisterStore: false,
    canPromote: true,
    description: '인스타·카톡·유어샵으로 매장 이용권 소개 → 커미션 적립',
  },
  store_owner: {
    label: '매장 사장님',
    emoji: '🏪',
    shortLabel: '매장',
    defaultPayout: 'cash',
    canBroadcast: false,
    canRegisterStore: true,
    canPromote: false,
    description: '내 매장 이용권 등록 + QR 스캔으로 사용 확인 → 현금 정산',
  },
  both: {
    label: '소개 + 매장',
    emoji: '🎤🏪',
    shortLabel: '소개+매장',
    defaultPayout: 'deal+cash',
    canBroadcast: true,
    canRegisterStore: true,
    canPromote: true,
    description: '내 매장 운영 + 다른 매장 소개 둘 다 (가장 강력)',
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
/** 🧭 2026-07-19 (대표 UI v2 P2 — 셀러 대시보드 심플 모드): 매장 단독(크리에이터 능력 없음).
 *  심플 모드(3메뉴 기본 + 전체 메뉴 접힘) 대상. both(겸업)·influencer 는 기존 전체 노출 유지. */
export function isStoreOnly(role: string | null | undefined): boolean {
  return role === 'store_owner'
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
