/**
 * 🏬 **몰 관리 API 는 소비자 번들에 실려 있어야 한다** 〔2026-08-03 — 대표 실측 404〕
 *
 * 사고: `urdeal.kr/admin/wholesale-malls` 에서 파일럿 몰을 만들려는데
 * `POST /api/admin/wholesale-malls` 가 **404**. 원인은 설정도 권한도 아니었다 —
 * 그 라우트가 `if (__INCLUDE_WHOLESALE__)`(mount-wholesale) 안에 있어서
 * **소비자 빌드(`WHOLESALE_BUNDLE` 미설정)에서 esbuild DCE 로 통째로 빠졌다.**
 * 어드민 *화면*은 같은 `dist/client` 라 urdeal.kr 에도 실린다 ⇒ **화면은 있고 API 는 없는** 상태.
 *
 * 이 API 가 지배하는 대상이 도매몰이 아니라는 게 판정의 핵심이다:
 * 몰의 존재 · `consumer_path`(=`urdeal.kr/{슬러그}` 를 열지 말지) · 브랜드 색.
 * `lookupConsumerMall`(worker/utils/mall-consumer.ts)이 **읽는 행을 이 API 가 쓴다.**
 *
 * ## 이 테스트가 실제로 막는 것
 * - R1 소비자 번들에 마운트되어 있다(= 게이트 밖). 되돌리면 404 재발.
 * - R2 게이트 안(mount-wholesale)에 **다시 생기지 않는다** — 중복 마운트 + 원상복귀 방지.
 * - R3 `/api/admin` 마운트보다 **앞**에 등록된다(뒤면 adminApp 이 먼저 먹어 404).
 * - R4 그렇다고 **도매 그래프를 되살리지 않는다** — 이 라우트의 import 폐쇄가 도매 모듈로 안 번진다.
 *
 * ⚠️ **못 막는 것**: 실제 번들에 들어갔는지(esbuild DCE 결과)와 라이브 응답 코드.
 *   그건 배포 후 `curl -X POST https://urdeal.kr/api/admin/wholesale-malls` 가 401/403 을 주는지
 *   (404 가 아니라)로만 판정된다. 여기서 고정하는 것은 **배선**이다.
 *
 * 🔴 `readCode` 를 `worker/index.ts` 에 쓰지 않는다 — 라우트 패턴 `'/*'` 때문에 파일 78% 가
 *   증발한다(source-text.ts 헤더의 실측). **`readRaw` + 줄 앵커 정규식**만 쓴다.
 */
import { describe, it, expect } from 'vitest'
import { readRaw, readCode } from '../helpers/source-text'

const INDEX = 'src/worker/index.ts'
const MOUNT_WS = 'src/worker/mount-wholesale.ts'
const MALL_ADMIN = 'src/features/supply/api/wholesale-malls-admin.routes.ts'

/** 줄 시작 `app.route(...)` 만 — 주석 처리된 줄은 `^` 앵커가 알아서 걸러낸다. */
const routeLines = (src: string): string[] =>
  src.split('\n').filter((l) => /^\s*app\.route\(/.test(l))

describe('🔴 R1 — 몰 관리 API 가 소비자 번들에 마운트돼 있다', () => {
  const src = readRaw(INDEX)

  it('worker/index.ts 가 /api/admin/wholesale-malls 를 마운트한다', () => {
    const mounts = routeLines(src).filter((l) => l.includes("'/api/admin/wholesale-malls'"))
    expect(mounts.length).toBe(1)
  })

  it('마운트가 `if (__INCLUDE_WHOLESALE__)` 블록 **밖**이다', () => {
    // 게이트 블록은 `if (__INCLUDE_WHOLESALE__) {` ~ 그 다음 `}` 줄까지(현재 3줄짜리 TLA import).
    const lines = src.split('\n')
    const gateStart = lines.findIndex((l) => /^\s*if \(__INCLUDE_WHOLESALE__\) \{/.test(l))
    expect(gateStart).toBeGreaterThan(-1)
    let gateEnd = -1
    for (let i = gateStart + 1; i < lines.length; i++) {
      if (/^\}/.test(lines[i])) { gateEnd = i; break }
    }
    expect(gateEnd).toBeGreaterThan(gateStart)

    const mountAt = lines.findIndex((l) => /^\s*app\.route\(/.test(l) && l.includes("'/api/admin/wholesale-malls'"))
    expect(mountAt).toBeGreaterThan(-1)
    expect(mountAt > gateEnd || mountAt < gateStart).toBe(true)
  })
})

describe('🔴 R2 — 게이트 안으로 되돌아가지 않는다', () => {
  it('mount-wholesale.ts 는 몰 관리 CRUD 를 마운트하지 않는다', () => {
    // 주석엔 남아 있다(왜 없는지 설명) — 그래서 `^app.route` 줄만 본다.
    const mounts = routeLines(readRaw(MOUNT_WS)).filter((l) => l.includes('wholesale-malls'))
    expect(mounts).toEqual([])
  })
})

describe('🔴 R3 — /api/admin 보다 먼저 등록된다', () => {
  it('adminApp catch-all 마운트 앞에 온다', () => {
    const lines = readRaw(INDEX).split('\n')
    const idx = (pred: (l: string) => boolean) => lines.findIndex((l) => /^\s*app\.route\(/.test(l) && pred(l))
    const mall = idx((l) => l.includes("'/api/admin/wholesale-malls'"))
    const admin = idx((l) => l.includes("'/api/admin'") && l.includes('adminApp'))
    expect(mall).toBeGreaterThan(-1)
    expect(admin).toBeGreaterThan(-1)
    expect(mall).toBeLessThan(admin)
  })
})

describe('🔴 R4 — 도매 그래프를 끌고 오지 않는다', () => {
  // 소비자 번들을 200KB 불리지 않는 것이 이 배치의 전제다. 몰 CRUD 모듈(`wholesale-malls`) 하나만
  // 허용하고, 도매 주문/정산/카탈로그 모듈로 번지면 실패시킨다.
  const ALLOWED_SUPPLY_IMPORT = /\.\/wholesale-malls(['"])/

  it('몰 어드민 라우트가 features/supply 에서 끌어오는 건 wholesale-malls 하나뿐', () => {
    const code = readCode(MALL_ADMIN)
    const supplyImports = [...code.matchAll(/from\s+['"](\.\/[^'"]+|@\/features\/supply\/[^'"]+)['"]/g)].map((m) => m[1])
    expect(supplyImports.length).toBeGreaterThan(0)   // 측정 대상 0건이면 통과가 아니라 실패
    for (const spec of supplyImports) {
      expect(`${spec}'`).toMatch(ALLOWED_SUPPLY_IMPORT)
    }
  })

  it('wholesale-malls.ts 자체가 도매 다른 모듈을 import 하지 않는다', () => {
    const code = readCode('src/features/supply/api/wholesale-malls.ts')
    const supplyImports = [...code.matchAll(/from\s+['"](\.\/[^'"]+|@\/features\/supply\/[^'"]+)['"]/g)].map((m) => m[1])
    expect(supplyImports).toEqual([])
  })
})
