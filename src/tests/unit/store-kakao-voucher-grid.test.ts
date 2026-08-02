/**
 * 🎯 **유어딜이 파는 업종을 카카오로 채운다** — 계약 (2026-08-02 라이브 실측 후 신설).
 *
 * ## 왜 이 확장을 했나 (실측)
 * ```
 *   store_prospects 45,458건 — 학원 44,348(97.6%) · 무인 1,110 · 음식점/카페/미용/숙박 **0**
 *   인허가 레인       API: HTTP 500 · total_saved 0        ← 저 넷을 채워야 할 소스가 죽어 있다
 *   파트너 풀 source='local'(카카오)  전체의 3% 인데 **전화의 80%**
 * ```
 * 대표 지시(07-29)는 "음식점, 카페, 미용실, 숙박에 힘을 써" 였는데 그 넷이 정확히 0 이었다.
 * 인허가는 대표의 data.go.kr 확인 대기라 우리가 못 연다 ⇒ 카카오가 **유일하게 열려 있는 길**이다.
 *
 * ## 이 시험이 지키는 것
 * 1. 기존 무인 그리드가 **안 밀린다** — 배열에 덧붙였으면 인덱스가 통째로 밀려 기존 커서가 가리키던
 *    자리가 달라졌을 것이다(일부 지역이 영영 미조회). 그래서 **블록을 나눴고**, 그 분리를 여기서 고정한다.
 * 2. `category` 가 `PRIORITY_UPJONG` 과 **글자까지 일치** — 이건 store-prospects.ts 주석이 이미 경고한
 *    함정이다("다르면 조용히 0 순위가 된다"). 오타 하나면 우선순위 SQL 이 조용히 안 걸린다.
 * 3. 마감선·커서 저장 순서 — #927 에서 통신판매가 **커서를 못 올려 영원히 전진 0** 이 된 그 구조다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 카카오가 이 키워드로 **실제로 무엇을 주는지**는 못 본다(외부 API). 수확은 라이브 `blocks.voucher.found` 로만 판정된다.
 * - 업종 라벨은 카카오 검색어이지 인허가 분류가 아니다 — '음식점' 검색 결과가 전부 일반음식점 인허가는 아니다.
 *   (허위 0 원칙: 우리가 저장하는 category 는 **우리가 무슨 의도로 찾았는지**이고, 카카오 원문은 `uptae` 에 남는다.)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildUnmannedKeywords, buildVoucherKeywords, blockSlots, UNMANNED_TRADES, VOUCHER_TRADES,
} from '@/features/marketing/api/store-kakao-collect'
import { S2_REGIONS } from '@/features/marketing/api/company-keyword-grid'
import { PRIORITY_UPJONG } from '@/features/marketing/api/store-prospects'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/store-kakao-collect.ts'), 'utf8')

describe('우선업종 그리드 — 대표가 지목한 넷을 카카오로 캔다', () => {
  it('🔒 category 가 PRIORITY_UPJONG 과 **글자까지** 일치한다 — 다르면 조용히 0 순위가 된다', () => {
    const cats = [...new Set(VOUCHER_TRADES.map(t => t.category))].sort()
    expect(cats).toEqual([...PRIORITY_UPJONG].sort())
  })

  it('🔒 네 업종이 **모두** 실제 키워드를 갖는다 — 하나라도 비면 그 업종은 영영 0 이다', () => {
    for (const c of PRIORITY_UPJONG) {
      expect(VOUCHER_TRADES.filter(t => t.category === c).length, `${c} 키워드 없음`).toBeGreaterThan(0)
    }
  })

  it('전국 지역 × 업태 전량을 만든다', () => {
    const rows = buildVoucherKeywords()
    expect(rows.length).toBe(S2_REGIONS.length * VOUCHER_TRADES.length)
    expect(new Set(rows.map(r => r.q)).size, '같은 곳을 두 번 조회하지 않는다').toBe(rows.length)
  })

  it('🔒 순서가 결정적이다 — 커서가 이 순서에 의존한다', () => {
    expect(buildVoucherKeywords().map(r => r.q)).toEqual(buildVoucherKeywords().map(r => r.q))
  })
})

describe('블록 분리 — 기존 무인 커서의 의미가 보존된다', () => {
  it('🔒 무인 그리드에 우선업종이 **섞이지 않았다** — 섞였으면 인덱스가 밀려 기존 커서가 딴 곳을 가리킨다', () => {
    const u = buildUnmannedKeywords()
    expect(u.length).toBe(S2_REGIONS.length * UNMANNED_TRADES.length)
    const voucherKws = new Set(VOUCHER_TRADES.map(t => t.kw))
    expect(u.some(r => voucherKws.has(r.q.slice(r.region.length + 1)))).toBe(false)
    // 첫 항목이 그대로여야 커서 0 의 의미가 같다
    expect(u[0].q).toBe(`${S2_REGIONS[0]} ${UNMANNED_TRADES[0].kw}`)
  })

  it('🔒 커서 키가 **서로 다르다** — 한 키를 공유하면 두 블록이 서로의 진행을 덮어쓴다', () => {
    const keys = [...SRC.matchAll(/ads_store_kakao_cursor\w*/g)].map(m => m[0])
    expect(new Set(keys).size, '커서 키가 하나뿐이다 = 블록이 진행을 공유한다').toBeGreaterThan(1)
    expect(SRC, '기존 키는 그대로여야 라이브 진행값을 이어받는다').toContain("'ads_store_kakao_cursor'")
  })

  it('🔒 두 블록의 커서가 **각각** 저장된다', () => {
    const saves = [...SRC.matchAll(/\.bind\((CURSOR_KEY\w*), String\(next\w+\)\)/g)].map(m => m[1])
    expect(new Set(saves)).toEqual(new Set(['CURSOR_KEY', 'CURSOR_KEY_VOUCHER']))
  })
})

describe('몫 배분 — 한쪽이 지갑을 비워 다른 쪽이 조용히 멈추지 않는다', () => {
  it('🔒 어떤 예산에서도 **양쪽 다 1 키워드 이상** — 0 이면 그 레인이 에러 없이 죽는다', () => {
    for (const left of [0, 1, 2, 3, 5, 10, 20, 26, 40, 57, 100]) {
      const s = blockSlots(left)
      expect(s.voucher, `left=${left}`).toBeGreaterThanOrEqual(1)
      expect(s.unmanned, `left=${left}`).toBeGreaterThanOrEqual(1)
    }
  })

  it('우선업종이 더 많이 가져간다 — 0 건에서 시작하는 쪽이 앞선다', () => {
    for (const left of [20, 26, 40, 57, 100]) {
      const s = blockSlots(left)
      expect(s.voucher, `left=${left}`).toBeGreaterThan(s.unmanned)
    }
  })

  it('예산이 커지면 슬롯도 커진다(단조) — 안 그러면 상한을 올려도 수확이 안 는다', () => {
    const seq = [10, 20, 40, 80].map(l => blockSlots(l).voucher + blockSlots(l).unmanned)
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThan(seq[i - 1])
  })

  it('🔒 앞 블록이 **예산을 남긴다** — 슬롯만 나누고 지갑을 비우면 뒤 블록은 첫 검사에서 튕긴다', () => {
    // 2026-08-02 ③: 페이지 수가 화면에서 조정 가능해져 유보분도 **설정값**으로 계산한다.
    //   상수로 두면 페이지를 낮췄을 때 필요 이상으로 떼어 뒤 블록이 굶는다.
    // ⚠️ 닫는 괄호로 앵커하지 않는다 — 뒤에 인자가 붙으면(커서 키 등) 코드가 맞는데도 빨간불이 뜬다.
    //   대신 **자리(슬롯 바로 다음 = 5번째 인자)** 로 고정한다.
    expect(SRC).toMatch(/runBlock\('voucher',[\s\S]{0,120}?slots\.voucher, slots\.unmanned \* cfg\.max_pages/)
    expect(SRC, 'floor 가 실제로 예산 검사에 쓰여야 한다').toMatch(/budget\.left <= saveReserve\(\) \+ floor/)
  })
})

describe('회차가 죽어서 커서를 못 올리는 일이 없다 (#927 과 같은 구조)', () => {
  it('🔒 마감선이 있고 **죽는 지점(26초)의 절반 이하**다', () => {
    const m = /const RUN_DEADLINE_MS = ([\d_]+)/.exec(SRC)
    expect(m, 'RUN_DEADLINE_MS 가 없다').toBeTruthy()
    expect(Number(m![1].replace(/_/g, ''))).toBeLessThanOrEqual(13_000)
  })

  it('🔒 마감선에서 **break** 한다 — return/throw 면 뒤의 커서 저장을 건너뛴다', () => {
    const loopAt = SRC.indexOf('outer: for (const win of rotationWindow')
    expect(loopAt).toBeGreaterThan(0)
    expect(SRC.slice(loopAt, loopAt + 700)).toMatch(/Date\.now\(\) - startedAt > RUN_DEADLINE_MS.*break outer/s)
  })

  it('🔒 커서 저장이 루프 **뒤**에 있다', () => {
    expect(SRC.indexOf('.bind(CURSOR_KEY, String(nextU))')).toBeGreaterThan(SRC.indexOf('outer: for (const win of rotationWindow'))
  })

  it('중단 사유·경과를 남긴다 — 매번 deadline 이면 슬라이스를 줄여야 한다는 신호다', () => {
    expect(SRC).toMatch(/stopped_by: stoppedBy/)
    expect(SRC).toMatch(/elapsed_ms: Date\.now\(\) - startedAt/)
  })
})

/**
 * 🏦 **중간 정산** — 회차가 끝까지 산다고 가정하지 않는다 (2026-08-02 실측 후 신설).
 *
 * 마지막에 한 번만 저장·전진하면, 회차가 중간에 죽을 때 **캔 것도 전진도 통째로** 사라진다.
 * 그리고 이 환경이 정확히 그렇다 — 정각 하트비트에서 다른 레인들이 `ms≈3.6초`에 CPU 한도로 죽는데
 * 이 레인의 완주 시간은 `elapsed_ms 8,097` 이다. **끝까지 사는 쪽이 예외다.**
 *
 * ⚠️ 이 시험이 못 보는 것: 실제로 죽었을 때 무엇이 남는지(런타임). 여기서는 *구조*만 고정한다 —
 *   ① 경계에서만 올린다 ② 두 곳의 커서 식이 같다 ③ 두 번 저장하지 않는다 ④ 합계가 누적된다.
 */
describe('중간 정산 — 죽어도 그때까지 캔 것은 남는다', () => {
  const flushAt = SRC.indexOf('if (cursorKey && rows.length >= FLUSH_ROWS)')
  const pageLoopEnd = SRC.indexOf('if (data?.meta?.is_end')
  const blockReturn = SRC.indexOf('return (cursor + consumed)')

  it('🔒 **키워드 경계**에서만 커서를 올린다 — 페이지 중간이면 안 본 페이지를 본 것으로 표시한다', () => {
    expect(flushAt, '중간 정산 호출이 없다').toBeGreaterThan(0)
    expect(flushAt, '페이지 루프 안쪽이다').toBeGreaterThan(pageLoopEnd)
    expect(flushAt, '키워드 루프 밖으로 나갔다').toBeLessThan(blockReturn)
  })

  it('🔒 중간 커서 값이 **최종 반환값과 같은 식** — 갈라지면 한쪽이 조용히 틀린 자리를 가리킨다', () => {
    expect(SRC.slice(flushAt, blockReturn)).toContain('(cursor + consumed) % Math.max(1, all.length)')
  })

  it('🔒 정산한 행은 **비운다** — 안 비우면 다음 정산이 같은 행을 또 저장하고 예산만 태운다', () => {
    expect(SRC).toMatch(/saveProspects\(DB, rows\.splice\(0\)\)/)
  })

  it('🔒 저장 합계가 **누적**된다 — 덮어쓰면 total_saved 와 업태 통계가 마지막 조각만 센다', () => {
    expect(SRC).toMatch(/saved \+= await saveProspects/)
    expect(SRC, 'saved 를 다시 const 로 잡으면 누적이 끊긴다').not.toMatch(/const saved = /)
  })

  it('🔒 블록 경계에서도 정산한다 — 뒤 블록에서 죽어도 앞 블록의 수확이 남아야 한다', () => {
    expect(SRC).toMatch(/await flushAt\(CURSOR_KEY_VOUCHER, nextV\)/)
  })
})

describe('재방문이 헛돌지 않는다', () => {
  it('🔒 키워드당 여러 페이지를 본다 — 1페이지(15건)만 보면 한 바퀴 뒤 재방문 수확이 **0** 이다', () => {
    const m = /const MAX_PAGES = (\d+)/.exec(SRC)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThan(1)
    expect(SRC, '페이지 파라미터가 실제로 URL 에 실려야 한다').toMatch(/size=15&page=\$\{page\}/)
  })

  it('🔒 지역을 **주소에서** 유도한다 — 키워드 지역을 박으면 같은 가게가 이웃 구마다 별개 행이 된다', () => {
    // 파트너 풀에서 같은 실수로 중복 38.4% 가 났고 regionFromAddress 로 고쳤다. 같은 함수를 쓴다.
    expect(SRC).toMatch(/import \{ regionFromAddress \}/)
    expect(SRC).toMatch(/const region = regionFromAddress\(road \|\| lot, kwRegion\)/)
    expect(SRC, '복합키 2번째도 유도된 지역이어야 UNIQUE 가 먹는다').toMatch(/opn_sf_team_code: region\.slice/)
  })
})
