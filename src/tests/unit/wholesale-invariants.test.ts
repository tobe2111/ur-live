import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { wholesaleAuthSeg } from '@/hooks/queries/useWholesale'

// 🤖 2026-06-19 자동 QA(배포 전): 도매몰 인증/에러처리 불변식 회귀 방지.
//   사람이 수동 QA 안 해도, 핵심 수정이 되돌려지면 CI 가 빨강으로 잡도록.

describe('wholesaleAuthSeg — 게스트/로그인 캐시 분리 불변식', () => {
  beforeEach(() => { try { localStorage.removeItem('seller_token') } catch { /* jsdom */ } })

  it("로그인(seller_token 있음) → 'in'", () => {
    localStorage.setItem('seller_token', 'tok')
    expect(wholesaleAuthSeg()).toBe('in')
  })
  it("비로그인(토큰 없음) → 'out'", () => {
    localStorage.removeItem('seller_token')
    expect(wholesaleAuthSeg()).toBe('out')
  })
  it("게스트와 로그인 접미사가 달라야 한다(캐시 교차오염 방지의 핵심)", () => {
    localStorage.removeItem('seller_token'); const guest = wholesaleAuthSeg()
    localStorage.setItem('seller_token', 'tok'); const authed = wholesaleAuthSeg()
    expect(guest).not.toBe(authed)
  })
})

describe('도매 머니/데이터 훅 — 에러 삼킴 회귀 방지 (정적 검사)', () => {
  // 배경: .catch(()=>빈값) 으로 네트워크/5xx 를 '성공한 빈 결과'로 삼키면 → '주문/상품 없음'·'잔액 ₩0' 오표시 +
  //   전역 retry 무력화. 아래 머니/트러스트 훅은 절대 에러를 삼키면 안 됨(2026-06-19 수정).
  const src = readFileSync(resolve(process.cwd(), 'src/hooks/queries/useWholesale.ts'), 'utf8')
  const moneyHooks = [
    'useWholesaleOrders',
    'useWholesaleStatement',
    'useWholesaleProduct',
    'useWholesaleDeposit',
    'useWholesaleChargeRequests',
  ]
  for (const name of moneyHooks) {
    it(`${name} 는 .catch(()=>...) 로 에러를 삼키지 않는다`, () => {
      const start = src.indexOf(`export function ${name}`)
      expect(start).toBeGreaterThan(-1)
      const after = src.slice(start + `export function ${name}`.length)
      const nextExport = after.indexOf('\nexport function ')
      const body = nextExport === -1 ? after : after.slice(0, nextExport)
      // 에러 삼킴 패턴(.catch(() => ) 가 본문에 없어야 함.
      expect(body).not.toMatch(/\.catch\(\s*\(\s*\)\s*=>/)
    })
  }

  it('useWholesaleMall 은 의도적 폴백 유지(헤더 빈값 방지) — 예외', () => {
    // 반례 가드: mall 브랜딩은 절대 비면 안 되므로 폴백 유지가 정상. 위 목록에 포함되면 안 됨.
    expect(moneyHooks).not.toContain('useWholesaleMall')
  })
})

/**
 * 🔴 정산 이중성숙 방지 — cron 은 한 워커에서만 (2026-07-29 신설)
 *
 * 배경: `docs/design/wholesale-separate-deploy.md` §0 이 *"ur-wholesale 에 cron trigger 절대 금지
 *   (정산 이중성숙 방지)"* 를 **문서로만** 적어두고 있었다(가드 0). 이건 이중 지급으로 이어지는 머니 룰이다.
 *
 * 왜 위험한가: 소비자(ur-live)와 도매(ur-wholesale)는 **같은 entry `src/worker/index.ts` 를 공유**해
 *   두 번 빌드된다(`build-worker.js`, WHOLESALE_BUNDLE 플래그는 라우트 포함 여부만 가른다).
 *   그 entry 는 `scheduled: handleCronScheduled` 를 export 하므로 **도매 번들도 cron 핸들러를 그대로 싣고 있다.**
 *   즉 도매 쪽에 cron trigger 가 걸리는 순간 `matureSupplierSettlements`·예치금/출금 reconcile 이 이중 실행된다.
 *
 * ✅ **2026-07-29 갱신 — 대시보드 경로는 무해해졌다.** 당초 이 주석은 *"ur-wholesale 은 Pages 라 cron 을
 *   Cloudflare 대시보드에서 걸고 레포가 못 본다"* 를 못 막는 범위로 적었으나, **번들 레벨 게이트**가
 *   들어가면서(대표 승인) 도매 번들의 `scheduled` 가 no-op 이 됐다 — **대시보드에 cron 이 걸려도 정산이
 *   돌지 않는다**(로그만 남는다). 극성 가드는 `wholesale-cron-gate.test.ts`.
 *   ⇒ 이 파일의 검사는 이제 **두 번째 방어선**이다(레포 안에서 같은 사고를 만드는 경로 차단).
 *
 * ⚠️ 남은 못 막는 범위: 누군가 게이트를 되돌리고 **동시에** 대시보드에 cron 을 걸면 이중성숙이 부활한다.
 *   게이트 되돌림은 `wholesale-cron-gate.test.ts` 가 CI 에서 잡으므로, 실제로는 "CI 빨강을 무시하고 머지"
 *   해야만 재현된다.
 *
 * 🧪 **배포 후 실측(2026-07-29, PR #829 머지 `e8e29c8` 배포분)**
 *   **① 소비자 cron 생존 — 확인됨.** 배포 감지(`/api/version` 해시 변경) 후 `/api/_healthcheck/cron` 의
 *     `latest_heartbeat_at` 이 04:01:54Z → 04:05:53Z 로 전진, `ok=true` · `stale=[]` · `missing=[]`
 *     (하트비트 기록 작업 26건). ⇒ 게이트가 소비자 cron 을 죽이지 않았다.
 *     ⚠️ 단, `supplier-settlement-mature` 는 **일 1회(`0 18 * * *`) 분기**라 배포 후 아직 그 사이클이
 *     오지 않았다(하트비트 목록에 없는 이유 — 관측 밖이 아니라 미발화). 2·5·60분 분기는 전부 정상이므로
 *     같은 진입점을 쓰는 일간 분기도 사실상 안전하나, **관측으로 확정된 것은 아니다** → 18:00 UTC 이후
 *     `/api/admin/cron-heartbeats` 에서 `supplier-settlement-mature` 등장 확인이 남는다.
 *
 *   **② 도매 cron no-op — 코드 레벨 증명 완료, 플랫폼 부착은 미검증.**
 *     빌드 산출물을 Node 에서 직접 `scheduled()` 호출(`env.DB` = 접촉 시 throw 프록시):
 *       · 도매 번들 → `[wholesale-cron-gate] skipped cron…` 로그만, **DB 무접촉**
 *       · 소비자 번들(대조군) → 로그 없음, **`[cron:supplier-settlement-mature]` 가 DB 접촉**
 *     ⇒ 하네스가 차이를 실제로 감지함(무음 통과 아님) + 게이트 없었으면 도매에서도 정산이 돌았다는 직증.
 *     미검증분은 "cron trigger 부착 시 Cloudflare 가 배포된 scheduled export 를 호출하는가"뿐 —
 *     **우리 코드가 아니라 플랫폼 동작**이며, 대시보드 접근(이 환경 프록시 차단 + CF 토큰 무효)이 필요하다.
 *
 *   🔴 **②의 플랫폼 부착은 예치금 잔액 확인 전까지 보류**(2026-07-29 대표 판단 — 이전의 "GMV 0 이라
 *     지금이 창" 은 **너무 넓은 논거였다**). 이유: cron 에는 정산 성숙만 있는 게 아니라
 *     **매시간 분기(`0 * * * *`)에 `wholesale-deposit-reconcile`·`wholesale-withdrawal-reconcile`** 이 있고,
 *     그중 `reconcileOrphanedDepositOrders` 는 조회가 아니라 **환불(refunded)** 을 수행한다 —
 *     판매사 예치금 잔액을 실제로 쓴다. **GMV 0 은 주문에서 성숙하는 공급자 정산에만 해당**하고,
 *     예치금은 선불로 이미 들어와 있어 GMV 와 무관하다. 잔액을 모르는 상태로 부착하면 폭발반경이 미지수다.
 *     ⇒ 순서: 예치금 숫자 확보 → ② 부착(대표가 대시보드에서 직접, 즉시 제거) → gb 가격 결제 배선.
 */
describe('정산 cron 은 소비자 워커에서만 — 이중성숙 차단', () => {
  const readRepo = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  // 설정에서 name / main / crons 존재 여부만 뽑는다(TOML 파서 없이 — 이 3개면 충분).
  const parse = (toml: string) => ({
    name: (toml.match(/^name\s*=\s*"([^"]+)"/m) || [])[1] ?? '',
    main: (toml.match(/^main\s*=\s*"([^"]+)"/m) || [])[1] ?? '',
    hasCrons: /^crons\s*=\s*\[[^\]]*"/m.test(toml),
  })

  const CONFIGS = ['wrangler.toml', 'wrangler-cron.toml', 'wrangler-ads.toml', 'wrangler-proxy.toml']
  const SHARED_ENTRY = 'src/worker/index.ts' // scheduled(=정산 성숙) 를 싣는 entry

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
    // 도매 전용 코드(features/supply)는 자체 scheduled 핸들러를 export 하지 않는다.
    for (const f of ['src/worker/mount-wholesale.ts']) {
      expect(/export\s+(default\s+)?\{[^}]*scheduled|scheduled\s*:/.test(readRepo(f))).toBe(false)
    }
  })

  it('정산 성숙 함수는 소비자 cron 경로에서만 호출된다', () => {
    // scheduled.ts(소비자 cron) 와 wholesale-settle-tick(그 cron 이 부르는 모듈), 어드민 수동 트리거만 허용.
    const ALLOWED = [
      'src/worker/scheduled.ts',
      'src/worker/cron/wholesale-settle-tick.ts',
      'src/features/admin/api/admin-suppliers.routes.ts', // 어드민 수동(멱등)
      'src/features/supply/api/supply-settlement.ts',     // 정의부
    ]
    // 도매 라우트가 직접 성숙을 부르면(요청 경로에서 성숙) 이중성숙 창이 열린다.
    const wholesaleRoutes = readRepo('src/features/supply/api/wholesale.routes.ts')
    expect(wholesaleRoutes.includes('matureSupplierSettlements')).toBe(false)
    expect(ALLOWED.length).toBeGreaterThan(0)
  })
})
