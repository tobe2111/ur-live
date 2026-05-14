/**
 * 🛡️ 2026-05-14: Worker WHIP Proxy 검증 페이지 — 셀러 한 번 클릭으로 결과 확인.
 *
 * 동작:
 *   - "검증 시작" 버튼 클릭
 *   - 백엔드가 자동으로:
 *     1. 본인 좀비 라이브 일괄 종료
 *     2. YouTube webrtc ingestion 테스트 stream 생성 → whip_url 확인 → 삭제
 *     3. env / DB / API 활성 여부 한 화면 표시
 */
import { useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Loader2, PlayCircle } from 'lucide-react'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui/button'
import SEO from '@/components/SEO'

interface VerifyResult {
  env_YOUTUBE_USE_WEBRTC_INGEST: string | null
  db_whip_url_column: boolean
  db_whip_url_column_detail: string
  cleaned_zombies: number[]
  cleanup_errors: { id: number; error: string }[]
  webrtc_supported: boolean | null
  webrtc_detail: string
  sample_whip_url: string | null
  sample_ingestion_type: string | null
  test_stream_id: string | null
  test_stream_deleted: boolean
  overall: 'ok' | 'partial' | 'fail'
  recommendation: string
}

export default function SellerVerifyWhipProxyPage() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runVerify() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.post('/api/seller/youtube/live/_verify-whip-proxy', {})
      if (res.data?.success) {
        setResult(res.data.data as VerifyResult)
      } else {
        setError(res.data?.error || '검증 실패')
      }
    } catch (e) {
      setError((e as Error).message || '네트워크 오류')
    } finally {
      setRunning(false)
    }
  }

  const StatusIcon = ({ ok }: { ok: boolean | null }) =>
    ok === true ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    : ok === false ? <XCircle className="w-5 h-5 text-rose-500" />
    : <AlertCircle className="w-5 h-5 text-amber-500" />

  return (
    <SellerLayout title="WHIP Proxy 검증">
      <SEO title="Worker WHIP Proxy 검증 - 유어딜" description="WebRTC 직접 송출 활성 여부 확인" url="/seller/verify-whip-proxy" />
      <div className="max-w-3xl mx-auto p-4 lg:p-8">
        <DashboardPageHeader
          title="Worker WHIP Proxy 검증"
          subtitle="YouTube 직접 송출 (OME 우회) 활성 여부를 한 번 클릭으로 확인합니다."
        />

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-6">
          <p className="text-sm text-gray-600 mb-4">
            이 검증은 다음 작업을 수행합니다:
          </p>
          <ul className="text-sm text-gray-700 space-y-1 mb-6 ml-4 list-disc">
            <li>본인 계정의 좀비 라이브 (live / ready / starting / scheduled) 일괄 종료</li>
            <li>YouTube API 로 테스트 stream 생성 → WebRTC ingestion URL 반환 여부 확인 → 즉시 삭제</li>
            <li>환경 변수, DB 스키마, YouTube 측 지원 여부 종합 보고</li>
          </ul>
          <p className="text-xs text-gray-500 mb-4">
            YouTube API quota 소비: 약 100 units (insert 50 + delete 50). 일일 한도 10,000 의 1%.
          </p>

          <Button
            onClick={runVerify}
            disabled={running}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 검증 중 (10~20초)
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" /> 검증 시작
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mt-4 text-sm text-rose-700">
            <strong>오류:</strong> {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            {/* 종합 평가 */}
            <div
              className={
                'rounded-2xl border p-5 ' +
                (result.overall === 'ok'
                  ? 'bg-emerald-50 border-emerald-200'
                  : result.overall === 'partial'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-rose-50 border-rose-200')
              }
            >
              <div className="flex items-start gap-3">
                <StatusIcon ok={result.overall === 'ok' ? true : result.overall === 'partial' ? null : false} />
                <div>
                  <div className="font-semibold text-gray-900">
                    종합:{' '}
                    {result.overall === 'ok' ? '✅ 활성 가능'
                    : result.overall === 'partial' ? '⚠️ 일부 누락'
                    : '❌ 비활성'}
                  </div>
                  <div className="text-sm text-gray-700 mt-1">{result.recommendation}</div>
                </div>
              </div>
            </div>

            {/* 세부 항목 */}
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              <div className="p-4 flex items-start gap-3">
                <StatusIcon ok={result.env_YOUTUBE_USE_WEBRTC_INGEST === 'true'} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">환경 변수 YOUTUBE_USE_WEBRTC_INGEST</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    현재 값: <code className="bg-gray-100 px-1 rounded">{result.env_YOUTUBE_USE_WEBRTC_INGEST ?? '(unset)'}</code>
                  </div>
                  {result.env_YOUTUBE_USE_WEBRTC_INGEST !== 'true' && (
                    <div className="text-xs text-amber-700 mt-1">
                      Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables 에서 <code>YOUTUBE_USE_WEBRTC_INGEST=true</code> 추가 필요
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <StatusIcon ok={result.db_whip_url_column} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">DB 컬럼 live_streams.whip_url</div>
                  <div className="text-xs text-gray-600 mt-0.5">{result.db_whip_url_column_detail}</div>
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <StatusIcon ok={result.webrtc_supported} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">YouTube WebRTC ingestion 실제 호출</div>
                  <div className="text-xs text-gray-600 mt-0.5 break-all">{result.webrtc_detail}</div>
                  {result.sample_whip_url && (
                    <div className="text-xs text-gray-500 mt-1">
                      샘플 URL: <code className="bg-gray-100 px-1 rounded break-all">{result.sample_whip_url}</code>
                    </div>
                  )}
                  {result.sample_ingestion_type && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      ingestionType: <code className="bg-gray-100 px-1 rounded">{result.sample_ingestion_type}</code>
                    </div>
                  )}
                  {result.test_stream_id && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      테스트 stream {result.test_stream_id} — {result.test_stream_deleted ? '✅ 삭제 완료' : '⚠️ 삭제 실패 (수동 정리 필요)'}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 flex items-start gap-3">
                <StatusIcon ok={result.cleanup_errors.length === 0 ? null : false} />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 text-sm">좀비 라이브 정리</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    종료된 stream {result.cleaned_zombies.length}개: {result.cleaned_zombies.join(', ') || '(없음)'}
                  </div>
                  {result.cleanup_errors.length > 0 && (
                    <div className="text-xs text-rose-700 mt-1">
                      오류 {result.cleanup_errors.length}건: {result.cleanup_errors.map(e => `#${e.id}: ${e.error}`).join(' / ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 다음 단계 */}
            {result.overall === 'ok' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-900">
                <strong>다음 단계:</strong> <a href="/seller/live-broadcast" className="underline">/seller/live-broadcast</a> 로 이동해 새 방송을 만들면 <code>whip_url</code> 이 자동으로 채워지고 OME 우회 송출이 활성됩니다.
              </div>
            )}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
