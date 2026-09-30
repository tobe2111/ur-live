import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

/**
 * 🔠📐 **소비자 전 화면 — 본문 스케일 다섯 단계 + 4px 격자** (2026-09-29 — 대표가 UI 개선 네 트랙을
 *   전부 승인, 그 ③번).
 *
 * ## 무엇이 잘못됐었나 (세어 본 값)
 * 소비자 파일 252개에 글자 크기가 **42단계 · 1,325건**이었다:
 *   `9 · 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 14.5 · 15 · 15.5 · 16 · 16.5 · 17 · …`
 * 거기에 tailwind 기본 단계(`text-sm`·`text-xs`…) **270건**이 섞여 **체계가 둘**이었고,
 * 반쪽 간격이 **755건**이었다.
 *
 * 2026-09-28 에 마이 한 화면에서 같은 것을 고치며 규칙 ⑧이 생겼는데, 그 시험은 스스로
 * *"마이 밖 화면은 범위가 아니다 — 넓히려면 SURFACES 에 폴더를 더한다"* 고 적어 뒀다.
 * 이 파일이 그 확장이다.
 *
 * ## 정본 (CLAUDE.md 🎫 ⑧)
 * 본문 `12 · 13 · 15 · 17 · 24` (+ 큰 숫자 `28`). 간격은 **4의 배수**만.
 *
 * ## ⚠️ 디스플레이(26px+)는 **일부러 안 건드렸다**
 * 랜딩 히어로의 40·46px 를 28 로 눌러 버리면 그 화면의 위계를 내가 혼자 바꾸는 일이 된다.
 * 지금 26px 이상은 26·28·29·30·32·34·36·40·42·44·46·48·56·58·66 으로 **또 한 번 가까운 값이 겹쳐
 * 있고**(26 vs 28 vs 29 vs 30), 그걸 몇 단계로 묶을지는 제품 판단이라 **대표에게 따로 올렸다.**
 * 그때까지는 `DISPLAY_BASELINE` 으로 **늘지 않게만** 막는다.
 *
 * ## 🔒 잠금표 파일은 **일부러 안 고쳤다** (대표 승인 대기)
 * `LOCKED` 세 파일은 Toss V2 / 로딩 잠금표에 있다. **클래스만 바꾸는 일이어도** 잠금 절대 룰이
 * 걸려 대표 승인(`AskUserQuestion`)과 audit log 항목이 필요하다 — 2026-09-28 의 검정 버튼 이행이
 * `primary-button-baseline.json` 으로 남긴 것과 **같은 처리**다.
 * 게다가 이건 색만 바뀌는 일도 아니다: `text-[9px]` → `12px` 면 **하단 탭 라벨과 온누리 뱃지가
 * 눈에 띄게 커진다**(잠금표가 지키는 `BottomNav` 탭 구조 · `GroupBuyFeedCard` 카드 높이 근처다).
 * ⇒ 지금은 **늘지 않게만** 막고(`LOCKED_BASELINE`), 승인이 나면 고친 뒤 이 세 줄을 지운다.
 * 🛡️ `LOCKED` 에 아무 파일이나 넣어 검사를 빠져나가지 못하게, **CLAUDE.md 잠금표에 실제로
 *    적힌 파일인지**를 아래 시험이 대조한다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 인라인 `style` · CSS 파일의 크기값 (Tailwind 임의값 토큰만 본다).
 * - 크기는 맞는데 **자리가 틀린** 경우(설명을 15 로, 제목을 13 으로) — 그림으로만 보인다.
 * - 대시보드(어드민·셀러·에이전시·도매)는 범위 밖이다(그쪽은 별도 체계).
 */

/**
 * 🕳️ **`src/pages/**\/*.tsx` 만 쓰면 최상위 파일이 통째로 빠진다** (2026-09-29 실측).
 * git pathspec 의 `**` 는 `FNM_PATHNAME` 이라 **디렉터리를 최소 하나 요구**한다 —
 * `src/pages/AffiliatePage.tsx` 같은 파일 734개가 조용히 검사 밖이었다(이 시험의 첫 판이 그랬다).
 * 에러가 안 나고 "459개 검사함" 처럼 보여서, 가드가 **지키는 척**만 하고 있었다.
 * ⇒ 최상위와 하위를 **둘 다** 명시한다. 하한(아래 `seen`)이 그 회귀를 다시 잡는다.
 */
const files = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
)
  .trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))

/** 본문 스케일 — 이 범위(≤25px)에서는 이것뿐이다. */
const BODY = new Set(['12px', '13px', '15px', '17px', '24px'])
/** 디스플레이 경계 — 이보다 크면 이 시험의 판단 밖(위 머리말 참조). */
const DISPLAY_FROM = 26
/** 디스플레이 크기를 가진 파일 수 — **늘면 빨간불**(줄이는 건 자유). */
const DISPLAY_BASELINE = 66

/**
 * 🔒 잠금표 파일 — 대표 승인 전까지 손대지 않는다(위 머리말). **늘지 않게만** 막는다.
 * 승인이 나면 고친 뒤 이 세 줄과 `LOCKED_BASELINE` 을 함께 지운다.
 */
const LOCK_ROWS = new Set(
  [...readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]),
)
/**
 * 🪞 **잠금 파일의 그림자** — 존재 이유가 "잠긴 블록과 같은 클래스로 자리를 잡는 것" 인 파일.
 * 정본으로 이행하면 **거울이 깨져** 그 파일이 막으려던 레이아웃 밀림이 그대로 돌아온다
 * (2026-09-29 실측: 예약 `py-2` vs 진짜 `py-2.5` → 첫 방문자 화면이 다시 내려앉는다).
 * ⇒ 거울은 **원본이 이행될 때 같이** 간다. 원본이 잠금표에 실재하는지는 아래 시험이 대조한다.
 */
const MIRRORS: Record<string, string> = {
  'src/pages/vouchers/TopChromeReserve.tsx': 'src/pages/VouchersPage.tsx',
}
const LOCKED = files.filter((f) => LOCK_ROWS.has(f) || f in MIRRORS)
/** 그 파일들의 현재 위반 수(고유 토큰 기준) — 줄이는 건 자유, 늘면 빨간불. */
const LOCKED_BASELINE = { size: 22, tw: 29, half: 50 }

/** 잠금표 밖 = 이 시험이 정본을 강제하는 범위. */
const open = files.filter((f) => !LOCKED.includes(f))

const read = (f: string) => stripComments(readFileSync(f, 'utf8'))

/** 세 검사가 쓰는 스캐너 — 잠금표 파일도 **같은 잣대**로 세야 baseline 이 의미가 있다. */
const scan = {
  size: (fs: string[]) => {
    const bad: string[] = []
    let seen = 0
    for (const f of fs) {
      for (const m of read(f).matchAll(/text-\[([0-9.]+)px\]/g)) {
        const n = parseFloat(m[1])
        if (n >= DISPLAY_FROM) continue
        seen++
        if (!BODY.has(`${m[1]}px`)) bad.push(`${f}: ${m[1]}px`)
      }
    }
    return { bad: [...new Set(bad)], seen }
  },
  tw: (fs: string[]) => {
    const bad: string[] = []
    for (const f of fs) {
      for (const m of read(f).matchAll(/(?:^|[\s"'`{:])((?:[a-z-]+:)*text-(?:xs|sm|base|lg|xl|2xl))\b/g)) {
        bad.push(`${f}: ${m[1]}`)
      }
    }
    return { bad: [...new Set(bad)], seen: bad.length }
  },
  half: (fs: string[]) => {
    const bad: string[] = []
    let seen = 0
    const PROPS = '(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap|gap-x|gap-y|space-x|space-y)'
    for (const f of fs) {
      const src = read(f)
      for (const _ of src.matchAll(new RegExp(`(?:^|[\\s"'\`{:])(?:[a-z-]+:)*${PROPS}-\\d+(?![\\w.-])`, 'g'))) seen++
      // 음수(`-mt-0.5`)는 앞 글자가 `-` 라 아래 패턴에 안 걸린다 — 의도한 예외다.
      for (const m of src.matchAll(new RegExp(`(?:^|[\\s"'\`{:])((?:[a-z-]+:)*${PROPS}-\\d+\\.5)(?![\\w-])`, 'g'))) {
        bad.push(`${f}: ${m[1]}`)
      }
    }
    return { bad: [...new Set(bad)], seen }
  },
}

describe('소비자 — 본문 타입 스케일', () => {
  it('🔠 본문 크기(≤25px)는 12/13/15/17/24 뿐이다', () => {
    const { bad, seen } = scan.size(open)
    // 대상이 0이면 통과가 아니라 실패다 — 경로가 낡아 조용히 비는 것을 막는다.
    expect(seen, `본문 크기 토큰을 ${seen}개밖에 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(3000)
    expect(bad, `스케일 밖 본문 크기:\n${bad.join('\n')}`).toEqual([])
  })

  it('🔠 tailwind 기본 본문 단계(text-xs/sm/base/lg/xl/2xl)를 섞지 않는다', () => {
    /**
     * 체계가 둘이면 스케일이 무의미해진다 — `text-sm`(14px)은 정본 13 과 15 사이에 있어서
     * 한 화면에 셋이 같이 서면 어느 두 줄도 서로 동의하지 않는다.
     * ⚠️ `3xl`(30) 이상은 디스플레이라 여기서 안 본다(위 머리말).
     */
    const { bad } = scan.tw(open)
    expect(bad, `기본 단계 사용:\n${bad.join('\n')}`).toEqual([])
  })
})

describe('소비자 — 간격은 4px 격자', () => {
  it('📐 반쪽 간격(`*-0.5`·`*-1.5`·`*-2.5`·`*-3.5`)이 없다 (음수 광학 보정은 예외)', () => {
    const { bad, seen } = scan.half(open)
    expect(seen, `간격 토큰을 ${seen}개밖에 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(7000)
    expect(bad, `반쪽 간격:\n${bad.join('\n')}`).toEqual([])
  })
})

describe('소비자 — 디스플레이 크기는 늘지 않는다 (대표 판단 대기)', () => {
  it('🖼️ 26px 이상을 쓰는 파일 수가 baseline 을 안 넘는다', () => {
    const hit = files.filter((f) => {
      const src = read(f)
      if (/(?:^|[\s"'`{:])(?:[a-z-]+:)*text-[3-9]xl\b/.test(src)) return true
      return [...src.matchAll(/text-\[([0-9.]+)px\]/g)].some((m) => parseFloat(m[1]) >= DISPLAY_FROM)
    })
    expect(hit.length, `디스플레이 크기 파일이 늘었다(baseline ${DISPLAY_BASELINE}):\n${hit.join('\n')}`)
      .toBeLessThanOrEqual(DISPLAY_BASELINE)
  })
})

describe('소비자 — 잠금표 파일은 늘지 않는다 (대표 승인 대기)', () => {
  it('🔒 `LOCKED` 는 CLAUDE.md 잠금표에 실제로 적힌 파일뿐이다', () => {
    /**
     * 이 목록이 **검사를 빠져나가는 문**이 되면 안 된다 — 아무 파일이나 넣으면 그 화면은
     * 조용히 정본 밖으로 나간다(이 레포가 반복해 당한 "조용한 부재").
     * ⇒ 잠금표 행(`| \`src/…\` |`)에 실제로 있는 파일만 허용한다.
     */
    const md = readFileSync('CLAUDE.md', 'utf8')
    const rows = new Set([...md.matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]))
    expect(rows.size, `잠금표 행을 ${rows.size}개밖에 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(20)
    const stray = LOCKED.filter((f) => !rows.has(f) && !(f in MIRRORS))
    expect(stray, '잠금표에도 없고 거울도 아닌 파일이 제외 목록에 있다').toEqual([])
    // 거울은 **잠긴 원본**만 가리킬 수 있다 — 아무 파일이나 가리키면 그것도 탈출구다.
    const badMirror = Object.entries(MIRRORS).filter(([, src]) => !rows.has(src))
    expect(badMirror, '거울이 잠금표에 없는 파일을 가리킨다').toEqual([])
  })

  it('🔒 잠금표 파일의 위반 수가 baseline 을 안 넘는다', () => {
    const now = {
      size: scan.size(LOCKED).bad.length,
      tw: scan.tw(LOCKED).bad.length,
      half: scan.half(LOCKED).bad.length,
    }
    for (const k of ['size', 'tw', 'half'] as const) {
      expect(
        now[k],
        `잠금표 파일 ${k} 위반이 ${LOCKED_BASELINE[k]} → ${now[k]} 로 늘었다.\n` +
          `줄였다면 LOCKED_BASELINE 을 내리고, 0 이 되면 그 파일을 LOCKED 에서 빼라.`,
      ).toBeLessThanOrEqual(LOCKED_BASELINE[k])
    }
  })
})
