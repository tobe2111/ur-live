import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 🧱 **100컬럼 테이블에 컬럼을 더하는 런타임 코드는 조용히 실패한다.**
 *
 * 2026-08-21 라이브 사고: `/api/seller/pin-status` 500 · `no such column: pin_hash`.
 *
 * ```ts
 * try { await DB.prepare('ALTER TABLE sellers ADD COLUMN pin_hash TEXT').run() } catch { /* exists *\/ }
 * const s = await DB.prepare('SELECT pin_hash FROM sellers WHERE id = ?')   // ← 여기서 터진다
 * ```
 *
 * `sellers` 는 **정확히 100컬럼 = D1 한도**라 그 ALTER 가 *영원히* 실패한다. 그런데 `catch {}` 가
 * 실패를 **"이미 있음"으로** 읽어 정상 경로와 구분이 안 된다. 그래서 **셀러 PIN 은 한 번도 동작한
 * 적이 없었다** — 에러는 기능을 쓸 때, 그것도 엉뚱한 줄에서 났다.
 *
 * 🩸 **처음 만든 이 가드는 헛돌았다.** "ALTER 하는 컬럼은 baseline 에 있어야 한다"로 짰는데
 *    통과했다 — `scripts/sellers-column-baseline.json` 은 **라이브 사본이 아니라 수동 허용목록**이라
 *    `pin_hash`·`nts_status`·`plus_until` 이 **전부 들어 있었다**(승인은 됐고 적용은 안 된 유령).
 *    baseline 을 진실로 믿은 게 오류였다. 그래서 규칙을 바꿨다 ↓
 *
 * 규칙: **런타임 코드(요청·cron 경로)에서 넓은 테이블에 인라인 ALTER 를 하지 않는다.**
 *   - 스키마 수리는 `repair-schema/` · `internal-admin-tools` 에서만 — 거기선 결과를 보고한다.
 *   - 새 메타는 `seller_meta` / `product_supply_meta` K-V (CLAUDE.md 컬럼 예산제).
 *
 * ⚠️ 못 잡는 것: **정적으로는 "라이브에 그 컬럼이 실제로 있는가"를 알 수 없다.** 아래 KNOWN 3건은
 *    라이브 스키마 실측으로 확인한 잠재 500 이고, 고칠 때 목록에서 빼야 한다.
 */
const WIDE = 'sellers|products'

/** 스키마 수리 전용 위치 — 여기선 ALTER 가 정당하다(결과를 보고하고, 요청 경로가 아니다). */
const REPAIR_OK = [/repair-schema/, /internal-admin-tools/, /migrations?\//]

/**
 * 아직 안 고친 런타임 ALTER — **전부 잠재 500 이다**(라이브 실측 2026-08-21).
 * 고치면 이 목록에서 빼라. 새로 추가하는 것은 금지다.
 */
const KNOWN: Record<string, string> = {
  'src/features/admin/api/admin-kt-alpha/products.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/admin/api/admin-tools.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/auth/api/seller.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/bulk-upload/api/bulk-upload.routes.ts':
    '🔴 라이브에 없음 — 잠재 500: products.category_main, products.category_sub, products.option_type, products.option_values',
  'src/features/group-buy/api/group-buy.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/group-buy/api/marketing.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/inventory/api/inventory.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/seller/api/seller-management.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/seller/api/seller-orders.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/seller/api/seller-registration.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/supply/api/distributor-admin/helpers.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/supply/api/distributor-admin/seed-demo.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/supply/api/supplier-dashboard.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/supply/api/supply-visibility.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/supply/api/wholesale-helpers.ts':
    '🔴 라이브에 없음 — 잠재 500: sellers.nts_status',
  'src/features/supply/api/wholesale-main.routes.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
  'src/features/supply/api/wholesale-plus.routes.ts':
    '🔴 라이브에 없음 — 잠재 500: sellers.plus_until',
  'src/features/supply/api/wholesale.routes.ts':
    '🔴 라이브에 없음 — 잠재 500: sellers.nts_status',
  'src/worker/cron/seller-daily-report.ts':
    '컬럼은 현재 라이브에 존재(같은 클래스, 잠복)',
}

const SRC = execSync(`git ls-files 'src/**/*.ts' | grep -v '/tests/'`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)

/**
 * 주석은 코드가 아니다 — **이걸 안 하면 자기 자신에게 걸린다.**
 * `seller-pin.routes.ts` 는 고친 뒤 "원래 이런 ALTER 를 했다"는 설명을 docblock 에 남겼는데,
 * 첫 스캔이 그 문장을 위반으로 셌다. 사고 기록을 남길수록 가드가 시끄러워지면 기록을 안 하게 된다.
 */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
}

describe('넓은 테이블 인라인 ALTER — 조용한 실패 차단', () => {
  it('스캔 대상이 비어 있지 않다 (측정 0 이면 통과가 아니라 실패)', () => {
    expect(SRC.length).toBeGreaterThan(500)
  })

  it('런타임 경로에 새로운 인라인 ALTER 가 없다', () => {
    const rx = new RegExp(`ALTER\\s+TABLE\\s+(?:${WIDE})\\s+ADD\\s+COLUMN\\s+([A-Za-z0-9_]+)`, 'gi')
    const found: string[] = []
    let scanned = 0
    for (const f of SRC) {
      if (REPAIR_OK.some((r) => r.test(f))) continue
      const hits = [...codeOnly(readFileSync(f, 'utf8')).matchAll(rx)]
      if (!hits.length) continue
      scanned++
      if (KNOWN[f]) continue
      found.push(`${f} → ${hits.map((m) => m[1]).join(', ')}`)
    }
    // 탐지가 죽으면(경로 규약 변경 등) 0 건이 되어 조용히 초록이 된다 — 그걸 막는다.
    expect(scanned, '런타임 ALTER 를 하나도 못 찾았다 — KNOWN 이 다 고쳐졌으면 이 기대치를 낮춰라')
      .toBeGreaterThanOrEqual(Object.keys(KNOWN).length)
    expect(found, '넓은 테이블에 런타임 ALTER 추가 금지 — 한도라 실패하고 catch 가 삼킨다').toEqual([])
  })

  it('KNOWN 목록이 낡지 않았다 (고쳐진 파일이 남아 있으면 알려준다)', () => {
    const rx = new RegExp(`ALTER\\s+TABLE\\s+(?:${WIDE})\\s+ADD\\s+COLUMN`, 'i')
    const stale = Object.keys(KNOWN).filter((f) => {
      try { return !rx.test(codeOnly(readFileSync(f, 'utf8'))) } catch { return true }
    })
    expect(stale, '이미 고쳤거나 사라진 파일 — KNOWN 에서 빼라').toEqual([])
  })
})
