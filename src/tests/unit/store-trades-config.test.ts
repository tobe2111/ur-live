/**
 * 🎛️ **매장 수집 업태를 DB 로** — 계약 (2026-08-02 대표 "페이지에서 직접 설정", ②).
 *
 * ## 여기서 제일 틀리기 쉬운 것: **폴백 규칙**
 * 두 가지 "비었음"이 있고 뜻이 정반대다.
 * - 읽기 실패 / 테이블 자체가 빔 → **코드 상수로 폴백**(설정 조회 실패로 수집을 멈추면 안 된다)
 * - 읽었는데 그 블록의 활성 업태가 0 → **폴백하면 안 된다**. 그건 고장이 아니라 **대표의 선택**이고,
 *   여기서 상수로 되돌리면 끈 것이 조용히 되살아난다 — 설정이 무력화되는 가장 나쁜 실패다.
 *
 * 이 구분이 무너지면 화면은 OFF 인데 수집은 계속 돈다. 에러도 안 난다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 D1 동작(발행 SQL·배선의 문자열만 본다). 라이브 판정은 어드민 화면의 `active` 변화로.
 * - 커서 점프의 체감(업태를 끄면 위치가 옮겨간다) — `rotationWindow` 가 modulo 라 영구 건너뜀은 없다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { seedStoreTrades, seedFingerprint, STORE_TRADE_BLOCKS } from '@/features/marketing/api/store-trades'
import { VOUCHER_TRADES, UNMANNED_TRADES, buildVoucherKeywords } from '@/features/marketing/api/store-kakao-collect'
import { S2_REGIONS } from '@/features/marketing/api/company-keyword-grid'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const TRADES = SRC('src/features/marketing/api/store-trades.ts')
const LANE = SRC('src/features/marketing/api/store-kakao-collect.ts')
const ROUTES = SRC('src/features/marketing/api/store-prospects.routes.ts')
const PAGE = SRC('src/pages/admin/AdminStoreProspectsPage.tsx')

describe('시드 — 코드 상수가 원본이고, 어드민이 끈 것을 되살리지 않는다', () => {
  it('두 블록의 업태가 모두 시드된다', () => {
    const rows = seedStoreTrades()
    expect(rows.length).toBe(VOUCHER_TRADES.length + UNMANNED_TRADES.length)
    for (const b of STORE_TRADE_BLOCKS) expect(rows.some(r => r.block === b), `${b} 없음`).toBe(true)
  })

  it('🔒 `INSERT OR IGNORE` 다 — `REPLACE`/`UPSERT` 면 재배포마다 대표 설정이 날아간다', () => {
    expect(TRADES).toMatch(/INSERT OR IGNORE INTO ad_store_trades/)
    expect(TRADES, 'active 를 덮어쓰는 문장이 있으면 안 된다').not.toMatch(/INSERT OR REPLACE INTO ad_store_trades/)
  })

  it('🔒 지문이 내용에 반응한다 — 안 그러면 새 업태를 넣어도 시드가 안 돈다', () => {
    const base = seedFingerprint()
    expect(seedFingerprint()).toBe(base)
    expect(seedFingerprint([{ block: 'voucher', kw: 'zz-테스트', category: '일반음식점' }])).not.toBe(base)
  })
})

describe('폴백 — 두 가지 "비었음"을 구분한다', () => {
  it('🔒 조회 실패/테이블 빔 → `null` 을 돌려준다(호출부가 상수로 폴백할 수 있게)', () => {
    expect(TRADES).toMatch(/if \(!all \|\| !all\.length\) return null/)
  })

  it('🔒 레인이 `null` 일 때만 상수로 폴백한다 — 빈 배열은 **의도적으로 끈 것**이라 존중', () => {
    expect(LANE).toMatch(/const voucherTrades = dbTrades \? \(dbTrades\.voucher \|\| \[\]\) : VOUCHER_TRADES/)
    expect(LANE).toMatch(/const unmannedTrades = dbTrades \? \(dbTrades\.unmanned \|\| \[\]\) : UNMANNED_TRADES/)
  })

  it('🔒 업태가 0개인 블록은 **돌지 않고 커서도 그대로** — 빈 그리드로 돌면 커서만 헛돈다', () => {
    expect(LANE).toMatch(/voucherTrades\.length \? await runBlock\('voucher'/)
    expect(LANE).toMatch(/: cursorV/)
    expect(LANE).toMatch(/unmannedTrades\.length \? await runBlock\('unmanned'/)
  })
})

describe('그리드 — 업태가 주입돼도 모양이 유지된다', () => {
  it('주입한 업태로만 (지역 × 업태) 를 만든다', () => {
    const rows = buildVoucherKeywords([{ kw: '카페', category: '휴게음식점' }])
    expect(rows.length).toBe(S2_REGIONS.length)
    expect(rows[0].q).toBe(`${S2_REGIONS[0]} 카페`)
    expect(rows[0].category).toBe('휴게음식점')
  })

  it('🔒 업태 이름을 **키워드에서 역산하지 않는다** — 지역명에 공백이 있으면 갈린다(\'부산 해운대\')', () => {
    const rows = buildVoucherKeywords([{ kw: '카페', category: '휴게음식점' }])
    const busan = rows.find(r => r.region === '부산 해운대')
    expect(busan, '공백 포함 지역이 그리드에 있어야 이 위험이 실재한다').toBeTruthy()
    expect(busan!.trade, 'trade 를 함께 들고 다녀야 한다').toBe('카페')
    expect(busan!.q).toBe('부산 해운대 카페')
  })

  it('기본값은 코드 상수 — 인자 없이 부르는 기존 호출이 그대로 동작한다', () => {
    expect(buildVoucherKeywords().length).toBe(S2_REGIONS.length * VOUCHER_TRADES.length)
  })
})

describe('예산 — 설정 조회도 같은 지갑에서 낸다', () => {
  it('🔒 시드/조회/통계 비용을 예산에서 뺀다 — 안 빼면 시드 회차에만 조용히 천장을 넘는다', () => {
    expect(LANE).toMatch(/budget\.left -= await ensureStoreTrades\(DB\)/)
    expect(LANE).toMatch(/budget\.left -= 2/)
    expect(TRADES, 'ensure 는 쓴 서브리퀘스트 수를 돌려줘야 호출부가 뺄 수 있다').toMatch(/Promise<number>/)
  })

  it('🔒 시드는 `DB.batch` 한 번 — 19개를 개별 INSERT 하면 그 회차 수집이 통째로 굶는다', () => {
    expect(TRADES).toMatch(/await DB\.batch\(\[ \/\/ batch = 1 서브리퀘스트/)
  })
})

describe('마지막 활성 업태는 못 끈다', () => {
  it('🔒 거부하고 사유를 돌려준다', () => {
    expect(TRADES).toMatch(/LAST_ACTIVE_TRADE/)
    const at = TRADES.indexOf('if (!active) {')
    expect(at).toBeGreaterThan(0)
    expect(TRADES.slice(at, at + 700)).toMatch(/<= 1\) return \{ ok: false, error: 'LAST_ACTIVE_TRADE' \}/)
  })
})

describe('배선 — 없으면 기능이 아니다', () => {
  it('🔒 `/trades` 가 `/:id` **위**에 마운트된다 — 아래면 :id 로 먹혀 조용히 404', () => {
    const t = ROUTES.indexOf("app.get('/trades'")
    const id = ROUTES.indexOf("app.patch('/:id'")
    expect(t).toBeGreaterThan(0)
    expect(id).toBeGreaterThan(0)
    expect(t, '/trades 가 /:id 보다 뒤에 있다').toBeLessThan(id)
  })

  it('🔒 매장 페이지가 **매장 엔드포인트**로 패널을 띄운다(파트너 것을 부르면 남의 풀을 끈다)', () => {
    expect(PAGE).toMatch(/<TradePanel endpoint="\/api\/admin\/store-prospects\/trades"/)
    expect(PAGE).toMatch(/adapt=\{adaptStoreTrades\}/)
  })
})
