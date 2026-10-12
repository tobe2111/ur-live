/**
 * 🪒 첫 화면이 안 쓰는 아이콘 214개를 같이 받고 있었다 〔2026-09-16〕
 *
 * 대표: *"남은 후속들 모두 진행 끝까지"* — 부팅 JS 다이어트.
 *
 * ## 무엇이었나 (번들러 모듈→청크 그래프 실측)
 * 트리쉐이킹은 멀쩡했다 — lucide 1,534개 모듈 중 **260개만** 남는다. 문제는 그 260개가
 * `manualChunks` 의 **한 봉투**(`lucide` 64.8KB)라, 어드민·셀러 페이지에서만 쓰는 아이콘까지
 * 소비자 첫 화면이 통째로 받고 있었다는 것이다. 셸 폐쇄가 실제로 닿는 건 **42개**뿐이다.
 *
 * ⚠️ **규칙을 지우면 될 것 같지만 아니다.** 지워 보니 Rollup 이 256개를 통째로 `app-shell` 에
 *    넣어 총량이 그대로였다(695.0 → 694.0KB). **명시 분할만** 효과가 있다(→ 642.2KB).
 *
 * 🩸 그리고 **첫 판이 헛돌았다**: 아이콘 이름을 kebab 으로 바꿔 넣었는데 `AlertCircle`·`Home`·
 *    `CheckCircle2` 는 lucide 에서 **별칭**이고 실제 구현은 `circle-alert`·`house`·`circle-check`
 *    에 있다. 별칭 파일만 넣었더니 구현 파일이 큰 봉투에 남아 셸이 그 봉투를 다시 끌고 왔다
 *    (빌드는 성공하고 총량만 안 줄어든다 — 에러가 안 나는 부류). ⇒ 이 시험은 **별칭 체인을 따라간다.**
 *
 * ## 이 시험이 지키는 것
 * 셸 파일에 새 아이콘을 추가하고 `vite.config.ts` 의 목록에 안 적으면 **조용히** 큰 봉투가
 * 첫 페인트로 돌아온다. 그래서 소스에서 셸 폐쇄를 다시 계산해 목록과 대조한다.
 *
 * ## 못 하는 것
 * - 실제 청크 배치는 빌드가 정한다 — 이 시험은 "목록이 소스와 일치하는가"만 본다.
 *   총량 회귀는 `check-critical-chunks`(청크 이름) + `check-bundle-size`(예산)가 잡는다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { readCode } from '../helpers/source-text'

const ROOT = process.cwd()
const EXTS = ['.tsx', '.ts', '.jsx', '.js']

function resolveSpec(spec: string, from: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec)
  else return null
  for (const e of ['', ...EXTS, ...EXTS.map((x) => '/index' + x)]) {
    const c = base + e
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  }
  return null
}

/**
 * 진입점에서 **정적** import 만 따라간 폐쇄. 동적 import 는 다른 청크라 일부러 제외한다.
 * 기본값은 셸(`src/main.tsx`) — 2026-10-12 에 홈 폐쇄도 재려고 인자를 받게 넓혔다.
 */
function staticClosure(entries: string[] = ['src/main.tsx']): string[] {
  const seen = new Set<string>()
  const walk = (f: string) => {
    if (seen.has(f)) return
    seen.add(f)
    let src: string
    try { src = fs.readFileSync(f, 'utf8') } catch { return }
    const re = /(?:^|\n)\s*(?:import|export)\s[\s\S]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const r = resolveSpec(m[1] || m[2], f)
      if (r) walk(r)
    }
  }
  for (const e of entries) walk(path.join(ROOT, e))
  return [...seen]
}

function kebab(name: string): string {
  return name.replace(/(?<=[a-z0-9])(?=[A-Z])/g, '-').replace(/(?<=[A-Za-z])(?=[0-9])/g, '-').toLowerCase()
}

/** 별칭(`export { default } from './circle-alert.js'`)을 따라가 **실제 구현 파일까지** 모은다. */
function withAliases(icon: string, out = new Set<string>(), depth = 0): Set<string> {
  if (out.has(icon) || depth > 5) return out
  const p = path.join(ROOT, 'node_modules/lucide-react/dist/esm/icons', icon + '.js')
  if (!fs.existsSync(p)) return out
  out.add(icon)
  const t = fs.readFileSync(p, 'utf8')
  for (const m of t.matchAll(/from\s*'\.\/([a-z0-9-]+)\.js'/g)) withAliases(m[1], out, depth + 1)
  return out
}

function iconFilesIn(files: string[]): Set<string> {
  const out = new Set<string>()
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8')
    for (const m of t.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
      for (const raw of m[1].split(',')) {
        const name = raw.trim().split(' as ')[0].replace(/^type\s+/, '').trim()
        if (!name || name === 'LucideIcon') continue
        for (const f2 of withAliases(kebab(name))) out.add(f2)
      }
    }
  }
  return out
}
const shellIconFiles = () => iconFilesIn(staticClosure())

/** 🏠 홈 첫 화면 진입점 둘(모바일·PC). `HomeRoute` 가 둘을 lazy 로 가르므로 **둘 다** 센다. */
const HOME_ENTRIES = ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']
/** 홈이 쓰는 아이콘 중 **셸 밖** 것 — 이게 곧 `lucide-home` 봉투에 들어가야 할 목록이다. */
function homeOnlyIconFiles(): Set<string> {
  const shell = shellIconFiles()
  return new Set([...iconFilesIn(staticClosure(HOME_ENTRIES))].filter((i) => !shell.has(i)))
}

function listedIn(name: 'LUCIDE_SHELL_ICONS' | 'LUCIDE_HOME_ICONS'): string[] {
  const cfg = readCode('vite.config.ts')
  const m = cfg.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`))
  expect(m, `vite.config.ts 의 ${name} 을 못 찾았다 — 이 시험이 낡았다`).toBeTruthy()
  return [...m![1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1])
}
const listedIcons = () => listedIn('LUCIDE_SHELL_ICONS')

describe('① 목록이 소스와 일치한다', () => {
  it('🔴 셸이 쓰는 아이콘이 **전부** vite 목록에 있다 (빠지면 조용히 큰 봉투가 첫 페인트로 돌아온다)', () => {
    const listed = new Set(listedIcons())
    const missing = [...shellIconFiles()].filter((i) => !listed.has(i)).sort()
    expect(missing, `vite.config.ts 의 LUCIDE_SHELL_ICONS 에 추가할 것: ${JSON.stringify(missing)}`).toEqual([])
  })

  it('목록에 셸이 안 쓰는 아이콘이 없다 (있으면 첫 화면이 그만큼 더 받는다)', () => {
    const need = shellIconFiles()
    const extra = listedIcons().filter((i) => !need.has(i)).sort()
    expect(extra, `셸이 더는 안 쓴다 — 목록에서 뺄 것: ${JSON.stringify(extra)}`).toEqual([])
  })

  it('🔴 별칭 체인을 실제로 따라간다 (HelpCircle → circle-help)', () => {
    // 이 한 줄이 첫 판을 헛돌게 했다 — 별칭만 넣으면 구현 파일이 큰 봉투에 남는다.
    expect([...withAliases('help-circle')].sort()).toEqual(['circle-help', 'help-circle'])
    /**
     * 🔧 2026-09-29 재조준: 표본을 `circle-alert`·`house`·`circle-check` 로 **손으로 박아** 뒀는데
     *    그 셋은 UI④ 아이콘 이행으로 셸에서 사라졌다(뜻 아이콘 SSOT `urdeal-icons.tsx` 로 옮김).
     *    지키려던 것은 그대로다 — **목록에 별칭이 있으면 그 구현 파일도 목록에 있어야 한다**.
     *    표본 세 개 대신 **전수**로 고정해, 셸이 쓰는 아이콘이 바뀌어도 앵커가 안 낡는다.
     */
    const listed = new Set(listedIcons())
    const chains = [...listed].filter((i) => withAliases(i).size > 1)
    expect(chains.length, '별칭을 가진 아이콘이 목록에 하나도 없다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    for (const i of chains) for (const real of withAliases(i)) expect(listed.has(real), `${i} → ${real}`).toBe(true)
  })
})

describe('② 규칙이 실제로 배선돼 있다', () => {
  const cfg = readCode('vite.config.ts')

  // 🔁 2026-10-12 재조준: 봉투가 **셋**이 됐다(`lucide-shell` · `lucide-home` · `lucide`).
  //   지키려던 것은 그대로 — *아이콘 파일명으로 가른다* · *코어는 셸 쪽에 남는다*.
  it('🔴 아이콘 파일명으로 세 봉투를 가른다', () => {
    expect(cfg).toContain("if (!icon || LUCIDE_SHELL_ICONS.has(icon[1])) return 'lucide-shell'")
    expect(cfg).toContain("return LUCIDE_HOME_ICONS.has(icon[1]) ? 'lucide-home' : 'lucide'")
  })

  it('아이콘이 아닌 코어(Icon/createLucideIcon/배럴)는 셸 쪽에 남는다', () => {
    // 코어가 큰 봉투로 가면 셸이 그 봉투를 import 해 분할이 무의미해진다.
    expect(cfg).toContain('!icon ||')
  })

  it('🔴 `auth/` 버킷이 `RouteGuards` 로 좁혀져 있다 (폴더 통째면 셀러 전용 2개가 첫 페인트로 온다)', () => {
    // `KakaoLinkButton`·`SellerPinPrompt` 는 셀러 프로필 편집 페이지 **하나만** 쓴다.
    // 폴더 규칙이면 `RouteGuards`(셸) 때문에 같은 봉투로 첫 페인트에 실려 온다(13.7KB + 아이콘 6개).
    expect(cfg).toContain("id.includes('/src/components/auth/RouteGuards')")
    expect(cfg).not.toContain("id.includes('/src/components/auth/')")
  })

  it('폐쇄 계산이 비어 있지 않다 (0개면 통과가 아니라 시험이 고장난 것)', () => {
    expect(staticClosure().length).toBeGreaterThan(60)
    // 🪒 2026-09-29: 하한 30 → 15. 실측 42 → **26** — UI④ 아이콘 이행으로 셸이 lucide 뜻 아이콘을
    //    17개 덜 쓴다(줄어든 것이 성과라 이 하한은 그 성과를 따라 내려간다). 이 하한의 일은
    //    "몇 개여야 한다"가 아니라 **폐쇄 계산이 통째로 비면 초록이 뜨는 것**을 막는 것이다.
    expect(shellIconFiles().size).toBeGreaterThan(15)
  })
})

/**
 * 🏠 **세 번째 봉투 — 홈이 11개 때문에 214개를 받고 있었다** 〔2026-10-12〕
 *
 * 대표: *"각 페이지마다도 로딩속도 개선이 필요해 … 빠른게 좋은거지"*.
 *
 * ## 실측 (빌드 산출물을 뜯어서)
 * 2026-09-16 이 셸을 떼어 냈지만 **나머지는 여전히 한 봉투**였다. 그 봉투(`lucide` 54.2KB raw)에
 * 아이콘이 **214개** 들어 있는데, 홈 정적 폐쇄가 실제로 import 하는 것은 **11개**다
 * (`app-home`·`GroupBuyFeed`·`PcHomePage` 의 import 문을 번들에서 역추적해 셌다).
 * ⇒ 홈 폐쇄 **698.0 → 647.5 KB raw(−50.5KB)**, 청크 수 21 불변(`lucide-home` 3.4KB 가 대신 들어온다).
 *
 * ## 이 시험이 지키는 것
 * 홈 파일에 새 아이콘을 쓰고 목록에 안 적으면 **조용히** 214개 봉투가 첫 페인트로 돌아온다
 * (빌드는 성공하고 총량만 는다 — 에러가 안 나는 부류).
 *
 * ## 못 하는 것
 * 실제 청크 배치는 빌드가 정한다. 총량 회귀는 `check-critical-chunks`·`check-bundle-size` 가 본다.
 */
describe('③ 홈 봉투(lucide-home)가 소스와 일치한다', () => {
  it('🔴 홈이 쓰는 비-셸 아이콘이 **전부** LUCIDE_HOME_ICONS 에 있다', () => {
    const listed = new Set(listedIn('LUCIDE_HOME_ICONS'))
    const missing = [...homeOnlyIconFiles()].filter((i) => !listed.has(i)).sort()
    expect(missing, `vite.config.ts 의 LUCIDE_HOME_ICONS 에 추가할 것: ${JSON.stringify(missing)}`).toEqual([])
  })

  it('목록에 홈이 안 쓰는 아이콘이 없다 (있으면 홈이 그만큼 더 받는다)', () => {
    const need = homeOnlyIconFiles()
    const extra = listedIn('LUCIDE_HOME_ICONS').filter((i) => !need.has(i)).sort()
    expect(extra, `홈이 더는 안 쓴다 — 목록에서 뺄 것: ${JSON.stringify(extra)}`).toEqual([])
  })

  it('🔴 별칭 체인이 닫혀 있다 (Loader2 → loader-circle — 2026-09-16 에 실제로 밟은 함정)', () => {
    const listed = new Set(listedIn('LUCIDE_HOME_ICONS'))
    const chains = [...listed].filter((i) => withAliases(i).size > 1)
    expect(chains.length, '별칭을 가진 아이콘이 홈 목록에 하나도 없다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    for (const i of chains) for (const real of withAliases(i)) expect(listed.has(real), `${i} → ${real}`).toBe(true)
  })

  it('셸 목록과 겹치지 않는다 (겹치면 어느 봉투인지 규칙이 말해 주지 않는다)', () => {
    const shell = new Set(listedIn('LUCIDE_SHELL_ICONS'))
    const dup = listedIn('LUCIDE_HOME_ICONS').filter((i) => shell.has(i))
    expect(dup, `두 목록에 동시에 있다: ${JSON.stringify(dup)}`).toEqual([])
  })

  it('폐쇄 계산이 비어 있지 않다 (0개면 통과가 아니라 시험이 고장난 것)', () => {
    expect(staticClosure(HOME_ENTRIES).length, '홈 폐쇄가 비었다').toBeGreaterThan(60)
    expect(homeOnlyIconFiles().size, '홈 전용 아이콘이 0개로 읽힌다').toBeGreaterThan(3)
  })
})
