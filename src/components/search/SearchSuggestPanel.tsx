/**
 * 🔎 **검색 제안 패널** — 결과 위에 뜨는 카드가 아니라, 결과 **자리**에 들어서는 목록 (2026-09-30)
 *
 * 대표: *"검색하는데 연관검색? 처럼 나오는거 별로야"* + 레퍼런스 화면(전체폭 행 목록) → *"이런 식으로 나오는거 좋다"*
 *
 * ## 무엇이 문제였나 — 두 가지가 겹쳤다
 *  ① **떠 있는 카드가 결과를 가렸다.** 검색어를 치는 동안 둥근 카드가 결과 위를 덮어, 정작 찾던
 *     첫 줄이 안 보였다(대표 스크린샷에서 제안 하나가 첫 결과를 통째로 가리고 있었다).
 *  ② **제안이 결과의 복사본이었다.** 서버가 `products.name` 통짜를 줘서, "돈가스" 를 치면 제안이
 *     *"홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트"* 이고 **바로 아래 첫 결과가 같은 문자열**이었다.
 *     ②는 서버에서 고쳤다(인기 검색어 → 매장명 → 상품명 순 · `products.routes.ts /suggestions`).
 *     여기는 ①을 고친다 — **덮지 않고 대신한다.**
 *
 * ## 🔴 닫힘을 blur 에 걸지 않는다
 * 모바일에서 행을 탭하면 `blur` 가 먼저 나고, 패널이 사라진 뒤에야 `click` 이 온다 — 그래서
 * **아무 일도 안 일어난다**(자동완성에서 가장 흔한 버그). ⇒ 닫는 건 *선택·제출·지움* 셋뿐이다.
 * 패널이 결과를 덮지 않으므로 "닫아서 뒤를 봐야 하는" 경우 자체가 없다.
 */
import { Search } from 'lucide-react'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 10차 ① — 새로 생긴 제안 줄만 위에서부터 한 줄씩 내려온다(글자를 더 쳐서 남는 줄은 그대로 — key 가 글자다).
injectMotionCss('ur-m-sug', `@keyframes ur-sug-in { from { opacity: 0; transform: translateY(-6px); } }.ur-sug-in { animation: ur-sug-in .26s cubic-bezier(.2,.9,.3,1) backwards; animation-delay: calc(var(--si, 0) * 40ms); }@media (prefers-reduced-motion: reduce){.ur-sug-in{animation:none!important}}`)

/** 친 글자를 굵게 — "내가 친 것 + 이어지는 말" 로 읽히게. */
function Marked({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <span className="font-medium text-gray-700 dark:text-gray-200">{text}</span>
  return (
    <span className="font-medium text-gray-600 dark:text-gray-300">
      {text.slice(0, i)}
      <span className="font-bold text-gray-900 dark:text-white">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </span>
  )
}

export interface SearchSuggestPanelProps {
  /** 지금 입력창에 있는 글자 — 굵게 칠할 부분. */
  query: string
  suggestions: string[]
  onPick: (text: string) => void
}

export default function SearchSuggestPanel({ query, suggestions, onPick }: SearchSuggestPanelProps) {
  if (suggestions.length === 0) return null
  return (
    <ul className="ur-content-wide px-1 lg:px-5 py-1" role="listbox" aria-label="검색 제안">
      {suggestions.map((text, i) => (
        <li key={text} className="ur-sug-in" style={{ '--si': Math.min(i, 7) } as React.CSSProperties}>
          <button
            type="button"
            role="option"
            aria-selected={false}
            /* 🔴 mousedown 에서 포커스 이동을 막는다 — 안 막으면 blur 로 화면이 흔들린다.
                  (닫힘 자체는 blur 에 안 걸려 있지만, 입력창이 포커스를 잃으면 키보드가 내려간다.) */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(text)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:bg-wash transition-colors"
          >
            <span className="shrink-0 w-9 h-9 rounded-full bg-wash flex items-center justify-center">
              <Search className="w-[17px] h-[17px] text-gray-400 dark:text-gray-500" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px]">
              <Marked text={text} q={query} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
