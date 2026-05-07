/**
 * 🛡️ 2026-05-01: TD-018 분할 — SellerLiveBroadcastPage StepInfo 추출.
 *
 * 방송 메타정보 입력 폼 — title / description / thumbnail / privacy / 예약일정 /
 * 상품 선택 / 송출방식 (RTMP / 스마트폰) / 목적지 플랫폼.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Globe, EyeOff, Lock, Youtube, Loader2, Radio, AlertTriangle, Zap, Play, VideoIcon, Smartphone, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/useToast'
import { PromptModal } from '../SellerLiveBroadcast.modals'
import {
  getLastBroadcast,
  getTemplates,
  saveTemplates,
} from '../SellerLiveBroadcast.storage'
import type { StreamMethod, BroadcastTemplate } from '../SellerLiveBroadcast.storage'
import type { Product, YouTubeChannel, Destination, DestinationPlatform } from './types'

interface StepInfoProps {
  title: string; setTitle: (v: string) => void
  description: string; setDescription: (v: string) => void
  thumbnailUrl: string; setThumbnailUrl: (v: string) => void
  privacy: 'public' | 'unlisted' | 'private'; setPrivacy: (v: 'public' | 'unlisted' | 'private') => void
  isScheduled: boolean; setIsScheduled: (fn: (v: boolean) => boolean) => void
  scheduledDate: string; setScheduledDate: (v: string) => void
  scheduledTime: string; setScheduledTime: (v: string) => void
  sellableProducts: Product[]; selectedProducts: number[]
  setSelectedProducts: React.Dispatch<React.SetStateAction<number[]>>
  toggleProduct: (id: number) => void
  method: StreamMethod; setMethod: (v: StreamMethod) => void
  destination: Destination; setDestination: (v: Destination) => void
  destinations: DestinationPlatform[]
  creating: boolean; onCreate: (overrides?: { title?: string; productIds?: number[] }) => void
  navigate: ReturnType<typeof useNavigate>
  channels: YouTubeChannel[]
  recentProductIds: number[]
  tokenExpired: boolean
  onReauthenticate: () => void
  connectingYouTube: boolean
  // 🛡️ 2026-05-07: 신규 옵션 — 알림톡 / 연습 모드
  notifyFollowers?: boolean
  setNotifyFollowers?: (v: boolean) => void
  practiceMode?: boolean
  setPracticeMode?: (v: boolean) => void
}

export default function StepInfo({ title, setTitle, description, setDescription, thumbnailUrl, setThumbnailUrl, privacy, setPrivacy,
  isScheduled, setIsScheduled, scheduledDate, setScheduledDate, scheduledTime, setScheduledTime,
  sellableProducts, selectedProducts, setSelectedProducts, toggleProduct, method, setMethod,
  destination, setDestination, destinations,
  creating, onCreate, navigate, channels, recentProductIds,
  tokenExpired, onReauthenticate, connectingYouTube,
  notifyFollowers = true, setNotifyFollowers,
  practiceMode = false, setPracticeMode,
}: StepInfoProps) {
  const { t } = useTranslation()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // 고급 설정이 마지막 방송과 동일한지 (description/thumbnail/privacy)
  const lastBc = getLastBroadcast()
  const advancedUnchanged =
    description === (lastBc.description || '') &&
    thumbnailUrl === (lastBc.thumbnailUrl || '') &&
    privacy === (lastBc.privacy || 'public') &&
    !isScheduled
  const [productSearch, setProductSearch] = useState('')
  const [templates, setTemplates] = useState<BroadcastTemplate[]>(() => getTemplates())
  const [showTemplates, setShowTemplates] = useState(false)
  const hasPersistentKey = channels[0]?.has_persistent_key
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
  const privacyOptions: { key: 'public' | 'unlisted' | 'private'; icon: typeof Globe; label: string; desc: string }[] = [
    { key: 'public', icon: Globe, label: t('seller.liveBroadcast.public'), desc: t('seller.liveBroadcast.publicDesc') },
    { key: 'unlisted', icon: EyeOff, label: t('seller.liveBroadcast.unlisted'), desc: t('seller.liveBroadcast.unlistedDesc') },
    { key: 'private', icon: Lock, label: t('seller.liveBroadcast.private'), desc: t('seller.liveBroadcast.privateDesc') },
  ]
  // 🛡️ 2026-05-07: YouTube Studio 웹캠 모드 제거.
  //   - 24h 인증/모바일 차단/팝업/채널 매칭 등 변수가 너무 많아 검증 실패율 높음.
  //   - 백엔드 (`/create-webcam`, `/detect-webcam`, `/link-broadcast`) 는 유지하되 UI 노출만 제거.
  //   셀러는 Prism (모바일) / OBS / YouTube Studio + 외부 인코더 중 선택.
  const methodOptions = [
    { key: 'prism' as const, icon: Smartphone, label: t('seller.liveBroadcast.naverPrism', { defaultValue: 'Prism Mobile' }), desc: t('seller.liveBroadcast.prismDesc', { defaultValue: '핸드폰 1대로 끝 · QR 1번 스캔' }), active: 'border-green-400 bg-green-50', iconActive: 'text-green-600', hasKey: !!hasPersistentKey, recommended: true },
    { key: 'obs' as const, icon: VideoIcon, label: 'OBS Studio', desc: t('seller.liveBroadcast.obsDesc', { defaultValue: 'PC + OBS · 자동 연결 시 원클릭 송출' }), active: 'border-purple-400 bg-purple-50', iconActive: 'text-purple-600', hasKey: !!hasPersistentKey, recommended: false },
    { key: 'youtube' as const, icon: Youtube, label: 'YouTube Studio (OBS 인코더)', desc: 'OBS + 다중 채널 관리 · 전문가용', active: 'border-orange-400 bg-orange-50', iconActive: 'text-orange-600', hasKey: false, recommended: false },
  ]

  // 상품 정렬: 선택된 것 → 최근 사용 → 나머지
  const filteredProducts = (() => {
    const q = productSearch.trim().toLowerCase()
    const filtered = q ? sellableProducts.filter(p => p.name.toLowerCase().includes(q)) : sellableProducts
    const selectedSet = new Set(selectedProducts)
    const recentSet = new Set(recentProductIds)
    return [...filtered].sort((a, b) => {
      const aSel = selectedSet.has(a.id) ? 0 : recentSet.has(a.id) ? 1 : 2
      const bSel = selectedSet.has(b.id) ? 0 : recentSet.has(b.id) ? 1 : 2
      return aSel - bSel
    })
  })()

  function applyTemplate(tpl: BroadcastTemplate) {
    setTitle(tpl.title)
    setDescription(tpl.description)
    setPrivacy(tpl.privacy)
    const validProducts = tpl.productIds.filter(id => sellableProducts.some(p => p.id === id))
    setSelectedProducts(validProducts)
    setShowTemplates(false)
    const removed = tpl.productIds.length - validProducts.length
    if (removed > 0) {
      toast.info(t('seller.liveBroadcast.templateAppliedPartial', { removed }) as string)
    } else {
      toast.success(t('seller.liveBroadcast.templateApplied'))
    }
  }

  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  function handleSaveTemplate(name: string) {
    const newTpl: BroadcastTemplate = { name, title, description, privacy, productIds: selectedProducts }
    const updated = [newTpl, ...templates.filter(t => t.name !== name)]
    saveTemplates(updated)
    setTemplates(updated)
    setShowSaveTemplate(false)
    toast.success(t('seller.liveBroadcast.templateSaved'))
  }
  // 🛡️ 2026-04-23 배치 164: 1-click quick start (P1 UX 단순화)
  //   클릭 한 번으로 기본값(오늘 날짜 제목 + 최근 상품 3개 + quick 방식)으로 방송 생성.
  //   세부 설정이 필요한 사용자는 아래 폼을 이용.
  const canQuickStart = sellableProducts.length > 0 && !creating
  const handleQuickStart = () => {
    if (!canQuickStart) return
    const now = new Date()
    const lng = (typeof navigator !== 'undefined' && navigator.language) || 'ko'
    const dateFmt = new Intl.DateTimeFormat(lng, { month: 'short', day: 'numeric' }).format(now)
    const timeFmt = new Intl.DateTimeFormat(lng, { hour: 'numeric', hour12: false }).format(now)
    const autoTitle = t('seller.liveBroadcast.quickAutoTitle', { date: dateFmt, hour: timeFmt }) as string
    const productIds = sellableProducts.slice(0, 5).map(p => p.id)
    setTitle(autoTitle)
    setSelectedProducts(productIds)
    setMethod('quick')
    onCreate({ title: autoTitle, productIds })
  }

  // 테스트 방송: unlisted + [TEST] 제목. 셀러가 파이프라인 검증 후 삭제.
  const handleTestBroadcast = () => {
    if (sellableProducts.length === 0 || creating) return
    const testTitle = `[TEST] ${new Date().toLocaleTimeString()}`
    setTitle(testTitle)
    setPrivacy('unlisted')
    setSelectedProducts([sellableProducts[0].id])
    onCreate({ title: testTitle, productIds: [sellableProducts[0].id] })
    toast.info(t('seller.liveBroadcast.testCreated', { defaultValue: '테스트 방송을 생성했습니다. 송출 도구에서 시작 후 파이프라인 확인해보세요.' }))
  }
  // 토큰 만료 시 폼 전체 차단 + 재연동 CTA
  if (tokenExpired) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-900 mb-1">YouTube 연동이 만료됐어요</h3>
          <p className="text-sm text-amber-700">방송을 시작하려면 채널을 다시 연동해야 합니다.<br/>약 30초 소요됩니다.</p>
        </div>
        <Button onClick={onReauthenticate} disabled={connectingYouTube}
          className="bg-red-600 hover:bg-red-700 text-white px-8 h-11 text-sm font-semibold">
          {connectingYouTube ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Youtube className="w-4 h-4 mr-2" />}
          지금 재연동하기
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900">{t('seller.liveBroadcast.enterBroadcastInfo')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.liveBroadcast.enterBroadcastInfoDesc')}</p>
        </div>
        {/* Quick Start + Test broadcast */}
        <div className="flex gap-1.5 shrink-0">
          {sellableProducts.length > 0 && (
            <button onClick={handleTestBroadcast} disabled={creating}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="비공개 테스트 방송으로 파이프라인 검증">
              🧪 테스트
            </button>
          )}
          {canQuickStart && (
            <button onClick={handleQuickStart}
              className="text-xs bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {t('seller.liveBroadcast.quickStart')}
            </button>
          )}
        </div>
        {templates.length > 0 && (
          <div className="relative shrink-0">
            <button onClick={() => setShowTemplates(v => !v)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              📋 {t('seller.liveBroadcast.templates')}
            </button>
            {showTemplates && (
              <div className="absolute top-6 right-0 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-56 overflow-y-auto">
                {templates.map(tpl => (
                  <button key={tpl.name} onClick={() => applyTemplate(tpl)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{tpl.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{tpl.title}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 제목 (필수) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.broadcastTitle')} <span className="text-red-500">*</span></label>
        <input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder={t('seller.liveBroadcast.broadcastTitlePlaceholder')} maxLength={100}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      {/* 상품 선택 (필수, 검색 + 정렬) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('seller.liveBroadcast.saleProducts')} <span className="text-red-500">*</span>
          {selectedProducts.length > 0 && <span className="ml-1 text-xs text-blue-600 font-normal">{t('seller.liveBroadcast.selectedCount', { count: selectedProducts.length })}</span>}
        </label>
        {sellableProducts.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-2">{t('seller.liveBroadcast.noProducts')}</p>
            <button onClick={() => navigate('/seller/products/new')} className="text-sm text-blue-600 font-medium">{t('seller.liveBroadcast.registerProduct')}</button>
          </div>
        ) : (
          <>
            {sellableProducts.length > 6 && (
              <input type="text" value={productSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProductSearch(e.target.value)}
                placeholder={t('seller.liveBroadcast.searchProducts')}
                className="w-full px-3 py-2 mb-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            )}
            {recentProductIds.length > 0 && !productSearch && (
              <button type="button"
                onClick={() => {
                  const recent = recentProductIds.filter(id => sellableProducts.some(p => p.id === id)).slice(0, 5)
                  setSelectedProducts(prev => [...new Set([...prev, ...recent])])
                }}
                className="text-[11px] text-blue-600 hover:text-blue-700 mb-2 underline underline-offset-2">
                + {t('seller.liveBroadcast.addRecent')}
              </button>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto">
              {filteredProducts.map((p: Product) => {
                const isSoldOut = p.stock === 0
                const isSelected = selectedProducts.includes(p.id)
                return (
                <button key={p.id} onClick={() => toggleProduct(p.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : isSoldOut ? 'border-red-100 bg-red-50 opacity-70' : recentProductIds.includes(p.id) ? 'border-gray-300 hover:border-blue-300' : 'border-gray-200 hover:border-gray-300'}`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />}
                  <div className="min-w-0 flex-1">
                    <span className="truncate block">{p.name}</span>
                    {isSoldOut && <span className="text-[9px] text-red-500 font-bold">품절</span>}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              )})}
            </div>
          </>
        )}
      </div>

      {/* 🛡️ 2026-05-07: 모드 선택 제거 → 송출 키 상태 표시만.
          셀러는 /seller/streaming-setup 에서 본인 환경에 맞는 도구 (Prism/OBS/Larix/Studio)
          한 번만 설정. 방송 만들기는 그 도구 무관하게 동일 흐름. */}
      {hasPersistentKey ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm font-semibold text-green-800">송출 도구 준비됨</p>
            <span className="text-xs text-green-600">· OBS/Prism/Larix 어디서든 시작 가능</span>
          </div>
          <a href="/seller/streaming-setup" className="text-[11px] text-green-700 hover:text-green-900 underline underline-offset-2">키 다시 보기</a>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">⚙️</span>
            <p className="text-sm font-bold text-amber-900">송출 도구 설정이 먼저 필요해요</p>
          </div>
          <p className="text-xs text-amber-700">한 번만 설정하면 다음 방송부터는 [방송 시작] 만 누르면 됩니다.</p>
          <a href="/seller/streaming-setup" className="inline-block text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg">
            송출 키 설정하러 가기 →
          </a>
        </div>
      )}

      {/* 🛡️ 2026-05-07: 알림톡 + 연습 모드 토글 */}
      <div className="border-t border-gray-100 pt-4 space-y-2.5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyFollowers}
            onChange={e => setNotifyFollowers?.(e.target.checked)}
            className="mt-0.5"
            disabled={practiceMode}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">📨 팔로워에게 알림톡 자동 발송</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              방송 시작 30초 후 팔로워에게 카카오톡 알림 1회 (셀러 알림톡 잔액 차감, 최대 500명)
            </p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={practiceMode}
            onChange={e => setPracticeMode?.(e.target.checked)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">🧪 연습 모드 (시청자 노출 X)</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              비공개 (private) 방송 + 알림톡 미발송 + 시청자 피드 미노출. OBS 셋업 / 카메라 각도 검증용.
            </p>
          </div>
        </label>
      </div>

      {/* 고급 설정 접기 + 마지막 방송과 동일 힌트 */}
      <div className="border-t border-gray-100 pt-4">
        <button type="button" onClick={() => setAdvancedOpen(v => !v)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900">
          <span className="flex items-center gap-2">
            {t('seller.liveBroadcast.advancedSettings')}
            {!advancedOpen && advancedUnchanged && (
              <span className="text-[10px] text-gray-400 font-normal">{t('seller.liveBroadcast.sameAsLast')}</span>
            )}
          </span>
          <span className="text-xs">{advancedOpen ? '▾' : '▸'}</span>
        </button>
        {advancedOpen && (
          <div className="mt-4 space-y-4">
            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')} <span className="text-xs text-gray-400 font-normal">({t('common.optional')})</span></label>
              <textarea value={description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder={t('seller.liveBroadcast.descriptionPlaceholder')} rows={2} maxLength={500}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none" />
            </div>

            {/* 썸네일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.thumbnail')} <span className="text-xs text-gray-400 font-normal">({t('common.optional')})</span></label>
              <input value={thumbnailUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThumbnailUrl(e.target.value)}
                placeholder={t('seller.liveBroadcast.thumbnailPlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              {thumbnailUrl && (
                <img src={thumbnailUrl} alt={t('seller.preview')} className="mt-2 w-full max-w-[200px] rounded-lg object-cover"
                  loading="lazy"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }} />
              )}
            </div>

            {/* 공개 설정 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('seller.liveBroadcast.privacySetting')}</label>
              <div className="grid grid-cols-3 gap-2">
                {privacyOptions.map(opt => (
                  <button key={opt.key} onClick={() => setPrivacy(opt.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs transition-all ${privacy === opt.key ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
                    <opt.icon className={`w-4 h-4 ${privacy === opt.key ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`font-semibold ${privacy === opt.key ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</span>
                    <span className="text-gray-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 🛡️ 2026-05-07: 예약 일정 — 라디오 카드 + datetime 통합 + 빠른 선택 칩 (UX 개선) */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => setIsScheduled(() => false)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    !isScheduled ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <div>
                      <p className={`text-sm font-bold ${!isScheduled ? 'text-blue-700' : 'text-gray-900'}`}>{t('seller.liveBroadcast.startNow', { defaultValue: '바로 시작' })}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">생성 즉시 송출</p>
                    </div>
                  </div>
                </button>
                <button type="button"
                  onClick={() => setIsScheduled(() => true)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    isScheduled ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <div>
                      <p className={`text-sm font-bold ${isScheduled ? 'text-blue-700' : 'text-gray-900'}`}>{t('seller.liveBroadcast.scheduleBroadcast', { defaultValue: '예약 방송' })}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">시청자 알림톡 발송</p>
                    </div>
                  </div>
                </button>
              </div>

              {isScheduled && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                  {/* 빠른 선택 칩 */}
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { label: '1시간 후', mins: 60 },
                      { label: '오늘 저녁 8시', when: 'today_8pm' },
                      { label: '내일 같은 시간', mins: 60 * 24 },
                      { label: '내일 저녁 8시', when: 'tomorrow_8pm' },
                    ] as Array<{ label: string; mins?: number; when?: 'today_8pm' | 'tomorrow_8pm' }>).map((q) => (
                      <button key={q.label} type="button"
                        onClick={() => {
                          const d = new Date()
                          if (typeof q.mins === 'number') {
                            d.setMinutes(d.getMinutes() + q.mins)
                          } else if (q.when === 'today_8pm') {
                            d.setHours(20, 0, 0, 0)
                          } else if (q.when === 'tomorrow_8pm') {
                            d.setDate(d.getDate() + 1)
                            d.setHours(20, 0, 0, 0)
                          }
                          const yyyy = d.getFullYear()
                          const mm = String(d.getMonth() + 1).padStart(2, '0')
                          const dd = String(d.getDate()).padStart(2, '0')
                          const hh = String(d.getHours()).padStart(2, '0')
                          const mi = String(d.getMinutes()).padStart(2, '0')
                          setScheduledDate(`${yyyy}-${mm}-${dd}`)
                          setScheduledTime(`${hh}:${mi}`)
                        }}
                        className="text-[11px] font-semibold text-blue-700 bg-white border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors">
                        {q.label}
                      </button>
                    ))}
                  </div>
                  {/* 정밀 입력 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">날짜</label>
                      <input type="date" value={scheduledDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">시간</label>
                      <input type="time" value={scheduledTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScheduledTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white" />
                    </div>
                  </div>
                  {/* 선택 미리보기 */}
                  {scheduledDate && scheduledTime && (() => {
                    const d = new Date(`${scheduledDate}T${scheduledTime}:00`)
                    if (isNaN(d.getTime())) return null
                    const diffMin = Math.round((d.getTime() - Date.now()) / 60000)
                    const days = Math.floor(diffMin / 1440)
                    const hours = Math.floor((diffMin % 1440) / 60)
                    const mins = diffMin % 60
                    const inFuture = diffMin > 0
                    const eta = days > 0 ? `${days}일 ${hours}시간 후` : hours > 0 ? `${hours}시간 ${mins}분 후` : `${mins}분 후`
                    return (
                      <div className={`text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-2 ${
                        inFuture ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <span>📍</span>
                        <span>
                          {d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                          {inFuture && ` (${eta})`}
                          {!inFuture && ` — ${t('seller.liveBroadcast.scheduledPastInline', { defaultValue: '과거 시간이에요. 다시 선택해주세요.' })}`}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* 목적지 */}
            {destinations.filter(d => d.status === 'available').length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('seller.liveBroadcast.destination')}</label>
                <p className="text-xs text-gray-400 mb-2">{t('seller.liveBroadcast.destinationDesc')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {destinations.map(d => {
                    const isAvailable = d.status === 'available'
                    const isSelected = destination === d.key
                    return (
                      <button key={d.key}
                        onClick={() => isAvailable && setDestination(d.key as Destination)}
                        disabled={!isAvailable}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${!isAvailable ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{d.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        {!isAvailable && (
                          <p className="text-[10px] text-amber-600 font-medium">
                            {t('seller.liveBroadcast.comingSoon')}{d.eta ? ` · ${d.eta}` : ''}
                          </p>
                        )}
                        {d.note && !isAvailable && (
                          <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{d.note}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* P2-8: 템플릿으로 저장 */}
            {title && selectedProducts.length > 0 && (
              <button type="button" onClick={() => setShowSaveTemplate(true)}
                className="w-full text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 py-1">
                📋 {t('seller.liveBroadcast.saveAsTemplate')}
              </button>
            )}
          </div>
        )}
      </div>

      {showSaveTemplate && (
        <PromptModal
          title={t('seller.liveBroadcast.templateNamePrompt')}
          placeholder="예: 매주 화요일 신상 라이브"
          confirmLabel={t('seller.liveBroadcast.templateSaved').replace(/되었습니다|saved/i, '저장')}
          onConfirm={handleSaveTemplate}
          onCancel={() => setShowSaveTemplate(false)}
        />
      )}

      <Button onClick={() => onCreate()} disabled={creating || !title.trim() || selectedProducts.length === 0}
        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-base font-semibold">
        {creating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Radio className="h-5 w-5 mr-2" />}
        {creating ? t('seller.liveBroadcast.creating') : t('seller.liveBroadcast.createBroadcast')}
      </Button>
      </div>
    </div>
  )
}
