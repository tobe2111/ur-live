/**
 * 🛡️ 2026-05-15: 셀러 promo 코드 관리 페이지.
 *
 * URL: /seller/promo-codes
 *
 * 기능:
 *   - 코드 생성 (코드명 + 할인율 + audience + 한도 + 만료)
 *   - 발급 코드 리스트 + 사용 통계
 *   - 코드 비활성화 (soft delete)
 *   - 카카오톡 share (단골에게 공유)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tag, Plus, Copy, Trash2, Loader2, Share2, Users, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

interface PromoCode {
  id: number
  code: string
  discount_pct: number
  audience: 'all' | 'followers_only' | 'new_users_only' | string
  max_uses: number
  per_user_limit: number
  used_count: number
  is_active: number
  expires_at: string | null
  description: string | null
  redemption_count: number
  created_at: string
}

const AUDIENCE_LABEL: Record<string, string> = {
  all: '🌐 모두',
  followers_only: '⭐ 단골만',
  new_users_only: '🆕 신규만',
}

export default function SellerPromoCodesPage() {
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    code: '',
    discount_pct: 10,
    audience: 'followers_only' as 'all' | 'followers_only' | 'new_users_only',
    max_uses: 100,
    per_user_limit: 1,
    expires_at: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadCodes()
  }, [])

  function loadCodes() {
    setLoading(true)
    api.get('/api/promo/seller/list', { headers })
      .then(r => { if (r.data?.success) setCodes(r.data.data || []) })
      .catch(() => toast.error('코드 로드 실패'))
      .finally(() => setLoading(false))
  }

  async function createCode() {
    const code = form.code.trim().toUpperCase()
    if (!/^[A-Z0-9]{4,20}$/.test(code)) { toast.error('영문대문자 + 숫자 4-20자'); return }
    if (form.discount_pct < 1 || form.discount_pct > 99) { toast.error('할인율 1-99%'); return }

    setSubmitting(true)
    try {
      const res = await api.post('/api/promo/create', {
        code,
        discount_pct: form.discount_pct,
        audience: form.audience,
        max_uses: form.max_uses,
        per_user_limit: form.per_user_limit,
        expires_at: form.expires_at || null,
        description: form.description,
      }, { headers })
      if (res.data?.success) {
        toast.success(`✅ ${code} 코드 발급 완료!`)
        setShowCreate(false)
        setForm({ ...form, code: '', description: '' })
        loadCodes()
      } else {
        toast.error(res.data?.error || '발급 실패')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '발급 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteCode(id: number, code: string) {
    if (!confirm(`코드 ${code} 비활성화? (사용 기록은 유지됨)`)) return
    try {
      await api.delete(`/api/promo/${id}`, { headers })
      toast.success('비활성화 완료')
      loadCodes()
    } catch {
      toast.error('실패')
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('코드 복사됨')
    } catch { toast.error('복사 실패') }
  }

  async function shareCode(c: PromoCode) {
    const text = `🎁 ${c.discount_pct}% 할인 코드: ${c.code}\n${c.description || ''}\n공구에서 사용하세요!`
    if (navigator.share) {
      try { await navigator.share({ title: `${c.discount_pct}% 할인`, text }); return } catch { /* canceled */ }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success('share 메시지 복사됨')
    } catch { toast.error('실패') }
  }

  return (
    <SellerLayout title="할인 코드">
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="할인 코드 (Promo)"
          subtitle="단골 전용 / 신규 전용 / 모두 — 직접 발급하고 단골에게 공유"
          icon={<Tag className="h-5 w-5" />}
        />

        {/* 신규 발급 */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-md"
          >
            <Plus className="w-4 h-4" /> 새 할인 코드 발급
          </button>
        ) : (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
            <p className="text-sm font-bold text-gray-900">새 코드 발급</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">코드 (영문대문자 + 숫자 4-20자)</label>
              <input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) }))}
                placeholder="DANGOL10"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">할인율 (%)</label>
                <input
                  type="number" min="1" max="99"
                  value={form.discount_pct}
                  onChange={e => setForm(f => ({ ...f, discount_pct: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">대상</label>
                <select
                  value={form.audience}
                  onChange={e => setForm(f => ({ ...f, audience: e.target.value as typeof f.audience }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                >
                  <option value="followers_only">⭐ 단골만 (권장)</option>
                  <option value="new_users_only">🆕 신규 고객만</option>
                  <option value="all">🌐 모두</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">총 사용 한도 (0=무제한)</label>
                <input
                  type="number" min="0" max="100000"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">1인당 한도</label>
                <input
                  type="number" min="1" max="100"
                  value={form.per_user_limit}
                  onChange={e => setForm(f => ({ ...f, per_user_limit: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">만료일 (선택)</label>
              <input
                type="date"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">설명 (선택)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 200) }))}
                placeholder="단골 감사 이벤트"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold">취소</button>
              <button onClick={createCode} disabled={submitting} className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
                {submitting ? '발급 중…' : '발급'}
              </button>
            </div>
          </div>
        )}

        {/* 코드 리스트 */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : codes.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-900">발급한 코드 없음</p>
            <p className="text-xs text-gray-500 mt-1">위 버튼으로 첫 코드를 만들어보세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {codes.map(c => (
              <div key={c.id} className={`bg-white rounded-2xl p-4 border ${c.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <code className={`font-mono text-base font-extrabold ${c.is_active ? 'text-pink-600' : 'text-gray-400'}`}>{c.code}</code>
                      <span className="px-1.5 py-0.5 bg-pink-100 text-pink-700 rounded text-[10px] font-bold">{c.discount_pct}%</span>
                      <span className="text-[10px] text-gray-500">{AUDIENCE_LABEL[c.audience] || c.audience}</span>
                      {!c.is_active && <span className="text-[10px] text-gray-400">비활성</span>}
                    </div>
                    {c.description && <p className="text-xs text-gray-600 mt-0.5">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> 사용 {c.redemption_count}{c.max_uses > 0 && `/${c.max_uses}`}</span>
                      <span>1인당 {c.per_user_limit}회</span>
                      {c.expires_at && <span>~{new Date(c.expires_at).toLocaleDateString('ko-KR')}</span>}
                    </div>
                  </div>
                  {c.is_active && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => copyCode(c.code)} className="p-1.5 hover:bg-gray-100 rounded" aria-label="코드 복사">
                        <Copy className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button onClick={() => shareCode(c)} className="p-1.5 hover:bg-gray-100 rounded" aria-label="공유">
                        <Share2 className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                      <button onClick={() => deleteCode(c.id, c.code)} className="p-1.5 hover:bg-red-50 rounded" aria-label="비활성화">
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
          <p className="font-bold mb-1">💡 단골 코드 활용 팁</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>"단골만 (followers_only)" 옵션 → 단골 등록 사용자만 적용</li>
            <li>"단골에게 알림 발송" 페이지에서 코드 함께 공유 → 단골 보상</li>
            <li>1인당 1회 + 만료일 설정 → 스팸 방지</li>
            <li>비활성화한 코드는 신규 사용 X, 기존 사용 기록은 유지</li>
          </ul>
        </div>
      </div>
    </SellerLayout>
  )
}
