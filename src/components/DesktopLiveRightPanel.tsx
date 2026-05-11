import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Info, Send } from 'lucide-react'
import { useStreamStore } from '@/shared/stores/useStreamStore'
import { getUserIdSync, getUserNameSync } from '@/utils/auth'
import { useTranslation } from 'react-i18next'

function getStreamId(pathname: string): string | null {
  const m = pathname.match(/^\/live\/(\d+)/)
  return m ? m[1] : null
}

function fmt(n: number) { return n.toLocaleString() }
function disc(p: number, op?: number | null) {
  return op && op > p ? Math.round((1 - p / op) * 100) : 0
}

type Tab = '채팅' | '상품' | '공지'

export default function DesktopLiveRightPanel() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const streamId = getStreamId(pathname)

  const [tab, setTab] = useState<Tab>('채팅')
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 스토어에서 읽기
  const messages = useStreamStore(s => s.messages)
  const products = useStreamStore(s => s.products)
  const currentProductId = useStreamStore(s => s.currentProductId)
  const isConnected = useStreamStore(s => s.isConnected)
  const title = useStreamStore(s => s.title)
  const sellerName = useStreamStore(s => s.sellerName)
  const sendMessage = useStreamStore(s => s.sendMessage)

  // 새 메시지 오면 스크롤 하단
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputText.trim() || !sendMessage || sending) return
    const userIdStr = getUserIdSync()
    const userName = getUserNameSync() || '익명'
    if (!userIdStr) return
    const userId = Number(userIdStr)
    if (!Number.isFinite(userId)) return
    setSending(true)
    try {
      await sendMessage(inputText.trim(), userId, userName, 'viewer')
      setInputText('')
    } finally {
      setSending(false)
    }
  }

  const tabs: Tab[] = ['채팅', '상품', '공지']

  return (
    <aside className="hidden xl:flex fixed right-0 top-14 bottom-0 z-30 w-[360px] flex-col bg-[#0A0A0A] border-l border-[#1F1F1F]">

      {/* 탭 헤더 */}
      <div className="flex shrink-0 border-b border-[#1F1F1F]">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3.5 text-[13px] font-bold transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'text-white border-[#EF4444]'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ─── 채팅 탭 ─── */}
      {tab === '채팅' && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 py-10">
                <p className="text-[12px]">
                  {streamId
                    ? isConnected ? '아직 채팅이 없습니다' : '채팅 연결 중...'
                    : '라이브를 선택하면 채팅이 표시됩니다'}
                </p>
              </div>
            ) : (
              messages.map(m => (
                <div key={m.id} className="text-[13px] leading-snug">
                  <span className={`font-bold mr-1.5 ${
                    m.userType === 'streamer' || m.isSeller ? 'text-yellow-400' :
                    m.userType === 'system'   ? 'text-white/60' :
                    'text-gray-400'
                  }`}>
                    {(m.userType === 'streamer' || m.isSeller) && '👑 '}
                    {m.userType === 'system'   && '🔰 '}
                    {m.userName}
                  </span>
                  <span className="text-white">{m.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 입력창 */}
          {streamId && (
            <div className="shrink-0 border-t border-[#1F1F1F] p-3 flex gap-2">
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={t('chat.sendPlaceholder', { defaultValue: '메시지 보내기' })}
                className="flex-1 h-10 px-3.5 rounded-full bg-[#1A1A1A] text-white text-[13px] placeholder-gray-600 border border-transparent focus:border-[#2A2A2A] outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending || !sendMessage}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #EF4444, #EC4899)' }}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── 상품 탭 ─── */}
      {tab === '상품' && (
        <div className="flex-1 overflow-y-auto">
          {!streamId || products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 py-16">
              <ShoppingBag className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-[12px]">
                {streamId ? '등록된 상품이 없습니다' : '라이브를 선택하면 상품이 표시됩니다'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1F1F1F]">
              {products.map(p => {
                const d = disc(p.price, p.original_price ?? p.originalPrice)
                const isCurrent = p.id === currentProductId
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/products/${p.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#141414] transition-colors"
                  >
                    <div className="w-[52px] h-[52px] rounded-lg shrink-0 bg-[#1A1A1A] overflow-hidden relative">
                      {(p.image_url || p.image) && (
                        <img src={p.image_url ?? p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      )}
                      {isCurrent && (
                        <span className="absolute inset-0 ring-2 ring-[#EF4444] rounded-lg pointer-events-none" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isCurrent && (
                        <span className="inline-block text-[9px] font-extrabold bg-[#EF4444] text-white px-1.5 py-0.5 rounded mb-0.5">
                          지금
                        </span>
                      )}
                      <p className="text-[13px] font-semibold text-white leading-tight line-clamp-2">{p.name}</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        {d > 0 && <span className="text-[11px] font-extrabold text-[#EF4444]">{d}%</span>}
                        <span className="text-[14px] font-extrabold text-white">{fmt(p.price)}원</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── 공지 탭 ─── */}
      {tab === '공지' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {title ? (
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5 text-[#EF4444]" />
                <p className="text-[10px] font-bold text-gray-500 tracking-widest">방송 정보</p>
              </div>
              <p className="text-[14px] font-bold text-white leading-snug">{title}</p>
              {sellerName && (
                <p className="text-[12px] text-gray-400 mt-1.5">@{sellerName}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-600 py-16">
              <Info className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-[12px]">
                {streamId ? '방송 정보를 불러오는 중...' : '라이브를 선택하면 정보가 표시됩니다'}
              </p>
            </div>
          )}
        </div>
      )}

    </aside>
  )
}
