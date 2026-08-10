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
import MallNoticesPanel from './wholesale-malls/MallNoticesPanel'
import MallLinkRow from './wholesale-malls/MallLinkRow'
import MallAdvancedFields from './wholesale-malls/MallAdvancedFields'
import { EMPTY, type MallForm } from './wholesale-malls/mall-form'

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
  // 📣 2026-08-09 과업① — 몰별 GA4/네이버 확인/방문자 고지문.
  ga_id?: string | null
  naver_verification?: string | null
  privacy_md?: string | null
  active: number
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
  // 📣 2026-08-09: 몰별 '공지' 패널(팝업/배너 CRUD) — 매장 패널과 동일 규칙(한 번에 하나).
  const [openNotices, setOpenNotices] = useState<number | null>(null)

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
      ga_id: m.ga_id || '',
      naver_verification: m.naver_verification || '',
      privacy_md: m.privacy_md || '',
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
      // 📣 몰별 GA4/네이버 확인/방문자 고지문 — 서버가 형식 재검증(G-*/영숫자).
      ga_id: form.ga_id.trim() || null,
      naver_verification: form.naver_verification.trim() || null,
      privacy_md: form.privacy_md.trim() || null,
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
                  {/* 🔗 2026-08-03 (대표 "매장 링크를 어드민에서도"): 손님 링크 + 안 열리면 그 이유. */}
                  <MallLinkRow slug={m.slug} active={m.active} consumer_path={m.consumer_path} />
                  <div className="text-xs text-gray-400 mt-1 truncate inline-flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {m.host || t('admin.mall.noHost', { defaultValue: '호스트 미지정 (기본 fallback)' })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* 🏪 2026-08-03: 매장을 몰에 붙이는 유일한 경로 — 이게 없으면 몰 홈이 영원히 비어 있다. */}
                  <button onClick={() => setOpenSellers(openSellers === m.id ? null : m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${openSellers === m.id ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 hover:bg-gray-50 border-gray-200'}`}>
                    매장
                  </button>
                  {/* 📣 몰 팝업/공지 배너 — 몰 홈 상단 띠·1회 팝업으로 렌더(과업①). */}
                  <button onClick={() => setOpenNotices(openNotices === m.id ? null : m.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${openNotices === m.id ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 hover:bg-gray-50 border-gray-200'}`}>
                    공지
                  </button>
                  <button onClick={() => toggleActive(m)} title={m.active ? '비활성화' : '활성화'} className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">
                    {m.active ? t('admin.mall.deactivate', { defaultValue: '비활성' }) : t('admin.mall.activate', { defaultValue: '활성화' })}
                  </button>
                  <button onClick={() => openEdit(m)} title={t('common.edit', { defaultValue: '수정' })} className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg"><Edit className="w-4 h-4" /></button>
                </div>
                </div>
                {openSellers === m.id && <MallSellersPanel mallId={m.id} mallName={m.name} />}
                {openNotices === m.id && <MallNoticesPanel mallId={m.id} />}
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

              {/* 🔗 만들기 전에 **어디로 열릴지** 보여 준다 — slug 를 타이핑하는 동안 링크가 자란다.
                  (2026-08-04 대표 "체크 없이도 열리게" — 이제 기본이 열림이라 이 줄이 곧 결과다.) */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-[11px] text-gray-500">손님이 갈 주소</span>
                <p className="text-[13px] font-semibold text-gray-900 font-mono break-all">
                  urdeal.kr/{form.slug || <span className="text-gray-400">{'{주소}'}</span>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              {/* ⚙️ 고급 설정 — 도매몰·규제몰용 설정 전부(카테고리/기능토글/인허가/회사정보/소비자경로).
                  지우지 않고 **접는다**: 도매몰 존치라 기존 몰 수정 시 도달할 수 있어야 한다. */}
              <MallAdvancedFields form={form} setForm={setForm} />

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
