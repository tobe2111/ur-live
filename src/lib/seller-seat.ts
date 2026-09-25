/**
 * 🪑 좌석(seat) — "지금 어느 가게로 일하고 있는가" 의 클라이언트 단일 진실 (2026-09-25)
 *   설계 SSOT: `docs/design/seller-in-consumer-app-2026-09.md` §15-3
 *
 * ## 왜 이 파일이 생겼나
 * 좌석 토큰은 **JWT 안에 `seller_id` 가 박혀 있다**. 그래서 가게를 바꾸면 토큰이 통째로 바뀐다.
 * 종전엔 전환이 곧 화면 교체였다 — 셀러 대시보드의 `switchStore` 는 전환 후 **하드 리로드**를 하고,
 * 그 주석이 이유를 정확히 적어 뒀다: *"대시보드 전역이 옛 매장 데이터를 캐싱하고 있어 부분 갱신은
 * 반드시 새어 나온다."*
 *
 * 그런데 판매 작업을 **마이 안 인라인**으로 옮기면 리로드를 할 수 없다(그러면 인라인이 아니다).
 * 리로드가 하던 일을 이 모듈이 대신해야 한다. 안 하면 이런 틈이 생긴다:
 *
 *     가게 A 의 주문 목록을 펼쳐 둔 채 → [가게 전환] 으로 B → 화면에 남은 A 의 행에서 [확인]
 *
 * 서버는 토큰으로 스코프하므로 **남의 주문이 확정되지는 않는다**(그건 막힌다). 문제는 그 반대다 —
 * 사장님이 A 를 처리했다고 믿는데 아무 일도 안 일어나거나, id 가 겹치는 자원에서 B 의 무언가가 움직인다.
 *
 * ## 규칙 셋 (화면이 지켜야 하는 것)
 *   ① 전환하면 **세대(generation)가 오른다** — 구독자는 열린 시트를 닫고 목록을 다시 부른다.
 *   ② 요청 직전 `assertSeat(화면이 들고 있던 sellerId)` — 다르면 **보내지 않는다**.
 *   ③ `seller_id` 를 URL·localStorage 에서 읽어 **API 인자로 넘기지 않는다.** 권한 근거는 토큰뿐이다.
 *
 * ⚠️ ③ 과 이 파일이 토큰을 디코드하는 것은 다르다. 여기서 읽는 값은 **서버로 보내지 않는다** —
 *   "내 토큰이 어느 좌석인가" 를 *비교*할 뿐이고, 권한 판정은 언제나 서버(`canOperateStore`)가 한다.
 *
 * ## 토큰 발급은 여기서 하지 않는다
 * mint 는 `enterStoreSeat`(`@/utils/enter-store`) 하나다. 손으로 두 번 쓰면 반드시 갈린다 —
 * 이 레포가 이미 겪은 클래스다. 이 모듈은 그 함수를 부르고 **세대만 올린다**.
 *
 * ⚠️ 그 함수는 **동적으로** 가져온다. `enter-store` 는 `app-utils-deferred`(첫 페인트 밖) 청크에
 *   있는데 이 파일은 `app-utils`(첫 페인트 안)에 떨어진다 — 정적으로 잇는 순간 그 청크가 통째로
 *   홈 첫 페인트로 끌려온다(`check-critical-chunks` 가 실제로 이 커밋에서 잡았다).
 */

export const SEAT_TOKEN_KEY = 'seller_token'

/** 토큰이 가리키는 좌석. 토큰이 없거나 못 읽으면 null(= 아직 어느 가게로도 일하고 있지 않다). */
export function currentSeatId(): number | null {
  try {
    const token = localStorage.getItem(SEAT_TOKEN_KEY)
    if (!token) return null
    const seg = token.split('.')[1]
    if (!seg) return null
    // base64url → base64. 패딩이 없을 수 있어 직접 채운다(atob 는 길이가 안 맞으면 던진다).
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(seg.length / 4) * 4, '=')
    const bin = atob(b64)
    // ⚠️ atob 은 latin1 바이트를 준다. 매장 이름이 한글이라 그대로 JSON.parse 하면 깨진다.
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))
    const id = Number((JSON.parse(json) as { seller_id?: unknown }).seller_id)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * 지금 좌석의 **표시 이름**. 소각처럼 되돌릴 수 없는 화면이 "어느 가게로 처리되는가" 를 말할 때 쓴다.
 * 마이가 보여 준 이름(`seller_name`)을 먼저 쓰고, 없으면 토큰 안의 이름으로 떨어진다.
 * ⚠️ 표시 전용이다 — 권한도 대상도 이 값으로 정하지 않는다(서버가 토큰으로 정한다).
 */
export function currentSeatLabel(): string | null {
  try {
    const saved = localStorage.getItem('seller_name')
    if (saved && saved.trim()) return saved.trim()
  } catch { /* storage 접근 불가 */ }
  try {
    const token = localStorage.getItem(SEAT_TOKEN_KEY)
    if (!token) return null
    const seg = token.split('.')[1]
    if (!seg) return null
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(seg.length / 4) * 4, '=')
    const bin = atob(b64)
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))
    const name = (JSON.parse(json) as { name?: unknown }).name
    return typeof name === 'string' && name.trim() ? name.trim() : null
  } catch {
    return null
  }
}

/** 화면이 들고 있던 좌석과 지금 토큰의 좌석이 다르면 던진다 — 호출부는 **보내지 말고** 다시 불러야 한다. */
export class SeatMismatchError extends Error {
  readonly expected: number
  readonly actual: number | null
  constructor(expected: number, actual: number | null) {
    super('SEAT_MISMATCH')
    this.name = 'SeatMismatchError'
    this.expected = expected
    this.actual = actual
  }
}

export function assertSeat(expected: number): void {
  const actual = currentSeatId()
  if (actual !== expected) throw new SeatMismatchError(expected, actual)
}

// ── 세대 ──────────────────────────────────────────────────────────────────
let generation = 0
const listeners = new Set<() => void>()

/** 지금 세대. 화면이 데이터를 불러온 시점의 값을 들고 있다가 달라지면 그 데이터는 옛 가게 것이다. */
export function seatGeneration(): number {
  return generation
}

export function onSeatChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** 테스트·비정상 복구용. 일반 코드는 `switchSeat` 만 쓴다. */
export function bumpSeatGeneration(): void {
  generation += 1
  for (const fn of [...listeners]) {
    try { fn() } catch { /* 한 구독자의 실패가 나머지를 막지 않는다 */ }
  }
}

/**
 * 가게 전환. 성공하면 세대가 올라 **모든 구독자가 자기 상태를 버린다**.
 * 경로의 `sellerId` 는 '요청'일 뿐이다 — 권한은 서버가 판정하고, 실패하면 토큰이 안 바뀐다.
 */
export async function switchSeat(sellerId: number, label?: string): Promise<boolean> {
  // ⚠️ 상대경로다 — `@/` alias 는 **정적** import 에서만 빌드 시 풀린다(CLAUDE.md 워커 룰, pre-commit 가 막는다).
  const { enterStoreSeat } = await import('../utils/enter-store')
  const ok = await enterStoreSeat(sellerId)
  if (!ok) return false
  if (label) { try { localStorage.setItem('seller_name', label) } catch { /* storage 접근 불가 */ } }
  bumpSeatGeneration()
  return true
}
