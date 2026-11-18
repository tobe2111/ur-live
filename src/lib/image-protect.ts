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
 * 🖱️ 2026-11-18 대표 지시 — *"오른쪽 마우스 금지하게끔 해줄래? 우리 사이트를 카피할 수 있는 요소들을 최대한 없애고 싶어"*.
 *   ⇒ 우클릭은 이제 **소비자 화면 전체**에서 막는다(종전: 사진 위에서만). 소스 보기·저장·개발자도구 단축키도 막는다.
 *   이것도 **억제**다 — 브라우저 메뉴로 개발자도구를 열거나 주소 앞에 `view-source:` 를 붙이는 것은 못 막는다.
 *   사이트를 통째로 베끼는 가장 쉬운 길은 화면이 아니라 **공개된 코드 저장소**다(그건 이 파일 밖의 일이다).
 *
 * 설계 원칙(이걸 어기면 사용자를 다치게 한다):
 *   ① 우클릭은 소비자 화면 전체에서 막되(2026-11-18), **입력 요소만은 예외**다(②).
 *   ② **입력 요소는 절대 건드리지 않는다**(input/textarea/contenteditable) — 붙여넣기 메뉴가
 *      사라지면 주소·쿠폰코드 입력이 지옥이 된다.
 *   ③ **대시보드는 제외**(어드민/셀러/에이전시/도매) — 운영자는 상품 사진을 실제로
 *      저장·교체해야 한다. 소비자 표면에서만 건다.
 *   ④ 🔁 2026-11-18 대표 *"3번만 해줘. 복사 버튼 두면 되겠네"* — 글자 선택·복사도 소비자 화면에서 막는다.
 *      종전("텍스트 선택은 막지 않는다 — 주소·전화번호 복사가 정상 사용")의 걱정은 **복사 버튼**으로 푼다:
 *      복사가 필요한 값(매장 주소·전화번호·이용권 번호) 옆에 `CopyTextButton` 을 두거나, 그 요소에
 *      `data-allow-copy` 를 붙이면 선택이 다시 열린다. 막기만 하고 버튼을 안 두면 사는 사람만 불편해진다.
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

/** 이 자리에서 우클릭 메뉴를 막는가 — 소비자 화면이고 입력 중이 아니면 막는다(순수 판정). */
export function shouldBlockContextMenu(pathname: string, target: Element | null): boolean {
  if (isExemptPath(pathname)) return false
  let el = target
  for (let i = 0; el && i < 4; i++) {
    if (isEditable(el)) return false
    el = el.parentElement
  }
  return true
}

/** 이 요소(또는 가까운 조상)가 복사를 **허용**하는 자리인가 — 입력 칸이거나 `data-allow-copy` 가 붙었다. */
function allowsCopy(target: Element | null): boolean {
  let el = target
  for (let i = 0; el && i < 6; i++) {
    if (isEditable(el)) return true
    if (typeof el.hasAttribute === 'function' && el.hasAttribute('data-allow-copy')) return true
    el = el.parentElement
  }
  return false
}

/** 이 자리에서 글자 선택·복사를 막는가 — 소비자 화면이고, 입력 칸·`data-allow-copy` 가 아니면 막는다(순수 판정). */
export function shouldBlockSelect(pathname: string, target: Element | null): boolean {
  if (isExemptPath(pathname)) return false
  return !allowsCopy(target)
}

/** `<html data-nocopy>` — CSS 짝(index.css)이 이 표식으로 글자 선택을 끈다. 대시보드에서는 뗀다. */
function syncNoCopyFlag(): void {
  try {
    document.documentElement.toggleAttribute('data-nocopy', !isExemptPath(location.pathname))
  } catch { /* 문서가 없는 환경 */ }
}

/**
 * 소스 보기·페이지 저장·개발자도구를 여는 단축키인가(순수 판정).
 *   F12 · Ctrl/⌘+U(소스) · Ctrl/⌘+S(저장) · Ctrl+Shift+I/J/C · ⌘+⌥+I/J/C/U
 * ⚠️ 복사(Ctrl+C)·붙여넣기·새로고침·뒤로 가기·찾기는 **절대 넣지 않는다** — 그건 사는 사람이 쓰는 키다.
 */
export function isBlockedShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  const k = String(e.key || '').toLowerCase()
  if (k === 'f12') return true
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return false
  if (!e.shiftKey && !e.altKey && (k === 'u' || k === 's')) return true
  if (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) return true
  if (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c' || k === 'u')) return true
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
      if (!shouldBlockContextMenu(location.pathname, e.target as Element)) return
      e.preventDefault()
    },
    { capture: true },
  )

  // 글자 선택·복사 — 소비자 화면에서만, 입력 칸·`data-allow-copy` 는 예외. 텍스트 노드에서 시작하면 부모 요소로 본다.
  const elOf = (t: EventTarget | null): Element | null => {
    const n = t as Node | null
    return n && n.nodeType === 3 ? n.parentElement : (n as Element | null)
  }
  for (const type of ['selectstart', 'copy', 'cut'] as const) {
    document.addEventListener(type, (e) => {
      if (!shouldBlockSelect(location.pathname, elOf(e.target))) return
      e.preventDefault()
    }, { capture: true })
  }
  // CSS 짝의 표식 — 앱 안 이동(주소만 바뀜)에도 맞게, 손이 닿는 순간마다 다시 맞춘다(속성 하나라 비용 0).
  syncNoCopyFlag()
  for (const type of ['pointerdown', 'touchstart'] as const) {
    document.addEventListener(type, syncNoCopyFlag, { capture: true, passive: true })
  }

  // 소스 보기·저장·개발자도구 단축키(소비자 화면에서만 — 운영자는 대시보드에서 개발자도구를 쓴다).
  document.addEventListener(
    'keydown',
    (e) => {
      if (isExemptPath(location.pathname)) return
      if (!isBlockedShortcut(e)) return
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
