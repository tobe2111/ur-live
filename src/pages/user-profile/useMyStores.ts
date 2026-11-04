/**
 * 🪑 마이 판매 섹션의 데이터 한 줄 — 좌석 + 오늘 숫자 (2026-09-25, 설계 §14 단계 1)
 *
 * ## 왜 `/my-stores/summary` 인가 (§15-2)
 * 좌석을 판정하는 길이 둘이었다:
 *   - `POST /switch-to-seller` — `sellers.linked_user_id = 내 user_id` **한 행만**. 그 컬럼은 UNIQUE(1인 1행).
 *   - `GET /my-stores[/summary]` — `canOperateStore` = 소유(link) **∪** 위임(`seller_operators`).
 * 그런데 `POST /store/new` 는 설계상 `linked_user_id` 를 **비우고** 권한을 `seller_operators` 로만 준다.
 * ⇒ 앞의 길은 그렇게 만들어진 좌석을 **한 개도 못 본다**(라이브에 9개 있다).
 *   **새 판매 화면의 좌석 출처는 이 훅 하나다.** `switch-to-seller` 는 옛 단일 좌석 호환 경로로만 남긴다.
 *   (2026-10-10 조회 통일 ④: 옛 길도 이제 linked 다음에 **주인(owner) 좌석**을 본다 — 단 한 곳만, operator 는 아니다.
 *    여러 가게를 고르는 일은 여전히 이 훅의 몫이다.)
 *
 * ## 세대(generation)를 구독한다 (§15-3)
 * 가게를 바꾸면 토큰이 통째로 바뀐다. 그 순간 이 훅이 들고 있던 숫자는 **옛 가게 것**이므로 다시 부른다.
 *
 * ⚠️ 소비자 세션만으로 200 이 온다(서버 `resolveActorUserId` 가 쿠키를 먼저 읽는다).
 *   좌석이 없으면 빈 목록이지 에러가 아니다 — 그래서 셀러가 아닌 사람에게는 조용히 아무것도 안 그린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { onSeatChange, seatGeneration } from '@/lib/seller-seat'
import { readCache, writeCache } from '@/hooks/queries/localCache'

export interface StoreSummaryRow {
  seller_id: number
  name: string
  role: 'owner' | 'operator'
  /** 'active' | 'approved' | 'pending' | 'rejected' — 당근 모델 배너가 읽는다 */
  status: string | null
  /** 🪪 등록증 심사 상태('pending'|'verified'|'rejected'|'exempt'|null) — 매장은 대기인데 등록증만 반려된 경우를 말하려고(2026-10-12) */
  cert_status?: string | null
  today_revenue: number
  today_orders: number
  pending: number
  /** ⚡ 판매 중 상품 수 — 이 값이 있어서 첫 화면이 상품 목록을 따로 안 받는다(2026-10-01) */
  active_products: number
  /** 🏠 생활 견적 참여권 잔액 — 생활 업체가 아니면 null(2026-10-26) */
  life_credits?: number | null
  /** 🖼️ B안 머리줄 사진(가게 프로필 → 없으면 판매 중 상품 첫 사진) — 없으면 이니셜(2026-10-31) */
  image?: string | null
  /** 손님이 보는 가게 주소 `/s/:username` — 없으면 '가게 보기' 를 안 그린다 */
  username?: string | null
}

export interface MyStoresState {
  stores: StoreSummaryRow[]
  totals: { today_revenue: number; today_orders: number; pending: number }
  /** 지금 토큰이 앉아 있는 좌석(서버가 Authorization 으로 판정한 값). 없으면 null */
  currentSellerId: number | null
  loading: boolean
  /** 불러오기 실패 — 0 으로 위장하지 않는다(빈 화면 ≠ 실패) */
  failed: boolean
  /** 이 데이터가 실려 온 좌석 세대. 지금 세대와 다르면 옛 가게 것이다 */
  generation: number
  refetch: () => void
}

const EMPTY_TOTALS = { today_revenue: 0, today_orders: 0, pending: 0 }

/**
 * 🧠 2026-11-04 대표 *"버벅임이 심하네 특히 마이페이지"* — **지난번에 받은 좌석을 기억한다.**
 *
 * 마이 탭을 누를 때마다 페이지가 통째로 리마운트된다(App.tsx `key={location.pathname}`).
 * 종전엔 이 훅이 매번 빈손으로 시작해서, 사장님이 마이를 열 때마다 ① 판매 판이 숫자 없는 껍데기로
 * 서고 ② 원본 DB 왕복을 기다렸고 ③ 회선이 느리거나 끊기면 `failed` 로 떨어져 **판매 판 전체가 사라지고
 * 폴백 '매장 계산대' 카드 하나만** 남았다(대표 스크린샷 그대로).
 * ⇒ 같은 탭 안의 재방문은 **지난 값을 즉시 그리고 뒤에서 새로 받는다**(stale-while-revalidate).
 *   - 재조회가 실패해도 지난 값을 지운다 대신 **그대로 둔다** — 가게가 갑자기 사라지는 것보다 낫다.
 *     (처음 방문의 실패는 종전대로 `failed` — 실패를 성공처럼 보이게 하지 않는다는 원칙은 그대로다.)
 *   - 좌석 세대가 다르면 기억을 쓰지 않는다 — 옛 가게 숫자를 그리지 않기 위해서다.
 *   - 사람(user_id)이 바뀌면 쓰지 않는다. 메모리에만 둔다(새로고침하면 비는 것이 맞다).
 */
type SeatMemo = { userKey: string; generation: number; at: number; stores: StoreSummaryRow[]; totals: MyStoresState['totals']; currentSellerId: number | null }
let seatMemo: SeatMemo | null = null
/** 30분 — 그보다 오래 묵은 '오늘 매출' 은 보여 줄 가치보다 헷갈림이 크다. */
const SEAT_MEMO_TTL_MS = 30 * 60_000

function memoUserKey(): string {
  try { return localStorage.getItem('user_id') || localStorage.getItem('session_login') || '' } catch { return '' }
}

/**
 * 💾 2026-11-04 (대표 *"대기업급 무료 선에서 더"*) — 메모리 기억은 앱을 껐다 켜면 빈다. 그래서 **기기에도** 한 벌 남긴다
 *   (localCache — 사람이 바뀌면 통째로 지운다). '오늘 매출'이 들어 있어 **같은 한국 날짜 · 2시간 이내**일 때만 쓴다
 *   (어제 매출을 오늘로 보이면 거짓말이다). 그린 직후 서버 값으로 바뀐다.
 */
const SEAT_DISK_KEY = 'my-stores-summary'
const SEAT_DISK_TTL_MS = 2 * 60 * 60_000
const kstDay = (t: number) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10)

/** 지금 쓸 수 있는 기억 — 같은 사람 · 같은 좌석 세대 · 30분 이내일 때만(없으면 기기 저장분). */
function readSeatMemo(): SeatMemo | null {
  const m = seatMemo
  if (m && m.userKey === memoUserKey() && m.generation === seatGeneration() && Date.now() - m.at <= SEAT_MEMO_TTL_MS) return m
  if (m) return null // 메모리에 있는데 안 맞으면(사람·좌석이 바뀜) 기기 것도 쓰지 않는다
  const d = readCache<Omit<SeatMemo, 'generation'> | null>(SEAT_DISK_KEY, null)
  if (!d || !Array.isArray(d.stores) || d.userKey !== memoUserKey()) return null
  const now = Date.now()
  if (now - d.at > SEAT_DISK_TTL_MS || kstDay(d.at) !== kstDay(now)) return null
  return { ...d, generation: seatGeneration() }
}

/** 시험용 — 기억을 비운다. */
export function __resetSeatMemo() { seatMemo = null }

export function useMyStores(): MyStoresState {
  const [memo] = useState(readSeatMemo)
  const [stores, setStores] = useState<StoreSummaryRow[]>(() => memo?.stores ?? [])
  const [totals, setTotals] = useState(() => memo?.totals ?? EMPTY_TOTALS)
  const [currentSellerId, setCurrentSellerId] = useState<number | null>(() => memo?.currentSellerId ?? null)
  const [loading, setLoading] = useState(() => !memo)
  const [failed, setFailed] = useState(false)
  const [generation, setGeneration] = useState(() => seatGeneration())
  const alive = useRef(true)
  /** 지금 화면에 이 세대의 실제 값이 있는가 — 있으면 재조회 동안 껍데기로 되돌리지 않는다. */
  const shown = useRef<number | null>(memo ? memo.generation : null)

  useEffect(() => () => { alive.current = false }, [])

  const load = useCallback(() => {
    const gen = seatGeneration()
    // 같은 세대의 값이 이미 화면에 있으면 조용히 새로 받는다(껍데기로 깜빡이지 않는다).
    const quiet = shown.current === gen
    if (!quiet) setLoading(true)
    /**
     * ⚡ 2026-10-06 — `api` 를 **정적으로** 쓴다 (대표 *"내 가게 이 부분이 가장 늦게 떠"*).
     *   종전 `import('@/lib/api').then(...)` 은 요청을 **다음 task 로 밀었다**. 그 사이 React 가
     *   렌더를 돌므로 이 요청만 첫 묶음을 놓쳤다 — 실측 `+842ms` vs 형제 여섯 `+564~571ms`.
     *   그리고 `seller/orders` 가 이 응답(좌석)을 기다리므로 **지연이 2단으로 전파**됐다(`+893ms`).
     *   정적으로 바꾸니 `+497ms`(첫 묶음 합류) · 주문 `+787ms`.
     *   🔑 모듈 그래프 비용 0 — 유일 소비처 `UserProfilePage` 가 이미 `api` 를 정적 import 한다
     *     (`critical-chunks` 17개 불변으로 확인). ⚠️ 동적 import 로 되돌리지 말 것.
     */
    Promise.resolve(api.get('/api/seller/my-stores/summary'))
      .then((r) => {
        if (!alive.current) return
        const d = r.data?.data
        if (!r.data?.success || !d) { if (!quiet) setFailed(true); return }
        const nextStores: StoreSummaryRow[] = Array.isArray(d.stores) ? d.stores : []
        const nextTotals = d.totals || EMPTY_TOTALS
        const cur = Number(d.current_seller_id)
        const nextCur = Number.isFinite(cur) && cur > 0 ? cur : null
        setStores(nextStores)
        setTotals(nextTotals)
        setCurrentSellerId(nextCur)
        setFailed(false)
        setGeneration(gen)
        shown.current = gen
        seatMemo = { userKey: memoUserKey(), generation: gen, at: Date.now(), stores: nextStores, totals: nextTotals, currentSellerId: nextCur }
        writeCache(SEAT_DISK_KEY, { userKey: seatMemo.userKey, at: seatMemo.at, stores: nextStores, totals: nextTotals, currentSellerId: nextCur })
      })
      // 🧠 이미 그린 값이 있으면 실패해도 지우지 않는다 — 회선이 잠깐 끊겼다고 가게가 사라지면 안 된다.
      .catch(() => { if (alive.current && !quiet) setFailed(true) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  // 🪑 좌석이 바뀌면 지금 들고 있는 숫자는 옛 가게 것이다 — 버리고 다시 부른다.
  useEffect(() => onSeatChange(() => load()), [load])

  return { stores, totals, currentSellerId, loading, failed, generation, refetch: load }
}
