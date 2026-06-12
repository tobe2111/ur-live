/**
 * 커뮤니티 공구 메시지 페이지 — /community-group-buy/:code/messages
 *
 * 🔗 2026-06-12 (4차 감사 #1): 알림 딥링크(`/community-group-buy/:id/messages`)가 404 였던 것의
 *   착지 페이지. invite_code(:code) 로 그룹을 찾고(detail API), 기존 메시지 GET/POST API 사용.
 *   접근 제어는 서버(canAccessGroupMessages: admin/agency/식당셀러/제안자/멤버)가 SSOT —
 *   여기서는 403 시 안내만 렌더.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send, Lock } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface GroupSummary {
  id: number
  invite_code: string
  restaurant_name: string
  status: string
}

interface GroupMessage {
  id: number
  sender_type: string
  sender_name: string | null
  message: string
  created_at: string
}

export default function CommunityGroupBuyMessagesPage() {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [group, setGroup] = useState<GroupSummary | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('user_id')

  const loadMessages = useCallback(async (groupId: number, scroll = false) => {
    try {
      const res = await api.get(`/api/community-group-buy/${groupId}/messages`)
      if (res.data?.success) {
        setForbidden(false)
        setMessages(res.data.data || [])
        if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 403) setForbidden(true)
      else if (status === 401) {
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        navigate('/login')
      }
    }
  }, [navigate])

  // 그룹 조회(invite_code → id) 후 메시지 로드
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      if (!code) { setNotFound(true); setLoading(false); return }
      try {
        const res = await api.get(`/api/community-group-buy/detail/${code}`)
        if (cancelled) return
        if (res.data?.success && res.data.data) {
          const g = res.data.data as GroupSummary
          setGroup(g)
          await loadMessages(g.id, true)
        } else {
          setNotFound(true)
        }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [code, loadMessages])

  // 가벼운 폴링 (20초) — 채팅 신선도. 탭 비활성 시 skip.
  useEffect(() => {
    if (!group || forbidden) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(group.id)
    }, 20_000)
    return () => clearInterval(timer)
  }, [group, forbidden, loadMessages])

  const handleSend = async () => {
    if (!group || sending) return
    const text = input.trim()
    if (!text) return
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    setSending(true)
    try {
      const res = await api.post(`/api/community-group-buy/${group.id}/messages`, { message: text })
      if (res.data?.success) {
        setInput('')
        await loadMessages(group.id, true)
      } else {
        toast.error(res.data?.error || t('groupbuyMessages.sendFail', { defaultValue: '메시지 전송에 실패했습니다' }))
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { status?: number; data?: { error?: string } } }
      if (err_.response?.status === 403) setForbidden(true)
      toast.error(err_.response?.data?.error || t('groupbuyMessages.sendFail', { defaultValue: '메시지 전송에 실패했습니다' }))
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !group) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
        <p className="text-gray-900 dark:text-white font-bold text-lg">
          {t('groupbuyMessages.notFound', { defaultValue: '공동구매를 찾을 수 없습니다' })}
        </p>
        <Link to="/group-buy" className="mt-4 text-gray-900 dark:text-white text-sm font-medium underline">
          {t('groupbuyMessages.backToList', { defaultValue: '동네딜로 돌아가기' })}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex flex-col">
      <SEO
        title={`${group.restaurant_name} - 유어딜`}
        description={t('groupbuyMessages.seoDesc', { defaultValue: '공동구매 메시지' })}
        url={`/community-group-buy/${code}/messages`}
      />
      {/* Header */}
      <div className="sticky top-0 md:top-14 z-40 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-3 lg:px-8 py-3">
          <button
            onClick={() => navigate(`/community-group-buy/${code}`)}
            aria-label={t('groupbuyMessages.backAria', { defaultValue: '공구 상세로' })}
            className="w-9 h-9 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-extrabold text-gray-900 dark:text-white truncate max-w-[60%]">
            {group.restaurant_name}
          </h1>
          <div className="w-9" />
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 ur-content-narrow w-full px-4 lg:px-8 py-4 pb-28 space-y-2">
        {forbidden ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-[14px] font-bold text-gray-900 dark:text-white">
              {t('groupbuyMessages.forbiddenTitle', { defaultValue: '참여자만 볼 수 있어요' })}
            </p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
              {t('groupbuyMessages.forbiddenDesc', { defaultValue: '공구에 참여하면 메시지를 보고 보낼 수 있습니다.' })}
            </p>
            <Link
              to={`/community-group-buy/${code}`}
              className="mt-4 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[13px] font-bold rounded-xl"
            >
              {t('groupbuyMessages.goJoin', { defaultValue: '공구 보러 가기' })}
            </Link>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[13px] text-gray-400 dark:text-gray-500 py-16">
            {t('groupbuyMessages.empty', { defaultValue: '아직 메시지가 없어요. 첫 메시지를 남겨보세요!' })}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-3 border border-gray-100 dark:border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-gray-900 dark:text-white">
                  {m.sender_name || t('groupbuyMessages.anonymous', { defaultValue: '익명' })}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400">
                  {m.sender_type === 'admin' ? t('groupbuyMessages.roleAdmin', { defaultValue: '운영자' })
                    : m.sender_type === 'agency' ? t('groupbuyMessages.roleAgency', { defaultValue: '에이전시' })
                    : m.sender_type === 'restaurant' ? t('groupbuyMessages.roleRestaurant', { defaultValue: '식당' })
                    : t('groupbuyMessages.roleMember', { defaultValue: '참여자' })}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                  {m.created_at ? new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at + 'Z').toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed">{m.message}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 바 */}
      {!forbidden && (
        <div className="fixed bottom-0 left-0 right-0 xl:left-56 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] px-4 py-3 z-50">
          <div className="ur-content-narrow flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend() }}
              maxLength={1000}
              placeholder={t('groupbuyMessages.inputPlaceholder', { defaultValue: '메시지를 입력하세요' })}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#121212] text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-gray-400 dark:focus:border-[#3A3A3A]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label={t('groupbuyMessages.sendAria', { defaultValue: '전송' })}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-40 active:scale-95 transition-transform"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
