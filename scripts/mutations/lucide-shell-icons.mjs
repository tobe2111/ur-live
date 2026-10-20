/**
 * 🪒 부팅 JS 다이어트 — 첫 화면이 안 쓰는 아이콘 214개를 같이 받던 것 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/lucide-shell-icons.test.ts
 */
const TEST = 'src/tests/unit/lucide-shell-icons.test.ts'
const VITE = 'vite.config.ts'

export default [
  {
    // 🔁 2026-10-12 재조준: 봉투가 셋이 되며 삼항이 if 로 풀렸다(`lucide-home` 추가).
    //   결함은 그대로 — 셸 분기를 없애 전부 한 봉투로 보낸다.
    name: '🪒 아이콘이 다시 한 봉투로 (첫 페인트가 어드민·셀러 아이콘까지 받는다)',
    file: VITE,
    find: "if (!icon || LUCIDE_SHELL_ICONS.has(icon[1])) return 'lucide-shell'",
    replace: "if (false) return 'lucide-shell'",
    test: TEST,
    why: '실측: 260개가 한 봉투면 첫 페인트 695.0KB, 셸이 쓰는 43개만 가르면 633.1KB. 규칙 한 줄이 그 차이다.',
  },
  {
    // 🔁 2026-10-12 재조준: 같은 이유로 `return !icon ||` 이 `if (!icon || …) return` 이 됐다.
    //   그리고 종전 `replace: 'return'` 은 **아무 데나 매치되는 부분문자열**이라 복원 검사에서
    //   거짓 경보를 냈다(실제로 냈다) — 코어 분기만 정확히 떼어 내도록 바꿨다.
    name: '🪒 lucide 코어(Icon/createLucideIcon/배럴)가 큰 봉투로 간다',
    file: VITE,
    find: 'if (!icon || LUCIDE_SHELL_ICONS.has(icon[1]))',
    replace: 'if (icon && LUCIDE_SHELL_ICONS.has(icon[1]))',
    test: TEST,
    why: '코어가 큰 봉투로 가면 셸이 그 봉투를 import 해 분할이 통째로 무의미해진다(총량이 안 줄어든다).',
  },
  {
    /* 🔧 2026-09-29 재조준: UI④ 아이콘 이행으로 셸이 `AlertCircle` 을 안 써서 `circle-alert` 가
       목록에서 사라졌다. 결함은 그대로 — **살아 있는 별칭**(HelpCircle → circle-help)으로 옮긴다. */
    name: '🪒 별칭의 실제 구현 파일이 목록에서 빠진다 (HelpCircle → circle-help)',
    file: VITE,
    find: "'circle-help',",
    replace: '',
    test: TEST,
    why: '이 레포가 실제로 밟은 함정 — 별칭 파일만 넣으면 구현이 큰 봉투에 남아 셸이 그 봉투를 다시 끌고 온다. 빌드는 성공하고 총량만 안 준다.',
  },
  {
    name: '🪒 auth 버킷이 폴더 통째로 되돌아간다 (셀러 전용 2개가 첫 페인트로)',
    file: VITE,
    find: "id.includes('/src/components/auth/RouteGuards')",
    replace: "id.includes('/src/components/auth/')",
    test: TEST,
    why: '`KakaoLinkButton`·`SellerPinPrompt` 는 셀러 프로필 편집 한 페이지만 쓰는데, 같은 폴더의 `RouteGuards`(셸) 때문에 첫 페인트로 실려 왔다(13.7KB).',
  },
]
