/**
 * 🏨 2026-10-14 — 숙소 소개 문구 치유가 **도는 경로에 있는지**.
 *
 * 근거·실측은 `src/shared/stay-property-type.ts` 의 `STAY_PROPERTY_TYPE_DESCS` 머리말.
 * 요약: 치유 코드는 2026-08-31 에 쓰여 09-14 에 강화되고 시험까지 붙었는데 **호출처가 어드민
 *       재시드 POST 하나**뿐이라 라이브에서 한 번도 안 돌았다. 색인 대상 표본 79건 중 74건(93%)의
 *       meta description 에 줄표가 있었고 숙소 49건은 대표가 지적한 그 문장 그대로였다.
 *
 * ⚠️ **이 시험이 못 보는 것**
 *   - cron 이 실제로 발화하는지(Cloudflare 트리거는 레포 밖 — `cron-heartbeat` 가 그걸 본다).
 *   - D1 과 `node:sqlite` 의 차이.
 *   - 치유 후 문구가 **좋은지**(사람이 읽어야 한다 — 가드는 줄표 0 과 반복 없음만 본다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { healStayDescriptions } from '@/features/admin/api/admin-stays/heal-stay-descriptions'
import {
  STAY_PROPERTY_TYPE_DESCS, STAY_TYPE_DESC_LIST, propertyTypeDesc, STAY_PROPERTY_TYPE_LABELS,
} from '@/shared/stay-property-type'
import { readCode } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
      }
      return self
    },
  }
}

/** 라이브 실측 모양 — `/api/group-buy/stays/2732`: description 은 비고 description_full 에 옛 문장. */
function seed(db: Db) {
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, slug TEXT, description TEXT, updated_at TEXT, is_active INTEGER DEFAULT 1);
           CREATE TABLE product_stay_info (product_id INTEGER, property_type TEXT, description_full TEXT);`)
  const rows: Array<[number, string, string, string, string]> = [
    [2732, 'demo-stay-1', '', 'hotel', '춘천의 호텔 — 접근성 좋은 호텔 — 깔끔한 룸 컨디션과 24시간 프런트.'],
    [2788, 'demo-stay-2', '', 'glamping', '경주의 글램핑 — 장비 없이 즐기는 글램핑 — 개별 화로와 냉난방 텐트.'],
    // 🔴 관리자가 손으로 쓴 행 — 데모가 아니므로 **절대 안 건드린다**(줄표가 있어도).
    [9001, 'real-stay', '사장님이 직접 쓴 소개 — 줄표가 있어도 그대로.', 'hotel', '사장님이 직접 쓴 소개 — 줄표가 있어도 그대로.'],
    // 이미 치유된 데모 — 줄표가 없으니 다시 선택되지 않는다(멱등성의 근거).
    [2790, 'demo-stay-3', STAY_PROPERTY_TYPE_DESCS.pension!, 'pension', STAY_PROPERTY_TYPE_DESCS.pension!],
  ]
  for (const [id, slug, desc, ptype, full] of rows) {
    db.prepare('INSERT INTO products (id, slug, description) VALUES (?,?,?)').run(id, slug, desc)
    db.prepare('INSERT INTO product_stay_info (product_id, property_type, description_full) VALUES (?,?,?)').run(id, ptype, full)
  }
}

const read = (db: Db, id: number) => ({
  desc: String((db.prepare('SELECT description FROM products WHERE id=?').get(id) as { description: string }).description),
  full: String((db.prepare('SELECT description_full FROM product_stay_info WHERE product_id=?').get(id) as { description_full: string }).description_full),
})

describe('🏨 숙소 소개 문구 치유', () => {
  // ──────────────────────────────── ① 문구 SSOT
  it('①-1 문구에 줄표가 없다 (색인 49건의 meta description 이 된다)', () => {
    for (const [k, v] of Object.entries(STAY_PROPERTY_TYPE_DESCS)) {
      expect(v.includes('—'), `${k} 에 줄표`).toBe(false)
      expect(v.includes('–'), `${k} 에 en-dash`).toBe(false)
      expect(v.length, k).toBeGreaterThan(20)
    }
  })

  it('①-2 유형 라벨을 문구 안에서 두 번 말하지 않는다 (대표가 지적한 반복)', () => {
    for (const [type, desc] of Object.entries(STAY_PROPERTY_TYPE_DESCS)) {
      const label = STAY_PROPERTY_TYPE_LABELS[type]!
      const n = desc.split(label).length - 1
      expect(n, `${type}: '${label}' 가 ${n}번`).toBeLessThanOrEqual(1)
    }
  })

  it('①-3 모르는 유형은 호텔 문구로 폴백한다 (건너뛰면 옛 문장이 남는다)', () => {
    expect(propertyTypeDesc('motel')).toBe(STAY_PROPERTY_TYPE_DESCS.hotel)
    expect(propertyTypeDesc(null)).toBe(STAY_PROPERTY_TYPE_DESCS.hotel)
    expect(propertyTypeDesc('HOTEL')).toBe(STAY_PROPERTY_TYPE_DESCS.hotel)
  })

  it('①-4 시드 표가 이 SSOT 를 읽는다 (문구가 두 벌이 되지 않는다)', () => {
    const c = readCode('src/features/admin/api/admin-stays.routes.ts')
    expect(c, '시드가 문구를 손으로 적는다').not.toMatch(/desc: '[^']{20,}'/)
    expect((c.match(/desc: propertyTypeDesc\('/g) ?? []).length).toBe(Object.keys(STAY_PROPERTY_TYPE_DESCS).length)
  })

  // ──────────────────────────────── ② 치유를 **실제로 돌려서** 판정
  it('②-1 데모의 두 칸을 모두 고치고, 수기 문구는 안 건드린다', async () => {
    const db = new DatabaseSync(':memory:')
    seed(db)
    const n = await healStayDescriptions(d1(db) as never, STAY_TYPE_DESC_LIST)
    expect(n, '고친 행 수를 돌려주지 않으면 "돌았는데 0건"과 "안 돌았음"을 구분할 수 없다').toBe(2)

    for (const [id, type] of [[2732, 'hotel'], [2788, 'glamping']] as const) {
      const r = read(db, id)
      expect(r.desc, `${id} products.description`).toBe(STAY_PROPERTY_TYPE_DESCS[type])
      // 🩸 2026-09-14 교훈 — 화면의 '숙소 소개' 가 읽는 칸은 **description_full** 이다.
      expect(r.full, `${id} description_full`).toBe(STAY_PROPERTY_TYPE_DESCS[type])
      expect(r.full.includes('—')).toBe(false)
    }
    // 🔴 반대 방향 — 수기 문구를 덮으면 사장님이 쓴 글이 사라진다.
    expect(read(db, 9001).full).toContain('사장님이 직접 쓴 소개')
    db.close()
  })

  it('②-2 두 번 돌려도 무해하다 (줄표 지문이 멱등성의 근거)', async () => {
    const db = new DatabaseSync(':memory:')
    seed(db)
    await healStayDescriptions(d1(db) as never, STAY_TYPE_DESC_LIST)
    const again = await healStayDescriptions(d1(db) as never, STAY_TYPE_DESC_LIST)
    expect(again, '두 번째에도 행을 고르면 멱등이 깨졌다').toBe(0)
    db.close()
  })

  // ──────────────────────────────── ③ **도는 경로**에 있다
  it('③-1 매일 도는 cron 이 치유를 부른다 (어드민 POST 하나였다)', () => {
    const c = readCode('src/worker/cron/scheduled-cleanup-daily.ts')
    expect(c, '치유가 도는 경로에 없다 — 2026-08-31~10-14 동안 한 번도 안 돌았다').toContain('healStayDescriptions(')
    expect(c, 'cron 이 문구 표를 손으로 적는다').toContain('STAY_TYPE_DESC_LIST')
    expect(c, '횟수를 안 실으면 "돌았는데 0건"과 "안 돌았음"을 구분할 수 없다').toContain('results.stay_desc_healed')
  })

  it('③-2 어드민 재시드 경로도 그대로 부른다 (한쪽만 남기지 않는다)', () => {
    const c = readCode('src/features/admin/api/admin-stays.routes.ts')
    expect(c).toContain('healStayDescriptions(')
  })

  it('③-3 치유 대상 조건이 두 칸을 함께 본다 (2026-09-14 사고)', () => {
    const c = readCode('src/features/admin/api/admin-stays/heal-stay-descriptions.ts')
    // 선택이 `p.description` 하나만 보면, 그 칸이 고쳐진 뒤 행이 영영 다시 안 걸려
    // `description_full`(화면이 읽는 칸)은 손댈 기회조차 없다.
    expect(c).toMatch(/p\.description LIKE '%—%' OR psi\.description_full LIKE '%—%'/)
    expect(c).toContain("slug LIKE 'demo-stay-%'")
  })
})
