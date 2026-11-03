/**
 * 🏠 2026-11-03 대표 *"홈 페이지에서 윗부분 동탄5동, 전체, 식사, 미용, 숙소 등등, 로고 전체적으로 그 부분이 되게 느려 처음에"*
 *
 * 홈 맨 위(로고 줄 · 위치 줄)를 **서버 첫 화면이 화면과 같은 마크업으로** 그리려고 둔 정적 조각.
 * 종전 서버 첫 화면은 로고 줄을 빈 상자로, 동네 이름을 공백(`&nbsp;`)으로 두었다 — 앱이 부팅해야(폰에서 1~3초) 채워졌다.
 *
 * 🔒 아래 문자열은 **리액트 부품을 그대로 렌더한 결과**다(`renderToStaticMarkup`) — 손으로 고치지 말 것.
 *   시험(`home-top-row-ssr-2026-11-03.test.tsx`)이 매번 부품을 다시 렌더해 글자 단위로 대조한다.
 *   부품(로고·아이콘)이 바뀌면 시험이 빨개지고, 그 시험이 출력하는 새 문자열로 여기를 바꾸면 된다.
 *   갈리면 앱이 서버 마크업을 갈아 끼우는 순간 맨 위가 한 번 깜빡인다.
 */
/** `<UrDealLogo size={17} />` */
export const HOME_TOP_LOGO = '<span aria-label="urdeal — 유어딜" class="inline-flex items-baseline select-none text-[#16181C] dark:text-[#F8F7FC] " style="font-family:&#x27;Poppins&#x27;, system-ui, sans-serif;font-weight:700;font-size:17px;letter-spacing:-0.035em;line-height:1">urdeal<span aria-hidden="true" class="bg-brand" style="display:inline-block;width:3.06px;height:3.06px;border-radius:50%;margin-left:1.36px"></span></span>'
/** `<Search className="h-[21px] w-[21px]" strokeWidth={1.6} fill="none" />` */
export const HOME_TOP_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search h-[21px] w-[21px]"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>'
/** `<BellIcon className="h-[21px] w-[21px]" filled={false} />` */
export const HOME_TOP_BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="24" height="24" class="h-[21px] w-[21px]"><path d="M18 9.4a6 6 0 1 0-12 0c0 4-1.6 5.6-1.6 5.6h15.2S18 13.4 18 9.4z" fill="none"></path><path d="M10.2 18.2a2 2 0 0 0 3.6 0"></path></svg>'
/** `<BagIcon className="h-[21px] w-[21px]" filled={false} />` */
export const HOME_TOP_BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="24" height="24" class="h-[21px] w-[21px]"><path d="M5.2 7.8h13.6l-1.1 12H6.3z" fill="none"></path><path d="M8.9 9.8V6.9a3.1 3.1 0 0 1 6.2 0v2.9" stroke="currentColor"></path></svg>'
/** 위치 줄(title) 화살표 — `PcHomeLocationBar` 의 `<ChevronDown className={`${t.chevron} transition-transform ${open ? 'rotate-180' : ''}`} />`(닫힘) */
export const HOME_TOP_CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down w-5 h-5 text-gray-600 dark:text-gray-300 shrink-0 transition-transform "><path d="m6 9 6 6 6-6"></path></svg>'
/** 위치 줄(title) 현위치 버튼 아이콘 — `<LocateFixed className="w-[15px] h-[15px]" />` */
export const HOME_TOP_LOCATE = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-locate-fixed w-[15px] h-[15px]"><line x1="2" x2="5" y1="12" y2="12"></line><line x1="19" x2="22" y1="12" y2="12"></line><line x1="12" x2="12" y1="2" y2="5"></line><line x1="12" x2="12" y1="19" y2="22"></line><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle></svg>'
