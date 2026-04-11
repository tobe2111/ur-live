import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Calendar, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'

// 테스트앱 키
const TEST_REST_API_KEY = '594661da7d2be9005172fb9a252f8ca4'
const TEST_REDIRECT_URI = 'https://live.ur-team.com/admin/kakao-test/callback'

export default function AdminKakaoTestPage() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(localStorage.getItem('kakao_test_token') || '')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ step: string; success: boolean; detail: string }[]>([])

  // Step 1: 카카오 로그인 (테스트앱 키 + 메시지 scope)
  // talk_calendar는 "이용 중 동의"이므로 scope에서 제외 (자동 포함됨)
  function startKakaoLogin() {
    const state = encodeURIComponent(window.location.pathname)
    // scope 없이 먼저 시도 (동의항목이 이미 설정되어 있으므로)
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${TEST_REST_API_KEY}&redirect_uri=${encodeURIComponent(TEST_REDIRECT_URI)}&response_type=code&state=${state}`
    window.location.href = url
  }

  // Step 2: 카카오 메시지 테스트 (나에게 보내기) — 서버 경유
  async function testMessage() {
    if (!accessToken) { toast.error('먼저 토큰을 입력해주세요'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/kakao-social/test/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })
      const data: any = await res.json()

      if (data.success) {
        setResults(prev => [...prev, { step: '카카오톡 메시지', success: true, detail: '나에게 메시지 발송 성공!' }])
        toast.success('카카오톡 메시지 발송 성공!')
      } else {
        setResults(prev => [...prev, { step: '카카오톡 메시지', success: false, detail: data.error || JSON.stringify(data) }])
        toast.error(`실패: ${data.error}`)
      }
    } catch (err: any) {
      setResults(prev => [...prev, { step: '카카오톡 메시지', success: false, detail: err.message }])
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  // Step 3: 카카오 캘린더 테스트 — 서버 경유
  async function testCalendar() {
    if (!accessToken) { toast.error('먼저 토큰을 입력해주세요'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/kakao-social/test/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })
      const data: any = await res.json()

      if (data.success) {
        setResults(prev => [...prev, { step: '카카오 캘린더', success: true, detail: data.detail || '일정 생성/조회/삭제 성공!' }])
        toast.success('캘린더 테스트 성공!')
      } else {
        setResults(prev => [...prev, { step: '카카오 캘린더', success: false, detail: data.error || JSON.stringify(data) }])
        toast.error(`실패: ${data.error}`)
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
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                <span>토큰 확보됨: {accessToken.slice(0, 20)}...</span>
              </div>
              <button onClick={() => { setAccessToken(''); localStorage.removeItem('kakao_test_token') }}
                className="text-xs text-gray-500 underline">토큰 초기화</button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={startKakaoLogin}
                className="w-full py-3 bg-[#FEE500] text-[#3C1E1E] rounded-xl font-bold text-sm active:scale-[0.97]"
              >
                카카오 로그인 (테스트앱)
              </button>

              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 border-t border-gray-200" />
                <p className="relative bg-white px-3 text-xs text-gray-400 text-center w-fit mx-auto">또는</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1.5">카카오 개발자 콘솔 → 도구 → REST API 테스트에서 발급받은 토큰 입력:</p>
                <div className="flex gap-2">
                  <input
                    id="manual-token"
                    placeholder="access_token 붙여넣기"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900"
                  />
                  <button
                    onClick={() => {
                      const val = (document.getElementById('manual-token') as HTMLInputElement)?.value?.trim()
                      if (val) { setAccessToken(val); localStorage.setItem('kakao_test_token', val); toast.success('토큰 설정 완료!') }
                    }}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold shrink-0"
                  >
                    설정
                  </button>
                </div>
                <a href="https://developers.kakao.com/tool/rest-api/open/get/v2-user-me" target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600">
                  카카오 REST API 테스트 도구 열기 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
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
