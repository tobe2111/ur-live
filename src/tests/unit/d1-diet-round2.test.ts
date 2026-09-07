/**
 * 📏 D1 읽기 다이어트 2차 — 2026-09-02 18:25 KST 유료 전환 직후 **첫 계량**이 가리킨 상위 둘.
 *
 *   ① `review-gen-tuning` 최근 실리뷰 2,000건 조회 — 12만 행 정렬 → 부분 인덱스로 2,000행
 *   ② `group-buy-deadline-push` 마감 창 조회 — products 전수 ×3 → 활성+마감 부분 인덱스
 *
 * 🪦 2026-09-05: ②는 **인덱스가 아니라 cron 자체를 없애서** 해결됐다. 마감 개념이 사라져(대표
 *   "마감 개념은 없어") 그 조회는 영구히 0건이 됐고, 0건을 빠르게 찾는 인덱스보다 안 찾는 편이 낫다.
 *   그래서 ②의 검사는 "인덱스를 타는가"에서 **"그 cron 이 되살아나지 않는가"** 로 바뀌었다.
 *
 * 플래너 실증(node:sqlite): 인덱스 DDL 을 `index-repairs.ts` 에서 **그대로** 읽어 실제 쿼리 문장이 그 인덱스를 타는지 본다.
 * ⚠️ 못 막는 것: 라이브 D1 의 ANALYZE 통계·실제 행 분포. 여기선 "인덱스를 고를 수 있는가"만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { INDEX_REPAIRS } from '@/worker/routes/repair-schema/index-repairs'

const TUNING = readFileSync('src/worker/utils/review-gen-tuning.ts', 'utf8')
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const plan = (db: InstanceType<typeof DatabaseSync>, sql: string) =>
  db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((x: Record<string, unknown>) => String(x.detail)).join(' | ')
const ddlOf = (name: string) => {
  const r = INDEX_REPAIRS.find((x) => x.name === name)
  expect(r, name).toBeTruthy()
  return r!.sql
}

describe('① 실리뷰 최근 2,000건 — 부분 인덱스', () => {
  it('쿼리의 WHERE 가 인덱스 WHERE 와 글자까지 같다(함의 인정 조건)', () => {
    expect(TUNING).toMatch(/WHERE COALESCE\(is_generated,0\) = 0 AND content IS NOT NULL/)
    expect(ddlOf('idx_product_reviews_real_created')).toContain('WHERE COALESCE(is_generated,0) = 0')
  })
  it('🔒 플래너가 부분 인덱스를 탄다(정렬 임시 B-tree 없음)', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE product_reviews (id INTEGER PRIMARY KEY, product_id INTEGER, content TEXT, rating INTEGER, is_generated INTEGER, created_at TEXT)')
    db.exec(ddlOf('idx_product_reviews_real_created'))
    const ins = db.prepare('INSERT INTO product_reviews (product_id, content, rating, is_generated, created_at) VALUES (?,?,?,?,?)')
    for (let i = 1; i <= 5000; i++) ins.run(i % 300, 'r' + i, 5, i % 10 === 0 ? 0 : 1, '2026-08-' + String(1 + (i % 28)).padStart(2, '0'))
    const p = plan(db, `SELECT content FROM product_reviews WHERE COALESCE(is_generated,0) = 0 AND content IS NOT NULL AND LENGTH(TRIM(content)) > 0 ORDER BY created_at DESC LIMIT 2000`)
    expect(p).toContain('idx_product_reviews_real_created')
    expect(p).not.toMatch(/USE TEMP B-TREE FOR ORDER BY/)
    db.close()
  })
})

describe('② 공구 마감 push cron — 되살아나지 않는다', () => {
  it('cron 파일이 없다', () => {
    expect(existsSync('src/worker/cron/group-buy-deadline-push.ts')).toBe(false)
  })

  it('디스패처가 그 이름을 부르지 않는다', () => {
    const sched = readFileSync('src/worker/scheduled.ts', 'utf8')
    expect(sched).not.toMatch(/handleGroupBuyDeadlinePush/)
    expect(sched).not.toMatch(/safeCron\('group-buy-deadline-push'/)
  })

  it('그 인덱스를 다시 만들지 않는다 — 읽는 사람이 없으면 products 쓰기만 무거워진다', () => {
    expect(INDEX_REPAIRS.some((x) => x.name === 'idx_products_gb_deadline_active')).toBe(false)
  })

  it('🪦 하트비트 이름이 은퇴 처리돼 있다 — 안 그러면 그 행이 영원히 빨갛고 경보를 침묵시킨다', () => {
    const map = readFileSync('src/worker/utils/cron-beat-retirement.ts', 'utf8')
    expect(map).toContain('beat-retire-ok group-buy-deadline-push')
  })
})
