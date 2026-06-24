import { useEffect, useState } from 'react'
import api from '@/lib/api'
import SEO from '@/components/SEO'

/**
 * 🩺 카카오 로그인 진단 (어드민) — /admin/kakao-login-diag
 *
 * 왜 이 페이지가 필요한가: `/api/_internal/kakao-login-diag` 는 requireAdmin 이라
 *   브라우저로 주소만 치면(소비자 세션 쿠키가 먼저 인식돼) FORBIDDEN 이 뜸.
 *   어드민 대시보드 안에서 fetch 하면 admin Bearer 가 자동 첨부 → 정상 조회.
 *
 * 보는 법:
 *   - 서버 처리시간(우리 콜백 ms): avg_userinfo_ms ≈ 0 이면 OIDC fast path 작동(왕복 제거).
 *   - iOS 성공률 / 쿠키유실 서명복구 건수.
 */
interface Timing {
  samples?: number; avg_total_ms?: number; min_total_ms?: number; max_total_ms?: number
  avg_token_ms?: number; avg_userinfo_ms?: number; avg_db_ms?: number; p95_total_ms?: number
}
interface DiagData {
  note?: string
  ios_summary?: Array<{ outcome: string; count: number }>
  signed_fallback_successes_7d?: number
  server_timing_ms_7d?: Timing
  aggregate?: Array<Record<string, unknown>>
  recent?: Array<Record<string, unknown>>
}

function Stat({ label, value, unit, big }: { label: string; value?: number | null; unit: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`font-bold text-gray-900 ${big ? 'text-2xl' : 'text-lg'}`}>
        {value ?? '–'}<span className="text-xs font-normal text-gray-400 ml-0.5">{value != null ? unit : ''}</span>
      </div>
    </div>
  )
}

export default function AdminKakaoLoginDiagPage() {
  const [data, setData] = useState<DiagData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      // ⚠️ /api/_internal/* 는 api.ts 인터셉터의 admin_token 자동부착 경로(/api/admin/* ·
      //   /api/<feature>/admin/*)에 안 걸림 → 토큰 미부착 → 서버가 소비자 세션쿠키로 폴백 →
      //   requireAdmin 403. 그래서 admin Bearer 를 명시 첨부(인터셉터가 수동 헤더는 그대로 사용).
      const adminToken = localStorage.getItem('admin_token')
      const res = await api.get('/api/_internal/kakao-login-diag',
        adminToken ? { headers: { Authorization: `Bearer ${adminToken}` } } : undefined)
      setData((res.data?.data as DiagData) || null)
    } catch (e: unknown) {
      const er = (e as { response?: { data?: { error?: unknown } }; message?: string })
      const raw = er.response?.data?.error
      setError((typeof raw === 'string' ? raw : (raw as { message?: string })?.message) || er.message || '조회 실패')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const t = data?.server_timing_ms_7d
  const oidcActive = t && typeof t.avg_userinfo_ms === 'number' ? t.avg_userinfo_ms <= 5 : null
  const iosTotal = (data?.ios_summary || []).reduce((s, r) => s + (r.count || 0), 0)
  const iosSuccess = (data?.ios_summary || []).find((r) => r.outcome === 'success')?.count || 0

  return (
    <div className="min-h-screen bg-[#F4F5F7] p-4 md:p-8">
      <SEO title="카카오 로그인 진단 - 유어딜" description="admin" url="/admin/kakao-login-diag" noindex />
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">카카오 로그인 진단 <span className="text-sm font-normal text-gray-500">(최근 7일)</span></h1>
          <button onClick={() => void load()} disabled={loading}
            className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {loading ? '조회 중…' : '새로고침'}
          </button>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 mb-4 text-sm">{error}</div>}

        {/* 서버 처리 시간 */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">서버 처리 시간 (우리 콜백이 쓰는 ms)</h2>
          {t ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <Stat label="총 평균" value={t.avg_total_ms} unit="ms" big />
                <Stat label="토큰교환" value={t.avg_token_ms} unit="ms" />
                <Stat label="사용자정보" value={t.avg_userinfo_ms} unit="ms" />
                <Stat label="DB" value={t.avg_db_ms} unit="ms" />
              </div>
              <div className="text-xs text-gray-500">표본 {t.samples ?? 0}건 · p95 {t.p95_total_ms ?? '–'}ms · 최대 {t.max_total_ms ?? '–'}ms</div>
              {oidcActive !== null && (
                <div className={`mt-3 rounded-lg p-3 text-sm ${oidcActive ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                  {oidcActive
                    ? '✅ OIDC fast path 작동 중 — getUserInfo 왕복 제거됨(사용자정보 ms ≈ 0).'
                    : `⚠️ OIDC 미작동(폴백 중) — 사용자정보 왕복이 여전히 ${t.avg_userinfo_ms}ms. parseIdToken/scope 점검 필요.`}
                </div>
              )}
            </>
          ) : <div className="text-sm text-gray-400">아직 타이밍 표본이 없습니다 (로그인 발생 후 집계됨).</div>}
        </div>

        {/* iOS 요약 */}
        <div className="rounded-2xl bg-white border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">iOS(WebKit) 로그인 결과</h2>
          <div className="text-sm text-gray-900">
            성공 <strong>{iosSuccess}</strong> / 전체 {iosTotal}건
            {iosTotal > 0 && <span className="text-gray-500"> ({Math.round((iosSuccess / iosTotal) * 100)}%)</span>}
            <span className="ml-3 text-gray-500">쿠키유실 서명복구 {data?.signed_fallback_successes_7d ?? 0}건</span>
          </div>
        </div>

        {/* 원본 */}
        <details className="rounded-2xl bg-white border border-gray-200 p-5">
          <summary className="text-sm font-semibold text-gray-500 cursor-pointer">원본 JSON (전체)</summary>
          {data?.note && <p className="mt-3 text-xs text-gray-500">{data.note}</p>}
          <pre className="mt-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}
