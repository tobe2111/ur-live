/**
 * 🛡️ 2026-05-19: 어드민 — KT Alpha (기프티쇼) 관리 페이지.
 *
 *   - 비즈머니 잔액 + 마지막 조회 시각 + '갱신' 버튼
 *   - 마진 (markup_pct) 슬라이더
 *   - dev_yn / user_id / callback_no 설정
 *   - 카탈로그 통계 + 수동 sync 트리거
 *   - 발송 통계 (sent/failed/total_amount)
 *   - 카탈로그 미리보기 (검색 + 상위 30개)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Gift, RefreshCw, DollarSign, TrendingUp, AlertTriangle, Settings, Package } from 'lucide-react'

interface Settings {
  kt_alpha_api_enabled?: string
  kt_alpha_dev_mode?: string
  kt_alpha_markup_pct?: string
  kt_alpha_user_id?: string
  kt_alpha_callback_no?: string
  kt_alpha_biz_money_balance?: string
  kt_alpha_biz_money_check_at?: string
  kt_alpha_last_sync_at?: string
  kt_alpha_last_sync_count?: string
}

interface CatalogItem {
  gift_code: string
  name: string
  brand_name: string
  sale_price: number
  real_price: number
  discount_rate: number
  image_url_small: string | null
  goods_state: string
  is_active: number
  goods_type_detail: string | null
  popular: number
  valid_period_type: string | null
  valid_period_days: number | null
}

export default function AdminKtAlphaPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Settings>({})
  const [catalogStats, setCatalogStats] = useState({ total: 0, active: 0 })
  const [sendStats, setSendStats] = useState({ total: 0, sent: 0, failed: 0, total_amount: 0 })
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [q, setQ] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // 편집 가능한 설정 (input state).
  const [edit, setEdit] = useState({
    markup_pct: '5',
    user_id: '',
    callback_no: '',
    dev_mode: '1',
    api_enabled: '0',
  })

  function h() { return { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([
        api.get('/api/admin/kt-alpha/settings', { headers: h() }),
        api.get('/api/admin/kt-alpha/catalog?limit=30', { headers: h() }),
      ])
      if (s.data?.success) {
        setSettings(s.data.data.settings || {})
        setCatalogStats(s.data.data.catalog || { total: 0, active: 0 })
        setSendStats(s.data.data.send_stats || { total: 0, sent: 0, failed: 0, total_amount: 0 })
        setEdit({
          markup_pct: s.data.data.settings.kt_alpha_markup_pct || '5',
          user_id: s.data.data.settings.kt_alpha_user_id || '',
          callback_no: s.data.data.settings.kt_alpha_callback_no || '',
          dev_mode: s.data.data.settings.kt_alpha_dev_mode || '1',
          api_enabled: s.data.data.settings.kt_alpha_api_enabled || '0',
        })
      }
      if (c.data?.success) setCatalog(c.data.data || [])
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  async function searchCatalog() {
    try {
      const r = await api.get(`/api/admin/kt-alpha/catalog?q=${encodeURIComponent(q)}&limit=30`, { headers: h() })
      if (r.data?.success) setCatalog(r.data.data || [])
    } catch { /* noop */ }
  }

  async function saveSettings() {
    setSavingSettings(true)
    try {
      const r = await api.patch('/api/admin/kt-alpha/settings', {
        kt_alpha_markup_pct: edit.markup_pct,
        kt_alpha_user_id: edit.user_id,
        kt_alpha_callback_no: edit.callback_no,
        kt_alpha_dev_mode: edit.dev_mode,
        kt_alpha_api_enabled: edit.api_enabled,
      }, { headers: h() })
      if (r.data?.success) { toast.success('설정 저장됨'); loadAll() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '저장 실패')
    } finally { setSavingSettings(false) }
  }

  async function runSync() {
    if (!confirm('카탈로그 sync 시작? (전체 페이지 fetch, 1-2분 소요)')) return
    setSyncing(true)
    try {
      const r = await api.post('/api/admin/kt-alpha/sync', {}, { headers: h() })
      if (r.data?.success) {
        const { synced, deactivated, balance, error } = r.data.data
        if (error) toast.error(error)
        else toast.success(`${synced}건 sync · ${deactivated}건 비활성 · 잔액 ₩${(balance || 0).toLocaleString()}`)
        loadAll()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || 'sync 실패')
    } finally { setSyncing(false) }
  }

  async function refreshBalance() {
    try {
      const r = await api.post('/api/admin/kt-alpha/balance', {}, { headers: h() })
      if (r.data?.success) {
        toast.success(`잔액: ₩${(r.data.data.balance || 0).toLocaleString()}`)
        loadAll()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  const balance = Number(settings.kt_alpha_biz_money_balance) || 0
  const balanceLow = balance > 0 && balance < 100_000
  const balanceEmpty = balance === 0

  return (
    <AdminLayout title="KT Alpha (기프티쇼)">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="KT Alpha (기프티쇼) 운영"
          subtitle="비즈머니 + 카탈로그 sync + 마진 정책 + 발송 통계"
          icon={<Gift className="h-5 w-5" />}
          actions={
            <div className="flex gap-2">
              <button onClick={refreshBalance} className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                💰 잔액 갱신
              </button>
              <button onClick={runSync} disabled={syncing}
                className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'sync 중...' : '수동 sync'}
              </button>
            </div>
          }
        />

        {loading ? <DashboardLoading /> : (
          <>
            {/* 비즈머니 잔액 — 가장 중요 */}
            <div className={`rounded-2xl border-2 p-5 ${
              balanceEmpty ? 'bg-red-50 border-red-300' :
              balanceLow ? 'bg-amber-50 border-amber-300' :
              'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-600 tracking-wide">💰 비즈머니 잔액</p>
                  <p className={`text-3xl font-black mt-1 ${
                    balanceEmpty ? 'text-red-700' :
                    balanceLow ? 'text-amber-700' : 'text-emerald-700'
                  }`}>
                    ₩{balance.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    마지막 조회: {settings.kt_alpha_biz_money_check_at || '없음'}
                  </p>
                </div>
                {balanceLow && (
                  <div className="text-right">
                    <AlertTriangle className="w-6 h-6 text-amber-600 ml-auto" />
                    <p className="text-[11px] text-amber-700 font-bold mt-1">잔액 부족</p>
                    <p className="text-[10px] text-amber-700">기프티쇼 콘솔에서 충전</p>
                  </div>
                )}
              </div>
              {balanceEmpty && (
                <div className="mt-3 p-2 bg-red-100 rounded text-[11px] text-red-800">
                  ⚠️ 잔액 0원 — 모든 voucher 발송 차단됩니다. 기프티쇼 콘솔에서 비즈머니 충전 필요.
                </div>
              )}
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiBox label="활성 상품" value={`${catalogStats.active}/${catalogStats.total}`} color="text-blue-600 bg-blue-50" icon={<Package className="w-4 h-4" />} />
              <KpiBox label="총 발송 시도" value={String(sendStats.total)} color="text-violet-600 bg-violet-50" icon={<Gift className="w-4 h-4" />} />
              <KpiBox label="발송 성공" value={String(sendStats.sent)} sub={sendStats.failed > 0 ? `실패 ${sendStats.failed}` : undefined} color="text-emerald-600 bg-emerald-50" icon={<TrendingUp className="w-4 h-4" />} warn={sendStats.failed > 0} />
              <KpiBox label="누적 거래액" value={`₩${(sendStats.total_amount || 0).toLocaleString()}`} color="text-pink-600 bg-pink-50" icon={<DollarSign className="w-4 h-4" />} />
            </div>

            {/* 설정 — 마진 + API config */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">운영 설정</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* markup % */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    셀러 차감 markup (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={30} step={1}
                      value={edit.markup_pct}
                      onChange={(e) => setEdit({ ...edit, markup_pct: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-lg font-extrabold text-pink-600 w-12 text-right">{edit.markup_pct}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    예시: 1만원 (KT 공급가 9,400원) × 1.{String(edit.markup_pct).padStart(2, '0')} = 셀러 차감 ₩{Math.floor(9400 * (1 + Number(edit.markup_pct) / 100)).toLocaleString()}
                  </p>
                </div>

                {/* dev_mode */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">개발/상용 모드</label>
                  <select value={edit.dev_mode} onChange={(e) => setEdit({ ...edit, dev_mode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="1">개발 (Y) — 테스트 상품 2종만</option>
                    <option value="0">상용 (N) — 실 거래 (승인 필요)</option>
                  </select>
                </div>

                {/* user_id */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">KT Alpha 회원 ID</label>
                  <input type="text" value={edit.user_id}
                    onChange={(e) => setEdit({ ...edit, user_id: e.target.value })}
                    placeholder="기프티쇼 비즈 회원 ID"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                  <p className="text-[10px] text-gray-500 mt-1">0204 발송 / 0301 잔액 조회 시 필수</p>
                </div>

                {/* callback_no */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">발신 번호</label>
                  <input type="text" value={edit.callback_no}
                    onChange={(e) => setEdit({ ...edit, callback_no: e.target.value })}
                    placeholder="01012345678 (- 제외)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                  <p className="text-[10px] text-gray-500 mt-1">MMS 발송 시 발신자 번호 (- 자동 제거)</p>
                </div>

                {/* api_enabled */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">API 활성화</label>
                  <select value={edit.api_enabled} onChange={(e) => setEdit({ ...edit, api_enabled: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="0">비활성 (셀러 voucher 옵션 숨김)</option>
                    <option value="1">활성 (셀러가 voucher 선택 가능)</option>
                  </select>
                </div>
              </div>

              <button onClick={saveSettings} disabled={savingSettings}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingSettings ? '저장 중...' : '설정 저장'}
              </button>

              <p className="text-[10px] text-gray-400 mt-3">
                ⓘ 마지막 sync: {settings.kt_alpha_last_sync_at || '없음'} · {settings.kt_alpha_last_sync_count || 0}건
              </p>
            </div>

            {/* 카탈로그 미리보기 */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">📦 카탈로그 미리보기</h3>
                <div className="flex gap-2">
                  <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchCatalog()}
                    placeholder="상품명/브랜드/키워드 검색"
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg w-60" />
                  <button onClick={searchCatalog} className="text-xs px-3 py-1.5 bg-gray-100 rounded-lg">검색</button>
                </div>
              </div>

              {catalog.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-8">
                  카탈로그 비어있음 — '수동 sync' 버튼으로 fetch
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {catalog.map((item) => (
                    <div key={item.gift_code} className={`border rounded-lg overflow-hidden ${item.is_active ? 'border-gray-200' : 'border-red-200 opacity-60'}`}>
                      <div className="aspect-square bg-gray-100">
                        {item.image_url_small ? <img src={item.image_url_small} alt={item.name} className="w-full h-full object-cover" loading="lazy" /> : null}
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] text-gray-500 font-semibold">{item.brand_name}</p>
                        <p className="text-xs font-bold text-gray-900 line-clamp-2">{item.name}</p>
                        <div className="flex items-baseline gap-1 mt-1">
                          {item.discount_rate > 0 && <span className="text-[10px] text-red-500 font-bold">{item.discount_rate}%</span>}
                          <span className="text-xs font-extrabold text-gray-900">₩{item.sale_price.toLocaleString()}</span>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{item.gift_code}</p>
                        {!item.is_active && <p className="text-[9px] text-red-600 mt-0.5 font-bold">⊘ 비활성</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function KpiBox({ label, value, sub, color, icon, warn }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode; warn?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] sm:text-xs font-medium text-gray-500">{label}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
      </div>
      <p className="text-base sm:text-lg font-extrabold text-gray-900">{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 font-semibold ${warn ? 'text-red-600' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}
