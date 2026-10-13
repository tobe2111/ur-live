/**
 * 🛍️ **sitemap 이 사업자 아닌 유저의 유어샵도 제출한다** (2026-10-11 — 대표 *"또 개선할 부분은?"*)
 *
 * ## 실측 배경 (추측 아님)
 * 라이브 D1 에서 **핀이 있는 유어샵은 4곳**이었다:
 *   `jiwon1228`(6핀) · `jongmun`(2핀) · `user31`(1핀) · `user40`(1핀)
 * 그런데 `sitemap.xml` 이 `/u/` 로 내보낸 것은 **`user40` 하나**였다 — 그 하나만 승인 셀러가
 * 연결돼 있어서다. **3곳이 색인 요청에서 통째로 빠졌고**, 그중엔 핀이 가장 많은 유어샵이 있었다.
 *
 * 원인은 조건이 아니라 **쿼리의 출발점**이다: 그 블록은 `FROM sellers` 로 시작한다. 그런데
 * 명칭 SSOT 는 *"유저 = 회원가입한 누구나. **유어샵(`/u/{handle}`) 자동 생성**"* 이라고 정의한다
 * ⇒ 셀러에서 출발하는 쿼리는 **구조적으로** 사업자 아닌 유어샵에 닿을 수 없다(셀러 행이 없다).
 * 에러가 날 자리가 아니므로 아무도 신고할 수 없다.
 *
 * ## 규칙
 * ① 콘텐츠 기준은 **핀 1개 이상** — 이름 패턴으로 거르지 않는다(기존 블록과 같은 이유).
 * ② 그 기준은 워커 첫 화면 빌더와 **짝이다**: `buildCuratorFirstScreen` 이 `pins.length === 0`
 *    이면 `''` 를 돌려주므로, 핀 0 을 제출하면 크롤러가 받는 것은 로더뿐이다(= soft-404).
 * ③ **같은 URL 을 두 번 적지 않는다** — 승인 셀러가 연결된 유어샵은 앞 블록이 이미 내보냈다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 핸들 없는 유저(제출할 URL 자체가 없다) · 핀이 *몰* 상품인 경우(그건 유어샵 기능 자체의 문제이고
 *   `/u/{handle}` 은 유어딜 본진 표면이다).
 * - 구글·네이버가 실제로 색인하는지(서치콘솔 — 대표만 본다).
 * - D1 과 node:sqlite 의 차이.
 */
import { describe, it, expect } from 'vitest'
import { consumerVisibleProductSql } from '@/shared/db/consumer-visible-product'
import { createRequire } from 'module'
import { readCode, stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const src = readCode(SITEMAP)
const code = stripComments(src)

/**
 * 프로덕션 SQL 문자열을 **소스에서 그대로** 뽑는다(베껴 쓰면 두 벌이 갈린다).
 * `${sellerScope}` 같은 보간은 빈 문자열로 — `mall_id` 컬럼 부재 시의 값이고,
 * consumer-scope 가 "구조적으로 안전한 폴백" 이라고 명시한 경우다.
 */
function sqlOf(varName: string): string {
  const i = src.indexOf(`const ${varName} = await DB.prepare(`)
  expect(i, `${varName} 쿼리를 소스에서 못 찾았다 — 이 시험의 앵커가 낡았다`).toBeGreaterThan(-1)
  const open = src.indexOf('`', i)
  const close = src.indexOf('`', open + 1)
  expect(close).toBeGreaterThan(open)
  // 🩸 2026-10-12 — 쿼리가 `${consumerVisibleProductSql('pq')}`(SSOT 호출)를 품게 됐다.
  //   일반 `${...}` 제거로 그걸 지우면 `AND )` 가 되어 **SQL 이 깨진다**(실제로 터졌다).
  //   그 호출만 **실제 술어로 치환**한 뒤 나머지(스코프 등)를 지운다.
  return src.slice(open + 1, close)
    .replace(/\$\{consumerVisibleProductSql\('pq'\)\}/g, consumerVisibleProductSql('pq'))
    .replace(/\$\{[^}]*\}/g, '')
}

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, handle TEXT)`)
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, username TEXT, status TEXT, linked_user_id INTEGER)`)
  // 🔁 2026-10-12 — 제출 기준이 "핀 **행** 존재" → "**보이는** 핀 존재"(활성 + 소비자 노출)로
  //   좁혀져 픽스처가 `product_id` 와 도매 컬럼을 갖는다. 불변식(핀 ≥ 1 만 제출)은 그대로이고,
  //   **왜 좁혔나**: 라이브 Googlebot 실측에서 `/u/user31`·`/u/jongmun` 이 핀 행을 가진 채 본문
  //   6자였다(담은 상품이 비활성·도매 원본) — 이 시험이 지키려던 soft-404 방지가 그 틈으로 샜다.
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, is_active INTEGER,
    is_supply_product INTEGER, supply_source_id INTEGER)`)
  db.exec(`CREATE TABLE product_pins (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, product_id INTEGER)`)

  // 라이브 모양 그대로: 핀 있는 유어샵 4곳, 그중 하나만 승인 셀러 연결.
  db.exec(`INSERT INTO users VALUES
    (3, 'jiwon1228'), (24, 'jongmun'), (31, 'user31'), (40, 'user40'),
    (50, 'nopins'),            -- 핀 0 → 제출 금지(첫 화면이 '' 를 돌려준다)
    (51, ''), (52, NULL)       -- 핸들 없음 → 제출할 URL 자체가 없다`)
  // 담긴 상품 — 보이는 것(100) 하나로 전원이 기준을 통과한다(종전 픽스처와 같은 결과).
  db.exec(`INSERT INTO products VALUES (100, NULL, 1, 0, NULL)`)
  db.exec(`INSERT INTO product_pins (user_id, product_id) VALUES
    (3,100),(3,100),(3,100),(3,100),(3,100),(3,100),(24,100),(24,100),(31,100),(40,100),(51,100),(52,100)`)
  // 40 만 승인 셀러 연결(= 기존 블록이 이미 /u/user40 을 내보낸다)
  db.exec(`INSERT INTO sellers VALUES (24, 'user_40', 'approved', 40)`)
  // 핸들 없는 승인 셀러(상품 보유) → /s/{username}
  db.exec(`INSERT INTO sellers VALUES (14, 'store_mt9rvbhg1i6', 'approved', NULL)`)
  db.exec(`INSERT INTO products VALUES (1, 14, 1, 0, NULL)`)
  return db
}

describe('① 회귀 — 셀러에서 출발하는 쿼리는 사업자 아닌 유어샵에 못 닿는다', () => {
  it('기존 쿼리만으로는 `user40` 하나뿐이다 (이 시험의 존재 이유)', () => {
    const db = fresh()
    const rows = db.prepare(sqlOf('sellers')).all() as Array<{ handle: string | null }>
    const handles = rows.map(r => r.handle).filter(Boolean)
    expect(handles).toEqual(['user40'])
  })
})

describe('② 새 쿼리 — 핀 있는 유어샵을 전부 집는다', () => {
  it('핀 ≥ 1 인 핸들 전부, 핀 0·빈 핸들은 제외', () => {
    const db = fresh()
    const rows = db.prepare(sqlOf('shopUsers')).all() as Array<{ handle: string }>
    expect(rows.map(r => r.handle).sort()).toEqual(['jiwon1228', 'jongmun', 'user31', 'user40'])
  })

  it('핀을 다 떼면 0건 — 기준이 정말 핀이다(늘 통과하는 쿼리가 아니다)', () => {
    const db = fresh()
    db.exec('DELETE FROM product_pins')
    expect(db.prepare(sqlOf('shopUsers')).all()).toEqual([])
  })

  it('핸들만 있고 핀이 없는 유저는 절대 안 나온다 (soft-404 방지)', () => {
    const db = fresh()
    const rows = db.prepare(sqlOf('shopUsers')).all() as Array<{ handle: string }>
    expect(rows.map(r => r.handle)).not.toContain('nopins')
  })

  // 🩸 2026-10-12 — 이 둘이 원래 틈이었다. 핀 행은 있는데 **보이지 않는** 상품이면 API 의
  //   `pins` 가 0 이라 첫 화면이 `''` 를 돌려주고 크롤러는 로더만 받는다(라이브 실측 6자).
  it('담은 상품이 **비활성**이면 제외 — "핀이 있다 ≠ 핀이 보인다"', () => {
    const db = fresh()
    db.exec('UPDATE products SET is_active = 0 WHERE id = 100')
    expect(db.prepare(sqlOf('shopUsers')).all()).toEqual([])
  })

  it('담은 상품이 **도매 원본**이면 제외 — `/u/jongmun` 이 그 경우였다', () => {
    const db = fresh()
    db.exec('UPDATE products SET is_supply_product = 1, supply_source_id = NULL WHERE id = 100')
    expect(db.prepare(sqlOf('shopUsers')).all()).toEqual([])
  })

  it('판매사 **재판매 복제본**은 보인다 — 반대 방향(멀쩡한 유어샵이 빠지면 더 나쁘다)', () => {
    const db = fresh()
    db.exec('UPDATE products SET is_supply_product = 1, supply_source_id = 6 WHERE id = 100')
    const rows = db.prepare(sqlOf('shopUsers')).all() as Array<{ handle: string }>
    expect(rows.map(r => r.handle).sort()).toEqual(['jiwon1228', 'jongmun', 'user31', 'user40'])
  })
})

describe('③ 배선 — 중복 없이 실제로 urls 에 들어간다', () => {
  // 🩸 거리(`[\s\S]{0,N}`)로 앵커를 잡지 않는다 — 사이에 주석 한 줄만 들어가도 빨간불이 나고,
  //   그건 이 레포가 2026-10-08 에 이미 치른 값이다. **블록을 잘라서** 각 루프 안을 본다.
  function loopBody(header: string): string {
    const i = code.indexOf(header)
    expect(i, `루프 앵커가 낡았다: ${header}`).toBeGreaterThan(-1)
    const end = code.indexOf('\n      }', i)
    expect(end).toBeGreaterThan(i)
    return code.slice(i, end)
  }

  it('셀러 블록이 내보낸 URL 을 기록한다', () => {
    expect(code).toMatch(/const\s+emittedShopLocs\s*=\s*new Set<string>\(\)/)
    expect(loopBody('for (const s of sellers.results')).toMatch(/emittedShopLocs\.add\(loc\)/)
  })

  it('유저 블록이 그 기록을 확인한다 (한쪽만 있으면 같은 URL 이 두 번 나간다)', () => {
    const body = loopBody('for (const u of shopUsers.results')
    expect(body).toMatch(/if\s*\(emittedShopLocs\.has\(loc\)\)\s*continue/)
    expect(body).toMatch(/emittedShopLocs\.add\(loc\)/)
  })

  it('유저 유어샵이 `/u/{handle}` 로 urls 에 push 된다', () => {
    expect(code).toMatch(
      /for\s*\(const u of shopUsers\.results[\s\S]{0,300}urls\.push\(\{\s*loc\s*,/,
    )
    expect(code).toMatch(/const\s+loc\s*=\s*`\/u\/\$\{u\.handle\}`/)
  })

  it('`product_pins` lazy CREATE 내성 — 실패해도 뒤 블록이 죽지 않는다', () => {
    expect(code).toMatch(/shopUsers[\s\S]{0,600}\.catch\(\(\)\s*=>\s*\(\{\s*results:/)
  })
})

describe('④ 짝 불변식 — 제출 기준이 첫 화면 빌더와 같다', () => {
  it('첫 화면 빌더는 핀 0 이면 아무것도 안 그린다 (그래서 핀 0 을 제출하면 안 된다)', () => {
    const builder = stripComments(readCode('src/worker/utils/curator-ssr-body.ts'))
    expect(builder).toMatch(/if\s*\(pins\.length === 0\)\s*return\s*''/)
  })

  it('sitemap 의 유저 쿼리가 그 기준(핀 EXISTS)을 쓴다', () => {
    expect(sqlOf('shopUsers')).toMatch(/EXISTS\s*\(\s*SELECT 1 FROM product_pins/i)
  })
})
