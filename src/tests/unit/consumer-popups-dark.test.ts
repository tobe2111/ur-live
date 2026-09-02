/**
 * 🎫 소비자 팝업·입력창 다크/디자인 시스템 계약 (2026-09-02 — 대표 신고 3건을 한 번에)
 *
 * ■ 무엇이 났나
 *   ① 담기(핀) 토스트 — 서버는 이미 담은 상품에 409 + `ALREADY_PINNED` 를 주는데 axios 가 4xx 를 throw 하므로
 *      "이미 담김" 분기는 **한 번도 도달한 적이 없고** 항상 "핀 추가 중 오류가 발생했습니다" 로 보고됐다.
 *      정상 상태를 오류로 말하는 사고. 성공 문구도 이모지 + 예상 적립 시뮬레이터가 붙어 한 줄 토스트로 못 읽는 길이였다.
 *   ② 리뷰 작성 textarea — `dark:bg-*` 가 없어 다크에서 브라우저 기본 흰 배경 위에 전역 `.dark textarea{color:gray-100}`
 *      = 흰 바탕에 흰 글자. placeholder 만 보였다.
 *   ③ 장바구니 — 로그인 래퍼만 `bg-[#F4F4F4]` 단독이라 다크에서 빈 장바구니 아래 화면 절반이 회색이었다.
 *
 * ■ 왜 테스트인가
 *   셋 다 "에러가 안 나는" 결함이다(화면이 그냥 이상할 뿐). `check-theme-consistency` 는 bg 토큰 짝을 보지만
 *   **bg 클래스 자체가 없는 textarea** 는 못 본다. 토스트 문구 길이는 어떤 가드도 안 본다.
 *
 * ⚠️ 못 잡는 것: 실제 렌더 색 · 다른 페이지의 같은 결함(textarea 무배경은 다른 곳에도 있을 수 있다) ·
 *    서버가 409 의 code 를 바꾸는 경우.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
// ★(U+2605) 별점은 이모지가 아니라 글리프 — 2600 블록은 제외한다
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}]/u

describe('① 담기 토스트 (usePinAction)', () => {
  const src = R('features/curator/hooks/usePinAction.ts')

  it('409 ALREADY_PINNED 가 catch 에서도 "이미 담음" 으로 간다 — axios 는 4xx 를 throw 한다', () => {
    // togglePin 의 catch 블록 안에서 응답 code 를 읽어 분기해야 한다.
    const catchBlock = src.slice(src.indexOf('} catch (err) {'), src.indexOf('} finally {'))
    expect(catchBlock).toMatch(/ALREADY_PINNED/)
    expect(catchBlock).toMatch(/readApiError\(err\)/)
  })

  it('토스트 문구에 이모지가 없고, 어떤 문구도 한 줄(30자)을 넘지 않는다', () => {
    const msgBlock = src.slice(src.indexOf('const MSG = {'), src.indexOf('} as const'))
    expect(EMOJI.test(msgBlock)).toBe(false)
    const literals = [...msgBlock.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(literals.length).toBeGreaterThan(3)
    for (const l of literals) expect(l.length, l).toBeLessThanOrEqual(30)
    // 예상 적립 시뮬레이터("5명 공유 시 예상 N원 적립")가 토스트로 돌아오면 위반
    expect(src).not.toMatch(/공유 시 예상/)
    expect(src).not.toMatch(/핀 추가 중 오류/)
  })

  it('사용자에게 보이는 말은 "핀" 이 아니라 "담기" 다 (2026-08-26 명칭 SSOT)', () => {
    const msgBlock = src.slice(src.indexOf('const MSG = {'), src.indexOf('} as const'))
    expect(msgBlock).not.toMatch(/핀/)
  })
})

describe('② 리뷰 작성란 (ProductReviews)', () => {
  const src = R('pages/product-detail/ProductReviews.tsx')

  it('textarea 에 다크 배경이 있다 — 없으면 흰 바탕에 흰 글자', () => {
    const ta = src.slice(src.indexOf('<textarea'), src.indexOf('/>', src.indexOf('<textarea')))
    expect(ta).toMatch(/dark:bg-\[#/)
    expect(ta).toMatch(/dark:text-white/)
  })

  it('리워드 안내는 색깔 정보상자·이모지가 아니라 회색 한 줄이다', () => {
    expect(src).not.toMatch(/bg-pink-50/)
    // 주석(🛡️ 같은 기록용 글리프)은 화면에 안 나오므로 제외 — 렌더되는 줄만 본다.
    const rendered = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')
    expect(EMOJI.test(rendered)).toBe(false)
  })

  it('작성 카드는 테두리 0 + shadow-lift (규칙 ①)', () => {
    expect(src).toMatch(/rounded-2xl bg-white dark:bg-\[#1D1F29\] shadow-lift/)
  })
})

describe('③ 장바구니 (CartPage)', () => {
  const src = R('pages/CartPage.tsx')

  it('로그인 상태 래퍼가 다크 배경을 가진다 — 없으면 화면 절반이 회색', () => {
    const wrappers = [...src.matchAll(/className="flex flex-col min-h-\[100dvh\]([^"]*)"/g)].map((m) => m[1])
    expect(wrappers.length).toBeGreaterThan(0)
    for (const w of wrappers) expect(w, w).toMatch(/dark:bg-\[#11141C\]/)
    expect(src).not.toMatch(/bg-\[#F4F4F4\]/)
  })

  it('무료배송 안내가 회색 정보상자(#f9fafb)로 돌아오지 않는다', () => {
    expect(src).not.toMatch(/bg-\[#f9fafb\]/i)
  })
})

describe('④ 토스트 표면 (ToastContainer)', () => {
  const src = R('components/ToastContainer.tsx')
  it('라이트 흰 카드 + lift / 다크 surface — 잉크 상자·링·무거운 그림자 0', () => {
    expect(src).toMatch(/bg-white dark:bg-\[#1D1F29\]/)
    expect(src).toMatch(/shadow-lift/)
    expect(src).not.toMatch(/ring-1 ring-white/)
    expect(src).not.toMatch(/text-emerald-|text-sky-/)
  })
})
