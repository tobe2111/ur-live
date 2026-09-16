/**
 * 🧾 **같은 사업자번호로 두 번째 매장이 등록되는가** (2026-09-16 — 대표 신고 `POST /api/seller/stores` 500)
 *
 * ## 무엇이 깨져 있었나 (라이브 실측)
 * 프로덕션 `sellers` 의 컬럼 선언이 `business_number TEXT UNIQUE` 라 **한 사업자번호 = 셀러 행 하나**다.
 * 한 사업자가 지점을 여럿 내는 게 정상인데 스키마가 막았고, 그래서
 * **2026-08-26 이후 매장이 한 곳도 등록되지 못했다**(라이브 `sellers` 행이 id=14 하나뿐,
 * 그 행이 `4790902930` 을 쥐고 있었다). INSERT 가 던지면 바깥 catch 가
 * "매장 등록 중 오류가 발생했습니다" 로 뭉개서 **화면에 원인이 한 글자도 안 남았다.**
 *
 * ⚠️ 2026-09-02 의 `email=''` 사고와 **같은 클래스**다(같은 파일·같은 INSERT·같은 문구).
 * 그래서 이 시험은 문자열이 아니라 **진짜 SQLite 에 같은 제약을 걸고 INSERT 를 돌린다** —
 * 그게 아니면 "제약이 실제로 어떻게 터지는가" 를 영영 못 잰다.
 *
 * ## 이 시험이 **못** 하는 것
 * 라우트 핸들러 전체(인증·업로드·국세청)는 워커 런타임이라 여기서 못 돈다 →
 * INSERT 전략과 읽기 폴백만 잰다. 배선은 아래 ③ 이 소스로 고정한다.
 */
import { describe, it, expect } from 'vitest'
// node:sqlite 는 vite 가 번들 못 한다 — 계산된 specifier + @vite-ignore 로 런타임 로드(레포 관례).
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    exec: (sql: string) => void
    close: () => void
    prepare: (sql: string) => { run: (...a: unknown[]) => unknown; get: (...a: unknown[]) => unknown }
  }
}
type Db = InstanceType<typeof DatabaseSync>
import { readCode } from '../helpers/source-text'
import { normalizeBno } from '@/worker/utils/seller-business-number'

/** 라이브 `sellers` 의 제약을 그대로 옮긴 최소 표 (문제가 되는 네 줄). */
function db(): Db {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    business_number TEXT UNIQUE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended'))
  )`)
  return d
}
const insert = (d: Db, u: string, bno: string | null) =>
  d.prepare(`INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, status)
             VALUES (?, ?, '', ?, ?, ?, 'pending')`).run(u, `${u}@store.invalid`, u, u, bno)

describe('① 제약이 실제로 두 번째 매장을 막는다 (재현)', () => {
  it('같은 사업자번호를 컬럼에 두 번 넣으면 UNIQUE 로 던진다', () => {
    const d = db()
    insert(d, 'store_a', '4790902930')
    // 이게 대표 화면의 500 이다 — 여기서 던진 예외가 "매장 등록 중 오류" 로 뭉개졌다.
    expect(() => insert(d, 'store_b', '4790902930')).toThrow()
    d.close()
  })

  it('같은 번호라도 컬럼을 비우면 두 번째 매장이 등록된다 (수정 전략)', () => {
    const d = db()
    insert(d, 'store_a', '4790902930')
    expect(() => insert(d, 'store_b', null)).not.toThrow()
    const n = d.prepare('SELECT COUNT(*) c FROM sellers').get() as { c: number }
    expect(n.c).toBe(2)
    d.close()
  })

  it('다른 번호는 종전대로 컬럼에 들어간다 (무회귀)', () => {
    const d = db()
    insert(d, 'store_a', '4790902930')
    expect(() => insert(d, 'store_b', '1234567890')).not.toThrow()
    d.close()
  })
})

describe('② 번호 정규화', () => {
  it('하이픈 표기를 10자리로 편다', () => {
    expect(normalizeBno('479-09-02930')).toBe('4790902930')
    expect(normalizeBno(null)).toBe('')
    expect(normalizeBno(undefined)).toBe('')
  })
})

describe('③ 배선 — 쓰는 쪽과 읽는 쪽이 짝을 이룬다', () => {
  const ROUTE = readCode('src/features/seller/api/seller-stores.routes.ts')

  it('등록은 컬럼이 비어 있을 때만 번호를 넣는다', () => {
    expect(ROUTE).toMatch(/bnoColumnFree\(c\.env\.DB, bno\)/)
    expect(ROUTE).toMatch(/insertStore\(bnoFree \? bno : null\)/)
  })

  it('등록은 번호를 **항상** meta 에 남긴다 (진실은 여기)', () => {
    expect(ROUTE).toMatch(/\[BUSINESS_NUMBER_META_KEY\]: normalizeBno\(bno\)/)
  })

  it('UNIQUE 경합이면 번호를 빼고 한 번 더 — 매장은 만들어진다', () => {
    expect(ROUTE).toMatch(/bnoFree \? await insertStore\(null\)/)
  })

  it('소유권 이전 대조가 meta 폴백을 탄다 (안 그러면 영원히 "모름")', () => {
    const CLAIM = readCode('src/worker/utils/store-ownership-claims.ts')
    expect(CLAIM).toMatch(/const storeBno = await resolveBusinessNumber\(DB, seller\)/)
  })

  it('권한 연결 판정이 반환값을 읽는다 (예외가 아니라 {ok:false} 로 온다)', () => {
    // 🩸 `.then(() => true)` 였다 — grantOperator 는 예외를 삼키고 resolve 하므로 **언제나 참**이었다.
    //   그래서 "매장은 만들어졌는데 아무도 못 들어간다" 를 막으려던 분기가 실행될 수 없었다.
    expect(ROUTE).not.toMatch(/grantOperator\([^)]*\)\s*\.then\(\(\) => true\)/)
    expect(ROUTE).toMatch(/\.then\(\(r\) => !!r\?\.ok\)/)
  })

  it('grantOperator 는 실제로 던지지 않고 ok 로 알린다 (위 판정의 전제)', () => {
    // 전제가 바뀌면(던지도록 바뀌면) 위 시험이 틀린 것을 지키게 된다 — 그 짝을 여기서 고정한다.
    const OPS = readCode('src/worker/utils/seller-operators.ts')
    expect(OPS).toMatch(/return \{ ok: false, reason: 'db' \}/)
  })

  it('어드민 승인 화면이 meta 폴백을 탄다 (안 그러면 심사 칸이 빈다)', () => {
    const ADMIN = readCode('src/worker/routes/internal-admin-tools.routes.ts')
    // 목록(심사 큐)과 재검증 둘 다 — 하나만 타면 그 화면만 조용히 빈칸이 된다.
    expect(ADMIN.match(/patchBusinessNumbers\(c\.env\.DB/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})
