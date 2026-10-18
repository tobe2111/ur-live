/**
 * 🛡️ 2026-05-22: localStorage cache 유틸 — query 의 initialData 용.
 *   페이지 진입 즉시 last-known value 표시 (0ms) → background 에서 real fetch + 갱신.
 *
 * 룰:
 *   - 모든 키는 'urq:' prefix (ur Query) — 다른 앱 localStorage 와 충돌 방지
 *   - JSON 직렬화. parse 실패 시 fallback 반환
 *   - localStorage 미지원 (Safari private mode 등) graceful → 항상 fallback
 */

const PREFIX = 'urq:'
const TS_SUFFIX = '__ts'

/** 30일 이상 안 read 된 entry 자동 삭제 (TTL). */
const AUTO_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * 🔐 2026-10-18 — **이 캐시에는 주인이 있다.**
 *
 * 내 이용권·배송지·잔액·쿠폰·알림·예약이 여기에 남는데, 키에 사람이 없었고 지우는 곳도 없었다
 * (`clearAllUserCache` 는 정의만 있고 호출 0). 그래서 같은 폰에서 A 가 로그아웃하고 B 가 들어오면
 * **B 의 첫 화면이 A 의 배송지·이용권으로 먼저 그려졌다**(initialData). 서버 응답이 실패하면
 * `cacheOrRethrow` 가 그 값을 계속 돌려줘 **A 의 데이터가 그대로 남았다.**
 *
 * ⇒ 마지막으로 쓴 사람을 한 칸(`urq:__owner`)에 적고, 지금 로그인한 사람이 다르면 개인 항목을
 *   **읽기 전에** 통째로 지운다. 로그아웃(주인 '')도 다른 사람으로 친다.
 *   ⚠️ 키마다 사람을 붙이는 대신 이렇게 한 이유: 호출하는 훅이 열 곳이 넘는다. 한 곳이라도
 *     붙이는 걸 빠뜨리면 그 데이터만 조용히 샌다. 여기서 막으면 새 훅도 자동으로 막힌다.
 *   🌐 공개 데이터(상품·셀러 공개 화면)는 사람과 무관하니 남긴다 — `PUBLIC_PREFIXES`.
 */
const OWNER_KEY = PREFIX + '__owner'
const PUBLIC_PREFIXES = ['seller:', 'product:', 'gb:']

function isPublicKey(key: string): boolean {
  return PUBLIC_PREFIXES.some(p => key.startsWith(p))
}

/** 지금 로그인한 사람. 소비자 → 사장님 순(유저 키가 없는 사장님 전용 계정도 주인이 있다). 없으면 ''. */
function currentOwner(): string {
  try {
    return localStorage.getItem('user_id') || localStorage.getItem('userId') || localStorage.getItem('seller_id') || ''
  } catch { return '' }
}

/** 주인이 바뀌었으면 개인 항목을 지우고 새 주인을 적는다. 같으면 getItem 두 번으로 끝난다. */
function ensureOwner(): void {
  try {
    const now = currentOwner()
    if (localStorage.getItem(OWNER_KEY) === now) return
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(PREFIX) || k === OWNER_KEY) continue
      if (isPublicKey(k.slice(PREFIX.length))) continue
      doomed.push(k)
    }
    doomed.forEach(k => { try { localStorage.removeItem(k) } catch { /* */ } })
    localStorage.setItem(OWNER_KEY, now)
  } catch { /* private mode — 읽기도 실패하므로 샐 것이 없다 */ }
}

export function readCache<T>(key: string, fallback: T): T {
  if (!isPublicKey(key)) ensureOwner()
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    // read 시점 timestamp 갱신 (LRU — 자주 사용된 entry 영구 유지).
    try { localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now())) } catch { /* */ }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * 🛡️ 2026-07-02: 캐시 존재 시 값, 부재 시 null — 에러 폴백 분기용.
 *   readCache(key, []) 는 "캐시 없음"과 "캐시된 빈 목록"을 구분 못 해, queryFn 의
 *   .catch 폴백에 쓰면 네트워크 오류가 "빈 목록"으로 위장됨(페이지 에러 UI가 dead branch 화).
 *   에러 폴백은 이 함수로: 캐시 있으면 last-known 표시, 없으면 throw → isError → 에러+재시도 UI.
 */
export function readCacheOrNull<T>(key: string): T | null {
  if (!isPublicKey(key)) ensureOwner()
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    try { localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now())) } catch { /* */ }
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * 🩸 **`initialData` 전용** — 캐시가 있을 때만 값을 준다, 없으면 `undefined`.
 *
 * ## 왜 필요한가 (2026-09-15 실측)
 * `initialData: () => readCache(key, [])` 는 캐시가 없어도 **빈 배열을 "진짜 데이터"로** 넘긴다.
 * 그러면 React Query 가 `isLoading: false` 로 보고하고, 화면은 로더 대신 **"받아둔 이용권이 없어요"**
 * 를 그린다 — 아직 안 받았을 뿐인데 없다고 단정하는 것이다. 첫 방문·새 기기·저장소 비운 사람이
 * 전부 이 거짓말을 본다. 렌더 실측: `/my-vouchers` 가 806ms 에 "없어요", 그 뒤에 진짜 결과.
 *
 * `null`/`0` 폴백도 같다 — "상품을 찾을 수 없습니다", "잔액 0" 이 먼저 뜬다.
 *
 * ⚠️ 이 함정은 2026-07-02 에 **에러 폴백 방향**으로 이미 발견돼 `readCacheOrNull` 이 생겼는데
 *    (위 주석), **로딩 방향**엔 안 붙였다. 같은 함정의 나머지 반쪽이 이 함수다.
 *
 * ⚠️ 쓰는 쪽은 `data` 가 **`undefined` 일 수 있다**는 걸 받아들여야 한다(그게 곧 "로딩 중"이다).
 *    타입이 그걸 강제하므로 tsc 가 빠진 자리를 알려 준다.
 */
export function cachedInitialData<T>(key: string): T | undefined {
  return readCacheOrNull<T>(key) ?? undefined
}

/**
 * 🩸 **`queryFn` 의 `.catch` 전용** — 캐시가 있으면 last-known 을 주고, 없으면 **원래 에러를 다시 던진다**.
 *
 * ## 왜 헬퍼로 두는가 (2026-09-15)
 * 이 패턴은 2026-07-02 에 손으로 쓰이기 시작했는데 **`if (cached)` 로 판정**하고 있었다.
 * 배열엔 맞지만 숫자엔 틀린다 — 캐시된 **`0`(장바구니 0개·안 읽은 알림 0개)이 falsy** 라
 * "캐시 없음"으로 읽혀 멀쩡한 값을 버리고 에러를 던진다. 판정은 `!== null` 이어야 하고,
 * 그 한 글자를 훅마다 다시 쓰게 두면 언젠가 또 틀린다. 그래서 한 곳에만 둔다.
 *
 * ⚠️ 던지는 것이 목적이다. `readCache(key, [])` 로 폴백하면 네트워크 오류가 **"빈 목록"으로
 *    위장**되고, 페이지가 가진 에러 UI 는 영원히 안 뜨는 죽은 가지가 된다
 *    (`WishlistPage` 의 `isError` 분기가 실제로 그 상태였다).
 */
export function cacheOrRethrow<T>(key: string, err: unknown): T {
  const cached = readCacheOrNull<T>(key)
  if (cached !== null) return cached
  throw err
}

export function writeCache<T>(key: string, value: T): void {
  // 쓰기 전에도 맞춘다 — 그래야 '방금 쓴 값의 주인' 이 지금 사람으로 남는다.
  if (!isPublicKey(key)) ensureOwner()
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now()))
  } catch {
    // quota 초과 시: 오래된 entry 청소 후 1회 재시도.
    try {
      cleanupExpiredCache()
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
      localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now()))
    } catch { /* 진짜 안 됨 — silent */ }
  }
}

/**
 * 🛡️ 30일 이상 안 read 된 cache entry 삭제.
 *   - quota 초과 시 자동 호출 (writeCache 안)
 *   - 앱 진입 시 1회 호출 (main.tsx — best-effort)
 *   - LRU: read 시점 timestamp 가 갱신되어 자주 본 entry 는 영구 유지.
 */
export function cleanupExpiredCache(): { removed: number; total: number } {
  let removed = 0
  let total = 0
  try {
    const now = Date.now()
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      // 주인 칸은 타임스탬프가 없다 — 빼지 않으면 '30일 안 읽음' 으로 지워져 다음 읽기가 전부를 지운다.
      if (!k?.startsWith(PREFIX) || k.endsWith(TS_SUFFIX) || k === OWNER_KEY) continue
      total++
      const ts = Number(localStorage.getItem(PREFIX + k.slice(PREFIX.length) + TS_SUFFIX) || 0)
      if (!ts || now - ts > AUTO_EXPIRE_MS) {
        keysToRemove.push(k)
        keysToRemove.push(k + TS_SUFFIX)
      }
    }
    keysToRemove.forEach(k => { try { localStorage.removeItem(k) } catch { /* */ } })
    removed = keysToRemove.length / 2
  } catch { /* */ }
  return { removed, total }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch { /* */ }
}

/** 사용자 로그아웃 시 모든 개인화 cache 삭제. */
export function clearAllUserCache(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* */ }
}
