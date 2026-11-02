/**
 * 💉 프로필 편집 A-2 · 시트 등장 동작 — 주입 매니페스트 〔2026-10-11〕
 *
 * 이 레포의 반복 사고는 "검사가 실패한다" 가 아니라 **"검사가 실패할 수 없다"** 다.
 * 아래 결함을 하나씩 심어 `profile-edit-a2-and-sheet-motion-2026-10-11` 이 **실제로 빨간불**을
 * 내는지 확인한다. 통과하면 그 가드는 지키는 척만 하고 있는 것이다.
 */
const T = 'src/tests/unit/profile-edit-a2-and-sheet-motion-2026-10-11.test.ts'
const EDIT = 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx'
const SHEET = 'src/pages/user-profile/seller-section/Sheet.tsx'
const NOTI = 'src/components/notifications/NotificationSheet.tsx'
const PAGE = 'src/pages/UserProfilePage.tsx'
const CSS = 'src/index.css'

export default [
  {
    name: '시트 — lg+ 투명도 전환을 뺀다 (PC 가 slide 를 물려받아 다이얼로그가 튄다)',
    file: CSS,
    find: '@media (min-width: 1024px) { .ur-sheet-in { animation: ur-overlay-in .18s ease-out both; } }',
    replace: '/* lg 갈아타기 제거 */',
    test: T,
    why:
      '`.ur-sheet-in` 이 뷰포트별 동작을 **소유**하는 것이 PC 함정을 막는 장치다. lg 줄만 빼면 ' +
      'PC 도 `ur-slide-up` 을 물려받아 가운데 정렬 `transform` 을 덮는다 — 1280×800 실측 ' +
      '410,200 → 640,400. 호출부는 멀쩡해 보이고 폰에서도 멀쩡하다.',
  },
  {
    name: '시트 — PC 에서도 slide-up (가운데 정렬 transform 을 덮어 다이얼로그가 튄다)',
    file: SHEET,
    find: "          + ' ur-sheet-in'",
    replace: "          + ' animate-slide-up'",
    test: T,
    why:
      '브라우저 실측(1280×800): 가운데 상자에 `slide-up` 을 걸면 left 490→640 · top 320→400 으로 ' +
      '**150·80px 튄다**. `ur-slide-up` 이 `transform` 을 `none` 으로 끝내고 `fill-mode: both` 로 ' +
      '유지해 `-translate-x-1/2 -translate-y-1/2` 를 덮기 때문이다. 빌드도 테스트도 안 깨지고 ' +
      '**폰에서는 멀쩡해서** PC 로 열어 본 사람만 안다.',
  },
  {
    name: '시트 — 알림만 등장 동작을 뺀다 (앱 안에 두 가지 동작)',
    file: NOTI,
    find: 'rounded-t-2xl bg-surface ur-sheet-in"',
    replace: 'rounded-t-2xl bg-surface"',
    test: T,
    why:
      '한 곳만 빠지면 그 화면이 **고장난 것처럼** 보인다. 시트가 아홉인데 여덟은 올라오고 하나는 ' +
      '툭 뜨면, 사람은 그걸 "덜 만든 화면" 으로 읽는다(대표가 두 번 지적한 그 인상).',
  },
  {
    name: '시트 — 배경 페이드 제거 (어둠만 툭 켜진다)',
    file: NOTI,
    find: 'className="fixed inset-0 bg-black/40 ur-sheet-veil"',
    replace: 'className="fixed inset-0 bg-black/40"',
    test: T,
    why:
      '시트는 스르륵 올라오는데 뒤 어둠이 0초에 켜지면 두 동작이 어긋나 보인다 — 애니메이션을 ' +
      '안 넣은 것보다 나쁘다. 눈에만 보이고 에러는 0이라 가드가 아니면 못 잡는다.',
  },
  {
    name: '동작 줄이기 — reduced-motion 해제 (멀미 설정을 무시한다)',
    file: CSS,
    find: '@media (prefers-reduced-motion: reduce) { .ur-sheet-in, .ur-sheet-veil, .ur-sheet-out, .ur-sheet-veil-out { animation: none; } }',
    replace: '@media (prefers-reduced-motion: reduce) { .ur-sheet-veil, .ur-sheet-out, .ur-sheet-veil-out { animation: none; } }',
    test: T,
    why:
      '이 레포는 `.ur-lift`·`.ur-appear`·`.ur-pop` 에서 그 설정을 이미 지킨다. 화면 절반이 ' +
      '솟아오르는 **가장 큰 움직임**만 그 밖에 남으면 규칙이 있으나 마나다.',
  },
  {
    name: 'A-2 — 이름을 purge 안 하는 경로로 저장 (남들에겐 옛 이름)',
    file: EDIT,
    find: '    await patch({ name: v }, { name: v }, t(',
    replace: "    await api.patch('/api/auth/profile', { name: v })",
    test: T,
    why:
      '둘 다 `users.name` 을 쓰지만 `auth/profile` 은 **공개 유어샵 캐시를 purge 하지 않는다.** ' +
      '본인 화면은 즉시 바뀌어 성공처럼 보이고, 남들에게만 한동안 옛 이름이 뜬다 — 종전 프로필 ' +
      '편집이 정확히 그 길이었고 A-2 로 합치면서 고친 결함이다.',
  },
  {
    name: 'A-2 — 전화번호 형식 검사 제거 ("010" 한 글자도 통과)',
    file: EDIT,
    // 🧷 형식 검사는 `if` 와 `toast` 가 두 줄이다 — **조건 줄만** 무력화한다(문구는 남겨 둬야
    //    "문구가 있으니 검사도 있다" 는 착각을 가드가 통과시키지 않는지까지 확인된다).
    find: "    if (!/^01[016789]-?\\d{3,4}-?\\d{4}$/.test(v)) {",
    replace: '    if (false) {',
    test: T,
    why:
      '교환권이 **MMS 로 이 번호에** 간다. 빈칸만 막으면 "010" 으로도 저장되고, 그 사람은 ' +
      '계산대 앞에서야 물건이 안 온 걸 안다(2026-09-02 대표 지시로 필수가 된 자리).',
  },
  {
    name: 'A-2 — 유어샵 관리에 같은 줄을 되살린다 (편집이 두 곳)',
    file: 'src/pages/UShopManagePage.tsx',
    find: "const ProfileEditSheet = lazy(() => import('./user-profile/profile-edit/ProfileEditSheet'))",
    replace: "const ProfileEditSheet = lazy(() => import('./ushop-manage/ShopInfoEditSheet'))",
    test: T,
    why:
      '값을 고치는 자리가 둘이 되면 한쪽에서 바꾸고 다른 쪽을 보면 옛 값이 보인다 — 그게 A-2 를 ' +
      '하게 만든 실제 결함(이름이 두 곳)이다. 여기서는 **가는 길이 자기 자신을 가리키는** 모양으로 ' +
      '심는다: 찾으러 온 사람이 영원히 맴돈다(에러 0).',
  },
  {
    name: 'A-2 — 시트를 마이 첫 페인트에 싣는다 (lazy 해제)',
    file: PAGE,
    find: "const ProfileEditSheet = lazy(() => import('./user-profile/profile-edit/ProfileEditSheet'))",
    replace: "import ProfileEditSheet from './user-profile/profile-edit/ProfileEditSheet'",
    test: T,
    why:
      '편집 시트를 여는 사람은 소수인데 정적 import 로 바꾸면 **모든 방문자**가 그 코드를 받는다. ' +
      '번들 예산은 후행 지표라 한참 뒤에야 빨개진다 — 그때는 원인을 못 찾는다.',
  },
]
