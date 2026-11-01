/**
 * 🔧 **주석 제거기 두 벌의 판정이 같은가** (2026-10-14 — 대표 *"다 해주고 머지 후 또 개선점 찾아"*)
 *
 * ## 왜 이 시험이 필요한가
 * 이 레포는 "소스를 문자열로 읽어 판정" 하는 가드가 많고, 주석을 걷어내는 일을 **두 벌**이 한다:
 *
 *     src/tests/helpers/source-text.ts   `.ts` 시험용   — 2026-08-27 스캐너로 교체(문자열·정규식 추적)
 *     scripts/comment-strip.mjs          `.mjs` 가드용  — 2026-10-14 까지 **추적하지 않았다**
 *
 * `.mjs` 는 그 TS 를 import 할 수 없어서 두 벌이 불가피하다. 그런데 **정확도가 갈려 있었다** —
 * 실측: `app.use('/api/*', m());` 한 줄이 그 `/*` 를 블록주석 시작으로 읽어 다음 닫는 기호까지
 * 코드를 통째로 지웠고, `src/worker/index.ts:832` 의 `<title>` 문자열이 그렇게 증발했다.
 * **증발한 구간은 검사에서 사라지므로 `not.toContain(...)` 류 단언이 초록불이 된다.**
 *
 * ## 이 시험이 잠그는 것
 * 두 제거기가 **같은 입력에 같은 판정**인가. 한쪽만 고치면 다시 갈리고, 갈려도 **에러가 안 난다**
 * (가드는 통과하고 보는 범위만 좁아진다) — 그래서 사람이 아니라 시험이 센다.
 *
 * ⚠️ **못 보는 것**: 두 벌이 **똑같이 틀리는** 경우는 못 잡는다(parity 는 일치만 본다). 그래서
 *   ① 무엇을 지워야 하는가 ② 무엇을 남겨야 하는가 를 **절대 기준**으로도 따로 단언한다.
 * ⚠️ 줄번호가 **밀리는지**는 `.mjs` 쪽만 잴 수 있다 — `source-text.ts` 의 `stripComments` 는 블록
 *   주석의 개행까지 지워 줄 수가 줄어든다(의도). 그래서 줄 보존은 `.mjs` 계약으로만 단언한다.
 *   🩸 이 차이를 모르고 두 출력을 **인덱스로** 비교해 "102,942줄 손실" 이라는 가짜 측정을 한 번 냈다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as scannerStrip } from '../helpers/source-text'
// @ts-expect-error — `.mjs` 가드 SSOT (타입 선언 없음)
import { stripCommentsLines, stripComments as mjsStrip } from '../../../scripts/comment-strip.mjs'

/** 공백을 전부 지운 토큰열 — 두 제거기의 출력 모양(줄 합치기 방식)이 달라서 이렇게 비교한다. */
const squash = (s: string) => s.replace(/\s+/g, '')

/**
 * 🔀 **딱 하나, 의도된 차이** — JSX 주석 `{/* … *\/}` 의 **중괄호 잔재**.
 * `.mjs` 는 `{/*` → `*\/}` 를 **통째로** 먹고, 스캐너는 `/* … *\/` 만 먹어 `{}` 를 남긴다.
 * 둘 다 판정에 무해하다(빈 표현식 컨테이너). 그래서 비교는 `{}` 를 지우고 하되,
 * **그 밖의 차이는 0 이어야 한다** — 즉 이 정규화가 "아무 차이나 봐주는" 장치가 되지 않게
 * ⑧ 이 *차이가 정확히 `{}` 뿐인지* 를 따로 단언한다.
 */
const normBraces = (s: string) => s.replace(/\{\}/g, '')
const same = (src: string) => normBraces(squash(mjs(src))) === normBraces(squash(scannerStrip(src)))

const mjsLines = stripCommentsLines as (src: string) => Array<[number, string]>
const mjs = mjsStrip as (src: string) => string

/**
 * 🧪 탐침 — **코드에 `—`(em-dash), 주석에도 `—`** 를 넣는다.
 * 판정: 코드의 `—` 는 남아야 하고 주석의 `—` 는 사라져야 한다. 둘을 같은 글자로 둔 이유는
 * "지우기/남기기" 를 한 문자로 동시에 재기 위해서다(다른 글자면 한쪽만 틀려도 통과한다).
 */
const PROBES: Array<[name: string, src: string, keep: string[], drop: string[]]> = [
  ['문자열 속 /* (단일인용)', `app.use('/api/*', m());\nconst a = '코드 — 하나';`, ["'/api/*'", '코드 — 하나'], []],
  ['문자열 속 /* (이중인용)', `const p = "/api/*";\nconst a = '코드 — 하나';`, ['"/api/*"', '코드 — 하나'], []],
  ['문자열 속 /* (백틱)', 'const p = `/api/*`;\nconst a = \'코드 — 하나\';', ['`/api/*`', '코드 — 하나'], []],
  ['문자열 속 // (URL)', `const u = 'https://x.com/a';\nconst a = '코드 — 하나';`, ["'https://x.com/a'", '코드 — 하나'], []],
  ['정규식 안 따옴표', `const re = /['"]/;\nconst a = '코드 — 하나';`, ['코드 — 하나'], []],
  ['JSX 닫는 태그', `const el = <div></div>;\nconst a = '코드 — 하나';`, ['코드 — 하나'], []],
  // 🩸 주입이 잡았다: `const s = "don't";` 는 **안전판을 안 쓴다**(바깥 `"` 가 그 줄에서 닫힌다).
  //   진짜 실패 모드는 **닫는 따옴표가 그 줄에 없는** JSX 본문의 홑따옴표다 — 그걸 문자열 시작으로
  //   보면 다음 따옴표까지(여러 줄 넘어) 문자열이 되어 **그 사이 주석이 살아남는다.**
  ['아포스트로피(닫히지 않음)', `<p>대표's 지시</p>\n// 주석 — 지워야\nconst a = '코드 — 하나';`, ['코드 — 하나'], ['주석 — 지워야']],
  ['아포스트로피(같은 줄에서 닫힘)', `const s = "don't";\nconst a = '코드 — 하나';`, ["don't", '코드 — 하나'], []],
  ['라인 주석', `const a = '코드 — 하나'; // 주석 — 지워야`, ['코드 — 하나'], ['주석 — 지워야']],
  ['블록 주석(여러 줄)', `/* 주석 — 지워야\n   계속 — 지워야 */\nconst a = '코드 — 하나';`, ['코드 — 하나'], ['주석 — 지워야', '계속 — 지워야']],
  ['JSX 주석(여러 줄)', `{/* 주석 — 지워야\n   계속 — 지워야 */}\nconst a = '코드 — 하나';`, ['코드 — 하나'], ['주석 — 지워야', '계속 — 지워야']],
  ['여러 줄 템플릿', 'const t = `첫 줄 — 코드\n둘째 줄 — 코드`;', ['첫 줄 — 코드', '둘째 줄 — 코드'], []],
]

describe('주석 제거기 두 벌 — 같은 판정인가 (2026-10-14)', () => {
  it('① 탐침이 비어 있지 않다 (헛도는 시험 차단)', () => {
    // 🔴 목록이 비면 아래 전부가 0회 반복으로 **통과**한다. 이 레포가 반복해 밟은 자리.
    expect(PROBES.length).toBeGreaterThanOrEqual(10)
    expect(PROBES.filter(([, , keep]) => keep.length).length).toBe(PROBES.length)
    expect(PROBES.filter(([, , , drop]) => drop.length).length).toBeGreaterThanOrEqual(3)
  })

  for (const [name, src, keep, drop] of PROBES) {
    it(`② ${name} — 두 제거기가 같은 판정`, () => {
      expect(normBraces(squash(mjs(src)))).toBe(normBraces(squash(scannerStrip(src))))
    })

    it(`③ ${name} — 코드는 남고 주석은 사라진다 (절대 기준)`, () => {
      for (const out of [mjs(src), scannerStrip(src)]) {
        for (const k of keep) expect(out).toContain(k)
        for (const d of drop) expect(out).not.toContain(d)
      }
    })
  }

  it('④ 줄번호가 밀지 않는다 (`.mjs` 계약)', () => {
    // 🔑 `stripCommentsLines` 는 **줄 수와 줄번호를 보존**한다고 선언한다. 밀면 가드가 가리키는
    //   `파일:줄` 이 전부 틀려지고, 틀린 좌표는 "없는 결함" 처럼 읽힌다.
    const src = ['const a = 1;', '/* 주석', '   계속 */', 'const b = `여러', '줄 템플릿`;', 'const c = 3;'].join('\n')
    const pairs = mjsLines(src)
    expect(pairs.length).toBe(src.split('\n').length)
    expect(pairs.map(([n]) => n)).toEqual([1, 2, 3, 4, 5, 6])
    expect(pairs[0][1]).toContain('const a = 1;')
    expect(pairs[5][1]).toContain('const c = 3;')
  })

  it('⑤ 라우터 파일의 문자열이 살아남는다 (실측 회귀 — worker/index.ts)', () => {
    // 🩸 2026-10-14: 이 파일의 `'/api/*'` 때문에 아래 줄들이 전부 비어 있었다. 전부 **진짜 코드**다.
    const src = readFileSync('src/worker/index.ts', 'utf-8')
    const kept = new Map(mjsLines(src))
    expect(kept.size).toBe(src.split('\n').length)
    const blogTitle = [...kept.values()].filter(t => t.includes('유어딜 블로그'))
    expect(blogTitle.length).toBeGreaterThanOrEqual(2)
    // `/blog` 의 <title> — 이 줄이 증발하면 그 문구를 보는 어떤 가드도 못 본다.
    expect(mjs(src)).toContain("const bt = '유어딜 블로그")
  })

  it('⑥ 반대 방향 — 주석을 안 지우는 쪽으로 퇴화하지 않는다', () => {
    // 🔴 "문자열을 추적한다" 를 과하게 적용해 주석을 남기면 em-dash 래칫이 635건으로 돌아간다
    //   (그 값으로는 진짜 문구 회귀가 숨는다 — comment-strip.mjs 머리말의 그 사고).
    const src = readFileSync('src/shared/seo/consumer-surfaces.ts', 'utf-8')
    const out = mjs(src)
    expect(out.length).toBeLessThan(src.length * 0.75)
    expect(normBraces(squash(out))).toBe(normBraces(squash(scannerStrip(src))))
  })

  it('⑦ 두 제거기가 실제 소스 전수에서 같은 판정 (파일 수 하한 포함)', () => {
    const FILES = [
      'src/worker/index.ts',
      'src/worker/utils/surface-ssr-meta.ts',
      'src/worker/utils/crawler-noscript.ts',
      'src/shared/seo/consumer-surfaces.ts',
      'src/shared/seo/consumer-surface-table.ts', // 🗂️ 2026-11-01 표 분리(주석 본산이 이쪽으로 갔다)
      'src/shared/seo/surface-copy.ts',
      'src/components/main/SiteFooter.tsx',
      'src/pages/CreatorsPage.tsx',
      'src/pages/AboutPage.tsx',
      'src/features/group-buy/api/group-buy-public.routes.ts',
      'src/features/auth/api/kakao.routes.ts',
    ]
    expect(FILES.length).toBeGreaterThanOrEqual(10)
    const diff: string[] = []
    for (const f of FILES) {
      const src = readFileSync(f, 'utf-8')
      if (!same(src)) diff.push(f)
    }
    expect(diff).toEqual([])
  })

  it('⑧-0 `{}` 정규화는 **딱 `{}` 만** 지운다 (정규화가 탈출구가 되는 것 차단)', () => {
    // 🩸 주입이 잡았다: ⑧ 이 `normBraces` 를 쓰니 정규화를 넓히면 ⑧ 자신도 같이 눈이 먼다.
    //   그래서 정규화 **함수 자체**를 여기서 좁게 고정한다.
    expect(normBraces('x{}y')).toBe('xy')
    expect(normBraces('코드—하나')).toBe('코드—하나')
    expect(normBraces("app.use('/api/*')")).toBe("app.use('/api/*')")
    expect(normBraces('a{b}c')).toBe('a{b}c')   // 내용 있는 중괄호는 안 건드린다
  })

  it('⑧ 둘의 차이는 **정확히 JSX 주석의 `{}` 잔재뿐**이다', () => {
    // 🔑 ⑦ 이 `{}` 를 지우고 비교하므로, 그 정규화가 *다른* 차이까지 덮지 않는지 여기서 본다.
    //   실측(2026-10-14): JSX 를 쓰는 세 파일에서만 차이가 났고 전부 `{}` 였다.
    //   한쪽이 다른 걸 더/덜 지우기 시작하면 이 단언이 빨간불이다.
    const JSX = ['src/components/main/SiteFooter.tsx', 'src/pages/CreatorsPage.tsx', 'src/pages/AboutPage.tsx']
    let brace = 0
    for (const f of JSX) {
      const src = readFileSync(f, 'utf-8')
      const a = squash(mjs(src)), b = squash(scannerStrip(src))
      // 차이가 있다면 `{}` 를 지운 뒤에는 사라져야 한다.
      if (a !== b) { brace++; expect(normBraces(a)).toBe(normBraces(b)) }
      // 그리고 `.mjs` 쪽이 더 짧아야 한다(= 더 많이 지운다). 길어지면 주석을 남기기 시작한 것이다.
      expect(a.length).toBeLessThanOrEqual(b.length)
    }
    // 🔴 0 이면 이 단언이 아무것도 재지 않는다(JSX 주석이 사라졌거나 경로가 낡았다).
    expect(brace).toBeGreaterThanOrEqual(1)
  })
})
