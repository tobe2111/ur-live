import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { LayoutList, Plus, Trash2, Eye, EyeOff, X, ArrowUp, ArrowDown, ListPlus } from 'lucide-react'
import SectionProductPicker from './home-sections/SectionProductPicker'
import {
  SECTION_SOURCES, SECTION_SOURCE_LABELS, DEFAULT_SECTION_SOURCE,
  SECTION_DEFAULT_LIMIT, SECTION_MAX_LIMIT, type SectionSource,
} from '@/shared/constants/home-showcase'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'

/** 카테고리 한글 라벨 — 명칭 SSOT(2026-06-29): 카테고리 칩은 '식사/미용/숙소/기타'. */
const CATEGORY_LABELS: Record<string, string> = {
  meal_voucher: '식사', beauty_voucher: '미용', stay_voucher: '숙소', etc_voucher: '기타',
}

/**
 * 🏠 홈 섹션 관리 (2026-08-04 대표 시안 승인 "좋다 이렇게 가자").
 *
 * 홈 상단의 "지금 인기 이용권 / 오늘 마감 임박 / 주말에 떠나는 숙소" 같은 **줄**을 만든다.
 *
 * 🚫 **상품이 0건인 줄은 홈에 아예 안 나온다**(서버가 빼고 내려준다). 그래서 여기서 만들었는데
 *    홈에 안 보이면 "안 만들어졌다"가 아니라 **조건에 맞는 상품이 없다**는 뜻이다 — 아래 목록의
 *    비활성/규칙을 먼저 볼 것.
 */

interface Section {
  id: number
  title: string
  subtitle?: string | null
  is_active: number
  sort_order: number
  source?: string | null
  source_value?: string | null
  limit_count?: number | null
  more_href?: string | null
  products?: Array<{ id: number; name: string; price?: number | null; image_url?: string | null; restaurant_name?: string | null }>
}

const EMPTY = {
  title: '', subtitle: '', source: DEFAULT_SECTION_SOURCE as SectionSource,
  source_value: '', limit_count: SECTION_DEFAULT_LIMIT, more_href: '',
}

export default function AdminHomeSectionsPage() {
  const { data: sections = [], isLoading, isError, refetch } = useApiQuery<Section[]>(
    ['admin', 'home-sections'], '/api/sections/admin',
    { select: (r) => { const x = r as { success?: boolean; data?: Section[] }; return x?.success ? (x.data ?? []) : [] } },
  )
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  /** 상품 담기 패널이 열린 섹션 id (직접 고르기 전용). */
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)

  const flash = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { flash('섹션 제목은 필수입니다.', false); return }
    try {
      await api.post('/api/sections', {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        source: form.source,
        source_value: form.source === 'category' ? form.source_value : null,
        limit_count: form.limit_count,
        more_href: form.more_href.trim() || null,
      })
      setForm(EMPTY); setShowForm(false); refetch()
      flash('섹션이 생성되었습니다. (조건에 맞는 상품이 없으면 홈에는 안 보입니다)', true)
    } catch { flash('섹션 생성 실패', false) }
  }

  async function toggleActive(s: Section) {
    try {
      await api.put(`/api/sections/${s.id}`, { is_active: s.is_active ? 0 : 1 })
      refetch(); flash(s.is_active ? '비활성화했습니다.' : '활성화했습니다.', true)
    } catch { flash('상태 변경 실패', false) }
  }

  /**
   * 섹션 순서 바꾸기 — 서버는 배열 순서를 그대로 sort_order 로 쓴다(`POST /api/sections/reorder`).
   * 화면에 보이는 순서 = 홈에 뜨는 순서라, 여기서 올리고 내린 그대로 저장한다.
   */
  async function moveSection(index: number, dir: -1 | 1) {
    const next = [...sections]
    const j = index + dir
    if (j < 0 || j >= next.length || reordering) return
    ;[next[index], next[j]] = [next[j]!, next[index]!]
    setReordering(true)
    try {
      await api.post('/api/sections/reorder', { section_ids: next.map(s => s.id) })
      await refetch()
    } catch { flash('순서 변경 실패', false) }
    finally { setReordering(false) }
  }

  async function handleDelete(s: Section) {
    if (!(await confirmDialog({ message: `"${s.title}" 섹션을 삭제할까요?`, danger: true }))) return
    try { await api.delete(`/api/sections/${s.id}`); refetch(); flash('삭제했습니다.', true) }
    catch { flash('삭제 실패', false) }
  }

  return (
    <AdminLayout title="홈 섹션 관리">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="홈 섹션 관리"
          subtitle="메인 상단에 주제별 상품 줄을 만듭니다 · 상품이 없으면 그 줄은 홈에 안 나옵니다"
          icon={<LayoutList className="h-5 w-5" />}
          actions={
            <button onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> 새 섹션
            </button>
          }
        />

        {msg && (
          <div className={`p-4 rounded-xl text-sm font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg.text}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">새 섹션</h2>
              <button onClick={() => setShowForm(false)} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">제목 *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="지금 인기 이용권" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">부제 (선택)</label>
                  <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="이번 주 많이 팔린 순" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">상품을 고르는 방식</label>
                <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as SectionSource })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {SECTION_SOURCES.map(s => <option key={s} value={s}>{SECTION_SOURCE_LABELS[s]}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-gray-400">
                  {form.source === 'manual'
                    ? '직접 고르면 만든 뒤 목록에서 \'상품 담기\' 로 골라 담습니다. 손이 가는 대신 완전한 통제.'
                    : '규칙은 상품이 들어오고 나가는 대로 저절로 맞습니다 — 매일 손볼 필요가 없습니다.'}
                </p>
              </div>

              {form.source === 'category' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">카테고리</label>
                  <select value={form.source_value} onChange={e => setForm({ ...form, source_value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="">전체 이용권</option>
                    {VOUCHER_CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    상품 수 <span className="text-gray-400 font-normal">(최대 {SECTION_MAX_LIMIT})</span>
                  </label>
                  <input type="number" min={1} max={SECTION_MAX_LIMIT} value={form.limit_count}
                    onChange={e => setForm({ ...form, limit_count: parseInt(e.target.value, 10) || SECTION_DEFAULT_LIMIT })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">더보기 링크 (선택)</label>
                  <input value={form.more_href} onChange={e => setForm({ ...form, more_href: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="/vouchers" />
                  <p className="mt-1.5 text-xs text-gray-400">사이트 내부 경로만 됩니다(외부 주소는 무시).</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">취소</button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">생성</button>
              </div>
            </form>
          </div>
        )}

        {isError ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center">
            <p className="text-sm text-gray-500 mb-3">섹션을 불러오지 못했습니다.</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200">다시 시도</button>
          </div>
        ) : isLoading ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : sections.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center">
            <LayoutList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">아직 섹션이 없습니다. 없으면 홈은 지금 모습 그대로입니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((s, i) => {
              const src = (s.source || DEFAULT_SECTION_SOURCE) as SectionSource
              return (
                <div key={s.id} className={`bg-white rounded-xl shadow-sm p-4 ${s.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                      {s.subtitle && <p className="text-xs text-gray-400 mt-0.5">{s.subtitle}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                          {SECTION_SOURCE_LABELS[src]}
                        </span>
                        {src === 'category' && s.source_value && <span>· {CATEGORY_LABELS[s.source_value] ?? s.source_value}</span>}
                        <span>· {s.limit_count ?? SECTION_DEFAULT_LIMIT}개</span>
                        {s.more_href && <span>· 더보기 {s.more_href}</span>}
                        {src === 'manual' && (
                          <span className={(s.products?.length ?? 0) === 0 ? 'text-amber-600 font-medium' : ''}>
                            · 담긴 상품 {s.products?.length ?? 0}개{(s.products?.length ?? 0) === 0 ? ' (홈 미노출)' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* 순서 — 위/아래. 목록 순서가 곧 홈 순서다. */}
                      <div className="flex items-center">
                        <button onClick={() => moveSection(i, -1)} disabled={i === 0 || reordering} aria-label="위로"
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5 text-gray-500" /></button>
                        <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1 || reordering} aria-label="아래로"
                          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5 text-gray-500" /></button>
                      </div>
                      {src === 'manual' && (
                        <button onClick={() => setPickerFor(pickerFor === s.id ? null : s.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">
                          <ListPlus className="w-3.5 h-3.5" /> 상품 담기
                        </button>
                      )}
                      <button onClick={() => toggleActive(s)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200">
                        {s.is_active ? <><EyeOff className="w-3.5 h-3.5" /> 숨기기</> : <><Eye className="w-3.5 h-3.5" /> 노출</>}
                      </button>
                      <button onClick={() => handleDelete(s)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100">
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    </div>
                  </div>
                  {pickerFor === s.id && (
                    <SectionProductPicker
                      sectionId={s.id}
                      initial={s.products ?? []}
                      onClose={() => setPickerFor(null)}
                      onSaved={(t, ok) => { flash(t, ok); if (ok) refetch() }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
