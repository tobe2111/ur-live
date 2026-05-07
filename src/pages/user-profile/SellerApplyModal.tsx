import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { toast } from '@/hooks/useToast'

/**
 * 사업자번호 자동 포맷터: 입력값을 000-00-00000 형식으로 변환.
 * 숫자만 추출 후 3-2-5 자리로 하이픈 삽입.
 */
function formatBusinessNumber(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

/**
 * 휴대폰번호 자동 포맷터: 010-XXXX-XXXX.
 */
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function SellerApplyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    phone: '',
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
      toast.error(t('sellerApply.validationError', { defaultValue: '사업자명, 사업자번호, 연락처를 입력해주세요' }))
      return
    }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number)) {
      toast.error(t('sellerApply.formatError', { defaultValue: '사업자번호 형식: 000-00-00000' }))
      return
    }
    setSubmitting(true)
    try {
      const { default: api } = await import('@/lib/api')
      // seller_type 은 백엔드 default 'influencer' 사용 (UI 에선 제거 — 사용자에게 무의미)
      const res = await api.post('/api/seller/register-from-user', { ...form, seller_type: 'influencer' })
      if (res.data.success) {
        toast.success(t('sellerApply.success', { defaultValue: '셀러 전환 신청 완료! 관리자 승인을 기다려주세요.' }))
        onSuccess()
        onClose()
      }
    } catch (err: unknown) {
      // 🛡️ React #31 방지: 백엔드 error 가 객체({message, code}) 일 수 있어 강제 string 변환.
      const e = err as { response?: { data?: { error?: string | { message?: string } } }; message?: string }
      const rawErr = e?.response?.data?.error
      const errMsg = typeof rawErr === 'string' ? rawErr
        : (typeof rawErr === 'object' && rawErr?.message) ? rawErr.message
        : (e?.message || '')
      toast.error(errMsg || t('sellerApply.failed', { defaultValue: '셀러 전환 신청에 실패했습니다' }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-[430px] bg-gray-50 dark:bg-[#121212] rounded-t-3xl px-5 pt-5 pb-8 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('sellerApply.dialogLabel', { defaultValue: '셀러 전환 신청' })}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('sellerApply.title', { defaultValue: '셀러로 활동하기' })}</h2>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: '닫기' })} className="p-1 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
          {t('sellerApply.subtitle', { defaultValue: '현재 계정으로 셀러 활동을 시작하세요. 관리자 승인 후 셀러 대시보드에 접근할 수 있습니다.' })}
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('sellerApply.businessName', { defaultValue: '사업자명 (상호) *' })}</label>
            <input
              value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder={t('sellerApply.businessNamePlaceholder', { defaultValue: '예: 유어딜 스튜디오' })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('sellerApply.businessNumber', { defaultValue: '사업자번호 *' })}</label>
            <input
              value={form.business_number}
              onChange={e => setForm(f => ({ ...f, business_number: formatBusinessNumber(e.target.value) }))}
              inputMode="numeric"
              maxLength={12}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="000-00-00000"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('sellerApply.phone', { defaultValue: '연락처 *' })}</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
              inputMode="numeric"
              maxLength={13}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder="010-1234-5678"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('sellerApply.youtubeEmail', { defaultValue: '유튜브 구글 이메일 (선택)' })}</label>
            <input
              value={form.youtube_email}
              onChange={e => setForm(f => ({ ...f, youtube_email: e.target.value }))}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none"
              placeholder={t('sellerApply.youtubeEmailPlaceholder', { defaultValue: '라이브 방송에 사용할 구글 계정' })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('sellerApply.description', { defaultValue: '소개 (선택)' })}</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-600 focus:border-pink-500/50 focus:outline-none resize-none"
              placeholder={t('sellerApply.descriptionPlaceholder', { defaultValue: '채널 소개나 매장 설명을 간단히 적어주세요' })}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 py-3.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-xl text-sm active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {submitting ? t('sellerApply.submitting', { defaultValue: '신청 중...' }) : t('sellerApply.submit', { defaultValue: '셀러 전환 신청하기' })}
        </button>
      </div>
    </div>
  )
}
