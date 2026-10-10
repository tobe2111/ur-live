/**
 * 🎞️ 히어로 띠 — 화면에 들어오기 전에 받는다 · 되돌려-검증 주입 (2026-10-10).
 *
 * 대표 신고 *"지금 메인에서 이용권 사진 안나오는 문제 해결해줘. 영구적으로"* 의 수리를 지킨다.
 * 각 주입은 "사진이 빈 칸으로 먼저 보이던 그 상태"로 **한 걸음씩** 되돌린다.
 */
const T = 'src/tests/unit/hero-deal-strip-2026-09-28.test.tsx'
const F = 'src/components/home/HeroDealStrip.tsx'
export default [
  {
    name: '🎞️ 유휴 워밍이 통째로 사라진다 (= 2026-10-10 이전 상태)',
    file: F,
    find: '      for (const u of warmUrls) {\n        const img = new Image()',
    replace: '      for (const u of [] as string[]) {\n        const img = new Image()',
    test: T,
    why: '마퀴는 모든 타일을 데려오는데 lazy 는 화면에 들어온 뒤에야 받는다 — 타일이 대표색 사각형으로 먼저 보인다(실측 800kbps 에서 동시 4장).',
  },
  {
    name: '🎞️ 워밍 목록이 빈다 — 미룬 타일을 하나도 안 받는다',
    file: F,
    find: '    const rest = loop ? loop.strip.slice(HERO_STRIP_EAGER) : []',
    replace: '    const rest = loop ? loop.strip.slice(loop.strip.length) : []',
    test: T,
    why: '같은 증상. 목록 계산만 비워도 워밍은 아무 일도 안 한다.',
  },
  {
    name: '🎞️ 먼저 받은 앞 N장까지 다시 받는다',
    file: F,
    find: '    const rest = loop ? loop.strip.slice(HERO_STRIP_EAGER) : []',
    replace: '    const rest = loop ? loop.strip.slice(0) : []',
    test: T,
    why: '이미 받은 것을 또 받으면 유휴 워밍이 중복 요청을 만든다(총 바이트 불변이라는 전제가 깨진다).',
  },
  {
    name: '🎞️ 데이터 절약 모드를 무시하고 워밍한다',
    file: F,
    find: '    if (conn?.saveData) return',
    replace: '    if (false) return',
    test: T,
    why: 'cf-image 가 이미 존중하는 신호다 — 절약 모드 사용자에게만 40KB 를 더 물린다.',
  },
  {
    name: '🎞️ 유휴 예약이 0ms 가 된다 — 첫 페인트와 경쟁한다',
    file: 'src/shared/home-hero-strip.ts',
    find: 'export const HERO_STRIP_WARM_TIMEOUT_MS = 1500',
    replace: 'export const HERO_STRIP_WARM_TIMEOUT_MS = 0',
    test: T,
    why: '워밍이 LCP 와 대역폭을 다투면 첫 화면이 늦어진다 — 사진을 보이게 하려다 더 늦게 보이게 된다.',
  },
  {
    name: '🎞️ 첫 페인트에 나머지까지 eager 로 바꾼다 (임계 경로 증가)',
    file: F,
    find: 'tile={t} eager={i < HERO_STRIP_EAGER} priority={i < HERO_STRIP_PRELOAD} />',
    replace: 'tile={t} eager priority={i < HERO_STRIP_PRELOAD} />',
    test: T,
    why: '빈 칸은 사라지지만 첫 화면 바이트가 60KB → 106KB 로 늘어난다 — SSOT 가 재서 고른 트레이드오프를 깬다.',
  },
]
