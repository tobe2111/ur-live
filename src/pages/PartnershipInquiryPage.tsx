/**
 * 🤝 2026-06-10 (사용자 요청): 광고/제휴 문의 페이지 — /partnership (공개).
 *   유형: 광고/제휴/매장 입점/상품 공급/기타. 접수 → 어드민 벨 알림 + /admin/partnership 접수함.
 *   화이트 테마 (+다크 쌍) — 소비자/외부 대면.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Handshake, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'

const TYPES = [
  { v: 'ad', l: '📣 광고 문의' },
  { v: 'partnership', l: '🤝 제휴 제안' },
  { v: 'store', l: '🏪 매장 입점' },
  { v: 'supply', l: '📦 상품 공급' },
  { v: 'other', l: '💬 기타' },
]

const inputCls = 'w-full h-12 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] px-3.5 text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-gray-900 dark:focus:border-white'

export default function PartnershipInquiryPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ type: 'partnership', company: '', name: '', phone: '', email: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!form.name.trim()) { toast.error('성함을 입력해주세요'); return }
    if (!form.phone.trim() && !form.email.trim()) { toast.error('연락처 또는 이메일 중 하나는 입력해주세요'); return }
    if (!form.message.trim()) { toast.error('문의 내용을 입력해주세요'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/partnership/inquiry', form)
      if (res.data?.success) setDone(true)
      else toast.error(res.data?.error || '접수에 실패했어요')
    } catch (err) {
      const e2 = err as { response?: { data?: { error?: string } } }
      toast.error(e2.response?.data?.error || '접수에 실패했어요 — 잠시 후 다시 시도해주세요')
    } finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#020202] flex items-center justify-center px-4">
        <SEO title="광고/제휴 문의 - 유어딜" description="광고, 제휴, 입점, 상품 공급 문의" url="/partnership" />
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
          <h1 className="mt-4 text-xl font-extrabold text-gray-900 dark:text-white">접수됐어요!</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            담당자가 확인 후 남겨주신 연락처/이메일로<br />영업일 기준 2일 내 회신드릴게요.
          </p>
          <button onClick={() => navigate('/')}
            className="mt-6 px-6 h-12 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-sm font-bold">
            홈으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020202] pb-24">
      <SEO title="광고/제휴 문의 - 유어딜" description="광고, 제휴, 매장 입점, 상품 공급 문의를 남겨주세요" url="/partnership" />
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center px-4 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="ml-1 text-[15px] font-bold text-gray-900 dark:text-white">광고/제휴 문의</h1>
        </div>
      </div>

      <div className="ur-content-narrow px-4 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center">
            <Handshake className="w-6 h-6 text-gray-900 dark:text-white" />
          </div>
          <div>
            <h2 className="text-[17px] font-extrabold text-gray-900 dark:text-white">함께 성장할 파트너를 찾습니다</h2>
            <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mt-0.5">광고 · 제휴 · 매장 입점 · 상품 공급 — 무엇이든 편하게 남겨주세요</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* 유형 */}
          <div className="flex flex-wrap gap-2">
            {TYPES.map(tp => (
              <button key={tp.v} type="button" onClick={() => setForm(f => ({ ...f, type: tp.v }))}
                className={`px-3.5 h-10 rounded-full text-[13px] font-bold transition-colors ${
                  form.type === tp.v
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 dark:bg-[#1A1A1A] dark:text-gray-300'
                }`}>
                {tp.l}
              </button>
            ))}
          </div>
          <input value={form.company} onChange={set('company')} maxLength={100} placeholder="회사/매장명 (선택)" className={inputCls} />
          <input value={form.name} onChange={set('name')} maxLength={60} placeholder="성함 (담당자) *" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.phone} onChange={set('phone')} maxLength={30} placeholder="연락처" inputMode="tel" className={inputCls} />
            <input value={form.email} onChange={set('email')} maxLength={120} placeholder="이메일" inputMode="email" className={inputCls} />
          </div>
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 -mt-1">연락처 또는 이메일 중 하나는 꼭 남겨주세요.</p>
          <textarea value={form.message} onChange={set('message')} maxLength={4000} rows={6}
            placeholder="문의 내용 * — 제안 배경, 원하시는 협업 형태, 일정 등을 자유롭게 적어주세요"
            className="w-full rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] px-3.5 py-3 text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none focus:outline-none focus:border-gray-900 dark:focus:border-white" />
          <button type="submit" disabled={submitting}
            className="w-full h-13 py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-[#020202] text-[15px] font-bold disabled:opacity-50">
            {submitting ? '접수 중…' : '문의 접수하기'}
          </button>
        </form>

        <p className="mt-5 text-[12px] text-gray-400 dark:text-gray-500 text-center">
          이메일 문의: jiwon@ur-team.com · 영업일 기준 2일 내 회신
        </p>
      </div>
    </div>
  )
}
