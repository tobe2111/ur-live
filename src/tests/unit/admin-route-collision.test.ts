import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

/**
 * 🔴 어드민 API 경로 충돌 — 조용히 죽는 화면 (2026-07-29 실행 증거 감사에서 발견)
 *
 * 실제 사고: `GET /api/admin/ops-status` 가 두 곳에 등록돼 있었다.
 *   - `worker/routes/internal-admin-tools.routes.ts` — 절대경로 등록, `app.route('/', ...)` 마운트(먼저)
 *   - `features/admin/api/admin-system-monitoring.routes.ts` — 상대경로, `app.route('/api/admin', adminApp)`(나중)
 *
 *   Hono 는 먼저 등록된 쪽이 이긴다 → 화면(`OpsStatusTab`)이 기대하는 `{ gates, cron_health, heartbeats }`
 *   대신 엉뚱한 응답이 갔다. 게다가 그 응답도 `success: true` 라 클라의 EMPTY 폴백조차 안 타고
 *   그대로 흘러들어가 `gates.filter(...)` 에서 TypeError — **게이트 현황판이 열리지 않았다.**
 *   `STAGING_CHECKLIST.md` 가 "어떤 게이트가 켜져 있는지 보는 곳"으로 지목한 바로 그 화면이고,
 *   12개 항목이 전부 미검증인 것과 무관하지 않다. 빌드도 CI 도 아무 말을 하지 않았다.
 *
 * ⚠️ 이 검사가 **못 잡는 것**(과신 금지):
 *   - adminApp 내부 라우터끼리의 충돌. 마운트 프리픽스를 정적으로 다 풀지 않는다.
 *   - 파라미터 라우트가 리터럴을 가리는 그림자(`/:id` 가 `/pending` 선점). 문자열 비교로는 판정 불가.
 *   - 런타임 미들웨어 차이(인증 강도 등). 경로만 본다.
 *   ⇒ 여기서 잡는 것은 **"절대경로로 등록된 어드민 라우트"와 "adminApp 아래 같은 경로"의 정면 충돌** 하나다.
 *     그게 실제로 난 사고이고, 재발하면 같은 방식으로 조용하다.
 */

/** `app.route('/', X)` 로 마운트돼 절대경로를 직접 등록하는 라우트 파일들. */
const ABSOLUTE_MOUNT_FILES = ['src/worker/routes/internal-admin-tools.routes.ts']

/** adminApp 에 `adminApp.route('/', X)` 로 붙어 `/api/admin/*` 가 되는 파일들이 있는 디렉터리. */
const ADMIN_FEATURE_DIR = 'src/features/admin/api'

const METHOD = String.raw`\.(get|post|put|patch|delete)\(`

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8')
}

/** 절대경로로 등록된 `/api/admin/...` 라우트 → Set<"GET /api/admin/x"> */
function absoluteAdminRoutes(src: string): Set<string> {
  const out = new Set<string>()
  const re = new RegExp(METHOD + String.raw`\s*'(/api/admin/[^']*)'`, 'g')
  for (const m of src.matchAll(re)) out.add(`${m[1].toUpperCase()} ${m[2]}`)
  return out
}

/**
 * adminApp 에 **루트(`'/'`)로** 마운트되는 라우터 파일의 상대경로 등록 → `/api/admin` + path.
 * `adminApp.route('/tools', ...)` 처럼 프리픽스가 붙는 라우터는 대상에서 제외한다
 * (그 경로는 `/api/admin/tools/...` 가 되어 충돌하지 않는다 — 이걸 안 세면 오탐이 난다).
 */
function rootMountedAdminRouters(indexSrc: string): string[] {
  const rootMounted = new Set<string>()
  for (const m of indexSrc.matchAll(/adminApp\.route\(\s*'\/'\s*,\s*(\w+)\s*\)/g)) rootMounted.add(m[1])

  const files: string[] = []
  const dir = resolve(process.cwd(), ADMIN_FEATURE_DIR)
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (!statSync(p).isFile() || !f.endsWith('.ts')) continue
    const src = readFileSync(p, 'utf8')
    // 이 파일이 export 하는 라우터 이름 중 하나라도 루트 마운트 대상이면 포함
    const exported = [...src.matchAll(/export const (\w+)\s*=\s*new Hono/g)].map(x => x[1])
    if (exported.some(name => rootMounted.has(name))) files.push(`${ADMIN_FEATURE_DIR}/${f}`)
  }
  return files
}

function relativeAdminRoutes(src: string): Set<string> {
  const out = new Set<string>()
  const re = new RegExp(String.raw`\w+` + METHOD + String.raw`\s*'(/[^']*)'`, 'g')
  for (const m of src.matchAll(re)) {
    if (m[2].startsWith('/api/')) continue // 절대경로 등록은 여기 대상이 아님
    out.add(`${m[1].toUpperCase()} /api/admin${m[2]}`)
  }
  return out
}

describe('어드민 API 경로 충돌 — 앞선 마운트가 뒤를 조용히 가린다', () => {
  const indexSrc = read('src/worker/index.ts')

  const absolute = new Set<string>()
  for (const f of ABSOLUTE_MOUNT_FILES) for (const r of absoluteAdminRoutes(read(f))) absolute.add(r)

  const rootFiles = rootMountedAdminRouters(indexSrc)
  const relative = new Set<string>()
  for (const f of rootFiles) for (const r of relativeAdminRoutes(read(f))) relative.add(r)

  it('🛡️ 측정 대상이 0 이면 통과가 아니라 실패 — 파일 이동/리네임으로 검사가 헛도는 것을 막는다', () => {
    expect(rootFiles.length, 'adminApp 에 루트 마운트되는 어드민 라우터를 하나도 못 찾았다').toBeGreaterThan(0)
    expect(absolute.size, '절대경로 어드민 라우트를 하나도 못 찾았다').toBeGreaterThan(0)
    expect(relative.size, 'adminApp 상대경로 라우트를 하나도 못 찾았다').toBeGreaterThan(10)
  })

  it('절대경로 등록과 adminApp 등록이 같은 경로를 두고 겹치지 않는다', () => {
    const collisions = [...absolute].filter(r => relative.has(r))
    expect(
      collisions,
      `같은 경로가 두 곳에 등록됐다. 먼저 마운트된 쪽만 응답하고 나머지는 조용히 죽는다:\n` +
        collisions.map(c => `  - ${c}`).join('\n'),
    ).toEqual([])
  })

  it('게이트 현황판 경로는 adminApp(게이트 응답) 쪽에만 있다', () => {
    // 이 화면이 실제로 깨졌던 자리다. 경로가 절대경로 쪽으로 되돌아오면 같은 사고가 재발한다.
    expect(absolute.has('GET /api/admin/ops-status')).toBe(false)
    expect(relative.has('GET /api/admin/ops-status')).toBe(true)
  })
})
