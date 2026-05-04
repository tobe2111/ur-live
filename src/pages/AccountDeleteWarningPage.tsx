/**
 * 회원 탈퇴 안내 페이지
 *
 * 🛡️ 2026-05-01: 디자인 시스템 정렬 + Option B 반영.
 *   - AccountSettingsPage 와 일관된 다크 테마 (bg-[#020202])
 *   - 카드 스타일: rounded-2xl bg-white/[0.04], 미니멀 보더
 *   - 텍스트 정정: 30일 soft delete + 복원 가능 명시 (이전엔 "영구 삭제" 만 강조)
 *   - 이모지 과다 → 아이콘 시스템 통일
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import SEO from '@/components/SEO'
import {
  AlertTriangle,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  ShieldOff,
  Wallet,
  Package,
  Clock,
  Heart,
} from 'lucide-react'
import { getUserId, logout as authLogout } from '@/utils/auth'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function AccountDeleteWarningPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [agreedSoftDelete, setAgreedSoftDelete] = useState(false)
  const [agreedLoseBenefits, setAgreedLoseBenefits] = useState(false)
  const [agreedNoRefund, setAgreedNoRefund] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      const userId = await getUserId()
      if (!userId) {
        toast.info(t('accountDeleteWarning.loginRequired'))
        navigate('/login')
      }
    }
    checkAuth()
  }, [navigate])

  const canProceed =
    agreedSoftDelete &&
    agreedLoseBenefits &&
    agreedNoRefund &&
    confirmText === t('accountDeleteWarning.confirmText')

  const handleProceedToDelete = async () => {
    if (!canProceed) {
      toast.error(t('accountDeleteWarning.needAllChecks'))
      return
    }

    const finalConfirm = window.confirm(
      t('accountDeleteWarning.confirmDialog')
    )
    if (!finalConfirm) return

    setIsLoading(true)
    try {
      const userId = await getUserId()
      if (!userId) throw new Error(t('accountDeleteWarning.userIdNotFound'))

      const response = await api.delete('/api/account/delete')
      if (!response.data.success) {
        throw new Error(response.data.error || response.data.message || t('accountDeleteWarning.deleteFailed'))
      }

      await authLogout()
      navigate('/account/deleted', { replace: true })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string; detail?: string }; status?: number }; message?: string }
      if (import.meta.env.DEV) console.error('[Account Delete] 탈퇴 실패:', error)

      // 🛡️ 2026-05-01: 진단 위해 detail / error 우선 표시 (이전엔 일반 메시지만).
      let errorMessage = t('accountDeleteWarning.deleteError')
      if (err.response?.status === 401) {
        errorMessage = t('accountDeleteWarning.authExpired')
      } else if (err.response?.data?.detail) {
        errorMessage = `탈퇴 실패: ${err.response.data.detail}`
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }
      toast.error(errorMessage)

      if (err.response?.status === 401) {
        setTimeout(() => navigate('/login'), 1000)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020202] pb-32">
      <SEO title={t('accountDeleteWarning.seoTitle')} description={t('accountDeleteWarning.seoDesc')} url="/account/delete-warning" noindex />

      {/* 헤더 — AccountSettings 와 동일 스타일 */}
      <div
        className="sticky top-0 z-50 flex items-center px-2 py-3 gap-1"
        style={{
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          borderBottom: '0.5px solid rgba(84,84,88,0.34)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('accountDeleteWarning.back')}
          className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.06]"
        >
          <ChevronLeft className="w-5 h-5 text-white/80" />
        </button>
        <h1 className="ml-2 text-[15px] font-semibold text-white">{t('accountDeleteWarning.title')}</h1>
      </div>

      <main className="px-4 pt-5">
        {/* 경고 헤드라인 */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(239,68,68,0.18), transparent 70%), rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-[16px] font-bold text-white mb-1">정말 탈퇴하시겠어요?</h2>
              <p className="text-[13px] text-white/60 leading-relaxed">
                30일 내에 같은 카카오 계정으로 재로그인하면 복원할 수 있어요.
                <br />
                30일이 지나면 모든 데이터가 영구 삭제됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 30일 복원 안내 (Option B) */}
        <div className="rounded-2xl bg-white/[0.04] p-5 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-white mb-1">30일 복원 가능 기간</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">
                탈퇴 후 30일 내에 같은 카카오 계정으로 다시 로그인하면 모든 데이터를 복원할 수 있어요.
                30일 후엔 영구 삭제되며 복구 불가합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 삭제되는 정보 */}
        <div className="rounded-2xl bg-white/[0.04] p-5 mb-3">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-white">삭제되는 정보</h3>
              <p className="text-[12.5px] text-white/45 mt-0.5">30일 후 영구 삭제됩니다</p>
            </div>
          </div>
          <ul className="space-y-1.5 text-[12.5px] text-white/55 ml-12">
            <li>• 모든 주문 내역 및 배송 정보</li>
            <li>• 찜한 상품, 장바구니, 최근 본 상품</li>
            <li>• 적립 포인트 및 사용 가능한 쿠폰</li>
            <li>• 멤버십 등급 및 누적 구매 혜택</li>
            <li>• 작성한 리뷰, 문의, 1:1 상담 내역</li>
            <li>• 등록한 배송지 및 결제 수단 정보</li>
          </ul>
        </div>

        {/* 환불 / 취소 안내 */}
        <div className="rounded-2xl bg-white/[0.04] p-5 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-white mb-1">환불 / 취소 불가</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">
                탈퇴 후엔 진행 중인 주문의 취소 및 환불이 불가능합니다.
                배송 중이거나 완료된 상품의 반품/교환도 어려울 수 있어요.
              </p>
            </div>
          </div>
        </div>

        {/* 혜택 / 등급 손실 */}
        <div className="rounded-2xl bg-white/[0.04] p-5 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
              <ShieldOff className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-white mb-1">혜택 / 등급 손실</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">
                30일 내 복원 시 모든 혜택이 회복됩니다.
                30일이 지나면 포인트, 쿠폰, 등급, 누적 혜택 모두 복구되지 않아요.
              </p>
            </div>
          </div>
        </div>

        {/* 동의 체크 */}
        <div className="rounded-2xl bg-white/[0.04] p-5 mb-3">
          <h3 className="text-[14px] font-semibold text-white mb-4">아래 사항을 확인하고 동의합니다</h3>
          <div className="space-y-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedSoftDelete}
                onChange={(e) => setAgreedSoftDelete(e.target.checked)}
                className="w-[18px] h-[18px] mt-0.5 rounded accent-pink-500 shrink-0"
              />
              <span className="text-[12.5px] text-white/70 leading-relaxed">
                탈퇴 후 <strong className="text-white">30일이 지나면 모든 데이터가 영구 삭제</strong>됨을 이해했습니다.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedLoseBenefits}
                onChange={(e) => setAgreedLoseBenefits(e.target.checked)}
                className="w-[18px] h-[18px] mt-0.5 rounded accent-pink-500 shrink-0"
              />
              <span className="text-[12.5px] text-white/70 leading-relaxed">
                30일 이후엔 <strong className="text-white">포인트, 쿠폰, 등급 등 모든 혜택이 복구되지 않음</strong>을 이해했습니다.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedNoRefund}
                onChange={(e) => setAgreedNoRefund(e.target.checked)}
                className="w-[18px] h-[18px] mt-0.5 rounded accent-pink-500 shrink-0"
              />
              <span className="text-[12.5px] text-white/70 leading-relaxed">
                탈퇴 후엔 <strong className="text-white">진행 중인 주문의 취소/환불이 어려울 수 있음</strong>을 이해했습니다.
              </span>
            </label>
          </div>
        </div>

        {/* 최종 확인 입력 */}
        <div className="rounded-2xl bg-white/[0.04] p-5 mb-5">
          <h3 className="text-[14px] font-semibold text-white mb-2">최종 확인</h3>
          <p className="text-[12.5px] text-white/55 mb-3 leading-relaxed">
            <Trans
              i18nKey="accountDeleteWarning.confirmInputLabel"
              components={[<strong key="0" className="text-red-400" />]}
            />
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('accountDeleteWarning.confirmPlaceholder')}
            className="w-full px-3.5 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50 focus:bg-white/[0.08]"
          />
          {confirmText && confirmText !== t('accountDeleteWarning.confirmText') && (
            <p className="text-[12px] text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('accountDeleteWarning.confirmMismatch')}
            </p>
          )}
          {confirmText === t('accountDeleteWarning.confirmText') && (
            <p className="text-[12px] text-green-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              확인되었습니다.
            </p>
          )}
        </div>

        {/* 머무름 안내 */}
        <div className="text-center mb-2">
          <p className="text-[12px] text-white/40 leading-relaxed flex items-center justify-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-pink-500/60" />
            언제든지 돌아올 수 있어요
          </p>
        </div>
      </main>

      {/* 하단 고정 버튼 — AccountSettings 와 일관 / PC xl+ 사이드바 우측부터 */}
      <div
        className="fixed bottom-0 left-0 right-0 xl:left-56 z-40 px-4 py-4"
        style={{
          background: 'linear-gradient(to top, rgba(2,2,2,1) 60%, rgba(2,2,2,0.6))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="ur-content-narrow space-y-2">
          <button
            type="button"
            onClick={handleProceedToDelete}
            disabled={!canProceed || isLoading}
            className={`w-full h-[52px] rounded-2xl font-semibold text-[14px] transition-all ${
              canProceed && !isLoading
                ? 'bg-red-500 text-white active:scale-[0.98] hover:bg-red-600'
                : 'bg-white/[0.06] text-white/30 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('accountDeleteWarning.deleting')}
              </span>
            ) : (
              t('accountDeleteWarning.submit')
            )}
          </button>
          <Link
            to="/account/settings"
            className="w-full h-[44px] flex items-center justify-center rounded-2xl bg-white/[0.06] text-white/70 text-[13px] font-medium hover:bg-white/[0.08] transition-colors"
          >
            {t('accountDeleteWarning.cancel')}
          </Link>
        </div>
      </div>
    </div>
  )
}
