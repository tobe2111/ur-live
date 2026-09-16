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

/** `src/main.tsx` 에서 **정적** import 만 따라간 폐쇄. 동적 import 는 다른 청크라 일부러 제외한다. */
function staticClosure(): string[] {
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
  walk(path.join(ROOT, 'src/main.tsx'))
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

function shellIconFiles(): Set<string> {
  const out = new Set<string>()
  for (const f of staticClosure()) {
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

function listedIcons(): string[] {
  const cfg = readCode('vite.config.ts')
  const m = cfg.match(/const LUCIDE_SHELL_ICONS = new Set\(\[([\s\S]*?)\]\)/)
  expect(m, 'vite.config.ts 의 LUCIDE_SHELL_ICONS 를 못 찾았다 — 이 시험이 낡았다').toBeTruthy()
  return [...m![1].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1])
}

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

  it('🔴 별칭 체인을 실제로 따라간다 (AlertCircle → circle-alert)', () => {
    // 이 한 줄이 첫 판을 헛돌게 했다 — 별칭만 넣으면 구현 파일이 큰 봉투에 남는다.
    expect([...withAliases('alert-circle')].sort()).toEqual(['alert-circle', 'circle-alert'])
    const listed = new Set(listedIcons())
    for (const real of ['circle-alert', 'house', 'circle-check']) expect(listed.has(real), real).toBe(true)
  })
})

describe('② 규칙이 실제로 배선돼 있다', () => {
  const cfg = readCode('vite.config.ts')

  it('🔴 아이콘 파일명으로 두 봉투를 가른다', () => {
    expect(cfg).toContain("LUCIDE_SHELL_ICONS.has(icon[1]) ? 'lucide-shell' : 'lucide'")
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
    expect(shellIconFiles().size).toBeGreaterThan(30)
  })
})
