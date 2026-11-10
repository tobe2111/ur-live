/**
 * 🔔 알림(`/notifications`)의 **클래스·문구 SSOT** (2026-11-10 — 라이브 폰 첫 그림 1.7~2.3s · HTML 0.3~0.5s).
 *
 * 화면(`pages/NotificationsPage.tsx`)과 서버 첫 화면(`worker/utils/notifications-first-screen.ts`)이 이 파일 하나를 읽는다.
 * 서버는 **세션 쿠키가 있을 때만** 머리줄 + 목록 칸(로더)을 그린다 — 비로그인은 앱이 로그인으로 보내므로 그릴 것이 없다.
 * 문구는 화면이 `t(key, { defaultValue })` 로 쓴다(다국어 유지 · 한국어 기본값은 번역 파일과 같다).
 */
import { SUB_PAGE_CLS } from './sub-page-head'

export const NOTIF_CLS = {
  root: `${SUB_PAGE_CLS} pb-safe-nav md:pb-20`,
  markAll: 'text-[13px] font-medium text-brand-text whitespace-nowrap',
  wrap: 'relative',
  /** 당겨서 새로고침 동그라미 — 평소엔 투명(opacity-0). 서버도 같은 자리에 둔다(마운트 때 DOM 모양이 같게). */
  pullInd: 'absolute left-1/2 top-1 -ml-4 w-8 h-8 rounded-full bg-surface shadow-lift flex items-center justify-center opacity-0 pointer-events-none z-10',
  pullIcon: 'w-4 h-4 text-brand-text',
  list: 'ur-content-narrow px-5 lg:px-8 py-2',
} as const

export const NOTIF_COPY = {
  title: '알림',
  back: '뒤로 가기',
  markAllRead: '모두 읽음',
} as const

/** 당겨서 새로고침 화살표 path — 서버와 앱이 같은 그림. */
export const NOTIF_PULL_PATH = 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'
