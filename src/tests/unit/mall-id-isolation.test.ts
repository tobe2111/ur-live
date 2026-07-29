import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve } from 'path'

/**
 * 🏬 `mall_id` 격리 전제 가드 (2026-07-29 대표 지시 — §8-C 의 전제를 규율에서 코드로)
 *
 * 배경: `mall_id = 1` 이 지금 **두 의미를 겸한다** — ① 유어딜 본진(모든 기존 소비자 상품이
 *   `ALTER … DEFAULT 1` 로 채워진 값) ② 유통스타트 몰(`wholesale_malls` id=1). id=2 는 메디스타트.
 *   판별자(본진 = 불변식① AND `COALESCE(mall_id,1)=1` / 몰 = `mall_id=:id`)는 **신규 몰이 1·2 를
 *   재사용하지 않는다**는 전제 위에서만 성립한다. A/B/C 마이그레이션 결정은 보류됐으므로
 *   (라이브 스키마 무접촉), **그 전제를 테스트로 고정해 결정을 안전하게 미룬다.**
 *
 * ⚠️ **이 가드가 못 막는 것**(과신 금지):
 *   - 라이브 DB 의 실제 데이터는 못 본다. 여기서 고정하는 것은 **레포 안에서 그 전제를 깨는 경로**뿐이다.
 *   - `mall_id` 를 런타임 변수로 계산해 넣는 경우(리터럴이 아닌 경로)는 정적으로 못 잡는다.
 *     그 축은 몰 스코프 쿼리의 행위 테스트가 생길 때 함께 다뤄야 한다.
 *
 * 설계 근거: docs/design/operator-mall-saas-gap.md §8-B · §8-C
 */
describe('mall_id 격리 전제 — 신규 몰은 1·2 를 재사용하지 않는다', () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  const MALL_ADMIN = 'src/features/supply/api/wholesale-malls-admin.routes.ts'

  it('(a1) 몰 생성 INSERT 는 id 를 명시하지 않는다 (AUTOINCREMENT 유지 → 신규는 3+)', () => {
    const src = read(MALL_ADMIN)
    const ins = src.match(/INSERT INTO wholesale_malls\s*\(([^)]*)\)/)
    expect(ins, 'INSERT INTO wholesale_malls 를 못 찾음 — 경로 변경 확인').not.toBeNull()
    const cols = (ins as RegExpMatchArray)[1].split(',').map((c) => c.trim())
    // id 를 직접 넣기 시작하면 1·2 재사용이 가능해진다.
    expect(cols).not.toContain('id')
  })

  it('(a2) 몰 수정(PATCH) 은 id 를 바꿀 수 없다', () => {
    const src = read(MALL_ADMIN)
    // 허용 필드는 `if ('field' in body)` 로 열거된다. id 가 그 목록에 들어오면 재배정이 가능해진다.
    expect(/if\s*\(\s*['"]id['"]\s+in\s+body\s*\)/.test(src)).toBe(false)
    expect(/sets\.push\(\s*['"`]id\s*=/.test(src)).toBe(false)
  })

  it('(a3) 시드가 1·2 를 점유한다 (신규 몰이 3부터 시작하는 근거)', () => {
    const repair = read('src/worker/routes/repair-schema.routes.ts')
    expect(/INSERT OR IGNORE INTO wholesale_malls \(id[^)]*\)\s*VALUES \(1,/.test(repair)).toBe(true)
    expect(/INSERT OR IGNORE INTO wholesale_malls \(id[^)]*\)\s*VALUES \(2,/.test(repair)).toBe(true)
  })

  /**
   * (b) 쓰기 시점 차단 — **지시 원문 그대로는 구현할 수 없다.**
   *
   * 원 지시: *"is_supply_product=0 인 상품이 mall_id IN (1,2) 로 저장되는 것을 차단"*.
   * 그런데 **그게 오늘의 정상 상태**다 — `products.mall_id` 는 `DEFAULT 1` 이고 소비자 상품은
   * `is_supply_product=0`(또는 NULL) 이므로, 지금 모든 소비자 상품 생성이 그 조건에 해당한다.
   * 런타임 차단을 넣으면 **소비자 상품 등록이 즉시 전부 막힌다.**
   *
   * 실제 위험은 "기본값으로 1 이 되는 것"이 아니라 **"운영자 몰 컨텍스트에서 mall_id 를 명시로
   * 스탬프하는 새 경로가 1·2 를 쓰는 것"** 이다.
   * ⚠️ 첫 구현은 리터럴 인접 정규식이었는데 **되돌려-검증에서 실제로 놓쳤다**(`VALUES (?, 1)`).
   * 그래서 판정을 정규식에 맡기지 않고 **`mall_id` 언급 자체를 검토 대상으로** 돌렸다(래칫).
   * 현재 소비자 쓰기 경로에는 언급이 **0건**이라 baseline 은 비어 있고, 스탬프 경로가 생기면
   * 먼저 빨강이 된다 — 작성자가 값의 출처를 확인한 뒤 등록하게 만드는 것이 목적이다.
   */
  it('(b) 소비자 쓰기 경로의 mall_id 사용은 전부 검토를 거친다 (언급 래칫)', () => {
    const WRITE_DIRS = ['src/features/products', 'src/features/seller', 'src/features/group-buy']
    const walk = (dir: string): string[] => {
      const abs = resolve(process.cwd(), dir)
      if (!existsSync(abs)) return []
      return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(`${dir}/${e.name}`) : (/\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []),
      )
    }
    const files = WRITE_DIRS.flatMap(walk)
    expect(files.length).toBeGreaterThan(20) // 스캔이 헛돌면 여기서 잡힌다

    // ⚠️ 리터럴 인접 매칭만으로는 부족하다 — 되돌려-검증에서 실제로 놓쳤다:
    //   `INSERT INTO products (name, mall_id) VALUES (?, 1)` 은 컬럼과 값이 떨어져 있어 안 걸린다.
    //   `.bind(..., 1)` 처럼 값이 아예 다른 줄에 있는 경우도 정적으로는 못 잇는다.
    //   ⇒ 판정을 정규식에 맡기지 말고 **언급 자체를 검토 대상으로** 돌린다(래칫).
    //   지금 소비자 쓰기 경로에는 `mall_id` 언급이 0건이므로 baseline 은 비어 있다.
    //   운영자 몰 스탬프 경로가 생기면 이 테스트가 먼저 빨강이 되고, 작성자는
    //   "1·2 가 아니라 운영자 몰 id 를 넣는다"를 확인한 뒤 baseline 에 등록한다.
    const MENTION_BASELINE: Record<string, string> = {
      // 예) 'src/features/products/api/products.routes.ts': '운영자 몰 스탬프 — sellerMallIdOf 결과 사용(리터럴 아님)'
    }
    const mentions = files.filter((f) => /\bmall_id\b/.test(read(f)) && !(f in MENTION_BASELINE))
    expect(mentions, 'mall_id 를 쓰는 새 경로 — 1·2 가 아닌 운영자 몰 id 인지 확인 후 baseline 등록').toEqual([])

    // 보조 신호: 리터럴 1·2 인접 대입은 어차피 명백한 위반이므로 따로도 잡는다.
    const BAD = /mall_id\s*(?:=|,|:)\s*[12]\b/
    expect(files.filter((f) => BAD.test(read(f)))).toEqual([])
  })
})
