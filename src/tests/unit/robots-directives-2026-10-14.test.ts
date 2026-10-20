/**
 * 🤖 2026-10-14 — `robots` 메타 값이 **한 곳에서만** 정해지는지.
 *
 * 근거·실측·왜 상수가 둘인지는 `src/shared/seo/robots-directives.ts` 머리말.
 * 요약: ① 색인 대상 12경로가 전부 `index, follow` 하나였다(`max-image-preview` 0건)
 *       ② noindex 표면이 서버 `noindex, follow` ↔ 클라 `noindex, nofollow` 로 갈려 있었고,
 *          react-helmet-async 가 서버 태그를 지우지 않으므로 **둘이 공존**해 가장 제한적인
 *          `nofollow` 가 이기고 있었다.
 *
 * ⚠️ **이 시험이 못 보는 것**
 *   - 구글이 실제로 큰 이미지를 쓰는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다)
 *   - HTMLRewriter 런타임 동작(워커 전용 API 라 유닛 밖)
 *   - 브라우저에서 robots 메타가 정말 하나인지 — react-helmet 의 DOM 동기화는 소스로만 재고,
 *     *렌더해서* 세는 것은 별건이다(그 대신 여기서는 **클라가 내는 값**이 SSOT 와 같은지 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ROBOTS_INDEX, ROBOTS_NOINDEX } from '@/shared/seo/robots-directives'
import { readCode, readRaw } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf-8')

/**
 * robots 값을 **따옴표 안에 박은** 모양. ⑤-1 과 ⑤-2 가 **같은 식**을 쓴다 —
 * 탐침이 자기 사본을 쓰면 ⑤-1 의 식을 무력화해도 탐침이 통과해 **어느 쪽도 판정하지 못한다**
 * (2026-10-14 되돌려-검증이 그렇게 잡았다. 중복 잠금은 각 잠금을 시험 불가능하게 만든다).
 */
const ROBOTS_LITERAL_RE = /content="(?:no)?index[^"]*"/g

/** 실행되는 줄만 — 설명 주석이 값을 인용하므로 원문을 검사하면 거짓 통과·거짓 빨간불이 난다. */
const code = (p: string) => readCode(p)

describe('🤖 robots 지시어 SSOT', () => {
  // ──────────────────────────────── ① 상수 자체
  it('①-1 색인 값에 max-image-preview:large 가 있다', () => {
    expect(ROBOTS_INDEX).toContain('max-image-preview:large')
    expect(ROBOTS_INDEX.startsWith('index')).toBe(true)
    expect(ROBOTS_INDEX).toContain('follow')
    // 🔴 반대 방향 — 색인 값에 noindex·nofollow 가 섞이면 전 표면이 색인에서 빠진다.
    expect(/\bnoindex\b/.test(ROBOTS_INDEX)).toBe(false)
    expect(/\bnofollow\b/.test(ROBOTS_INDEX)).toBe(false)
  })

  it('①-2 색인제외 값은 follow 다 (nofollow 면 크롤 경로가 끊긴다)', () => {
    expect(ROBOTS_NOINDEX).toContain('noindex')
    expect(/\bnofollow\b/.test(ROBOTS_NOINDEX)).toBe(false)
    expect(/(^|[,\s])follow\b/.test(ROBOTS_NOINDEX)).toBe(true)
    // noindex 에 이미지 미리보기 지시어를 붙이지 않는다(색인 안 하는 페이지엔 의미가 없다).
    expect(ROBOTS_NOINDEX).not.toContain('max-image-preview')
  })

  it('①-3 max-image-preview 값은 구글이 정의한 셋 중 하나다', () => {
    const m = ROBOTS_INDEX.match(/max-image-preview:\s*([a-z]+)/)
    expect(m).not.toBeNull()
    expect(['none', 'standard', 'large']).toContain(m![1])
  })

  // ──────────────────────────────── ② index.html 리터럴 ↔ 상수
  it('②-1 index.html 의 robots 값이 ROBOTS_INDEX 와 같은 글자다', () => {
    // 정적 HTML 은 TS 를 import 할 수 없어 여기만 리터럴이다 — 그래서 대조가 유일한 잠금이다.
    const html = read('index.html')
    const metas = html.match(/<meta[^>]*name="robots"[^>]*>/g) ?? []
    // 주석 안 인용은 `<meta` 로 시작하지 않으므로 안 걸린다(이 파일의 설명 주석이 그 경우다).
    expect(metas.length).toBe(1)
    const content = (metas[0] ?? '').match(/content="([^"]*)"/)?.[1]
    expect(content).toBe(ROBOTS_INDEX)
  })

  // ──────────────────────────────── ③ 봇 셸 ↔ 상수
  it('③-1 봇 셸이 상수를 보간한다 (리터럴을 손으로 적지 않는다)', () => {
    const w = code('src/worker/index.ts')
    expect(w).toContain('<meta name="robots" content="${ROBOTS_INDEX}" />')
    expect(w).toContain("from '../shared/seo/robots-directives'")
  })

  it('③-2 워커 noindex rewrite 두 곳이 상수를 쓴다', () => {
    const w = code('src/worker/index.ts')
    const s = code('src/worker/utils/surface-ssr-meta.ts')
    expect(w).toContain("el.setAttribute('content', ROBOTS_NOINDEX)")
    expect(s).toContain("el.setAttribute('content', ROBOTS_NOINDEX)")
  })

  // ──────────────────────────────── ④ 클라(react-helmet) ↔ 상수
  it('④-1 SEO.tsx 가 상수를 쓴다 — nofollow 리터럴이 되살아나지 않는다', () => {
    const s = code('src/components/SEO.tsx')
    expect(s).toContain('content={ROBOTS_NOINDEX}')
    expect(s).not.toContain('noindex, nofollow')
  })

  it('④-2 초대장 두 페이지도 상수를 쓴다 (/i/join · /i/offer — robots.txt 가 안 막는다)', () => {
    for (const p of ['src/pages/InfluencerJoinPage.tsx', 'src/pages/InfluencerOfferAcceptPage.tsx']) {
      const s = code(p)
      expect(s, p).toContain('content={ROBOTS_NOINDEX}')
      expect(s, p).not.toContain('noindex, nofollow')
    }
  })

  // ──────────────────────────────── ⑤ 전수 — SSOT 밖 리터럴 0
  it('⑤-1 소비자 표면 소스에 robots 값 리터럴이 남아 있지 않다', () => {
    // 🔎 유어애즈 단축링크 404(`shortlink-redirect.routes.ts`)는 **범위 밖**이다 —
    //    다른 레일(유어애즈)의 독립 오류 문서이고 값이 bare `noindex`(= follow 가 기본)라
    //    우리가 고친 "두 값이 갈린다" 클래스에 해당하지 않는다.
    const files = [
      'src/components/SEO.tsx',
      'src/worker/index.ts',
      'src/worker/utils/surface-ssr-meta.ts',
      'src/pages/InfluencerJoinPage.tsx',
      'src/pages/InfluencerOfferAcceptPage.tsx',
    ]
    for (const f of files) {
      const s = code(f)
      // `content="index..."` / `content="noindex..."` 처럼 **따옴표 안에 값을 박는** 모양만 잡는다.
      const bad = s.match(ROBOTS_LITERAL_RE) ?? []
      expect(bad, `${f} 에 robots 리터럴`).toEqual([])
    }
  })

  it('⑤-2 이 시험이 정말 리터럴을 잡는다 (헛도는 검사 차단)', () => {
    const probe = `<meta name="robots" content="index, follow" />`
    expect((probe.match(ROBOTS_LITERAL_RE) ?? []).length).toBe(1)
    const ok = `<meta name="robots" content={ROBOTS_NOINDEX} />`
    expect((ok.match(ROBOTS_LITERAL_RE) ?? []).length).toBe(0)
  })

  // ──────────────────────────────── ⑥ 주석 제거가 판정을 흐리지 않는다
  it('⑥-1 설명 주석이 값을 인용해도 판정에 안 섞인다', () => {
    // 이 레포가 반복해 밟은 함정 — 제거를 기록한 주석이 검사 대상 문자열을 품는다.
    const raw = readRaw('src/shared/seo/robots-directives.ts')
    expect(raw).toContain('noindex, nofollow')          // 머리말이 사고를 인용한다
    const stripped = readCode('src/shared/seo/robots-directives.ts')
    expect(stripped).not.toContain('nofollow')          // 실행되는 줄엔 없다
  })
})
