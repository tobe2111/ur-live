import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

/**
 * 🎨 **뜻은 우리가 그리고, 조작은 lucide 그대로** — 소비자 전 화면 (2026-09-29, 대표 UI 네 트랙 중 ④)
 *
 * ## 무엇이 문제였나 (실측)
 * 2026-09-28 에 **마이 한 화면만** 유어딜 아이콘으로 옮기고 가드를 걸었다(`my-icon-system`).
 * 그 가드의 머리말은 스스로 *"마이 밖 화면(홈·상세·유어샵). 범위를 넓히려면 SURFACES 에 폴더를 더한다"* 고
 * 적어 뒀는데, 09-29 에 재 보니 소비자 전체는 이랬다:
 *
 * ```
 * lucide 136종 853건  →  조작 27종 371건 (그대로 두는 게 맞다)
 *                        뜻   109종 482건 (우리 물건의 이름인데 남의 세트)
 * ```
 *
 * 즉 탭 다섯과 마이만 우리 것이고 **나머지 화면은 통째로 lucide** 였다. 획이 2.0 과 1.6 으로 갈리는데
 * 같은 줄에 나란히 서니 그 차이가 그대로 보인다 — 개별 결함이 아니라 *"덜 만든 화면"* 의 인상 그 자체다.
 *
 * ## 이번에 한 일
 * 1:1 로 뜻이 맞는 27개 이름을 세트로 옮겼다(신규 10종 — Clock·Store·Bag·Wallet·Ok·Alert·Warn·Bad·Info·Truck).
 * **482 → 184 건.** 남은 184 는 한두 번씩만 쓰이는 긴 꼬리(93종)라 그리는 값이 아직 안 나온다 ⇒ **래칫**으로 동결.
 *
 * ## 🩸 코드모드가 만든 결함 둘 — 그림만 바꾸면 안 되는 이유
 * - **`strokeWidth={…}` 58곳.** lucide 기본이 2 라 호출부가 1.5~3 으로 제각기 손보고 있었다.
 *   그대로 두면 세트를 바꾸고도 획이 **10가지**로 남는다(우리 세트의 정체성은 1.6 **하나**다).
 * - **`fill` 12곳.** lucide 는 `<svg fill>`·`fill-*` 클래스가 path 까지 먹지만 우리 아이콘은
 *   path 에 `fill="none"` 을 박아 두므로 **안 채워진다** — 찜한 하트·별점이 속 빈 채로 뜬다.
 *   ⇒ `filled` prop 으로 옮겼고, **조건부였던 4곳**(별점 picker·찜·관심)은 `filled={조건}` 로.
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * - **그림이 좋은지.** 이름만 본다. 그건 그려서 봐야 한다(이번엔 42종 시트를 실제로 렌더해 확인했다).
 * - **자리가 맞는지** — `TruckIcon` 을 결제 버튼에 달아도 통과한다.
 * - 인라인 `<svg>` 를 손으로 그린 것. 세트 밖이라 이름으로 안 잡힌다.
 * - **코드모드가 실제로 무엇을 건드렸는지**. 잠금표 파일은 2026-09-30 대표 승인으로 이행됐고
 *   (아래 `--locked` 게이트 시험), 잠긴 *계약* 자체는 각 잠금 가드와 핸드오프 grep 카운트가 본다.
 */

const LOCK = new Set(
  [...readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]),
)

const files = execSync(
  // 🕳️ git pathspec 의 `**` 는 디렉터리를 최소 하나 요구한다 — 최상위 glob 을 빼면 734개가 조용히 샌다.
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))

/** **조작** — 어느 앱에서나 같은 모양이라 직접 그릴 값이 없다. 뜻을 가진 이름을 여기 더하지 말 것. */
const OPERATION = new Set([
  'ChevronRight', 'ChevronDown', 'ChevronLeft', 'ChevronUp', 'ChevronsUpDown',
  'X', 'Search', 'Check', 'Plus', 'Minus', 'ExternalLink', 'Loader2',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowUpRight', 'ArrowDownRight',
  'Copy', 'Upload', 'Download', 'Trash2', 'Trash', 'Edit', 'Edit2', 'Edit3', 'Pencil',
  'SlidersHorizontal', 'Filter', 'MoreVertical', 'MoreHorizontal', 'Menu',
  'Eye', 'EyeOff', 'RefreshCw', 'RotateCw', 'Play', 'Pause', 'Volume2', 'VolumeX',
  'Maximize2', 'Minimize2', 'LucideIcon',
])

/**
 * 실측 — 긴 꼬리. **줄이는 건 자유, 늘리는 건 차단.**
 *
 * 🔧 2026-09-30: 184 → **172**. 대표 승인으로 잠금표 12파일을 `--locked` 로 이행하면서 12건이 줄었는데
 *    **기준을 안 조였다** — 그러면 래칫에 여유 12칸이 생겨 되돌아오는 12건을 조용히 통과시킨다.
 *    실제로 주입(`뜻 아이콘이 한 건 되돌아온다`)이 통과해 CI 가 잡았다(head e5784cd).
 *    ⇒ **개선했으면 같은 커밋에서 기준을 내린다.** 안 내리면 그만큼이 조용한 탈출구로 남는다.
 * 🔧 2026-10-06: 172 → **171**. '참여 완료!' 모달(거짓 보상 약속) 삭제로 `PartyPopper` 1건이 빠졌다 — 같은 규칙대로 기준을 같이 내린다.
 *    (안 내렸더니 CI 주입 `뜻 아이콘이 한 건 되돌아온다` 가 통과해 빨간불이 됐다 — 이 장치가 정확히 일했다.)
 * 🔧 2026-10-07: 171 → **170**. 가입 환영 시트의 반짝이(`Sparkles`) 원을 유달이로 바꾸며 1건이 빠졌다 — 같은 규칙대로 기준을 같이 내린다.
 * 🔧 2026-10-07: 170 → **169**. 홈 피드 빈 화면의 돋보기(`SearchX`) 원을 유달이로 바꾸며 1건이 빠졌다.
 * 🔧 2026-10-07: 169 → **167**. 지갑 A안(#1654)이 칩 줄의 지도(`Map`)와 카드 띠의 QR(`QrCode`)을 걷으며 2건이 빠졌는데
 *    그 PR 에서 기준을 안 내려 main 전수 주입이 빨간불이 됐다 — 같은 규칙대로 지금 내린다.
 * 🔧 2026-10-08: 167 → **166**. 이용권 인증 화면(`/v/:code`) 시안 구현이 입력칸 아래 `QrCode` 를 걷었다.
 * 🔧 2026-10-10: 166 → **165**. 유달이 6곳(#1674)이 `MyReviewsPage` 의 빈 화면 `MessageSquare` 를 유달이로
 *    바꾸며 1건이 빠졌는데 **그 PR 에서 기준을 안 내려 main 전수 주입이 빨간불이 됐다**(head c6eab439,
 *    run 38001434136). 여유가 정확히 1칸이라 주입의 +1 이 `166 ≤ 166` 으로 통과했다 — 같은 규칙대로 지금 내린다.
 *    🧭 이 자리에서 **다섯 번째**다. 유달이로 lucide 를 걷는 PR 은 기준 내리기를 같은 커밋에 넣을 것.
 */
const MEANING_BASELINE = 165

const read = (f: string) => readFileSync(f, 'utf8')

function meaningUses(src: string): number {
  let n = 0
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'lucide-react'/g))
    for (const raw of m[1].split(',')) {
      const x = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (!x || OPERATION.has(x)) continue
      n += (src.match(new RegExp(`<${x}\\b`, 'g')) || []).length
    }
  return n
}

describe('소비자 아이콘 — 뜻은 유어딜 세트', () => {
  it('🎨 lucide 뜻 아이콘이 늘지 않는다 (래칫)', () => {
    expect(files.length, '소비자 파일이 너무 적다 — 경로가 낡았다(실측 403)').toBeGreaterThan(350)
    const total = files.reduce((s, f) => s + meaningUses(read(f)), 0)
    // 0 이면 이 검사가 헛도는 것이다(전부 옮겼다면 그건 그거대로 좋지만, 그때는 기준을 0 으로 내려야 한다).
    expect(total, `lucide 뜻 아이콘 ${total}건 (기준 ${MEANING_BASELINE}). 새로 늘렸다면 유어딜 세트로 그릴 것.`)
      .toBeLessThanOrEqual(MEANING_BASELINE)
  })

  it('🎨 조작 목록에 **이미 그린 것**의 lucide 이름이 없다 (면제 구멍 차단)', () => {
    // 🩸 래칫은 스스로 헐거워지는 걸 못 막는다 — 기준을 올리거나 OPERATION 에 이름을 더하면
    //    조용히 통과한다. 그래서 *뜻이 있는 이름인가* 를 코드모드의 대응표에서 직접 확인한다:
    //    우리가 **이미 그려 둔** 것의 lucide 이름이 "조작" 일 수는 없다.
    const codemod = readFileSync('scripts/codemods/adopt-urdeal-icons.mjs', 'utf8')
    const block = codemod.slice(codemod.indexOf('const MAP = {'), codemod.indexOf('}', codemod.indexOf('const MAP = {')))
    const drawn = [...block.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => m[1])
    expect(drawn.length, '대응표를 못 읽었다 — 이 검사가 헛돌고 있다').toBeGreaterThan(20)
    const leaked = drawn.filter((n) => OPERATION.has(n))
    expect(leaked, `조작 목록에 뜻 아이콘이 섞였다: ${leaked.join(' · ')}`).toEqual([])
  })

  it('🎨 유어딜 세트를 실제로 쓴다 — 바꿔 놓고 되돌아가지 않았는가', () => {
    let ur = 0
    for (const f of files) ur += (read(f).match(/from '@\/components\/icons\/urdeal-icons'/g) || []).length
    // 실측 2026-09-29: 145파일. 크게 줄면 lucide 로 되돌아간 것이다.
    expect(ur, `유어딜 세트를 import 한 파일 ${ur}개`).toBeGreaterThanOrEqual(120)
  })

  it('🎨 세트의 획(1.6)을 호출부가 덮어쓰지 않는다 — 정체성은 한 값이다', () => {
    const UR = new Set([...readFileSync('src/components/icons/urdeal-icons.tsx', 'utf8')
      .matchAll(/export const (\w+) = forwardRef/g)].map((m) => m[1]))
    expect(UR.size, '세트에서 export 를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(30)
    const bad: string[] = []
    let scanned = 0
    for (const f of files) {
      const src = stripComments(read(f))
      const mine = new Set<string>()
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/components\/icons\/urdeal-icons'/g))
        for (const x of m[1].split(',')) { const n = x.trim(); if (UR.has(n)) mine.add(n) }
      for (const n of mine) {
        scanned++
        for (const tag of src.match(new RegExp(`<${n}\\b[^>]*?/?>`, 'g')) ?? [])
          if (/\bstrokeWidth=/.test(tag)) bad.push(`${f.split('/').pop()}: <${n} strokeWidth=…>`)
      }
    }
    expect(scanned, '유어딜 아이콘을 쓰는 자리를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(100)
    expect(bad, `호출부가 획을 따로 박았다: ${[...new Set(bad)].slice(0, 8).join(' · ')}`).toEqual([])
  })

  it('🎨 채우기는 `filled` 로 — `fill` prop 은 path 까지 안 닿는다 (속 빈 하트·별)', () => {
    const UR = new Set([...readFileSync('src/components/icons/urdeal-icons.tsx', 'utf8')
      .matchAll(/export const (\w+) = forwardRef/g)].map((m) => m[1]))
    const bad: string[] = []
    for (const f of files) {
      const src = stripComments(read(f))
      const mine = new Set<string>()
      for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/components\/icons\/urdeal-icons'/g))
        for (const x of m[1].split(',')) { const n = x.trim(); if (UR.has(n)) mine.add(n) }
      for (const n of mine)
        for (const tag of src.match(new RegExp(`<${n}\\b[^>]*?/?>`, 'g')) ?? []) {
          // `fill` 속성은 <svg> 에만 닿는다. `fill-<색>` 클래스도 path 의 fill="none" 을 못 이긴다.
          const hasFillProp = /\sfill=/.test(tag)
          const hasFillClass = /fill-(?!none\b)[a-z]/.test(tag)
          if ((hasFillProp || hasFillClass) && !/\bfilled\b/.test(tag))
            bad.push(`${f.split('/').pop()}: <${n} … fill …>`)
        }
    }
    expect(bad, `채워야 하는데 안 채워진다(filled 누락): ${[...new Set(bad)].slice(0, 8).join(' · ')}`).toEqual([])
  })

  it('🔒 잠금표 파일도 이행됐다 — 2026-09-30 대표 승인', () => {
    /**
     * 🔓 이 자리에는 *"승인 없이 건드리지 않았다"* 며 `BottomNav` 한 건만 허용하는 단언이 있었다.
     * 대표가 승인했다(**"다 순서대로 이상적으로 해줘"**) → `--locked` 로 이행했고 CLAUDE.md audit log 에
     * `[UNLOCK]`/`[UNLOCK_LOADING]` 으로 기재했다.
     *
     * 지키는 것이 바뀌었다: *"손대지 않았는가"* 가 아니라 **"이행한 파일이 잠금 계약을 깨지 않았는가"** 다.
     * 계약 자체(결제 호출·SDK 마운트 id·`linkshopPath`·`React.memo`·SSR 시드…)는 각 잠금 가드와
     * 핸드오프의 grep 카운트가 본다 — 여기서는 **세트가 실제로 들어갔는지**만 확인해, 되돌아가면 빨간불이 되게 한다.
     */
    // 🩸 2026-09-30: 여기가 `/urdeal-icons/` **부분일치**였다 — `urdeal-icons-REVERTED` 처럼
    //    경로가 깨져도 통과해서, 이행이 되돌아가는 회귀를 못 잡았다(내가 심은 주입이 잡았다).
    //    ⇒ 모듈 경로 전체를 앵커로 쓴다.
    const IMPORTS_SET = /from '@\/components\/icons\/urdeal-icons'/
    const touched = files.filter((f) => LOCK.has(f) && IMPORTS_SET.test(read(f)))
    expect(touched.length, `잠금표 파일에 세트가 ${touched.length}개밖에 없다 — 이행이 되돌아갔다`)
      .toBeGreaterThanOrEqual(5)
    expect(touched, 'BottomNav 는 2026-09-02 승인분이라 반드시 포함된다').toContain('src/components/main/BottomNav.tsx')
  })

  it('🔓 코드모드는 잠금표를 `--locked` 뒤에 둔다 (기본 실행이 조용히 쓸지 않는다)', () => {
    /**
     * 🎯 2026-09-30 재조준. 이 자리에는 *"잠금 파일에 세트를 밀어 넣는다"* 주입이 걸려 있었는데,
     * 대표 승인으로 잠금표가 이행된 순간 **그 결함이 곧 정답**이 되어 주입이 헛돌았다(CI 가 잡았다).
     * 지우지 않고 그 주입의 `why` 가 실제로 말하던 자리로 옮긴다 —
     * *"코드모드가 잠금 목록을 안 보면 조용히 들어가고, 그러면 잠금 자체가 형해화된다."*
     *
     * 이행이 끝났어도 그 문장은 여전히 유효하다: **다음** 아이콘 이행이 잠금표를 승인 없이
     * 쓸어 가면 안 된다. 그래서 보는 것은 *"손댔는가"* 가 아니라 **게이트가 살아 있는가** 다.
     *
     * ⚠️ 이 시험이 못 보는 것: 누가 `--locked` 를 주고 돌리는 것(그건 승인 절차의 일이고
     *    CLAUDE.md audit log 가 기록한다) · 코드모드를 안 쓰고 손으로 고치는 것.
     */
    const codemod = readFileSync('scripts/codemods/adopt-urdeal-icons.mjs', 'utf8')
    // 잠금 목록은 **손으로 적지 않고** CLAUDE.md 잠금표에서 파생한다 — 손목록은 조용히 낡는다.
    expect(codemod, '잠금 목록을 CLAUDE.md 에서 파생하지 않는다 — 손으로 적은 목록은 낡는다')
      .toMatch(/LOCK\s*=\s*new Set\([\s\S]{0,160}CLAUDE\.md/)
    const gate = stripComments(codemod).split('\n').find((l) => l.includes('--locked') && l.includes('.filter('))
    expect(gate, '`--locked` 게이트가 걸린 `.filter(` 줄이 없다').toBeTruthy()
    expect(gate!, '기본 실행이 잠금표를 빼지 않는다 — 승인 없이 조용히 들어간다')
      .toMatch(/!LOCK\.has\(f\)\s*&&\s*!MIRRORS\.has\(f\)/)
    expect(gate!, '`--locked` 를 줬을 때 잠금표·거울만 돌지 않는다')
      .toMatch(/LOCK\.has\(f\)\s*\|\|\s*MIRRORS\.has\(f\)/)
  })
})
