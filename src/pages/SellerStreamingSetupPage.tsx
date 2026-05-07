/**
 * 🛡️ 2026-05-07: 송출 키 영구 설정 페이지 — 셀러는 평생 한 번만 설정.
 *
 * 핵심 분리:
 *   - 송출 키 (RTMP URL/Key): 영구 — 이 페이지에서 한 번 발급 후 OBS/Prism/Larix 에 저장
 *   - 방송 (broadcast): 매 라이브마다 새로 만들기 (제목/상품 등)
 *
 * YouTube Studio 와 동일한 패턴. 셀러에게 직관적.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, CheckCircle2, Smartphone, Monitor, Loader2, AlertCircle, Youtube, ExternalLink } from 'lucide-react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'

type SetupStatus = 'loading' | 'no_oauth' | 'not_configured' | 'configured'

interface SetupData {
  status: SetupStatus
  rtmp_url?: string
  rtmp_key?: string
  channel_title?: string
  oauth_url?: string
}

export default function SellerStreamingSetupPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<SetupData>({ status: 'loading' })
  const [initializing, setInitializing] = useState(false)
  const [copied, setCopied] = useState<'url' | 'key' | null>(null)

  // 🛡️ 2026-05-07: 디바이스 자동 감지 + 사용자 토글. 모바일/PC 별 가이드 분기.
  const detectMobile = () => typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  const [device, setDevice] = useState<'mobile' | 'pc'>(() => (detectMobile() ? 'mobile' : 'pc'))

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    try {
      const res = await api.get('/api/seller/youtube/streaming-setup')
      if (res.data?.success) {
        setData({ status: res.data.data.status, ...res.data.data })
      }
    } catch {
      setData({ status: 'no_oauth' })
    }
  }

  async function init() {
    setInitializing(true)
    try {
      const res = await api.post('/api/seller/youtube/streaming-setup/init')
      if (res.data?.success) {
        setData({ status: 'configured', ...res.data.data })
        toast.success('송출 키 발급 완료')
      } else {
        toast.error(res.data?.error || '발급 실패')
      }
    } catch (err) {
      const e = err as { response?: { data?: { error_code?: string; error?: string } } }
      if (e.response?.data?.error_code === 'YOUTUBE_AUTH_REQUIRED') {
        toast.error('YouTube 연동이 필요합니다')
        navigate('/seller/youtube')
      } else {
        toast.error(e.response?.data?.error || '발급 실패')
      }
    } finally {
      setInitializing(false)
    }
  }

  function copy(text: string, kind: 'url' | 'key') {
    navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 2000)
    toast.success('복사됨')
  }

  // Larix deep link: rtmp://server/app/KEY 형태
  const fullRtmpForLarix = data.rtmp_url && data.rtmp_key
    ? (data.rtmp_url.endsWith('/') ? `${data.rtmp_url}${data.rtmp_key}` : `${data.rtmp_url}/${data.rtmp_key}`)
    : ''
  const larixDeepLink = fullRtmpForLarix
    ? `larix://set/?name=${encodeURIComponent('UR Live')}&url=${encodeURIComponent(fullRtmpForLarix)}&mode=audio%2Bvideo`
    : ''

  return (
    <SellerLayout title="송출 키 설정">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <DashboardPageHeader
          title="송출 키 설정"
          subtitle="OBS/Prism/Larix 등 송출 도구에 한 번만 입력하면 끝"
        />

        {data.status === 'loading' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 mt-3">불러오는 중…</p>
          </div>
        )}

        {data.status === 'no_oauth' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-900">YouTube 연동이 필요해요</p>
                <p className="text-xs text-amber-700 mt-0.5">송출 키는 YouTube 가 발급해요. 먼저 채널을 연결해주세요.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/seller/youtube')} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Youtube className="w-4 h-4 mr-1.5" /> YouTube 채널 연결
            </Button>
          </div>
        )}

        {data.status === 'not_configured' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Youtube className="w-6 h-6 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-900">{data.channel_title || '내 채널'} · 송출 키 미발급</p>
                <p className="text-xs text-blue-700 mt-0.5">버튼 한 번 누르면 영구 사용 가능한 RTMP 키가 발급됩니다.</p>
              </div>
            </div>
            <Button onClick={init} disabled={initializing} className="bg-blue-600 hover:bg-blue-700 text-white">
              {initializing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              송출 키 발급받기
            </Button>
          </div>
        )}

        {data.status === 'configured' && (
          <>
            {/* RTMP 정보 — 항상 큰 글씨 노출 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-sm font-bold text-gray-900">송출 키 — {data.channel_title || '내 채널'}</p>
              </div>
              <p className="text-xs text-gray-500">아래 두 값을 OBS/Prism/Larix 의 RTMP 설정에 복붙하세요. 한 번만 입력하면 다음 방송부터는 자동.</p>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">RTMP URL</label>
                  <div className="flex gap-2">
                    <input type="text" value={data.rtmp_url || ''} readOnly
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono" />
                    <Button size="sm" variant="outline" onClick={() => copy(data.rtmp_url || '', 'url')}>
                      {copied === 'url' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1">Stream Key</label>
                  <div className="flex gap-2">
                    <input type="password" value={data.rtmp_key || ''} readOnly
                      className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 font-mono" />
                    <Button size="sm" variant="outline" onClick={() => copy(data.rtmp_key || '', 'key')}>
                      {copied === 'key' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">⚠️ 외부에 노출하지 마세요. 노출 시 다른 사람이 내 채널에 송출할 수 있어요.</p>
                </div>
              </div>
            </div>

            {/* 🛡️ 2026-05-07: 디바이스 토글 — 자동 감지 + 사용자 변경 가능 */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 sticky top-2 z-10">
              <button
                onClick={() => setDevice('mobile')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  device === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Smartphone className="w-4 h-4" /> 📱 모바일에서 송출
              </button>
              <button
                onClick={() => setDevice('pc')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  device === 'pc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Monitor className="w-4 h-4" /> 💻 PC 에서 송출
              </button>
            </div>

            {device === 'mobile' && (
              <>
                {/* 모바일 1순위: Larix */}
                <div className="bg-white border-2 border-pink-300 rounded-2xl p-6 space-y-3 relative">
                  <span className="absolute -top-2 left-4 text-[10px] bg-pink-500 text-white font-bold px-2 py-0.5 rounded">가장 쉬움</span>
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-pink-600" />
                    <p className="text-sm font-bold text-gray-900">📱 Larix Broadcaster (5분 안에 송출 시작)</p>
                  </div>
                  <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                    <li>App Store / Play Store 에서 "<strong>Larix Broadcaster</strong>" 검색 → 무료 설치</li>
                    <li>아래 큰 버튼 누르면 Larix 가 자동으로 RTMP 설정 입력</li>
                    <li>Larix 화면에서 빨간 버튼만 누르면 송출 시작</li>
                  </ol>
                  <a
                    href={larixDeepLink}
                    className="block w-full py-3 bg-pink-600 hover:bg-pink-700 text-white text-center text-sm font-bold rounded-xl"
                  >
                    🚀 Larix 자동 입력 (이 폰에서 열기)
                  </a>
                  <p className="text-[10px] text-gray-500 text-center">
                    Larix 미설치 시 → <a href="https://apps.apple.com/app/larix-broadcaster/id1042474385" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">iOS</a> · <a href="https://play.google.com/store/apps/details?id=com.wmspanel.larix_broadcaster" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline">Android</a>
                  </p>
                </div>

                {/* 모바일 2순위: Prism Mobile */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <p className="text-sm font-bold text-gray-900">📱 Prism Live Studio Mobile (한국 셀러 익숙)</p>
                  </div>
                  <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                    <li>App Store / Play Store 에서 "<strong>Prism Live Studio</strong>" 검색 → 무료 설치</li>
                    <li>앱 실행 → 우상단 톱니 → "Custom RTMP" 또는 "사용자 정의 RTMP" 추가</li>
                    <li>위 RTMP URL + Stream Key 붙여넣기 → 저장</li>
                    <li>홈에서 빨간 라이브 버튼 → 송출 시작</li>
                  </ol>
                  <p className="text-[10px] text-gray-500">
                    <a href="https://apps.apple.com/app/prism-live-studio/id1431499267" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">iOS 다운로드</a> · <a href="https://play.google.com/store/apps/details?id=com.prism.live" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Android 다운로드</a>
                  </p>
                </div>
              </>
            )}

            {device === 'pc' && (
              <>
            {/* PC (Prism) — 한국 인기 */}
            <div className="bg-white border-2 border-indigo-300 rounded-2xl p-6 space-y-3 relative">
              <span className="absolute -top-2 left-4 text-[10px] bg-indigo-500 text-white font-bold px-2 py-0.5 rounded">한국 인기</span>
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-indigo-600" />
                <p className="text-sm font-bold text-gray-900">💻 Prism Live Studio (한국 셀러 가장 많이 사용)</p>
              </div>
              <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                <li>
                  <a href="https://prismlive.com/ko_kr/pcapp/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Prism Live Studio 다운로드 <ExternalLink className="w-3 h-3" />
                  </a> · 설치 후 실행 (PC 무료, 한글 UI)
                </li>
                <li>"라이브" → "방송 채널 추가" → <strong>Custom RTMP</strong> 선택</li>
                <li>위 RTMP URL 과 Stream Key 붙여넣기 → 저장</li>
                <li>장면에 카메라/화면 추가 → <strong>"방송 시작"</strong> 클릭</li>
              </ol>
              <p className="text-[11px] text-gray-500">📱 모바일 Prism 앱도 동일하게 같은 키 사용 가능 (PC/모바일 모두).</p>
            </div>

            {/* PC: 폰으로 이어서 송출 — QR */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-bold text-gray-700">📱 폰으로 이어서 송출하려면 — Larix QR</p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="bg-white p-2 rounded-lg border border-gray-200">
                  <QRCode value={larixDeepLink} size={100} level="M" />
                </div>
                <p className="text-[11px] text-gray-500 flex-1">
                  폰으로 QR 스캔하면 Larix 가 자동으로 RTMP 설정 입력. PC 송출 대신 폰으로 송출 가능.
                </p>
              </div>
            </div>

            {/* PC (OBS) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-bold text-gray-900">💻 OBS Studio (PC, 전세계 표준)</p>
              </div>
              <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                <li>
                  <a href="https://obsproject.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-1">
                    OBS Studio 다운로드 <ExternalLink className="w-3 h-3" />
                  </a> · 설치 후 실행
                </li>
                <li><strong>설정</strong> → <strong>방송</strong> → 서비스: <strong>사용자 정의</strong> 선택</li>
                <li>위 RTMP URL 을 "서버" 칸에, Stream Key 를 "스트림 키" 칸에 붙여넣기</li>
                <li>장면에 카메라/화면 추가 → 우하단 <strong>"방송 시작"</strong> 클릭</li>
              </ol>
            </div>

            {/* YouTube Studio (인코더 모드) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-600" />
                <p className="text-sm font-bold text-gray-900">🎥 YouTube Studio (브라우저, 다중 채널 관리용)</p>
              </div>
              <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                <li>
                  <a href="https://studio.youtube.com/channel/livestreaming" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline inline-flex items-center gap-1">
                    YouTube Studio 라이브 <ExternalLink className="w-3 h-3" />
                  </a> 접속
                </li>
                <li>"스트리밍" → "스트림" 탭 → "새 스트림" 또는 기존 스트림 선택</li>
                <li>위 RTMP URL/Key 와 같은 값이 표시되는지 확인 (Studio 가 같은 endpoint 사용)</li>
                <li>OBS 또는 Prism 의 RTMP 설정에 위 키 입력 → 송출 시작</li>
              </ol>
              <p className="text-[11px] text-gray-500">💡 Studio 는 영상 인코딩을 직접 하지 않습니다. 결국 OBS/Prism 같은 외부 인코더 필요.</p>
            </div>
              </>
            )}

            {/* 다음 단계 안내 */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-2">
              <p className="text-sm font-bold text-green-900">✓ 송출 키 설정 완료. 이제 방송을 만들어보세요.</p>
              <p className="text-xs text-green-700">송출 도구에 키를 입력해두면 다음 방송부터는 "방송 시작" 클릭만으로 라이브 시작됩니다.</p>
              <Button onClick={() => navigate('/seller/live-broadcast')} className="bg-green-600 hover:bg-green-700 text-white">
                방송 만들러 가기 →
              </Button>
            </div>
          </>
        )}
      </div>
    </SellerLayout>
  )
}
