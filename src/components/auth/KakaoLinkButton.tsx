/**
 * KakaoLinkButton — 이메일/비번으로 로그인한 셀러/에이전시가
 * 자신의 계정을 카카오에 연동하는 재사용 버튼.
 *
 * 동작:
 *  1. 현재 연동 상태 조회 (GET .../kakao-link-status)
 *  2. 미연동: "카카오 계정 연동하기" 버튼 → 지금 로그인한 카카오 세션으로 POST .../link-kakao (2026-11-25 — 팝업 없음)
 *  3. 카카오 로그인이 없으면 로그인하고 이 화면으로 돌아온다
 *  4. 성공 시 "연동됨" 상태로 전환 (user 정보 표시 + 해제 버튼)
 */

import { useEffect, useState, useCallback } from 'react'
import { AlertIcon } from '@/components/icons/urdeal-icons'
import { useTranslation } from '@/lib/i18n-lite'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, Unlink } from 'lucide-react'
import { confirmDialog, promptDialog } from '@/components/ui/confirm-dialog'

interface Props {
  /** 🌇 2026-09-04 에이전시 일몰 — 'agency' 제거. 셀러 전용이다. */
  role: 'seller'
}

interface LinkStatus {
  linked: boolean
  user?: { id: number; name?: string; email?: string; profile_image?: string }
}

export function KakaoLinkButton({ role }: Props) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const basePath = '/api/seller'

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`${basePath}/kakao-link-status`)
      if (res.data?.success) setStatus(res.data.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [basePath])

  useEffect(() => { refresh() }, [refresh])

  async function startLink() {
    // 🔗 2026-11-25: 종전엔 팝업으로 카카오 로그인을 다시 시키고 `/auth/kakao/link/callback` 으로 돌아오게 했다.
    //   로그인 복귀 주소 검사가 `/auth/` 로 시작하는 주소를 전부 막아서 팝업은 홈에 떨어졌고, 이 버튼은 30초 뒤 조용히 포기했다.
    //   셀러 화면은 카카오 로그인으로 들어오므로 로그인은 이미 돼 있다. 그 세션으로 바로 연결한다(서버 `link-kakao` 의 세션 방식).
    setWorking(true)
    try {
      const res = await api.post(`${basePath}/link-kakao`, {})
      if (res.data?.success) {
        toast.success(t('auth.kakao.linked'))
        await refresh()
      } else {
        toast.error(res.data?.error || t('kakaoLink.linkFailed'))
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } }
      if (err.response?.data?.code === 'LOGIN_REQUIRED') {
        // 이 브라우저에 카카오 로그인이 없다 — 로그인하고 이 화면으로 돌아온다(돌아와서 한 번 더 누른다).
        window.location.href = `/auth/kakao/start?redirect=${encodeURIComponent(window.location.pathname)}`
        return
      }
      toast.error(err.response?.data?.error || t('kakaoLink.linkFailed'))
    } finally { setWorking(false) }
  }

  async function unlink() {
    if (!(await confirmDialog(t('kakaoLink.unlinkConfirm')))) return
    const pw = (await promptDialog({ message: t('kakaoLink.unlinkPasswordPrompt', { defaultValue: '본인 확인을 위해 비밀번호를 입력해주세요.\n(비밀번호가 없는 매장은 해제할 수 없어요)' }), prompt: {} }))
    if (!pw) return
    setWorking(true)
    try {
      const res = await api.post(`${basePath}/unlink-kakao`, { current_password: pw })
      if (res.data?.success) {
        toast.success(t('auth.kakao.unlinked'))
        await refresh()
      } else {
        toast.error(res.data?.error || t('auth.pin.verifyFailed'))
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } }
      if (err.response?.data?.code === 'PASSWORD_REQUIRED') {
        toast.error(t('auth.kakao.passwordRequired'))
      } else {
        toast.error(err.response?.data?.error || t('auth.pin.verifyFailed'))
      }
    } finally { setWorking(false) }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-[#1D1F29] rounded-xl p-4 flex items-center gap-2 text-[15px] text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('kakaoLink.checkingStatus', { defaultValue: '연동 상태 확인 중...' })}
      </div>
    )
  }

  if (status?.linked && status.user) {
    return (
      <div className="bg-tone-ok-bg rounded-xl p-4 flex items-center gap-3">
        {status.user.profile_image ? (
          <img src={status.user.profile_image} alt="" className="w-10 h-10 rounded-full" loading="lazy" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-yellow-300 flex items-center justify-center text-[16px]">💬</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-tone-ok font-medium">{t('kakaoLink.linkedStatus', { defaultValue: '✓ 카카오 계정 연동됨' })}</p>
          <p className="text-[15px] text-gray-900 dark:text-white font-medium truncate">{status.user.name}</p>
          {status.user.email && <p className="text-[12px] text-gray-500 truncate">{status.user.email}</p>}
        </div>
        <button onClick={unlink} disabled={working}
          className="text-[12px] text-red-600 hover:text-red-800 flex items-center gap-1 px-2 py-1">
          {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
          {t('kakaoLink.unlinkBtn', { defaultValue: '해제' })}
        </button>
      </div>
    )
  }

  // 미연동 상태
  return (
    <div className="bg-gray-50 dark:bg-[#1D1F29] border border-line rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-[16px] shrink-0">💬</div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{t('kakaoLink.title')}</p>
          <p className="text-[12px] text-gray-600 mt-1 leading-relaxed">
            {t('kakaoLink.benefit', { defaultValue: '연동하면 카카오 로그인만으로 접근 가능해요. 비밀번호 관리 부담 ↓ · 보안 ↑' })}
          </p>
        </div>
      </div>

      <button onClick={startLink} disabled={working}
        className="w-full py-2 bg-[#FEE500] hover:bg-[#FDD800] disabled:opacity-50 text-[#3C1E1E] font-bold text-[15px] rounded-xl flex items-center justify-center gap-2">
        {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>💬</span>}
        {working ? t('kakaoLink.processing') : t('kakaoLink.connectCta')}
      </button>

      <div className="flex items-start gap-2 text-[12px] text-gray-500">
        <AlertIcon className="w-3 h-3 shrink-0 mt-1" />
        <span>
          {t('kakaoLink.emailStillUsable', { defaultValue: '기존 이메일/비밀번호 로그인도 계속 사용 가능합니다.' })}
          {t('kakaoLink.unlinkHint')}
        </span>
      </div>
    </div>
  )
}
