import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, Clock, Play, Bell, Search, ShoppingCart, Radio } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BroadcastNotifyButton from '@/components/live/BroadcastNotifyButton'
import { glass } from '@/components/glass/glassTokens'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { formatNumber } from '@/utils/format'
import { onYoutubeThumbError } from '@/utils/youtube-thumb'

interface LiveStream {
  id: number
  title: string
  youtube_video_id?: string
  status: string
  seller_name?: string
  viewer_count?: number
  current_product?: { name: string; price: number } | null
  scheduled_at?: string
  created_at?: string
  ended_at?: string
  thumbnail_url?: string
  image_url?: string
  category?: string
  tags?: string[] | string
  total_views?: number
  duration_seconds?: number
}

type Tab = 'all' | 'live' | 'scheduled' | 'replay'

export default function LiveListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([])
  const [endedStreams, setEndedStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    document.title = t('liveList.docTitle')
    let cancelled = false

    const fetchAll = (initial: boolean) => {
      Promise.allSettled([
        api.get('/api/streams?status=live'),
        api.get('/api/streams?status=scheduled'),
        api.get('/api/streams?status=ended&limit=20'),
      ]).then(([liveRes, scheduledRes, endedRes]) => {
        if (cancelled) return
        if (liveRes.status === 'fulfilled' && liveRes.value.data.success) setLiveStreams(liveRes.value.data.data || [])
        if (scheduledRes.status === 'fulfilled' && scheduledRes.value.data.success) setScheduledStreams(scheduledRes.value.data.data || [])
        if (endedRes.status === 'fulfilled' && endedRes.value.data.success) setEndedStreams(endedRes.value.data.data || [])
      }).finally(() => { if (!cancelled && initial) setLoading(false) })
    }

    fetchAll(true)
    // 🛡️ 2026-05-06: 30초마다 자동 새로고침 (탭 활성 + visible 시).
    //   라이브 시작/종료/시청자수 변동 반영 — 사용자가 새로고침 안 해도 최신 상태 유지.
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchAll(false)
    }, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAll(false) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [t])

  const getThumb = (s: LiveStream) =>
    s.youtube_video_id ? `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`
    : s.thumbnail_url || s.image_url || null

  const categories = useMemo(() => {
    const set = new Set<string>()
    ;[...liveStreams, ...scheduledStreams, ...endedStreams].forEach(s => {
      if (s.category) set.add(s.category)
    })
    return Array.from(set).slice(0, 8)
  }, [liveStreams, scheduledStreams, endedStreams])

  const filterByCat = (arr: LiveStream[]) =>
    activeCategory === 'all' ? arr : arr.filter(s => s.category === activeCategory)

  const filteredLive = filterByCat(liveStreams)
  const filteredScheduled = filterByCat(scheduledStreams)
  const filteredEnded = filterByCat(endedStreams)
  const totalCount = filteredLive.length + filteredScheduled.length + filteredEnded.length

  // 🛡️ 2026-04-29 v4 Film Strip: 카테고리 chips 제거 결정 → activeCategory 'all' 고정
  void activeCategory; void setActiveCategory; void categories

  const tabIdx = ['all', 'live', 'scheduled', 'replay'].indexOf(tab)
  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',       label: t('liveList.tabAll') },
    { key: 'live',      label: t('liveList.tabLive') },
    { key: 'scheduled', label: t('liveList.tabScheduled') },
    { key: 'replay',    label: t('liveList.tabReplay') },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-[#020202] text-gray-900 dark:text-white pb-24">
      <SEO title={t('liveList.seoTitle')} description={t('liveList.seoDesc')} url="/live" />

      {/* 🛡️ 2026-04-29 v4 Film Strip 헤더 — 모바일 전용. md+ 는 DesktopTopNav 가 담당. */}
      <header className="md:hidden sticky top-0 z-50 bg-white/85 dark:bg-[#020202]/85 backdrop-blur-xl backdrop-saturate-150 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex items-center justify-between px-4 h-[52px]">
          {/* UR·DEAL 로고 (홈으로) */}
          <button onClick={() => navigate('/')} aria-label={t('liveList.ariaHome')}>
            <UrDealLogo size={18} />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => navigate('/search?scope=live')}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
              aria-label={t('liveList.ariaSearch')}
            >
              <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => navigate('/notifications')}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
              aria-label={t('liveList.ariaNotifications')}
            >
              <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => navigate('/cart')}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
              aria-label={t('liveList.ariaCart')}
            >
              <ShoppingCart className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* 큰 "라이브" 제목 + 카운트 */}
        <div className="px-4 pt-2 flex items-end justify-between">
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em' }} className="text-gray-900 dark:text-white">{t('liveList.title')}</h1>
          <p className="text-gray-500 dark:text-gray-500" style={{ fontSize: 11, paddingBottom: 4 }}>
            <span style={{ fontWeight: 700 }} className="text-red-500">● {filteredLive.length}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
            예정 {filteredScheduled.length}
          </p>
        </div>

        {/* Underline 탭 + sliding indicator */}
        <div className="relative mt-3 px-4 border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex">
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`relative flex-1 pb-2.5 transition-colors ${
                  tab === tabItem.key
                    ? 'text-gray-900 dark:text-white font-extrabold'
                    : 'text-gray-500 dark:text-gray-500 font-semibold'
                }`}
                style={{ fontSize: 13, letterSpacing: '-0.01em' }}
                aria-pressed={tab === tabItem.key}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
          {/* Sliding indicator (white underline) — 4개 탭 25% 폭 */}
          <div
            className="absolute bottom-0 transition-all duration-300 pointer-events-none"
            style={{
              left: `calc(1rem + ${(tabIdx / tabs.length) * 100}% - ${(tabIdx / tabs.length) * 2}rem)`,
              width: `calc((100% - 2rem) / ${tabs.length})`,
              height: 2,
              padding: '0 18%',
            }}
          >
            <div className="w-full h-full bg-gray-900 dark:bg-white rounded-sm" />
          </div>
        </div>
      </header>

      {/* Content */}
      {loading ? (
        <SkeletonGrid />
      ) : filteredLive.length + filteredScheduled.length + filteredEnded.length === 0 ? (
        <EmptyState onExplore={() => navigate('/')} />
      ) : (
        <div className="pt-4">
          {/* 지금 방송 중 — 가로 스크롤 풀블리드 4:5 카드 */}
          {(tab === 'all' || tab === 'live') && (
            <section className="mb-6">
              <div className="flex items-center gap-2 px-4 mb-2">
                <div className="inline-flex items-center gap-1 rounded-full" style={{ padding: '3px 7px 3px 5px', background: 'rgba(239,68,68,0.92)' }}>
                  <span className="rounded-full" style={{ width: 5, height: 5, background: '#fff', boxShadow: '0 0 6px #fff' }} />
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: '#fff' }}>LIVE</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-gray-900 dark:text-white">{t('liveList.nowLiveLabel')}</span>
                <span style={{ fontSize: 11 }} className="text-gray-500 dark:text-gray-500">{filteredLive.length}</span>
              </div>
              {filteredLive.length === 0 ? (
                <InlineEmpty
                  icon="live"
                  title={t('liveList.noLiveTitle', { defaultValue: '지금 방송 중인 라이브가 없어요' })}
                  hint={t('liveList.noLiveHint', { defaultValue: '예정된 방송 알림을 받아보세요' })}
                />
              ) : (
              <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar pb-2 md:overflow-visible md:grid md:grid-cols-2 md:px-4 lg:grid-cols-3 xl:grid-cols-4">
                {filteredLive.map(s => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/live/${s.id}`)}
                    className="shrink-0 w-[280px] lg:w-full text-left active:scale-[0.99] transition-transform"
                    aria-label={t('liveList.ariaLiveJoin', { title: s.title })}
                  >
                    <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#121212]" style={{ aspectRatio: '4/5' }}>
                      {getThumb(s) ? (
                        <img src={getThumb(s)!} alt={s.title} loading="lazy" className="w-full h-full object-cover" onError={onYoutubeThumbError} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-[#1A1A1A] dark:to-[#0A0A0A]" />
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.6), transparent 30%, transparent 60%, rgba(0,0,0,0.85))' }} />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <div className="inline-flex items-center gap-1 rounded-full" style={{ padding: '4px 8px 4px 6px', background: 'rgba(239,68,68,0.92)', backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", boxShadow: '0 2px 8px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                          <span className="rounded-full" style={{ width: 5, height: 5, background: '#fff', boxShadow: '0 0 6px #fff' }} />
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: '#fff' }}>LIVE</span>
                        </div>
                        <div className="rounded-full px-2 py-1 inline-flex items-center gap-1" style={glass.statsChip}>
                          <Eye className="w-2.5 h-2.5 text-white/85" />
                          <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{formatCount(s.viewer_count ?? 0)}</span>
                        </div>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        {s.seller_name && (
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>@{s.seller_name}</p>
                        )}
                        <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, color: '#fff' }} className="line-clamp-2">{s.title}</p>
                        {s.current_product && (
                          <div className="mt-2 rounded-xl px-2.5 py-1.5 flex items-center gap-2" style={glass.statsChip}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }} className="truncate flex-1">{s.current_product.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{formatNumber(s.current_product.price ?? 0)}원</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              )}
            </section>
          )}

          {/* 방송 예정 — 세로 리스트 + 알림 pill */}
          {(tab === 'all' || tab === 'scheduled') && (
            <section className="px-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-blue-400" strokeWidth={2.5} />
                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-gray-900 dark:text-white">{t('liveList.scheduledLabel')}</span>
                <span style={{ fontSize: 11 }} className="text-gray-500 dark:text-gray-500">{filteredScheduled.length}</span>
              </div>
              {filteredScheduled.length === 0 ? (
                <InlineEmpty
                  icon="scheduled"
                  title={t('liveList.noScheduledTitle', { defaultValue: '예정된 방송이 없어요' })}
                  hint={t('liveList.noScheduledHint', { defaultValue: '셀러가 예약하면 여기에 표시됩니다' })}
                />
              ) : (
              <div className="space-y-2">
                {filteredScheduled.map(s => {
                  const d = s.scheduled_at ? new Date(s.scheduled_at) : null
                  const isToday = d && d.toDateString() === new Date().toDateString()
                  const dateLabel = d ? (isToday ? t('liveList.today') : `${d.getMonth() + 1}/${d.getDate()}`) : ''
                  const time = d ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
                  return (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/live/${s.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded-2xl active:scale-[0.99] transition-transform bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06]"
                      aria-label={t('liveList.ariaScheduled', { title: s.title })}
                    >
                      <div className="shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]" style={{ width: 72, height: 72 }}>
                        {getThumb(s) ? (
                          <img src={getThumb(s)!} alt={s.title} loading="lazy" className="w-full h-full object-cover" onError={onYoutubeThumbError} />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-[#1A1A1A] dark:to-[#0A0A0A]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        {d && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="rounded-full px-2 py-0.5 inline-flex items-center gap-1"
                              style={{ background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.30)' }}>
                              <Clock className="w-2 h-2 text-blue-300" />
                              <span style={{ fontSize: 9, fontWeight: 700, color: '#93C5FD', letterSpacing: '-0.01em' }}>
                                {dateLabel} {time}
                              </span>
                            </span>
                          </div>
                        )}
                        <p style={{ fontSize: 13, fontWeight: 600 }} className="line-clamp-1 text-gray-900 dark:text-white">{s.title}</p>
                        {s.seller_name && (
                          <p style={{ fontSize: 11, marginTop: 2 }} className="text-gray-500 dark:text-gray-500">@{s.seller_name}</p>
                        )}
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <BroadcastNotifyButton streamId={s.id} compact />
                      </div>
                    </button>
                  )
                })}
              </div>
              )}
            </section>
          )}

          {/* 다시보기 — 2칸 그리드 + 중앙 play glass + 우상단 뷰 카운트 */}
          {(tab === 'all' || tab === 'replay') && (
            <section className="px-4 pb-6">
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" strokeWidth={2.5} fill="currentColor" />
                <span style={{ fontSize: 13, fontWeight: 700 }} className="text-gray-900 dark:text-white">{t('liveList.replayLabel')}</span>
                <span style={{ fontSize: 11 }} className="text-gray-500 dark:text-gray-500">{filteredEnded.length}</span>
              </div>
              {filteredEnded.length === 0 ? (
                <InlineEmpty
                  icon="replay"
                  title={t('liveList.noReplayTitle', { defaultValue: '다시 볼 방송이 없어요' })}
                  hint={t('liveList.noReplayHint', { defaultValue: '종료된 방송이 누적되면 여기 표시됩니다' })}
                />
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredEnded.map(s => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/live/recap/${s.id}`)}
                    className="text-left active:scale-[0.99] transition-transform"
                    aria-label={t('liveList.ariaReplay', { title: s.title })}
                  >
                    <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]" style={{ aspectRatio: '3/4' }}>
                      {getThumb(s) ? (
                        <img src={getThumb(s)!} alt={s.title} loading="lazy" className="w-full h-full object-cover" style={{ filter: 'brightness(0.8) saturate(0.9)' }} onError={onYoutubeThumbError} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-[#1A1A1A] dark:to-[#0A0A0A]" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="rounded-full flex items-center justify-center"
                          style={{
                            width: 44, height: 44,
                            background: 'rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(24px) saturate(140%)',
                            WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                            border: '1px solid rgba(255,255,255,0.30)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 6px 18px rgba(0,0,0,0.35)',
                          }}>
                          <Play className="w-[18px] h-[18px] text-white" fill="currentColor" style={{ marginLeft: 2 }} />
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 rounded-full px-2 py-1"
                        style={glass.statsChip}>
                        <span style={{ fontSize: 9, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{formatCount(s.total_views ?? 0)} 뷰</span>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 p-2.5"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#fff' }} className="line-clamp-2">{s.title}</p>
                        {s.seller_name && (
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>@{s.seller_name}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Inline Empty (per-section) ───────────────────────────────
function InlineEmpty({ icon, title, hint }: { icon: 'live' | 'scheduled' | 'replay'; title: string; hint: string }) {
  const Icon = icon === 'live' ? Radio : icon === 'scheduled' ? Clock : Play
  return (
    <div className="mx-4 px-5 py-7 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.06] flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-full bg-white dark:bg-white/[0.06] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white">{title}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{hint}</p>
      </div>
    </div>
  )
}

// ─── Skeleton Grid ─────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="pt-4">
      <div className="flex items-center gap-2 px-4 mb-2">
        <div className="h-4 w-12 rounded-full bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
        <div className="h-3 w-16 rounded bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
      </div>
      <div className="flex gap-3 px-4 overflow-x-hidden pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="shrink-0 w-[280px] md:w-full">
            <div className="rounded-2xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" style={{ aspectRatio: '4/5' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Hero Card (2:3 aspect, 16:9 으로 바꿔 wider feel) ──────────

function HeroCard({ stream, getThumb, onClick }: {
  stream: LiveStream
  getThumb: (s: LiveStream) => string | null
  onClick: () => void
}) {
  const thumb = getThumb(stream)
  return (
    <button
      onClick={onClick}
      className="relative block w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gray-50 dark:bg-[#121212] active:scale-[0.99] transition-transform text-left group"
    >
      {thumb ? (
        <img src={thumb} alt="" fetchPriority="high" decoding="async" className="w-full h-full object-cover" onError={onYoutubeThumbError} />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-red-900/40 to-[#0A0A0A] flex items-center justify-center">
          <Radio className="w-10 h-10 text-red-500/60" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-500 px-2.5 py-1 rounded-full shadow-lg shadow-red-500/30">
        <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
        <span className="text-[10px] font-extrabold text-white tracking-wide">LIVE</span>
      </div>

      {/* Viewers */}
      {stream.viewer_count !== undefined && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full">
          <Eye className="h-3 w-3 text-white" />
          <span className="text-[11px] text-white font-bold">
            {formatNumber(stream.viewer_count)}
          </span>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {stream.seller_name && (
          <p className="text-[11px] text-white/70 font-semibold mb-1">{stream.seller_name}</p>
        )}
        <p className="text-[17px] font-extrabold text-white line-clamp-2 leading-tight tracking-tight">
          {stream.title}
        </p>
        {stream.current_product && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <span className="text-[10px] font-bold text-pink-300">NOW</span>
            <span className="text-[11px] text-white font-semibold line-clamp-1 max-w-[200px]">
              {stream.current_product.name}
            </span>
            <span className="text-[11px] font-extrabold text-pink-300">
              {formatNumber(stream.current_product.price)}원
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Regular Stream Card ──────────────────────────────────────

function StreamCard({ stream, type, onClick, getThumb }: {
  stream: LiveStream
  type: 'live' | 'scheduled' | 'ended'
  onClick: () => void
  getThumb: (s: LiveStream) => string | null
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('ko') ? 'ko-KR' : i18n.language || 'en-US'
  const thumb = getThumb(stream)
  const schedDate = stream.scheduled_at ? new Date(stream.scheduled_at) : null
  const endedAt = stream.ended_at ? new Date(stream.ended_at) : null

  const timeAgo = endedAt ? relativeTime(endedAt, t, locale) : null

  return (
    <button onClick={onClick} className="text-left active:scale-[0.97] transition-transform w-full">
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 dark:bg-[#121212]">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" onError={onYoutubeThumbError} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
            <Play className="w-7 h-7 text-gray-400 dark:text-gray-700" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />

        {/* Badge */}
        {type === 'live' && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 px-1.5 py-0.5 rounded shadow-md">
            <span className="h-1 w-1 bg-white rounded-full animate-pulse" />
            <span className="text-[9px] font-extrabold text-white tracking-wide">LIVE</span>
          </div>
        )}
        {type === 'scheduled' && (
          <div className="absolute top-2 left-2 bg-blue-500 px-1.5 py-0.5 rounded">
            <span className="text-[9px] font-extrabold text-white">예정</span>
          </div>
        )}
        {type === 'ended' && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Play className="h-2.5 w-2.5 text-white" fill="currentColor" />
            <span className="text-[9px] font-bold text-white">다시보기</span>
          </div>
        )}

        {/* Viewers (live) or Views (ended) */}
        {type === 'live' && stream.viewer_count !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Eye className="h-2.5 w-2.5 text-white" />
            <span className="text-[9px] text-white font-bold">{formatCount(stream.viewer_count)}</span>
          </div>
        )}
        {type === 'ended' && stream.total_views !== undefined && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            <Eye className="h-2.5 w-2.5 text-white" />
            <span className="text-[9px] text-white font-bold">{formatCount(stream.total_views)}</span>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          {stream.seller_name && (
            <p className="text-[9px] text-white/60 font-semibold mb-0.5 line-clamp-1">
              @{stream.seller_name}
            </p>
          )}
          <p className="text-[11px] font-bold text-white line-clamp-2 leading-tight">
            {stream.title}
          </p>
          {type === 'scheduled' && schedDate && (
            <p className="text-[10px] text-blue-300 mt-1 font-bold">
              {schedDate.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {type === 'ended' && timeAgo && (
            <p className="text-[9px] text-white/60 mt-0.5 font-medium">
              {timeAgo}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyState({ onExplore }: { onExplore: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center pt-20 pb-24 px-6 text-center">
      <div className="relative mb-5">
        <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-[#121212] flex items-center justify-center">
          <Radio className="w-9 h-9 text-gray-600" strokeWidth={1.5} />
        </div>
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
          <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" />
        </span>
      </div>
      <h2 className="text-[17px] font-bold text-gray-900 dark:text-white mb-1.5">{t('liveList.emptyTitle')}</h2>
      <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6">{t('liveList.emptyHint')}</p>
      <button
        onClick={onExplore}
        className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black text-[13px] font-bold rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
      >
        {t('liveList.exploreSpecial')}
      </button>
    </div>
  )
}

// ─── Utils ─────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`
  return formatNumber(n)
}

function relativeTime(date: Date, t: (key: string, opts?: any) => string, locale: string): string {
  const diffMs = Date.now() - date.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return t('liveList.justNow')
  if (min < 60) return t('liveList.minutesAgo', { min })
  const hour = Math.floor(min / 60)
  if (hour < 24) return t('liveList.hoursAgo', { hour })
  const day = Math.floor(hour / 24)
  if (day < 7) return t('liveList.daysAgo', { day })
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
