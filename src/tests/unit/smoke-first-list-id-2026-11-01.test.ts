/**
 * 🧪 **배포 후 상품 상세 스모크가 실제로 도는가** — `scripts/first-list-id.mjs` (2026-11-01).
 *
 * ## 무엇이 잘못돼 있었나
 * `main.yml` 의 상품 상세 스모크는 목록에서 첫 id 를 꺼내 `/api/products/<id>` 를 찔렀다.
 * 그 추출을 YAML 안 python 일행으로 했고 첫 분기가 `(d.get('data') or {}).get('products')` 였다.
 * 라이브 `/api/products` 는 `{success, data:[…], pagination}` — **`data` 가 리스트**다(실측).
 * 리스트는 truthy 라 `.get` 에서 **AttributeError** 가 나고, 뒤에 붙인 `or` 폴백 셋은 **도달조차
 * 못 했다**. 그 예외를 `2>/dev/null` 이 숨기고 `|| echo ""` 가 빈 값으로 바꿔
 * `⚠️ 상품 목록 파싱 실패 — 상품 상세 smoke skip` 이 됐다.
 *
 * ⇒ 이 검사는 **모든 배포에서 조용히 건너뛰어졌다.** 하필 2026-06-10 교환권 상세 500 사고
 * (`SELECT p.*` 컬럼 한도 — *목록은 멀쩡한데 상세만 깨진다*)를 잡으려고 만든 검사다. 즉
 * 존재하고 등록돼 있고 매 배포 실행되는데 **발화할 수 없는** 가드였다.
 *
 * 🧭 방어하려고 붙인 `or` 사슬이 **흔한 경우에서 먼저 터지는** 모양이었다는 점이 핵심이다.
 *    일행은 제어 흐름을 못 쓰니 사슬이 되고, 사슬은 순서가 곧 규칙이라 조용히 틀린다.
 *
 * ## 이 테스트가 지키는 것 — **양방향**
 *   ① 라이브 모양(`data` 가 리스트)에서 id 를 꺼낸다 ← 바로 그 결함
 *   ② 다른 두 모양(`data.products` · 최상위 `products`)도 받는다(폴백이 살아 있다)
 *   ③ 목록이 **빈 것**과 **못 찾은 것**을 가른다 — 종전엔 둘 다 빈 문자열이라 호출부가 구분 불가
 *   ④ 숫자가 아닌 id 는 통과시키지 않는다 — `/api/products/undefined` 가 404 로 "정상" 처리된다
 *   ⑤ 워크줄로가 그 모듈을 쓰고, 못 찾으면 **실패**시킨다(조용한 skip 으로 되돌아가지 않는다)
 * ①만 있으면 ③⑤ 를 풀어 "고친" 척할 수 있고, ⑤만 있으면 파서가 다시 틀려도 초록이 뜬다.
 *
 * ## 못 막는 것
 * - 러너에서 `node` 가 그 시점에 실행 가능한가(워크플로 환경 — checkout·setup-node 뒤라 전제한다).
 * - 라이브 응답 모양이 **또** 바뀌는 것. 그때는 ⑤의 실패 분기가 **시끄럽게** 알린다(그게 설계다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pickFirstId, formatPick } from '../../../scripts/first-list-id.mjs'

const WF_RAW = readFileSync(resolve(process.cwd(), '.github/workflows/main.yml'), 'utf8')
/** 🩸 판정은 **주석을 뺀 실행되는 줄**로 한다. 제거를 기록하는 주석이 옛 일행을 인용하므로
 *   원문을 검사하면 거짓 빨간불이 난다(이 테스트의 첫 판이 실제로 그랬다). */
const WF = WF_RAW.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

/** 라이브 실측 모양(2026-11-01 `curl https://urdeal.kr/api/products?limit=1`). */
const LIVE = { success: true, data: [{ id: 3120, name: '…' }], pagination: { page: 1 } }

describe('배포 후 상품 상세 스모크: 첫 id 추출', () => {
  it('🔒 ① 라이브 모양(data 가 리스트)에서 id 를 꺼낸다 — 조용히 skip 되던 자리', () => {
    expect(pickFirstId(LIVE)).toEqual({ id: 3120 })
    expect(formatPick(pickFirstId(LIVE))).toBe('3120')
  })

  it('🔒 ② 다른 두 모양도 받는다 — 폴백이 살아 있다', () => {
    expect(pickFirstId({ data: { products: [{ id: 7 }] } })).toEqual({ id: 7 })
    expect(pickFirstId({ products: [{ id: 9 }] })).toEqual({ id: 9 })
    expect(pickFirstId({ data: [{ id: '42' }] })).toEqual({ id: 42 })   // 문자열 숫자도 id 다
  })

  it('🔒 ③ "비었다" 와 "못 찾았다" 를 가른다 — 종전엔 둘 다 빈 문자열이었다', () => {
    expect(formatPick(pickFirstId({ success: true, data: [] }))).toBe('__EMPTY__')
    expect(formatPick(pickFirstId({ data: { products: [] } }))).toBe('__EMPTY__')
    for (const bad of [{ success: true }, { data: 'nope' }, { data: 42 }, {}]) {
      expect(formatPick(pickFirstId(bad)), JSON.stringify(bad)).toMatch(/^__FAIL__ /)
    }
    // 최상위가 객체가 아닌 경우(배열·문자열·null)도 "못 찾았다" 다 — 빈 것이 아니다.
    for (const bad of [[], [{ id: 1 }], 'x', null, 3]) {
      expect(formatPick(pickFirstId(bad as never)), JSON.stringify(bad)).toMatch(/^__FAIL__ /)
    }
  })

  it('🔒 ④ 숫자가 아닌 id 는 통과시키지 않는다 — /api/products/undefined 가 404 로 "정상" 이 된다', () => {
    for (const id of [undefined, null, 'abc', '', {}, [], NaN, true]) {
      const out = formatPick(pickFirstId({ data: [{ id }] }))
      expect(out, `id=${JSON.stringify(id)}`).toMatch(/^__FAIL__ /)
    }
    // 첫 항목이 객체가 아닌 경우도 마찬가지.
    expect(formatPick(pickFirstId({ data: ['3120'] }))).toMatch(/^__FAIL__ /)
  })

  it('🔒 ⑤ 워크플로가 그 모듈을 쓰고, 못 찾으면 실패시킨다 — 조용한 skip 금지', () => {
    expect(WF, '스모크가 모듈을 안 쓴다').toMatch(/node scripts\/first-list-id\.mjs/)
    // 종전 일행이 되살아나면 빨간불.
    expect(WF, '옛 python 일행이 되살아났다').not.toMatch(/\(d\.get\('data'\) or \{\}\)\.get\('products'\)/)
    // 못 찾은 경우가 FAIL 로 집계돼야 한다(경고만 찍고 넘어가면 또 조용해진다).
    const seg = WF.slice(WF.indexOf('P_OUT='), WF.indexOf('check "/api/wholesale/mall"'))
    expect(seg, '스모크 블록을 못 찾았다 — 이 테스트를 재조준할 것').toContain('first-list-id')
    expect(seg, '못 찾은 경우가 FAIL 로 집계되지 않는다').toMatch(/FAIL=\$\(\(FAIL \+ 1\)\)/)
    expect(seg, '"비었다" 분기가 없다 — 빈 목록까지 실패시키면 거짓 빨간불이 된다').toContain('__EMPTY__')
  })
})
