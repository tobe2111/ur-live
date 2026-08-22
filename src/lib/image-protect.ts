/**
 * 🖼️ 사진 저장 방지 (2026-08-22 대표 지시 — "사진 저장을 위한 오른쪽 마우스 클릭이 안되게끔")
 *
 * ⚠️ 먼저 솔직하게: **이것은 억제이지 보호가 아니다.** 브라우저에 그려진 이미지는 URL 이
 *    있으므로 개발자도구·주소창·`curl` 로 언제든 받을 수 있다. 이 모듈이 실제로 막는 것은
 *    "우클릭 → 이미지를 다른 이름으로 저장" · "바탕화면으로 드래그" · iOS "길게 눌러 저장"
 *    이라는 **손쉬운 경로**뿐이다. 진짜 방어선은 서버쪽 짝이다:
 *      · `bot-detection.ts` scrapeProtection() — 수확 봇 403
 *      · `cf-image.ts` HOTLINK_BLOCKED_HOSTS — 외부 도메인 핫링크
 *    그래서 이 파일만 지우면 억제가 사라질 뿐 아니라 **서버쪽이 있으니 괜찮다고 착각**하기 쉽다.
 *
 * 설계 원칙(이걸 어기면 사용자를 다치게 한다):
 *   ① **이미지에서만** 우클릭을 막는다. 페이지 전체 `contextmenu` 차단은 주소 복사·
 *      새 탭으로 열기·맞춤법 검사까지 죽여서, 훔치는 사람은 못 막고 사는 사람만 불편해진다.
 *   ② **입력 요소는 절대 건드리지 않는다**(input/textarea/contenteditable) — 붙여넣기 메뉴가
 *      사라지면 주소·쿠폰코드 입력이 지옥이 된다.
 *   ③ **대시보드는 제외**(어드민/셀러/에이전시/도매) — 운영자는 상품 사진을 실제로
 *      저장·교체해야 한다. 소비자 표면에서만 건다.
 *   ④ 텍스트 선택은 막지 않는다 — 매장 주소·전화번호를 복사하는 것이 정상 사용이다.
 */

/** 대시보드 = 제외. 운영자는 사진을 저장해야 한다. */
const EXEMPT_PREFIXES = ['/admin', '/seller', '/agency', '/supplier', '/wholesale']

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/** 입력 중인 요소인가 — 여기서는 브라우저 기본 메뉴가 반드시 살아 있어야 한다. */
function isEditable(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return !!(el as HTMLElement).isContentEditable
}

/**
 * 이 요소가 "사진"인가. `<img>` 뿐 아니라 **CSS 배경으로 그린 사진**도 포함한다 —
 * 이 레포는 카드 커버를 background-image 로 그리는 곳이 많아서, `<img>` 만 보면
 * 정작 훔치기 쉬운 큰 사진들이 그대로 열린다.
 */
function isImageTarget(el: Element | null): boolean {
  if (!el) return false
  if (el.tagName === 'IMG' || el.tagName === 'PICTURE' || el.tagName === 'CANVAS') return true
  try {
    const bg = getComputedStyle(el as HTMLElement).backgroundImage
    if (bg && bg !== 'none' && bg.includes('url(')) return true
  } catch {
    /* getComputedStyle 은 분리된 노드에서 던질 수 있다 — 그건 사진이 아니다 */
  }
  return false
}

/** 클릭 지점부터 위로 몇 단계만 훑는다(전체 조상 탐색은 스크롤 중 비싸다). */
function imageAtEvent(target: EventTarget | null): boolean {
  let el = target as Element | null
  for (let i = 0; el && i < 4; i++) {
    if (isEditable(el)) return false
    if (isImageTarget(el)) return true
    el = el.parentElement
  }
  return false
}

let installed = false

/** 문서 레벨 리스너 1쌍만 건다(요소마다 거는 것은 카드 수백 개에서 비싸다). */
export function installImageProtection(): void {
  if (installed || typeof document === 'undefined') return
  installed = true

  document.addEventListener(
    'contextmenu',
    (e) => {
      if (isExemptPath(location.pathname)) return
      if (isEditable(e.target as Element)) return
      if (!imageAtEvent(e.target)) return
      e.preventDefault()
    },
    { capture: true },
  )

  // 드래그로 바탕화면·다른 탭에 떨구는 경로. 이미지에만 건다(텍스트 드래그는 정상 사용).
  document.addEventListener(
    'dragstart',
    (e) => {
      if (isExemptPath(location.pathname)) return
      if (!imageAtEvent(e.target)) return
      e.preventDefault()
    },
    { capture: true },
  )
}
