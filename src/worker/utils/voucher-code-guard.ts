/**
 * 🔢 이용권 코드 6자리 숫자 — **짧아진 만큼 대입을 막는다** (2026-10-12 대표 *"6자리로 줄이고 숫자로만."*)
 *
 * 이 코드는 번호가 아니라 **열쇠**다. 사용 처리(`POST /:code/use`)는 로그인을 요구하지 않고
 * [코드 + 매장 확인코드] 만 받는데, 매장 확인코드는 카운터에 붙어 있다(사실상 공개).
 * 종전 `UR-XXXX-XXXX` 는 1조 가지라 대 보는 것이 불가능했지만 6자리 숫자는 **100만 가지**다.
 *
 * 그래서 **틀린 시도만** 센다(요청 수를 세면 정상 화면이 깨진다 — 손님 QR 화면이 5초마다 조회한다):
 *   ① 조회 `GET /verify/:code` — 없는 번호를 IP 당 10분 20번 넘게 물으면 잠근다(번호 찾기 막기)
 *   ② 같은 조회의 없는 번호를 **전체 합쳐** 1시간 300번 넘으면 잠근다(IP 를 바꿔 가며 찾는 것 막기)
 *   ③ 사용 `POST /:code/use` — 같은 매장 확인코드로 1시간 30번 넘게 틀리면 그 확인코드를 잠근다
 *      (IP 당 분 5회 제한은 그대로 — 이건 IP 를 바꿔도 **매장 단위로** 막는다)
 *
 * ⚠️ 못 막는 것: ②의 한도 안에서 오래 찾는 것(시간당 300 = 하루 7,200번, 100만 칸 중 쓸 수 있는
 *   번호가 N 장이면 하루 약 7,200×N/1,000,000 장이 발견된다). 발견해도 쓰려면 그 매장 카운터의
 *   확인코드가 필요하고, 시도는 전부 `voucher_use_logs` 에 남는다. 8자리로 되돌리면 이 위험은 0 이다.
 * ⚠️ 저장소 오류면 **막는 쪽**이 아니라 **통과**시킨다 — 조회·사용은 손님이 카운터에 서 있는 순간이다.
 *   대입 방어는 정상 상태에서만 일한다(IP 당 분 5회 미들웨어는 별도로 남아 있다).
 */
import type { Context } from 'hono'

const TABLE = 'rate_limit_attempts' // rateLimit() 미들웨어와 같은 표·같은 행 모양

export const LOOKUP_MISS_PER_IP = { max: 20, windowSec: 600 }
export const LOOKUP_MISS_GLOBAL = { max: 300, windowSec: 3600 }
export const USE_FAIL_PER_SECRET = { max: 30, windowSec: 3600 }

function ipOf(c: Context): string {
  return c.req.header('CF-Connecting-IP') || 'unknown'
}

function windowStart(windowSec: number): number {
  const now = Math.floor(Date.now() / 1000)
  return now - (now % windowSec)
}

/** 매장 확인코드는 그대로 저장하지 않는다(표를 본 사람이 비밀을 읽지 않게). */
async function hashSecret(secret: string, salt: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${secret}`))
  return Array.from(new Uint8Array(d)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function countOf(DB: D1Database, key: string, action: string, windowSec: number): Promise<number> {
  const row = await DB.prepare(`SELECT count FROM ${TABLE} WHERE key = ? AND action = ? AND window_start = ?`)
    .bind(key, action, windowStart(windowSec)).first<{ count: number }>()
  return Number(row?.count) || 0
}

async function bump(DB: D1Database, key: string, action: string, windowSec: number): Promise<void> {
  await DB.prepare(`
    INSERT INTO ${TABLE} (key, action, window_start, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(key, action, window_start) DO UPDATE SET count = count + 1
  `).bind(key, action, windowStart(windowSec)).run()
}

/** 조회를 잠가야 하나 — 이 IP 의 '없는 번호' 가 많거나, 전체 '없는 번호' 가 많으면. */
export async function lookupLocked(c: Context, DB: D1Database): Promise<boolean> {
  try {
    const [mine, all] = await Promise.all([
      countOf(DB, `ip:${ipOf(c)}`, 'voucher_lookup_miss', LOOKUP_MISS_PER_IP.windowSec),
      countOf(DB, 'all', 'voucher_lookup_miss_all', LOOKUP_MISS_GLOBAL.windowSec),
    ])
    return mine >= LOOKUP_MISS_PER_IP.max || all >= LOOKUP_MISS_GLOBAL.max
  } catch { return false }
}

export async function recordLookupMiss(c: Context, DB: D1Database): Promise<void> {
  try {
    await Promise.all([
      bump(DB, `ip:${ipOf(c)}`, 'voucher_lookup_miss', LOOKUP_MISS_PER_IP.windowSec),
      bump(DB, 'all', 'voucher_lookup_miss_all', LOOKUP_MISS_GLOBAL.windowSec),
    ])
  } catch { /* best-effort */ }
}

/** 이 매장 확인코드(또는 상품 PIN)로 틀린 시도가 너무 많았나. */
export async function useSecretLocked(DB: D1Database, secret: string, salt: string): Promise<boolean> {
  try {
    const key = `secret:${await hashSecret(secret, salt)}`
    return (await countOf(DB, key, 'voucher_use_fail', USE_FAIL_PER_SECRET.windowSec)) >= USE_FAIL_PER_SECRET.max
  } catch { return false }
}

export async function recordUseFail(DB: D1Database, secret: string, salt: string): Promise<void> {
  try {
    await bump(DB, `secret:${await hashSecret(secret, salt)}`, 'voucher_use_fail', USE_FAIL_PER_SECRET.windowSec)
  } catch { /* best-effort */ }
}
