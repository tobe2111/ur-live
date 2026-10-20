/**
 * 🤖 AI 비서 검색 창구를 `llms.txt` 에 적는다 — 켜져 있을 때만 (2026-10-20, 대표 *"통로 열어줘"*).
 *
 * 창구(`/api/agent/search`)를 켰는데 AI 가 그 주소를 알 길이 없었다 — `llms.txt` 가 한 줄도 안 적었다.
 * 지키는 것:
 *   ① 켜져 있으면 주소·필수 입력·상한·결제 위치를 적는다
 *   ② 꺼져 있으면 **안 적는다** (꺼진 창구는 404 — 가리키면 거짓 안내다)
 *   ③ 적는 주소가 실제 라우트 마운트(`/api/agent` + `/search`)와 같다
 *   ④ 분류 이름·상한은 창구가 받는 값에서 온다 (손으로 적으면 갈린다)
 *   ⑤ 라우트가 게이트를 읽어 넘긴다 (배선)
 * ⚠️ 못 보는 것: AI 가 실제로 그 주소를 쓰는지(외부 판정) · 응답 캐시 1시간 동안의 지연.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLlmsTxt } from '@/shared/seo/llms-txt'
import { AGENT_CATEGORY, AGENT_SEARCH_MAX, AGENT_SEARCH_PATH, agentSearchLines } from '@/shared/agent-search'
import { readCode } from '../helpers/source-text'

const BASE = 'https://urdeal.kr'

describe('llms.txt — AI 비서 검색 창구 안내', () => {
  it('① 켜져 있으면 주소·입력·상한·결제 위치를 적는다', () => {
    const txt = buildLlmsTxt(BASE, { agentSearch: true })
    expect(txt).toContain(`${BASE}${AGENT_SEARCH_PATH}?q=`)
    expect(txt).toContain('region=')
    expect(txt).toMatch(/검색어\(q\)나 지역\(region\) 중 하나/)
    expect(txt).toContain(`최대 ${AGENT_SEARCH_MAX}건`)
    expect(txt).toMatch(/결제는 응답의 url/)
  })

  it('② 꺼져 있으면 창구를 적지 않는다 (기본값도 꺼짐)', () => {
    for (const txt of [buildLlmsTxt(BASE, { agentSearch: false }), buildLlmsTxt(BASE)]) {
      expect(txt).not.toContain(AGENT_SEARCH_PATH)
      expect(txt).not.toContain('AI 비서용 이용권 검색')
    }
  })

  it('③ 적는 주소 = 실제 라우트 마운트', () => {
    const util = readCode('src/worker/routes/public-utility.routes.ts')
    const route = readCode('src/worker/routes/agent-search.routes.ts')
    const mount = util.match(/publicUtilityRoutes\.route\('([^']+)',\s*agentSearchRoutes\)/)?.[1]
    const sub = route.match(/agentSearchRoutes\.get\('([^']+)'/)?.[1]
    expect(mount && sub, '마운트를 못 찾았다 — 경로가 낡았다').toBeTruthy()
    expect(`${mount}${sub}`).toBe(AGENT_SEARCH_PATH)
  })

  it('④ 분류 이름은 창구가 받는 값 그대로', () => {
    const lines = agentSearchLines(BASE).join('\n')
    for (const k of Object.keys(AGENT_CATEGORY)) expect(lines).toContain(k)
  })

  it('⑤ 라우트가 게이트를 읽어 빌더에 넘긴다', () => {
    const src = readCode('src/worker/routes/sitemap.routes.ts')
    // 2026-10-20: 결제 링크 게이트와 함께 읽는다 — 두 게이트를 한 번에 읽어 넘긴다.
    expect(src).toMatch(/\[AGENT_SEARCH_GATE,\s*AGENT_CHECKOUT_GATE\]\.map\(k\s*=>\s*settingOn\(DB,\s*k\)/)
    expect(src).toMatch(/const \[agentSearch, agentCheckout\]/)
    expect(src).toMatch(/buildLlmsTxt\(new URL\(c\.req\.url\)\.origin,\s*\{\s*agentSearch,\s*agentCheckout\s*\}\)/)
  })
})
