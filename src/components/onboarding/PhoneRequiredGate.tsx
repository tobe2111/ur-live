/**
 * 📞 가입 시 휴대폰 번호 필수 창 (2026-11-04 대표 *"가입 시, 전화번호는 필수로 입력하게끔 해줄래? 예약 및 소식 알림을 위한 목적으로"*).
 *
 * - **새 가입자만**(대표 확정) — 판정은 서버(`/api/auth/me` 의 `phone_required`, SSOT `shared/phone-required.ts`).
 * - 번호를 넣어야 닫힌다(닫기 단추·바깥 누르기·ESC 없음). 약관·개인정보처리방침 화면에서는 안 뜬다(읽을 수 있어야 한다).
 * - **예약·이용 안내는 필수, 소식(할인·이벤트) 알림은 선택 체크 — 기본 꺼짐**(대표 확정 · 정보통신망법 제50조).
 */
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useUserProfile, useInvalidateUserProfile } from '@/hooks/queries/useUserProfile'
import { formatPhone, isValidMobilePhone } from '@/utils/format-phone'

/** 이 경로에서는 창을 띄우지 않는다 — 로그인 흐름·법적 고지(읽을 수 있어야 한다)·사장님/어드민/에이전시 화면. */
export const PHONE_GATE_SKIP = /^\/(login|auth|join|register|terms|privacy|refund|policy|legal|admin|seller|agency)(\/|$)/

export default function PhoneRequiredGate() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { data: me } = useUserProfile()
  const invalidate = useInvalidateUserProfile()
  const [phone, setPhone] = useState('')
  const [marketing, setMarketing] = useState(false) // 선택 동의 — 기본 꺼짐
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const open = !done && !!me?.phone_required && !PHONE_GATE_SKIP.test(pathname)

  // 창이 떠 있는 동안 뒤 화면이 스크롤되지 않게.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  const valid = isValidMobilePhone(phone)

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      const digits = phone.replace(/\D/g, '')
      const res = await api.patch('/api/auth/profile', { phone: digits, marketing_agreed: marketing })
      if (!res.data?.success) throw new Error('save failed')
      try { localStorage.setItem('user_phone', digits) } catch { /* 프라이빗 창 */ }
      setDone(true)
      invalidate()
      toast.success(t('phoneGate.saved', { defaultValue: '번호를 저장했어요' }))
    } catch {
      toast.error(t('phoneGate.failed', { defaultValue: '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요' }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center ur-veil" role="dialog" aria-modal="true" aria-labelledby="phone-gate-title" data-phone-gate="">
      <div className="w-full max-w-[480px] rounded-t-2xl bg-surface px-5 pt-6 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
        <h2 id="phone-gate-title" className="text-[20px] font-semibold leading-snug tracking-tight text-gray-900 dark:text-white">
          {t('phoneGate.title', { defaultValue: '알림 받을 휴대폰 번호를 알려 주세요' })}
        </h2>
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
          {t('phoneGate.sub', { defaultValue: '예약 확인과 이용 안내를 문자·알림톡으로 보내 드려요' })}
        </p>

        <label className="mt-5 block">
          <span className="sr-only">{t('phoneGate.label', { defaultValue: '휴대폰 번호' })}</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            maxLength={13}
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') void save() }}
            className="w-full h-12 rounded-lg bg-gray-100 dark:bg-white/5 px-4 text-[16px] tabular-nums text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        {phone.length >= 12 && !valid && (
          <p className="mt-2 text-[12px] text-tone-bad">{t('phoneGate.invalid', { defaultValue: '010으로 시작하는 휴대폰 번호를 넣어 주세요' })}</p>
        )}

        <label className="mt-4 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
          <span className="text-[13px] text-gray-700 dark:text-gray-200">
            {t('phoneGate.marketing', { defaultValue: '[선택] 할인·이벤트 소식도 받을게요' })}
            <span className="block mt-1 text-[12px] text-gray-500 dark:text-gray-400">{t('phoneGate.marketingNote', { defaultValue: '광고성 정보 수신 동의 · 언제든 끌 수 있어요' })}</span>
          </span>
        </label>

        <p className="mt-4 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
          {t('phoneGate.privacy', { defaultValue: '번호는 예약·이용 안내에만 쓰고, 탈퇴하면 지워요.' })}{' '}
          <Link to="/privacy" className="underline">{t('phoneGate.privacyLink', { defaultValue: '개인정보처리방침' })}</Link>
        </p>

        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || saving}
          className="mt-5 w-full h-[52px] rounded-full bg-brand text-white text-[15px] font-semibold disabled:opacity-40 active:opacity-80"
        >
          {saving ? t('phoneGate.saving', { defaultValue: '저장하는 중…' }) : t('phoneGate.submit', { defaultValue: '확인' })}
        </button>
      </div>
    </div>
  )
}
