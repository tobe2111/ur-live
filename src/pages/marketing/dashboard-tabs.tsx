import type { ReactNode } from 'react'

/**
 * 🗂️ 2026-07-27 유어애즈 대시보드 탭 SSOT (대표 "한 페이지에 다 몰아넣어 투박함" — 탭 재편).
 *   기존: 패널 18개를 한 스크롤에 나열 + 사이드바는 앵커 스크롤(모바일 네비 0).
 *   변경: 기능 그룹 7탭 — 사이드바/모바일 칩이 URL(?tab=)로 전환, 활성 탭 패널만 렌더.
 *   옛 앵커(#sec-*) 딥링크는 SEC_TO_TAB 으로 해당 탭에 자동 매핑(하위호환 — 온보딩/외부 링크 보존).
 */
export interface DashTab { id: string; label: string; desc: string; icon: ReactNode }

export const DASH_TABS: DashTab[] = [
  { id: 'home', label: '홈', desc: '요약 · 시작하기 · 바로가기', icon: <path d="M3 10.5L12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" /> },
  { id: 'keywords', label: '키워드', desc: '연관키워드 · 기회 발굴 · 포트폴리오', icon: <path d="M11 4.5a6.5 6.5 0 1 0 4.5 11.2M11 8v6M8 11h6M20 20l-4.2-4.2" /> },
  { id: 'performance', label: '광고 성과', desc: '계정 연동 · 실적 · 자동입찰 · 리포트', icon: <path d="M3 21h18M5 18v-7M10.3 18V6M15.6 18v-9" /> },
  { id: 'monitoring', label: '모니터링', desc: '쇼핑 순위 · 가격 · 알림 · 부정클릭', icon: <path d="M12 3l7 3v5c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6l7-3zM9 12l2 2 4-4" /> },
  { id: 'ai', label: 'AI 스튜디오', desc: '콘텐츠 생성 · AI 마케터 진단', icon: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3z" /> },
  { id: 'services', label: '서비스몰', desc: '대행 · 인플루언서 매칭 주문', icon: <path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 13h6" /> },
  { id: 'tools', label: '부가 도구', desc: '단축링크 · 인플루언서 발굴 · 발주수집', icon: <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6l-2.8 2.8-2.2-2.2 2.8-2.8z" /> },
]

/** 옛 섹션 앵커 → 탭 (온보딩 체크리스트·북마크·외부 딥링크 하위호환). */
export const SEC_TO_TAB: Record<string, string> = {
  'sec-keyword': 'keywords', 'sec-opportunity': 'keywords', 'sec-portfolio': 'keywords',
  'sec-trend': 'performance', 'sec-searchad': 'performance', 'sec-efficiency': 'performance', 'sec-autobid': 'performance', 'sec-report': 'performance',
  'sec-rank': 'monitoring', 'sec-price': 'monitoring', 'sec-alerts': 'monitoring', 'sec-fraud': 'monitoring',
  'sec-content': 'ai', 'sec-ai': 'ai',
  'sec-services': 'services',
  'sec-links': 'tools', 'sec-influencers': 'tools', 'sec-matching': 'tools', 'sec-store': 'tools',
}

// 공용 스타일(추출 섹션들과 페이지가 공유 — 카드/입력 톤 일관)
export const CARD_CLS = 'rounded-2xl border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] p-4'
export const INPUT_CLS = 'w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'
