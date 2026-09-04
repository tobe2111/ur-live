/**
 * 🏪 운영 매장 요약 — 내가 운영하는 매장들의 매출·주문을 한 화면에 (2026-09-04 대표 확정)
 *
 * ## 이 화면의 목적
 * 중개사 보수는 **유어딜이 지급하지 않는다.** 매장 몫(95%) 안에서 매장과 직접 정한다.
 * 그러면 "얼마를 받을지"를 정할 근거가 필요한데, 지금까지는 매장을 하나씩 전환해 들어가 보는
 * 수밖에 없었다. 이 화면이 그 근거를 한 장으로 모은다.
 *
 * ## 🔴 정직하게 말할 것
 * 운영자별 매출 귀속은 추적하지 않는다. 여기 숫자는 **매장의 총액**이다. 위임받은 매장은
 * '운영 시작 이후'를 따로 보여주는데, 그 구간이 그나마 방어 가능한 청구 근거다.
 * 화면에 "내가 만든 매출"이라고 쓰면 거짓말이 된다 — 아래 안내 문구가 그 경계를 밝힌다.
 *
 * 백엔드: GET /api/seller/operating-summary (seller-operators.routes.ts)
 */
import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import SellerLayout from '@/components/SellerLayout'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { formatWon, formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import { Store, Handshake, ArrowRight, RefreshCw } from 'lucide-react'

interface Row {
  seller_id: number
  business_name: string | null
  username: string | null
  status: string | null
  role: 'owner' | 'operator'
  source: 'link' | 'grant'
  granted_at: string | null
  products_active: number
  orders_total: number
  revenue_total: number
  orders_since_grant: number | null
  revenue_since_grant: number | null
}

export default function SellerOperatingSummaryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/api/seller/operating-summary')
      if (!r.data?.success) throw new Error(r.data?.error)
      setRows(r.data.data || [])
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      setError(ax.response?.data?.error || '요약을 불러오지 못했습니다')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const brokered = rows.filter(r => r.source === 'grant')
  const owned = rows.filter(r => r.source !== 'grant')
  const brokeredRevenue = brokered.reduce((a, r) => a + (r.revenue_since_grant ?? r.revenue_total), 0)

  return (
    <SellerLayout title="운영 매장 요약">
      <SEO title="운영 매장 요약 - 유어딜" description="내가 운영하는 매장들의 매출과 주문을 한 화면에서 봅니다." url="/seller/operating" />
      <DashboardPageHeader
        title="운영 매장 요약"
        subtitle="내가 운영을 맡은 매장들의 실적 — 매장과 정산을 정할 때 쓰는 근거"
        actions={
          <button onClick={load} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-[12px] font-bold flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
        }
      />

      {loading ? <DashboardLoading /> : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-2 underline font-bold">다시 시도</button>
        </div>
      ) : rows.length === 0 ? (
        <DashboardEmptyState
          title="운영 중인 매장이 없습니다"
          description="매장을 등록하거나, 사장님이 운영 권한을 주면 여기에 나타납니다."
        />
      ) : (
        <div className="space-y-4">
          {brokered.length > 0 && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <p className="text-[13px] font-bold text-gray-900">
                관리 중인 매장 {formatNumber(brokered.length)}곳 · 운영 시작 이후 매출 합계 {formatWon(brokeredRevenue)}
              </p>
              <p className="text-[12px] text-gray-600 mt-1.5 leading-relaxed">
                이 숫자는 <strong>매장의 매출</strong>입니다. 유어딜은 운영자별 기여를 따로 계산하지 않습니다.
                중개 보수는 유어딜이 지급하지 않고, 매장 몫에서 <strong>사장님과 직접</strong> 정하는 금액이라
                이 표는 그 대화의 근거로 쓰시라고 있는 것입니다.
              </p>
            </div>
          )}

          {[{ label: '관리 중인 매장', list: brokered, icon: Handshake },
            { label: '내 가게', list: owned, icon: Store }].map(({ label, list, icon: Icon }) => list.length === 0 ? null : (
            <section key={label}>
              <h2 className="text-[13px] font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                <Icon className="w-4 h-4 text-gray-500" /> {label} <span className="text-gray-400">{list.length}</span>
              </h2>
              <div className="space-y-2">
                {list.map(r => (
                  <div key={r.seller_id} className="p-4 bg-white border border-gray-200 rounded-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-gray-900 truncate">{r.business_name || `매장 #${r.seller_id}`}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {r.source === 'grant' ? '관리 중' : '내 가게'}
                          {r.granted_at ? ` · 운영 시작 ${formatKSTDate(r.granted_at)}` : ''}
                          {` · 활성 상품 ${formatNumber(r.products_active)}`}
                        </p>
                      </div>
                      <Link to="/seller/stores" className="shrink-0 text-[11px] text-gray-600 font-bold flex items-center gap-0.5 hover:text-gray-900">
                        매장 전환 <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-gray-500">매장 누적 매출</p>
                        <p className="text-[17px] font-bold text-gray-900">{formatWon(r.revenue_total)}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">주문 {formatNumber(r.orders_total)}건</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500">{r.granted_at ? '운영 시작 이후' : '기간 구분 없음'}</p>
                        <p className="text-[17px] font-bold text-gray-900">
                          {r.revenue_since_grant === null ? '—' : formatWon(r.revenue_since_grant)}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {r.orders_since_grant === null ? '내 가게는 전 기간이 내 것입니다' : `주문 ${formatNumber(r.orders_since_grant)}건`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <p className="text-[11px] text-gray-500 leading-relaxed">
            확정된 주문(결제 완료 이후)만 셉니다. 취소·환불된 주문은 빠집니다.
          </p>
        </div>
      )}
    </SellerLayout>
  )
}
