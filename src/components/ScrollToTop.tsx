import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// 🛡️ 2026-05-20: location state 에 { preserveScroll: true } 가 있으면 스크롤 리셋 skip.
//   사용자 신고: 사이드바 하단 버튼 누르면 페이지 위로 튀어서 헷갈림.
//   `<Link state={{ preserveScroll: true }}>` 로 옵트아웃 가능.
type PreserveScrollState = { preserveScroll?: boolean } | null

/**
 * 페이지 전환 시 스크롤 관리 — PUSH/REPLACE 는 상단으로, POP(뒤로/앞으로)은 **있던 자리로**.
 *
 * ## 🩸 2026-09-01 대표 신고 — "어떠한 페이지든 무조건" 맨 위로 튄다
 * 복원 로직은 2026-07-02 부터 **있었는데도** 한 번도 동작하지 않았다. 실측(로컬 빌드 · 홈/숙소
 * 3표면): 수정 전 **0/3**, 수정 후 **3/3**.
 *
 * ### 원인 — 저장된 자리가 0 으로 덮어써지고 있었다
 * 떠나는 순간 이 페이지의 scroll 리스너가 **아직 붙어 있는 채로** 0 을 받아 적었다.
 * 라우터 상태가 바뀌고 DOM 이 교체되는 사이, 옛 키(`/`)로 `set('/', 0)` 이 일어난다.
 * 그러면 복귀 시 `saved > 0` 이 거짓 → "저장된 자리 없음" 폴백 → 맨 위.
 *
 * ### 고친 것은 **키 검사 하나**다 (귀속 검증함)
 * `currentKeyRef` 를 **렌더 중에** 갱신하고, 리스너가 자기 키와 다르면 쓰지 않는다.
 * 렌더는 DOM 교체보다 먼저라, 떠난 뒤 도착한 이벤트는 전부 걸러진다.
 *
 * ⚠️ 아래 셋은 **각각 되돌려도 3/3 통과**했다 — 즉 이번 사고의 원인이 **아니다.** 정합성·내구성
 *   보강일 뿐이니, 나중에 누가 "이게 그 수리"라고 오해하지 말 것:
 *     · cleanup 저장 제거(있어도 위 키 검사가 막는다)  · `sessionStorage` 영속  · 복원 예산 3s
 *
 * ## 🕳️ 이 버그를 두 번 오진할 뻔했다 — 하네스 함정
 * 처음 재현 스크립트가 **화면 밖 카드**를 클릭했다. 그러면 Playwright 가 **먼저 스크롤해서**
 * 요소를 보이게 만든다 — 즉 앱이 아니라 **테스트가** 위치를 0 으로 바꿔 놓고, 나는 그걸 앱의
 * 증상으로 읽어 엉뚱한 기전(높이 붕괴)을 확신하고 있었다. 재현은 **뷰포트 안의 링크**를 눌러야 한다.
 *
 * ## 내부 스크롤 영역도 덮는다 — `data-scroll-restore="<이름>"`
 * 문서가 아니라 **컨테이너**가 스크롤되는 화면이 있다(`/map` 의 바텀시트 목록이 그렇다 —
 * 2026-09-01 전수 실측에서 유일하게 남은 구멍이었다). 그런 요소에 이 속성을 달아 두면
 * 문서 스크롤과 **똑같이** 저장·복원된다. 새 화면도 속성 한 줄이면 끝이고, 안 단 화면은
 * 아무 일도 일어나지 않는다(옵트인이라 오작동 위험 없음).
 *
 * ## 이 파일이 **못 하는 것**(정직하게)
 * - `data-scroll-restore` 를 안 단 내부 스크롤 영역. 자동 탐지는 하지 않는다 — 모달·캐러셀·
 *   가로 스크롤까지 건드려 되레 화면을 흔든다.
 * - 뒤로 왔을 때 목록이 **더 짧아진 경우**(필터가 바뀌었다 등)는 갈 수 있는 데까지만 간다.
 */
/** 저장소 — sessionStorage(탭 한정). 실패해도 조용히 메모리로 폴백한다(사파리 프라이빗 등). */
const MEM = new Map<string, number>()
const SS_KEY = 'ur_scroll_pos_v1'

function readAll(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(SS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return Object.fromEntries(MEM)
  }
}

function writePos(key: string, y: number) {
  MEM.set(key, y)
  try {
    const all = readAll()
    all[key] = y
    // 히스토리 항목은 계속 늘어난다 — 최근 40개만 유지(오래된 항목은 되돌아갈 일이 거의 없다).
    const keys = Object.keys(all)
    if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete all[k]
    sessionStorage.setItem(SS_KEY, JSON.stringify(all))
  } catch { /* 저장 불가 환경 — 메모리만으로 동작 */ }
}

function readPos(key: string): number | undefined {
  const v = readAll()[key]
  return typeof v === 'number' ? v : MEM.get(key)
}

/** 복원 대상 내부 스크롤 영역 — 옵트인(`data-scroll-restore="<이름>"`)만. */
const RESTORE_SEL = '[data-scroll-restore]'
const panesOf = () => Array.from(document.querySelectorAll<HTMLElement>(RESTORE_SEL))
const paneKey = (entryKey: string, el: HTMLElement) => `${entryKey}#${el.dataset.scrollRestore || ''}`

export default function ScrollToTop() {
  const { pathname, search, state, key } = useLocation()
  const navType = useNavigationType()
  const preserveScroll = !!(state as PreserveScrollState)?.preserveScroll

  // 히스토리 항목 단위 키. 초기 진입은 key='default' 라 경로로 대체한다.
  const entryKey = key && key !== 'default' ? `k:${key}` : `p:${pathname}${search}`
  const currentKeyRef = useRef(entryKey)

  // 🔑 **렌더 중에** 갱신한다. effect(layout 포함)로 미루면 늦다 — 라우터 상태가 바뀐 뒤 DOM 이
  //   교체되고, 그 사이에 도착한 scroll 이벤트가 **아직 옛 키로** 0 을 덮어썼다(2026-09-01 실측:
  //   `{"p:/":0}` · scrollY=0 · docH=8332 — 문서는 멀쩡한데 위치만 0). 렌더는 mutation 보다
  //   먼저이므로 여기서 갱신하면 그 창이 닫힌다. 순수 대입이라 부작용 없음.
  currentKeyRef.current = entryKey

  // 브라우저 기본 복원(auto)은 SPA 비동기 콘텐츠에서 오작동하며 아래 수동 복원과 충돌한다.
  useEffect(() => {
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
  }, [])

  // 현재 위치 저장 — **scroll 이벤트에서만**. cleanup 에서는 저장하지 않는다(위 주석의 사고).
  useEffect(() => {
    const keyAtAttach = entryKey
    const onScroll = (e: Event) => {
      if (currentKeyRef.current !== keyAtAttach) return // 이미 떠난 페이지의 뒤늦은 이벤트
      const t = e.target
      if (t instanceof HTMLElement && t.matches(RESTORE_SEL)) { writePos(paneKey(keyAtAttach, t), t.scrollTop); return }
      if (t === document || t === document.documentElement || t === window) writePos(keyAtAttach, window.scrollY)
    }
    // ⚠️ capture 로 듣는다 — scroll 이벤트는 **버블하지 않아서** window 리스너로는 컨테이너 스크롤을 못 받는다.
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions)
  }, [entryKey])

  // 페이지 전환 시 스크롤 조정
  useEffect(() => {
    if (preserveScroll) return
    if (navType === 'POP') {
      const saved = readPos(entryKey)
      // 내부 스크롤 영역은 문서가 안 움직였어도 복원해야 한다 — 둘 중 하나라도 있으면 루프를 돈다.
      const panesPending = () => panesOf().some((el) => (readPos(paneKey(entryKey, el)) || 0) > 0)
      if ((saved && saved > 0) || panesPending()) {
        // 복귀 순간엔 콘텐츠가 아직 짧아 목표까지 못 간다(리스트는 비동기 로드).
        // 높이가 자랄 때까지 프레임마다 재시도하되, **사용자가 직접 스크롤하면 즉시 손을 뗀다**.
        let raf = 0
        let done = false
        const started = performance.now()
        const stop = () => { done = true; cancelAnimationFrame(raf); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop) }
        window.addEventListener('wheel', stop, { passive: true, once: true })
        window.addEventListener('touchstart', stop, { passive: true, once: true })
        const tryRestore = () => {
          if (done) return
          let short = false
          if (saved && saved > 0) {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight
            window.scrollTo({ top: Math.min(saved, Math.max(0, maxScroll)), left: 0, behavior: 'instant' as ScrollBehavior })
            if (maxScroll < saved - 2) short = true
          }
          for (const el of panesOf()) {
            const want = readPos(paneKey(entryKey, el)) || 0
            if (want <= 0) continue
            const max = el.scrollHeight - el.clientHeight
            el.scrollTop = Math.min(want, Math.max(0, max))
            if (max < want - 2) short = true
          }
          // 목표에 닿았거나 시간이 다 되면 그만. 3s 는 이 레포의 콜드 리스트 로딩 실측 상한이다.
          if (short && performance.now() - started < 3000) raf = requestAnimationFrame(tryRestore)
          else stop()
        }
        raf = requestAnimationFrame(tryRestore)
        return stop
      }
    }
    // 새 페이지(PUSH/REPLACE) 또는 저장된 자리 없음 — 상단으로
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [entryKey, navType, preserveScroll])

  return null
}
