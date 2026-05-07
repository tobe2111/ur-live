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

            {/* 모바일 (Larix) — 추천 */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-pink-600" />
                <p className="text-sm font-bold text-gray-900">📱 모바일 (가장 쉬움) — Larix Broadcaster</p>
                <span className="text-[10px] bg-pink-500 text-white font-bold px-2 py-0.5 rounded">추천</span>
              </div>
              <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                <li>App Store / Play Store 에서 "<strong>Larix Broadcaster</strong>" 검색 → 무료 설치</li>
                <li>아래 QR 을 폰 카메라로 스캔 (또는 폰에서 이 페이지 열어서 "Larix 자동 입력" 버튼)</li>
                <li>Larix 가 자동으로 RTMP 설정 입력 → 빨간 버튼만 누르면 송출 시작</li>
              </ol>
              <div className="flex gap-4 items-center justify-center pt-2">
                <div className="bg-white p-3 rounded-xl border border-gray-200">
                  <QRCode value={larixDeepLink} size={140} level="M" />
                </div>
                <div className="text-xs text-gray-600 max-w-xs">
                  <p className="font-semibold mb-1">QR 스캔 후 "Larix 로 열기"</p>
                  <p className="text-gray-500">설치 안 되어있으면 앱스토어로 이동. Larix 에서 다시 같은 QR 스캔하면 자동 입력됩니다.</p>
                  <a
                    href={larixDeepLink}
                    className="inline-flex items-center gap-1 mt-2 text-pink-600 hover:text-pink-700 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" /> 이 폰에서 Larix 자동 입력
                  </a>
                </div>
              </div>
            </div>

            {/* PC (OBS) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-bold text-gray-900">💻 PC — OBS Studio (전문가용)</p>
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

            {/* PC (Prism) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-indigo-600" />
                <p className="text-sm font-bold text-gray-900">💻 PC — Prism Live Studio (UI 친절)</p>
              </div>
              <ol className="text-xs text-gray-700 space-y-1.5 pl-4 list-decimal">
                <li>
                  <a href="https://prismlive.com/ko_kr/pcapp/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Prism Live Studio 다운로드 <ExternalLink className="w-3 h-3" />
                  </a> · 설치 후 실행
                </li>
                <li>"라이브" → "방송 채널 추가" → <strong>Custom RTMP</strong> 선택</li>
                <li>위 RTMP URL 과 Stream Key 붙여넣기 → 저장</li>
                <li><strong>"방송 시작"</strong> 클릭</li>
              </ol>
            </div>

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
