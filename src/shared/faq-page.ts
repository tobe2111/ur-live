/**
 * ❓ 자주 묻는 질문(`/faq`)의 **클래스·문구 SSOT** (2026-11-10 — 라이브 폰 첫 그림 2.9s · HTML 0.3~0.5s).
 *
 * 화면(`pages/FAQPage.tsx`)과 서버 첫 화면(`worker/utils/faq-first-screen.ts`)이 이 파일 하나를 읽는다.
 * 질문 목록은 `shared/seo/concept-content.ts` `CONCEPT_FAQ`(구조화 데이터·크롤러 본문과 같은 배열) 그대로다.
 * 문구는 화면이 `t(key, { defaultValue })` 로 쓴다(다국어 유지).
 */
export const FAQ_CLS = {
  content: 'ur-content-medium px-5 lg:px-8 pt-4 pb-20',
  hero: 'mb-5',
  heroRow: 'flex items-center gap-2 mb-2',
  heroIcon: 'w-5 h-5 text-gray-900 dark:text-white',
  heroTitle: 'text-[15px] font-bold text-gray-900 dark:text-white',
  heroDesc: 'text-[13px] text-gray-500 dark:text-gray-400',
  search: 'relative mb-5',
  searchIcon: 'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500',
  searchInput: 'w-full pl-9 pr-4 py-3 bg-gray-100 dark:bg-[#1D1F29] rounded-xl text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-[#11141C] focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all',
  chips: 'flex gap-2 mb-5 overflow-x-auto scrollbar-hide -mx-1 px-1',
  chip: 'px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-all',
  chipOn: 'bg-brand text-white',
  chipOff: 'bg-gray-100 dark:bg-[#1D1F29] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2C2F35]',
  list: 'border-t border-gray-100 dark:border-[#2C2F35]',
  item: 'border-b border-gray-100 dark:border-[#2C2F35]',
  q: 'w-full py-4 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-[#1D1F29] transition-colors -mx-4 px-4',
  qBadge: 'shrink-0 w-6 h-6 rounded-full bg-brand text-white text-[12px] font-medium flex items-center justify-center mt-1',
  qText: 'flex-1 min-w-0',
  qCat: 'text-[12px] text-gray-500 dark:text-gray-400 font-medium mb-1',
  qTitle: 'text-[15px] font-medium text-gray-900 dark:text-white leading-snug',
  qChev: 'shrink-0 w-4 h-4 text-gray-400 dark:text-gray-500 mt-1 transition-transform',
  aInner: 'pb-4 pl-9 pr-4 -mt-1',
  aText: 'text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line',
  support: 'mt-8 bg-gray-50 dark:bg-[#1D1F29] rounded-2xl p-5',
  supportTitle: 'text-[15px] font-bold text-gray-900 dark:text-white mb-1',
  supportDesc: 'text-[12px] text-gray-500 dark:text-gray-400 mb-5',
  supportRows: 'space-y-2',
  supportRow: 'flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-200',
  supportIcon: 'w-3.5 h-3.5 text-gray-400 dark:text-gray-500',
  supportLabel: 'text-gray-500 dark:text-gray-400 w-16',
  supportValue: 'font-medium text-gray-900 dark:text-white',
} as const

export const FAQ_COPY = {
  title: '자주 묻는 질문',
  catAll: '전체',
  heroTitle: '무엇을 도와드릴까요?',
  heroDesc: '궁금한 내용을 빠르게 찾아보세요.',
  searchPlaceholder: '궁금한 내용을 검색해보세요',
  badge: 'Q',
  supportTitle: '도움이 더 필요하신가요?',
  supportDesc: '궁금한 사항이 해결되지 않았다면 연락주세요.',
  supportHours: '운영시간',
  supportHoursValue: '평일 09:00 - 18:00',
  supportEmail: '이메일',
  /** 고객센터 주소 — 종전 화면 문구 그대로(값은 FAQPage 에서 옮겨 왔다). */
  supportEmailValue: 'urteam.corp@gmail.com',
} as const
