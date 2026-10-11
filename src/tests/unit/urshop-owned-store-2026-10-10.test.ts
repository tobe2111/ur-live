/**
 * 🛍️ 내 유어샵에 **내 가게**가 뜨는가 (2026-10-10 사장님·중개사 플로우 전수조사)
 *
 * `/store/new` 로 직접 등록한 사장님은 `sellers.linked_user_id` 가 비어 있고 소유권은 `seller_operators`
 * (role='owner') 에 있다. 유어샵이 `linked_user_id` 만 봐서 **승인돼도 내 가게가 안 떴다.**
 * 실제 SQLite 에 `OWNED_STORE_WHERE_SQL` 을 넣고 고르는 매장을 센다.
 *  ① 주인 좌석으로 가진 승인 매장이 뜬다  ② 중개(operator) 좌석은 내 가게가 아니다
 *  ③ 회수된 좌석·대기·정지 매장은 안 뜬다  ④ 연결 계정 매장이 있으면 그것이 먼저
 *  ⑤ 배선 — 유어샵 두 조회가 이 조각을 쓴다
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { OWNED_STORE_WHERE_SQL } from '@/worker/utils/seller-operators'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (sql: string) => { get: (...a: never[]) => unknown } } }
let db: InstanceType<typeof DatabaseSync>
const pick = (uid: string) => (db.prepare(`SELECT s.id FROM sellers s WHERE ${OWNED_STORE_WHERE_SQL} LIMIT 1`).get(uid as never, uid as never, uid as never) as { id: number } | undefined)?.id ?? null

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, linked_user_id TEXT);
    CREATE TABLE seller_operators (seller_id INTEGER, user_id TEXT, role TEXT, revoked_at TEXT);
    INSERT INTO sellers VALUES (10,'approved',NULL),(11,'approved',NULL),(12,'pending',NULL),(13,'suspended',NULL),(14,'active',NULL),(15,'approved','u5'),(16,'approved',NULL);
    INSERT INTO seller_operators VALUES (10,'u1','owner',NULL),(11,'u2','operator',NULL),(12,'u3','owner',NULL),(13,'u4','owner',NULL),
      (14,'u6','owner',NULL),(16,'u5','owner',NULL),(10,'u7','owner','2026-10-01');
  `)
})

describe('내 가게 고르기', () => {
  it('① 주인 좌석의 승인 매장', () => { expect(pick('u1')).toBe(10); expect(pick('u6')).toBe(14) })
  it('② 중개 좌석은 내 가게가 아니다', () => { expect(pick('u2')).toBeNull() })
  it('③ 대기·정지·회수 좌석은 안 뜬다', () => { expect(pick('u3')).toBeNull(); expect(pick('u4')).toBeNull(); expect(pick('u7')).toBeNull() })
  it('④ 연결 계정 매장이 먼저', () => { expect(pick('u5')).toBe(15) })
})

describe('⑤ 배선', () => {
  it('유어샵 공개 조회·내 통계 조회가 같은 조각을 쓴다', () => {
    const src = readFileSync('src/worker/routes/curator.routes.ts', 'utf8')
    expect(src.match(/FROM sellers s WHERE \$\{OWNED_STORE_WHERE_SQL\} LIMIT 1`\)\.bind\(userId, userId, userId\)/g)?.length).toBe(2)
  })
})
