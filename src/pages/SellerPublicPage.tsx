import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, Settings } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { Seller, LiveStream, Product, Short, Tab, ThemeClasses } from '@/components/seller/public/seller-public-types'
import SellerPublicHeader from '@/components/seller/public/SellerPublicHeader'
import SellerPublicTabBar from '@/components/seller/public/SellerPublicTabBar'
import SellerPublicHomeTab from '@/components/seller/public/SellerPublicHomeTab'
import SellerPublicVouchersTab from '@/components/seller/public/SellerPublicVouchersTab'
import SellerPublicShortsTab from '@/components/seller/public/SellerPublicShortsTab'
import SellerPublicLiveTab from '@/components/seller/public/SellerPublicLiveTab'
import SellerPublicInfoTab from '@/components/seller/public/SellerPublicInfoTab'

export default function SellerPublicPage() {
  const { t } = useTranslation()
  const { sellerId: rawParam } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  const sellerId = rawParam
  const [seller, setSeller] = useState<Seller | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [shorts, setShorts] = useState<Short[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('home')

  // 셀러 본인인지 확인 (편집 버튼 표시용) — seller 로드 후 id 비교
  const storedSellerId = localStorage.getItem('seller_id')
  const userType = localStorage.getItem('user_type')
  const isOwner = userType === 'seller' && !!seller && String(seller.id) === storedSellerId

  // ── 인라인 편집 상태 ──
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editKakao, setEditKakao] = useState('')
  const [editInsta, setEditInsta] = useState('')
  const [editYoutube, setEditYoutube] = useState('')
  const [saving, setSaving] = useState(false)

  // 🛡️ 2026-04-22: 테마 토글 영속성 — localStorage 저장. 새로고침해도 유지.
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('seller_public_theme')
      return saved !== 'light' // 기본 dark, 명시적으로 light 일 때만 light
    } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem('seller_public_theme', isDark ? 'dark' : 'light') } catch {}
  }, [isDark])

  // 테마별 클래스 매핑
  const T: ThemeClasses = isDark ? {
    bg: 'bg-[#020202]', card: 'bg-[#121212]', cardAlt: 'bg-[#1A1A1A]',
    text: 'text-white', textSub: 'text-gray-400', textMuted: 'text-gray-500',
    border: 'border-[#1A1A1A]', borderAlt: 'border-[#2A2A2A]',
    cover: 'from-pink-900/50 via-purple-900/40 to-orange-900/30',
    avatarBorder: 'border-[#020202]', input: 'bg-[#121212] text-white',
    btnOutline: 'border-[#2A2A2A] text-gray-300',
  } : {
    bg: 'bg-white', card: 'bg-white', cardAlt: 'bg-gray-50',
    text: 'text-gray-900', textSub: 'text-gray-600', textMuted: 'text-gray-500',
    border: 'border-gray-100', borderAlt: 'border-gray-200',
    cover: 'from-pink-200 via-purple-100 to-orange-100',
    avatarBorder: 'border-white', input: 'bg-gray-50 text-gray-900',
    btnOutline: 'border-gray-200 text-gray-700',
  }

  const startEdit = (field: string) => {
    if (!isOwner) return
    setEditingField(field)
    if (field === 'name') setEditName(seller?.name || '')
    if (field === 'bio') setEditBio(seller?.bio || '')
    if (field === 'kakao') setEditKakao(seller?.kakao_chat_link || '')
    if (field === 'instagram') setEditInsta(seller?.sns_instagram || '')
    if (field === 'youtube') setEditYoutube(seller?.sns_youtube || '')
  }

  const saveEdit = async (field: string, value: string) => {
    setSaving(true)
    const token = localStorage.getItem('seller_token')
    try {
      const payload: Record<string, string> = {}
      if (field === 'name') payload.name = value
      if (field === 'bio') payload.bio = value
      if (field === 'kakao') payload.kakao_chat_link = value
      if (field === 'instagram') payload.sns_instagram = value
      if (field === 'youtube') payload.sns_youtube = value

      await api.put('/api/seller/profile', payload, { headers: { Authorization: `Bearer ${token}` } })
      setSeller(prev => prev ? { ...prev, ...payload } : prev)
      setEditingField(null)
      toast.success(t('common.saveSuccess'))
    } catch { toast.error(t('common.saveFailed')) }
    finally { setSaving(false) }
  }

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)

    api.get(`/api/sellers/${sellerId}/public`).then(sellerRes => {
      const sellerData = sellerRes.data.data
      if (!sellerData) { setSeller(null); setLoading(false); return }
      setSeller(sellerData)

      const numericId = sellerData.id
      return Promise.all([
        api.get(`/api/products?seller_id=${numericId}&limit=20`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/streams?seller_id=${numericId}&limit=20`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/shorts/feed?limit=20`).catch(() => ({ data: { data: [] } })),
      ]).then(([productsRes, streamsRes, shortsRes]) => {
        setProducts(productsRes.data.data || [])
        setStreams(streamsRes.data.data || [])
        const allShorts = shortsRes.data.data || []
        setShorts(allShorts.filter((s: Short & { seller_id?: number }) => String(s.seller_id) === String(numericId)))
      })
    }).catch(() => { setSeller(null) })
      .finally(() => setLoading(false))
  }, [sellerId])

  // 실시간 라이브 감지 — 30초마다 streams 만 재조회 (가벼운 쿼리)
  useEffect(() => {
    if (!seller) return
    const numericId = seller.id
    let prevLiveCount = streams.filter(s => s.status === 'live').length

    const poll = async () => {
      try {
        const res = await api.get(`/api/streams?seller_id=${numericId}&limit=20`)
        const fresh: LiveStream[] = res.data.data || []
        const freshLiveCount = fresh.filter(s => s.status === 'live').length
        setStreams(fresh)

        if (prevLiveCount === 0 && freshLiveCount > 0) {
          const liveStream = fresh.find(s => s.status === 'live')
          toast.success(`${seller.name} 셀러의 라이브가 시작됐어요!`)
          if (liveStream) {
            try { if ('vibrate' in navigator) navigator.vibrate(200) } catch { /* ignore */ }
          }
        }
        if (prevLiveCount > 0 && freshLiveCount === 0) {
          toast.info('라이브 방송이 종료됐어요.')
        }
        prevLiveCount = freshLiveCount
      } catch { /* silent */ }
    }

    const id = setInterval(poll, 30000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller?.id])

  if (loading) return (
    <div className="min-h-screen bg-[#020202] dark flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
    </div>
  )

  if (!seller) return (
    <div className="min-h-screen bg-[#020202] dark flex flex-col items-center justify-center">
      <p className="text-gray-500">{t('seller.sellerNotFound')}</p>
      <button onClick={() => navigate('/')} className="mt-3 text-sm text-pink-500">{t('seller.goToHome')}</button>
    </div>
  )

  const liveNow = streams.find(s => s.status === 'live')
  const recentStreams = streams.slice(0, 6)

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: t('seller.tabHome') },
    { key: 'vouchers', label: `${t('seller.publicPage.vouchers')} ${mealVouchers.length}` },
    { key: 'shorts', label: `${t('seller.publicPage.videos')} ${shorts.length}` },
    { key: 'live', label: `${t('seller.tabLive')} ${streams.length}` },
    { key: 'info', label: t('seller.tabInfo') },
  ]

  return (
    <div className={`min-h-screen ${T.bg}`}>
      <SellerPublicHeader
        seller={seller}
        sellerId={sellerId!}
        products={products}
        streams={streams}
        liveNow={liveNow}
        isOwner={isOwner}
        isDark={isDark}
        setIsDark={setIsDark}
        T={T}
        editingField={editingField}
        setEditingField={setEditingField}
        editName={editName}
        setEditName={setEditName}
        editBio={editBio}
        setEditBio={setEditBio}
        saving={saving}
        startEdit={startEdit}
        saveEdit={saveEdit}
        setSeller={setSeller}
      />

      <SellerPublicTabBar tabs={TABS} tab={tab} setTab={setTab} T={T} />

      <div className="px-4 py-5">
        {tab === 'home' && (
          <SellerPublicHomeTab
            mealVouchers={mealVouchers}
            shorts={shorts}
            recentStreams={recentStreams}
            streams={streams}
            isOwner={isOwner}
            T={T}
            setTab={setTab}
          />
        )}
        {tab === 'vouchers' && (
          <SellerPublicVouchersTab
            mealVouchers={mealVouchers}
            isOwner={isOwner}
            T={T}
          />
        )}
        {tab === 'shorts' && (
          <SellerPublicShortsTab
            shorts={shorts}
            isOwner={isOwner}
            T={T}
          />
        )}
        {tab === 'live' && (
          <SellerPublicLiveTab streams={streams} />
        )}
        {tab === 'info' && (
          <SellerPublicInfoTab
            seller={seller}
            sellerId={sellerId!}
            isOwner={isOwner}
            T={T}
            editingField={editingField}
            setEditingField={setEditingField}
            editBio={editBio}
            setEditBio={setEditBio}
            editInsta={editInsta}
            setEditInsta={setEditInsta}
            editYoutube={editYoutube}
            setEditYoutube={setEditYoutube}
            editKakao={editKakao}
            setEditKakao={setEditKakao}
            saving={saving}
            startEdit={startEdit}
            saveEdit={saveEdit}
          />
        )}
      </div>

      {/* 셀러 본인: 플로팅 대시보드 버튼 */}
      {isOwner && (
        <button
          onClick={() => navigate('/seller')}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl shadow-blue-600/30 text-sm font-bold active:scale-95"
        >
          <Settings className="w-4 h-4" />
          {t('seller.dashboard')}
        </button>
      )}
    </div>
  )
}
