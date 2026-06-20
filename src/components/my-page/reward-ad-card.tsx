import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import api from '@/lib/api'
import { Capacitor } from '@capacitor/core'
import { formatNumber } from '@/utils/format'
import { alertDialog } from '@/components/ui/confirm-dialog'

interface AdRewardStatus {
  todayCount: number
  dailyLimit: number
  rewardPerAd: number
}

export function RewardAdCard() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<AdRewardStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [rewarded, setRewarded] = useState<number | null>(null)
  const [newBalance, setNewBalance] = useState<number | null>(null)
  const isNative = Capacitor.isNativePlatform()

  // 🗑️ 2026-06-17 (사용자 요청): 웹 앱 다운로드 유도 배너 제거 — 웹에선 아무것도 렌더 X (리워드 광고는 네이티브 전용).
  if (!isNative) {
    return null
  }

  useEffect(() => {
    api.get('/api/points/ad-reward/status')
      .then(r => { if (r.data.success) setStatus(r.data.data) })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[RewardAdCard] status fetch failed:', e) })
  }, [])

  const showRewardedAd = useCallback(async () => {
    if (loading) return
    if (status && status.todayCount >= status.dailyLimit) return

    setLoading(true)
    setRewarded(null)

    try {
      // 네이티브 앱: AdMob 리워드 광고
      if (Capacitor.isNativePlatform()) {
        try {
          // 네이티브 앱에서만 실행 — 웹 빌드 시 이 코드는 실행되지 않음
          const pkg = '@capacitor-community/admob'
          const admobModule = await (Function('p', 'return import(p)')(pkg)) as any
          const { AdMob, RewardAdPluginEvents } = admobModule

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('광고 로드 시간 초과')), 15000)

            const rewardListener = AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
              clearTimeout(timeout)
              rewardListener.remove()
              failListener.remove()
              resolve()
            })

            const failListener = AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
              clearTimeout(timeout)
              rewardListener.remove()
              failListener.remove()
              reject(new Error('광고 로드 실패'))
            })

            AdMob.prepareRewardVideoAd({
              adId: 'ca-app-pub-1598352332166062/5632481147',
              isTesting: false,
            }).then(() => {
              AdMob.showRewardVideoAd()
            }).catch(reject)
          })
        } catch {
          await simulateAdWatch()
        }
      } else {
        // 웹: 광고 시청 시뮬레이션 (3초 대기)
        await simulateAdWatch()
      }

      // 서버에 리워드 요청
      const res = await api.post('/api/points/ad-reward')
      if (res.data.success) {
        setRewarded(res.data.data.rewarded)
        setNewBalance(res.data.data.balance)
        setStatus(prev => prev ? {
          ...prev,
          todayCount: res.data.data.todayCount,
        } : prev)

        // 3초 후 리워드 메시지 숨김
        setTimeout(() => setRewarded(null), 3000)
        // 잔액 갱신 이벤트 발생
        window.dispatchEvent(new CustomEvent('pointsBalanceChanged'))
      } else {
        void alertDialog(res.data.error || t('rewardAd.rewardFailed', { defaultValue: '리워드 지급에 실패했습니다' }))
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        void alertDialog(err.response.data?.error || t('rewardAd.dailyLimitReached', { defaultValue: '오늘 광고 시청 한도에 도달했습니다' }))
      } else {
        void alertDialog(t('rewardAd.watchError', { defaultValue: '광고 시청 중 오류가 발생했습니다' }))
      }
    } finally {
      setLoading(false)
    }
  }, [loading, status])

  if (!status) return null

  const remaining = status.dailyLimit - status.todayCount
  const isMaxed = remaining <= 0

  return (
    <div className="ur-content-medium px-5 lg:px-8 py-1">
      <div className="bg-gray-50 dark:bg-[#121212] rounded-2xl px-5 py-4 border border-gray-200 dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-800 flex items-center justify-center">
              <Play className="w-5 h-5 text-gray-900 dark:text-white fill-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">{t('rewardAd.title', { defaultValue: '광고 보고 딜 받기' })}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {isMaxed
                  ? t('rewardAd.descMaxed', { defaultValue: '내일 다시 시청 가능합니다' })
                  : t('rewardAd.descRemaining', { remaining, reward: status.rewardPerAd, defaultValue: `오늘 ${remaining}회 남음 · 1회 ${status.rewardPerAd}딜` })}
              </p>
            </div>
          </div>

          <button
            onClick={showRewardedAd}
            disabled={isMaxed || loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              isMaxed
                ? 'bg-gray-200 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : loading
                ? 'bg-indigo-300 text-white cursor-wait'
                : 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
            }`}
          >
            {loading ? t('rewardAd.watching', { defaultValue: '시청 중...' }) : isMaxed ? t('rewardAd.maxed', { defaultValue: '완료' }) : t('rewardAd.watch', { defaultValue: '시청하기' })}
          </button>
        </div>

        {/* 진행 바 */}
        <div className="mt-3 bg-white dark:bg-[#0A0A0A]/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gray-800 to-gray-800 rounded-full transition-all duration-500"
            style={{ width: `${status.dailyLimit > 0 ? (status.todayCount / status.dailyLimit) * 100 : 0}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-right">
          {t('rewardAd.progress', { today: status.todayCount, limit: status.dailyLimit, defaultValue: `${status.todayCount}/${status.dailyLimit}회 시청` })}
        </p>

        {/* 리워드 알림 */}
        {rewarded && (
          <div className="mt-2 text-center animate-fade-in">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
              {t('rewardAd.rewardEarned', { amount: rewarded, balance: formatNumber(newBalance ?? 0), defaultValue: `+${rewarded}딜 적립 완료! (잔액: ${formatNumber(newBalance ?? 0)}딜)` })}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// 웹 환경에서 광고 시뮬레이션 (3초 카운트다운)
function simulateAdWatch(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.id = 'ad-simulation-overlay'
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;'

    let seconds = 3
    overlay.innerHTML = `
      <div style="color:#666;font-size:12px;position:absolute;top:20px;right:20px;">광고</div>
      <div style="width:80%;max-width:400px;aspect-ratio:16/9;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;">
        <span style="color:white;font-size:18px;font-weight:bold;">광고 영역</span>
      </div>
      <p id="ad-timer" style="color:white;font-size:14px;">${seconds}초 후 닫기</p>
    `
    document.body.appendChild(overlay)

    const interval = setInterval(() => {
      seconds--
      const timer = document.getElementById('ad-timer')
      if (timer) timer.textContent = seconds > 0 ? `${seconds}초 후 닫기` : '완료!'
      if (seconds <= 0) {
        clearInterval(interval)
        setTimeout(() => {
          overlay.remove()
          resolve()
        }, 500)
      }
    }, 1000)
  })
}
