/**
 * 🛡️ 2026-05-15: 셀러 본인 라이브 시작 시 카카오 친구에게 메시지 발송 버튼.
 *
 * 시청자용 BroadcastNotifyButton 과 별개:
 *   - 시청자: 본인 캘린더 추가 / 알림 신청
 *   - 셀러: 본인 카카오 친구 (팔로워) 에게 "지금 라이브!" 메시지 전송
 *
 * /api/kakao-social/message/broadcast 호출 (셀러 본인 access_token 사용)
 * 카카오 로그인 안 한 경우: 안내 + 카카오 연동 유도
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, MessageCircle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken } from '@/lib/seller-auth'

interface Props {
  streamId: number | string
  streamTitle: string
  customMessage?: string
}

export default function SellerKakaoNotifyButton({ streamId, streamTitle, customMessage }: Props) {
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (sent) {
      if (!confirm('이미 발송했습니다. 다시 발송하시겠습니까?')) return
    }
    setSending(true)
    try {
      const res = await api.post('/api/kakao-social/message/broadcast', {
        stream_id: Number(streamId),
        title: streamTitle,
        message: customMessage || '지금 라이브가 시작됐어요! 같이 봐요 🔴',
      }, { headers: { Authorization: `Bearer ${getSellerToken()}` } })

      if (res.data?.success) {
        toast.success('✅ 카카오톡에 메시지가 전송됐어요')
        setSent(true)
      } else {
        toast.error(res.data?.error || '발송 실패')
      }
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
      const errCode = e?.response?.data?.code
      if (errCode === 'KAKAO_REAUTH_REQUIRED') {
        if (confirm('카카오 인증이 만료됐어요. 다시 로그인하시겠습니까?')) {
          navigate('/seller/login')
        }
      } else if (errCode === 'KAKAO_SCOPE_MISSING') {
        toast.error('카카오 메시지 권한이 필요합니다. 설정 → 카카오 다시 연결.')
      } else {
        toast.error(e?.response?.data?.error || '발송 실패')
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={sending}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
        sent
          ? 'bg-gray-100 text-gray-500'
          : 'bg-[#FEE500] hover:bg-[#FDD800] text-[#3C1E1E] shadow-sm'
      } disabled:opacity-50`}
      aria-label="카카오 친구에게 라이브 알림"
    >
      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
      {sending ? '발송 중…' : sent ? '✓ 발송됨' : '카카오 친구 알림'}
    </button>
  )
}
