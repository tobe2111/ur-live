/**
 * 🧱 CI 러너 이미지를 고정한다 — `ubuntu-latest` 는 커밋 없이 바뀐다 (2026-10-18)
 *
 * GitHub 이 2026-10-19 부터 `ubuntu-latest` 를 **Ubuntu 26.04** 로 옮긴다(Actions 주석이 직접 알렸다).
 * 설치된 Playwright(1.58.2)는 그 OS 를 모른다 — 코드 경로로 확인했다:
 *
 *   hostPlatform.js   major >= 26 → hostPlatform = "ubuntu26.04-x64"
 *   registry/index.js DOWNLOAD_PATHS.chromium["ubuntu26.04-x64"] → 없음
 *                     DOWNLOAD_PATHS.chromium["<unknown>"]       → void 0
 *                     → throw "ERROR: Playwright does not support chromium on ubuntu26.04-x64"
 *
 * 그 `npx playwright install --with-deps chromium` 이 **`verify.yml` 안에 있다** — main 머지의 유일한
 * 필수 체크다. 게다가 GitHub 은 이런 이전을 **점진적으로** 굴리므로 26 에 떨어진 잡만 터진다 ⇒ 같은
 * 커밋이 어떤 날은 초록, 어떤 날은 빨강인 *"플레이크"* 로 보인다. 이 레포가 가장 오래 헤맨 그 모양이다.
 *
 * ⇒ 처방은 라벨을 **오늘 실제로 도는 이미지(24.04)로 못 박는 것**이다. 동작은 오늘과 같고, 바뀌는 날은
 *   이 파일을 고치는 커밋이 생기는 날뿐이다(조용히 바뀌지 않는다).
 *
 * 🔑 지키는 불변식은 *"`ubuntu-latest` 금지"* 가 아니라 **"브라우저를 까는 워크플로가 쓰는 이미지는
 *   설치된 Playwright 가 Chromium 을 내려받을 수 있는 이미지여야 한다"** 다. 그래서 26.04 로 올리는 날
 *   Playwright 가 아직 그 OS 를 모르면 **이 시험이 먼저** 빨간불을 낸다(Verify 가 아니라).
 *
 * ⚠️ 못 보는 것: GitHub 이 24.04 이미지를 퇴역시키는 날(공지가 온다 — 그때 이 시험의 라벨 목록을 고친다) ·
 *   `macos-*` · 브라우저 말고 다른 OS 의존(apt 패키지 이름 변경 등 — 24.04 고정으로 함께 막힌다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const WF = '.github/workflows'
const files = readdirSync(WF).filter(f => /\.ya?ml$/.test(f))
const read = (f: string) => readFileSync(join(WF, f), 'utf8')
// `#` 로 시작하는 주석 줄은 뺀다 — 이 설명을 인용하는 주석이 판정을 흔들지 않게.
const code = (f: string) => read(f).split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
const runsOn = (src: string) => [...src.matchAll(/^\s*runs-on:\s*(\S+)/gm)].map(m => m[1])
const installsBrowser = (src: string) => /playwright\s+install|install-deps|chromium/.test(src)

/**
 * 설치된 Playwright 가 Chromium 을 내려받을 수 있는 hostPlatform 키 — **실제 코드 표에서** 읽는다.
 * `install chromium` 은 `chromium` 과 `chromium-headless-shell` 을 **둘 다** 받으므로 교집합이다.
 * 🩸 첫 판은 파일의 첫 `"chromium": {` 을 잡았는데 그건 **실행 파일 경로 표**(다운로드 표가 아니다)라
 *    지원 목록이 0 이 됐다 — 바로 아래 *"비었으면 고장"* 단언이 잡았다. 그래서 `DOWNLOAD_PATHS` 에서부터 찾는다.
 */
function chromiumPlatforms(): Set<string> {
  const src = readFileSync('node_modules/playwright-core/lib/server/registry/index.js', 'utf8')
  const table = src.indexOf('const DOWNLOAD_PATHS = {')
  expect(table, 'playwright-core 의 DOWNLOAD_PATHS 를 못 찾았다(레이아웃이 바뀌었다)').toBeGreaterThan(-1)
  const keysOf = (name: string) => {
    const start = src.indexOf(`"${name}": {`, table)
    expect(start, `DOWNLOAD_PATHS.${name} 블록을 못 찾았다`).toBeGreaterThan(table)
    const block = src.slice(start, src.indexOf('\n  },', start))
    const out = new Set<string>()
    for (const m of block.matchAll(/"(ubuntu[\d.]+-x64)":\s*([^,\n]+)/g)) if (!/void 0/.test(m[2])) out.add(m[1])
    return out
  }
  const full = keysOf('chromium')
  const shell = keysOf('chromium-headless-shell')
  return new Set([...full].filter(k => shell.has(k)))
}

describe('CI 러너 이미지 고정', () => {
  it('워크플로를 실제로 읽었다(0 개면 통과가 아니라 고장)', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files.flatMap(f => runsOn(code(f))).length).toBeGreaterThan(20)
  })

  it('떠다니는 라벨(*-latest)을 쓰는 잡이 없다 — 이미지가 커밋 없이 바뀐다', () => {
    const floating = files.flatMap(f => runsOn(code(f)).filter(l => /-latest$/.test(l)).map(l => `${f}: ${l}`))
    expect(floating, '`ubuntu-24.04` 처럼 버전을 박는다').toEqual([])
  })

  it('브라우저를 까는 워크플로의 이미지 = 설치된 Playwright 가 Chromium 을 받을 수 있는 이미지', () => {
    const supported = chromiumPlatforms()
    expect(supported.size, '지원 목록이 비었다 — 표 파싱이 깨졌다').toBeGreaterThan(0)
    const browserWf = files.filter(f => installsBrowser(code(f)))
    expect(browserWf.length, '브라우저 워크플로를 하나도 못 찾았다(판정이 헛돈다)').toBeGreaterThan(5)
    expect(browserWf, '필수 체크가 여기 있다').toContain('verify.yml')
    const bad: string[] = []
    for (const f of browserWf) for (const label of runsOn(code(f))) {
      const m = /^ubuntu-(\d+\.\d+)$/.exec(label)
      if (!m) { bad.push(`${f}: ${label} (ubuntu-버전 이 아님)`); continue }
      if (!supported.has(`ubuntu${m[1]}-x64`)) bad.push(`${f}: ${label} — Playwright 가 ubuntu${m[1]}-x64 Chromium 을 모른다`)
    }
    expect(bad).toEqual([])
  })

  it('필수 체크(verify.yml)가 실제로 브라우저를 깐다 — 이 판정의 전제', () => {
    expect(code('verify.yml')).toMatch(/npx playwright install --with-deps chromium/)
  })
})
