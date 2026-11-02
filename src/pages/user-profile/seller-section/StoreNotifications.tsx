/**
 * 🔔 마이 판매 구역의 **판매 알림** (2026-10-12, 셀러 대시보드 제거 4단계 선행)
 *
 * 판매 알림(결제 확정 · 정산 · 승인 · 제안 …)은 대시보드 껍데기의 종에서만 보였다. 3단계에서 사장님을 마이로 보내면서
 * 그 종을 볼 길이 사라졌다 — 그래서 마이 '내 가게' 머리에 종을 하나 둔다. 서버는 **사람 기준**으로 앉을 수 있는
 * 매장 전부의 알림을 준다(`/api/seller/my-stores/notifications`) — 좌석이 없어도 읽힌다(마이를 여는 것만으로 좌석을
 * 발급하지 않는 규칙을 지킨다).
 *
 * 누르면 그 화면을 시트로 연다. ⚠️ **지금 보고 있는 가게의 알림만** 바로 연다 — 다른 가게 알림을 지금 좌석으로 열면
 * 그 화면은 **지금 가게의 데이터**를 보여 준다(좌석 토큰이 매장을 정한다). 다른 가게 알림은 가게를 바꾸라고 말한다.
 */
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { formatKSTShort } from '@/utils/date'
import { toast } from '@/hooks/useToast'
import { notifTarget } from '@/lib/notif-target'
import { ChevronRight } from 'lucide-react'
import { MailIcon } from '@/components/icons/urdeal-icons'
import { ROW_SHELL_CLS, ROW_LABEL_CLS } from '../list-grammar'

const Sheet = lazy(() => import('./Sheet'))

export interface StoreNotification {
  id: number
  sellerId: number
  storeName: string | null
  type: string
  title: string
  message: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

export const STORE_NOTIF_PATH = '/api/seller/my-stores/notifications'

/** 링크 판정은 마이·콘솔 공용 — `@/lib/notif-target`. */
export { notifTarget }

export default function StoreNotifButton({ currentSellerId, onOpenPage, variant = 'pill' }: {
  /** 지금 보고 있는 가게 — 이 가게 알림만 바로 연다. */
  currentSellerId: number
  onOpenPage: (path: string) => void
  /**
   * 🧾 2026-10-25 (대표 확정 **내 가게 안 G**) — `row` 는 판 안의 **목록 줄**이다(`판매 알림 · 새 알림 N ›`).
   * 종전 알약은 '내 가게' 머리에 서서 머리줄을 둘로 쪼갰다. 같은 시트·같은 데이터이고 겉모양만 다르다.
   */
  variant?: 'pill' | 'row'
}) {
  const [items, setItems] = useState<StoreNotification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get(STORE_NOTIF_PATH, { params: { limit: 30 } })
      setItems(r.data?.data?.items ?? [])
      setUnread(Number(r.data?.data?.unread) || 0)
    } catch { setItems((prev) => prev ?? []) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function markRead(ids: number[] | 'all') {
    try {
      await api.post(`${STORE_NOTIF_PATH}/read`, ids === 'all' ? { all: true } : { ids })
      setItems((prev) => prev?.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, isRead: true } : n)) ?? prev)
      setUnread((u) => (ids === 'all' ? 0 : Math.max(0, u - ids.length)))
    } catch { /* 다음에 다시 열면 맞춰진다 */ }
  }

  function pick(n: StoreNotification) {
    if (!n.isRead) void markRead([n.id])
    const t = notifTarget(n.link)
    if (!t) return
    if (t.kind === 'go') { window.location.assign(t.path); return }
    if (n.sellerId !== currentSellerId) {
      toast.error(`${n.storeName ?? '다른 가게'} 알림이에요. 위에서 가게를 바꾼 뒤 열어 주세요`)
      return
    }
    setOpen(false)
    onOpenPage(t.path)
  }

  return (
    <>
      {variant === 'row' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={unread > 0 ? `판매 알림 ${unread}건` : '판매 알림'}
          className={`${ROW_SHELL_CLS} active:opacity-70`}
        >
          {/* 🎬 2026-11-02 시안 B2: 새 알림이 있으면 봉투가 한 번 흔들리고 숫자가 톡 뜬다(값이 바뀔 때마다 key 로 다시). */}
          <span key={`m${unread}`} className={`shrink-0 text-gray-500 dark:text-gray-400 ${unread > 0 ? 'ur-ring' : ''}`}><MailIcon className="w-[18px] h-[18px]" aria-hidden="true" /></span>
          <span className={ROW_LABEL_CLS}>판매 알림</span>
          {/* 🔵 새 알림이 있을 때만 블루 — 0 이면 회색 '새 알림 없음'(0 을 잉크로 굵게 쓰지 않는다). 아직 모르면 안 그린다. */}
          {items !== null && (
            unread > 0
              ? <span key={`n${unread}`} className="ur-popin shrink-0 text-[13px] font-bold text-brand-text tabular-nums">새 알림 {unread > 99 ? '99+' : unread}</span>
              : <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">새 알림 없음</span>
          )}
          <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `판매 알림 ${unread}건` : '판매 알림'}
        className="shrink-0 inline-flex items-center gap-1 h-7 px-3 -my-1 rounded-full bg-gray-100 dark:bg-white/10 text-[12px] font-semibold text-gray-600 dark:text-gray-300 active:opacity-70"
      >
        {/* 🔤 2026-10-20 (대표 "2,3,4 모두 다 고쳐줘"): 종 아이콘 → **글자**. 맨 위 머리줄의 종(내 알림)과
            이 종(가게 알림)이 한 화면에 둘이라 처음 보는 사람은 어느 쪽이 무엇인지 몰랐다. 글자는 시트 제목과 같다.
            알약 모양인 이유: 바로 옆 가게 이름과 붙어 "판매 알림 합정 살롱…" 한 덩어리로 읽혔다(하네스 렌더). */}
        <span>판매 알림</span>
        {unread > 0 && (
          <span key={`n${unread}`} className="ur-popin min-w-[16px] h-4 px-1 rounded-full bg-brand text-white text-[12px] leading-4 font-bold tabular-nums text-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      )}
      {open && (
        <Suspense fallback={null}>
          <Sheet title="판매 알림" onClose={() => setOpen(false)}>
            {items === null ? (
              <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">아직 알림이 없어요.</p>
            ) : (
              <>
                {unread > 0 && (
                  <div className="flex justify-end px-4 pt-3">
                    <button type="button" onClick={() => markRead('all')} className="text-[13px] font-semibold text-brand-text">모두 읽음</button>
                  </div>
                )}
                <ul className="divide-y divide-rule">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => pick(n)} className="w-full flex gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-[#1D1F29]">
                        <span aria-hidden="true" className={`mt-2 w-2 h-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand'}`} />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] truncate ${n.isRead ? 'font-semibold text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-white'}`}>{n.title}</span>
                          {n.message && <span className="mt-1 block text-[13px] text-gray-500 dark:text-gray-400 line-clamp-2">{n.message}</span>}
                          <span className="mt-1 block text-[12px] text-gray-400 dark:text-gray-500">
                            {n.storeName ? `${n.storeName} · ` : ''}{formatKSTShort(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Sheet>
        </Suspense>
      )}
    </>
  )
}
