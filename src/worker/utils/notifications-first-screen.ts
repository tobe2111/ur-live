/**
 * 🔔 알림(`/notifications`) 서버 첫 화면 (2026-11-10).
 *
 * 라이브 실측(폰 4G · CPU 4배): HTML 0.3~0.5s · **첫 그림 1.7~2.3s**(로더-먼저만). 머리줄(뒤로 · 알림 · 모두 읽음 자리)은 고정 모양이고
 * 목록은 API(`/api/social/notifications`)가 와야 안다 — 그래서 [머리줄 + 목록 칸 안의 로더]까지만 그린다.
 *
 * 🔐 **세션 쿠키가 있을 때만**(호출부 `authed`) — 비로그인은 `ProtectedRoute` 가 로그인으로 보내므로 머리줄을 먼저 보이면 깜빡임이다.
 *   게스트 탭(`!authed`)과 정확히 반대 방향의 가드다. 로그인 흔적(localStorage)은 보지 않는다 — 쿠키가 없으면 어차피 API 가 401 이다.
 * 그리지 않는 것: '모두 읽음' 버튼(안 읽은 게 있을 때만 앱이 세운다 — 오른쪽 칸 88px 는 비워 둔다, 제목은 안 움직인다) · 목록.
 * 🖥️ PC: 430 액자 → 게스트 탭과 같은 [네비 높이 예약 + 액자].
 */
import { NOTIF_CLS, NOTIF_COPY, NOTIF_PULL_PATH } from '../../shared/notifications-page'
import { PC_HOME_FS } from '../../shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from './guest-first-screen'
import { subPageHeadHtml } from './sub-page-head-html'

export function buildNotificationsFirstScreen(loaderHtml: string, isMobile = true): string {
  const pull = `<div aria-hidden="true" class="${NOTIF_CLS.pullInd}"><svg viewBox="0 0 24 24" class="${NOTIF_CLS.pullIcon}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${NOTIF_PULL_PATH}"></path></svg></div>`
  const page = `<div class="${NOTIF_CLS.root}">${subPageHeadHtml(NOTIF_COPY.title, true)}<div class="${NOTIF_CLS.wrap}">${pull}<div class="${NOTIF_CLS.list}"></div></div></div>`
  const topnav = isMobile ? '' : `<div class="${PC_HOME_FS.topnav}"><div class="${PC_HOME_FS.topnavRow1}"></div><div class="${PC_HOME_FS.topnavRow2}"></div></div>`
  const framed = isMobile ? page : `<div class="${GUEST_PC_FRAME.cls}" data-mobile-only="false" style="--app-frame:${GUEST_PC_FRAME.width}">${page}</div>`
  // 🧷 노드 id 는 다른 첫 화면과 같다 — `lib/boot-first-screen.ts` 가 이 노드를 Suspense 폴백에 도로 붙인다. 목록 자리는 그 아래 로더가 채운다.
  return `<div id="ur-first-screen">${topnav}${framed}</div>${loaderHtml.replace('min-height:100dvh', 'min-height:34dvh')}`
}
