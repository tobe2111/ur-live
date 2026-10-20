/**
 * 🎨 셀러 2차 페이지 정리 (2026-09-15) — 색 정보상자 0 · 이모지 0 · 버튼 체계 · 숫자 위계.
 *
 * 왜 가드가 필요한가: 같은 자리에서 두 번 났다.
 *  ① `git ls-files 'src/pages/seller-＊/＊＊/＊.tsx'` 는 0개를 돌려준다(git 은 이중 별표를 `:(glob)` 없이 안 푼다).
 *     그래서 버튼 체계 가드가 "62개 검사" 라고 초록을 찍는 동안 `seller-＊/` 54개 파일은 검사 밖이었다 —
 *     헛도는 가드 클래스(CLAUDE.md "가드가 실패할 수 없음"). 이 테스트는 그 글로브를 고정한다.
 *  ② 색 정보상자는 파일마다 새로 생긴다(파랑 안내 · 노랑 주의 · 초록 완료). 래칫 0 으로 잠근다.
 *
 * 주입 매니페스트: scripts/mutations/seller-tones.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'
import { convertClassString, GLOBS, listFiles } from '../../../scripts/codemods/adopt-dashboard-tones.mjs'

const read = (p: string) => readFileSync(p, 'utf8')
const COLOR = '(?:red|rose|amber|yellow|orange|emerald|green|blue|sky|indigo|purple|violet)'
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{2604}\u{2607}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{2728}\u{26A0}\u{2713}\u{23F3}]/u

describe('① 셀러 표면 글로브 — 하위 폴더가 실제로 검사 대상이다', () => {
  it('git ls-files 가 `:(glob)` 으로 seller-*/ 하위를 편다 (없으면 0개)', () => {
    const files = listFiles('seller') as string[]
    expect(files.filter((f) => f.startsWith('src/pages/seller-')).length).toBeGreaterThan(40)
    expect(files.filter((f) => f.startsWith('src/components/seller/')).length).toBeGreaterThan(10)
  })
  it('버튼 체계 가드·코드모드도 같은 글로브를 쓴다 — 가드가 조용히 좁아지지 않게', () => {
    for (const p of ['scripts/check-dashboard-button-system.mjs', 'scripts/codemods/adopt-button-system.mjs']) {
      const s = read(p)
      expect(s, p).toContain("':(glob)src/pages/seller-*/**/*.tsx'")
      expect(s, p).toContain("':(glob)src/components/seller/**/*.tsx'")
    }
    expect(GLOBS.seller).toContain(':(glob)src/pages/seller-*/**/*.tsx')
  })
})

describe('② 색 정보상자 0 · 이모지 0 (래칫)', () => {
  const files = listFiles('seller') as string[]
  it('대상 파일이 충분히 있다 — 경로가 낡으면 통과가 아니라 실패', () => { expect(files.length).toBeGreaterThan(100) })
  it('bg-{색}-50/100 정보상자·배지가 셀러 표면에 없다 (톤 토큰 bg-tone-*-bg 만)', () => {
    const bad: string[] = []
    for (const f of files) {
      const s = stripComments(read(f))
      const m = s.match(new RegExp(`\\bbg-${COLOR}-(?:50|100)\\b`, 'g'))
      if (m) bad.push(`${f}: ${m.join(' ')}`)
    }
    expect(bad).toEqual([])
  })
  it('UI 코드에 이모지가 없다 (허용 2곳: 평점 ★ 는 이모지가 아니고, 카카오 메시지 본문은 콘텐츠)', () => {
    const bad: string[] = []
    for (const f of files) {
      if (/SellerKakaoNotifyButton/.test(f)) continue
      stripComments(read(f)).split('\n').forEach((ln, i) => { if (EMOJI.test(ln)) bad.push(`${f}:${i + 1}`) })
    }
    expect(bad).toEqual([])
  })
  it('ko 로케일의 seller.* 값에 이모지가 없다 (메시지 본문 3키 제외)', () => {
    const KEEP = new Set(['seller.gift.messagePlaceholder', 'seller.cartNotificationDesc', 'seller.kakaoNotify.defaultMessage'])
    const j = JSON.parse(read('public/locales/ko/translation.json'))
    const bad: string[] = []
    const walk = (o: Record<string, unknown>, pfx: string) => {
      for (const [k, v] of Object.entries(o)) {
        const q = pfx ? `${pfx}.${k}` : k
        if (typeof v === 'string') { if (/^(seller|sellerWaiting)/.test(q) && !KEEP.has(q) && EMOJI.test(v)) bad.push(q) }
        else if (v && typeof v === 'object') walk(v as Record<string, unknown>, q)
      }
    }
    walk(j, '')
    expect(bad).toEqual([])
  })
  it('큰 숫자는 dash-num 위계다 — 페이지 본문에 text-2xl 숫자가 남지 않는다 (독립 인증 화면의 제목 3곳 허용)', () => {
    const bad: string[] = []
    for (const f of files) {
      if (/Forgot|ResetPassword|YoutubeGrowthSuccess/.test(f)) continue
      if (/\btext-2xl font-(?:bold|extrabold)/.test(stripComments(read(f)))) bad.push(f)
    }
    expect(bad).toEqual([])
  })
})

describe('③ 코드모드 규칙 — 되돌아가지 않게 동작을 고정', () => {
  it('정보상자: 색 면 + 색 테두리 → 흰 카드 + 헤어라인, 글자는 톤', () => {
    expect(convertClassString('rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800'))
      .toBe('rounded-xl bg-white border border-rule p-4 text-xs text-tone-warn')
    // 테두리 없던 면에는 `border` 를 붙인다 — 안 붙이면 흰 배경 위 흰 카드가 되어 사라진다
    expect(convertClassString('bg-blue-50 rounded-lg p-3')).toBe('border border-rule bg-white rounded-lg p-3')
  })
  it('배지: rounded-full 이면 톤 배경+톤 글자, 정보색은 tone-info', () => {
    expect(convertClassString('px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px]'))
      .toBe('px-2 py-0.5 rounded-full bg-tone-ok-bg text-tone-ok text-[10px]')
    // 삼항 조각은 자기 안에 rounded-full 이 없다 — 바깥 문맥(ctx)으로 판정해야 배지로 남는다
    expect(convertClassString('bg-blue-100 text-blue-700', 'w-7 h-7 rounded-full ${x ? "bg-blue-100 text-blue-700" : ""}'))
      .toBe('bg-tone-info-bg text-tone-info')
  })
  it('선택 상태: border-{색}-500 bg-{색}-50 → 브랜드 틴트, 선택 글자는 brand-text', () => {
    expect(convertClassString('border-blue-500 bg-blue-50 text-blue-700')).toBe('border-brand bg-brand-tint text-brand-text')
  })
  it('큰 숫자의 정보색은 잉크, 링크는 brand-text, 호버 면은 회색', () => {
    expect(convertClassString('text-2xl font-bold text-blue-600')).toBe('text-2xl font-bold text-gray-900')
    expect(convertClassString('text-xs text-blue-600 hover:underline')).toBe('text-xs text-brand-text hover:underline')
    expect(convertClassString('p-2 hover:bg-red-50 text-red-400 hover:text-red-600')).toBe('p-2 hover:bg-gray-100 text-gray-400 hover:text-tone-bad')
  })
  it('단색 버튼(bg-{색}-600)은 건드리지 않는다 — 버튼은 adopt-button-system 의 몫', () => {
    expect(convertClassString('px-4 py-2 bg-red-600 text-white rounded-lg')).toBe('px-4 py-2 bg-red-600 text-white rounded-lg')
  })
})
