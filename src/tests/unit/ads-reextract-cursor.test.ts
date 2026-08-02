/**
 * 🅿️ **재추출 커서 주차** — "다 훑었으면 0 으로 되돌린다"가 같은 단계의 뒤 작업을 죽이고 있었다.
 *
 * ## 라이브 실측 (2026-08-02)
 * `ads:maintenance?phase=reextract` 가 `err=Error`(ms 13,541)로 죽고 있었고,
 * `ads_maintenance_last` 에 `region`·`cafemembers` 키가 **한 번도** 나타난 적이 없었다.
 * 둘 다 재추출 *다음*에 서 있어서다.
 *
 * 원인은 커서 저장 한 줄이었다: `String(done ? 0 : cursor)`. 전수를 다 훑으면 0 으로 되돌아가
 * **매 회차가 36,880행을 처음부터 다시** 훑었다(라이브 `scanned: 36,880 · filled: 0` — 저장 시점에
 * 이미 추출하므로 재수확이 구조적으로 0). 그 CPU 로 인보케이션이 끝나 뒤의 작업은 시작조차 못 했다.
 *
 * ⇒ 다 훑었으면 **그 자리에 주차**한다. 전수 재스캔은 `REEXTRACT_RULES_VERSION` bump 로만.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 인보케이션이 CPU 안에 드는지는 코드로 못 본다(라이브 사실).
 *   여기서 고정하는 건 **커서 계약**뿐이다 — 판정은 `ads_maintenance_last` 에 `region`/`cafemembers`
 *   키가 나타나는지로 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  parseReextractCursor, formatReextractCursor, REEXTRACT_RULES_VERSION, sweepRegions,
} from '../../features/marketing/api/influencer-maintenance'
import { newOpBudget, budgetedDb } from '../../features/marketing/api/maintenance-budget'
import { parseCafeMembersFromBytes, CAFE_ABORT_AFTER_FAILS } from '../../features/marketing/api/influencer-cafe-members'

describe('재추출 커서 — 규칙 버전이 붙은 형태', () => {
  const V = REEXTRACT_RULES_VERSION

  it('같은 버전이면 커서를 그대로 이어받는다', () => {
    expect(parseReextractCursor(formatReextractCursor(V, 41234), V)).toBe(41234)
  })

  it('🔁 버전이 다르면 0 — 규칙을 고쳤을 때만 전수 한 바퀴', () => {
    expect(parseReextractCursor(`${V + 1}:41234`, V)).toBe(0)
    expect(parseReextractCursor(`${V - 1}:41234`, V)).toBe(0)
  })

  it('🕰️ 옛 형태(숫자만)는 version 0 으로 읽혀 배포 직후 딱 한 바퀴 전수를 돈다', () => {
    // 라이브에 이미 `"36880"` 같은 값이 들어 있다. 그걸 그대로 커서로 쓰면 개선된 추출 규칙이
    // 기존 행에 한 번도 안 닿으므로, 형태 전환 시점엔 의도적으로 0(전수)이 나와야 한다.
    expect(parseReextractCursor('36880', V)).toBe(0)
  })

  it('빈값·쓰레기·음수는 0(안전한 방향 = 전수)', () => {
    for (const raw of [null, undefined, '', '   ', 'abc', `${V}:-5`, `${V}:abc`, `${V}:`]) {
      expect(parseReextractCursor(raw, V), `raw=${String(raw)}`).toBe(0)
    }
  })

  it('직렬화는 정수로 고정된다(부동소수·NaN 이 저장되면 다음 파싱이 통째로 0 이 된다)', () => {
    expect(formatReextractCursor(V, 12.9)).toBe(`${V}:12`)
    expect(formatReextractCursor(V, Number.NaN)).toBe(`${V}:0`)
    expect(formatReextractCursor(V, -3)).toBe(`${V}:0`)
  })
})

/**
 * 🔒 소스 계약 — 실수로 옛 동작(`done ? 0 : cursor`)이 되돌아오면 라이브에서 조용히 재발한다
 *   (에러가 아니라 *뒤 작업이 안 도는* 형태라 하트비트만 봐선 안 보인다).
 */
describe('재추출 단계 — 소스 불변식', () => {
  const src = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-maintenance.ts'), 'utf8')

  it('🚫 done 일 때 커서를 0 으로 되돌리지 않는다', () => {
    expect(src).not.toMatch(/String\(\s*done\s*\?\s*0\s*:/)
    expect(src).toMatch(/formatReextractCursor\(REEXTRACT_RULES_VERSION,\s*cursor\)/)
  })

  it('📌 지역 백필·카페 회원수가 재추출보다 **앞**에 있다 — 뒤에 두면 CPU 를 못 받는다', () => {
    const block = /phase === 'reextract'\)\s*\{([\s\S]*?)\n {4}\}/.exec(src)?.[1] || ''
    expect(block, "reextract 분기를 못 찾음 — 형태가 바뀌었으면 이 정규식도 함께").not.toBe('')
    const iRegion = block.indexOf('sweepRegions')
    const iCafe = block.indexOf('fillCafeMemberCounts')
    const iReex = block.indexOf('reextractPoolContacts')
    expect(iRegion, 'sweepRegions 호출 없음').toBeGreaterThanOrEqual(0)
    expect(iCafe, 'fillCafeMemberCounts 호출 없음').toBeGreaterThanOrEqual(0)
    expect(iReex, 'reextractPoolContacts 호출 없음').toBeGreaterThanOrEqual(0)
    expect(iRegion).toBeLessThan(iReex)
    expect(iCafe).toBeLessThan(iReex)
  })
})

/**
 * 🅰️ **예약** — 앞선 작업이 예산을 다 먹으면 뒤 작업은 *한 번도* 안 돈다.
 *
 *   지역 스윕은 `budget.left` 가 바닥날 때까지 도는 구조다. 그래서 순서를 바꾸는 것만으로는
 *   부족하다 — 앞에 세운 쪽이 전부 가져가면 카페·재추출이 굶어 **같은 병이 자리만 바꿔 재발**한다.
 *   (실제로 이번 수리 도중 그 함정에 한 번 빠졌다: 지역을 앞으로 옮기고 나서야 발견했다.)
 */
describe('지역 스윕 — 뒤 작업 몫 예약', () => {
  /**
   * 청크마다 `rowsPerChunk` 행을 돌려주는 최소 D1 스텁.
   * ⚠️ 반드시 `budgetedDb` 로 감싸 넘긴다 — 예산 차감은 그 래퍼가 한다. 생 스텁을 넘기면
   *   `budget.left` 가 줄지 않아 루프가 **영원히 돈다**(이 테스트를 처음 쓸 때 실제로 그랬다).
   */
  const stubDB = (rowsPerChunk: number, budget: ReturnType<typeof newOpBudget>) => {
    const prep = () => ({
      bind: () => ({
        first: async () => null,
        all: async () => ({ results: Array.from({ length: rowsPerChunk }, (_, i) => ({ id: i + 1, source_keyword: '강남 맛집', region: null })) }),
        run: async () => ({ meta: { changes: rowsPerChunk } }),
      }),
    })
    const raw = { prepare: prep, batch: async () => [] } as unknown as Parameters<typeof sweepRegions>[0]
    return budgetedDb(raw, budget)
  }

  it('예약분은 남긴다 — 뒤 작업이 쓸 예산이 0 이 되지 않는다', async () => {
    const budget = newOpBudget(50)
    await sweepRegions(stubDB(500, budget), budget, 22)
    expect(budget.left, '예약 22 를 남기고 멈춰야 한다').toBeGreaterThanOrEqual(22)
  })

  it('예약이 0 이면 예전처럼 바닥까지 쓴다(기본 동작 보존)', async () => {
    const noReserve = newOpBudget(50)
    await sweepRegions(stubDB(500, noReserve), noReserve)
    const withReserve = newOpBudget(50)
    await sweepRegions(stubDB(500, withReserve), withReserve, 22)
    expect(noReserve.left).toBeLessThan(withReserve.left)
  })

  it('예산이 예약보다 적으면 청크를 시작하지 않는다(반쯤 하다 마는 것보다 낫다)', async () => {
    const budget = newOpBudget(10)
    const r = await sweepRegions(stubDB(500, budget), budget, 22)
    expect(r.chunks, '예약도 못 채우는데 청크를 시작했다').toBe(0)
    // ⚠️ `left` 가 10 그대로는 아니다 — 루프 전에 `recheckBlankRegions`(규칙 버전 확인)가 몇 ops 쓴다.
    //   그건 청크가 아니라 **1회성 점검**이라 예약 대상이 아니다. 여기선 "청크로 다 태우지 않았다"만 본다.
    expect(budget.left, '청크를 안 돌렸는데 예산이 크게 줄었다').toBeGreaterThan(3)
  })
})

/**
 * 🏘️ **카페 회원수** — 자리는 잡혔는데 라이브 첫 회차가 `selected 20 · tried 3 · filled 0 · failed 3` 이었다.
 *   두 결함이 겹쳐 있다: ① 예산이 3건 만에 바닥(예약이 안 먹음) ② 3건 전부 파싱 실패.
 *
 *   ①은 **순서**로 고쳤다 — 상한 있는 일(카페)을 앞에, 남는 걸 다 쓰는 일(지역)을 뒤에.
 *     예약은 "앞 작업이 얼마를 쓰는지"를 정확히 알아야 성립하는데 지역 청크의 ops 는 고정이 아니다.
 *     **예약(계산)보다 순서(구조)가 덜 틀린다.**
 *   ②는 원인을 아직 모른다 — 이 환경은 `cafe.naver.com` 이 프록시에 막혀 직접 확인이 불가능하다.
 *     그래서 추측으로 URL 을 바꾸지 않고 **워커가 본 것을 남기는 표본**을 넣었다(status/len/peek).
 */
describe('카페 회원수 — 순서로 굶주림을 막는다', () => {
  const maint = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-maintenance.ts'), 'utf8')
  const cafe = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-cafe-members.ts'), 'utf8')

  it('🔒 카페가 지역보다 앞이다 — 뒤에 두면 남는 걸 다 쓰는 쪽에 굶는다', () => {
    const block = /phase === 'reextract'\)\s*\{([\s\S]*?)\n {4}\}/.exec(maint)?.[1] || ''
    expect(block, 'reextract 분기를 못 찾음').not.toBe('')
    expect(block.indexOf('fillCafeMemberCounts')).toBeLessThan(block.indexOf('sweepRegions'))
  })

  it('🔒 카페는 상한이 있다 — 없으면 앞에 둔 것이 오히려 지역을 굶긴다', () => {
    expect(maint).toMatch(/const CAFE_MAX = \d+/)
    expect(maint).toMatch(/fillCafeMemberCounts\(bdb, POOL, budget, CAFE_MAX\)/)
  })

  it('🔬 실패하면 표본을 남긴다 — 원인 셋(차단·프레임셋·정규식)은 처방이 전혀 다르다', () => {
    expect(cafe).toMatch(/diag\.samples \|\|= \[\]/)
    expect(cafe).toMatch(/status: res\.status/)
  })

  it('표본은 HTML 원문이 아니라 태그를 걷은 요약이다(설정값 크기·개인정보)', () => {
    const peek = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    expect(peek('<div>멤버수 <b>12,345</b></div>')).toBe('멤버수 12,345')
    expect(cafe).toMatch(/export function peekMembers/)
  })

  /**
   * 🔤 **원인 확정 (2026-08-02 라이브 표본)** — 위 표본이 답을 줬다:
   *   `status 200 · len 200,000 · peek '::�ǻ�::�Ǽ���...'`
   *   차단(ⓐ)도 프레임셋(ⓑ)도 아니고 **EUC-KR 페이지를 UTF-8 로 디코딩**한 것이었다(18/18 실패).
   *   ⚠️ 이 테스트가 못 보는 것: 실제 카페 HTML 의 마크업 모양. 여전히 프록시에 막혀 있고,
   *     숫자를 태그가 쪼개면 앞 조각만 잡힐 수 있다 — 그때는 새 표본(ASCII 창)이 말해 준다.
   */
  it('🔤 EUC-KR 바이트에서 회원수를 뽑는다 — 디코더 지원 여부에 안 걸린다', () => {
    const euckr = (s: string): number[] => ({ 멤버: [0xb8, 0xe2, 0xb9, 0xf6], 회원: [0xc8, 0xb8, 0xbf, 0xf8] }[s] || [])
    const bytes = (label: string, tail: string) =>
      new Uint8Array([...euckr(label), ...[...tail].map(c => c.charCodeAt(0))])
    expect(parseCafeMembersFromBytes(bytes('멤버', '수 12,345명'))).toBe(12345)
    expect(parseCafeMembersFromBytes(bytes('회원', '</span><em>7,001</em>'))).toBe(7001)
    // 라벨이 없으면 아무 숫자나 집지 않는다 — 글 수를 회원수로 적는 건 0 보다 나쁜 실패다.
    expect(parseCafeMembersFromBytes(new Uint8Array([...'게시글 98,765'].map(c => c.charCodeAt(0))))).toBe(null)
    // 상한 밖(조회수 오집)은 버린다.
    expect(parseCafeMembersFromBytes(bytes('멤버', ' 99,999,999'))).toBe(null)
  })

  it('🛑 전량 실패면 회차를 접는다 — #957 이 카페를 앞에 두면서 지역·재추출을 굶긴 회귀', () => {
    // 라이브 실측: cafemembers tried 18/failed 18 인 회차에서 region {filled:0} · reextract {scanned:0}.
    expect(CAFE_ABORT_AFTER_FAILS).toBeGreaterThan(0)
    expect(CAFE_ABORT_AFTER_FAILS).toBeLessThan(20) // 상한(CAFE_MAX)보다 훨씬 작아야 의미가 있다
    expect(cafe).toMatch(/diag\.filled === 0 && diag\.failed >= CAFE_ABORT_AFTER_FAILS/)
    expect(cafe).toMatch(/diag\.aborted = true/)
  })

  it('🔒 바이트로 받는다 — res.text() 는 무조건 UTF-8 이라 같은 사고가 재발한다', () => {
    expect(cafe).toMatch(/await res\.arrayBuffer\(\)/)
    expect(cafe).not.toMatch(/await res\.text\(\)/)
  })
})
