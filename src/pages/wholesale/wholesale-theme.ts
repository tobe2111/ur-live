// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통스타트 도매몰 — TDS(Toss) 디자인 토큰 + 헬퍼 (시안 구현)
//   시안: docs/design (유통스타트 도매몰.html). 무채색 베이스 + 네이비 #0C2454 / 오렌지 #FC5424 액센트.
//   도매몰은 라이트 고정 B2B 서피스(대시보드 계열) — dark: variant 없음.
// ──────────────────────────────────────────────────────────────

/** UTONG START 브랜드 토큰 (2026-06-16 시안 정렬 — 딥네이비 #0C2454 + 오렌지 #FC5424).
 *  로고 리브랜딩에 맞춰 ink=네이비, brand=오렌지로 전환. WT 는 도매 surface SSOT → 전역 반영. */
export const WT = {
  ink: '#0C2454',   // 딥네이비 (강조 텍스트/주요 면·다크 바·헤딩) — UTONG START
  ink2: '#5E646C',  // 보조 텍스트
  ink3: '#8A929E',  // 캡션
  ink4: '#B6BCC4',  // 흐린 텍스트
  inkPink: '#FF8A5C', // 다크 배경 위 오렌지 액센트(가독 보정)
  line: '#ECEEF1',  // 라인 (최소 사용)
  line2: '#E7E9ED', // 카드/패널 보더 (시안 기본 보더)
  fill: '#F4F5F7',  // 섹션 배경
  fill2: '#F8F9FB', // 카드 내부 면
  trustBg: '#FAFBFC', // 신뢰 바 배경 (시안)
  brand: '#FC5424', // 오렌지 액센트 — 주 CTA/활성/핵심 단가에만
  brandSoft: '#FFEAE3',
  pos: '#11875A',   // 마진/이득
  posBg: '#EAF6EF',
  shCard: '0 1px 2px rgba(20,22,28,0.04), 0 12px 28px -16px rgba(20,22,28,0.14)',
  shSoft: '0 1px 3px rgba(20,22,28,0.06)',
  shUp: '0 -8px 24px -16px rgba(20,22,28,0.18)',
  shHover: '0 10px 22px rgba(20,24,31,0.08)', // 카드 hover (시안)
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
/** 🆕 2026-06-16 판매가(권장가) 대비 마진율 (%) — (판매가 − 공급가)/판매가. 신모델(보장마진) 표시 SSOT. */
export const marginVsRetail = (cost: number, retail: number) =>
  retail > 0 && retail > cost ? Math.round(((retail - cost) / retail) * 100) : 0

/** 등급 라벨 (코드 → 짧은 배지용) */
export const GRADE_LABEL: Record<string, string> = {
  A: 'A', B: 'B', C: 'C', D: 'D', OEM: 'OEM', SPECIAL: '특별가',
}

/**
 * 🏷️ 2026-06-15 (대표 모델 확정) 회원 등급명 — 일반 / 프로 / 프리미엄.
 *   엔진(distributor-pricing 코드 A/B/C)은 무변경, 표시명만 매핑 → 머니 로직 0 리스크.
 *   프리미엄 = A(일정 매출 달성, 최저 공급가) · 프로 = B(연 구독, 우대 공급가) · 일반 = C(승인 가입, 기본).
 *   D/OEM/특별가는 어드민 엣지 케이스로 라벨 유지.
 */
export const GRADE_NAME: Record<string, string> = {
  A: '프리미엄', B: '프로', C: '일반', D: 'D', OEM: 'OEM', SPECIAL: '특별가',
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
