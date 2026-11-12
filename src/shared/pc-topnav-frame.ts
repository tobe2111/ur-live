/**
 * 🖥️ 상단 네비 틀 — 따로 뗀 이유: 상품 상세 첫 화면이 `shared/pc-home-first-screen` 을 import 하는데, 거기서 메뉴 클래스 파일
 *   (`pc-topnav-first.ts`)까지 따라오면 상세 표면 critical CSS 가 상한(40KB)을 넘는다(2026-11-12 빌드 실측 40,738B).
 */
/** 상단 네비 **틀**(배경·경계선·두 줄 높이) — PC 홈·교환권 상세 첫 화면이 같이 쓴다. `PC_HOME_FS.topnav*` 가 이것을 가리킨다. */
export const PC_TOPNAV_FRAME = {
  outer: 'hidden md:block bg-white/95 dark:bg-[#11141C]/95 border-b border-gray-100 dark:border-[#2C2F35]',
  row1: 'h-[68px]',
  row2: 'border-t border-gray-100 dark:border-[#2C2F35] h-11',
} as const
