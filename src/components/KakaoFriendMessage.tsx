/**
 * 카카오 친구에게 메시지 보내기
 * - 친구 목록 조회 → 선택 → 메시지 발송
 * - 브라우저에서 직접 카카오 API 호출 (Worker IP 문제 우회)
 */
import { useState } from 'react'
import { X, Send, Loader2, Users } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface KakaoFriendMessageProps {
  title: string
  description: string
  imageUrl?: string
  link: string
  buttonText?: string
  triggerLabel?: string
  triggerClassName?: string
  compact?: boolean
}

interface Friend {
  id: number
  uuid: string
  profile_nickname: string
  profile_thumbnail_image?: string
  selected?: boolean
}

export default function KakaoFriendMessage({ title, description, imageUrl, link, buttonText, triggerLabel, triggerClassName, compact }: KakaoFriendMessageProps) {
  const [open, setOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [token, setToken] = useState('')

  const fetchFriends = async () => {
    setLoading(true)
    try {
      // 서버에서 카카오 토큰 가져오기
      const tokenRes = await api.get('/api/kakao-social/token')
      const accessToken = tokenRes.data?.data?.access_token
      if (!accessToken) {
        toast.error('카카오 연동이 필요합니다')
        setOpen(false)
        return
      }
      setToken(accessToken)

      // 브라우저에서 직접 친구 목록 조회
      const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })
      const data = await res.json() as any
      if (data.elements?.length > 0) {
        setFriends(data.elements.map((f: any) => ({ ...f, selected: false })))
      } else {
        toast.info('유어딜을 사용하는 카카오 친구가 없습니다')
        setOpen(false)
      }
    } catch {
      toast.error('친구 목록을 불러올 수 없습니다')
      setOpen(false)
    } finally { setLoading(false) }
  }

  const handleOpen = () => {
    setOpen(true)
    fetchFriends()
  }

  const toggleFriend = (uuid: string) => {
    setFriends(prev => prev.map(f => f.uuid === uuid ? { ...f, selected: !f.selected } : f))
  }

  const selectedCount = friends.filter(f => f.selected).length

  const handleSend = async () => {
    const selected = friends.filter(f => f.selected)
    if (!selected.length) { toast.error('친구를 선택해주세요'); return }
    setSending(true)
    try {
      const fullUrl = `https://live.ur-team.com${link}`
      const templateObject = JSON.stringify({
        object_type: 'feed',
        content: {
          title,
          description,
          image_url: imageUrl || 'https://live.ur-team.com/og-image.png',
          link: { web_url: fullUrl, mobile_web_url: fullUrl },
        },
        buttons: [{ title: buttonText || '유어딜에서 보기', link: { web_url: fullUrl, mobile_web_url: fullUrl } }],
      })
      const uuids = JSON.stringify(selected.map(f => f.uuid))

      const res = await fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `receiver_uuids=${encodeURIComponent(uuids)}&template_object=${encodeURIComponent(templateObject)}`,
      })
      const data = await res.json() as any
      if (data.successful_receiver_uuids?.length > 0) {
        toast.success(`${data.successful_receiver_uuids.length}명에게 전송했습니다!`)
        setOpen(false)
      } else {
        toast.error('메시지 전송에 실패했습니다')
      }
    } catch {
      toast.error('메시지 전송에 실패했습니다')
    } finally { setSending(false) }
  }

  return (
    <>
      <button onClick={handleOpen}
        className={triggerClassName || (compact
          ? "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#FEE500] text-[#3C1E1E] active:scale-95"
          : "w-full flex items-center justify-center gap-2 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold active:scale-[0.97]")}>
        <Users className="w-3.5 h-3.5" />
        {triggerLabel || '친구에게 알리기'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">친구에게 보내기</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-yellow-500" /></div>
            ) : (
              <>
                <div className="max-h-[300px] overflow-y-auto">
                  {friends.map(f => (
                    <button key={f.uuid} onClick={() => toggleFriend(f.uuid)}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${f.selected ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                      <div className="relative">
                        <img src={f.profile_thumbnail_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.profile_nickname)}&size=40`}
                          alt="" className="w-10 h-10 rounded-full object-cover" />
                        {f.selected && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                            <span className="text-white text-[10px] font-bold">✓</span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{f.profile_nickname}</span>
                    </button>
                  ))}
                </div>

                <div className="px-5 py-4 border-t border-gray-100">
                  <button onClick={handleSend} disabled={selectedCount === 0 || sending}
                    className="w-full py-3 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {selectedCount > 0 ? `${selectedCount}명에게 보내기` : '친구를 선택하세요'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
