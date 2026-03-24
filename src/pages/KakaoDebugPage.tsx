/**
 * 카카오 로그인 디버그 페이지
 * 
 * KOE101 오류 발생 시 이 페이지로 가서 설정을 확인하세요.
 * 접속 방법: https://live.ur-team.com/debug/kakao
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface CheckResult {
  name: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: string
}

export default function KakaoDebugPage() {
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runDiagnostics()
  }, [])

  async function runDiagnostics() {
    setLoading(true)
    const results: CheckResult[] = []

    // 1. 환경 변수 확인
    const kakaoAppKey = import.meta.env.VITE_KAKAO_APP_KEY
    const kakaoRestApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY
    const kakaoJsKey = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY

    results.push({
      name: 'VITE_KAKAO_APP_KEY',
      status: kakaoAppKey ? 'success' : 'error',
      message: kakaoAppKey ? `설정됨: ${kakaoAppKey.substring(0, 10)}...` : '❌ 설정되지 않음',
      details: kakaoAppKey || undefined
    })

    results.push({
      name: 'VITE_KAKAO_REST_API_KEY',
      status: kakaoRestApiKey ? 'success' : 'error',
      message: kakaoRestApiKey ? `설정됨: ${kakaoRestApiKey.substring(0, 10)}...` : '❌ 설정되지 않음 - KOE101 오류의 주요 원인!',
      details: kakaoRestApiKey || undefined
    })

    results.push({
      name: 'VITE_KAKAO_JAVASCRIPT_KEY',
      status: kakaoJsKey ? 'success' : 'warning',
      message: kakaoJsKey ? `설정됨: ${kakaoJsKey.substring(0, 10)}...` : '⚠️ 설정되지 않음',
      details: kakaoJsKey || undefined
    })

    // 2. Kakao SDK 로드 확인
    const kakaoSdkLoaded = typeof window.Kakao !== 'undefined'
    results.push({
      name: 'Kakao SDK 로드',
      status: kakaoSdkLoaded ? 'success' : 'error',
      message: kakaoSdkLoaded ? '✅ 로드됨' : '❌ 로드되지 않음'
    })

    // 3. Kakao SDK 초기화 확인
    if (kakaoSdkLoaded) {
      const kakaoInitialized = window.Kakao.isInitialized()
      results.push({
        name: 'Kakao SDK 초기화',
        status: kakaoInitialized ? 'success' : 'error',
        message: kakaoInitialized ? '✅ 초기화됨' : '❌ 초기화 안됨',
        details: kakaoInitialized ? `앱 키: ${window.Kakao._appKey || '알 수 없음'}` : undefined
      })
    }

    // 4. Redirect URI 확인
    const redirectUri = 'https://live.ur-team.com/auth/kakao/sync/callback'
    results.push({
      name: 'Redirect URI',
      status: 'warning',
      message: redirectUri,
      details: '⚠️ 카카오 개발자 콘솔에 이 URI가 등록되어 있어야 합니다!'
    })

    // 5. 카카오 OAuth URL 생성 테스트
    if (kakaoRestApiKey) {
      const testUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoRestApiKey}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`
      results.push({
        name: '카카오 로그인 URL',
        status: 'success',
        message: '테스트 URL 생성됨',
        details: testUrl
      })
    }

    setChecks(results)
    setLoading(false)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('클립보드에 복사되었습니다!')
  }

  function getStatusIcon(status: CheckResult['status']) {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">🔍 카카오 로그인 디버그</CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              KOE101 오류가 발생했나요? 아래 설정을 확인하세요.
            </p>
          </CardHeader>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📚 빠른 링크</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="https://developers.kakao.com/console/app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              카카오 개발자 콘솔
            </a>
            <a
              href="https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              카카오 로그인 REST API 가이드
            </a>
            <a
              href="https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              에러 코드 문서
            </a>
          </CardContent>
        </Card>

        {/* Diagnostics Results */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">🔧 진단 결과</CardTitle>
            <Button onClick={runDiagnostics} disabled={loading} size="sm">
              {loading ? '진단 중...' : '다시 진단'}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">진단 실행 중...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {checks.map((check, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(check.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{check.name}</h3>
                        <p className="text-sm text-gray-700 mt-1">{check.message}</p>
                        {check.details && (
                          <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono break-all relative group">
                            {check.details}
                            <button
                              onClick={() => copyToClipboard(check.details!)}
                              className="absolute top-2 right-2 p-1 bg-white rounded shadow opacity-0 group-hover:opacity-100 transition-opacity"
                              title="복사"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">✅ 체크리스트</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                <strong>카카오 개발자 콘솔</strong>에서 REST API 키 확인
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">.env.kr</code> 파일에{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">VITE_KAKAO_REST_API_KEY</code> 추가
              </li>
              <li>
                카카오 개발자 콘솔에서 <strong>Redirect URI</strong> 등록:
                <br />
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  https://live.ur-team.com/auth/kakao/sync/callback
                </code>
              </li>
              <li>
                <strong>카카오 로그인</strong> 활성화 확인 (제품 설정 메뉴)
              </li>
              <li>
                <strong>Web 플랫폼</strong> 등록: <code className="bg-gray-100 px-2 py-1 rounded">https://live.ur-team.com</code>
              </li>
              <li>앱 빌드 및 배포 후 테스트</li>
            </ol>
          </CardContent>
        </Card>

        {/* Documentation Link */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-900">
              📖 자세한 해결 방법은{' '}
              <code className="bg-blue-100 px-2 py-1 rounded font-mono">
                KAKAO_LOGIN_KOE101_FIX.md
              </code>{' '}
              파일을 참고하세요.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
