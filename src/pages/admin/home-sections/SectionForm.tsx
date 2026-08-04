import { useState } from 'react'
import { X } from 'lucide-react'
import {
  SECTION_SOURCES, SECTION_SOURCE_LABELS, DEFAULT_SECTION_SOURCE,
  SECTION_DEFAULT_LIMIT, SECTION_MAX_LIMIT, type SectionSource,
} from '@/shared/constants/home-showcase'
import { VOUCHER_CATEGORIES } from '@/shared/constants/voucher-categories'

/**
 * 🏠 홈 섹션 생성·수정 폼 (2026-08-04 대표 "없는 것도 다 해줘").
 *
 * 생성과 수정이 **같은 폼**이다. 두 벌로 두면 한쪽에만 필드가 추가되고, 그러면
 * "만들 때는 되는데 고칠 때는 안 되는" 필드가 생긴다 — 이 레포가 반복해 만난 어긋남이다.
 *
 * ⚠️ `layout`(grid3/grid2/scroll)은 **일부러 노출하지 않는다.** DB 컬럼은 있지만 홈 렌더가
 *    쓰지 않아(항상 같은 그리드) 폼에 넣으면 고를 수는 있는데 아무 일도 안 일어난다.
 *    없는 스위치를 보여주는 게 없는 것보다 나쁘다.
 */

export interface SectionFormValue {
  title: string
  subtitle: string
  source: SectionSource
  source_value: string
  limit_count: number
  more_href: string
}

/** 카테고리 한글 라벨 — 명칭 SSOT(2026-06-29): 카테고리 칩은 '식사/미용/숙소/기타'. */
const CATEGORY_LABELS: Record<string, string> = {
  meal_voucher: '식사', beauty_voucher: '미용', stay_voucher: '숙소', etc_voucher: '기타',
}

export const EMPTY_SECTION_FORM: SectionFormValue = {
  title: '', subtitle: '', source: DEFAULT_SECTION_SOURCE,
  source_value: '', limit_count: SECTION_DEFAULT_LIMIT, more_href: '',
}

export default function SectionForm({
  mode, initial, onSubmit, onCancel,
}: {
  mode: 'create' | 'edit'
  initial: SectionFormValue
  onSubmit: (v: SectionFormValue) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<SectionFormValue>(initial)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(form) } finally { setBusy(false) }
  }

  const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none'
  const label = 'block text-xs font-medium text-gray-700 mb-1.5'

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{mode === 'edit' ? '섹션 수정' : '새 섹션'}</h2>
        <button onClick={onCancel} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-gray-100">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label}>제목 *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              className={input} placeholder="지금 인기 이용권" />
          </div>
          <div>
            <label className={label}>부제 (선택)</label>
            <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
              className={input} placeholder="이번 주 많이 팔린 순" />
          </div>
        </div>

        <div>
          <label className={label}>상품을 고르는 방식</label>
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as SectionSource })}
            className={input}>
            {SECTION_SOURCES.map(s => <option key={s} value={s}>{SECTION_SOURCE_LABELS[s]}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-gray-400">
            {form.source === 'manual'
              ? "직접 고르면 목록에서 '상품 담기' 로 골라 담습니다. 손이 가는 대신 완전한 통제."
              : '규칙은 상품이 들어오고 나가는 대로 저절로 맞습니다 — 매일 손볼 필요가 없습니다.'}
          </p>
          {mode === 'edit' && initial.source !== form.source && (
            // ⚠️ 규칙↔직접 전환은 보이는 상품이 통째로 바뀐다. 담아둔 목록은 지워지지 않지만
            //    규칙으로 바꾸면 안 쓰이고, 다시 직접으로 돌리면 그대로 살아난다.
            <p className="mt-1.5 text-xs text-amber-600">
              {form.source === 'manual'
                ? '직접 고르기로 바꾸면 담아둔 상품이 없을 경우 홈에서 이 줄이 사라집니다.'
                : '규칙으로 바꾸면 담아둔 상품 대신 규칙이 뽑은 상품이 뜹니다(담긴 목록은 보존).'}
            </p>
          )}
        </div>

        {form.source === 'category' && (
          <div>
            <label className={label}>카테고리</label>
            <select value={form.source_value} onChange={e => setForm({ ...form, source_value: e.target.value })}
              className={input}>
              <option value="">전체 이용권</option>
              {VOUCHER_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
            </select>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label}>
              상품 수 <span className="text-gray-400 font-normal">(최대 {SECTION_MAX_LIMIT})</span>
            </label>
            <input type="number" min={1} max={SECTION_MAX_LIMIT} value={form.limit_count}
              onChange={e => setForm({ ...form, limit_count: parseInt(e.target.value, 10) || SECTION_DEFAULT_LIMIT })}
              className={input} />
          </div>
          <div>
            <label className={label}>더보기 링크 (선택)</label>
            <input value={form.more_href} onChange={e => setForm({ ...form, more_href: e.target.value })}
              className={input} placeholder="/vouchers" />
            <p className="mt-1.5 text-xs text-gray-400">사이트 내부 경로만 됩니다(외부 주소는 무시).</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">취소</button>
          <button type="submit" disabled={busy} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? '저장 중...' : mode === 'edit' ? '수정' : '생성'}
          </button>
        </div>
      </form>
    </div>
  )
}
