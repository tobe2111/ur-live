/**
 * 🏢 에이전시 콘솔 — 맡은 매장 목록과 **지금 보고 있는 매장** (2026-10-12, 안 A)
 *
 * 콘솔은 매장을 하나 골라 그 판을 보여 준다(PC 는 왼쪽 목록에서, 폰은 머리의 칩에서).
 * 고른 매장은 브라우저에 기억한다 — 이 직원이 내일 콘솔을 열면 어제 일하던 매장이 바로 뜬다.
 * 기억은 **편의**일 뿐이라 목록에 없는 id 면 조용히 첫 매장으로 돌아간다(내려놓은 매장 · 배정 해제).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { agencyRequest, readAgencyProfile } from './agency-api'

export interface StoreToday {
  todayRevenue: number
  todayOrders: number
  pending: number
  activeProducts: number
}

export interface StoreRow {
  linkId: number
  sellerId: number
  status: 'pending' | 'active'
  name: string
  storeStatus: string | null
  requestedAt: string
  acceptedAt: string | null
  /** 운영 중인 매장만 온다. 못 셌으면 null — 0 으로 지어내지 않는다. */
  today: StoreToday | null
}

export const PICKED_STORE_KEY = 'agency_console_store'

/**
 * 🤝 2026-10-24 — 한 매장 · 여러 에이전시 · **자기 이용권만**(대표 확정). 에이전시가 판에서 여는 화면은 이용권뿐이다.
 * 서버 쪽 짝은 `src/worker/utils/agency-product-scope.ts`(에이전시 좌석 기본 차단) — 여기 화면을 더하려면
 * 그 화면이 부르는 API 를 **먼저** 에이전시 몫으로 고치고 서버 허용목록에 올린다(화면만 열면 누를 때 403).
 */
const AGENCY_SCREENS = [/^\/seller\/group-buy$/, /^\/seller\/meal-voucher\/new$/, /^\/seller\/products\/\d+\/edit$/]
export function isAgencyScreen(path: string): boolean {
  const p = path.split('?')[0]
  return AGENCY_SCREENS.some((re) => re.test(p))
}

/** 판 아래 한 줄 — 에이전시가 왜 주문·정산을 못 보는지 화면이 직접 말한다(안 말하면 고장으로 읽힌다). */
export const AGENCY_PLATE_SCOPE_NOTE =
  '우리가 맡은 이용권만 보여요. 이 매장의 다른 이용권과 주문·정산·사용처리는 사장님 화면에서 해요.'

/** 기억한 매장이 목록에 있으면 그것, 아니면 운영 중인 첫 매장. 운영 중이 없으면 null. */
export function pickStore(active: StoreRow[], remembered: number | null): StoreRow | null {
  if (active.length === 0) return null
  return active.find((r) => r.sellerId === remembered) ?? active[0]
}

function readRemembered(): number | null {
  try {
    const n = Number(localStorage.getItem(PICKED_STORE_KEY))
    return Number.isInteger(n) && n > 0 ? n : null
  } catch { return null }
}

export function useAgencyStores(onExpired: () => void) {
  const [rows, setRows] = useState<StoreRow[] | null>(null)
  // 🔗 2026-10-31 — 관리자 전용 [매장 영입 링크 보내기] 가 판 **위**에 서므로, 응답을 기다리면 그 높이만큼 아래가 밀린다.
  //   로그인 때 저장한 역할로 첫 렌더를 그리고 서버 값으로 맞춘다(권한 판정은 여전히 서버 — 화면 배치만).
  const [canManage, setCanManage] = useState(() => readAgencyProfile()?.staff.role === 'admin')
  const [error, setError] = useState('')
  const [remembered, setRemembered] = useState<number | null>(readRemembered)

  const load = useCallback(async () => {
    setError('')
    const r = await agencyRequest<{ stores: StoreRow[]; canManage: boolean }>('/stores')
    if (r.status === 401) { onExpired(); return }
    if (!r.ok) { setError(r.data.error || '맡은 매장을 불러오지 못했어요.'); return }
    setRows(r.data.stores.map((s) => ({ ...s, today: s.today ?? null })))
    setCanManage(!!r.data.canManage)
  }, [onExpired])

  useEffect(() => { load() }, [load])

  const pending = useMemo(() => rows?.filter((r) => r.status === 'pending') ?? [], [rows])
  const active = useMemo(() => rows?.filter((r) => r.status === 'active') ?? [], [rows])
  const picked = useMemo(() => pickStore(active, remembered), [active, remembered])

  const pick = useCallback((sellerId: number) => {
    setRemembered(sellerId)
    try { localStorage.setItem(PICKED_STORE_KEY, String(sellerId)) } catch { /* 기억 못 해도 지금은 보인다 */ }
  }, [])

  return { rows, pending, active, picked, pick, canManage, error, load }
}
