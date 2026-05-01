/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 셀러 전환 신청 모달.
 */
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { toast } from '@/hooks/useToast'

export default function SellerApplyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    phone: '',
    seller_type: 'influencer' as 'influencer' | 'store_owner' | 'both',
    youtube_email: '',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useFocusTrap<HTMLDivElement>(true)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async () => {
    if (!form.business_name || !form.business_number || !form.phone) {
      toast.error('사업자명, 사업자번호, 연락처를 입력해주세요')
      return
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number)) {
      toast.error('사업자번호 형식: XXX-XX-XXXXX')
      return
    }
    setSubmitting(true)
    try {
      const { default: api } = await import('@/lib/api')
      const res = await api.post('/api/seller/register-from-user', form)
      if (res.data.success) {
        toast.success('셀러 전환 신청 완료! 관리자 승인을 기다려주세요.')
        onSuccess()
        onClose()
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || '셀러 전환 신청에 실패했습니다'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const sellerTypes = [
    { value: 'influencer', label: '인플루언서', desc: '유튜브/SNS 라이브 방송' },
    { value: 'store_owner', label: '매장 사장님', desc: '맛집/매장 식사권 판매' },
    { value: 'both', label: '둘 다', desc: '방송 + 매장 운영' },
  ] as const

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[430px] bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="셀러 전환 신청"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">셀러로 활동하기</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          현재 계정으로 셀러 활동을 시작하세요. 관리자 승인 후 셀러 대시보드에 접근할 수 있습니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">셀러 유형</label>
            <div className="grid grid-cols-3 gap-2">
              {sellerTypes.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, seller_type: t.value }))}
                  className={`py-2.5 px-2 rounded-xl text-center transition-all ${
                    form.seller_type === t.value
                      ? 'bg-pink-500/20 border border-pink-500/50 text-pink-400'
                      : 'bg-[#1A1A1A] border border-[#2A2A2A] text-gray-400'
                  }`}
                >
                  <p className="text-[11px] font-bold">{t.label}</p>
                  <p className="text-[9px] mt-0.5 opacity-70">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">사업자명 (상호) *</label>
            <input
              value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="예: 유어딜 스튜디오"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">사업자번호 *</label>
            <input
              value={form.business_number}
              onChange={e => setForm(f => ({ ...f, business_number: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="123-45-67890"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">연락처 *</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="010-1234-5678"
            />
          </div>

          {form.seller_type !== 'store_owner' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">유튜브 구글 이메일</label>
              <input
                value={form.youtube_email}
                onChange={e => setForm(f => ({ ...f, youtube_email: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
                placeholder="라이브 방송에 사용할 구글 계정"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">소개 (선택)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-sm text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none resize-none"
              placeholder="채널 소개나 매장 설명을 간단히 적어주세요"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl text-sm active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {submitting ? '신청 중...' : '셀러 전환 신청하기'}
        </button>
      </div>
    </div>
  )
}
