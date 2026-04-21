import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Loader2, ArrowLeft, Share2, Star, MessageCircle, Heart, ChevronRight, Eye, Play, Clock, MapPin, Pencil, Plus, Settings, Trophy, Camera, Check, X, Phone, Sun, Moon } from 'lucide-react'
import SupporterRanking from '@/components/live/SupporterRanking'
import { toast } from '@/hooks/useToast'
import { nativeShare } from '@/lib/native'
import SEO from '@/components/SEO'

interface Seller {
  id: number; name: string; username?: string; slug?: string; business_name?: string; profile_image?: string; bio?: string
  sns_instagram?: string; sns_youtube?: string; sns_facebook?: string; sns_twitter?: string
  kakao_chat_link?: string; website_url?: string; created_at: string
  business_number?: string; email?: string; phone?: string
}
interface LiveStream {
  id: number; title: string; youtube_video_id?: string; status: string; viewer_count?: number
  scheduled_at?: string; created_at: string
}
interface Product {
  id: number; name: string; price: number; original_price?: number; discount_rate?: number
  image_url?: string; sold_count?: number; category?: string
  restaurant_name?: string; restaurant_address?: string
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string
}
interface Short {
  id: number; title: string; youtube_video_id?: string; view_count: number; thumbnail_url?: string
  product_id?: number; product_name?: string; product_price?: number
}

type Tab = 'home' | 'vouchers' | 'shorts' | 'live' | 'info'

export default function SellerPublicPage() {
  const { t } = useTranslation()
  const { sellerId: rawParam } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  // sellerId는 숫자 ID 또는 slug/username
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDark, setIsDark] = useState(true)

  // 테마별 클래스 매핑
  const T = isDark ? {
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
      // 로컬 상태 업데이트
      setSeller(prev => prev ? { ...prev, ...payload } : prev)
      setEditingField(null)
      toast.success(t('common.saveSuccess'))
    } catch { toast.error(t('common.saveFailed')) }
    finally { setSaving(false) }
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const token = localStorage.getItem('seller_token')

    // 이미지 → base64 or presigned upload
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setSaving(true)
      try {
        await api.put('/api/seller/profile', { profile_image: base64 }, { headers: { Authorization: `Bearer ${token}` } })
        setSeller(prev => prev ? { ...prev, profile_image: base64 } : prev)
        toast.success(t('seller.publicPage.profileImageChanged'))
      } catch { toast.error(t('seller.publicPage.imageUploadFailed')) }
      finally { setSaving(false) }
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!sellerId) return
    setLoading(true)

    // 먼저 셀러 정보 조회 (username/slug 지원)
    api.get(`/api/sellers/${sellerId}/public`).then(sellerRes => {
      const sellerData = sellerRes.data.data
      if (!sellerData) { setSeller(null); setLoading(false); return }
      setSeller(sellerData)

      // 셀러 ID로 나머지 데이터 조회
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
  const bestProducts = products.slice(0, 6)
  const recentStreams = streams.slice(0, 6)

  const mealVouchers = products.filter(p => p.category === 'meal_voucher')
  const regularProducts = products.filter(p => p.category !== 'meal_voucher')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: t('seller.tabHome') },
    { key: 'vouchers', label: `${t('seller.publicPage.vouchers')} ${mealVouchers.length}` },
    { key: 'shorts', label: `${t('seller.publicPage.videos')} ${shorts.length}` },
    { key: 'live', label: `${t('seller.tabLive')} ${streams.length}` },
    { key: 'info', label: t('seller.tabInfo') },
  ]

  return (
    <div className={`min-h-screen ${T.bg}`}>
      <SEO
        title={seller.name || t('product.seller')}
        description={seller.bio || `${seller.name || t('product.seller')} - Ur Deal`}
        image={seller.profile_image}
        url={`/profile/${seller.username || seller.slug || seller.id}`}
      />
      {/* 커버 + 프로필 */}
      <div className="relative">
        {/* 커버 이미지 */}
        <div className={`h-44 bg-gradient-to-br ${T.cover}`} />

        {/* 상단 네비 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe pb-2 z-10">
          <button onClick={() => navigate(-1)} className="p-2 bg-black/20 rounded-full backdrop-blur-sm">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 bg-black/20 rounded-full backdrop-blur-sm"
            >
              {isDark ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-white" />}
            </button>
            <button onClick={() => {
              const url = window.location.href
              if (navigator.share) navigator.share({ title: seller.name, url })
              else { navigator.clipboard?.writeText(url); toast.success(t('seller.linkCopiedToast')) }
            }} className="p-2 bg-black/20 rounded-full backdrop-blur-sm">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* 프로필 아바타 */}
        <div className="absolute -bottom-10 left-5">
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full border-4 ${T.avatarBorder} bg-gray-700 overflow-hidden shadow-lg ${isOwner ? 'cursor-pointer' : ''}`}
              onClick={() => isOwner && fileInputRef.current?.click()}
            >
              {seller.profile_image ? (
                <img src={seller.profile_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${T.text}`}>{(seller.name || '?').charAt(0)}</span>
                </div>
              )}
              {isOwner && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            {isOwner && <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />}
            {liveNow && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
            )}
          </div>
        </div>
      </div>

      {/* 셀러 정보 */}
      <div className="pt-14 px-5 pb-4">
        <div className="flex items-center justify-between">
          {editingField === 'name' ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className={`text-xl font-extrabold ${T.text} bg-transparent border-b-2 border-pink-500 focus:outline-none flex-1`}
                onKeyDown={e => e.key === 'Enter' && saveEdit('name', editName)}
              />
              <button onClick={() => saveEdit('name', editName)} disabled={saving} className="p-1.5 bg-pink-500 rounded-full text-white"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingField(null)} className="p-1.5 bg-gray-200 rounded-full text-gray-500"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <h1 className={`text-xl font-extrabold ${T.text} group`} onClick={() => startEdit('name')}>
              {seller.name || t('seller.publicPage.noName')}
              {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </h1>
          )}
        </div>
        {seller.business_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">{seller.business_name}</span>
          </div>
        )}
        {editingField === 'bio' ? (
          <div className="mt-2">
            <textarea
              autoFocus
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={3}
              className="w-full text-sm text-gray-400 bg-[#121212] border border-pink-500 rounded-lg p-2 focus:outline-none focus:border-pink-500 resize-none"
            />
            <div className="flex gap-2 mt-1">
              <button onClick={() => saveEdit('bio', editBio)} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
              <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-[#1A1A1A] text-gray-500 text-xs rounded-lg">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="group mt-2" onClick={() => startEdit('bio')}>
            <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
              {seller.bio || (isOwner ? t('seller.publicPage.enterBio') : '')}
            </p>
            {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        )}

        {/* 통계 */}
        <div className="flex items-center gap-6 mt-4 py-3 border-y border-[#1A1A1A]">
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.tabProducts')}</p>
            <p className={`text-sm font-bold ${T.text}`}>{products.length}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.tabLive')}</p>
            <p className={`text-sm font-bold ${T.text}`}>{streams.length}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-gray-500">{t('seller.rating')}</p>
            <p className={`text-sm font-bold ${T.text} flex items-center justify-center gap-0.5`}>
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> 5.0
            </p>
          </div>
        </div>

        {/* 팔로우 + CTA */}
        <FollowButton sellerId={sellerId!} />
        <div className="flex gap-2 mt-2">
          {seller.kakao_chat_link && (
            <a href={seller.kakao_chat_link} target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#2A2A2A] rounded-xl text-sm font-medium text-gray-300">
              <MessageCircle className="w-4 h-4" /> {t('seller.oneOnOneInquiry')}
            </a>
          )}
          <button
            onClick={() => liveNow ? navigate(`/live/${liveNow.id}`) : toast.info(t('seller.noLiveNow'))}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#2A2A2A] rounded-xl text-sm font-medium text-gray-300"
          >
            <Heart className="w-4 h-4" /> {t('seller.donateButton')}
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className={`sticky top-0 z-20 ${T.bg} border-b ${T.border}`}>
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? `border-current ${T.text}` : `border-transparent ${T.textMuted}`
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="px-4 py-5">
        {/* ═══ 홈 탭 ═══ */}
        {tab === 'home' && (
          <div className="space-y-6">
            {/* 식사권 하이라이트 (있을 때) */}
            {mealVouchers.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-base font-bold ${T.text}`}>🍽️ {t('seller.publicPage.recommendedVouchers')}</h2>
                  <button onClick={() => setTab('vouchers')} className="text-xs text-gray-500 flex items-center">{t('seller.seeMore')} <ChevronRight className="w-3 h-3" /></button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {mealVouchers.slice(0, 4).map(p => {
                    const disc = p.original_price && p.original_price > 0 ? Math.round((1 - (p.price || 0) / p.original_price) * 100) : 0
                    const progress = (p.group_buy_target ?? 0) > 0 ? Math.min(100, ((p.group_buy_current || 0) / (p.group_buy_target || 1)) * 100) : 0
                    const isAchieved = (p.group_buy_current || 0) > 0 && (p.group_buy_target || 0) > 0 && p.group_buy_current! >= p.group_buy_target!
                    return (
                      <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="shrink-0 w-44 text-left active:scale-[0.97]">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#1A1A1A]">
                          {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                          {disc > 0 && <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">-{disc}%</span>}
                          {isAchieved && <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{t('seller.publicPage.achieved')}</span>}
                        </div>
                        <div className="mt-2">
                          <p className={`text-[12px] font-medium ${T.text} line-clamp-1`}>{p.name}</p>
                          {p.restaurant_name && <p className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-2.5 h-2.5" />{p.restaurant_name}</p>}
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-[13px] font-extrabold text-red-500">{(p.price || 0).toLocaleString()}원</span>
                            {p.original_price && p.original_price > p.price && (
                              <span className="text-[10px] text-gray-500 line-through">{(p.original_price || 0).toLocaleString()}</span>
                            )}
                          </div>
                          {(p.group_buy_target ?? 0) > 0 && (
                            <div className="mt-1.5">
                              <div className="w-full bg-gray-700 rounded-full h-1.5"><div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                              <div className="flex items-center justify-between mt-0.5">
                                <p className="text-[9px] text-gray-400">{p.group_buy_current || 0}/{p.group_buy_target}명</p>
                                {!isAchieved && <p className="text-[9px] text-pink-400 font-medium">{t('seller.publicPage.joinGroupBuy')}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* 최신 영상 (YouTube 임베드 2열) */}
            {shorts.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-base font-bold ${T.text}`}>📹 {t('seller.publicPage.reviewVideos')}</h2>
                  {isOwner && <button onClick={() => navigate('/seller/shorts')} className="text-xs text-blue-500 flex items-center gap-0.5"><Plus className="w-3 h-3" /> {t('seller.publicPage.addVideo')}</button>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {shorts.slice(0, 4).map(s => (
                    <div key={s.id} className="rounded-xl overflow-hidden bg-[#1A1A1A]">
                      {s.youtube_video_id ? (
                        <div className="aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${s.youtube_video_id}`}
                            title={s.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gray-200 flex items-center justify-center"><Play className="w-6 h-6 text-gray-400" /></div>
                      )}
                      <div className="p-2">
                        <p className={`text-[11px] font-medium ${T.text} line-clamp-1`}>{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
                          {s.product_name && <span className="text-[10px] text-pink-500 font-medium">{s.product_name}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {shorts.length > 4 && (
                  <button onClick={() => setTab('shorts')} className="w-full mt-3 py-2.5 text-sm text-gray-500 bg-[#121212] rounded-xl font-medium">
                    {t('seller.publicPage.moreVideos', { count: shorts.length })}
                  </button>
                )}
              </section>
            )}

            {/* 라이브 */}
            {recentStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={`text-base font-bold ${T.text}`}>{t('seller.tabLive')} <span className="text-pink-500">{streams.length}</span></h2>
                  <button onClick={() => setTab('live')} className="text-xs text-gray-500 flex items-center">{t('seller.seeMore')} <ChevronRight className="w-3 h-3" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {recentStreams.slice(0, 4).map(s => (
                    <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ═══ 식사권 탭 ═══ */}
        {tab === 'vouchers' && (
          mealVouchers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">{t('seller.publicPage.noVouchers')}</p>
              {isOwner && <button onClick={() => navigate('/seller/products/new')} className="mt-3 text-sm text-pink-500 font-medium">{t('seller.publicPage.registerVoucher')}</button>}
            </div>
          ) : (
            <div className="space-y-3">
              {mealVouchers.map(p => {
                const disc = p.original_price && p.original_price > 0 ? Math.round((1 - (p.price || 0) / p.original_price) * 100) : 0
                const progress = (p.group_buy_target ?? 0) > 0 ? Math.min(100, ((p.group_buy_current || 0) / (p.group_buy_target || 1)) * 100) : 0
                return (
                  <button key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="w-full flex gap-3 p-3 bg-[#121212] rounded-xl text-left active:scale-[0.98]">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                      {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${T.text} line-clamp-1`}>{p.name}</p>
                      {p.restaurant_name && <p className="text-xs text-gray-500 flex items-center gap-0.5 mt-0.5"><MapPin className="w-3 h-3" />{p.restaurant_name}</p>}
                      {p.restaurant_address && <p className="text-[10px] text-gray-400 mt-0.5">{p.restaurant_address}</p>}
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        {disc > 0 && <span className="text-sm font-extrabold text-red-500">{disc}%</span>}
                        <span className={`text-sm font-extrabold ${T.text}`}>{(p.price || 0).toLocaleString()}원</span>
                        {p.original_price && <span className="text-xs text-gray-400 line-through">{(p.original_price || 0).toLocaleString()}원</span>}
                      </div>
                      {(p.group_buy_target ?? 0) > 0 && (
                        <div className="mt-1.5">
                          <div className="w-full bg-gray-700 rounded-full h-1.5"><div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-[10px] text-gray-500">{p.group_buy_current || 0}/{p.group_buy_target}{t('common.person')}</p>
                            {p.group_buy_current && p.group_buy_target && p.group_buy_current >= p.group_buy_target
                              ? <span className="text-[10px] text-green-400 font-bold">{t('seller.publicPage.achieved')}</span>
                              : <span className="text-[10px] text-pink-400 font-medium">{t('seller.publicPage.joinGroupBuy')}</span>
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        )}

        {/* ═══ 영상 탭 (YouTube 임베드 2열) ═══ */}
        {tab === 'shorts' && (
          shorts.length === 0 ? (
            <div className="text-center py-16">
              <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{t('seller.publicPage.noVideos')}</p>
              {isOwner && <button onClick={() => navigate('/seller/shorts')} className="mt-3 text-sm text-blue-500 font-medium">{t('seller.publicPage.registerVideo')}</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shorts.map(s => (
                <div key={s.id} className="rounded-xl overflow-hidden bg-[#1A1A1A]">
                  {s.youtube_video_id ? (
                    <div className="aspect-video">
                      <iframe
                        src={`https://www.youtube.com/embed/${s.youtube_video_id}`}
                        title={s.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-200 flex items-center justify-center"><Play className="w-6 h-6 text-gray-400" /></div>
                  )}
                  <div className="p-2">
                    <p className={`text-[11px] font-medium ${T.text} line-clamp-2`}>{s.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 flex items-center gap-0.5"><Eye className="w-3 h-3" />{s.view_count}</span>
                      {s.product_name && (
                        <button onClick={() => s.product_id && navigate(`/products/${s.product_id}`)} className="text-[10px] text-pink-500 font-medium">
                          🍽️ {s.product_name}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ═══ 라이브 탭 ═══ */}
        {tab === 'live' && (
          streams.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">{t('seller.publicPage.noLiveRecords')}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {streams.map(s => (
                <StreamCard key={s.id} stream={s} onClick={() => navigate(`/live/${s.id}`)} />
              ))}
            </div>
          )
        )}

        {/* ═══ 정보 탭 ═══ */}
        {tab === 'info' && (
          <div className="space-y-6">
            <section>
              <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.introduction')}</h3>
              {editingField === 'bio-info' ? (
                <div>
                  <textarea autoFocus value={editBio} onChange={e => setEditBio(e.target.value)} rows={4}
                    className="w-full text-sm bg-[#121212] border border-pink-500 rounded-lg p-2 focus:outline-none resize-none" />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { saveEdit('bio', editBio); setEditingField(null) }} disabled={saving} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">{t('common.save')}</button>
                    <button onClick={() => setEditingField(null)} className="px-3 py-1 bg-[#1A1A1A] text-gray-500 text-xs rounded-lg">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap group" onClick={() => { if (isOwner) { setEditBio(seller.bio || ''); setEditingField('bio-info') } }}>
                  {seller.bio || (isOwner ? t('seller.publicPage.enterBioTap') : t('seller.publicPage.noBio'))}
                  {isOwner && <Pencil className="w-3 h-3 text-gray-300 inline ml-1 opacity-0 group-hover:opacity-100" />}
                </p>
              )}

              {/* SNS 링크 */}
              <div className="mt-3 space-y-2">
                {/* Instagram */}
                {editingField === 'instagram' ? (
                  <div className="flex gap-2">
                    <input autoFocus value={editInsta} onChange={e => setEditInsta(e.target.value)} placeholder="https://instagram.com/..."
                      className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-[#121212]" />
                    <button onClick={() => saveEdit('instagram', editInsta)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingField(null)} className="px-2 py-1.5 bg-[#1A1A1A] text-xs rounded-lg"><X className="w-3 h-3" /></button>
                  </div>
                ) : seller.sns_instagram ? (
                  <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('instagram')}>
                    <a href={seller.sns_instagram} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-pink-500">Instagram →</a>
                    {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
                  </div>
                ) : isOwner ? (
                  <button onClick={() => startEdit('instagram')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addInstagram')}</button>
                ) : null}

                {/* YouTube */}
                {editingField === 'youtube' ? (
                  <div className="flex gap-2">
                    <input autoFocus value={editYoutube} onChange={e => setEditYoutube(e.target.value)} placeholder="https://youtube.com/..."
                      className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-[#121212]" />
                    <button onClick={() => saveEdit('youtube', editYoutube)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingField(null)} className="px-2 py-1.5 bg-[#1A1A1A] text-xs rounded-lg"><X className="w-3 h-3" /></button>
                  </div>
                ) : seller.sns_youtube ? (
                  <div className="flex items-center gap-2 group" onClick={() => isOwner && startEdit('youtube')}>
                    <a href={seller.sns_youtube} target="_blank" rel="noopener" onClick={e => isOwner && e.preventDefault()} className="text-sm text-red-500">YouTube →</a>
                    {isOwner && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
                  </div>
                ) : isOwner ? (
                  <button onClick={() => startEdit('youtube')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addYoutube')}</button>
                ) : null}

                {/* 카카오 채팅 */}
                {editingField === 'kakao' ? (
                  <div className="flex gap-2">
                    <input autoFocus value={editKakao} onChange={e => setEditKakao(e.target.value)} placeholder="https://open.kakao.com/..."
                      className="flex-1 px-2 py-1.5 border border-pink-500 rounded-lg text-sm bg-[#121212]" />
                    <button onClick={() => saveEdit('kakao', editKakao)} className="px-2 py-1.5 bg-pink-500 text-white text-xs rounded-lg"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingField(null)} className="px-2 py-1.5 bg-[#1A1A1A] text-xs rounded-lg"><X className="w-3 h-3" /></button>
                  </div>
                ) : isOwner && !seller.kakao_chat_link ? (
                  <button onClick={() => startEdit('kakao')} className="text-xs text-gray-400 flex items-center gap-1"><Plus className="w-3 h-3" /> {t('seller.publicPage.addKakaoChat')}</button>
                ) : null}
              </div>
            </section>
            {/* 사업자 정보 + 연락처 */}
            <section className="bg-[#121212] rounded-xl p-4">
              <h3 className={`text-sm font-bold ${T.text} mb-3`}>{t('seller.publicPage.sellerInfo')}</h3>
              <div className="text-sm text-gray-400 space-y-2">
                {seller.business_name && (
                  <div className="flex"><span className="w-20 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.businessName')}</span><span className="text-xs">{seller.business_name}</span></div>
                )}
                {seller.name && (
                  <div className="flex"><span className="w-20 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.representative')}</span><span className="text-xs">{seller.name}</span></div>
                )}
                {seller.business_number && (
                  <div className="flex"><span className="w-20 text-gray-400 shrink-0 text-xs">{t('seller.publicPage.businessNumber')}</span><span className="text-xs">{seller.business_number}</span></div>
                )}
                {seller.email && (
                  <div className="flex"><span className="w-20 text-gray-400 shrink-0 text-xs">{t('common.email')}</span><span className="text-xs">{seller.email}</span></div>
                )}
              </div>
              {/* 연락 수단 */}
              <div className="flex gap-2 mt-3">
                {seller.kakao_chat_link && (
                  <a href={seller.kakao_chat_link} target="_blank" rel="noopener"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-xs font-bold active:scale-[0.97]">
                    <MessageCircle className="w-3.5 h-3.5" /> {t('seller.publicPage.kakaoInquiry')}
                  </a>
                )}
                {seller.phone && (
                  <a href={`tel:${seller.phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#020202] border border-[#2A2A2A] text-gray-300 rounded-xl text-xs font-bold active:scale-[0.97]">
                    <Phone className="w-3.5 h-3.5" /> {t('seller.publicPage.phoneInquiry')}
                  </a>
                )}
              </div>
            </section>

            {/* 서포터 랭킹 */}
            <section>
              <SupporterRanking sellerId={sellerId!} />
            </section>

            <section>
              <h3 className={`text-base font-bold ${T.text} mb-2`}>{t('seller.publicPage.voucherGuide')}</h3>
              <div className="text-sm text-gray-400 space-y-2">
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.howToUse')}</span><span>{t('seller.publicPage.howToUseDesc')}</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.validity')}</span><span>{t('seller.publicPage.validityDesc')}</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.refund')}</span><span>{t('seller.publicPage.refundDesc')}</span></div>
                <div className="flex"><span className="w-20 text-gray-500 shrink-0">{t('seller.publicPage.contact')}</span><span>{t('seller.publicPage.contactDesc')}</span></div>
              </div>
            </section>
          </div>
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

function FollowButton({ sellerId }: { sellerId: string }) {
  const { t } = useTranslation()
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get(`/api/social/follow/${sellerId}`).then(r => {
      if (r.data.success) setFollowing(r.data.data.following)
    }).catch(() => {})
  }, [sellerId])

  return (
    <button
      onClick={async () => {
        setLoading(true)
        try {
          const res = await api.post(`/api/social/follow/${sellerId}`)
          if (res.data.success) setFollowing(res.data.data.following)
        } catch { /* 로그인 필요 */ }
        finally { setLoading(false) }
      }}
      disabled={loading}
      className={`w-full py-3 rounded-xl text-sm font-bold mt-4 transition-all active:scale-[0.98] ${
        following
          ? 'bg-[#1A1A1A] text-gray-400 border border-[#2A2A2A]'
          : 'bg-pink-500 text-white'
      }`}
    >
      {following ? t('seller.publicPage.following') : t('seller.publicPage.follow')}
    </button>
  )
}

function StreamCard({ stream, onClick }: { stream: LiveStream; onClick: () => void }) {
  const { t } = useTranslation()
  const isLive = stream.status === 'live'
  const thumb = stream.youtube_video_id ? `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg` : null

  return (
    <button onClick={onClick} className="text-left active:scale-[0.98] transition-transform">
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-[#1A1A1A]">
        {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />}
        {isLive ? (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-[#020202] rounded-full animate-pulse" />LIVE
          </span>
        ) : stream.status === 'scheduled' ? (
          <span className="absolute top-2 left-2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded">{t('seller.scheduledLabel')}</span>
        ) : null}
        {isLive && stream.viewer_count !== undefined && (
          <span className="absolute bottom-2 left-2 text-white text-[10px] flex items-center gap-0.5 drop-shadow-lg">
            <Eye className="w-3 h-3" /> {(stream.viewer_count || 0).toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-[11px] text-gray-800 mt-1.5 line-clamp-2 font-medium">{stream.title}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {stream.viewer_count !== undefined ? `👁 ${(stream.viewer_count || 0).toLocaleString()}` : ''}
        {stream.created_at ? ` · ${new Date(stream.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}` : ''}
      </p>
    </button>
  )
}
