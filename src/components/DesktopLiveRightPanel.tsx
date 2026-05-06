import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Info, MessageSquare } from 'lucide-react'
import api from '@/lib/api'

interface StreamProduct {
  id: number
  name: string
  price: number
  original_price: number | null
  image_url: string | null
}

interface StreamInfo {
  title: string
  seller_name: string
  current_product_id: number | null
}

function getStreamId(pathname: string): string | null {
  const m = pathname.match(/^\/live\/(\d+)/)
  return m ? m[1] : null
}

function fmt(n: number) { return n.toLocaleString() }
function disc(p: number, op: number | null) {
  return op && op > p ? Math.round((1 - p / op) * 100) : 0
}

type Tab = '상품' | '공지'

export default function DesktopLiveRightPanel() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const streamId = getStreamId(pathname)
  const [tab, setTab] = useState<Tab>('상품')
  const [products, setProducts] = useState<StreamProduct[]>([])
  const [stream, setStream] = useState<StreamInfo | null>(null)

  useEffect(() => {
    if (!streamId) return
    setProducts([])
    setStream(null)
    Promise.all([
      api.get(`/api/streams/${streamId}/products`).catch(() => null),
      api.get(`/api/streams/${streamId}`).catch(() => null),
    ]).then(([pRes, sRes]) => {
      if (pRes?.data?.success) setProducts(pRes.data.data ?? [])
      if (sRes?.data?.success) setStream(sRes.data.data)
    })
  }, [streamId])

  const tabs: Tab[] = ['상품', '공지']

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

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">

        {/* 상품 탭 */}
        {tab === '상품' && (
          <div className="p-4">
            {!streamId ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <ShoppingBag className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-[13px]">라이브를 선택하면 상품이 표시됩니다</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <ShoppingBag className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-[13px]">등록된 상품이 없습니다</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1F1F1F]">
                {products.map(p => {
                  const d = disc(p.price, p.original_price)
                  const isCurrent = stream?.current_product_id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/products/${p.id}`)}
                      className="w-full flex items-center gap-3 py-3.5 text-left hover:bg-[#141414] transition-colors"
                    >
                      <div className="w-[52px] h-[52px] rounded-lg shrink-0 bg-[#1A1A1A] overflow-hidden relative">
                        {p.image_url && (
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
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
                          {p.original_price && p.original_price > p.price && (
                            <span className="text-[11px] text-gray-500 line-through">{fmt(p.original_price)}원</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 공지 탭 */}
        {tab === '공지' && (
          <div className="p-4 space-y-3">
            {stream ? (
              <>
                <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Info className="w-3.5 h-3.5 text-[#EF4444]" />
                    <p className="text-[10px] font-bold text-gray-500 tracking-widest">방송 정보</p>
                  </div>
                  <p className="text-[14px] font-bold text-white leading-snug">{stream.title}</p>
                  {stream.seller_name && (
                    <p className="text-[12px] text-gray-400 mt-1.5">@{stream.seller_name}</p>
                  )}
                </div>
                <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                    <p className="text-[10px] font-bold text-gray-500 tracking-widest">채팅 안내</p>
                  </div>
                  <p className="text-[12px] text-gray-400 leading-relaxed">
                    채팅은 라이브 영상 화면에서 직접 참여할 수 있습니다.
                    영상 하단의 채팅창에서 메시지를 보내보세요.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Info className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-[13px]">
                  {streamId ? '방송 정보를 불러오는 중...' : '라이브를 선택하면 정보가 표시됩니다'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
