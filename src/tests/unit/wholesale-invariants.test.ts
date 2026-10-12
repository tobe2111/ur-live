import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

// 🧨 2026-10-11 도매몰 철거(대표 "도매몰 잔해들은 아예 다 삭제해줘") — 이 파일은 불변식 **하나만** 남는다.
//   사라진 둘: `wholesaleAuthSeg` 캐시 분리 · 도매 훅 에러 삼킴 — 둘 다 주체(`hooks/queries/useWholesale`)가
//   함께 삭제됐다(재조준할 대상이 없다. 가드를 초록으로 만들려고 지운 것이 아니다).
//   🔴 남은 불변식은 **머니 룰**이라 도매가 사라져도 유효하다: 정산 성숙(`supply-settlement`)은 소비자
//   워커에 잔류하므로, 같은 entry 로 cron 을 도는 워커가 둘이 되면 **이중성숙**이 난다.

describe('정산 cron 은 소비자 워커에서만 — 이중성숙 차단', () => {
  const readRepo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  // 설정에서 name / main / crons 존재 여부만 뽑는다(TOML 파서 없이 — 이 3개면 충분).
  const parse = (toml: string) => ({
    name: (toml.match(/^name\s*=\s*"([^"]+)"/m) || [])[1] ?? '',
    main: (toml.match(/^main\s*=\s*"([^"]+)"/m) || [])[1] ?? '',
    hasCrons: /^crons\s*=\s*\[[^\]]*"/m.test(toml),
  })

  // ⚠️ 2026-08-02: 예전엔 파일명을 **하드코딩**했다. 죽은 `wrangler-cron.toml` 을 지우자
  //   `ENOENT` 로 테스트가 통째로 터졌다 — 이 레포가 오늘만 두 번 만난 '경로 하드코딩' 클래스다.
  //   반대 방향(새 wrangler 설정이 생겼는데 목록에 안 넣음)은 **조용히 통과**해서 더 나쁘다.
  //   ⇒ 레포에서 직접 찾는다.
  const CONFIGS = readdirSync(resolve(process.cwd())).filter((f) => /^wrangler.*\.toml$/.test(f))
  const SHARED_ENTRY = 'src/worker/index.ts' // scheduled(=정산 성숙) 를 싣는 entry
  /** 트리 훑기 — 경로 하드코딩을 쓰지 않기 위한 공용 헬퍼(위 재조준 주석 참조). */
  const walkAll = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walkAll(rel, out)
      else if (/\.ts$/.test(e.name)) out.push(rel)
    }
    return out
  }

  it('공유 entry 로 cron 을 도는 워커는 ur-live 하나뿐이다', () => {
    const offenders = CONFIGS
      .map((f) => ({ f, ...parse(readRepo(f)) }))
      .filter((c) => c.main === SHARED_ENTRY && c.hasCrons && c.name !== 'ur-live')
      .map((c) => `${c.f}(name=${c.name})`)
    // 도매용 wrangler 설정이 생기고 거기에 crons 가 붙으면 여기서 잡힌다.
    expect(offenders).toEqual([])
  })

  it('cron 진입점(scheduled export)은 공유 entry 한 곳에만 있다', () => {
    // 두 번째 scheduled export 가 생기면 번들별로 다른 cron 이 붙을 수 있다.
    const idx = readRepo(SHARED_ENTRY)
    // 2026-07-29: 게이트 도입으로 바인딩이 삼항이 됐다 — 거짓 분기(소비자)가 실제 핸들러여야 한다.
    //   극성/분기 세부 검증은 wholesale-cron-gate.test.ts 가 담당(여기선 진입점 존재만).
    expect(/scheduled:.*handleCronScheduled/.test(idx)).toBe(true)
    // 🔁 2026-10-11 재조준: 종전엔 `mount-wholesale.ts` 를 **하드코딩**해 읽었는데 철거로 사라져
    //   테스트가 ENOENT 로 터졌다 — 이 파일의 주석이 바로 그 클래스를 경고하고 있었다(두 번째다).
    //   ⇒ 경로를 박지 말고 **트리를 훑어** `scheduled` 를 export 하는 파일이 공유 entry 뿐임을 센다.
    const exporters = walkAll('src/worker')
      .concat(walkAll('src/features'))
      .filter((f) => f !== SHARED_ENTRY)
      .filter((f) => /export\s+(default\s+)?\{[^}]*\bscheduled\b/.test(readRepo(f)))
    expect(exporters).toEqual([])
  })

  it('정산 성숙 함수는 소비자 cron 경로에서만 호출된다', () => {
    // scheduled.ts(소비자 cron) 와 wholesale-settle-tick(그 cron 이 부르는 모듈), 어드민 수동 트리거만 허용.
    const ALLOWED = [
      'src/worker/scheduled.ts',
      'src/worker/cron/wholesale-settle-tick.ts',
      'src/features/admin/api/admin-suppliers.routes.ts', // 어드민 수동(멱등)
      'src/features/supply/api/supply-settlement.ts',     // 정의부
    ]
    // 🔁 2026-10-11 재조준: 종전엔 `wholesale.routes.ts` 한 파일만 봤는데 철거로 사라졌다.
    //   지키려던 것은 그대로다 — **요청 경로(HTTP 라우트)에서 성숙을 부르면 이중성숙 창이 열린다.**
    //   ⇒ 한 파일이 아니라 `*.routes.ts` 전수를 훑는다(허용목록 밖에서 부르면 빨간불).
    const routeFiles = walkAll('src/features')
      .concat(walkAll('src/worker/routes'))
      .filter((f) => /\.routes\.ts$/.test(f))
    const offenders = routeFiles
      .filter((f) => !ALLOWED.includes(f))
      .filter((f) => readRepo(f).includes('matureSupplierSettlements'))
    expect(routeFiles.length, '훑을 라우트 파일이 0개면 통과가 아니라 고장이다').toBeGreaterThan(50)
    expect(offenders).toEqual([])
  })
})
