import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import Sheet from '@/pages/user-profile/seller-section/Sheet'
import { currentSeatId } from '@/lib/seller-seat'
import { readToolParam } from '@/lib/seller-deep-link'
import { notifTarget } from '@/lib/notif-target'
import { agencyRequest, enterAgencyStore, isMyAgencySeat } from './agency-api'
import AgencyNotificationsSheet, { type AgencyNotification } from './AgencyNotificationsSheet'
import { useAgencyStores, type StoreRow } from './agency-stores-model'
import AgencyStorePlate from './AgencyStorePlate'
import AgencySalesSheet from './AgencySalesSheet'
import { AgencyRegisterStoreCard } from './AgencyRegisterStoreCard'
import { ROW_LABEL_CLS } from '@/pages/user-profile/list-grammar'
import { MailIcon, StoreIcon, ShopPlusIcon } from '@/components/icons/urdeal-icons'
import { AgencyRowStyle, AgencyTodayCard, TossCard, TossTile, TOSS_CARD_CLS, useAgencyRowStyle } from './agency-toss'
import { AgencyGettingStarted } from './AgencyGettingStarted'

/**
 * 🏢 에이전시 콘솔 본문 — 대표 확정 **안 A** (2026-10-12 · *"A안으로 해줘. 이건 PC버전도 중요해"*)
 *
 * - **폰**: [매장 영입 링크 보내기] → [맡은 매장 · 매장 고르기 칩] → 그 매장의 판 → [에이전시] 줄(맡김 요청 · 직원 · 매장 대신 등록).
 * - **PC**: 왼쪽 칸 = 맡은 매장 목록 + 에이전시 줄, 오른쪽 칸 = 고른 매장의 판(넓게).
 *   같은 DOM 을 순서(`order-*`)만 바꿔 쓴다 — 두 벌로 그리면 한쪽만 고쳐지는 날이 온다.
 *
 * 종전엔 매장마다 [운영하기] 를 눌러 **셀러 대시보드로** 들어갔다. 이제 판의 도구가 그 화면을
 * 시트로 바로 연다(`AgencyStorePlate`). 대시보드 껍데기를 지우기 위한 단계다.
 */
const STORE_STATUS_HINT: Record<string, string> = {
  pending: '유어딜 승인 대기',
  rejected: '유어딜 승인 반려',
  suspended: '이용 정지',
}

/** 목록 한 줄의 오른쪽 짧은 값 — 할 일(확인 대기)이 먼저, 그다음 상태, 그다음 오늘 매출. */
export function storeRowHint(r: StoreRow): { text: string; urgent: boolean } {
  if (r.today && r.today.pending > 0) return { text: `확인 대기 ${formatNumber(r.today.pending)}`, urgent: true }
  if (r.storeStatus && STORE_STATUS_HINT[r.storeStatus]) return { text: STORE_STATUS_HINT[r.storeStatus], urgent: false }
  if (r.today) return { text: `오늘 ${formatNumber(r.today.todayRevenue)}원`, urgent: false }
  return { text: '', urgent: false }
}

type AgencySheet = 'picker' | 'requests' | 'register' | 'notifs' | 'sales' | null

export function AgencyStoresPanel({ onExpired, staffId, agencyRows, trailingRows, stacked = false, toolParam, ownSellerIds, toss = false, staffCount = null, onInviteStaff }: {
  /** 🚀 2026-11-04 안 A — 매장 0곳 첫 화면의 ③ 직원 단계(직원 수 · 직원 시트 열기). */
  staffCount?: number | null
  onInviteStaff?: () => void
  onExpired: () => void
  /** 🧾 2026-11-03 토스 참고 안 — 판(카드)으로 묶고 두 줄 행 · 오늘 매출 합계 카드(`agency-toss.tsx`). */
  toss?: boolean
  /**
   * 🧩 2026-11-02 대표 *"에이전시 계정 안에 저 업체들이 종속되는 형태잖아? 근데 왜 따로 노는 형태인거지?"* —
   *   마이(손님)에서는 이 사람이 운영자로 맡은 매장이 이미 위 '내 가게' 판에 있다. 에이전시가 맡은 매장이
   *   **전부** 그 안에 있으면 이 판(매장 고르기 + 매장 판)을 그리지 않는다 — 같은 매장이 두 번 그려졌다
   *   (그래서 '이용권 등록·관리' 도 두 번). 하나라도 밖에 있으면 종전대로 그린다.
   */
  ownSellerIds?: number[]
  /**
   * 🏠 2026-10-26 마이 안 — 마이의 PC 칸은 좁아서 두 칸(목록 300px + 판)을 못 담는다.
   *   켜면 PC 에서도 폰처럼 한 칸(판 → 에이전시 줄, 매장은 고르기 칩)으로 그린다.
   */
  stacked?: boolean
  /** 에이전시 줄 맨 끝(매장 초대 다음) — 마이에서는 '에이전시 로그아웃'. */
  trailingRows?: ReactNode
  /** 깊은 링크 쿼리 이름 — 마이에서는 `atool`(`?tool=` 은 사장님 판이 쓴다). */
  toolParam?: string
  /** 좌석이 '내 것' 인지 판정하는 직원 id(`isMyAgencySeat`). */
  staffId: number
  /** 에이전시 구역의 나머지 줄(직원 · 에이전시 정보) — 시트는 그 줄의 주인(페이지)이 연다. */
  agencyRows?: ReactNode
}) {
  const { rows, pending, active, picked, pick, canManage, error, load } = useAgencyStores(onExpired)
  /** 응답 전(rows null)에도 숨긴다 — 내 가게가 있으면 대개 같은 매장이라, 그렸다 지우면 아래가 통째로 튄다. */
  const coveredByMine = !!ownSellerIds && ownSellerIds.length > 0 && !error
    && (rows === null || active.every((r) => ownSellerIds.includes(r.sellerId)))
  /**
   * 🚀 2026-11-04 대표 확정 안 A — 운영 중 매장이 0곳인 관리자에게는 오늘 매출 `—`·'없음' 줄 대신 **시작 3단계**를 세운다.
   *   토스 판(에이전시 전용 마이)에서만 — 손님 마이 안 구역(`stacked`)은 그대로다. 첫 매장이 연결되면 원래 판으로.
   */
  const firstRun = toss && !error && rows !== null && active.length === 0 && canManage
  const [sheet, setSheet] = useState<AgencySheet>(null)
  // 🗑️ 2026-11-03 대표 *"마이페이지에 에이전시 측에서 볼 때 위젯 코드 만드는 홈페이지에 넣기는 빼줘"* —
  //   '홈페이지에 넣기' 줄과 그 줄이 쓰던 번호(`readAgencyProfile().agency.id`)를 걷었다. 위젯 자체(`/embed`)는 그대로다.
  const [busyId, setBusyId] = useState<number | null>(null)
  /**
   * 🚪 깊은 링크(`/agency?tool=/seller/orders`) — 대시보드 껍데기가 에이전시 직원을 이리로 보낸다
   *   (`sellerEntryRedirect`). 좌석 토큰이 가리키는 매장을 고르고 그 화면을 시트로 연다.
   *   ⚠️ **좌석을 새로 받지 않는다** — 이 직원의 그 매장 좌석이 이미 있을 때만 연다. 아니면(다른 직원 좌석 ·
   *   내려놓은 매장 · 목록 실패) 주소에서 지우고 **매장을 고르라고 말한다**. 2026-10-12 까지는 대시보드로
   *   되돌렸는데(`dash=1`) 대시보드는 지웠다 — 매장 판에서 그 화면을 다시 열면 된다.
   */
  const [deepPath] = useState(() => readToolParam(window.location.search, toolParam))
  const [openPath, setOpenPath] = useState<string | null>(null)
  /** 같은 화면을 다시 열 때도 판이 새로 서게(판의 열린 시트는 마운트 때 정해진다). */
  const [openNonce, setOpenNonce] = useState(0)
  /** 🔔 판매 알림 — 대시보드 껍데기의 종이 하던 일(2026-10-12). 콘솔을 열 때 한 번 받는다. */
  const [notifs, setNotifs] = useState<AgencyNotification[] | null>(null)
  const [notifUnread, setNotifUnread] = useState(0)
  /** 📊 판매 내역 시트의 매장(판의 버튼 · 판매 알림이 연다). */
  const [salesFor, setSalesFor] = useState<{ sellerId: number; name: string } | null>(null)
  useEffect(() => {
    void agencyRequest<{ data: { items: AgencyNotification[]; unread: number } }>('/notifications?limit=30').then((r) => {
      if (!r.ok) { setNotifs([]); return }
      setNotifs(r.data.data?.items ?? [])
      setNotifUnread(Number(r.data.data?.unread) || 0)
    })
  }, [])
  async function readNotifs(ids: number[] | 'all') {
    const r = await agencyRequest('/notifications/read', { method: 'POST', body: ids === 'all' ? { all: true } : { ids } })
    if (!r.ok) return
    setNotifs((prev) => prev?.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, isRead: true } : n)) ?? prev)
    setNotifUnread((u) => (ids === 'all' ? 0 : Math.max(0, u - ids.length)))
  }
  /**
   * 알림을 누르면 그 매장을 고르고 화면을 시트로 연다. **좌석은 이 클릭에서만** 받는다(사람의 행동) —
   *   이미 이 직원의 그 매장 좌석이면 다시 받지 않는다.
   */
  async function openNotif(n: AgencyNotification) {
    if (!n.isRead) void readNotifs([n.id])
    // 📊 판매 알림(2026-10-24) — 그 매장의 우리 판매 내역을 연다. 좌석이 필요 없다(직원 토큰으로 본다).
    if (n.type === 'agency_sale') {
      const store = active.find((r) => r.sellerId === n.sellerId)
      if (!store) { toast.error('지금 맡고 있지 않은 매장 알림이에요.'); return }
      pick(store.sellerId)
      setSalesFor({ sellerId: store.sellerId, name: store.name })
      setSheet('sales')
      return
    }
    const t = notifTarget(n.link)
    if (!t) return
    if (t.kind === 'go') { window.location.assign(t.path); return }
    const store = active.find((r) => r.sellerId === n.sellerId)
    if (!store) { toast.error('지금 맡고 있지 않은 매장 알림이에요.'); return }
    if (!isMyAgencySeat(store.sellerId, staffId)) {
      const r = await enterAgencyStore(store.sellerId, store.name)
      if (!r.ok) { toast.error(r.error); return }
    }
    setSheet(null)
    pick(store.sellerId)
    setOpenPath(t.path)
    setOpenNonce((x) => x + 1)
  }
  /** 한 번만 쓴다 — 다른 매장을 골랐다 돌아와도 시트가 다시 열리지 않게. */
  const deepDone = useRef(false)
  useEffect(() => {
    if (!deepPath || deepDone.current) return
    if (!error && rows === null) return
    deepDone.current = true
    const seat = currentSeatId()
    const target = error ? undefined : active.find((r) => r.sellerId === seat)
    try {
      const q = new URLSearchParams(window.location.search); q.delete(toolParam ?? 'tool')
      window.history.replaceState(window.history.state, '', q.toString() ? `${window.location.pathname}?${q}` : window.location.pathname)
    } catch { /* 무해 — 새로고침이 시트를 한 번 더 열 뿐 */ }
    if (!target || !isMyAgencySeat(target.sellerId, staffId)) {
      toast.error('알림 속 화면을 열 매장에 들어가 있지 않아요. 아래에서 매장을 골라 다시 열어 주세요.')
      return
    }
    pick(target.sellerId)
    setOpenPath(deepPath)
  }, [deepPath, rows, error, active, staffId, pick])

  async function act(row: StoreRow, path: 'accept' | 'decline' | 'release') {
    if (path !== 'accept') {
      const message = path === 'decline'
        ? `${row.name} 사장님의 요청을 거절할까요?`
        : `${row.name} 운영을 내려놓을까요? 직원 모두가 이 매장에 들어갈 수 없게 돼요.`
      if (!(await confirmDialog({ message, danger: true }))) return
    }
    setBusyId(row.linkId)
    const r = await agencyRequest(`/stores/${row.linkId}/${path}`, { method: 'POST' })
    setBusyId(null)
    if (!r.ok) { toast.error(r.data.error || '처리하지 못했어요.'); load(); return }
    toast.success(r.data.message || '처리했어요.')
    load()
  }

  /** 할 일 두 줄(판매 알림 · 맡김 요청) — 평면이든 토스 판이든 **한 벌**이다(두 벌이면 한쪽만 고쳐진다). */
  const todoRows = (
    <>
      <FlatRow
        icon={<MailIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
        label="판매 알림"
        hint={notifUnread > 0 ? `새 알림 ${notifUnread}` : notifs && notifs.length > 0 ? '모두 읽음' : '없음'}
        urgent={notifUnread > 0}
        onClick={() => setSheet('notifs')}
      />
      <FlatRow
        icon={<StoreIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
        label="맡김 요청"
        hint={pending.length > 0 ? `새 요청 ${pending.length}` : '없음'}
        urgent={pending.length > 0}
        onClick={() => setSheet('requests')}
      />
    </>
  )

  return (
    <div className={stacked ? 'flex flex-col gap-8' : 'mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-5'}>
      {/* ── 왼쪽(PC) / 아래(폰) ─────────────────────────────── */}
      <div className={stacked ? 'order-2' : firstRun ? 'order-2 w-full lg:max-w-[560px]' : 'order-2 lg:order-1 lg:w-[300px] lg:shrink-0'}>
        <nav aria-label="맡은 매장" className={stacked || firstRun ? 'hidden' : 'hidden lg:block mb-8'}>
          <h2 className="text-[16px] font-semibold text-gray-500 dark:text-gray-400">
            맡은 매장{active.length > 0 && ` · ${active.length}곳`}
          </h2>
          <div className="mt-3 flex flex-col gap-1">
            {active.map((r) => {
              const hint = storeRowHint(r)
              const on = picked?.sellerId === r.sellerId
              return (
                <button
                  key={r.linkId}
                  type="button"
                  aria-current={on || undefined}
                  onClick={() => { setOpenPath(null); pick(r.sellerId) }}
                  className={`flex min-h-[56px] flex-col items-start justify-center gap-1 rounded-xl px-4 py-2 text-left ${
                    on ? 'bg-white dark:bg-[#1D1F29] shadow-lift' : 'hover:bg-white/60 dark:hover:bg-white/5'
                  }`}
                >
                  <span className={`w-full truncate text-[15px] ${on ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200'}`}>{r.name}</span>
                  {hint.text && (
                    <span className={`text-[12px] ${hint.urgent ? 'font-medium text-brand-text' : 'text-gray-400'}`}>{hint.text}</span>
                  )}
                </button>
              )
            })}
            {rows !== null && active.length === 0 && <p className="px-4 text-[13px] text-gray-400 dark:text-gray-500">아직 없어요</p>}
          </div>
        </nav>

        {/* 🏠 마이 안에서는 구역 제목('에이전시 · 이름')이 이미 있어 같은 말을 또 하지 않는다. */}

        {toss ? (
          /* 🧾 토스 참고 안 — [오늘 매출] · [할 일] · [관리] 판, 로그아웃은 맨 아래 조용한 글자. */
          <AgencyRowStyle.Provider value="toss">
            <div className="flex flex-col gap-3">
              {firstRun ? (
                <AgencyGettingStarted
                  staffCount={staffCount}
                  pendingCount={pending.length}
                  onRegister={() => setSheet('register')}
                  onInviteStaff={() => onInviteStaff?.()}
                  onRequests={() => setSheet('requests')}
                />
              ) : (<>
                <AgencyTodayCard rows={rows === null ? null : active} />
                <TossCard title="할 일" testId="agency-todo-card">
                  {todoRows}
                </TossCard>
              </>)}
              <TossCard testId="agency-manage-card">
                {agencyRows}
                {canManage && !firstRun && <FlatRow icon={<ShopPlusIcon className="h-[18px] w-[18px]" aria-hidden="true" />} label="매장 대신 등록" hint="유어딜에 없는 매장" onClick={() => setSheet('register')} />}
              </TossCard>
              {trailingRows}
            </div>
          </AgencyRowStyle.Provider>
        ) : (<>
        {!stacked && <h2 className="text-[16px] font-semibold text-gray-500 dark:text-gray-400">에이전시</h2>}
        <div className={stacked ? '' : 'mt-1'}>
          {todoRows}
          {agencyRows}
          {canManage && <FlatRow icon={<ShopPlusIcon className="h-[18px] w-[18px]" aria-hidden="true" />} label="매장 대신 등록" hint="유어딜에 없는 매장" onClick={() => setSheet('register')} last={!trailingRows} />}
          {trailingRows}
        </div>
        </>)}
      </div>

      {/* ── 오른쪽(PC) / 위(폰) — 고른 매장의 판 ──────────────────── */}
      <section aria-label={picked ? `${picked.name} 판매` : '맡은 매장'} className={`${coveredByMine || firstRun ? 'hidden' : stacked ? 'order-1 min-w-0' : 'order-1 lg:order-2 min-w-0 flex-1'}${toss ? ` ${TOSS_CARD_CLS} py-4` : ''}`}>
        {/* 🔗 2026-11-02 대표 확정 버튼 ① — 매장 영입 입구는 **마이 머리** 하나다(`AgencyInviteButton`).
            종전엔 이 자리에 큰 카드 + 빈 칸 안 버튼으로 두 번 있었다. ('홈페이지에 넣기' 줄은 2026-11-03 대표 지시로 걷었다.) */}
        <div className="flex items-center gap-2">
          {/* 🖥️ PC 는 매장 이름이 제목이다(왼쪽 목록이 고르기를 맡는다). 폰은 '맡은 매장' + 고르기 칩. */}
          {!stacked && <h2 className="hidden lg:block min-w-0 truncate text-[16px] font-semibold text-gray-500 dark:text-gray-400">{picked?.name ?? '맡은 매장'}</h2>}
          <h2 className={stacked ? 'text-[13px] font-medium text-gray-500 dark:text-gray-400' : 'lg:hidden text-[16px] font-semibold text-gray-500 dark:text-gray-400'}>맡은 매장</h2>
          <div className="flex-1" />
          {active.length > 0 && picked && (
            <button
              type="button"
              onClick={() => setSheet('picker')}
              className={`${stacked ? '' : 'lg:hidden '}inline-flex max-w-[60%] items-center gap-1 py-2 text-[12px] font-medium text-gray-500 dark:text-gray-400 active:opacity-70`}
            >
              <span className="truncate">{picked.name}</span>
              {active.length >= 2 && <span className="shrink-0">· {active.length}곳</span>}
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-3">
          {error ? (
            <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
              <p className="text-[15px] text-gray-700 dark:text-gray-200">{error}</p>
              <button type="button" onClick={load} className="mt-5 h-10 rounded-xl bg-brand px-4 text-[15px] font-medium text-white">다시 시도</button>
            </div>
          ) : rows === null ? (
            <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift"><p className="text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p></div>
          ) : picked ? (
            // 🔑 매장이 바뀌면 판을 새로 세운다 — 열려 있던 시트·좌석 대기 상태가 다음 매장으로 새지 않게.
            <AgencyStorePlate
              key={`${picked.sellerId}:${openPath ?? ''}:${openNonce}`}
              store={picked}
              staffId={staffId}
              initialPath={openPath && picked.sellerId === currentSeatId() ? openPath : undefined}
              onOpenSales={() => { setSalesFor({ sellerId: picked.sellerId, name: picked.name }); setSheet('sales') }}
            />
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
              <p className="text-[15px] font-medium text-gray-900 dark:text-white">아직 운영 중인 매장이 없어요</p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
                {canManage
                  ? <>맨 위 <b className="font-medium text-gray-700 dark:text-gray-200">매장 영입</b> 버튼으로 링크를 사장님께 카톡으로 보내세요. 아직 유어딜에 없는 사장님은 그 링크에서 매장을 등록하면 바로 연결돼요. 사장님이 셀러 화면의 <b className="font-medium text-gray-700 dark:text-gray-200">운영자 관리 → 에이전시에 맡기기</b>에 관리자 이메일을 넣어도 여기에 떠요.</>
                  : '관리자가 매장을 맡거나 배정하면 여기에 떠요.'}
              </p>
              {pending.length > 0 && (
                <button type="button" onClick={() => setSheet('requests')} className="mt-5 h-10 rounded-xl bg-brand px-4 text-[15px] font-medium text-white">
                  맡김 요청 {pending.length}건 보기
                </button>
              )}
            </div>
          )}
        </div>

        {canManage && picked && (
          <button
            type="button"
            disabled={busyId === picked.linkId}
            onClick={() => act(picked, 'release')}
            className="mt-3 px-1 text-[13px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            이 매장 운영 내려놓기
          </button>
        )}
      </section>

      {sheet === 'picker' && (
        <Sheet title="맡은 매장" onClose={() => setSheet(null)}>
          <ul className="divide-y divide-rule">
            {active.map((r) => {
              const hint = storeRowHint(r)
              const on = picked?.sellerId === r.sellerId
              return (
                <li key={r.linkId}>
                  <button
                    type="button"
                    onClick={() => { setOpenPath(null); pick(r.sellerId); setSheet(null) }}
                    className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left active:bg-gray-50 dark:active:bg-white/5"
                  >
                    <span className={`min-w-0 flex-1 truncate text-[15px] ${on ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200'}`}>{r.name}</span>
                    {hint.text && <span className={`shrink-0 text-[13px] ${hint.urgent ? 'font-medium text-brand-text' : 'text-gray-400'}`}>{hint.text}</span>}
                    {on && <span className="shrink-0 text-[13px] font-medium text-brand-text">보는 중</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}

      {sheet === 'sales' && salesFor && (
        <AgencySalesSheet sellerId={salesFor.sellerId} storeName={salesFor.name} onClose={() => setSheet(null)} />
      )}

      {sheet === 'notifs' && (
        <AgencyNotificationsSheet
          items={notifs}
          unread={notifUnread}
          onPick={(n) => { void openNotif(n) }}
          onReadAll={() => { void readNotifs('all') }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'requests' && (
        <Sheet title="맡김 요청" onClose={() => setSheet(null)}>
          {pending.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">기다리는 요청이 없어요.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {pending.map((r) => (
                <li key={r.linkId} className="flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-gray-900 dark:text-white">{r.name}</p>
                    <p className="text-[13px] text-brand-text">수락하면 운영을 시작해요</p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <button type="button" disabled={busyId === r.linkId} onClick={() => act(r, 'decline')}
                        className="h-9 rounded-full px-3 text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50">거절</button>
                      <button type="button" disabled={busyId === r.linkId} onClick={() => act(r, 'accept')}
                        className="h-9 rounded-full bg-brand px-4 text-[13px] font-medium text-white disabled:opacity-50">수락</button>
                    </div>
                  ) : (
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">관리자가 수락하면 열려요</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {sheet === 'register' && canManage && (
        <Sheet title="매장 대신 등록" onClose={() => setSheet(null)}>
          <div className="min-h-full bg-[#F8F7FC] dark:bg-[#11141C] p-4 [&>*:first-child]:mt-0">
            <AgencyRegisterStoreCard onRegistered={load} />
          </div>
        </Sheet>
      )}
    </div>
  )
}

/**
 * 에이전시 구역의 한 줄 — 판 밖의 평면 줄(안 A 시안). 오른쪽 값이 할 일이면 블루.
 * 🧱 2026-11-03 대표 *"어떤 건 아이콘을 쓰고 통일감이 없어"* — 위 매장 판의 줄(`ListRow`)과 **같은 문법**이다:
 *   아이콘 18px(회색) · 제목 `ROW_LABEL_CLS` · 오른쪽 값 13px 회색 · 화살표. 가로 여백만 바깥 래퍼가 갖는다.
 */
/**
 * 🧾 2026-11-03 대표 *"에이전시 운영 밑에는 왜 줄로 구분선이 쳐져있지?"* — `last:border-b-0` 를 붙여 마이(폰)의 평면 규칙
 *   (`index.css` `.ur-my-flat .border-b.border-rule.last\:border-b-0`)에 걸리게 했다. 마이 안에서는 선이 사라져 위 '맡은 매장'
 *   줄과 같은 모양이 되고, 에이전시 콘솔(`/agency`)·PC 는 그 규칙 밖이라 선이 그대로다.
 */
export function FlatRow({ icon, label, hint, urgent = false, onClick, last = false }: {
  icon: ReactNode
  label: string
  hint?: string
  urgent?: boolean
  onClick: () => void
  last?: boolean
}) {
  const style = useAgencyRowStyle()
  if (style === 'toss') {
    // 🧾 토스 참고 안 — 타일 + 두 줄(제목 16·600 / 아래 13 회색), 판 안에서는 구분선 없이 여백으로 가른다.
    return (
      <button type="button" onClick={onClick} className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left active:opacity-70">
        <TossTile>{icon}</TossTile>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-gray-900 dark:text-white">{label}</span>
          {hint && <span className={`block mt-1 truncate text-[13px] ${urgent ? 'font-medium text-brand-text' : 'text-gray-500 dark:text-gray-400'}`}>{hint}</span>}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[48px] w-full items-center gap-3 text-left active:opacity-70 ${last ? '' : 'border-b border-rule last:border-b-0'}`}
    >
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{icon}</span>
      <span className={ROW_LABEL_CLS}>{label}</span>
      {hint && <span className={`min-w-0 truncate text-[13px] ${urgent ? 'font-medium text-brand-text' : 'text-gray-500 dark:text-gray-400'}`}>{hint}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
    </button>
  )
}
