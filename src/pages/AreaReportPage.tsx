import { sellerEntryPath } from '@/utils/seller-entry'
/**
 * 📊 우리 동네 상권 리포트 — 공개 SEO 페이지 (2026-07-27 대표 "다음 구현").
 *   공공 인허가 수집분 지역 집계(업종별 영업중/90일 개폐업 + 최근 개업) — 아웃리치 이메일의
 *   "사장님 동네 리포트" 링크 목적지이자 매장 사장 SEO 유입 미끼. 하단 입점 CTA.
 *   화이트 테마(+dark) · /area-report/:region? · 연락처 미노출(공개 필드만).
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import BrandLoader from '@/components/brand/BrandLoader'
import { formatNumber } from '@/utils/format'

interface CatRow { k: string; active_n: number; opened_90d: number; closed_90d: number }
interface Recent { biz_name: string; category: string | null; uptae: string | null; addr_road: string | null; apv_perm_ymd: string | null }
interface Resp {
  success: boolean; region?: string
  totals?: { active_n: number; opened_90d: number; closed_90d: number }
  byCategory?: CatRow[]; recent?: Recent[]; regions: Array<{ k: string; n: number }>
}

const fmtYmd = (y: string | null) => y && y.length === 8 ? `${y.slice(0, 4)}.${y.slice(4, 6)}.${y.slice(6, 8)}` : ''

export default function AreaReportPage() {
  const { region: regionParam } = useParams<{ region?: string }>()
  const navigate = useNavigate()
  const region = (regionParam || '').trim()
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const p = new URLSearchParams()
    if (region) p.set('region', region)
    api.get(`/api/public/area-report?${p.toString()}`)
      .then(r => { if (alive && r.data?.success) setData(r.data) })
      .catch(() => { /* 빈 상태 폴백 */ })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [region])

  // 메타는 서버(비-JS 크롤러)와 같은 SSOT 에서 뽑는다. 지역 변형은 경로에서 파생되므로
  // 빌더가 noindex 판정까지 함께 내려준다(지어낸 지역명 = 도어웨이 방지).
  const path = `/area-report${region ? `/${region}` : ''}`
  const seo = resolveConsumerSurfaceSeo(path, '', 'https://urdeal.kr')

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0A0A0A]">
      <SEO title={seo?.title ?? '우리 동네 상권 리포트'} description={seo?.description ?? ''} url={path} noindex={seo?.noindex} />
      <div className="ur-content-medium px-4 lg:px-8 py-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">📊 {region ? `${region} 상권 리포트` : '우리 동네 상권 리포트'}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">공공 인허가 데이터 기반 — 업종별 영업 현황과 최근 90일 개업·폐업 흐름을 무료로 확인하세요.</p>

        {/* 지역 선택 칩 */}
        {(data?.regions?.length || 0) > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {data!.regions.map(r => (
              <button key={r.k} onClick={() => navigate(`/area-report/${encodeURIComponent(r.k)}`)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${region === r.k ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white' : 'bg-white text-gray-600 border-gray-200 dark:bg-[#121212] dark:text-gray-300 dark:border-[#2A2A2A]'}`}>
                {r.k}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex justify-center"><BrandLoader /></div>
        ) : !region ? (
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">위에서 지역을 선택하면 업종별 리포트가 열립니다.</p>
        ) : !data?.byCategory?.length ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500 text-sm">이 지역 데이터가 아직 준비 중입니다.</div>
        ) : (
          <>
            {/* 요약 */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: '영업 중', v: data.totals?.active_n || 0, cls: 'text-gray-900 dark:text-white' },
                { label: '90일 개업', v: data.totals?.opened_90d || 0, cls: 'text-tone-bad' },
                { label: '90일 폐업', v: data.totals?.closed_90d || 0, cls: 'text-gray-400 dark:text-gray-500' },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212] p-4 text-center">
                  <div className={`text-2xl font-bold ${s.cls}`}>{formatNumber(s.v)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* 업종별 표 */}
            <div className="mt-5 rounded-xl border border-gray-100 dark:border-[#1A1A1A] overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#1A1A1A]">
                    <th className="px-4 py-2.5 font-medium">업종</th>
                    <th className="px-4 py-2.5 font-medium text-right">영업 중</th>
                    <th className="px-4 py-2.5 font-medium text-right">90일 개업</th>
                    <th className="px-4 py-2.5 font-medium text-right">90일 폐업</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map(r => (
                    <tr key={r.k} className="border-b border-gray-50 dark:border-[#151515]">
                      <td className="px-4 py-2.5 text-gray-900 dark:text-white">{r.k}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700 dark:text-gray-200">{formatNumber(r.active_n)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-600 dark:text-rose-400">{r.opened_90d > 0 ? `+${formatNumber(r.opened_90d)}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 dark:text-gray-500">{r.closed_90d > 0 ? `-${formatNumber(r.closed_90d)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 최근 개업 */}
            {(data.recent?.length || 0) > 0 && (
              <div className="mt-5">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">🎉 최근 개업</h2>
                <ul className="mt-2 space-y-1.5">
                  {data.recent!.map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-white">{r.biz_name}</span>
                      <span className="text-gray-400 dark:text-gray-500"> · {[r.uptae || r.category, fmtYmd(r.apv_perm_ymd)].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="mt-8 rounded-2xl border border-gray-100 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#121212] p-5 text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">경쟁이 이렇게 빠르게 움직입니다 — 우리 가게를 동네에 먼저 노출하세요.</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">유어딜 입점은 입점비·고정비 없이, 팔릴 때만 수수료.</p>
              {/* 🚪 2026-08-31: 상권 리포트를 다 본 직후는 전환이 제일 강한 순간이다. 그런데 `/partners`
                  직행이라 **이미 입점한 사장님**도 처음 오는 사람용 소개 페이지로 보내졌다.
                  ⇒ `sellerEntryPath()` — 셀러면 자기 대시보드로 곧장. */}
              <a href={sellerEntryPath()} className="inline-block mt-3 px-5 py-2.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-sm font-bold">사장님 가게 입점 알아보기 →</a>
            </div>
          </>
        )}

        <p className="mt-8 text-[11px] text-gray-400 dark:text-gray-500">출처: 지방행정 인허가 공공데이터 — 수치는 수집 범위 내 집계이며 실제 전수와 다를 수 있습니다.</p>
      </div>
    </div>
  )
}
