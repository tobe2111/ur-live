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
    consumer_markup_pct: '20',
    user_id: '',
    callback_no: '',
    dev_mode: '1',
    api_enabled: '0',
    template_id: '',
    banner_id: '',
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
          consumer_markup_pct: s.data.data.settings.kt_alpha_consumer_markup_pct || '20',
          user_id: s.data.data.settings.kt_alpha_user_id || '',
          callback_no: s.data.data.settings.kt_alpha_callback_no || '',
          dev_mode: s.data.data.settings.kt_alpha_dev_mode || '1',
          api_enabled: s.data.data.settings.kt_alpha_api_enabled || '0',
          template_id: s.data.data.settings.kt_alpha_template_id || '',
          banner_id: s.data.data.settings.kt_alpha_banner_id || '',
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
        kt_alpha_consumer_markup_pct: edit.consumer_markup_pct,
        kt_alpha_user_id: edit.user_id,
        kt_alpha_callback_no: edit.callback_no,
        kt_alpha_dev_mode: edit.dev_mode,
        kt_alpha_api_enabled: edit.api_enabled,
        kt_alpha_template_id: edit.template_id,
        kt_alpha_banner_id: edit.banner_id,
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

  // 🛡️ 2026-05-19: 대량 등록 (KT Alpha catalog → products) 상태/액션.
  const [consumerStats, setConsumerStats] = useState<{
    total: number; visible: number; total_sold: number; avg_price: number; min_price: number; max_price: number;
  }>({ total: 0, visible: 0, total_sold: 0, avg_price: 0, min_price: 0, max_price: 0 })
  const [consumerLastImport, setConsumerLastImport] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<{
    inserted: number; updated: number; markup_pct: number;
    samples: Array<{ gift_code: string; name: string; price: number; action: string }>;
  } | null>(null)

  async function loadConsumerStats() {
    try {
      const r = await api.get('/api/admin/kt-alpha/consumer-products/stats', { headers: h() })
      if (r.data?.success) {
        setConsumerStats(r.data.data.stats || consumerStats)
        setConsumerLastImport(r.data.data.last_import_at || null)
      }
    } catch { /* fail-soft */ }
  }

  // 🛡️ 2026-05-19: 카테고리별 통계.
  const [categories, setCategories] = useState<Array<{
    category: string; total: number; visible: number; sold: number; min_price: number; max_price: number;
  }>>([])

  async function loadCategories() {
    try {
      const r = await api.get('/api/admin/kt-alpha/categories', { headers: h() })
      if (r.data?.success) setCategories(r.data.data || [])
    } catch { /* fail-soft */ }
  }

  useEffect(() => { loadConsumerStats(); loadCategories() }, []) // eslint-disable-line

  async function deleteByCategory(category: string, count: number) {
    if (!confirm(`'${category}' 카테고리의 ${count}개 상품을 모두 삭제합니다.\n복구 불가 — 계속할까요?`)) return
    try {
      const r = await api.post('/api/admin/kt-alpha/products/delete', { category }, { headers: h() })
      if (r.data?.success) {
        toast.success(`✅ ${r.data.data.deleted}개 삭제됨`)
        loadCategories(); loadConsumerStats()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '삭제 실패')
    }
  }

  async function deleteAllKtAlpha() {
    if (!confirm('⚠️ KT Alpha 상품 전체를 삭제합니다.\n복구 불가 — 정말 계속하시겠습니까?')) return
    if (!confirm('🚨 한 번 더 확인 — 정말 전체 삭제?')) return
    try {
      const r = await api.post('/api/admin/kt-alpha/products/delete', { all: true }, { headers: h() })
      if (r.data?.success) {
        toast.success(`✅ ${r.data.data.deleted}개 전체 삭제됨`)
        loadCategories(); loadConsumerStats()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '삭제 실패')
    }
  }

  // 🛡️ 2026-05-19: 교환권 전체 허위 리뷰 대량 생성 (사용자 요청).
  //   상품당 5-25개 (랜덤) 리뷰, 평점 4.3-4.8 분산, is_generated=1 플래그로 영구 추적.
  //   ⚠️ 법적: 전자상거래법 / 공정거래법상 허위 후기 책임은 사업주. 운영자 자체 결정 사용.
  async function generateBulkReviews() {
    if (!confirm('교환권 전체에 허위 리뷰를 대량 생성합니다.\n상품당 5-25개 (랜덤) · 평점 4.3-4.8 분산 · is_generated=1 표시.\n\n⚠️ 운영자 자체 책임. 계속하시겠습니까?')) return
    const reviewsPerInput = prompt('상품당 평균 리뷰 개수 (5-50, 기본 15)', '15')
    if (!reviewsPerInput) return
    const reviewsPerProduct = Number(reviewsPerInput)
    if (!Number.isFinite(reviewsPerProduct) || reviewsPerProduct < 5 || reviewsPerProduct > 50) {
      toast.error('5-50 사이 숫자 입력')
      return
    }
    toast.info('생성 중... (시간 소요. 페이지를 닫지 마세요.)')
    try {
      const r = await api.post(
        '/api/admin/reviews/generate-bulk-vouchers',
        { reviews_per_product: reviewsPerProduct },
        { headers: h() },
      )
      if (r.data?.success) {
        const d = r.data.data
        toast.success(`✅ 완료 — ${d.products_processed}개 상품 / ${d.total_reviews_inserted}개 리뷰 / 평균 ${d.avg_reviews_per_product}개${d.errors_count ? ` / 오류 ${d.errors_count}개` : ''}`)
      } else {
        toast.error(r.data?.error || '생성 실패')
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '생성 실패')
    }
  }

  // 🛡️ 2026-05-19: 교환권 생성 리뷰 일괄 삭제 (롤백용).
  async function deleteBulkReviews() {
    if (!confirm('교환권 전체에 생성된 허위 리뷰를 일괄 삭제합니다.\n복구 불가. 계속하시겠습니까?')) return
    if (!confirm('🚨 한 번 더 확인 — 정말 전체 삭제?')) return
    try {
      const r = await api.delete('/api/admin/reviews/generated-bulk-vouchers', { headers: h() })
      if (r.data?.success) toast.success(`✅ ${r.data.deleted}개 리뷰 삭제됨`)
      else toast.error(r.data?.error || '삭제 실패')
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '삭제 실패')
    }
  }

  // 🛡️ 2026-05-19 (사용자 신고: '/vouchers?category=voucher' 만 보임):
  //   gift_catalog.goods_type_detail + brand_name 키워드로 자동 재분류.
  //   bulk-import 시 fallback 으로 'voucher' 로 들어간 상품들도 적절한 카테고리로 재분배.
  async function autoClassifyCategories() {
    if (!confirm('KT Alpha 상품 전체를 자동 재분류합니다.\n• gift_catalog 의 goods_type_detail 우선\n• 그 다음 브랜드명 키워드 매칭 (스타벅스→카페, GS25→편의점 등)\n계속하시겠습니까?')) return
    toast.info('재분류 중...')
    try {
      const r = await api.post('/api/admin/kt-alpha/categories/auto-classify', {}, { headers: h() })
      if (r.data?.success) {
        const d = r.data.data
        const byCat = Object.entries(d.by_category || {}).map(([k, v]) => `${k}: ${v}`).join(', ')
        toast.success(`✅ ${d.updated}개 재분류 (불변 ${d.unchanged}, 미매칭 ${d.unmatched})${byCat ? '\n' + byCat : ''}`)
        loadCategories()
      } else {
        toast.error(r.data?.error || '재분류 실패')
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '재분류 실패')
    }
  }

  async function renameCategory(from: string) {
    const to = prompt(`'${from}' → 새 카테고리명?`, from)
    if (!to || to === from) return
    try {
      const r = await api.post('/api/admin/kt-alpha/categories/rename', { from, to }, { headers: h() })
      if (r.data?.success) {
        toast.success(`✅ ${r.data.data.updated}개 카테고리 변경됨`)
        loadCategories()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '변경 실패')
    }
  }

  async function runImport(dryRun: boolean) {
    if (!dryRun && !confirm(
      '⚠️ KT Alpha 상품을 일반 상품으로 자동 등록합니다.\n' +
      '\n· 마진 20% (kt_alpha_consumer_markup_pct 설정값)\n' +
      '· 딜 결제 전용\n· 노출 상태는 별도 토글로 제어\n\n' +
      'KT Alpha 측 사전 승인 받으셨나요? (B2B 정책 리스크)\n계속 진행하시겠습니까?'
    )) return
    setImporting(true)
    setDryRunResult(null)
    try {
      if (dryRun) {
        // 미리보기는 한 번만 (전체).
        const r = await api.post('/api/admin/kt-alpha/bulk-import',
          { dry_run: true }, { headers: h() })
        if (r.data?.success) {
          const d = r.data.data
          setDryRunResult({ inserted: d.inserted, updated: d.updated, markup_pct: d.markup_pct, samples: d.samples || [] })
          toast.success(`🔍 미리보기: 신규 ${d.inserted}건 / 갱신 ${d.updated}건`)
        }
        return
      }

      // 🛡️ 2026-05-19: 실제 등록은 200개씩 chunked (Cloudflare 30s timeout 회피).
      let totalInserted = 0
      let totalUpdated = 0
      let offset = 0
      const CHUNK = 200
      let iterations = 0
      const MAX_ITERATIONS = 50  // 안전 한도 (200 × 50 = 10,000개)

      while (iterations < MAX_ITERATIONS) {
        iterations++
        if (iterations > 1) {
          toast.info(`등록 중... (${totalInserted + totalUpdated} 처리됨)`)
        }
        const r = await api.post('/api/admin/kt-alpha/bulk-import',
          { limit: CHUNK, offset }, { headers: h() })
        if (!r.data?.success) {
          toast.error(r.data?.error || `${iterations}회차 실패 (offset=${offset})`)
          return
        }
        const d = r.data.data
        totalInserted += d.inserted || 0
        totalUpdated += d.updated || 0
        if (!d.has_more) break
        offset = d.next_offset
      }
      toast.success(`✅ 등록 완료 — 신규 ${totalInserted}건 / 갱신 ${totalUpdated}건`)
      loadConsumerStats()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '대량 등록 실패')
    } finally { setImporting(false) }
  }

  async function toggleConsumerVisibility(enabled: boolean) {
    if (enabled && !confirm(
      '⚠️ KT Alpha 상품 전체를 일반 사용자에게 노출합니다.\n' +
      'KT Alpha 측 사전 승인 받으셨나요? (정책 위반 시 Key 회수 위험)\n계속하시겠습니까?'
    )) return
    try {
      const r = await api.patch('/api/admin/kt-alpha/consumer-products/visibility',
        { enabled }, { headers: h() })
      if (r.data?.success) {
        toast.success(enabled ? '✅ 노출 ON' : '🔒 노출 OFF')
        loadConsumerStats()
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
              <KpiBox label="총 발송 시도" value={String(Number(sendStats.total ?? 0))} color="text-violet-600 bg-violet-50" icon={<Gift className="w-4 h-4" />} />
              <KpiBox label="발송 성공" value={String(Number(sendStats.sent ?? 0))} sub={Number(sendStats.failed ?? 0) > 0 ? `실패 ${sendStats.failed}` : undefined} color="text-emerald-600 bg-emerald-50" icon={<TrendingUp className="w-4 h-4" />} warn={Number(sendStats.failed ?? 0) > 0} />
              <KpiBox label="누적 거래액" value={`₩${Number(sendStats.total_amount ?? 0).toLocaleString()}`} color="text-pink-600 bg-pink-50" icon={<DollarSign className="w-4 h-4" />} />
            </div>

            {/* 설정 — 마진 + API config */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-bold text-gray-900">운영 설정</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 셀러 markup % */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    🏪 셀러 마진 markup (%)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={50} step={1}
                      value={edit.markup_pct}
                      onChange={(e) => setEdit({ ...edit, markup_pct: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-lg font-extrabold text-pink-600 w-12 text-right">{edit.markup_pct}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    셀러 정산: 1만원 공급가 → 셀러 차감 ₩{Math.floor(9400 * (1 + Number(edit.markup_pct) / 100)).toLocaleString()}
                  </p>
                </div>

                {/* 🛡️ 2026-05-19: 소비자 직판 markup % */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    🛒 소비자 마진 markup (%) — 딜 교환 전용
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={50} step={1}
                      value={edit.consumer_markup_pct}
                      onChange={(e) => setEdit({ ...edit, consumer_markup_pct: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-lg font-extrabold text-amber-600 w-12 text-right">{edit.consumer_markup_pct}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    소비자 직판: 1만원권 → 사용자 딜 차감 ₩{Math.floor(9400 * (1 + Number(edit.consumer_markup_pct) / 100)).toLocaleString()}
                    {Number(edit.consumer_markup_pct) !== 20 && consumerStats.total > 0 && (
                      <span className="block text-amber-600 font-bold mt-0.5">
                        ⚠️ 변경 후 '📦 대량 등록' 다시 실행해야 기존 {consumerStats.total}개 상품 가격 갱신
                      </span>
                    )}
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

                {/* template_id (카드 ID) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">MMS 카드 ID (template_id)</label>
                  <input type="text" value={edit.template_id}
                    onChange={(e) => setEdit({ ...edit, template_id: e.target.value })}
                    placeholder="예: 202507100302725"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                  <p className="text-[10px] text-gray-500 mt-1">KT Alpha 콘솔에서 발급받은 카드 ID (브랜드 디자인)</p>
                </div>

                {/* banner_id (배너 ID) */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">MMS 배너 ID (banner_id)</label>
                  <input type="text" value={edit.banner_id}
                    onChange={(e) => setEdit({ ...edit, banner_id: e.target.value })}
                    placeholder="예: 202507100352984"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
                  <p className="text-[10px] text-gray-500 mt-1">KT Alpha 콘솔에서 발급받은 배너 ID (브랜드 이미지)</p>
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

            {/* 🛡️ 2026-05-19: KT Alpha 상품 대량 등록 (소비자 직판) */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-amber-900">🛒 소비자 직판 (딜 교환 전용)</h3>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    KT Alpha 카탈로그를 일반 상품으로 등록 — 사용자가 딜로 교환 가능
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  consumerStats.visible > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {consumerStats.visible > 0 ? '노출 중' : '숨김'}
                </span>
              </div>

              {/* KPI — null 방어 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">등록 상품</p>
                  <p className="text-lg font-extrabold text-amber-900">{Number(consumerStats.total ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">노출 중</p>
                  <p className="text-lg font-extrabold text-emerald-700">{Number(consumerStats.visible ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">누적 판매</p>
                  <p className="text-lg font-extrabold text-pink-600">{Number(consumerStats.total_sold ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">평균 가격</p>
                  <p className="text-lg font-extrabold text-gray-900">₩{Math.floor(Number(consumerStats.avg_price ?? 0)).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => runImport(true)} disabled={importing}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  🔍 미리보기 (dry-run)
                </button>
                <button onClick={() => runImport(false)} disabled={importing || (catalogStats.active ?? 0) === 0}
                  className="px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {importing ? '등록 중...' : `📦 대량 등록 ${Number(catalogStats.active ?? 0).toLocaleString()}개`}
                </button>
                <button onClick={() => toggleConsumerVisibility((consumerStats.visible ?? 0) === 0)} disabled={(consumerStats.total ?? 0) === 0}
                  className={`px-3 py-2 text-white text-xs font-bold rounded-lg disabled:opacity-50 ${
                    consumerStats.visible > 0 ? 'bg-gray-700 hover:bg-gray-800' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}>
                  {consumerStats.visible > 0 ? '🔒 노출 OFF' : '🌐 노출 ON'}
                </button>
              </div>

              {dryRunResult && (
                <div className="mt-3 bg-white rounded-lg p-3 text-xs">
                  <p className="font-bold text-gray-900 mb-2">
                    🔍 dry-run 결과 · 신규 {dryRunResult.inserted} / 갱신 {dryRunResult.updated} · 마진 {dryRunResult.markup_pct}%
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {dryRunResult.samples.map((s) => (
                      <div key={s.gift_code} className="flex justify-between text-[11px]">
                        <span className="text-gray-600 truncate">[{s.action}] {s.name}</span>
                        <span className="font-mono text-pink-600">₩{s.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {dryRunResult.samples.length === 20 && <p className="text-[10px] text-gray-400 mt-1">… 외 다수</p>}
                </div>
              )}

              <p className="text-[10px] text-amber-800 mt-3 leading-relaxed">
                ⚠️ KT Alpha 비즈 API 가이드라인: 최종 소비자 직판 금지. 본 기능은 운영자 결정으로 활성화됨.
                <br/>승인 받기 전 노출 ON 하지 마세요 — Key 회수 위험.
                {consumerLastImport && <><br/>· 마지막 등록: {consumerLastImport}</>}
              </p>
            </div>

            {/* 🛡️ 2026-05-19: 카테고리 관리 + 상품 삭제 */}
            {categories.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">🗂️ 카테고리별 관리</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      KT Alpha 상품은 카테고리(편의점/카페/도서 등)로 자동 분류됨. 카테고리별 삭제 가능.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* 🛡️ 2026-05-19: KT Alpha 카테고리 자동 재분류 (gift_catalog + brand 키워드). */}
                    <button onClick={autoClassifyCategories}
                      className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                      title="goods_type_detail + brand 키워드로 자동 재분류"
                    >
                      🗂️ 카테고리 자동 재분류
                    </button>
                    {/* 🛡️ 2026-05-19: 허위 리뷰 대량 생성 / 삭제 (사용자 요청). */}
                    <button onClick={generateBulkReviews}
                      className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                      title="모든 교환권에 상품당 5-25개 리뷰 자동 생성"
                    >
                      ⭐ 리뷰 대량 생성
                    </button>
                    <button onClick={deleteBulkReviews}
                      className="px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700"
                      title="생성된 리뷰 일괄 삭제 (롤백)"
                    >
                      🧹 리뷰 정리
                    </button>
                    <button onClick={deleteAllKtAlpha}
                      className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">
                      🗑️ 상품 전체 삭제
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-[11px]">
                        <th className="px-3 py-2 text-left">카테고리</th>
                        <th className="px-3 py-2 text-right">전체</th>
                        <th className="px-3 py-2 text-right">노출 중</th>
                        <th className="px-3 py-2 text-right">판매</th>
                        <th className="px-3 py-2 text-right">가격대</th>
                        <th className="px-3 py-2 text-right">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {categories.map((c) => (
                        <tr key={c.category} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-bold text-gray-900">{c.category}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{Number(c.total ?? 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                            {Number(c.visible ?? 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-pink-600">{Number(c.sold ?? 0).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-500 text-[10px]">
                            ₩{Number(c.min_price ?? 0).toLocaleString()} ~ ₩{Number(c.max_price ?? 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => renameCategory(c.category)}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] rounded hover:bg-gray-200">
                                ✏️ 이름
                              </button>
                              <button onClick={() => deleteByCategory(c.category, c.total)}
                                className="px-2 py-1 bg-red-50 text-red-700 text-[10px] rounded hover:bg-red-100">
                                🗑️ 삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[10px] text-gray-400 mt-3">
                  ⓘ 삭제는 복구 불가. 다시 등록하려면 '📦 대량 등록' 다시 실행.
                </p>
              </div>
            )}

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
                          {Number(item.discount_rate ?? 0) > 0 && <span className="text-[10px] text-red-500 font-bold">{item.discount_rate}%</span>}
                          <span className="text-xs font-extrabold text-gray-900">₩{Number(item.sale_price ?? 0).toLocaleString()}</span>
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
