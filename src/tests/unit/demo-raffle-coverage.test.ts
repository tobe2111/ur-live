/**
 * 🎭 데모 상품은 **소비자에게 추첨으로 보여야 한다** (대표 룰) — 그 배선을 고정한다.
 *
 * ## 무엇이 있었나 (2026-08-03 라이브 실측)
 *
 * 판정이 `'demo-deal-'` 접두사로 **여러 파일에 각각 하드코딩**돼 있었고, 나중에 생긴
 * `demo-stay-*`(숙박 72개)는 **어느 조건에도 안 걸렸다.**
 *
 * | | 활성 | 추첨 설정 |
 * |---|---|---|
 * | `demo-deal-*` | 254 | 254 ✅ |
 * | `demo-stay-*` | 72 | **0** ❌ |
 *
 * 결과 2가지 — 둘 다 에러가 아니라 **조용한 오표시**다:
 *   1. 배지 렌더가 `{fcfs && <FcfsBadge/>}` 라 추첨 설정이 없으면 **배지가 아예 안 그려진다**
 *      → 소비자 눈엔 89,000원짜리 **진짜 숙박권**
 *   2. "데모는 항상 후순위" 정렬에도 안 걸려 **피드 첫 50건을 전부 점유**(실상품은 3개뿐이었다)
 *
 * ## 이 테스트가 막는 것
 *
 * 접두사를 **다시 좁히는 것**(`demo-deal-`)과, 새 소비자 표면이 SSOT 를 안 쓰고 자기 문자열을
 * 박는 것. 판정은 `shared/constants/demo-products.ts` 하나여야 한다.
 *
 * ⚠️ **못 막는 것**: 실제 화면 렌더. 이 환경에선 브라우저가 프록시를 못 뚫어 스크린샷을 못 찍는다
 * (curl 은 됨). 배지가 실제로 그려지는지는 **배포 후 눈으로** 확인해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEMO_SLUG_PREFIX, isDemoSlug, isRaffleDemo, demoRaffleDefaults, demoSlugSql,
} from '../../shared/constants/demo-products'

const read = (p: string) => readFileSync(p, 'utf8')

/** 소비자에게 데모가 어떻게 보이는지를 결정하는 파일들. */
const CONSUMER_SITES = [
  'src/features/group-buy/api/group-buy-public.routes.ts',  // 피드 정렬 + demo 플래그
  'src/worker/cron/group-buy-feed-cache.ts',                // materialized 정렬(파리티)
  'src/features/group-buy/api/fcfs.routes.ts',              // 추첨 판정 + /active 정렬
  'src/worker/cron/drop-d1-reminder.ts',                    // 가짜 상품 마감 알림 제외
]

describe('데모 판정 SSOT', () => {
  it('접두사는 종류를 나열하지 않는다 (다음 데모가 자동 적용되도록)', () => {
    expect(DEMO_SLUG_PREFIX).toBe('demo-')
    expect(isDemoSlug('demo-deal-1')).toBe(true)
    expect(isDemoSlug('demo-stay-42')).toBe(true)     // ← 이게 안 걸려서 사고가 났다
    expect(isDemoSlug('demo-linkshop-3')).toBe(true)
    expect(isDemoSlug('강남맛집-김밥천국-할인권')).toBe(false)
    expect(isDemoSlug(null)).toBe(false)
  })

  it('SQL 조각은 slug NULL 행을 빠뜨리지 않는다', () => {
    // `slug LIKE ...` 는 NULL 에 대해 NULL(=거짓)이라 행이 조용히 빠진다.
    // 2026-08-03 에 이 함정으로 실상품 개수를 10 으로 잘못 셌다(실제 3).
    expect(demoSlugSql('p')).toContain('COALESCE')
  })

  it('추첨은 매장 이용권 데모만 — 배송 데모는 제외', () => {
    expect(isRaffleDemo({ slug: 'demo-stay-1', category: 'stay_voucher' })).toBe(true)
    expect(isRaffleDemo({ slug: 'demo-deal-1', category: 'meal_voucher' })).toBe(true)
    // 링크샵 배송 예시 — "응모" 화면이 성립하지 않는다
    expect(isRaffleDemo({ slug: 'demo-linkshop-1', category: 'food' })).toBe(false)
    // 데모가 아니면 카테고리와 무관하게 false
    expect(isRaffleDemo({ slug: null, category: 'stay_voucher' })).toBe(false)
  })

  it('기본값은 이용권 데모와 같은 규칙 (대표 "같은 규칙으로 맞춰줘")', () => {
    for (const r of [0, 0.5, 0.999]) {
      const { spots, appliedSeed, deadlineMs } = demoRaffleDefaults(() => r)
      expect(spots).toBeGreaterThanOrEqual(3)
      expect(spots).toBeLessThanOrEqual(8)
      expect(appliedSeed).toBeGreaterThanOrEqual(spots * 3)
      expect(appliedSeed).toBeLessThanOrEqual(spots * 6)
      const days = deadlineMs / (24 * 3600 * 1000)
      expect(days).toBeGreaterThanOrEqual(5)
      expect(days).toBeLessThanOrEqual(10)
    }
  })
})

describe('소비자 표면이 좁은 접두사로 되돌아가지 않는다', () => {
  it.each(CONSUMER_SITES)('%s — demo-deal- 하드코딩 0', (path) => {
    const code = read(path)
      .replace(/\/\*[\s\S]*?\*\//g, '')                      // 블록 주석 제거
      .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')  // 줄 주석 제거
    expect(code, '좁은 접두사로 되돌아가면 새 데모 종류가 또 누락된다').not.toContain('demo-deal-')
  })

  it('피드 정렬과 materialized cron 이 같은 기준을 쓴다', () => {
    // 둘이 갈리면 캐시본과 라이브 응답의 **행 순서가 달라진다** — 새로고침마다 순서가 튄다.
    expect(read(CONSUMER_SITES[0])).toContain("demoSlugSql('p')")
    expect(read(CONSUMER_SITES[1])).toContain("LIKE 'demo-%'")
  })
})

describe('추첨 설정 자가치유 (기존 데모 백필)', () => {
  const cron = read('src/worker/cron/demo-fcfs-renew.ts')

  it('설정이 없는 데모에 seed 한다 — 일회성 SQL 이 아니라 코드 경로로', () => {
    expect(cron).toContain('fcfs_enabled')
    expect(cron).toContain('NOT EXISTS')
    expect(cron).toMatch(/seeded/)
  })

  it('배송 데모까지 켜지 않도록 voucher 카테고리로 한정한다', () => {
    expect(cron).toContain('VOUCHER_CATEGORIES')
    expect(cron).toContain('p.category IN')
  })

  it('생성 경로와 자가치유 cron 이 같은 헬퍼를 쓴다', () => {
    // 생성 때 안 넣으면 cron 이 다음 회차에 메우지만, 그 사이 소비자에겐 판매 상품으로 보인다.
    // 그리고 규칙이 두 곳에 따로 있으면 반드시 갈린다 — 그게 이 사고의 원인이었다.
    expect(read('src/features/admin/api/admin-stays.routes.ts')).toContain('seedDemoRaffle')
    expect(cron).toContain('seedDemoRaffle')
    expect(read('src/worker/utils/demo-raffle.ts')).toContain('demoRaffleDefaults')
  })
})

describe('추첨 배지 문구 — "몇 명 뽑는데 몇 명 응모" (대표 2026-08-03)', () => {
  // ⚠️ **주석을 걷어낸 실행 코드로만 판정한다.** 원문으로 보면 이 파일 헤더의 설명 문장이
  //    검사어를 대신 만족시켜 초록이 뜬다(첫 판이 실제로 그랬다 — 렌더에서 정원을 빼도 통과했다).
  const badge = read('src/features/group-buy/FcfsBadge.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')

  it('두 변형 모두 정원을 렌더한다 — 2026-07-22 미노출 결정을 대표가 뒤집었다', () => {
    // 문자열 존재가 아니라 **정원 값이 실제로 그려지는지**를 본다.
    const drawsSpots = badge.match(/\{spots\}/g) || []
    expect(drawsSpots.length, 'inline·overlay 두 곳에서 정원을 그려야 한다').toBeGreaterThanOrEqual(2)
    expect(badge, 'inline 문구').toContain('뽑는데')
    expect(badge, 'overlay 문구(좁은 공간)').toContain('뽑기')
  })

  it('공동구매 오독을 부르는 표현을 쓰지 않는다', () => {
    // 2026-07-22 에 정원을 숨긴 이유가 *"N명 모여야 성사"* 오독 + CS 였다.
    // 정원 자체가 아니라 **목표치로 읽히는 문구**가 문제다 — 그 표현만 금지한다.
    for (const bad of ['명 모집', '명 목표', '모여야', '달성']) {
      expect(badge, `"${bad}" 는 공동구매 목표로 읽힌다 — 추첨 정원이 아니다`).not.toContain(bad)
    }
  })

  it('정원이 0/미설정이면 응모자만 보여준다 (없는 숫자를 지어내지 않는다)', () => {
    expect(badge, 'spots=0 폴백 분기가 없다').toContain('지금 ')
  })
})
