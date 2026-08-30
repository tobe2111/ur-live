/**
 * ☎️ 카카오 전화 스윕 — **줄 세우는 순서**가 곧 처리량 배분이다 (2026-08-04~05, 라이브 실측 2회 수리).
 *
 * ## 두 번 고쳤고, 두 번 다 실측을 보고서야 알았다
 * ```
 * ① 기아:   ORDER BY tier, id 뿐  →  storeinfo 17,979건이 주소 100% 보유인데 조회 이력 0건
 *           쿨다운 30일 < 한 바퀴 411일  →  커서 없는 설계에서 앞줄만 무한 반복
 * ② 그 뒤:  미조회 우선을 넣어도 tier 가 여전히 줄을 세워 —
 *           t3 storeinfo 2,742 → t4 commerce 111,256(벽) → t5 storeinfo 15,518(309일 뒤)
 *           "3,500 전화"라고 보고했지만 실제로 닿는 건 2,742건뿐이었다.
 * ```
 * → 소스별 인터리브(`ROW_NUMBER() OVER (PARTITION BY source …)`)로 **큰 소스가 작은 소스를
 *   구조적으로 굶길 수 없게** 했다. 라이브 확인: `rn <= 9` 로 4개 소스가 **각 9건씩**.
 *
 * ⚠️ 이 시험이 **못** 보는 것
 * - 처리량(하루 360조회)이 오르는가 — 그건 순서가 아니라 CPU 문제다(별건).
 * - 인터리브가 *옳은 배분*인가 — 소스별 적중률을 아직 한 번도 안 재봤다. 그래서 `by_source` 계측만
 *   붙이고 **가중은 안 한다**(증거 없이 가중하면 어제의 오판을 반복한다).
 * - 윈도우 함수가 D1 에서 실제로 도는가 — 라이브 쿼리로 확인했지만 여기선 문자열만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  KAKAO_SWEEP_WHERE, KAKAO_SWEEP_INNER_ORDER, KAKAO_SWEEP_SOURCES_SQL, KAKAO_SWEEP_PER_SOURCE_SQL,
  interleaveBySource, tallySweep, type KakaoSweepRow, type SweepSourceTally,
} from '@/features/marketing/api/kakao-sweep-query'

// 📌 2026-08-30(③): 창 함수가 사라지고 [소스별 상위 N] + [코드 인터리브]가 됐다. 그래서 예전처럼
//   한 SQL 문자열을 잘라 보지 않고, **대상 집합·안쪽 정렬은 상수로** · **인터리브는 동작으로** 본다.
//   문자열이 아니라 동작을 보는 쪽이 강하다 — 문자열은 주석에만 남아도 통과하지만 동작은 못 속인다.
const INNER = KAKAO_SWEEP_INNER_ORDER
const WHERE = KAKAO_SWEEP_WHERE

describe('① 기아 — 한 소스 안에서 뒷줄이 굶지 않는다', () => {
  it('**한 번도 안 본 행**이 최우선 — 없으면 앞줄만 30일마다 반복된다', () => {
    expect(INNER, '미조회 우선 키가 사라졌다 — 앞줄 무한 반복으로 되돌아간다')
      .toContain('(kakao_checked_at IS NOT NULL) ASC')
  })

  it('**연락처가 아예 없는 행**이 그다음 — 이미 부를 수 있는 리드에 희소한 조회를 안 쓴다', () => {
    expect(INNER).toContain("(email IS NOT NULL AND email <> '') ASC")
  })

  it('tier(접촉 가치)는 **그대로 남아 있다** — 축을 늘린 것이지 우선순위를 뒤집은 게 아니다', () => {
    expect(INNER).toContain('(tier IS NULL) ASC, tier ASC, id ASC')
  })

  it('🔒 순서가 지켜진다 — 미조회 → 연락처없음 → tier', () => {
    const a = INNER.indexOf('(kakao_checked_at IS NOT NULL) ASC')
    const b = INNER.indexOf("(email IS NOT NULL AND email <> '') ASC")
    const c = INNER.indexOf('tier ASC')
    expect(a).toBeGreaterThan(-1)
    expect(b, '연락처 키가 미조회 키보다 앞이면 기아 수리가 무효다').toBeGreaterThan(a)
    expect(c, 'tier 가 앞으로 오면 옛 동작으로 되돌아간다').toBeGreaterThan(b)
  })
})

describe('② 인터리브 — 큰 소스가 작은 소스를 굶길 수 없다', () => {
  const row = (id: number, source: string, tier: number | null = 3): KakaoSweepRow =>
    ({ id, company_name: `c${id}`, region: null, address: 'a', source, tier })

  it('🔒 큰 소스가 앞을 통째로 막지 못한다 — 각 소스가 등수별로 번갈아 나온다', () => {
    const big = Array.from({ length: 50 }, (_, i) => row(1000 + i, 'commerce'))
    const small = [row(1, 'storeinfo'), row(2, 'storeinfo')]
    const out = interleaveBySource([big, small], 6)
    // storeinfo 2건이 앞쪽 4개 안에 들어와야 한다 — 안 들어오면 309일 뒤로 밀리던 옛 동작이다
    expect(out.slice(0, 4).filter(r => r.source === 'storeinfo')).toHaveLength(2)
  })

  it('🔒 같은 등수 안에서는 tier → id 가 앞자리를 정한다 (소스 삽입 순서가 아니라)', () => {
    const out = interleaveBySource([[row(9, 'a', 5)], [row(8, 'b', 1)], [row(7, 'c', null)]], 3)
    expect(out.map(r => r.source), 'tier 낮은 순 → NULL 은 맨 뒤').toEqual(['b', 'a', 'c'])
  })

  it('🔒 limit 을 넘지 않고, 얕은 소스가 먼저 마르면 남은 소스로 계속 채운다', () => {
    const out = interleaveBySource([[row(1, 'x'), row(3, 'x')], [row(2, 'y')]], 3)
    expect(out.map(r => r.id)).toEqual([1, 2, 3])
    expect(interleaveBySource([[row(1, 'x')], [row(2, 'y')]], 1)).toHaveLength(1)
  })

  it('🔒 소스 목록을 코드에 박지 않는다 — 박으면 새 수집기의 소스가 영원히 굶는다', () => {
    expect(KAKAO_SWEEP_SOURCES_SQL).toContain('SELECT DISTINCT source')
    expect(KAKAO_SWEEP_SOURCES_SQL, '소스 목록도 같은 대상 집합에서 뽑아야 한다').toContain(KAKAO_SWEEP_WHERE)
  })

  it('🔒 소스를 실제로 실어 온다 — 안 실으면 소스별 계측이 통째로 불가능하다', () => {
    expect(KAKAO_SWEEP_PER_SOURCE_SQL.slice(0, KAKAO_SWEEP_PER_SOURCE_SQL.indexOf('FROM'))).toContain('source')
  })

  it('🔒 소스별 쿼리가 같은 대상 집합·같은 안쪽 정렬을 쓴다', () => {
    expect(KAKAO_SWEEP_PER_SOURCE_SQL).toContain(KAKAO_SWEEP_WHERE)
    expect(KAKAO_SWEEP_PER_SOURCE_SQL).toContain(KAKAO_SWEEP_INNER_ORDER)
  })
})

describe('🔒 대상 집합 불변 — 세 수리 모두 순서·계산법만 바꿨다', () => {
  it.each([
    ["(phone IS NULL OR phone = '')", '전화 없는 행만'],
    ["address IS NOT NULL AND address != ''", '주소 있는 행만'],
    ['merged_into IS NULL', '병합된 행 제외'],
    ["kakao_checked_at < datetime('now', '-30 days')", '30일 쿨다운'],
  ])('%s — %s', (frag) => expect(WHERE).toContain(frag))
})

describe('📊 소스별 계측 — 다음 단계(수율 가중)의 유일한 근거', () => {
  it('시도와 적중을 소스 칸에 나눠 담는다', () => {
    const t: SweepSourceTally = {}
    tallySweep(t, 'storeinfo', true)
    tallySweep(t, 'storeinfo', false)
    tallySweep(t, 'commerce', false)
    expect(t).toEqual({ storeinfo: { tried: 2, found: 1 }, commerce: { tried: 1, found: 0 } })
  })

  it('🔒 소스가 비어도 버리지 않는다 — 버리면 분모가 조용히 줄어 수율이 부풀려진다', () => {
    const t: SweepSourceTally = {}
    tallySweep(t, null, false)
    tallySweep(t, undefined, true)
    expect(t.unknown).toEqual({ tried: 2, found: 1 })
  })

  it('🔌 스윕이 실제로 이 계측을 부른다 — 안 부르면 다음 단계가 영원히 근거 없이 남는다', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-collect.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    expect(src).toMatch(/tallySweep\(bySource, r\.source, !!k\.phone\)/)
    expect(src, '기록만 하고 저장을 안 하면 회차가 끝나며 증발한다').toMatch(/by_source: bySource/)
  })
})
