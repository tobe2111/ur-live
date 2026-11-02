/**
 * 🌐 2026-11-02 대표 확정 — 외국인 관광객(1단계)용 영어: 이용권 상세 · 구매 · 내 이용권(QR).
 *
 * 화면의 한국어 문장을 `t('키', { defaultValue: '원래 한국어' })` 로 바꿨다. 지키는 것 둘:
 *   ① **한국어 손님 화면은 한 글자도 안 바뀐다** — 소스의 defaultValue 와 ko 번역 파일 값이 같아야 한다.
 *      (둘이 다르면 ko 파일 값이 이겨서 한국어 문구가 조용히 바뀐다.)
 *   ② **영어가 비지 않는다** — 이 흐름의 키는 en 값이 있고, 한글이 섞이지 않고, {{자리}} 가 ko 와 같다.
 *
 * ⚠️ 못 보는 것: 영어 문장이 자연스러운지 · 서버가 보내는 문구(가게 이름·메뉴·에러)는 여전히 한국어 ·
 *   소비자 언어 전환은 아직 닫혀 있다(`CONSUMER_LANGUAGE_SWITCH_HIDDEN`) — 결제·로그인이 준비돼야 연다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILES = [
  'src/pages/GroupBuyDetailPage.tsx',
  'src/pages/GroupBuyConfirmPaymentPage.tsx',
  ...['DetailGallery', 'UsageGuide', 'SellerCard', 'StoreIntro', 'PassHeadCard', 'DetailTitleHeader',
    'DetailSectionTabs', 'DealMenuList', 'StoreLocation', 'OtherDealsRow', 'DealPurchaseBox', 'DealPayButton',
    'PaymentCompleteTicket', 'CartComplete'].map((f) => `src/pages/group-buy/${f}.tsx`),
  'src/pages/my-vouchers/QRModal.tsx',
  'src/pages/my-vouchers/VoucherTicket.tsx',
  'src/components/NaverMiniMap.tsx',
]
const PREFIX = /^(pass|passBuy|wallet)\.|^map\.(addressNotFound|loadFailed|showFailed|openNaver|loading)$/

const json = (lang: string) => JSON.parse(readFileSync(`public/locales/${lang}/translation.json`, 'utf8'))
const ko = json('ko'), en = json('en')
function get(d: Record<string, unknown>, k: string): unknown {
  if (k in d) return d[k]
  let cur: unknown = d
  for (const p of k.split('.')) {
    if (!cur || typeof cur !== 'object' || !(p in (cur as object))) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}
const HANGUL = /[가-힣]/
const vars = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',')

// t('key', { defaultValue: '...' — 작은따옴표 기본값만 센다(이 흐름의 변환이 전부 그 모양이다).
const CALL = /\b(?:t|tr)\(\s*'([\w.]+)'\s*,\s*\{\s*defaultValue:\s*'((?:[^'\\]|\\.)*)'/g
const pairs: Array<{ file: string; key: string; dv: string }> = []
for (const file of FILES) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(CALL)) if (PREFIX.test(m[1])) pairs.push({ file, key: m[1], dv: m[2].replace(/\\'/g, "'") })
}

describe('외국인 관광객 영어 — 이용권 상세·구매·내 이용권', () => {
  it('검사 대상이 실제로 있다(0건이면 헛도는 가드)', () => {
    expect(pairs.length).toBeGreaterThan(120)
  })

  it('① 한국어 손님 화면 불변 — 소스 기본값 = ko 파일 값', () => {
    const bad = pairs.filter(({ key, dv }) => get(ko, key) !== dv).map(({ file, key, dv }) => `${file} ${key}: 소스 '${dv}' ↔ ko '${String(get(ko, key))}'`)
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('② 영어가 비지 않는다 — en 값 있음 · 한글 없음 · {{자리}} 같음', () => {
    const bad: string[] = []
    for (const { key, dv } of pairs) {
      const v = get(en, key)
      if (typeof v !== 'string' || !v.trim()) { bad.push(`${key}: en 없음`); continue }
      if (v.startsWith('[TODO') || HANGUL.test(v)) bad.push(`${key}: en 에 한글/TODO — ${v}`)
      if (vars(v) !== vars(dv)) bad.push(`${key}: 자리 다름 ko(${vars(dv)}) en(${vars(v)})`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('외국어 지도는 키가 없으면 안 쓰인다(한국어·키 없음 → 카카오 그대로)', () => {
    const lib = readFileSync('src/lib/naver-maps.ts', 'utf8')
    expect(lib).toMatch(/return !!NAVER_KEY_ID && base !== 'ko'/)
    const loc = readFileSync('src/pages/group-buy/StoreLocation.tsx', 'utf8')
    expect(loc).toMatch(/useNaver\s*\n?\s*\? <Suspense/)
    expect(loc).toMatch(/: map\}/)
  })
})

// ── 한국어 core 무게 — 기본값과 같은 문장은 ko core 에서 뺀다(scripts/i18n-split.mjs KO_DEFAULT_ONLY_NS) ──
// 이 규칙이 없으면 한국어 손님이 모든 화면에서 받는 locale-ko 가 +4.6KB 였다(실행 비용 예산 5건 빨간불, 2026-11-02 CI 실측).
import { collectDefaultValueUses, koDefaultOnlyKeys, moveKeysToRest, splitTranslation, collectConsumerDashKeys, collectReferencedKeys } from '../../../scripts/i18n-split.mjs'

describe('한국어 core 에서 기본값 중복 문장 빼기', () => {
  const uses = collectDefaultValueUses('.')
  const drop = new Set(koDefaultOnlyKeys(ko, uses))

  it('이 흐름의 키는 ko core 에서 빠진다(한국어는 소스 기본값이 그린다)', () => {
    expect(drop.has('pass.usageGuide.title')).toBe(true)
    expect(drop.size).toBeGreaterThan(100)
  })

  it('기본값 없이 쓰는 키 · 템플릿 접두어 아래 키는 남긴다(키 이름이 화면에 뜨면 안 된다)', () => {
    // voucher.status.* 는 `voucher.status.${s}` 템플릿으로 쓰인다.
    for (const k of drop) expect(k.startsWith('voucher.status.'), k).toBe(false)
    // 빠지는 키는 전부 기본값이 ko 값과 같다.
    for (const k of drop) for (const v of uses.dv.get(k) || []) expect(v, k).toBe(get(ko, k))
  })

  it('옮긴 뒤 core 에는 없고 rest 에는 있다', () => {
    const parts = splitTranslation(ko, collectConsumerDashKeys('.'), collectReferencedKeys('.'))
    const moved = moveKeysToRest(parts, [...drop])
    expect(get(moved.core, 'pass.usageGuide.title')).toBeUndefined()
    expect(get(moved.rest, 'pass.usageGuide.title')).toBe(get(ko, 'pass.usageGuide.title'))
    expect(JSON.stringify(moved.core).length).toBeLessThan(JSON.stringify(parts.core).length)
  })
})
