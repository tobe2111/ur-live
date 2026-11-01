/**
 * 🔔✏️ 마이 헤더 두 버튼 — 되돌려-검증 주입 (2026-10-11).
 *
 * 각 주입은 대표가 신고한 상태(알림이 페이지로 떠남 · 프로필이 이름·전화번호뿐)로 한 걸음씩 되돌린다.
 */
const T = 'src/tests/unit/notification-sheet-and-profile-2026-10-11.test.tsx'
/* ✏️ 2026-10-11 재조준 — 프로필 편집이 모달에서 A-2 시트로 옮겨갔다. 결함은 그대로, 앵커만 옮긴다. */
const EDIT = 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx'
export default [
  {
    name: '🔔 마이의 벨이 다시 알림 페이지로 떠난다',
    file: 'src/pages/UserProfilePage.tsx',
    find: '<button onClick={bell.open} aria-label={t(\'userProfile.ariaNotifications\')}',
    replace: '<button onClick={() => navigate(\'/notifications\')} aria-label={t(\'userProfile.ariaNotifications\')}',
    test: T,
    why: '보던 화면을 떠나므로 스크롤·필터가 날아간다 — 대표가 신고한 바로 그 동작.',
  },
  {
    name: '🔔 지도 벨만 페이지로 남는다 (한 곳만 빠뜨리는 실수)',
    file: 'src/pages/restaurant-map/MapTopBar.tsx',
    find: '                onClick={bell.open}',
    replace: "                onClick={() => navigate('/notifications')}",
    test: T,
    why: '벨이 다섯 곳이라 한 곳만 안 고치면 그 화면만 다르게 동작한다 — 사람 눈엔 안 보인다.',
  },
  {
    name: '🔔 시트가 목록을 **직접** 그린다 (몸통이 두 벌)',
    file: 'src/components/notifications/NotificationSheet.tsx',
    find: "import { NotificationPanelBody, NotificationPanelFooter, NotificationPanelHeader } from './NotificationPanel'",
    replace: "import { NotificationPanelBody, NotificationPanelFooter, NotificationPanelHeader } from './NotificationPanel'\nimport { useNotifications } from '@/hooks/queries/useNotifications'\nvoid useNotifications",
    test: T,
    why: '셸이 스스로 목록을 쥐기 시작하면 PC·모바일·페이지가 또 갈린다(시각 표기가 이미 그렇게 갈려 있었다).',
  },
  {
    name: '🔔 상대 시각이 UTC 를 로컬로 오해한다 (방금 → 9시간 전)',
    file: 'src/components/notifications/NotificationPanel.tsx',
    find: '  const d = parseUTCDate(iso)',
    replace: '  const d = new Date(iso)',
    test: T,
    why: "D1 의 created_at 은 `Z` 없는 UTC 문자열이다 — CLAUDE.md 가 래칫까지 걸어 둔 클래스.",
  },
  {
    name: '🔔 시트 z-index 를 손으로 적는다 (하단 네비가 덮는다)',
    file: 'src/components/notifications/NotificationSheet.tsx',
    find: '        style={{ zIndex: Z.SHEET_BODY }}',
    replace: '        style={{ zIndex: 100 }}',
    test: T,
    why: '네비가 z-9999 라 모달이 그 아래로 가면 버튼이 안 보인다 — 2026-06-26 에 23곳을 일괄 교정한 그 사고.',
  },
  {
    name: '🔔 시트 높이를 `vh` 로 적는다 (모바일에서 바닥이 잘린다)',
    file: 'src/components/notifications/NotificationSheet.tsx',
    // 🧷 주석에도 같은 문자열이 있어 **앵커가 둘** 이었다(전수 검사가 잡았다) → 실제 className 으로.
    find: 'bottom-0 max-h-[80dvh] flex flex-col',
    replace: 'bottom-0 max-h-[80vh] flex flex-col',
    test: T,
    why: '모바일 100vh 는 주소창을 포함해 실제 보이는 영역보다 크다(CLAUDE.md 룰 #8).',
  },
  {
    name: '✏️ 프로필 행이 다시 맨 `>` 가 된다',
    file: 'src/pages/UserProfilePage.tsx',
    find: "<span className=\"flex items-center gap-1 mt-1 text-[13px] text-gray-500 dark:text-gray-400\">{t('userProfile.editProfile', { defaultValue: '프로필 편집' })}<ChevronRight className=\"w-4 h-4 shrink-0\" aria-hidden=\"true\" /></span>\n            </span>\n          </button>\n          <SellerSwitchInline",
    replace: "<span className=\"flex items-center gap-1 mt-1 text-[13px] text-gray-500 dark:text-gray-400\"><ChevronRight className=\"w-4 h-4 shrink-0\" aria-hidden=\"true\" /></span>\n            </span>\n          </button>\n          <SellerSwitchInline",
    test: T,
    why: '대표: "오른쪽 버튼은 눌렀을 때 기껏해야 …" — 무엇이 열리는지 말하지 않는 버튼.',
  },
  {
    name: '✏️ 코드만 고치고 ko locale 을 안 고친다 (locale 이 이긴다)',
    file: 'public/locales/ko/translation.json',
    find: '"editProfile": "프로필 편집",\n    "menu"',
    replace: '"editProfile": "프로필 수정",\n    "menu"',
    test: T,
    why: 'defaultValue 는 키가 없을 때만 쓰인다 — 행은 "프로필 편집", 시트 제목은 "프로필 수정" 이 되고 에러는 0이다.',
  },
  {
    name: '✏️ 사진 변경이 사라진다 (다시 이름·전화번호뿐)',
    file: EDIT,
    find: '<input type="file" accept="image/*" className="hidden" disabled={uploading}',
    replace: '<input type="text" className="hidden" disabled={uploading}',
    test: T,
    why: '대표가 "기껏해야" 라고 한 그 상태로 되돌아간다.',
  },
  {
    name: '✏️ 사진을 올리고 **헤더를 안 고친다**',
    file: EDIT,
    find: "      try { localStorage.setItem('user_profile_image', url) } catch { /* quota */ }",
    replace: '      /* 헤더 갱신 생략 */',
    test: T,
    why: '서버엔 저장됐는데 마이 헤더는 옛 사진이다 — 사용자는 저장이 안 된 줄 안다(에러 0).',
  },
  {
    name: '✏️ 사진 저장을 [저장] 버튼에 묶는다 (전화번호 검증에 막힌다)',
    file: EDIT,
    // 🔁 2026-10-11 재조준: 종전 앵커(`if (file.size > 5 * 1024 * 1024) {`)는 413 수리로 사라졌다
    //   (압축 전 크기 가드를 걷어냈다 — 그 숫자가 실제 천장과 달라 거짓말이었다). 지키려던 것은
    //   그대로다: **사진 변경은 다른 칸의 검증에 묶이지 않는다.** 그래서 업로드 진입 줄에 다시 건다.
    find: '    setUploading(true)\n    const prev = image',
    replace: "    if (!me?.phone) { toast.error(t('accountSettings.phoneRequired')); return }\n    setUploading(true)\n    const prev = image",
    test: T,
    why: '사진만 바꾸려는 사람이 전화번호 때문에 못 바꾼다.',
  },
  {
    name: '✏️ 업로드 실패를 **안 되돌린다**',
    file: EDIT,
    find: '      setImage(prev)',
    replace: '      /* 되돌리지 않음 */',
    test: T,
    why: '실패했는데 새 사진이 떠 있는 것으로 남는다.',
  },
  {
    name: '✏️ 전화번호 형식 검증이 사라진다',
    file: EDIT,
    find: "    if (!/^01[016789]-?\\d{3,4}-?\\d{4}$/.test(v)) {",
    replace: '    if (false) {',
    test: T,
    why: '교환권 MMS 가 그 번호로 간다 — "010" 한 글자로 통과하면 산 물건이 도착할 곳이 없다(2026-09-02 대표 지시).',
  },
]
