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
 * ## 🖼️ 디스플레이(26px+) — 2026-09-30 에 이행됐다
 * 이 자리에는 *"랜딩 히어로의 위계를 세션이 혼자 바꿀 수 없으니 대표 판단으로 올렸다"* 고 적혀
 * 있었다. 대표가 결정했다(**"다 순서대로 이상적으로 해줘"**) → 7 rung 모듈러 스케일로 묶었다.
 *   정본 `28 · 34 · 40 · 48 · 60 · 76 · 96`   (비율 1.21 · 1.18 · 1.20 · 1.25 · 1.27 · 1.26)
 * 이행 전은 **임의 px 25단계 130건 + tailwind `3xl~7xl` 5단계 48건** = 체계가 둘이었다.
 * 이동은 최대 6px(66→60 · 54→48), 대부분 ≤2px. 코드모드 `scripts/codemods/display-scale.mjs`.
 *
 * 🩸 **코드모드가 조용히 만든 결함을 하나 잡았다 — 반응형 사다리 붕괴.** 7 rung 은 원본보다
 * 촘촘하지 않아서 `34/44/58/66` → `34/40/60/60` 처럼 **인접 rung 이 같아진다**(그 브레이크포인트가
 * 아무 일도 안 한다). 빌드도 화면도 안 깨지고 에러도 없다. 5곳을 전수로 찾아 **늘리지 않고 잉여
 * rung 을 덜어내는** 쪽으로 손으로 고쳤고(늘리면 −10px 급 이동이 생긴다), 아래 시험이 고정한다.
 *
 * ## ⚠️ 96px 초과는 글자가 아니라 **그래픽**이라 무접촉
 *   `IntroducePage` 100px(`opacity-[0.04] select-none` 워터마크) · `NotFoundPage` 140/200px(404 글리프)
 * 스케일에 밀어넣으면 그림이 망가진다. 진짜 글자가 이 예외로 새지 못하게, 아래 시험이
 * **`select-none` 인지** 대조한다.
 *
 * ## 🔓 잠금표 파일도 이행됐다 (2026-09-30 대표 승인 "다 순서대로 이상적으로 해줘")
 * 이 자리에는 *"클래스만 바꾸는 일이어도 잠금 절대 룰이 걸려 승인이 필요하다"* 며 `LOCKED_BASELINE`
 * 으로 **늘지 않게만** 막아 둔 절이 있었다. 승인이 나서 12파일을 전부 정본으로 옮겼고
 * (`scripts/codemods/locked-type-scale.mjs`), 그래서 **제외 목록도 baseline 도 없앴다** —
 * 남겨 두면 그 파일들이 조용히 정본 밖에 머문다.
 *
 * 🔒 **잠긴 계약은 한 글자도 안 움직였다**: 이행 전후로 23종 지문(`requestPayment`·`widgets()`·
 * `setAmount`·SDK 마운트 id·`safePaymentReturnPath`·`confirmPayment`·`serverTotal`·`linkshopPath`·
 * `isActivePath`·`React.memo`·`rootMargin`·`aboveFold`·`shouldLoadSdk`·`__SSR_INITIAL_*`·`price_low`)을
 * grep 카운트로 대조해 **전부 동일**함을 확인했다(핸드오프에 표로 남겼다). 바뀐 것은 className 토큰뿐이다.
 *
 * 🪞 거울(`TopChromeReserve`)은 원본(`VouchersPage`)과 **같은 커밋에서 같이** 옮겼다 — 따로 가면
 * 예약 높이가 어긋나 첫 방문자 화면이 내려앉는다(2026-09-29 에 실제로 그렇게 깨뜨렸다).
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
/** 디스플레이 경계 — 이 이상은 아래 `DISPLAY` 스케일이 강제한다. */
const DISPLAY_FROM = 26
/** 디스플레이 정본 — 7 rung 모듈러 스케일 (2026-09-30 대표 결정). */
const DISPLAY = new Set([28, 34, 40, 48, 60, 76, 96])
/** 이보다 크면 글자가 아니라 그래픽 — `select-none` 이어야 한다(위 머리말). */
const GRAPHIC_ABOVE = 96

/**
 * 🔒 잠금표 파일 — 대표 승인 전까지 손대지 않는다(위 머리말). **늘지 않게만** 막는다.
 * 승인이 나면 고친 뒤 이 세 줄과 `LOCKED_BASELINE` 을 함께 지운다.
 */
/** 정본을 강제하는 범위 = 소비자 전 화면. 2026-09-30 부터 잠금표 파일도 포함한다(위 머리말). */
const open = files

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
    // 🕳️ 2026-09-30: `ml`·`mr` 이 빠져 있었다 — 이 검사가 35건을 못 보고 있었다.
    const PROPS = '(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)'
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

describe('소비자 — 디스플레이 스케일 일곱 단계', () => {
  it('🖼️ 정본 집합이 CLAUDE.md 와 일치한다 (가드가 스스로 스케일을 넓힐 수 없다)', () => {
    /**
     * 🛡️ 이 시험 없이는 **`DISPLAY` 에 값을 하나 더하면 아무것도 안 깨진다** — 가드가 자기
     * 기준을 조용히 헐겁게 만드는 길이 열린다(이 레포가 반복해 당한 클래스: 래칫을 올리거나
     * 허용목록에 이름을 더해 통과시키는 것). 정본은 사람이 읽는 자리(CLAUDE.md 규칙 ⑧)에 있고,
     * 코드는 그것과 **같아야** 한다.
     */
    const md = readFileSync('CLAUDE.md', 'utf8')
    const m = md.match(/디스플레이\(26px 이상\)는 일곱 단계 — `([0-9 ·]+)`/)
    expect(m, 'CLAUDE.md 규칙 ⑧ 에서 디스플레이 스케일 문장을 못 찾았다 — 문서와 코드가 갈렸다').toBeTruthy()
    const documented = m![1].split('·').map((x) => Number(x.trim()))
    expect(documented.length, '문서의 rung 수').toBe(7)
    expect([...DISPLAY].sort((a, b) => a - b), '코드의 DISPLAY 가 문서와 다르다').toEqual(documented)
  })

  it('🖼️ 26px 이상은 28/34/40/48/60/76/96 뿐이다 (96 초과는 그래픽)', () => {
    const bad: string[] = []
    let seen = 0
    for (const f of open) {
      for (const m of read(f).matchAll(/text-\[([0-9.]+)px\]/g)) {
        const n = parseFloat(m[1])
        if (n < DISPLAY_FROM) continue
        seen++
        if (n > GRAPHIC_ABOVE) continue // 그래픽 — 아래 시험이 따로 본다
        if (!DISPLAY.has(n)) bad.push(`${f}: ${n}px`)
      }
    }
    // 대상이 0이면 통과가 아니라 실패다 — 경로가 낡아 조용히 비는 것을 막는다.
    expect(seen, `디스플레이 토큰을 ${seen}개밖에 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(120)
    expect([...new Set(bad)], `스케일 밖 디스플레이 크기:\n${[...new Set(bad)].join('\n')}`).toEqual([])
  })

  it('🖼️ tailwind 디스플레이 단계(text-3xl~9xl)를 섞지 않는다', () => {
    /**
     * 본문이 `text-[Npx]` 로 통일돼 있는데 디스플레이만 tailwind 단계를 쓰면 **체계가 둘**이 된다.
     * 이행 전 실측: `3xl`(30)×20 · `4xl`(36)×16 · `5xl`(48)×7 · `6xl`(60)×4 · `7xl`(72)×1.
     */
    const bad: string[] = []
    for (const f of open) {
      for (const m of read(f).matchAll(/(?:^|[\s"'`{:])((?:[a-z-]+:)*text-[3-9]xl)\b/g)) bad.push(`${f}: ${m[1]}`)
    }
    expect([...new Set(bad)], `tailwind 디스플레이 단계 사용:\n${[...new Set(bad)].join('\n')}`).toEqual([])
  })

  it('🖼️ 96px 초과는 `select-none` 인 그래픽뿐이다', () => {
    /**
     * 이 예외가 **진짜 글자의 탈출구**가 되면 스케일이 무의미해진다.
     * 그래픽(404 글리프·워터마크 숫자)은 고를 수도 읽을 수도 없게 만들어져 있으므로 그걸 대조한다.
     */
    const bad: string[] = []
    let seen = 0
    for (const f of open) {
      for (const line of read(f).split('\n')) {
        for (const m of line.matchAll(/text-\[([0-9.]+)px\]/g)) {
          if (parseFloat(m[1]) <= GRAPHIC_ABOVE) continue
          seen++
          if (!/select-none/.test(line)) bad.push(`${f}: ${m[1]}px (select-none 없음)`)
        }
      }
    }
    expect(seen, '96px 초과가 하나도 없다 — 이 검사가 헛돌고 있다(있었으면 앵커를 재조준할 것)').toBeGreaterThan(0)
    expect(bad, `글자가 그래픽 예외로 샜다:\n${bad.join('\n')}`).toEqual([])
  })

  it('🖼️ 반응형 사다리에 아무 일도 안 하는 rung 이 없다', () => {
    /**
     * 🩸 코드모드가 만든 결함 클래스(위 머리말). `sm:`/`lg:` 가 앞 rung 과 **같은 값**이면
     * 그 브레이크포인트는 존재하지 않는 것과 같은데 빌드도 화면도 안 깨진다.
     */
    const ORDER = ['', 'sm:', 'md:', 'lg:', 'xl:', '2xl:']
    const bad: string[] = []
    let seen = 0
    for (const f of open) {
      read(f).split('\n').forEach((line, i) => {
        const rungs = [...line.matchAll(/(?:^|[\s"'`{])((?:sm|md|lg|xl|2xl):)?text-\[(\d+)px\]/g)]
          .map((m) => ({ bp: m[1] || '', px: Number(m[2]) }))
          .filter((r) => r.px >= DISPLAY_FROM)
        if (rungs.length < 2) return
        seen++
        rungs.sort((a, b) => ORDER.indexOf(a.bp) - ORDER.indexOf(b.bp))
        if (rungs.some((r, j) => j > 0 && r.px === rungs[j - 1].px)) {
          bad.push(`${f}:${i + 1}  ${rungs.map((r) => `${r.bp || 'base'}=${r.px}`).join(' → ')}`)
        }
      })
    }
    expect(seen, `사다리를 ${seen}개밖에 못 찾았다 — 이 검사가 헛돌고 있다`).toBeGreaterThan(10)
    expect(bad, `같은 값이 이어지는 사다리:\n${bad.join('\n')}`).toEqual([])
  })
})
