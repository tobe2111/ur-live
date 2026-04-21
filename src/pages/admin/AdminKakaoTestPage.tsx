import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'

const TEST_REST_API_KEY = '594661da7d2be9005172fb9a252f8ca4'
const TEST_REDIRECT_URI = 'https://live.ur-team.com/admin/kakao-test/callback'

const badgeBgMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
}

const btnBgMap: Record<string, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  orange: 'bg-orange-600',
  purple: 'bg-purple-600',
}

export default function AdminKakaoTestPage() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(localStorage.getItem('kakao_test_token') || '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ step: string; success: boolean; detail: string }[]>([])
  const [friendUuid, setFriendUuid] = useState<string | null>(null)

  function startKakaoLogin() {
    const state = encodeURIComponent(window.location.pathname)
    const scope = 'talk_message,talk_calendar,friends'
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${TEST_REST_API_KEY}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code&state=${state}&scope=${scope}`
    window.location.href = url
  }

  // 브라우저에서 직접 카카오 API 호출 (Worker 경유 X → IP 문제 없음)
  async function kakaoApi(url: string, body?: string) {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${accessToken}` }
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const res = await fetch(url, { method: body ? 'POST' : 'GET', headers, body })
    return res.json()
  }

  async function testMessage() {
    if (!accessToken) { toast.error('먼저 토큰을 입력해주세요'); return }
    setLoading(true)
    try {
      const templateObject = JSON.stringify({
        object_type: 'feed',
        content: {
          title: '🔴 유어딜 라이브 커머스',
          description: '테스트 메시지입니다.',
          image_url: 'https://live.ur-team.com/og-image.png',
          link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' },
        },
        buttons: [{ title: '유어딜 바로가기', link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' } }],
      })
      const data = await kakaoApi(
        'https://kapi.kakao.com/v2/api/talk/memo/default/send',
        `template_object=${encodeURIComponent(templateObject)}`
      ) as { result_code?: number; msg?: string }
      if (data.result_code === 0) {
        setResults(prev => [...prev, { step: '카카오톡 메시지', success: true, detail: '나에게 메시지 발송 성공!' }])
        toast.success('메시지 발송 성공!')
      } else {
        setResults(prev => [...prev, { step: '카카오톡 메시지', success: false, detail: data.msg || JSON.stringify(data) }])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setResults(prev => [...prev, { step: '카카오톡 메시지', success: false, detail: msg }])
    } finally { setLoading(false) }
  }

  async function testFriendList() {
    if (!accessToken) { toast.error('먼저 토큰을 입력해주세요'); return }
    setLoading(true)
    try {
      const data = await kakaoApi('https://kapi.kakao.com/v1/api/talk/friends') as { elements?: Array<{ uuid?: string }>; msg?: string }
      if (data.elements) {
        if (data.elements[0]?.uuid) setFriendUuid(data.elements[0].uuid)
        setResults(prev => [...prev, { step: '친구 목록 조회', success: true, detail: `친구 ${data.elements!.length}명 조회 성공!` }])
        toast.success(`친구 ${data.elements!.length}명 조회!`)
      } else {
        setResults(prev => [...prev, { step: '친구 목록 조회', success: false, detail: data.msg || JSON.stringify(data) }])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setResults(prev => [...prev, { step: '친구 목록 조회', success: false, detail: msg }])
    } finally { setLoading(false) }
  }

  async function testFriendMessage() {
    if (!accessToken) { toast.error('먼저 토큰을 입력해주세요'); return }
    if (!friendUuid) { toast.error('먼저 친구 목록을 조회해주세요'); return }
    setLoading(true)
    try {
      const templateObject = JSON.stringify({
        object_type: 'feed',
        content: {
          title: '🔴 유어딜 라이브 커머스',
          description: '친구에게 보내는 테스트 메시지입니다.',
          image_url: 'https://live.ur-team.com/og-image.png',
          link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' },
        },
        buttons: [{ title: '유어딜 바로가기', link: { web_url: 'https://live.ur-team.com', mobile_web_url: 'https://live.ur-team.com' } }],
      })
      const data = await kakaoApi(
        'https://kapi.kakao.com/v1/api/talk/friends/message/default/send',
        `receiver_uuids=${encodeURIComponent(JSON.stringify([friendUuid]))}&template_object=${encodeURIComponent(templateObject)}`
      ) as { successful_receiver_uuids?: string[]; msg?: string }
      if (data.successful_receiver_uuids?.length && data.successful_receiver_uuids.length > 0) {
        setResults(prev => [...prev, { step: '친구에게 메시지', success: true, detail: '친구에게 메시지 전송 성공!' }])
        toast.success('친구 메시지 전송 성공!')
      } else {
        setResults(prev => [...prev, { step: '친구에게 메시지', success: false, detail: data.msg || JSON.stringify(data) }])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setResults(prev => [...prev, { step: '친구에게 메시지', success: false, detail: msg }])
    } finally { setLoading(false) }
  }

  async function testCalendar() {
    if (!accessToken) { toast.error('먼저 토큰을 입력해주세요'); return }
    setLoading(true)
    try {
      const start = new Date(Date.now() + 3600000)
      start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0)
      const end = new Date(start.getTime() + 3600000)
      const event = {
        title: '🔴 유어딜 라이브 테스트',
        time: { start_at: start.toISOString(), end_at: end.toISOString(), time_zone: 'Asia/Seoul' },
        description: '카카오 캘린더 API 테스트',
        reminders: [30],
        color: 'RED',
      }
      const data = await kakaoApi(
        'https://kapi.kakao.com/v2/api/calendar/create/event',
        `event=${encodeURIComponent(JSON.stringify(event))}`
      ) as { event_id?: string; msg?: string }
      if (data.event_id) {
        // 생성 후 삭제
        await kakaoApi(`https://kapi.kakao.com/v2/api/calendar/delete/event?event_id=${data.event_id}`)
        setResults(prev => [...prev, { step: '카카오 캘린더', success: true, detail: `일정 생성 성공 (ID: ${data.event_id}) → 삭제 완료` }])
        toast.success('캘린더 테스트 성공!')
      } else {
        setResults(prev => [...prev, { step: '카카오 캘린더', success: false, detail: data.msg || JSON.stringify(data) }])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setResults(prev => [...prev, { step: '카카오 캘린더', success: false, detail: msg }])
    } finally { setLoading(false) }
  }

  async function runAllTests() {
    setResults([])
    await testMessage()
    await testFriendList()
    await testFriendMessage()
    await testCalendar()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-gray-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">카카오 API 테스트</h1>
            <p className="text-xs text-gray-500">브라우저에서 직접 호출 (Worker 경유 X)</p>
          </div>
        </div>

        {/* Step 1: 로그인 */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center">1</span>
            <h2 className="text-sm font-bold text-gray-900">카카오 로그인 (테스트앱)</h2>
          </div>
          {accessToken ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <span>토큰 확보됨: {accessToken.slice(0, 20)}...</span>
              </div>
              <button onClick={() => { setAccessToken(''); localStorage.removeItem('kakao_test_token'); setFriendUuid(null) }}
                className="text-xs text-gray-500 underline">토큰 초기화</button>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={startKakaoLogin}
                className="w-full py-3 bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold text-sm active:scale-[0.97]">
                카카오 로그인 (테스트앱)
              </button>
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 border-t border-gray-200" />
                <p className="relative bg-white px-3 text-xs text-gray-400 text-center w-fit mx-auto">또는 토큰 직접 입력</p>
              </div>
              <div>
                <div className="flex gap-2">
                  <input id="manual-token" placeholder="access_token 붙여넣기"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900" />
                  <button onClick={() => {
                    const val = (document.getElementById('manual-token') as HTMLInputElement)?.value?.trim()
                    if (val) { setAccessToken(val); localStorage.setItem('kakao_test_token', val); toast.success('토큰 설정 완료!') }
                  }} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold shrink-0">설정</button>
                </div>
                <a href="https://developers.kakao.com/tool/rest-api/open/get/v2-user-me" target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600">
                  카카오 REST API 테스트 도구 열기 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Step 2~5 */}
        {[
          { num: 2, color: 'blue', title: '카카오톡 메시지 테스트', desc: '나에게 테스트 메시지를 발송합니다.', fn: testMessage },
          { num: 3, color: 'green', title: '친구 목록 조회', desc: '카카오톡 서비스 내 친구 목록을 가져옵니다.', fn: testFriendList },
          { num: 4, color: 'orange', title: '친구에게 메시지 전송', desc: '첫 번째 친구에게 테스트 메시지를 보냅니다.', fn: testFriendMessage },
          { num: 5, color: 'purple', title: '카카오 캘린더 테스트', desc: '캘린더에 일정 생성 → 삭제를 테스트합니다.', fn: testCalendar },
        ].map(({ num, color, title, desc, fn }) => (
          <div key={num} className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-6 h-6 rounded-full ${badgeBgMap[color]} text-white text-xs font-bold flex items-center justify-center`}>{num}</span>
              <h2 className="text-sm font-bold text-gray-900">{title}</h2>
            </div>
            <p className="text-xs text-gray-500 mb-3">{desc}</p>
            <button onClick={fn} disabled={!accessToken || loading}
              className={`w-full py-2.5 ${btnBgMap[color]} text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-[0.97]`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : title}
            </button>
          </div>
        ))}

        <button onClick={runAllTests} disabled={!accessToken || loading}
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold text-sm mb-6 disabled:opacity-40 active:scale-[0.97]">
          🚀 전체 테스트 실행
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
                <p className="text-xs text-yellow-700 mt-1">이 스크린샷을 카카오 심사에 첨부하세요.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
