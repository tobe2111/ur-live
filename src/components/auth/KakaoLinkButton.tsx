/**
 * KakaoLinkButton — 이메일/비번으로 로그인한 셀러/에이전시가
 * 자신의 계정을 카카오에 연동하는 재사용 버튼.
 *
 * 동작:
 *  1. 현재 연동 상태 조회 (GET .../kakao-link-status)
 *  2. 미연동: "카카오 계정 연동하기" 버튼 → 팝업으로 카카오 OAuth 진행
 *  3. 팝업 콜백에서 code 받으면 POST .../link-kakao 호출
 *  4. 성공 시 "연동됨" 상태로 전환 (user 정보 표시 + 해제 버튼)
 */

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, Unlink, AlertCircle } from 'lucide-react'

interface Props {
  /** 'seller' | 'agency' — 어떤 role 의 연동인지 */
  role: 'seller' | 'agency'
}

interface LinkStatus {
  linked: boolean
  user?: { id: number; name?: string; email?: string; profile_image?: string }
}

export function KakaoLinkButton({ role }: Props) {
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const basePath = role === 'seller' ? '/api/seller' : '/api/agency'

  const refresh = useCallback(async () => {
    try {
      const res = await api.get(`${basePath}/kakao-link-status`)
      if (res.data?.success) setStatus(res.data.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [basePath])

  useEffect(() => { refresh() }, [refresh])

  async function startLink() {
    // 플로우:
    //  1) 팝업에서 /auth/kakao/start 호출 → 카카오 OAuth → 서버 sync/callback
    //     (code 소비 + users upsert + 세션 쿠키 세팅)
    //  2) 서버가 /auth/kakao/link/callback?login=success&userId=... 로 리다이렉트
    //  3) 팝업의 KakaoLinkCallbackPage 가 opener 에게 postMessage 전송
    //  4) 부모가 POST /link-kakao (body 비움) → 서버는 세션 쿠키의 userId 로 연동
    const w = 500, h = 700
    const left = Math.floor((window.screen.availWidth - w) / 2)
    const top = Math.floor((window.screen.availHeight - h) / 2)

    const popupUrl = `/auth/kakao/start?redirect=${encodeURIComponent('/auth/kakao/link/callback')}`
    const popup = window.open(
      popupUrl,
      'ur-kakao-link',
      `popup=yes,width=${w},height=${h},left=${left},top=${top}`
    )

    if (!popup) {
      toast.error('팝업이 차단되었어요. 브라우저 팝업 허용 후 다시 시도해주세요.')
      return
    }

    const origin = window.location.origin
    const handler = async (ev: MessageEvent) => {
      if (ev.origin !== origin) return
      const { type, success, error } = (ev.data || {}) as { type?: string; success?: boolean; error?: string }
      if (type !== 'kakao_link_result') return
      window.removeEventListener('message', handler)
      try { popup.close() } catch { /* ignore */ }

      if (error || !success) {
        toast.error(error ? `카카오 인증 실패: ${error}` : '카카오 인증 취소됨')
        return
      }

      // 서버에 link 요청 (session 모드 — body 비움)
      setWorking(true)
      try {
        const res = await api.post(`${basePath}/link-kakao`, {})
        if (res.data?.success) {
          toast.success('카카오 계정이 연동되었어요!')
          await refresh()
        } else {
          toast.error(res.data?.error || '연동 실패')
        }
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } }
        toast.error(err.response?.data?.error || '연동 실패')
      } finally { setWorking(false) }
    }
    window.addEventListener('message', handler)

    // 팝업 강제 닫힘 감지 (30초 후 listener 제거)
    setTimeout(() => window.removeEventListener('message', handler), 30000)
  }

  async function unlink() {
    if (!confirm('카카오 계정 연동을 해제할까요? 이후엔 이메일/비밀번호로만 로그인 가능합니다.')) return
    const pw = prompt('본인 확인을 위해 비밀번호를 입력해주세요.\n(카카오로만 가입하셨다면 먼저 "비밀번호 찾기" 로 설정하세요)')
    if (!pw) return
    setWorking(true)
    try {
      const res = await api.post(`${basePath}/unlink-kakao`, { current_password: pw })
      if (res.data?.success) {
        toast.success('카카오 연동이 해제되었어요')
        await refresh()
      } else {
        toast.error(res.data?.error || '해제 실패')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } }
      if (err.response?.data?.code === 'PASSWORD_REQUIRED') {
        toast.error('비밀번호 설정이 필요합니다. "비밀번호 찾기" 로 설정 후 다시 시도해주세요.')
      } else {
        toast.error(err.response?.data?.error || '해제 실패')
      }
    } finally { setWorking(false) }
  }

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> 연동 상태 확인 중...
      </div>
    )
  }

  if (status?.linked && status.user) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
        {status.user.profile_image ? (
          <img src={status.user.profile_image} alt="" className="w-10 h-10 rounded-full" loading="lazy" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-yellow-300 flex items-center justify-center text-lg">💬</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-green-700 font-bold">✓ 카카오 계정 연동됨</p>
          <p className="text-sm text-gray-900 font-semibold truncate">{status.user.name}</p>
          {status.user.email && <p className="text-[11px] text-gray-500 truncate">{status.user.email}</p>}
        </div>
        <button onClick={unlink} disabled={working}
          className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 px-2 py-1">
          {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
          해제
        </button>
      </div>
    )
  }

  // 미연동 상태
  return (
    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-lg shrink-0">💬</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">카카오 계정 연동</p>
          <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
            연동하면 카카오 로그인만으로 접근 가능해요.<br />
            비밀번호 관리 부담 ↓ · 보안 ↑
          </p>
        </div>
      </div>

      <button onClick={startLink} disabled={working}
        className="w-full py-2.5 bg-[#FEE500] hover:bg-[#FDD800] disabled:opacity-50 text-[#3C1E1E] font-bold text-sm rounded-xl flex items-center justify-center gap-1.5">
        {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>💬</span>}
        {working ? '처리 중...' : '카카오 계정 연동하기'}
      </button>

      <div className="flex items-start gap-1.5 text-[10px] text-gray-500">
        <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          기존 이메일/비밀번호 로그인도 계속 사용 가능합니다.
          언제든 위 "해제" 버튼으로 연동 해제할 수 있어요.
        </span>
      </div>
    </div>
  )
}
