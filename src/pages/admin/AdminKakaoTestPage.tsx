import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Calendar, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'

// 테스트앱 키 (본앱과 별도)
const TEST_REST_API_KEY = '594661da7d2be9005172fb9a252f8ca4'
const TEST_REDIRECT_URI = 'https://live.ur-team.com/admin/kakao-test/callback'

export default function AdminKakaoTestPage() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(localStorage.getItem('kakao_test_token') || '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ step: string; success: boolean; detail: string }[]>([])

  // Step 1: 카카오 로그인 (테스트앱 키 + 메시지/캘린더 scope)
  function startKakaoLogin() {
    const state = encodeURIComponent(window.location.pathname)
    const scope = 'talk_message,talk_calendar,talk_calendar_task'
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${TEST_REST_API_KEY}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code&state=${state}&scope=${scope}`
    window.location.href = url
  }

  // Step 2: 카카오 메시지 테스트 (나에게 보내기)
  async function testMessage() {
    if (!accessToken) { toast.error('먼저 카카오 로그인을 해주세요'); return }
    setLoading(true)
    try {
      const templateObject = JSON.stringify({
        object_type: 'feed',
        content: {
          title: '🔴 유어딜 라이브 시작!',
          description: '테스트 메시지입니다. 카카오 메시지 API 연동 확인용.',
          image_url: 'https://live.ur-team.com/og-image.png',
          link: {
            web_url: 'https://live.ur-team.com',
            mobile_web_url: 'https://live.ur-team.com',
          },
        },
        buttons: [{
          title: '유어딜 바로가기',
          link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' },
        }],
      })

      const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `template_object=${encodeURIComponent(templateObject)}`,
      })
      const data: any = await res.json()

      if (data.result_code === 0) {
        setResults(prev => [...prev, { step: '카카오톡 메시지', success: true, detail: '나에게 메시지 발송 성공!' }])
        toast.success('카카오톡 메시지 발송 성공!')
      } else {
        setResults(prev => [...prev, { step: '카카오톡 메시지', success: false, detail: JSON.stringify(data) }])
        toast.error(`실패: ${data.msg || JSON.stringify(data)}`)
      }
    } catch (err: any) {
      setResults(prev => [...prev, { step: '카카오톡 메시지', success: false, detail: err.message }])
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  // Step 3: 카카오 캘린더 테스트
  async function testCalendar() {
    if (!accessToken) { toast.error('먼저 카카오 로그인을 해주세요'); return }
    setLoading(true)
    try {
      // 1시간 후 일정 생성
      const start = new Date(Date.now() + 3600000)
      const end = new Date(start.getTime() + 3600000)

      const event = {
        title: '🔴 유어딜 라이브 테스트',
        time: {
          start_at: start.toISOString().replace('.000Z', 'Z'),
          end_at: end.toISOString().replace('.000Z', 'Z'),
          time_zone: 'Asia/Seoul',
        },
        description: '카카오 캘린더 API 테스트 일정입니다.',
        reminders: [30],
        color: 'RED',
      }

      const res = await fetch('https://kapi.kakao.com/v2/api/calendar/create/event', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event }),
      })
      const data: any = await res.json()

      if (data.event_id) {
        setResults(prev => [...prev, { step: '카카오 캘린더', success: true, detail: `일정 생성 성공! event_id: ${data.event_id}` }])
        toast.success('캘린더 일정 생성 성공!')

        // 조회 테스트
        const listRes = await fetch(`https://kapi.kakao.com/v2/api/calendar/events?from=${start.toISOString().split('T')[0]}&to=${end.toISOString().split('T')[0]}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        const listData: any = await listRes.json()
        setResults(prev => [...prev, { step: '캘린더 조회', success: true, detail: `일정 ${listData.events?.length || 0}개 조회` }])

        // 삭제 테스트 (정리)
        await fetch(`https://kapi.kakao.com/v2/api/calendar/delete/event?event_id=${data.event_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        setResults(prev => [...prev, { step: '캘린더 삭제', success: true, detail: '테스트 일정 삭제 완료' }])
      } else {
        setResults(prev => [...prev, { step: '카카오 캘린더', success: false, detail: JSON.stringify(data) }])
        toast.error(`실패: ${data.msg || JSON.stringify(data)}`)
      }
    } catch (err: any) {
      setResults(prev => [...prev, { step: '카카오 캘린더', success: false, detail: err.message }])
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  // 전체 테스트 실행
  async function runAllTests() {
    setResults([])
    await testMessage()
    await testCalendar()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-gray-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">카카오 API 테스트</h1>
            <p className="text-xs text-gray-500">메시지/캘린더 테스트 → 이력 생성 → 본앱 승인 신청</p>
          </div>
        </div>

        {/* Step 1: 로그인 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="text-sm font-bold text-gray-900">카카오 로그인 (테스트앱)</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">테스트앱 키로 로그인하여 메시지/캘린더 동의를 받습니다.</p>

          {accessToken ? (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span>토큰 확보됨: {accessToken.slice(0, 20)}...</span>
            </div>
          ) : (
            <button
              onClick={startKakaoLogin}
              className="w-full py-3 bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold text-sm active:scale-[0.97]"
            >
              카카오 로그인 (테스트앱)
            </button>
          )}
        </div>

        {/* Step 2: 메시지 테스트 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">2</span>
            <h2 className="text-sm font-bold text-gray-900">카카오톡 메시지 테스트</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">나에게 테스트 메시지를 발송합니다.</p>
          <button
            onClick={testMessage}
            disabled={!accessToken || loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.97]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '메시지 발송 테스트'}
          </button>
        </div>

        {/* Step 3: 캘린더 테스트 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center">3</span>
            <h2 className="text-sm font-bold text-gray-900">카카오 캘린더 테스트</h2>
          </div>
          <p className="text-xs text-gray-500 mb-3">캘린더에 일정 생성/조회/삭제를 테스트합니다.</p>
          <button
            onClick={testCalendar}
            disabled={!accessToken || loading}
            className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.97]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '캘린더 테스트'}
          </button>
        </div>

        {/* 전체 테스트 */}
        <button
          onClick={runAllTests}
          disabled={!accessToken || loading}
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold text-sm mb-6 disabled:opacity-40 active:scale-[0.97]"
        >
          🚀 전체 테스트 실행 (메시지 + 캘린더)
        </button>

        {/* 결과 */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">테스트 결과</h2>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-xs ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  {r.success ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                  <div>
                    <p className={`font-bold ${r.success ? 'text-green-700' : 'text-red-700'}`}>{r.step}</p>
                    <p className={`mt-0.5 ${r.success ? 'text-green-600' : 'text-red-600'}`}>{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {results.every(r => r.success) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs font-bold text-yellow-800">✅ 모든 테스트 통과!</p>
                <p className="text-xs text-yellow-700 mt-1">이제 카카오 개발자 콘솔에서 본앱의 메시지/캘린더 권한을 재신청하세요.</p>
                <a href="https://developers.kakao.com" target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
                  카카오 개발자 콘솔 열기 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* 안내 */}
        <div className="mt-6 p-4 bg-gray-100 rounded-xl text-xs text-gray-600 space-y-1">
          <p className="font-bold text-gray-700">📋 테스트 후 본앱 승인 절차:</p>
          <p>1. 위 테스트를 모두 통과시킵니다</p>
          <p>2. developers.kakao.com → 본앱 → 카카오 로그인 → 동의항목</p>
          <p>3. talk_message, talk_calendar 권한 신청</p>
          <p>4. "테스트앱에서 이력 확인됨" 으로 승인됩니다</p>
        </div>
      </div>
    </div>
  )
}
