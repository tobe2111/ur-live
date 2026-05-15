/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): 셀러 → 단골 push 발송 페이지.
 *
 * mallpro 의 "단골 마케팅" 따라잡기.
 *
 * 셀러 본인이 직접 단골에게 알림 발송:
 *   - 신상품 등록
 *   - 라이브 시작
 *   - 공구 시작
 *   - 커스텀 메시지
 *
 * Rate limit: 5회/10분 (스팸 방지)
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Bell, Loader2, Megaphone, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

type Reason = 'new_product' | 'live_start' | 'group_buy' | 'custom'

const PRESETS: Record<Reason, { title: string; message: string; url: string }> = {
  new_product: {
    title: '🎁 신상품 출시',
    message: '새로운 상품이 등록되었어요. 단골 할인가로 만나보세요!',
    url: '/',
  },
  live_start: {
    title: '📺 라이브 시작',
    message: '지금 라이브가 시작됐어요. 같이 봐요!',
    url: '/',
  },
  group_buy: {
    title: '🔥 공구 시작',
    message: '새 공동구매가 시작됐어요. 빨리 참여하면 단계별 할인!',
    url: '/group-buy',
  },
  custom: {
    title: '',
    message: '',
    url: '/',
  },
}

export default function SellerNotifyFollowersPage() {
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  const [reason, setReason] = useState<Reason>('new_product')
  const [title, setTitle] = useState(PRESETS.new_product.title)
  const [message, setMessage] = useState(PRESETS.new_product.message)
  const [url, setUrl] = useState(PRESETS.new_product.url)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null)

  if (!isSellerAuthenticated()) { redirectToLogin(navigate); return null }

  function selectPreset(r: Reason) {
    setReason(r)
    if (r !== 'custom') {
      setTitle(PRESETS[r].title)
      setMessage(PRESETS[r].message)
      setUrl(PRESETS[r].url)
    } else {
      setTitle('')
      setMessage('')
    }
  }

  async function handleSubmit() {
    if (title.length < 2) { toast.error('제목 2자+ 입력'); return }
    if (message.length < 5) { toast.error('내용 5자+ 입력'); return }
    if (!confirm(`단골 전원에게 push 알림을 발송하시겠습니까?\n\n제목: ${title}\n내용: ${message}`)) return

    setSubmitting(true)
    setResult(null)
    try {
      const res = await api.post('/api/seller-public/notify-followers', {
        title, message, url: url || '/', reason,
      }, { headers })
      if (res.data?.success) {
        const sent = Number(res.data.data?.sent ?? 0)
        const total = Number(res.data.data?.total_followers ?? 0)
        setResult({ sent, total })
        toast.success(`✅ ${sent}/${total}명에게 발송 완료`)
      } else {
        toast.error(res.data?.error || '발송 실패')
      }
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: string } } }
      if (e?.response?.status === 429) {
        toast.error('너무 자주 발송하지 마세요 (10분에 5회 제한)')
      } else {
        toast.error(e?.response?.data?.error || '발송 실패')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SellerLayout title="단골에게 알림 발송">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="단골에게 알림 발송"
          subtitle="신상품 / 라이브 시작 / 공구 시작을 단골에게 push 로 알려보세요"
          icon={<Megaphone className="h-5 w-5" />}
        />

        {/* 발송 사유 프리셋 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">발송 종류</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'new_product', label: '🎁 신상품', desc: '신상품 출시 알림' },
              { key: 'live_start', label: '📺 라이브', desc: '라이브 시작 알림' },
              { key: 'group_buy', label: '🔥 공구', desc: '공동구매 시작' },
              { key: 'custom', label: '✍️ 커스텀', desc: '직접 작성' },
            ] as Array<{ key: Reason; label: string; desc: string }>).map(p => (
              <button
                key={p.key}
                onClick={() => selectPreset(p.key)}
                className={`p-3 rounded-xl text-left border-2 transition-all ${
                  reason === p.key
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">{p.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 입력 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">제목 (push notification title)</label>
            <input
              value={title} onChange={e => setTitle(e.target.value.slice(0, 100))}
              placeholder="2-100자"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">{title.length}/100</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">내용</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value.slice(0, 500))}
              placeholder="5-500자"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">{message.length}/500</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">클릭 시 이동 URL</label>
            <input
              value={url} onChange={e => setUrl(e.target.value.slice(0, 200))}
              placeholder="/group-buy/123"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-pink-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* 미리보기 */}
        <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-pink-700 mb-2 flex items-center gap-1">
            <Bell className="w-3 h-3" /> Push Notification 미리보기
          </p>
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <p className="text-sm font-bold text-gray-900">{title || '제목'}</p>
            <p className="text-xs text-gray-600 mt-0.5">{message || '내용'}</p>
            <p className="text-[10px] text-gray-400 mt-1">유어딜 · 방금 전</p>
          </div>
        </div>

        {/* 결과 */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">✓</div>
            <div>
              <p className="text-sm font-bold text-green-700">발송 완료</p>
              <p className="text-xs text-green-600 mt-0.5">{result.sent}/{result.total}명에게 push 전송됨</p>
            </div>
          </div>
        )}

        {/* 발송 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-800 space-y-1">
            <p className="font-bold">발송 시 주의</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>10분 내 5회 까지만 발송 가능 (스팸 방지)</li>
              <li>단골 등록한 사용자에게만 전송됨</li>
              <li>너무 잦은 발송은 단골 해제 유발 — 정말 중요한 알림만</li>
              <li>push 미수신 사용자는 dashboard 알림으로 fallback</li>
            </ul>
          </div>
        </div>

        {/* 발송 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={submitting || title.length < 2 || message.length < 5}
          className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? '발송 중…' : '단골 전원에게 알림 발송'}
        </button>
      </div>
    </SellerLayout>
  )
}
