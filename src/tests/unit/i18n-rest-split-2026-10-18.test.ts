/**
 * 🧹 손님 번역(core)에서 **소스가 가리키지 않는 키**를 뺀다 〔2026-10-18〕
 *
 * 대표 *"다 이상적으로 해줘"*(첫 방문 화면 코드 무게). 실측(ko): core 2,445키 중 746키(raw 39KB)를 src 의 어떤
 * 문자열도 가리키지 않았다 — 지워진 화면의 문구다. core brotli 28.8 → 21.9KB(−7KB, **모든 화면의 첫 방문**).
 *
 * 지키는 것:
 *   ① 소스가 문자열로 가리키는 키는 **하나도 빠짐없이** core 에 남는다(빠지면 화면에 키 이름이 뜰 수 있다)
 *   ② core ∪ dash ∪ rest = 원본 — 어느 키도 사라지지 않는다(빠진 키는 rest 에서 받아 온다)
 *   ③ 실제로 준다(core 가 종전 core 보다 작다)
 *   ④ 안전망 — core 에 없는 키가 요청되면 rest 를 받는다 · core 가 오기 **전**에는 안 부른다(모두가 받게 된다)
 *
 * ⚠️ 못 보는 것: 문자열로 안 남는 키(서버가 보낸 키 이름을 그대로 t() 에 넣는 경우) — 그때는 ④의 안전망이
 *   받는 동안 defaultValue(없으면 키 이름)가 잠깐 보인다. 브라우저에서 실제로 빠진 키가 보이는지는 렌더로만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'
// @ts-expect-error — .mjs 스크립트(타입 선언 없음)
import { splitTranslation, collectConsumerDashKeys, collectReferencedKeys } from '../../../scripts/i18n-split.mjs'
import { stripComments } from '../helpers/source-text'

const ko = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf-8'))
const used = collectConsumerDashKeys('.')
const refs = collectReferencedKeys('.')
const before = splitTranslation(ko, used)
const { core, dash, rest } = splitTranslation(ko, used, refs)

type Obj = Record<string, unknown>
function leaves(o: Obj, pre = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(o)) {
    const p = pre ? `${pre}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v as Obj, p, out)
    else out[p] = v
  }
  return out
}
const DASH = /^(seller|admin|agency|supplier|wholesale|live|liveWs)\./

describe('🧹 rest 분리', () => {
  it('스캔이 비지 않았다 (0 이면 아래가 전부 헛돈다)', () => {
    expect(refs.exact.size).toBeGreaterThan(1500)
  })
  it('① 소스가 가리키는 손님 키는 전부 core 에 있다', () => {
    const coreL = leaves(core)
    const all = leaves(ko)
    const missing = [...refs.exact].filter((k: string) => !DASH.test(k) && k in all && !(k in coreL))
    expect(missing, `core 에서 빠진 키: ${missing.slice(0, 5).join(', ')}`).toEqual([])
  })
  it('② core ∪ dash ∪ rest = 원본 (사라진 키 0)', () => {
    const all = leaves(ko)
    const got = { ...leaves(dash), ...leaves(rest), ...leaves(core) }
    const lost = Object.keys(all).filter((k) => !(k in got))
    expect(lost).toEqual([])
  })
  it('③ 손님 첫 방문 번역이 실제로 준다 (brotli 5KB 이상)', () => {
    const br = (o: unknown) => zlib.brotliCompressSync(Buffer.from(JSON.stringify(o))).length
    expect(br(before.core) - br(core)).toBeGreaterThan(5000)
    expect(Object.keys(leaves(rest)).length).toBeGreaterThan(300)
  })
})

describe('④ 배선 · 안전망', () => {
  const src = stripComments(readFileSync('src/i18n.ts', 'utf-8'))
  it('플러그인이 refs 로 나누고 rest 청크를 낸다', () => {
    const plug = stripComments(readFileSync('scripts/i18n-split.mjs', 'utf-8'))
    expect(plug).toMatch(/splitTranslation\(JSON\.parse\(code\), used, refs\)/)
    expect(plug).toMatch(/i18n-\(core\|dash\|rest\)/)
    expect(stripComments(readFileSync('vite.config.ts', 'utf-8'))).toMatch(/\?i18n-rest'\)\) return `locale-\$\{localeMatch\[1\]\}-rest`/)
  })
  it('core 에 없는 손님 키가 요청되면 rest 를 받는다 — core 가 온 뒤에만', () => {
    expect(src).toMatch(/ko: \(\) => import\('\.\.\/public\/locales\/ko\/translation\.json\?i18n-rest'\)/)
    const line = src.split('\n').find((l) => l.includes('ensureRestStrings()') && l.includes('restLoaded.has(')) ?? ''
    expect(line, 'missingKeyHandler 가 rest 를 부르지 않는다').not.toBe('')
    expect(line, 'core 가 오기 전에도 부른다 — 모든 손님이 rest 를 받게 된다').toContain('loaded.has(')
    expect(line).toContain('!restLoaded.has(')
    // 한국어 기본값이 있는 키는 rest 를 부르지 않는다 — 안 그러면 거의 모든 화면이 rest 를 받는다(실측 5화면)
    expect(line, '기본값이 있는 한국어 키로도 rest 를 부른다').toMatch(/fb === key/)
    expect(line, '다른 언어는 기본값(한국어)으로 두면 언어가 섞인다').toMatch(/lng !== 'ko'/)
  })
  it('짝 키 — FAQ 답(`faq.aN`)은 질문이 가리켜지면 core 에 남는다', () => {
    const coreL = leaves(core)
    expect(refs.exact.has('faq.q1')).toBe(true)
    expect('faq.a1' in coreL, 'FAQ 답이 rest 로 빠졌다 — 다른 언어 화면에 한국어 답이 뜬다').toBe(true)
  })
})
