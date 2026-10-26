/**
 * 🏠 모바일 홈 섹션 가로 줄의 클래스 — **화면과 워커 첫 화면이 같은 상수를 쓴다**
 * (2026-10-26 대표 확정 — 아래는 "안 A"의 섹션 가로 줄, 배너 윗부분은 *"다시 돌려줘"* 로 원래 모양 그대로).
 *
 * 왜 상수인가: 워커(`worker/utils/home-first-screen.ts`)는 React 없이 같은 모양을 문자열로 그린다.
 * 클래스를 두 벌 적으면 한쪽만 고쳐지고, 마운트 때 그 자리가 튄다(에러는 안 난다).
 * import 하면 갈릴 수가 없다 — `PASS_HEAD`·`STRIP_CLS` 와 같은 처방이다.
 *
 * ⚠️ 이 파일은 워커가 읽는다 — React·아이콘·`@/` 경로를 import 하지 말 것(번들 게이트).
 */

/**
 * 섹션 가로 줄(모바일) — 카드가 한 장 반쯤 보여 "옆으로 넘긴다" 를 말한다.
 * 카드 폭 68%: 첫 화면 사진은 200px 폭으로 미리 받는데(`home-card-preload`) 2배 화면에서 400px 라
 * 이 폭(약 230px)까지 선명하다. 더 넓히면 사진이 흐려지고, 그 폭을 올리면 preload 와 URL 이 갈린다.
 *
 * 📏 상품명은 늘 두 줄 자리를 잡는다(`min-h-[2lh]`) — 카드가 넓어져 짧은 이름은 한 줄이 되는데,
 *   자리표시는 두 줄이라 응답 순간 아래 유어쇼츠 줄이 20px 올라왔다(layout-shift 실측). 줄 안 카드 높이도 같아진다.
 */
export const HOME_SECTION_RAIL =
  'flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide [&>*]:snap-start [&>*]:shrink-0 [&>*]:w-[68%] [&_.line-clamp-2]:min-h-[2lh]'
