/**
 * 🎟️ **이용권 관리** — 유어딜 이용권(식사·미용·숙소·기타) 한 곳 〔2026-10-20 대표 *"상품관리 + 이용권 공구 이런 페이지들 각 역할이 모호해"*〕
 *
 * 그전엔 같은 이용권이 네 화면에 흩어져 있었다(라이브 실측):
 *   - '상품 관리' 의 "쇼핑 상품(배송)" 430개 중 약 405개가 이용권이었다 → 그 화면은 이제 교환권·쇼핑만(`kind=goods`)
 *   - '이용권 공구' 는 진행중/달성/미달성 탭을 줬는데 즉시판매(A2)라 **200개 전부 '진행중'** — 탭이 아무 일도 안 했다
 *   - '동네딜 상품 등록' 안에 목록이 또 있었다 → 그 화면은 이제 **올리기만** 한다('이용권 등록')
 *   - '공구 엔진 조종석' 에 상품 목록이 또 있었다 → 줄마다 [판매 설정] 으로 흡수
 *
 * 화면 하나 = 일 하나: 이 화면은 *이미 있는 이용권을 다룬다*. 결제·환불 로직은 무접촉 —
 *   강제 환불은 옛 '이용권 공구' 화면이 부르던 **같은 엔드포인트**(`/api/group-buy/admin/force-refund/:id`)를 부른다.
 * 🏪 운영자 몰(공구 서비스) 상품은 여기 안 나온다(서버 기본 스코프 `main`) — 그쪽은 '몰 상품·공구'.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { confirmDialog, alertDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/hooks/useToast'
import { Ticket, Plus, AlertTriangle, X } from 'lucide-react'
import DealList from './admin-dongnedeal/DealList'
import ManualDealForm from './admin-dongnedeal/ManualDealForm'
import type { DealRow } from './admin-dongnedeal/types'
import { GbSessionEditor, type GbRow, type GbSession, type GbMode } from '@/components/admin/GbSessionEditor'

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` } })

export default function AdminVouchersPage() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login')
  }, [navigate])

  const [nonce, setNonce] = useState(0)
  const refresh = () => setNonce((n) => n + 1)
  const [editing, setEditing] = useState<DealRow | null>(null)
  const [refundingId, setRefundingId] = useState<number | null>(null)
  // 판매 설정(옛 조종석) — 행을 누르면 그 상품의 현재 세션을 받아 편집기를 띄운다.
  const [settings, setSettings] = useState<{ row: GbRow | null; gbEngine: boolean | null; name: string } | null>(null)

  const openSettings = async (d: DealRow) => {
    setSettings({ row: null, gbEngine: null, name: d.name })
    try {
      const r = await api.get(`/api/admin/gb-cockpit/products/${d.id}`, auth())
      if (!r.data?.success) { toast.error(r.data?.error || '판매 설정을 불러오지 못했습니다'); setSettings(null); return }
      const p = r.data.product || {}
      setSettings({
        name: d.name,
        gbEngine: !!r.data.gb_engine,
        row: {
          id: Number(p.id), name: String(p.name || d.name), price: Number(p.price) || 0,
          original_price: p.original_price ?? null, category: p.category, seller_id: p.seller_id ?? null,
          restaurant_name: p.restaurant_name ?? null,
          gb: (r.data.gb || { mode: 'off' }) as GbSession,
          gb_effective_status: (r.data.gb_effective_status || 'off') as GbMode,
        },
      })
    } catch { toast.error('판매 설정을 불러오지 못했습니다'); setSettings(null) }
  }

  // 옛 '이용권 공구' 화면의 강제 환불 — 문구·확인 절차·엔드포인트 그대로(위치만 옮겼다).
  const forceRefund = async (d: DealRow) => {
    const reason = window.prompt(`[강제 환불] "${d.name}"\n\n환불 사유를 입력하세요 (5자 이상, audit_logs 기록):`, '')
    if (!reason || reason.trim().length < 5) return
    if (!(await confirmDialog({ message: `정말 환불하시겠습니까?\n\n• 미사용 voucher 모두 refunded 처리\n• 딜 결제건은 자동 환불\n• 상태 cancelled 변경\n• 참여자 + 셀러에게 알림 발송`, danger: true }))) return
    setRefundingId(d.id)
    try {
      const res = await api.post(`/api/group-buy/admin/force-refund/${d.id}`, { reason: reason.trim() }, auth())
      if (res.data?.success) { void alertDialog(`${res.data.data?.refunded ?? 0}건 환불 완료`); refresh() }
      else void alertDialog(`${res.data?.error || '환불 실패'}`)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      void alertDialog(`${e?.response?.data?.error || '환불 처리 중 오류'}`)
    } finally { setRefundingId(null) }
  }

  return (
    <AdminLayout title="이용권 관리">
      <div className="ur-content-wide px-4 lg:px-6 py-5 space-y-4">
        <DashboardPageHeader
          icon={<Ticket className="w-5 h-5" />}
          title="이용권 관리"
          subtitle="유어딜 이용권(식사·미용·숙소·기타) 전체 — 노출 켜기/끄기 · 수정 · 판매 설정 · 추첨 · 강제 환불을 여기서 합니다."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/dongnedeal-import" className="ur-btn ur-btn-md ur-btn-primary inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> 이용권 등록
          </Link>
          <Link to="/admin/stays" className="px-3 py-2 rounded-lg text-[13px] font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">숙소 예약·분쟁</Link>
          <Link to="/admin/voucher-disputes" className="px-3 py-2 rounded-lg text-[13px] font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">사용처리 분쟁</Link>
          <span className="text-[12px] text-gray-500">교환권(기프티콘)과 쇼핑 상품은 <Link to="/admin/products" className="font-semibold text-brand-text hover:underline">교환권·쇼핑 상품</Link>에 있습니다.</span>
        </div>

        <DealList
          nonce={nonce}
          onEdit={(d) => setEditing(d)}
          onChanged={refresh}
          onSettings={(d) => { void openSettings(d) }}
          onRefund={(d) => { void forceRefund(d) }}
          refundingId={refundingId}
        />
      </div>

      {editing && (
        <div className="fixed inset-0 z-[10500] bg-black/50 overflow-y-auto overscroll-contain p-4" onClick={() => setEditing(null)} role="dialog" aria-modal="true" aria-label="이용권 수정">
          <div className="max-w-3xl mx-auto my-6" onClick={(e) => e.stopPropagation()}>
            <ManualDealForm editDeal={editing} onCancelEdit={() => setEditing(null)} onSaved={() => { setEditing(null); refresh() }} />
          </div>
        </div>
      )}

      {settings && (
        <div className="fixed inset-0 z-[10500] bg-black/50 overflow-y-auto overscroll-contain p-4" onClick={() => setSettings(null)} role="dialog" aria-modal="true" aria-label="판매 설정">
          <div className="max-w-2xl mx-auto my-10 bg-white rounded-[var(--dash-radius,16px)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-gray-900">판매 설정</p>
                <p className="text-[13px] text-gray-500 truncate">{settings.name}</p>
              </div>
              <button onClick={() => setSettings(null)} aria-label="닫기" className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            {settings.gbEngine === false && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-rule bg-white p-3 text-[12px] text-tone-warn">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>공구 엔진이 <b>꺼져</b> 있습니다(<code>gb_engine_enabled</code>). 저장은 되지만 소비자 화면·결제엔 아직 적용되지 않습니다.</span>
              </div>
            )}
            {settings.row
              ? <GbSessionEditor row={settings.row} onSaved={() => setSettings(null)} />
              : <p className="text-[13px] text-gray-400 py-6 text-center">불러오는 중…</p>}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
