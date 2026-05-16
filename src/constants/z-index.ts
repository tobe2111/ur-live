/**
 * 🛡️ 2026-05-16: z-index 단일 source.
 *
 * 이전엔 컴포넌트마다 z-30 / z-50 / z-[9999] / z-[10001] 등 충돌.
 * 사고 #1: GroupBuyDetailPage 의 결제 footer (z-30) 가 BottomNav (z-9999) 뒤에 가려져
 *          사용자가 결제 버튼 안 보임 → 매출 누수.
 *
 * 정책:
 *   - 일반 sticky/floating element: BASE_STICKY 계열
 *   - BottomNav (모바일 하단 고정): NAVIGATION_BOTTOM
 *   - 결제/구매 sticky footer: PURCHASE_BAR  ← BottomNav 보다 위
 *   - 모달 / sheet 백드롭: MODAL_BACKDROP
 *   - 모달 / sheet 본체: MODAL_BODY
 *   - 토스트: TOAST  ← 모든 위에
 *   - 최상위 (urgent error / debug): SYSTEM_CRITICAL
 *
 * 사용 예:
 *   import { Z } from '@/constants/z-index'
 *   <div style={{ zIndex: Z.PURCHASE_BAR }}>...</div>
 *   <footer className={`fixed bottom-0 z-[${Z.PURCHASE_BAR}]`}>...</footer>
 */

export const Z = {
  /** 일반 sticky header (페이지 상단 chrome) */
  BASE_STICKY: 30,
  /** 사이드바 / drawer 오버레이 */
  SIDE_OVERLAY: 40,
  /** 페이지 내 floating 액션 버튼 */
  FAB: 100,
  /** 모바일 하단 네비게이션 (홈/라이브/검색 etc.) */
  NAVIGATION_BOTTOM: 9999,
  /** 결제/구매 sticky bar — BottomNav 위에 위치해야 함 */
  PURCHASE_BAR: 10002,
  /** 모달 백드롭 */
  MODAL_BACKDROP: 10500,
  /** 모달 본체 */
  MODAL_BODY: 10501,
  /** 시트 (bottom sheet) 백드롭 */
  SHEET_BACKDROP: 10600,
  /** 시트 본체 */
  SHEET_BODY: 10601,
  /** 토스트 / 알림 */
  TOAST: 20000,
  /** 시스템 크리티컬 (error boundary, debug) */
  SYSTEM_CRITICAL: 99999,
} as const

export type ZIndex = typeof Z[keyof typeof Z]
