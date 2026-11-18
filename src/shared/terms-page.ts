/**
 * ⚖️ 약관 문서(`pages/terms/TermsDocument.tsx`)의 **클래스 SSOT** (2026-11-18).
 *
 * 화면과 서버 첫 화면(`worker/utils/legal-first-screen.ts` — `/terms`)이 이 파일 하나를 읽는다. 문구는 문서 데이터
 * (`pages/terms/consumer-terms-content.ts` — 순수 데이터라 워커도 상대경로로 읽는다, 크롤러 본문 `crawler-noscript.ts` 선례).
 * 라이브 실측(폰 4G · CPU 4배): `/terms` 첫 그림 2.1~4.0s — 고정 문서인데 앱 코드가 다 와야 그려졌다.
 */
export const TERMS_CLS = {
  root: 'min-h-[100dvh] bg-white dark:bg-[#11141C] pb-20',
  header: 'sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#11141C]/90 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]',
  headerRow: 'ur-content-medium flex items-center justify-between px-5 py-3',
  back: 'text-gray-900 dark:text-white',
  backIcon: 'w-6 h-6',
  title: 'text-[16px] font-semibold text-gray-900 dark:text-white',
  spacer: 'w-6',
  content: 'ur-content-medium px-5 pt-6',
  effective: 'text-[12px] text-gray-400 dark:text-gray-500 mb-1',
  preamble: 'text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2',
  sections: 'mt-5',
  sectionRest: 'border-t border-gray-100 dark:border-[#2C2F35] pt-6 mt-6',
  chapter: 'text-[12px] font-medium tracking-wide text-gray-400 dark:text-gray-500 mb-3',
  h2: 'text-[15px] font-bold text-gray-900 dark:text-white mb-3',
  para: 'text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-3',
  items: 'list-decimal list-outside pl-5 space-y-2 text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed',
  footer: 'bg-gray-50 dark:bg-[#1D1F29] rounded-lg p-4 mt-8',
  footerText: 'text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed',
} as const

export const TERMS_COPY = { back: '뒤로 가기', effectiveLabel: '시행일: ', versionLabel: ' · 버전 ' } as const

/** 시행일 줄 — 화면과 서버가 같은 글자(`시행일: {effective} · 버전 {version}`). */
export function termsEffectiveLine(effective: string, version: string): string {
  return `${TERMS_COPY.effectiveLabel}${effective}${TERMS_COPY.versionLabel}${version}`
}
