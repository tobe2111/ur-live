// 🔐📐 마이 — 개인 캐시 주인 · 이용권 현황 높이 고정 (2026-10-18)
const TEST = 'src/tests/unit/my-cache-owner-and-status-height-2026-10-18.test.tsx'

export default [
  {
    name: '🔐 개인 캐시: 읽기 전에 주인을 안 맞춘다 (B 가 A 의 이용권을 본다)',
    file: 'src/hooks/queries/localCache.ts',
    find: 'export function readCacheOrNull<T>(key: string): T | null {\n  if (!isPublicKey(key)) ensureOwner()',
    replace: 'export function readCacheOrNull<T>(key: string): T | null {\n  if (false && !isPublicKey(key)) ensureOwner()',
    test: TEST,
    why: '같은 폰에서 계정을 바꾸면 첫 화면이 이전 사람의 배송지·이용권으로 그려진다.',
  },
  {
    name: '🔐 개인 캐시: 주인 칸이 30일 청소에 지워진다',
    file: 'src/hooks/queries/localCache.ts',
    find: "k.endsWith(TS_SUFFIX) || k === OWNER_KEY) continue",
    replace: 'k.endsWith(TS_SUFFIX)) continue',
    test: TEST,
    why: '주인 칸이 사라지면 다음 읽기가 같은 사람의 캐시까지 전부 버려 0ms 첫 화면이 깨진다.',
  },
  {
    name: '🔐 개인 캐시: 소비자 로그아웃이 캐시를 남긴다',
    file: 'src/utils/auth.ts',
    find: '    try { clearAllUserCache() } catch',
    replace: '    try { void 0 } catch',
    test: TEST,
    why: '로그아웃한 폰에 배송지·잔액이 남는다.',
  },
  {
    name: '📐 이용권 현황: 모를 때 다시 null (첫 방문에 아래 목록을 민다)',
    file: 'src/pages/user-profile/OrderStatusBar.tsx',
    find: "  const state: 'unknown' | 'empty' | 'ready' =",
    replace: "  if (!known) return null\n  const state: 'unknown' | 'empty' | 'ready' =",
    test: TEST,
    why: '응답 뒤에 바가 생기며 내가 산 것 목록이 100px 밀린다(보이는 줄 13~28개).',
  },
  {
    name: '📐 이용권 현황: 0장이면 다시 접힌다 (위로 민다)',
    file: 'src/pages/user-profile/OrderStatusBar.tsx',
    find: "  const state: 'unknown' | 'empty' | 'ready' =",
    replace: "  if (known && !counts.bought) return null\n  const state: 'unknown' | 'empty' | 'ready' =",
    test: TEST,
    why: '세워 둔 자리가 0장인 사람에게서 접히며 아래 목록이 위로 튄다.',
  },
  {
    name: '📐 밀림 가드: 마이(구매자) 경로가 이용권 시드 없이 돈다',
    file: 'scripts/check-layout-shift.mjs',
    find: "  { name: '마이(구매자)', args: ['--route=/user/profile', '--wallet', '--auth=user'] },",
    replace: "  { name: '마이(구매자)', args: ['--route=/user/profile', '--auth=user'] },",
    test: TEST,
    why: '시드가 없으면 이용권 현황이 안 떠서 그 바가 아래를 미는 것을 가드가 못 본다.',
  },
]
