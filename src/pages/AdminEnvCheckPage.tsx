import { useEffect, useState } from 'react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { getTossClientKey } from '@/lib/toss-preload'

/**
 * 🛡️ 2026-05-23 어드민 env 점검 페이지.
 *
 * 운영자가 Cloudflare Pages 의 env 설정 변경 후 1번만 보면
 * VITE / runtime / Live·Test 일치 여부 즉시 확인 가능.
 *
 * 사용:
 *   1) Cloudflare Pages → Settings → Variables and Secrets 에서 env 수정
 *   2) 본 페이지 새로고침 (또는 [재검증] 클릭)
 *   3) 모든 항목 ✅ 면 production 결제 정상 동작 보장
 */

interface HealthData {
  client_key: { masked: string; type: string; env: string }
  secret_key: { masked: string; env: string }
  vite_key: { masked: string; type: string; env: string; provided: boolean }
  env_match: boolean
  vite_server_match: boolean | null
  flow: string
  flow_reason?: string
  issues: string[]
  checked_at: string
}

export default function AdminEnvCheckPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function check() {
    setLoading(true)
    setError('')
    try {
      // VITE 키를 헤더로 전달 → server 가 비교 가능
      const viteKey = getTossClientKey()
      const res = await api.get('/api/_healthcheck/payments', {
        headers: viteKey ? { 'X-Vite-Toss-Client-Key': viteKey } : {},
      })
      setData(res.data?.data || null)
      setHealthy(!!res.data?.healthy)
    } catch (e) {
      const err = e as { response?: { data?: HealthData | { healthy?: boolean; data?: HealthData } } }
      // 503 응답도 본문은 있음
      const body = err?.response?.data as { healthy?: boolean; data?: HealthData } | undefined
      if (body?.data) {
        setData(body.data)
        setHealthy(false)
      } else {
        setError((e as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { check() }, [])

  const StatusBadge = ({ ok, label }: { ok: boolean; label?: string }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
      ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {ok ? '✅' : '❌'} {label || (ok ? 'OK' : 'FAIL')}
    </span>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SEO title="Env 점검" url="/admin/env-check" noindex />
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-bold text-gray-900">환경변수 점검</h1>
            <button onClick={check} disabled={loading} className="px-3 py-1.5 text-sm bg-gray-100 rounded">
              {loading ? '검증 중...' : '재검증'}
            </button>
          </div>
          {healthy !== null && (
            <div className={`mt-2 px-4 py-3 rounded ${healthy ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {healthy ? (
                <p className="text-sm font-bold text-green-800">✅ 모든 환경변수 정상 — production 결제 정상 동작</p>
              ) : (
                <p className="text-sm font-bold text-red-800">❌ 환경변수에 이슈 있음 — 아래 조치 필요</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
            ⚠️ API 호출 실패: {error}
          </div>
        )}

        {data && (
          <>
            {data.issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h2 className="text-sm font-bold text-red-900 mb-2">발견된 issues</h2>
                <ul className="space-y-1">
                  {data.issues.map((i, idx) => (
                    <li key={idx} className="text-sm text-red-800">• {i}</li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t border-red-200 text-xs text-red-700">
                  <p className="font-bold mb-1">해결:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Cloudflare Dashboard → Pages → ur-live → Settings → Environment variables and secrets</li>
                    <li><strong>Production</strong> tab (Preview 아님)</li>
                    <li>아래 표의 값을 동일하게 (Live: live_* / Test: test_*)</li>
                  </ol>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
              <h2 className="text-sm font-bold text-gray-900 px-4 py-3 border-b border-gray-100">Toss Payments</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-700 w-1/3">TOSS_CLIENT_KEY <span className="text-xs text-gray-500">(runtime, server)</span></td>
                    <td className="px-4 py-3 font-mono text-gray-900">{data.client_key.masked}</td>
                    <td className="px-4 py-3">
                      <StatusBadge ok={data.client_key.env !== 'unknown'} label={data.client_key.env} />
                      {' '}
                      <StatusBadge ok={data.client_key.type !== 'missing'} label={data.client_key.type} />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-700">TOSS_SECRET_KEY <span className="text-xs text-gray-500">(secret)</span></td>
                    <td className="px-4 py-3 font-mono text-gray-900">{data.secret_key.masked}</td>
                    <td className="px-4 py-3">
                      <StatusBadge ok={data.secret_key.env !== 'unknown'} label={data.secret_key.env} />
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-700">VITE_TOSS_CLIENT_KEY <span className="text-xs text-gray-500">(build-time, client)</span></td>
                    <td className="px-4 py-3 font-mono text-gray-900">{data.vite_key.masked}</td>
                    <td className="px-4 py-3">
                      <StatusBadge ok={data.vite_key.env !== 'unknown'} label={data.vite_key.env} />
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">Live/Test 일치</td>
                    <td colSpan={2} className="px-4 py-3">
                      <StatusBadge ok={data.env_match} label={data.env_match ? '동일 환경' : '미일치 — secret 키와 client 키 환경 다름'} />
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">VITE ↔ Runtime 일치</td>
                    <td colSpan={2} className="px-4 py-3">
                      {data.vite_server_match === null ? (
                        <span className="text-xs text-gray-500">VITE 키 미전달 (브라우저에서만 비교 가능)</span>
                      ) : (
                        <StatusBadge ok={data.vite_server_match} label={data.vite_server_match ? '동일 키' : 'VITE 와 server 키 값 다름'} />
                      )}
                    </td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">SDK 흐름</td>
                    <td colSpan={2} className="px-4 py-3">
                      <code className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200">{data.flow}</code>
                      <span className="ml-2 text-xs text-gray-500">{data.flow_reason}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-xs text-gray-500 text-right">
              마지막 체크: {new Date(data.checked_at).toLocaleString('ko-KR')}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
