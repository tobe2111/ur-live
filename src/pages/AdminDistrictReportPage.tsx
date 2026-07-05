/**
 * 📊 2026-07-04 상권 성과 리포트 (B2G 수주처 제출용 — 대표 "다음 꺼 해줘").
 *
 * 특정 상권(시군구 5자리/행정동 10자리 지역코드)의 매장·딜·이용권 판매/사용·체험단 성과를
 * 기간별로 집계 — `GET /api/admin/region/report`. 인쇄(브라우저 print) 제출을 고려해
 * print 시 사이드바/버튼 없이 리포트 본문만 나오도록 print: 클래스 처리.
 * 소비자 상권관(/local/:code)과 같은 지역코드 체계를 사용.
 */
import { useState, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { BarChart3, Printer, RefreshCw, MapPin, ExternalLink } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { formatNumber, formatWon } from '@/utils/format'

interface DongRow { dong: string; dong_code: string; deals: number; issued: number; issued_amount: number }
interface DailyRow { day: string; issued: number; amount: number }
interface SourceRow { src: string; landings: number; signups: number; first_purchases: number }
interface Report {
  region: { code: string; si: string | null; gu: string | null }
  days: number
  stores: number
  deals: number
  vouchers: { issued: number; issued_amount: number; used: number; used_amount: number }
  fcfs: { applied: number; selected: number; paid: number }
  by_dong: DongRow[]
  daily: DailyRow[]
  sources: SourceRow[]
}

// 자주 쓰는 상권 프리셋 — 코드는 시군구 5자리(법정동/행정동 공통 prefix). 필요 시 자유 입력.
const PRESETS: Array<{ label: string; code: string }> = [
  { label: '서초구', code: '11650' },
  { label: '강남구', code: '11680' },
  { label: '송파구', code: '11710' },
  { label: '마포구', code: '11440' },
]

const PERIODS = [7, 30, 90, 180] as const

/**
 * 📡 시설물 QR 생성기 — 인쇄물(포토존/배너/깃발) 제작용 소스 태깅 링크.
 * URL 규격 SSOT: /local/{지역코드}?src={소스} · 소스는 소문자/숫자/하이픈 (lib/acquisition.ts 와 동일 검증).
 */
function FacilityQrMaker({ regionCode }: { regionCode: string }) {
  const [src, setSrc] = useState('photozone')
  const valid = /^[a-z0-9][a-z0-9-]{0,39}$/.test(src)
  const url = `${window.location.origin}/local/${regionCode}?src=${src}`
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
      <h3 className="text-sm font-bold text-gray-900">시설물 QR 만들기</h3>
      <p className="text-[11px] text-gray-400 mt-0.5 mb-3">
        시설물마다 다른 소스명을 부여하세요 (소문자·숫자·하이픈) — 예: photozone, banner-01, flag-1234, insta, danggn
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[220px]">
          <input
            value={src}
            onChange={e => setSrc(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
            placeholder="소스명 (예: photozone)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900"
          />
          {valid ? (
            <p className="mt-2 text-xs text-gray-600 break-all">
              <span className="text-gray-400">인쇄용 URL: </span>
              <code className="bg-gray-50 px-1.5 py-0.5 rounded">{url}</code>
            </p>
          ) : (
            <p className="mt-2 text-xs text-red-500">소스명은 소문자/숫자/하이픈 1~40자</p>
          )}
          <p className="mt-1 text-[11px] text-gray-400">QR 을 우클릭 저장하거나, 인쇄 업체에 URL 을 그대로 전달하세요. 스캔 유입은 위 소스별 퍼널에 집계됩니다.</p>
        </div>
        {valid && (
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <QRCodeSVG value={url} size={140} level="M" />
            <p className="mt-1 text-center text-[10px] text-gray-500">{src}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

export default function AdminDistrictReportPage() {
  const [code, setCode] = useState('11650')
  const [days, setDays] = useState<number>(30)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (regionCode: string, d: number) => {
    if (!/^\d{5,12}$/.test(regionCode)) { setError('지역코드는 숫자 5~12자리 (예: 서초구 11650)'); return }
    setLoading(true); setError('')
    try {
      const res = await api.get(`/api/admin/region/report?region=${regionCode}&days=${d}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      })
      if (res.data?.success) setReport(res.data.data as Report)
      else setError(res.data?.error || '집계 실패')
    } catch { setError('집계 실패 — 네트워크/권한을 확인해주세요') }
    finally { setLoading(false) }
  }, [])

  const regionName = report ? [report.region.si, report.region.gu].filter(Boolean).join(' ') || `지역 ${report.region.code}` : ''
  const maxDongAmount = Math.max(1, ...(report?.by_dong || []).map(d => Number(d.issued_amount) || 0))
  const usageRate = report && report.vouchers.issued > 0
    ? Math.round((report.vouchers.used / report.vouchers.issued) * 100) : 0

  return (
    <AdminLayout title="상권 성과 리포트">
      <div className="p-4 lg:p-6 ur-content-full">
        {/* 컨트롤 — 인쇄 시 숨김 */}
        <div className="print:hidden">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" /> 상권 성과 리포트
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            상권(지역코드) 단위 매장·동네딜·이용권·체험단 성과 집계 — B2G 제출용 인쇄 지원
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {PRESETS.map(pz => (
              <button key={pz.code} type="button" onClick={() => { setCode(pz.code); void load(pz.code, days) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${code === pz.code ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}>
                {pz.label}
              </button>
            ))}
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="지역코드 (예: 11650)"
              className="w-40 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
            />
            <select value={days} onChange={e => { const d = Number(e.target.value); setDays(d); if (report) void load(code, d) }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white">
              {PERIODS.map(d => <option key={d} value={d}>최근 {d}일</option>)}
            </select>
            <button type="button" onClick={() => void load(code, days)} disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 집계
            </button>
            {report && (
              <>
                <button type="button" onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold">
                  <Printer className="w-3.5 h-3.5" /> 인쇄/PDF
                </button>
                <a href={`/local/${report.region.code}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-700">
                  <ExternalLink className="w-3.5 h-3.5" /> 상권관 페이지
                </a>
              </>
            )}
          </div>
          {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
        </div>

        {/* 리포트 본문 — 인쇄 대상 */}
        {report && (
          <div className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-blue-600" /> {regionName} 상권 성과 (최근 {report.days}일)
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">지역코드 {report.region.code} · 생성 {new Date().toLocaleDateString('ko-KR')} · 유어딜(UR Deal)</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="입점 매장" value={`${formatNumber(report.stores)}곳`} sub={`활성 동네딜 ${formatNumber(report.deals)}개`} />
              <StatCard label="이용권 판매" value={`${formatNumber(report.vouchers.issued)}건`} sub={formatWon(report.vouchers.issued_amount)} />
              <StatCard label="매장 방문 사용" value={`${formatNumber(report.vouchers.used)}건`} sub={`사용률 ${usageRate}% · ${formatWon(report.vouchers.used_amount)}`} />
              <StatCard label="체험단" value={`응모 ${formatNumber(report.fcfs.applied)}`} sub={`당첨 ${formatNumber(report.fcfs.selected)} · 구매전환 ${formatNumber(report.fcfs.paid)}`} />
            </div>

            {/* 일별 판매 추이 — 경량 바(라이브러리 무의존, 인쇄 안전) */}
            {report.daily.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">일별 이용권 판매 추이</h3>
                <div className="flex items-end gap-[2px] h-28">
                  {report.daily.map(d => {
                    const max = Math.max(1, ...report.daily.map(x => Number(x.amount) || 0))
                    const h = Math.max(2, Math.round(((Number(d.amount) || 0) / max) * 100))
                    return (
                      <div key={d.day} className="flex-1 bg-blue-500/80 rounded-t" style={{ height: `${h}%` }}
                        title={`${d.day} — ${formatNumber(d.issued)}건 · ${formatWon(d.amount)}`} />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                  <span>{report.daily[0]?.day}</span>
                  <span>{report.daily[report.daily.length - 1]?.day}</span>
                </div>
              </div>
            )}

            {/* 동별 분해 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <h3 className="text-sm font-bold text-gray-900 px-4 pt-4 pb-2">동별 성과</h3>
              {report.by_dong.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-gray-400">이 상권에 태깅된 매장이 아직 없습니다</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2 font-semibold">행정동</th>
                      <th className="px-2 py-2 font-semibold text-right">딜</th>
                      <th className="px-2 py-2 font-semibold text-right">판매</th>
                      <th className="px-4 py-2 font-semibold text-right w-[45%]">판매액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_dong.map(d => (
                      <tr key={d.dong_code} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 font-semibold text-gray-900">{d.dong}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{formatNumber(d.deals)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{formatNumber(d.issued)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="h-2 rounded bg-blue-500/70" style={{ width: `${Math.round(((Number(d.issued_amount) || 0) / maxDongAmount) * 60)}%` }} />
                            <span className="text-gray-900 font-semibold whitespace-nowrap">{formatWon(d.issued_amount)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 📡 2026-07-05 소스별 유입 퍼널 — 시설물 QR(?src=)·UTM 이 "어떤 시설물이 일했는지" */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <h3 className="text-sm font-bold text-gray-900 px-4 pt-4 pb-1">소스별 유입 퍼널 (시설물 QR · 광고)</h3>
              <p className="px-4 pb-2 text-[11px] text-gray-400">
                랜딩(QR 스캔/링크 첫 접촉) → 가입 → 첫 구매. 소스는 <code className="bg-gray-100 px-1 rounded">/local/{report.region.code}?src=소스명</code> 의 src 값.
              </p>
              {(report.sources || []).length === 0 ? (
                <p className="px-4 pb-4 text-sm text-gray-400">아직 소스 태깅 유입이 없습니다 — 아래 QR 생성기로 시설물별 링크를 만들어 배포하세요</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2 font-semibold">소스</th>
                      <th className="px-2 py-2 font-semibold text-right">랜딩</th>
                      <th className="px-2 py-2 font-semibold text-right">가입</th>
                      <th className="px-2 py-2 font-semibold text-right">첫 구매</th>
                      <th className="px-4 py-2 font-semibold text-right">구매 전환율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.sources || []).map(s => (
                      <tr key={s.src} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 font-semibold text-gray-900"><code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs">{s.src}</code></td>
                        <td className="px-2 py-2 text-right text-gray-600">{formatNumber(s.landings)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{formatNumber(s.signups)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{formatNumber(s.first_purchases)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-900">
                          {s.landings > 0 ? `${Math.round((s.first_purchases / s.landings) * 100)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 시설물 QR 생성기 — 인쇄물 제작용 (인쇄 리포트에선 숨김) */}
            <FacilityQrMaker regionCode={report.region.code} />

            <p className="text-[10px] text-gray-400 print:block">
              * 판매=이용권 발급 기준(applied_price 합), 사용=매장 QR/PIN 확인 기준. 체험단 구매전환=당첨 후 결제 완료.
              소스 퍼널의 랜딩·가입은 30일 first-touch 귀속(같은 유저의 첫 소스 고정).
            </p>
          </div>
        )}

        {!report && !loading && !error && (
          <div className="mt-10 text-center text-sm text-gray-400 print:hidden">
            상권 프리셋을 누르거나 지역코드를 입력하고 집계를 실행하세요
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
