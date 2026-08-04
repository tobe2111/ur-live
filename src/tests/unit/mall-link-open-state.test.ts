/**
 * 🔗 **어드민이 말하는 "열린다" = 워커가 실제로 여는 조건** 〔2026-08-03〕
 *
 * 대표 요청으로 몰 목록에 손님 링크(`urdeal.kr/{슬러그}`)를 노출하면서, **안 열릴 때 왜 안 열리는지**
 * 를 화면이 말하게 했다(`mallOpenState`). 그러면 새 위험이 하나 생긴다 —
 * **어드민의 판정과 워커의 판정이 갈리는 것.** 화면은 "열려요"라는데 404 면 그게 더 나쁘다.
 *
 * ⇒ 이 테스트가 **두 판정을 같은 입력으로 나란히 돌려 결과를 대조**한다.
 *   워커측은 순수함수 `pickConsumerMall`(`worker/utils/mall-consumer.ts`) 이라 그대로 부를 수 있다.
 *
 * ## 이 테스트가 실제로 막는 것
 * - R1 세 fail-closed 조건(슬러그 문법·예약어 / `active` / `consumer_path`)에서 **두 판정이 일치**
 * - R2 안 열릴 땐 **이유 문구가 반드시 있다**(빈 배지 = 아무것도 안 알려주는 것과 같다)
 * - R3 링크는 **정본 도메인**으로 만든다(구 도메인은 전 경로 301 — 사용자 표면에 두지 않는다)
 *
 * ⚠️ **못 막는 것**: 워커 캐시(TTL 60초) 때문에 *방금 만든* 몰이 잠깐 404 인 것. 그건 판정 불일치가
 *   아니라 전파 지연이고, 화면 힌트("만든 직후엔 1분쯤 뒤에 열려요")로만 다룬다.
 */
import { describe, it, expect } from 'vitest'
import { mallOpenState, mallConsumerUrl } from '@/pages/admin/wholesale-malls/MallLinkRow'
import { pickConsumerMall } from '@/worker/utils/mall-consumer'
import { readCode } from '../helpers/source-text'

type Row = { id: number; slug: string; name: string; active?: number | null; consumer_path?: number | null }

/** 워커 판정 — 그 몰 행 하나만 담긴 목록에서 자기 슬러그를 찾는다(= 실제 조회 결과와 동형). */
const workerOpens = (m: Row) => pickConsumerMall([m], m.slug) !== null

const base: Row = { id: 3, slug: 'sample-store', name: '샘플 가게', active: 1, consumer_path: 1 }

describe('🔴 R1 — 어드민 판정 == 워커 판정', () => {
  const CASES: Array<[string, Row]> = [
    ['정상(공개·활성)', base],
    ['소비자 공개 꺼짐', { ...base, consumer_path: 0 }],
    ['consumer_path null(기본 닫힘)', { ...base, consumer_path: null }],
    ['비활성', { ...base, active: 0 }],
    ['비활성 + 공개', { ...base, active: 0, consumer_path: 1 }],
    ['슬러그 2자(경로 하한 미달)', { ...base, slug: 'ab' }],
    ['슬러그 31자(경로 상한 초과)', { ...base, slug: 'a'.repeat(31) }],
    ['슬러그 대문자·언더스코어', { ...base, slug: 'Sample_Store' }],
    ['예약어 슬러그(admin)', { ...base, slug: 'admin' }],
    ['예약어 슬러그(vouchers)', { ...base, slug: 'vouchers' }],
  ]

  for (const [label, row] of CASES) {
    it(`${label} — 두 판정이 같다`, () => {
      expect(mallOpenState(row).open).toBe(workerOpens(row))
    })
  }

  it('정상 케이스는 실제로 열린다(둘 다 true — 전 케이스 false 로 헛돌지 않는지)', () => {
    expect(mallOpenState(base).open).toBe(true)
    expect(workerOpens(base)).toBe(true)
  })
})

describe('🔴 R2 — 안 열리면 이유를 반드시 말한다', () => {
  for (const row of [
    { ...base, consumer_path: 0 },
    { ...base, active: 0 },
    { ...base, slug: 'ab' },
    { ...base, slug: 'admin' },
  ]) {
    it(`${row.slug}/${row.active}/${row.consumer_path} — reason 존재`, () => {
      const s = mallOpenState(row)
      expect(s.open).toBe(false)
      expect(typeof s.reason).toBe('string')
      expect((s.reason ?? '').length).toBeGreaterThan(5)
    })
  }

  it('열릴 땐 이유가 없다', () => {
    expect(mallOpenState(base).reason).toBeUndefined()
  })
})

/**
 * 🔴 R4 — **새 몰은 기본으로 열린다 + 끄면 그 자리에서 경고** 〔2026-08-04 대표 "체크 없이도 열리게"〕
 *
 * 처음엔 `consumer_path` 기본이 **꺼짐**이었다(도매몰이 소비자 도메인으로 새는 걸 막는 fail-closed).
 * 그런데 **이 화면으로 만드는 건 공구 몰이고, 공구 몰의 존재 이유가 `urdeal.kr/{슬러그}`** 라서
 * 그 안전 기본값이 실사용에선 **"만들면 404"** 로 나타났다 — 대표가 실제로 겪었다.
 *
 * ⇒ 기본을 켬으로 뒤집고, 스위치는 고급 설정에 남긴다. 끄는 사람에겐 **404 가 된다고 그 자리에서** 말한다.
 *
 * ⚠️ **못 막는 것**: 기존 몰의 DB 값. 이건 새 폼의 초기값과 화면 문구만 본다 —
 *   이미 `consumer_path=0` 으로 저장된 몰은 수정에서 켜야 하고, 그건 목록의 링크 줄이 안내한다.
 */
describe('🔴 R4 — 새 몰 기본 공개 + 끄면 경고', () => {
  const formSrc = readCode('src/pages/admin/wholesale-malls/mall-form.ts')
  const adv = readCode('src/pages/admin/wholesale-malls/MallAdvancedFields.tsx')

  it('EMPTY 초기값이 consumer_path: true (체크 없이도 열린다)', () => {
    expect(formSrc).toMatch(/consumer_path:\s*true/)
    expect(formSrc).not.toMatch(/consumer_path:\s*false/)
  })

  it('스위치는 살아 있다 — 도매몰용으로 끌 수 있어야 한다', () => {
    expect(adv).toMatch(/consumer_path:\s*e\.target\.checked/)
  })

  it('`!form.consumer_path` 조건부 경고 블록이 있다', () => {
    expect(adv).toMatch(/\{!form\.consumer_path\s*&&/)
  })

  it('경고가 404 라는 결과를 명시한다(모호한 "확인하세요" 로 끝내지 않는다)', () => {
    // ⚠️ `{!form.consumer_path` 로 앵커하면 **접힘 배지**(먼저 나온다)를 잡아 경고문에 못 닿는다
    //   — 처음에 그렇게 짰다가 빨강을 봤다. 문구 자체로 앵커한다.
    const i = adv.indexOf('손님 링크가 열리지 않습니다')
    expect(i).toBeGreaterThan(-1)
    expect(adv.slice(i, i + 400)).toContain('404')
  })

  it('접혀 있어도 꺼짐을 알 수 있다(고급 설정을 안 펴는 게 기본이므로)', () => {
    expect(adv).toContain('손님 링크 꺼짐')
  })
})

describe('🔴 R3 — 링크는 정본 도메인', () => {
  it('urdeal.kr/{슬러그}', () => {
    expect(mallConsumerUrl('sample-store')).toBe('https://urdeal.kr/sample-store')
  })

  it('구 도메인을 쓰지 않는다', () => {
    // 구 `live.ur-team.com` 은 전 경로 영구 301 — 사용자 표면에 두면 `check-legacy-domain` 위반이기도 하다.
    expect(mallConsumerUrl('x-store')).not.toContain('ur-team.com')
  })
})
