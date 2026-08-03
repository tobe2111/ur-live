/**
 * 🏬 2026-06-09 멀티-몰 테넌시 Phase 1-b — 어드민 도매 몰 관리.
 *   슈퍼-어드민이 카테고리별 도매몰(식품/패션 등)을 생성/수정/비활성.
 *   백엔드: GET/POST /api/admin/wholesale-malls, PATCH /api/admin/wholesale-malls/:id.
 *   기본 몰(id=1)은 비활성 가드(백엔드). 라이트 고정 테마(대시보드 — dark: 없음).
 *
 *   default-mall-identical: 몰을 추가하지 않으면 기본 몰(유통스타트)만 표시 → 소비자/도매 동작 불변.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoadError } from '@/components/dashboard'
import ImageUpload from '@/components/upload/ImageUpload'
import { Building2, Loader2, Plus, Edit, X, Globe, Check } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { normalizeAdminRole } from '@/shared/admin-roles'
import { validateMallColor } from '@/shared/mall/branding'
import MallSellersPanel from './wholesale-malls/MallSellersPanel'

interface MallRow {
  id: number
  slug: string
  name: string
  host: string | null
  brand_name: string | null
  brand_color: string | null
  logo_url: string | null
  deposit_account: string | null
  commission_rate: number | null
  categories_json: string | null
  // 🏥 규제 몰(인허가) + 🧩 기능 토글 + 🏢 회사(푸터) 정보 — 2026-07-03/04 몰별 설정.
  requires_license?: number | null
  consumer_path?: number | null
  license_label?: string | null
  features_json?: string | null
  company_json?: string | null
  active: number
}

// 🏢 몰별 회사(푸터) 정보 필드 — WholesaleFooter BUSINESS_INFO 키와 1:1. 비우면 기본(유통스타트) 폴백.
const COMPANY_FIELDS: { key: string; label: string; ph: string }[] = [
  { key: 'company', label: '상호', ph: '사람과고리' },
  { key: 'ceo', label: '대표자', ph: '송유미' },
  { key: 'bizRegNo', label: '사업자등록번호', ph: '108-20-56790' },
  { key: 'mailOrderNo', label: '통신판매신고', ph: '제 20174-서울중구-0242호' },
  { key: 'address', label: '주소', ph: '서울 중구 …' },
  { key: 'tel', label: '전화(고객센터)', ph: '02-2038-0996' },
  { key: 'fax', label: '팩스', ph: '0303-3443-4424' },
  { key: 'csEmail', label: '이메일', ph: 'cs@example.com' },
  { key: 'bankName', label: '입금 은행', ph: '우체국' },
  { key: 'bankNo', label: '입금 계좌번호', ph: '014084-02-129530' },
  { key: 'bankHolder', label: '예금주', ph: '사람과고리(송유미)' },
]

interface MallForm {
  slug: string
  name: string
  host: string
  brand_name: string
  brand_color: string
  logo_url: string
  deposit_account: string
  commission_rate: string
  categories_json: string
  requires_license: boolean
  consumer_path: boolean
  license_label: string
  features_json: string
  company: Record<string, string>
  active: boolean
}

const EMPTY: MallForm = {
  slug: '', name: '', host: '', brand_name: '', brand_color: '#111827',
  logo_url: '', deposit_account: '', commission_rate: '', categories_json: '',
  requires_license: false, consumer_path: false, license_label: '', features_json: '', company: {}, active: true,
}

const DEFAULT_MALL_ID = 1

export default function AdminWholesaleMallsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<MallRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MallForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  // 🏪 2026-08-03: 몰별 '매장' 패널 펼침. 목록이 길어지지 않게 **한 번에 하나만** 연다.
  const [openSellers, setOpenSellers] = useState<number | null>(null)

  const { data: malls, isLoading: loading, isError, error, refetch } = useApiQuery<MallRow[]>(
    ['admin', 'wholesale-malls'], '/api/admin/wholesale-malls',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: (r: any) => (r?.success ? ((r.malls ?? []) as MallRow[]) : []),
      staleTime: 10 * 60 * 1000,
    },
  )
  const list = malls ?? []

  function refresh() {
    qc.invalidateQueries({ queryKey: ['admin', 'wholesale-malls'] })
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }
  function openEdit(m: MallRow) {
    setEditing(m)
    setForm({
      slug: m.slug || '',
      name: m.name || '',
      host: m.host || '',
      brand_name: m.brand_name || '',
      brand_color: m.brand_color || '#111827',
      logo_url: m.logo_url || '',
      deposit_account: m.deposit_account || '',
      commission_rate: m.commission_rate != null ? String(m.commission_rate) : '',
      categories_json: m.categories_json || '',
      requires_license: !!m.requires_license,
      consumer_path: !!m.consumer_path,
      license_label: m.license_label || '',
      features_json: m.features_json || '',
      company: (() => { try { const cj = JSON.parse(m.company_json || ''); return (cj && typeof cj === 'object' && !Array.isArray(cj)) ? cj : {} } catch { return {} } })(),
      active: !!m.active,
    })
    setShowForm(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.slug.trim()) { toast.error(t('admin.mall.slugRequired', { defaultValue: 'slug를 입력해 주세요 (영소문자/숫자/하이픈)' })); return }
    if (!form.name.trim()) { toast.error(t('admin.mall.nameRequired', { defaultValue: '몰 이름을 입력해 주세요' })); return }
    // categories_json 유효성(입력했을 때만) — 잘못된 JSON 저장 방지.
    if (form.categories_json.trim()) {
      try { JSON.parse(form.categories_json) } catch { toast.error(t('admin.mall.catJsonInvalid', { defaultValue: '카테고리 JSON 형식이 올바르지 않습니다' })); return }
    }
    const commission = form.commission_rate.trim()
    const body: Record<string, unknown> = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      host: form.host.trim() || null,
      brand_name: form.brand_name.trim() || null,
      brand_color: form.brand_color.trim() || null,
      logo_url: form.logo_url.trim() || null,
      deposit_account: form.deposit_account.trim() || null,
      commission_rate: commission && Number.isFinite(Number(commission)) ? Number(commission) : null,
      categories_json: form.categories_json.trim() || null,
      // 🏥 인허가 게이트 + 🧩 기능 토글 + 🏢 회사(푸터) 정보.
      requires_license: form.requires_license ? 1 : 0,
      consumer_path: form.consumer_path ? 1 : 0,
      license_label: form.license_label.trim() || null,
      features_json: form.features_json.trim() || null,
      company_json: (() => {
        const entries = Object.entries(form.company).filter(([, v]) => typeof v === 'string' && v.trim())
        return entries.length ? JSON.stringify(Object.fromEntries(entries.map(([k, v]) => [k, v.trim()]))) : null
      })(),
      active: form.active ? 1 : 0,
    }
    // features_json 유효성(입력했을 때만).
    if (form.features_json.trim()) {
      try { JSON.parse(form.features_json) } catch { toast.error('기능 토글 JSON 형식이 올바르지 않습니다'); return }
    }
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/api/admin/wholesale-malls/${editing.id}`, body)
        toast.success(t('admin.mall.updated', { defaultValue: '몰이 수정되었습니다' }))
      } else {
        await api.post('/api/admin/wholesale-malls', body)
        toast.success(t('admin.mall.created', { defaultValue: '몰이 생성되었습니다' }))
      }
      setShowForm(false)
      refresh()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('admin.mall.saveFailed', { defaultValue: '저장에 실패했습니다' }))
    } finally { setSaving(false) }
  }

  async function toggleActive(m: MallRow) {
    if (m.id === DEFAULT_MALL_ID && m.active) {
      toast.error(t('admin.mall.cannotDeactivateDefault', { defaultValue: '기본 몰은 비활성화할 수 없습니다' }))
      return
    }
    try {
      await api.patch(`/api/admin/wholesale-malls/${m.id}`, { active: m.active ? 0 : 1 })
      refresh()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('admin.mall.statusFailed', { defaultValue: '상태 변경에 실패했습니다' }))
    }
  }

  // 🔒 2026-06-29 (대표): 도매몰 관리는 슈퍼어드민 전용 — 다른 역할이 URL 직접진입해도 차단(백엔드 쓰기도 super-only).
  const isSuper = typeof window !== 'undefined' && normalizeAdminRole(localStorage.getItem('admin_role')) === 'super'
  if (!isSuper) {
    return (
      <AdminLayout title={t('admin.mall.title', { defaultValue: '도매 몰 관리' })}>
        <div className="ur-content-full px-4 lg:px-8 py-16 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-700">{t('admin.mall.superOnly', { defaultValue: '도매몰 관리는 슈퍼관리자만 접근할 수 있어요.' })}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.mall.superOnlyHint', { defaultValue: '몰 생성·수정 권한이 필요하면 슈퍼관리자에게 문의하세요.' })}</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={t('admin.mall.title', { defaultValue: '도매 몰 관리' })}>
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <DashboardPageHeader
            icon={<Building2 className="w-5 h-5" />}
            title={t('admin.mall.heading', { defaultValue: '도매 몰 관리' })}
            subtitle={t('admin.mall.subtitle', { defaultValue: '카테고리별 도매몰(식품/패션 등)을 생성·관리합니다. 호스트별 브랜딩(이름·로고·색)이 적용됩니다.' })}
          />
          <button onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold shrink-0">
            <Plus className="w-4 h-4" /> {t('admin.mall.addMall', { defaultValue: '몰 추가' })}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : isError ? (
          // 🛡️ 2026-06-29 (audit): fetch 실패를 '몰 없음'으로 위장 금지 — 에러+재시도.
          <DashboardLoadError error={error} onRetry={refetch} loginPath="/admin/login" label="도매 몰" />
        ) : list.length === 0 ? (
          <p className="text-center text-gray-400 py-20">{t('admin.mall.empty', { defaultValue: '등록된 몰이 없습니다.' })}</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {list.map((m) => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-4">
                {/* 브랜드 색 + 로고 미리보기 */}
                <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center text-white font-extrabold text-sm" style={{ background: m.brand_color || '#111827' }}>
                  {m.logo_url ? <img src={m.logo_url} alt={m.name} className="w-full h-full object-cover" /> : (m.name || '?').slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900 truncate">{m.name}</span>
                    <span className="text-xs font-mono text-gray-500">{m.slug}</span>
                    {m.id === DEFAULT_MALL_ID && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">기본 몰</span>}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{m.active ? '활성' : '비활성'}</span>
                    {!!m.consumer_path && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700" title="소비자 도메인 경로로 열림">소비자 공개</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate inline-flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {m.host || t('admin.mall.noHost', { defaultValue: '호스트 미지정 (기본 fallback)' })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* 🏪 2026-08-03: 매장을 몰에 붙이는 유일한 경로 — 이게 없으면 몰 홈이 영원히 비어 있다. */}
                  <button onClick={() => setOpenSellers(openSellers === m.id ? null : m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${openSellers === m.id ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 hover:bg-gray-50 border-gray-200'}`}>
                    매장
                  </button>
                  <button onClick={() => toggleActive(m)} title={m.active ? '비활성화' : '활성화'} className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">
                    {m.active ? t('admin.mall.deactivate', { defaultValue: '비활성' }) : t('admin.mall.activate', { defaultValue: '활성화' })}
                  </button>
                  <button onClick={() => openEdit(m)} title={t('common.edit', { defaultValue: '수정' })} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                </div>
                </div>
                {openSellers === m.id && <MallSellersPanel mallId={m.id} mallName={m.name} />}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          {t('admin.mall.hostHint', { defaultValue: '호스트는 쉼표로 여러 개 지정 가능합니다 (예: a.com,b.com). 매칭되는 호스트가 없으면 기본 몰이 표시됩니다.' })}
        </p>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editing ? t('admin.mall.editMall', { defaultValue: '몰 수정' }) : t('admin.mall.addMall', { defaultValue: '몰 추가' })}</h3>
              <button onClick={() => setShowForm(false)} aria-label={t('common.close', { defaultValue: '닫기' })}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">slug *</label>
                  <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} maxLength={40} disabled={!!editing && editing.id === DEFAULT_MALL_ID}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 font-mono disabled:bg-gray-50" placeholder="food-mall" />
                  <p className="text-[11px] text-gray-400 mt-1">{t('admin.mall.slugHint', { defaultValue: '영소문자/숫자/하이픈만' })}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.name', { defaultValue: '몰 이름' })} *</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={80}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder="식품 도매몰" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.host', { defaultValue: '호스트(들)' })}</label>
                <input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} maxLength={300}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder="food.utongstart.com, www.food.com" />
                <p className="text-[11px] text-gray-400 mt-1">{t('admin.mall.hostInputHint', { defaultValue: '쉼표로 여러 호스트 지정. 비우면 호스트 라우팅 없음.' })}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.brandName', { defaultValue: '브랜드명' })}</label>
                  <input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} maxLength={80}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder={t('admin.mall.brandNamePlaceholder', { defaultValue: '헤더 워드마크 (미입력 시 몰 이름)' })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.brandColor', { defaultValue: '브랜드 색' })}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form.brand_color) ? form.brand_color : '#111827'} onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))}
                      className="h-10 w-12 rounded-lg border border-gray-200 p-1 cursor-pointer" aria-label={t('admin.mall.brandColor', { defaultValue: '브랜드 색' })} />
                    <input value={form.brand_color} onChange={(e) => setForm((f) => ({ ...f, brand_color: e.target.value }))} maxLength={20}
                      className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 font-mono" placeholder="#111827" />
                  </div>
                  {/* 🎨 대비 미리보기 — 서버가 어차피 400 으로 막지만(wholesale-malls-admin.routes),
                      제출한 뒤에 알면 왕복이 한 번 늘고 무엇이 문제인지도 안 보인다.
                      이 색은 **면**이고 그 위에 흰 글자가 올라간다(몰 홈 아바타·안전결제 띠). */}
                  {(() => {
                    const v = validateMallColor(form.brand_color)
                    if (v.ok) return null
                    return <p className="mt-1.5 text-[11px] text-red-600">{v.reason}</p>
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.logo', { defaultValue: '로고' })}</label>
                <ImageUpload value={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} tokenKey="admin_token" label={t('admin.mall.logo', { defaultValue: '로고' })} aspectRatio="square" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.categories', { defaultValue: '카테고리 (JSON)' })}</label>
                <textarea value={form.categories_json} onChange={(e) => setForm((f) => ({ ...f, categories_json: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 font-mono"
                  placeholder='[{"id":"food","label":"식품"},{"id":"snack","label":"간식"}]' />
                <p className="text-[11px] text-gray-400 mt-1">{t('admin.mall.catHint', { defaultValue: '비우면 기본 카테고리 사용. [{id,label}] 배열.' })}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.depositAccount', { defaultValue: '입금 계좌' })}</label>
                  <input value={form.deposit_account} onChange={(e) => setForm((f) => ({ ...f, deposit_account: e.target.value }))} maxLength={500}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder="국민 123-45-6789 (예금주)" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('admin.mall.commission', { defaultValue: '수수료율 (%)' })}</label>
                  <input type="number" step="0.1" value={form.commission_rate} onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400" placeholder="10" />
                  <p className="text-[11px] text-gray-400 mt-1">이 몰의 플랫폼 마진%(공급가 = 원가×(1+%)). 비우면 전역 수수료 사용 — 표시가·결제가에 즉시 적용.</p>
                </div>
              </div>

              {/* 🏬 2026-08-01 세션 ③-a — 소비자 도메인 경로 개방.
                  ⚠️ 기본 OFF(fail-closed). 켜지 않으면 `urdeal.kr/{슬러그}` 로 열리지 않는다.
                  도매몰(유통스타트·메디스타트)은 자기 호스트에 살므로 **끈 채로 둔다**. */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
                  <input type="checkbox" checked={form.consumer_path} onChange={(e) => setForm((f) => ({ ...f, consumer_path: e.target.checked }))} className="w-4 h-4" />
                  소비자 도메인에서 열기 — <code className="text-xs bg-gray-100 px-1 rounded">urdeal.kr/{form.slug || '{주소}'}</code>
                </label>
                <p className="text-[11px] text-gray-400">
                  운영자 몰(공구)만 켠다. <b>도매몰은 끈 채로 둘 것</b> — 켜면 B2B 몰이 소비자 도메인 경로로 노출된다.
                </p>
              </div>

              {/* 🏥 규제 몰(인허가) — 가입 시 신고번호 필수 여부 + 필드 라벨 */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
                  <input type="checkbox" checked={form.requires_license} onChange={(e) => setForm((f) => ({ ...f, requires_license: e.target.checked }))} className="w-4 h-4" />
                  가입 시 인허가(신고번호) 필수 — 규제 몰
                </label>
                {form.requires_license && (
                  <input value={form.license_label} onChange={(e) => setForm((f) => ({ ...f, license_label: e.target.value }))} maxLength={80}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400"
                    placeholder="인허가 필드 라벨 — 예: 의료기기 판매업 신고번호" />
                )}
              </div>

              {/* 🧩 기능 토글(제외 레이어) — {"키": false} 로 이 몰에서 기능 숨김. 비우면 전 기능 ON. */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">기능 토글 (JSON — 이 몰에서 뺄 기능)</label>
                <textarea value={form.features_json} onChange={(e) => setForm((f) => ({ ...f, features_json: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 font-mono"
                  placeholder='{"dropship": false}' />
                <p className="text-[11px] text-gray-400 mt-1">비우면 전 기능 켜짐. 예: {'{"dropship": false}'} = 이 몰에서 대량발주(드랍십) 숨김.</p>
              </div>

              {/* 🏢 회사(푸터) 정보 — 비운 칸은 기본(유통스타트) 정보로 폴백. 푸터/고객센터/약관에 반영. */}
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-bold text-gray-700 mb-2">푸터 사업자 정보 <span className="font-normal text-gray-400">— 비운 칸은 기본(유통스타트) 정보 사용</span></p>
                <div className="grid grid-cols-2 gap-2.5">
                  {COMPANY_FIELDS.map((cf) => (
                    <div key={cf.key} className={cf.key === 'address' || cf.key === 'mailOrderNo' ? 'col-span-2' : ''}>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">{cf.label}</label>
                      <input value={form.company[cf.key] || ''} maxLength={300}
                        onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, [cf.key]: e.target.value } }))}
                        className="w-full h-9 px-2.5 rounded-lg border border-gray-200 text-[13px] text-gray-900 outline-none focus:border-gray-400" placeholder={cf.ph} />
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="w-4 h-4"
                  disabled={!!editing && editing.id === DEFAULT_MALL_ID} />
                {t('admin.mall.active', { defaultValue: '활성' })}
                {!!editing && editing.id === DEFAULT_MALL_ID && <span className="text-[11px] text-gray-400">({t('admin.mall.defaultLocked', { defaultValue: '기본 몰은 항상 활성' })})</span>}
              </label>

              <button type="submit" disabled={saving} className="w-full h-11 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {editing ? t('admin.mall.saveEdit', { defaultValue: '수정 저장' }) : t('admin.mall.createMall', { defaultValue: '몰 생성' })}
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
