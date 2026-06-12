// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통스타트 도매몰 — TDS(Toss) 디자인 토큰 + 헬퍼 (시안 구현)
//   시안: docs/design (유통스타트 도매몰.html). 무채색 베이스 + #FF0033 1포인트.
//   도매몰은 라이트 고정 B2B 서피스(대시보드 계열) — dark: variant 없음.
// ──────────────────────────────────────────────────────────────

/** Toss 그레이스케일 + 브랜드 액센트 토큰 */
export const WT = {
  ink: '#17181C',   // 근블랙 (강조 텍스트/주요 면)
  ink2: '#4E5560',  // 보조 텍스트
  ink3: '#8A929E',  // 캡션
  ink4: '#B6BCC4',  // 흐린 텍스트
  line: '#ECEEF1',  // 라인 (최소 사용)
  fill: '#F4F5F7',  // 섹션 배경
  fill2: '#F8F9FB', // 카드 내부 면
  brand: '#FF0033', // 액센트 — 주 CTA/활성/핵심 단가에만
  brandSoft: '#FFF0F2',
  pos: '#11875A',   // 마진/이득
  posBg: '#EAF6EF',
  shCard: '0 1px 2px rgba(20,22,28,0.04), 0 12px 28px -16px rgba(20,22,28,0.14)',
  shSoft: '0 1px 3px rgba(20,22,28,0.06)',
  shUp: '0 -8px 24px -16px rgba(20,22,28,0.18)',
} as const

/** ₩ + 천단위 콤마 */
export const won = (n: number | null | undefined) => '₩' + Number(n || 0).toLocaleString('ko-KR')
/** 숫자만 콤마 */
export const comma = (n: number | null | undefined) => Number(n || 0).toLocaleString('ko-KR')
/** 권장소비자가 대비 공급가 할인율 (%) */
export const discountRate = (supply: number, retail: number) =>
  retail > 0 && supply > 0 ? Math.round((1 - supply / retail) * 100) : 0
/** 개당 마진액 (권장가 − 공급가) */
export const unitMargin = (supply: number, retail: number) => Math.max(0, (retail || 0) - (supply || 0))
/** 공급가 대비 마진율 (%) */
export const marginRate = (supply: number, retail: number) =>
  supply > 0 && retail > supply ? Math.round(((retail - supply) / supply) * 100) : 0

/** 등급 라벨 (코드 → 한국어) */
export const GRADE_LABEL: Record<string, string> = {
  A: 'A', B: 'B', C: 'C', D: 'D', OEM: 'OEM', SPECIAL: '특별가',
}

/**
 * 🏭 2026-06-12 (감사 부채): 도매 주문 상태 뱃지 SSOT.
 *   기존엔 WholesaleDashboardPage(STATUS_BADGE, 5종)와 WholesaleOrdersPage(STATUS, 10종)가
 *   따로 정의 — 같은 상태가 다른 라벨('배송준비' vs '결제완료')로 보이던 것 통합.
 *   상태값은 wholesale_orders.status (docs/SCHEMA.md — 대문자).
 */
export const WHOLESALE_ORDER_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '결제대기', color: '#9A6B00', bg: '#FFF6E6' },
  PAID: { label: '결제완료', color: '#11875A', bg: '#EAF6EF' },
  ON_CREDIT: { label: '여신(외상)', color: '#0E8A6E', bg: '#E6F6F1' },
  SHIPPED: { label: '배송중', color: '#1B64DA', bg: '#EAF1FE' },
  PARTIAL_REFUNDED: { label: '부분환불', color: '#C2620C', bg: '#FFF1E6' },
  REFUNDED: { label: '환불완료', color: '#D63A4E', bg: '#FDECEF' },
  CANCELLED: { label: '취소', color: '#8A929E', bg: '#F2F4F6' },
  EXPIRED: { label: '만료', color: '#B6BCC4', bg: '#F2F4F6' },
  FAILED: { label: '실패', color: '#8A929E', bg: '#F2F4F6' },
  DONE: { label: '구매확정', color: '#11875A', bg: '#EAF6EF' },
}

/** 미지의 상태값도 안전하게 — 뱃지 폴백. */
export const wholesaleOrderStatusBadge = (status: string | null | undefined) =>
  WHOLESALE_ORDER_STATUS[String(status || '')] || { label: String(status || '-'), color: WT.ink3, bg: WT.fill }

/** 카테고리 정의 (도매 카탈로그 칩/사이드바) */
export const WHOLESALE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'food', label: '식품' },
  { id: 'beauty', label: '뷰티' },
  { id: 'living', label: '리빙' },
  { id: 'fashion', label: '패션' },
  { id: 'digital', label: '디지털' },
  { id: 'lifestyle', label: '생활' },
]
