/**
 * 🪒 부팅 JS 다이어트 — 첫 화면이 안 쓰는 아이콘 214개를 같이 받던 것 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/lucide-shell-icons.test.ts
 */
const TEST = 'src/tests/unit/lucide-shell-icons.test.ts'
const VITE = 'vite.config.ts'

export default [
  {
    name: '🪒 아이콘이 다시 한 봉투로 (첫 페인트가 어드민·셀러 아이콘까지 받는다)',
    file: VITE,
    find: "return !icon || LUCIDE_SHELL_ICONS.has(icon[1]) ? 'lucide-shell' : 'lucide'",
    replace: "return 'lucide'",
    test: TEST,
    why: '실측: 260개가 한 봉투면 첫 페인트 695.0KB, 셸이 쓰는 43개만 가르면 633.1KB. 규칙 한 줄이 그 차이다.',
  },
  {
    name: '🪒 lucide 코어(Icon/createLucideIcon/배럴)가 큰 봉투로 간다',
    file: VITE,
    find: 'return !icon ||',
    replace: 'return',
    test: TEST,
    why: '코어가 큰 봉투로 가면 셸이 그 봉투를 import 해 분할이 통째로 무의미해진다(총량이 안 줄어든다).',
  },
  {
    name: '🪒 별칭의 실제 구현 파일이 목록에서 빠진다 (AlertCircle → circle-alert)',
    file: VITE,
    find: "'circle-alert',",
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
