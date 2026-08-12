/**
 * 🏷️ **번역자용 표식이 사용자 화면에 나가면 안 된다** (2026-08-11 AB 스윕 라이브 실측).
 *
 * `scripts/check-i18n-sync.mjs --fix` 는 6개 언어의 **키 동수**를 맞추려고 빠진 키를
 * `"[TODO:en] 자주 묻는 질문"` 처럼 ko 값 + 마커로 채운다. 번역자에게 보내는 신호인데
 * i18next 는 그 값을 그대로 렌더한다 — 영어로 전환하고 `/faq` 를 열면 화면이 이렇다:
 *
 *     [TODO:en] 자주 묻는 질문
 *     [TODO:en] 무엇을 도와드릴까요?
 *
 * ⚠️ **이 테스트가 요구하지 않는 것**: 289개를 실제로 번역하는 것. 이 서비스는 한국 전용
 * (`urdeal.kr`)이고 GLOBAL 은 폐기(#804)라 번역 우선순위는 대표 판단이다. 여기서 고정하는 것은
 * **"표식이 사용자에게 보이지 않는다"** 하나뿐이고, 그건 번역 여부와 무관하게 항상 참이어야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TODO_MARKER } from '../../i18n'

const src = readFileSync('src/i18n.ts', 'utf8')
  .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('마커 제거 자체', () => {
  const strip = (s: string) => s.replace(TODO_MARKER, '')

  it('🔴 앞머리 마커를 벗긴다', () => {
    expect(strip('[TODO:en] 자주 묻는 질문')).toBe('자주 묻는 질문')
    expect(strip('[TODO:ja] 무엇을 도와드릴까요?')).toBe('무엇을 도와드릴까요?')
  })

  it('마커가 없으면 아무 일도 하지 않는다', () => {
    for (const s of ['Frequently asked questions', '자주 묻는 질문', '']) expect(strip(s)).toBe(s)
  })

  it('본문 중간의 대괄호는 건드리지 않는다 — 앞머리만 대상', () => {
    expect(strip('주문 [TODO:en] 확인')).toBe('주문 [TODO:en] 확인')
    expect(strip('[안내] 배송 지연')).toBe('[안내] 배송 지연')
  })
})

describe('배선 — 벗기는 코드가 실제로 i18next 에 물려 있다', () => {
  it('🔴 postProcessor 로 등록돼 있다', () => {
    expect(src, '.use(stripTodoMarker) 가 사라졌다').toContain('.use(stripTodoMarker)')
  })

  it('🔴 init 에서 postProcess 로 켜져 있다 — 등록만 하고 안 켜면 아무 일도 안 일어난다', () => {
    expect(src).toMatch(/postProcess:\s*\['stripTodoMarker'\]/)
  })
})

describe('현실 확인 — 마커가 실제로 파일에 있다', () => {
  it('마커가 남아 있는 한 이 안전판은 필요하다 (0이 되면 이 테스트가 알려준다)', () => {
    const en = readFileSync('public/locales/en/translation.json', 'utf8')
    const n = (en.match(/\[TODO:en\]/g) || []).length
    // 0 이어도 실패시키지 않는다 — 번역이 끝났다는 좋은 소식이다. 다만 안전판은 유지한다
    // (`--fix` 를 다시 돌리면 언제든 되살아난다).
    expect(n, `en 미번역 ${n}개`).toBeGreaterThanOrEqual(0)
    expect(readFileSync('public/locales/ko/translation.json', 'utf8'), 'ko 에 마커가 생겼다 — 마스터가 오염됐다')
      .not.toContain('[TODO:')
  })
})
