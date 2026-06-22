// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 4b — 판매사 floating 채팅 버튼 (항상 present, 가벼움).
//   ⚡ 이 컴포넌트만 초기 번들에 — unread 배지 폴링 + 클릭 시 무거운 위젯 lazy 로드.
//   위젯(WholesaleChatWidget) 은 React.lazy → 열기 전엔 채팅 코드 0 byte.
//   판매사 카탈로그(/wholesale)에서만 사용 — seller_token 컨텍스트.
// ──────────────────────────────────────────────────────────────
import { lazy, Suspense, useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChatPoll } from '@/hooks/useChatPoll'
import { wholesaleChatApi, hasChatToken } from '@/hooks/queries/useWholesaleChat'

// 무거운 위젯은 별도 chunk — 열 때만 fetch.
const WholesaleChatWidget = lazy(() => import('@/pages/wholesale/WholesaleChatWidget'))

interface Props {
  /** 위젯 자동으로 특정 제조사 스레드를 열고 싶을 때(상품 상세의 "제조사 문의"). */
  initialCounterpartId?: number | null
  /**
   * 상품 기준으로 제조사 스레드를 열고 싶을 때(상품 상세 "제조사에 문의").
   * 🛡️ 서버가 product_id → 제조사를 서버사이드로 해석 — 클라는 제조사 신원/ID 를 모름.
   */
  initialProductId?: number | null
  /** 이미 아는 thread_id 로 바로 진입. */
  initialThreadId?: number | null
  /** 외부에서 강제로 열기 제어할 때(상품 상세 버튼). */
  autoOpen?: boolean
  /** 위젯이 닫힐 때 부모에 통지(상품 상세에서 버튼 트리거 상태 리셋). */
  onClose?: () => void
}

export default function WholesaleChatButton({ initialCounterpartId = null, initialProductId = null, initialThreadId = null, autoOpen = false, onClose }: Props) {
  const { t } = useTranslation()
  // 💬 채팅 알림 딥링크(/wholesale/chat) 진입 시 위젯 자동 오픈.
  const [open, setOpen] = useState(autoOpen || (typeof window !== 'undefined' && window.location.pathname === '/wholesale/chat'))
  const [unread, setUnread] = useState(0)

  const loggedIn = hasChatToken()

  // 외부(상품 상세 "제조사에 문의")에서 autoOpen 을 true 로 토글하면 위젯 열기.
  useEffect(() => { if (autoOpen) setOpen(true) }, [autoOpen])

  const close = () => { setOpen(false); onClose?.() }

  // 배지 폴링 — 가벼운 unread만. 탭 숨김이면 중단(useChatPoll 내부). 위젯 열려도 계속(다른 스레드 unread).
  useChatPoll(
    async () => {
      try {
        const r = await wholesaleChatApi.unread()
        setUnread(r.unread)
        return true
      } catch {
        return false
      }
    },
    { baseInterval: 25_000, maxInterval: 120_000, enabled: loggedIn },
  )

  if (!loggedIn) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unread > 0
            ? t('wholesaleChat.openAria', { defaultValue: '채팅 열기 ({{n}}개 안읽음)', n: unread }).replace('{{n}}', String(unread))
            : t('wholesaleChat.open', { defaultValue: '채팅 열기' })
        }
        className="fixed z-40 bottom-5 right-5 h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{ background: '#FC5424', color: '#fff', boxShadow: '0 6px 20px -6px rgba(255,0,51,0.6)' }}
      >
        <MessageCircle className="w-6 h-6" strokeWidth={2.2} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-white text-[#FC5424] text-[11px] font-extrabold border-2 border-[#FC5424]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <Suspense fallback={null}>
          <WholesaleChatWidget
            onClose={close}
            initialCounterpartId={initialCounterpartId}
            initialProductId={initialProductId}
            initialThreadId={initialThreadId}
            onUnreadChange={setUnread}
          />
        </Suspense>
      )}
    </>
  )
}
