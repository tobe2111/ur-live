/**
 * 🎁 2026-10-31 교환권 사진 — 원본 직행 + R2 이관 가드.
 *
 * 대표 *"교환권 사진 안나오는거 많던데 영구적으로 문제 해결해줄래?"* → 승인 *"원본 바로 보기 + 우리 저장소로 옮기기"*.
 * 라이브 실측: 활성 교환권 2,260장 전부 `bizimg.giftishow.com` · 리사이저 30장 중 25장 실패(429 err=9422 · 524 err=9504).
 *
 * 이 시험이 고정하는 것:
 *   ① giftishow 원본은 리사이저·프록시를 타지 않고 그대로 나간다(srcset 도 없음).
 *   ② 이관 cron: 대상은 활성 교환권의 giftishow 사진뿐 · 많이 팔린 것부터 · 기다리는 중은 건너뜀(진짜 SQLite).
 *   ③ 실패는 포기하지 않고 뒤로 미룬다(지수 · 하루 상한) · 성공은 CAS 로만 덮는다 · 바인딩 없으면 침묵하지 않는다.
 *   ④ 배선 — 매시 :55 슬롯.
 * ⚠️ 못 보는 것: giftishow 가 Cloudflare 워커의 fetch 를 실제로 받아 주는지(라이브 하트비트 `migrated=` 로 판정) ·
 *   손님 브라우저가 원본을 받는지(실기기).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { cfImage, cfSrcSet, isRawOnlyImageHost } from '@/utils/cf-image'
import {
  VOUCHER_REHOST_CANDIDATE_SQL, voucherRehostBackoffMs, handleVoucherImageRehost,
} from '../../worker/cron/voucher-image-rehost'

const req = createRequire(import.meta.url)
const { DatabaseSync } = req('node:sqlite') as typeof import('node:sqlite')

const SRC = readFileSync('src/worker/cron/voucher-image-rehost.ts', 'utf8')
const SCHED = readFileSync('src/worker/scheduled.ts', 'utf8')

describe('① giftishow 원본 직행', () => {
  const u = 'https://bizimg.giftishow.com/Resource/goods/2023/G1/G1.jpg'
  it('cfImage 가 원본을 그대로 돌려준다', () => {
    expect(cfImage(u, { width: 400 })).toBe(u)
    expect(cfImage(u, { width: 800, format: 'auto' })).toBe(u)
  })
  it('srcset 은 비운다(후보가 하나뿐)', () => expect(cfSrcSet(u, 400)).toBe(''))
  it('서브도메인 전부 · 다른 호스트는 아니다', () => {
    expect(isRawOnlyImageHost('bizimg.giftishow.com')).toBe(true)
    expect(isRawOnlyImageHost('giftishow.com')).toBe(true)
    expect(isRawOnlyImageHost('notgiftishow.com')).toBe(false)
    expect(isRawOnlyImageHost('ldb-phinf.pstatic.net')).toBe(false)
  })
  it('옮겨진 사진(/api/media)은 다시 리사이저를 탄다', () => {
    expect(cfImage('/api/media/uploads/voucher/h/a.jpg', { width: 400 })).toContain('/cdn-cgi/image/')
  })
})

function db() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, deal_only INTEGER, is_active INTEGER, image_url TEXT, sold_count INTEGER, updated_at TEXT);
          CREATE TABLE product_supply_meta (product_id INTEGER, key TEXT, value TEXT, PRIMARY KEY (product_id, key));`)
  const ins = d.prepare('INSERT INTO products (id, deal_only, is_active, image_url, sold_count) VALUES (?,?,?,?,?)')
  ins.run(1, 1, 1, 'https://bizimg.giftishow.com/a.jpg', 5)
  ins.run(2, 1, 1, 'https://bizimg.giftishow.com/b.jpg', 50)
  ins.run(3, 1, 0, 'https://bizimg.giftishow.com/c.jpg', 999) // 비활성
  ins.run(4, 0, 1, 'https://bizimg.giftishow.com/d.jpg', 999) // 교환권 아님
  ins.run(5, 1, 1, '/api/media/uploads/voucher/h/e.jpg', 999) // 이미 옮김
  ins.run(6, 1, 1, 'https://bizimg.giftishow.com/f.jpg', 100) // 기다리는 중
  ins.run(7, 1, 1, 'https://evil.com/giftishow.com/x.jpg', 100) // 경로에만 이름이 든 다른 호스트
  d.prepare('INSERT INTO product_supply_meta VALUES (?,?,?)').run(6, 'voucher_img_retry_after', '2999-01-01T00:00:00.000Z')
  return d
}

describe('② 이관 대상 SQL (진짜 SQLite)', () => {
  it('활성 교환권의 giftishow 사진만 · 많이 팔린 순 · 기다리는 중 제외', () => {
    const d = db()
    const rows = d.prepare(VOUCHER_REHOST_CANDIDATE_SQL).all(new Date().toISOString(), 10) as { id: number }[]
    expect(rows.map((r) => r.id)).toEqual([2, 1])
  })
  it('기다림이 끝나면 다시 대상', () => {
    const d = db()
    const rows = d.prepare(VOUCHER_REHOST_CANDIDATE_SQL).all('3000-01-01T00:00:00.000Z', 10) as { id: number }[]
    expect(rows.map((r) => r.id)).toEqual([6, 2, 1])
  })
})

describe('③ 실패·성공 처리', () => {
  it('뒤로 미루기는 30분부터 두 배씩, 하루에서 멈춘다', () => {
    expect(voucherRehostBackoffMs(0)).toBe(30 * 60 * 1000)
    expect(voucherRehostBackoffMs(1)).toBe(60 * 60 * 1000)
    expect(voucherRehostBackoffMs(30)).toBe(24 * 60 * 60 * 1000)
  })
  it('포기 표식이 없다 — 막힌 날이 지나면 저절로 수렴해야 한다', () => {
    expect(SRC).not.toMatch(/voucher_img_done|giveUp|MAX_TRIES/)
  })
  it('성공은 CAS 로만 덮는다(그 사이 바뀐 주소는 그대로)', () => {
    expect(SRC).toMatch(/UPDATE products SET image_url = \?, updated_at = datetime\('now'\) WHERE id = \? AND image_url = \?/)
  })
  it('사진을 지우지 않는다(비파괴)', () => {
    expect(SRC).not.toMatch(/image_url\s*=\s*NULL|DELETE FROM products/)
  })
  it('바인딩이 없으면 할 일 없음과 구분해 남긴다', async () => {
    const out = await handleVoucherImageRehost({ DB: {} } as never)
    expect(out).toBe('skipped=NO_MEDIA_BUCKET')
  })
  it('한 장씩 차례로 받는다(몰아서 받으면 429)', () => {
    expect(SRC).not.toMatch(/Promise\.all\(\s*rows/)
  })
})

describe('④ 배선', () => {
  it('매시 :55 슬롯에 safeCron 으로 걸려 있다', () => {
    expect(SCHED).toMatch(/slotOpen\(\{ minute: 55 \}\)\) ctx\.waitUntil\(slotCron\('55 \* \* \* \*'\)\('voucher-image-rehost'/)
  })
})
