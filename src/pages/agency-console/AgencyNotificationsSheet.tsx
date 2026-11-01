/**
 * 🔔 에이전시 콘솔 — 맡은 매장들의 판매 알림 시트 (2026-10-12 · 2026-10-24 우리 이용권 판매만)
 *   서버: `/api/agency-console/notifications`(우리 에이전시 · 운영 중 · 이 직원에게 배정된 매장).
 *   누르면 패널이 그 매장을 고르고 화면을 시트로 연다(`onPick`) — 좌석은 그 클릭에서만 받는다.
 */
import { formatKSTShort } from '@/utils/date'
import Sheet from '@/pages/user-profile/seller-section/Sheet'

export interface AgencyNotification {
  id: number
  /** 'agency_sale' = 우리 이용권 판매(2026-10-24 — 판매 기록에서 만든다). */
  type?: string
  sellerId: number
  storeName: string | null
  title: string
  message: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

export default function AgencyNotificationsSheet({ items, unread, onPick, onReadAll, onClose }: {
  items: AgencyNotification[] | null
  unread: number
  onPick: (n: AgencyNotification) => void
  onReadAll: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="판매 알림" onClose={onClose}>
      {items === null ? (
        <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">최근 30일 동안 팔린 우리 이용권이 없어요.</p>
      ) : (
        <>
          {unread > 0 && (
            <div className="flex justify-end px-4 pt-3">
              <button type="button" onClick={onReadAll} className="text-[13px] font-semibold text-brand-text">모두 읽음</button>
            </div>
          )}
          <ul className="divide-y divide-rule">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onPick(n)} className="flex w-full gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-white/5">
                  <span aria-hidden="true" className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-brand'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${n.isRead ? 'font-semibold text-gray-700 dark:text-gray-200' : 'font-bold text-gray-900 dark:text-white'}`}>{n.title}</span>
                    {n.message && <span className="mt-1 block line-clamp-2 text-[13px] text-gray-500 dark:text-gray-400">{n.message}</span>}
                    <span className="mt-1 block text-[12px] text-gray-400 dark:text-gray-500">{n.storeName ? `${n.storeName} · ` : ''}{formatKSTShort(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}
