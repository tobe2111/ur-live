import { useState, useEffect, useCallback } from 'react'
import { Play } from 'lucide-react'
import api from '@/lib/api'
import { Capacitor } from '@capacitor/core'

interface AdRewardStatus {
  todayCount: number
  dailyLimit: number
  rewardPerAd: number
}

export function RewardAdCard() {
  const [status, setStatus] = useState<AdRewardStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [rewarded, setRewarded] = useState<number | null>(null)
  const [newBalance, setNewBalance] = useState<number | null>(null)
  const isNative = Capacitor.isNativePlatform()

  // 웹: 앱 다운로드 유도 배너
  if (!isNative) {
    return (
      <div className="px-5 py-1">
        <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shrink-0">
              <span className="text-lg">📱</span>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-white">앱 다운로드하고 추가 딜 받기!</p>
              <p className="text-[11px] text-gray-500">광고 시청으로 매일 무료 딜 포인트 적립</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => alert('앱이 준비 중입니다 🚀\n조금만 기다려주세요!')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/10 rounded-xl text-xs font-bold text-white active:scale-95">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              App Store
            </button>
            <button onClick={() => alert('앱이 준비 중입니다 🚀\n조금만 기다려주세요!')} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/10 rounded-xl text-xs font-bold text-white active:scale-95">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.04L14.55 12 3.18.96C2.58 1.33 2.1 1.96 2.1 2.86v18.28c0 .9.48 1.53 1.08 1.9zm12.89-9.95l2.22-1.26L6.79.56l9.28 12.53zM6.79 23.44l11.5-5.27-2.22-1.26L6.79 23.44zM19.41 10.6l-2.52 1.44L19.41 13.4l2.59-1.4-2.59-1.4z"/></svg>
              Play Store
            </button>
          </div>
        </div>
      </div>
    )
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
        alert(res.data.error || '리워드 지급에 실패했습니다')
      }
    } catch (err: any) {
      if (err?.response?.status === 429) {
        alert(err.response.data?.error || '오늘 광고 시청 한도에 도달했습니다')
      } else {
        alert('광고 시청 중 오류가 발생했습니다')
      }
    } finally {
      setLoading(false)
    }
  }, [loading, status])

  if (!status) return null

  const remaining = status.dailyLimit - status.todayCount
  const isMaxed = remaining <= 0

  return (
    <div className="px-5 py-1">
      <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-white">광고 보고 딜 받기</p>
              <p className="text-[11px] text-gray-500">
                {isMaxed
                  ? '내일 다시 시청 가능합니다'
                  : `오늘 ${remaining}회 남음 · 1회 ${status.rewardPerAd}딜`}
              </p>
            </div>
          </div>

          <button
            onClick={showRewardedAd}
            disabled={isMaxed || loading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              isMaxed
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : loading
                ? 'bg-indigo-300 text-white cursor-wait'
                : 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
            }`}
          >
            {loading ? '시청 중...' : isMaxed ? '완료' : '시청하기'}
          </button>
        </div>

        {/* 진행 바 */}
        <div className="mt-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${status.dailyLimit > 0 ? (status.todayCount / status.dailyLimit) * 100 : 0}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-right">
          {status.todayCount}/{status.dailyLimit}회 시청
        </p>

        {/* 리워드 알림 */}
        {rewarded && (
          <div className="mt-2 text-center animate-fade-in">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
              +{rewarded}딜 적립 완료! (잔액: {(newBalance ?? 0).toLocaleString()}딜)
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
