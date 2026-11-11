/**
 * 🔗 유어샵 핀 공유 주소(`/u/{handle}/p/{productId}`) → 서버가 바로 넘겨준다 (2026-11-11 대표 *"어차피 소개하는 그 고유 링크로 들어오는거 아니야?"*).
 *
 * ## 무엇이 문제였나 (라이브 실측)
 *   이 주소는 "이 사람이 소개한 이 상품" 을 가리키는 **공유용 고유 주소**다(`usePinAction` 의 공유 URL). 그런데 서버는 이 주소에
 *   앱 껍데기(200)를 내줬고, 앱이 다 켜진 뒤에야 `CuratorPinClientRedirect` 가 `/api/curator/{handle}/p/{id}/redirect` 로 다시 보냈다.
 *   ⇒ 공유 링크를 누른 손님은 **문서를 두 번** 받았다: [앱 껍데기 + JS 부팅] → [302] → [상품 상세]. 한국 회선에서 문서 한 번이
 *   1~2초(검은 화면)라, 소개 링크가 가장 느린 입구였다.
 *
 * ## 처방
 *   문서 요청(GET/HEAD)이 이 모양이면 워커가 **같은 API 핸들러를 안에서 불러** 그 302 를 그대로 돌려준다 — 클릭 기록·목적지 판정
 *   (`?aff=`·`?ref=`)은 한 글자도 안 바뀐다(같은 핸들러). 앱 안에서 누른 이동은 서버를 안 타므로 `App.tsx` 의 라우트는 그대로 둔다.
 *
 * ⚠️ 핸들·상품 번호 모양만 본다(존재 여부는 핸들러가 판정 — 핀이 없으면 상품 상세로 보낸다).
 */
const PIN_LINK_RE = /^\/u\/([A-Za-z0-9_-]{1,40})\/p\/(\d{1,12})\/?$/

/** 핀 공유 주소면 그 리다이렉트 API 경로, 아니면 null. */
export function pinRedirectApiPath(pathname: string): string | null {
  const m = PIN_LINK_RE.exec(pathname)
  if (!m || m[1] === 'me') return null // `/u/me` 는 내 유어샵 탭이다 — 핸들이 아니다
  return `/api/curator/${m[1]}/p/${m[2]}/redirect`
}
