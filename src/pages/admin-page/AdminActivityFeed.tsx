/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminPage 최근 주문 활동 피드.
 *   30초 자동 갱신 + 새 주문 시 사운드 알림.
 *
 * 🛡️ 2026-07-27 (대표 신고 "누가 결제했는지 알 수 없어"):
 *   ① 구매자(회원명/이메일/수취인/연락처)를 행에 표시 — 이전엔 주문번호+금액만 있어
 *      운영자가 대시보드에서 결제 주체를 전혀 알 수 없었다(API 는 이미 내려주고 있었음).
 *   ② 날짜 표시 + KST 보정 — 이전엔 `new Date(created_at)` 를 시각만 렌더해
 *      (a) 몇 달 전 주문이 '오늘 활동'처럼 보이고
 *      (b) SQLite `datetime('now')`(UTC, Z 없음)를 브라우저 로컬로 오해석해 최대 9시간 어긋났다.
 *      → `formatKSTShort`(parseUTCDate 기반, AdminOrdersPage 의 formatKST 와 동일 규약).
 *   ③ 상태 라벨 정식화 — FAILED 는 '📝 FAILED' 가 아니라 '결제 실패'(=미결제).
 *   ④ 행 클릭 → /admin/orders?q={주문번호} 상세로 이동(그 페이지가 이미 ?q= 지원).
 *   ⑤ 새 주문 사운드 버그 — limit 고정이라 `list.length` 는 8에서 안 변해 알림이 영영 안 울렸다.
 *      → 최상단 주문번호 변화로 감지.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import { maskPhone } from '@/lib/mask'
import {
  FileText, Landmark, Banknote, Package, Truck, CheckCircle2, XCircle, Undo2, AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

interface OrderRow {
  status: string
  order_number: string
  total_amount: number
  created_at?: string
  user_id?: string | number | null
  user_name?: string | null
  user_email?: string | null
  shipping_name?: string | null
  shipping_phone?: string | null
  first_item_name?: string | null
}

/** 실제 돈이 들어온 상태 — '실결제만' 필터 기준. */
const PAID_STATUSES = new Set(['PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED'])

/** 라벨/색은 AdminOrdersPage STATUS_STYLES 와 동일 규약 유지. */
/**
 * 🎨 2026-09-01: 이모지 → lucide 선 아이콘. 이모지는 OS 마다 그림이 달라(윈도우 운영 PC 와
 *   맥에서 다른 그림) 상태를 색·모양으로 익히지 못하고, 굵기·정렬이 옆 텍스트와 안 맞는다.
 *   ⚠️ **라벨·색(dot/text)은 byte-불변** — `AdminOrdersPage` STATUS_STYLES 와 같은 규약이라
 *      한쪽만 바꾸면 두 화면이 갈린다. 바뀐 것은 글리프뿐이다.
 */
const STATUS_META: Record<string, { Icon: LucideIcon; label: string; dot: string; text: string }> = {
  PENDING:          { Icon: FileText,   label: '주문 접수',   dot: 'bg-amber-400',   text: 'text-amber-700' },
  AWAITING_PAYMENT: { Icon: Landmark,   label: '입금 대기',   dot: 'bg-amber-400',   text: 'text-amber-700' },
  PAID:             { Icon: Banknote,   label: '결제 완료',   dot: 'bg-blue-500',    text: 'text-blue-700' },
  DONE:             { Icon: Banknote,   label: '결제 완료',   dot: 'bg-blue-500',    text: 'text-blue-700' },
  PREPARING:        { Icon: Package,    label: '상품 준비',   dot: 'bg-indigo-500',  text: 'text-indigo-700' },
  SHIPPING:         { Icon: Truck,      label: '배송 중',     dot: 'bg-purple-500',  text: 'text-purple-700' },
  DELIVERED:        { Icon: CheckCircle2, label: '배송 완료', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  CANCELLED:        { Icon: XCircle,    label: '취소',        dot: 'bg-gray-300',    text: 'text-gray-500' },
  REFUNDED:         { Icon: Undo2,      label: '환불',        dot: 'bg-gray-300',    text: 'text-gray-500' },
  FAILED:           { Icon: AlertTriangle, label: '결제 실패', dot: 'bg-red-400',    text: 'text-red-600' },
}
function statusMeta(status: string) {
  return STATUS_META[status] || { Icon: FileText, label: status || '알 수 없음', dot: 'bg-gray-300', text: 'text-gray-500' }
}

/**
 * shipping_name 이 실명이 아닌 자리표시자인 경우 — 이용권(배송 없음) 주문은
 * `checkoutPage.voucherRecipient` 리터럴이 그대로 들어간다(useBeforePayment.ts).
 * 이걸 구매자명으로 쓰면 모든 이용권 주문이 같은 이름으로 보여 식별이 안 된다.
 */
const PLACEHOLDER_NAMES = new Set(['이용권 구매자', '공구권 구매자', '식사권 구매자', 'Voucher buyer'])
function realName(v: string | null | undefined): string {
  const s = (v || '').trim()
  return s && !PLACEHOLDER_NAMES.has(s) ? s : ''
}

/**
 * 구매자(결제 주체) 표기 — 회원명 > 수취인명 > 이메일 > 회원번호 순.
 * ⚠️ 수취인명(shipping_name)보다 **회원명(user_name)** 이 우선 — 질문이 "누가 결제했나" 이고,
 *    배송 주문의 수취인은 결제자와 다를 수 있다(선물 등). 수취인은 아래 보조줄에 따로 표기.
 * 전부 비면 '구매자 미상'(주문 생성이 인증 경로라 보통은 최소 user_id 가 있다).
 */
function buyerLabel(o: OrderRow): string {
  const name = realName(o.user_name) || realName(o.shipping_name)
  if (name) return name
  const email = (o.user_email || '').trim()
  if (email) return email
  if (o.user_id !== null && o.user_id !== undefined && String(o.user_id) !== '') return `회원 #${o.user_id}`
  return '구매자 미상'
}

/** 보조 식별자 — 이름만으론 동명이인/미상 구분이 안 되므로 이메일(없으면 회원번호). */
function buyerSubLabel(o: OrderRow): string {
  const email = (o.user_email || '').trim()
  if (email && email !== buyerLabel(o)) return email
  if (!email && o.user_id !== null && o.user_id !== undefined && String(o.user_id) !== '') return `회원 #${o.user_id}`
  return ''
}

export default function AdminActivityFeed() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [paidOnly, setPaidOnly] = useState(false)
  const lastTopRef = useRef<string | null>(null)

  useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
    const fetchOrders = () => {
      // 실결제만 보기에서도 8건이 채워지도록 여유 있게 받아온다(표시는 8건).
      api.get('/api/admin/orders?page=1&limit=24', h)
        .then(r => {
          const list: OrderRow[] = r.data.data?.orders || r.data.data || []
          const top = list[0]?.order_number ?? null
          // 🛡️ 최상단 주문번호가 바뀌면 새 주문 — 첫 로드(lastTopRef=null)에는 울리지 않음.
          if (top && lastTopRef.current && top !== lastTopRef.current) {
            try { new Audio('/static/notification.mp3').play().catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }) } catch { /* 자동재생 차단 등 — 무시 */ }
          }
          lastTopRef.current = top
          if (r.data.success) setOrders(list)
        }).catch(() => { /* empty activity list is shown on error */ })
    }
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  const visible = useMemo(
    () => (paidOnly ? orders.filter(o => PAID_STATUSES.has(o.status)) : orders).slice(0, 8),
    [orders, paidOnly],
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">최근 활동</h3>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={paidOnly}
            onChange={e => setPaidOnly(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600"
          />
          실결제만
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-gray-400">{paidOnly ? '실결제 주문이 없습니다' : '활동이 없습니다'}</p>
      ) : (
        <div className="space-y-1">
          {visible.map((o, i) => {
            const meta = statusMeta(o.status)
            const phone = maskPhone(o.shipping_phone)
            const sub = buyerSubLabel(o)
            // 수취인이 결제자와 다를 때만 별도 표기(선물·대리 수령 식별).
            const recipient = realName(o.shipping_name)
            const showRecipient = recipient && recipient !== buyerLabel(o) ? `수취 ${recipient}` : ''
            return (
              <Link
                key={o.order_number || i}
                to={`/admin/orders?q=${encodeURIComponent(o.order_number || '')}`}
                className="flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${meta.dot}`} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 font-semibold shrink-0 ${meta.text}`}>
                      <meta.Icon className="w-3.5 h-3.5" strokeWidth={1.9} aria-hidden />{meta.label}
                    </span>
                    <span className="font-medium text-gray-900 truncate">{buyerLabel(o)}</span>
                    <span className="text-gray-700 shrink-0">{formatNumber(o.total_amount || 0)}원</span>
                  </span>
                  <span className="block text-gray-400 truncate">
                    {[sub, showRecipient, phone, o.order_number, o.first_item_name].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-gray-400 shrink-0 mt-0.5">{o.created_at ? formatKSTShort(o.created_at) : ''}</span>
              </Link>
            )
          })}
        </div>
      )}
      <p className="mt-2 text-[10px] text-gray-400">
        결제 실패·취소는 실제 결제가 아닙니다. 행을 누르면 주문 상세로 이동합니다.
      </p>
    </div>
  )
}
