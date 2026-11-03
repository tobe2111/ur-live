/**
 * ← 손님 화면 뒤로가기 한 벌 (2026-11-03 대표 *"페이지 이동이 지금 이상적인지 봐줘 특히 뒤로가기"*).
 *
 * ## 🩸 무엇이 틀렸나 (라이브 실측 2026-11-03, 아이폰 크기 · 익명)
 * 카톡으로 받은 링크처럼 **주소로 바로 들어온** 화면에서 머리줄 ← 를 누르면 **앱 밖으로 나갔다**
 * — 이용권 상세 `/pass/:id` · 숙소 상세 · 지도 · 쇼츠 · 약관·환불·개인정보 · 제휴 문의, 잰 9곳 전부.
 * 화면마다 `navigate(-1)` 을 손으로 적었기 때문이다. 이력이 없으면 `-1` 은 브라우저 뒤로와 같아서
 * 카톡 인앱 브라우저면 창이 닫히고, 새 탭이면 빈 화면이 된다. 공유 링크가 손님이 가장 많이 들어오는
 * 문인데, 거기서 ← 가 "나가기" 였다.
 *
 * 몇 곳은 막으려고 했지만 판정이 틀렸다:
 *  - `window.history.length > 1` — 이 탭이 **우리 앱 밖에서** 쌓은 칸(카톡·검색·토스 결제창)도 센다.
 *    그래서 1 보다 크면 `-1` 이 앱 밖(또는 결제창)으로 나간다.
 *  - `document.referrer` — 결제·로그인처럼 바깥을 거쳐 돌아오면 바깥 주소가 남는다.
 *
 * ## 판정은 하나다 — 라우터의 `history.state.idx`
 * react-router 는 이 앱 안에서 쌓은 칸마다 `idx` 를 0, 1, 2… 로 붙인다. 이 문서가 처음 열린 칸이 0 이다.
 * ⇒ `idx > 0` 이면 **이 앱 안에 돌아갈 칸이 있다** → `navigate(-1)` (스크롤 복원도 그대로 된다).
 *   아니면 → 그 화면의 "위" (`fallback`) 로 **replace** 한다. push 로 가면 폰 뒤로가 다시 이 화면으로
 *   돌아와 고리가 생긴다.
 *
 * ⚠️ 바깥을 거쳐 문서가 새로 열린 경우(토스 결제 후 돌아옴 · 카카오 로그인 후 돌아옴)도 idx 는 0 이다.
 *   그때 ← 는 결제창이 아니라 `fallback` 으로 간다 — 의도된 동작이다.
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/** 이 앱 안에서 쌓은 칸이 하나라도 뒤에 있는가. 판정 불가(SSR·접근 오류)면 false — 안전한 쪽(fallback). */
export function canGoBackInApp(): boolean {
  try {
    const idx = (window.history.state as { idx?: unknown } | null)?.idx
    return typeof idx === 'number' && idx > 0
  } catch {
    return false
  }
}

/** 뒤로 — 앱 안에 돌아갈 곳이 있으면 거기로, 없으면 `fallback` 으로(replace). */
export function useSafeBack(fallback: string = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    if (canGoBackInApp()) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}
