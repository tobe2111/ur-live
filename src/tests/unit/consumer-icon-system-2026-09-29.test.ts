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
 * - 잠금표 파일 7개(뜻 27건) — 승인 없이 못 건드려서 래칫 안에 남아 있다.
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

/** 실측 2026-09-29 — 긴 꼬리. **줄이는 건 자유, 늘리는 건 차단.** */
const MEANING_BASELINE = 184

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

  it('🔒 잠금표 파일은 이 이행에서 빠져 있다 — 승인 없이 건드리지 않았다', () => {
    const touched = files.filter((f) => LOCK.has(f) && /urdeal-icons/.test(read(f)))
    // BottomNav 는 2026-09-02 에 대표 승인으로 이미 세트를 쓴다(그 한 건만 정상).
    expect(touched, `승인 없이 잠금 파일에 세트를 넣었다: ${touched.join(' · ')}`)
      .toEqual(['src/components/main/BottomNav.tsx'])
  })
})
