/**
 * 🏪 가게 관리 6종 추가 — 그리고 **요약이 남의 틀로 위장하지 않는다** (2026-10-25).
 *
 * 대표 지시: *"위 업종들도 받아야 해"* (방역·후드·수리 외에 냉장·냉동 설비 수리 · 가게 에어컨 ·
 * 정기 청소 · 정화조·배수구 · 간판 · 인테리어).
 *
 * ## 이 시험이 막는 것
 *
 * 🩸 `requestSummary` 는 `if (category === …)` 체인이고 **마지막 줄이 폴백**이다. 추가 전에는 그
 * 폴백이 **숙소 틀**(`'… · - -실 · - · -'`)이라, 새 카테고리를 넣는 순간 그 문장이 **사장님 알림톡에
 * 그대로 나갔다**(실측: 6종 전부 `- -실` 로 나왔다). 에러는 0건이다.
 *
 * ⚠️ 폴백을 범용(`주소 · 업종`)으로 바꾸면 **기존 가드가 이 결함을 더는 못 잡는다** — 그 가드는
 * "요약에 빈칸 `-` 가 없다" 를 보는데 범용 폴백은 빈칸이 없어 통과한다. 그래서 여기서 **카테고리마다
 * 자기 분기를 갖는지**를 따로 고정한다(폴백은 "안 만든 것" 의 신호로만 남는다).
 *
 * ## 이 시험이 못 보는 것
 *
 * · 요약 문장이 사장님에게 **읽기 좋은지**(사람이 본다).
 * · 카카오 알림톡 템플릿 등록 여부 — 본문은 `HOME_TPL` 이고 요약은 그 안의 변수다.
 * · 그 업종 업체가 실제로 풀에 있는지(유어애즈 쪽 모수 — 다른 레일).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { HOME_SERVICE_CATEGORIES, requestSummary } from '@/shared/home-service'

const SRC = readCode('src/shared/home-service.ts')

/** 2026-10-25 대표 표의 추가 6종. */
const ADDED = ['store_clean', 'store_fridge', 'store_aircon', 'store_drain', 'store_sign', 'store_interior'] as const

describe('가게 관리 6종 (2026-10-25)', () => {
  it('① 6종이 전부 사장님(biz) 카테고리로 들어왔다', () => {
    const biz = HOME_SERVICE_CATEGORIES.filter(d => d.audience === 'biz').map(d => d.key)
    for (const k of ADDED) expect(biz, `${k} 가 빠졌다`).toContain(k)
  })

  it('② **모든** 카테고리가 `requestSummary` 에 자기 분기를 갖는다 — 폴백 위장 차단', () => {
    const fn = SRC.slice(SRC.indexOf('export function requestSummary'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    expect(body.length, 'requestSummary 본문을 못 떼어냈다 — 이름이 바뀌었으면 재조준할 것').toBeGreaterThan(200)
    for (const d of HOME_SERVICE_CATEGORIES) {
      expect(body, `${d.key}(${d.label}) 의 요약 분기가 없다 — 폴백으로 떨어져 남의 틀이 알림톡에 나간다`)
        .toContain(`category === '${d.key}'`)
    }
    // 🩸 그리고 **폴백 자체**가 특정 업종의 틀이면 안 된다. 이건 행동으로 판정할 수 없다 —
    //   지금은 모든 카테고리가 자기 분기를 가져 폴백에 **도달하지 않으므로**, 폴백을 숙소 틀로
    //   되돌려도 출력이 1바이트도 안 바뀐다(주입이 실제로 그걸 통과시켰다). 그래서 소스로 고정한다.
    const fallback = body.slice(body.lastIndexOf('\n  return '))
    expect(fallback, '폴백이 숙소 전용 칸(lodging/rooms)을 참조한다 — 다음에 추가하는 카테고리가 숙소처럼 위장된다')
      .not.toMatch(/d\.(lodging|rooms|service|cycle)\b/)
    expect(fallback, '폴백이 비었다 — 요약이 undefined 가 되면 알림톡 본문이 깨진다').toContain('d.address')
  })

  it('③ 요약은 **필수 칸만** 쓴다 — 선택 칸을 쓰면 빈칸이 알림톡에 박힌다', () => {
    for (const d of HOME_SERVICE_CATEGORIES) {
      // 필수 칸만 채운 입력(선택 칸은 일부러 비운다)
      const filled: Record<string, string> = {}
      for (const f of d.fields) if (f.required) filled[f.key] = f.type === 'number' ? '10' : (f.options?.[0] ?? '값')
      const out = requestSummary(d.key, filled)
      // 🩸 `/(^|\s)-(\s|$)/` 로는 **단위가 붙은 빈칸을 못 잡는다**(`-m` · `-실` · `-평` · `-대`).
      //   주입이 `width`(선택 칸)를 요약에 끼워 넣었는데 `'· -m'` 이 그 정규식을 통과했다.
      //   필수 칸을 전부 채웠고 입력값에 `-` 를 쓰지 않았으므로, 결과에 `-` 가 **하나도** 없어야 한다.
      expect(out, `${d.key}(${d.label}) 요약에 빈칸이 있다 — 선택 칸을 요약에 넣었거나 분기가 없다`)
        .not.toContain('-')
    }
  })

  it('④ 꺼낸 셋이 `store_repair` 에 남아 있지 않다 — 같은 요청이 두 경로로 들어오면 안 된다', () => {
    const repair = HOME_SERVICE_CATEGORIES.find(d => d.key === 'store_repair')!
    const kind = repair.fields.find(f => f.key === 'kind')!
    const opts = (kind.options ?? []).join('|')
    // 알림이 **카테고리 단위**라, 수리 안에 남겨 두면 냉장 설비 업체와 전기 업체에게 같은 요청이 함께 간다.
    expect(opts, '냉장·냉동이 수리 안에 남아 있다').not.toMatch(/냉장|냉동/)
    expect(opts, '에어컨이 수리 안에 남아 있다').not.toMatch(/에어컨/)
    expect(opts, '간판이 수리 안에 남아 있다').not.toMatch(/간판/)
    // 그래도 수리 자체는 살아 있어야 한다(전기·배관은 전용 카테고리가 없다)
    expect(opts).toMatch(/전기/)
    expect(opts).toMatch(/배관|누수/)
  })

  it('⑤ 6종의 지역·날짜 칸이 실제로 있는 칸을 가리킨다', () => {
    for (const k of ADDED) {
      const d = HOME_SERVICE_CATEGORIES.find(c => c.key === k)!
      const keys = d.fields.map(f => f.key)
      for (const r of d.regionFields) expect(keys, `${k}: regionFields '${r}' 칸이 없다`).toContain(r)
      expect(keys, `${k}: dateField '${d.dateField}' 칸이 없다`).toContain(d.dateField)
      // 지역 칸은 type 이 region 이어야 사장님 지역 매칭이 돈다
      for (const r of d.regionFields) expect(d.fields.find(f => f.key === r)!.type).toBe('region')
      expect(d.fields.find(f => f.key === d.dateField)!.type).toBe('date')
    }
  })

  it('⑥ crossSell 목적지가 실재하고 carry 가 양쪽 칸을 가리킨다', () => {
    const all = new Set(HOME_SERVICE_CATEGORIES.map(d => d.key))
    for (const d of HOME_SERVICE_CATEGORIES) {
      if (!d.crossSell) continue
      expect(all, `${d.key}: crossSell 목적지 ${d.crossSell.to} 가 없다`).toContain(d.crossSell.to)
      const to = HOME_SERVICE_CATEGORIES.find(c => c.key === d.crossSell!.to)!
      for (const [toKey, fromKey] of Object.entries(d.crossSell.carry)) {
        expect(to.fields.map(f => f.key), `${d.key}→${to.key}: 받는 칸 ${toKey} 가 없다`).toContain(toKey)
        expect(d.fields.map(f => f.key), `${d.key}→${to.key}: 보내는 칸 ${fromKey} 가 없다`).toContain(fromKey)
      }
    }
  })
})
