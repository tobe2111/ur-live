/**
 * 🎬 라이브커머스는 **영구 중단**이다 — 소비자 화면 문구에 남아 있으면 안 된다.
 *
 * 결정: 2026-06-04 잠정 → **2026-06-17 대표 확정 "안하기로 했어"**(`LIVE_COMMERCE_SUSPENDED`).
 * 2026-07-07 에 `/live`·`/shorts` 페이지와 셀러 라이브 메뉴가 통째로 내려갔다.
 *
 * ## 왜 가드가 필요한가 (2026-09-30 실측)
 *
 * 기능은 3개월 전에 내려갔는데 **문구는 그대로 남아 있었다.** 그중 가장 나쁜 것:
 *   · 신규 가입 첫 온보딩 모달이 *"라이브 방송으로 보고 바로 사는 / 한국 1위 라이브 커머스"*
 *   · `/register` · `/search` · `/browse` · `/blog` · `/introduce` 의 **메타 설명**(검색 결과에 그대로 뜬다)
 *   · 설정의 테마 설명이 *"마이페이지/홈/라이브는 항상 다크"* — 없는 페이지를 설명하고 있었다
 *
 * **에러가 안 나고 화면도 안 깨져서 아무도 신고하지 않는다.** 그래서 기계가 센다.
 *
 * 🔑 **`defaultValue` 만 고치면 소용없다** — locale 값이 이긴다(2026-09-01 audit log 가 값을 치르고
 *    배운 규칙). 그래서 이 시험은 **코드가 아니라 6개 언어 locale 값**을 본다.
 *
 * ## 무엇을 안 보나 (의도적)
 *
 *   · **소비자 코드가 `t()` 로 부르지 않는 키** — 라이브 페이지·셀러 대시보드의 죽은 키 300여 개가
 *     남아 있다. 렌더되지 않으므로 해가 없고, 지우는 것은 별건이다(이 시험이 그 정리를 강제하지 않는다).
 *   · **주석·묘비** — `🗑️ 2026-07-07 라이브커머스 제거` 류는 **되살아나는 것을 막는 장치**라 남긴다.
 *   · `t(변수)` 로 부르는 동적 키 — 소스에서 값을 알 수 없다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const LANGS = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const

/**
 * 낱말 하나가 아니라 **구**로 본다 — "라이브"·"live" 단독은 다른 뜻으로도 쓰인다.
 *
 * 🛡️ **언어별로 나눠 둔 이유**: 평평한 배열이면 한 언어의 문구를 통째로 지워도
 * "전체 개수" 하한을 통과한다 — 그러면 그 언어는 조용히 검사 밖으로 나간다.
 * (주입 러너가 정확히 그 구멍을 잡았다: es·fr 5개를 지웠는데 초록이었다.)
 * 아래 검사가 **언어마다 최소 하나**를 요구하므로 그 길이 막힌다.
 */
const DEAD_BY_LANG: Record<(typeof LANGS)[number], string[]> = {
  ko: ['라이브 방송', '라이브 커머스', '라이브커머스', '라이브 쇼핑', '실시간 방송', '라이브 특가', '라이브 소식'],
  en: ['live commerce', 'Live Commerce', 'live stream', 'Live Stream', 'live specials', 'live donations'],
  ja: ['ライブコマース', 'ライブ配信', 'ライブ放送', 'ライブ特価'],
  zh: ['直播电商', '直播购物', '直播特价', '直播带'],
  es: ['comercio en vivo', 'Comercio en vivo', 'en vivo en'],
  fr: ['commerce live', 'Commerce live', 'commerce en direct', 'promos live'],
}
/** 문구는 언어에 안 묶어 둔다 — en 문구가 ko 파일에 섞여 있던 사례가 실제로 있었다. */
const DEAD_PHRASES = Object.values(DEAD_BY_LANG).flat()

/** 소비자 표면만 — 서비스가 다르면 문구도 다른 판단이다(CLAUDE.md 서비스 분리). */
const OTHER_SERVICE = /(admin|seller|agency|wholesale|supplier|marketing|Admin|Seller|Agency|Wholesale|Supplier)/

function consumerFiles(): string[] {
  const out = execFileSync('git', ['ls-files', 'src/pages', 'src/components', 'src/features', 'src/shared'], {
    encoding: 'utf8',
  })
  return out
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('/tests/') && !OTHER_SERVICE.test(f))
}

/** `t('a.b.c'` 의 키만 뽑는다. 동적 키(`t(x)`)는 소스에서 못 푼다 — 머리말에 한계로 적어 두었다. */
function calledKeys(files: string[]): Set<string> {
  const keys = new Set<string>()
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/\bt\(\s*'([A-Za-z][\w.]*\.[\w.]+)'/g)) keys.add(m[1])
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z][\w.]*\.[\w.]+)"/g)) keys.add(m[1])
  }
  return keys
}

/** 평면 키(`"a.b": "…"`)와 중첩 키를 **둘 다** 본다 — 이 레포엔 두 모양이 섞여 있다. */
function lookup(dict: Record<string, unknown>, dotted: string): string | undefined {
  if (typeof dict[dotted] === 'string') return dict[dotted] as string
  let cur: unknown = dict
  for (const p of dotted.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(p in (cur as Record<string, unknown>))) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

const files = consumerFiles()
const keys = calledKeys(files)
const dicts = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readFileSync(`public/locales/${l}/translation.json`, 'utf8'))]),
) as Record<string, Record<string, unknown>>

describe('🎬 라이브커머스 잔여 문구 (2026-09-30)', () => {
  it('측정이 비어 있지 않다 — 경로가 낡으면 통과가 아니라 실패다', () => {
    expect(files.length, '소비자 파일').toBeGreaterThan(300)
    expect(keys.size, "t('…') 로 부르는 키").toBeGreaterThan(800)
    // 사전 자신이 비면 아래 검사가 통째로 헛돈다.
    expect(DEAD_PHRASES.length).toBeGreaterThan(15)
    // 🛡️ **언어 하나가 통째로 빠지는 길**을 막는다(전체 개수만 보면 통과한다 — 주입이 잡은 구멍).
    for (const l of LANGS) {
      expect(DEAD_BY_LANG[l]?.length ?? 0, `${l} 문구가 없으면 그 언어는 검사 밖이다`).toBeGreaterThan(0)
    }
  })

  it('소비자 화면이 부르는 키에 라이브커머스 문구가 없다 (6개 언어)', () => {
    const bad: string[] = []
    for (const lang of LANGS) {
      for (const k of keys) {
        const v = lookup(dicts[lang], k)
        if (!v) continue
        const hit = DEAD_PHRASES.find((p) => v.includes(p))
        if (hit) bad.push(`${lang} ${k} :: "${hit}" in ${v.slice(0, 60)}`)
      }
    }
    expect(bad, `라이브커머스는 영구 중단이다(2026-06-17 대표 확정) — 이 문구가 화면·검색결과에 뜬다:\n${bad.join('\n')}`).toEqual([])
  })

  it('코드의 defaultValue 에도 없다 — locale 만 고치면 폴백이 되살린다', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/defaultValue:\s*(['"`])([\s\S]*?)\1/g)) {
        const hit = DEAD_PHRASES.find((p) => m[2].includes(p))
        if (hit) bad.push(`${f} :: "${hit}"`)
      }
    }
    expect(bad, `defaultValue 는 locale 로딩 전에 보이는 문구다:\n${bad.join('\n')}`).toEqual([])
  })

  it('영구 중단이라는 사실이 코드에 고정돼 있다', () => {
    const flags = readFileSync('src/shared/feature-flags.ts', 'utf8')
    expect(flags).toMatch(/LIVE_COMMERCE_SUSPENDED\s*=\s*true/)
  })
})
