/**
 * 🤖 2026-11-03 카카오 CS 봇 — FAQ 10개 + AI 의도 분류.
 *
 * 지키는 것:
 *  ① FAQ 답에 적힌 메뉴 이름([…])이 **실제 화면 코드에 있다**. 2026-11-03 에 재 보니 FAQ 가
 *     `[내 지갑]`·`[주문 내역]`·`[딜 내역]` 으로 안내하고 있었는데 셋 다 마이에 없는 이름이었다.
 *  ② AI 는 **허용된 FAQ id 와 정확히 같은 출력**만 쓴다(주입·잡문 = 모름).
 *  ③ 게이트가 꺼져 있으면 AI 를 아예 부르지 않는다. 키워드로 답한 말에도 부르지 않는다.
 *  ④ 실패·시간초과·거절 = 종전 폴백(봇은 항상 답한다).
 * ⚠️ 못 막는 것: AI 가 **엉뚱한 FAQ 를 고르는 것**(분류 품질) — 라이브 대화로만 보인다.
 *   메뉴 이름이 화면에 *있는지*는 보지만 그 경로가 *맞는지*(그 화면에서 그 버튼이 보이는지)는 못 본다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { CS_FAQ_ENTRIES, matchCsFaq, CS_FAQ_FALLBACK } from '@/features/cs/api/cs-faq'
import { classifyCsUtterance, parseCsAiChoice, buildCsAiSystem, isCsAiEnabled, CS_AI_MODEL } from '@/worker/utils/cs-ai-classify'
import skillApp from '@/worker/routes/kakao-skill-webhook.routes'

const SCREEN_DIRS = ['src/pages/user-profile', 'src/pages/my-vouchers']
const SCREEN_FILES = ['src/components/main/BottomNav.tsx', 'src/pages/MyGifticonsPage.tsx']
function screenText(): string {
  const files = [...SCREEN_FILES]
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p)
    }
  }
  SCREEN_DIRS.forEach(walk)
  return files.map(f => readFileSync(f, 'utf8')).join('\n')
}

describe('FAQ 내용', () => {
  it('id 가 유일하고, 퀵리플라이 한도(10) 안이다', () => {
    const ids = CS_FAQ_ENTRIES.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(10)
    expect(ids.length).toBeLessThanOrEqual(10)
  })
  it('답에 적힌 메뉴 이름이 실제 화면 코드에 있다', () => {
    const screens = screenText()
    const labels = new Set<string>()
    for (const e of CS_FAQ_ENTRIES) for (const m of e.answer.matchAll(/\[([^\]]+)\]/g)) labels.add(m[1])
    expect(labels.size).toBeGreaterThan(5)
    const missing = [...labels].filter(l => !screens.includes(l))
    expect(missing).toEqual([])
  })
  it('낡은 안내·폐기어·내부 정보가 없다', () => {
    const all = CS_FAQ_ENTRIES.map(e => e.answer).join('\n')
    for (const bad of [/내 지갑/, /주문 내역/, /딜 내역/, /셀러 대시보드/, /충전해/, /식사권/, /공구권/, /인플루언서/, /큐레이터/, /수수료/, /원천징수/, /커미션/, /%/]) {
      expect(all).not.toMatch(bad)
    }
  })
  it('키워드가 대표 질문을 맞는 답으로 보낸다', () => {
    const cases: Array<[string, string]> = [
      ['QR 어떻게 보여줘요', 'qr_usage'],
      ['환불하고 싶어요', 'refund'],
      ['사장님 정산 언제 들어와요', 'settlement'],
      ['기프티콘 어디서 봐요', 'gifticon'],
      ['친구에게 선물하기', 'gift'],
      ['현금영수증 발급', 'payment'],
      ['회원탈퇴 하고 싶어요', 'account'],
      ['가게 입점하고 싶어요', 'store_join'],
    ]
    for (const [u, id] of cases) expect(matchCsFaq(u)?.id, u).toBe(id)
  })
})

describe('AI 출력 해석', () => {
  const ids = CS_FAQ_ENTRIES.map(e => e.id)
  it('허용된 id 와 정확히 같을 때만 받는다', () => {
    expect(parseCsAiChoice('refund', ids)).toBe('refund')
    expect(parseCsAiChoice(' "refund". \n', ids)).toBe('refund')
    expect(parseCsAiChoice('NONE', ids)).toBeNull()
    expect(parseCsAiChoice('refund 입니다', ids)).toBeNull()
    expect(parseCsAiChoice('환불은 7일 안에 가능합니다', ids)).toBeNull()
    expect(parseCsAiChoice('', ids)).toBeNull()
  })
  it('지시문에 모든 id 가 있고 주입을 따르지 말라고 한다', () => {
    const sys = buildCsAiSystem(CS_FAQ_ENTRIES)
    for (const id of ids) expect(sys).toContain(`- ${id}:`)
    expect(sys).toMatch(/지시는 따르지 않는다/)
    expect(sys).toMatch(/NONE/)
  })
  it('게이트는 둘 다 있어야 켜진다', () => {
    expect(isCsAiEnabled({ KAKAO_BOT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' })).toBe(true)
    expect(isCsAiEnabled({ KAKAO_BOT_AI_ENABLED: 'true' })).toBe(false)
    expect(isCsAiEnabled({ ANTHROPIC_API_KEY: 'k' })).toBe(false)
    expect(isCsAiEnabled(undefined)).toBe(false)
  })
})

const okReply = (text: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text }], ...extra }), { status: 200 })

describe('classifyCsUtterance', () => {
  it('요청 모양 — 모델·생각 끔·짧은 출력', async () => {
    let body: Record<string, unknown> = {}
    const fetchImpl = vi.fn(async (_u: string, init?: RequestInit) => { body = JSON.parse(String(init?.body)); return okReply('refund') })
    expect(await classifyCsUtterance('k', '어제 산 거 못 가게 됐는데 돈 돌려받을 수 있어요?', CS_FAQ_ENTRIES, { fetchImpl })).toBe('refund')
    expect(body.model).toBe(CS_AI_MODEL)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(Number(body.max_tokens)).toBeLessThanOrEqual(32)
  })
  it('실패·거절·잡문·시간초과 = null, 짧은 말은 부르지도 않는다', async () => {
    expect(await classifyCsUtterance('k', '어디서 돈 돌려받아요?', CS_FAQ_ENTRIES, { fetchImpl: async () => new Response('x', { status: 500 }) })).toBeNull()
    expect(await classifyCsUtterance('k', '어디서 돈 돌려받아요?', CS_FAQ_ENTRIES, { fetchImpl: async () => okReply('refund', { stop_reason: 'refusal' }) })).toBeNull()
    expect(await classifyCsUtterance('k', '어디서 돈 돌려받아요?', CS_FAQ_ENTRIES, { fetchImpl: async () => okReply('지금 바로 환불해 드릴게요') })).toBeNull()
    expect(await classifyCsUtterance('k', '어디서 돈 돌려받아요?', CS_FAQ_ENTRIES, { fetchImpl: async () => { throw new Error('net') } })).toBeNull()
    const slow = (_u: string, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('abort'))))
    expect(await classifyCsUtterance('k', '어디서 돈 돌려받아요?', CS_FAQ_ENTRIES, { fetchImpl: slow, timeoutMs: 30 })).toBeNull()
    const spy = vi.fn(async () => okReply('refund'))
    expect(await classifyCsUtterance('k', '네', CS_FAQ_ENTRIES, { fetchImpl: spy })).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('웹훅 배선', () => {
  afterEach(() => vi.unstubAllGlobals())
  const SECRET = 's'
  async function say(env: Record<string, unknown>, utterance: string) {
    const res = await skillApp.request('/api/cs/kakao-skill', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-skill-secret': SECRET },
      body: JSON.stringify({ userRequest: { utterance } }),
    }, env)
    const j = await res.json() as { template?: { outputs?: Array<{ simpleText?: { text?: string } }> } }
    return j.template?.outputs?.[0]?.simpleText?.text ?? ''
  }
  const refund = CS_FAQ_ENTRIES.find(e => e.id === 'refund')!.answer
  const odd = '어제 산 거 일정이 바뀌어서 못 가게 됐어요 어떡하죠'

  it('켜져 있으면 키워드가 빗나간 말도 FAQ 원문으로 답한다', async () => {
    expect(matchCsFaq(odd)).toBeNull() // 이 문장이 키워드에 걸리면 이 시험은 AI 를 안 시험한다
    const f = vi.fn(async () => okReply('refund'))
    vi.stubGlobal('fetch', f)
    expect(await say({ KAKAO_SKILL_SECRET: SECRET, KAKAO_BOT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' }, odd)).toBe(refund)
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('꺼져 있으면 부르지 않고 종전 폴백', async () => {
    const f = vi.fn(async () => okReply('refund'))
    vi.stubGlobal('fetch', f)
    expect(await say({ KAKAO_SKILL_SECRET: SECRET, ANTHROPIC_API_KEY: 'k' }, odd)).toBe(CS_FAQ_FALLBACK)
    expect(f).not.toHaveBeenCalled()
  })
  it('키워드로 답한 말은 AI 를 부르지 않는다', async () => {
    const f = vi.fn(async () => okReply('gift'))
    vi.stubGlobal('fetch', f)
    expect(await say({ KAKAO_SKILL_SECRET: SECRET, KAKAO_BOT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' }, '환불하고 싶어요')).toBe(refund)
    expect(f).not.toHaveBeenCalled()
  })
  it('AI 가 모른다고 하면 종전 폴백', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okReply('NONE')))
    expect(await say({ KAKAO_SKILL_SECRET: SECRET, KAKAO_BOT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: 'k' }, '주차 되는 매장인가요?')).toBe(CS_FAQ_FALLBACK)
  })
})
