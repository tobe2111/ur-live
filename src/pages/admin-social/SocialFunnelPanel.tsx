/**
 * 📈 2026-10-15 공급 모으기 성과 패널 — 유입 태그(sns-…)별 랜딩 → 가입 → 매장 등록 → 소개 파트너 신청.
 *   ⚠️ 라이트 대시보드 테마(AdminLayout) — dark: variant 금지.
 *   API: GET /api/admin/social/funnel (features/social-media/api/social-funnel.ts)
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { AlertTriangle, Copy, TrendingUp } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { PLATFORMS, AUDIENCE_LABEL, type FunnelRow } from './types'

interface FunnelResponse {
  rows: FunnelRow[]
  instagramBioLinks: { audience: string; url: string }[]
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success('복사했습니다')).catch(() => toast.error('복사하지 못했습니다'))
}

export default function SocialFunnelPanel() {
  const { data, isLoading, isError, refetch } = useApiQuery<FunnelResponse>(
    ['admin', 'social', 'funnel'], '/api/admin/social/funnel',
    { select: (r: any) => ({ rows: r?.rows || [], instagramBioLinks: r?.instagramBioLinks || [] }) },
  )
  const rows = data?.rows || []
  const total = rows.reduce(
    (a, r) => ({ landings: a.landings + r.landings, signups: a.signups + r.signups, stores: a.stores + r.stores, applies: a.applies + r.creatorApplies }),
    { landings: 0, signups: 0, stores: 0, applies: 0 },
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-gray-700" />
        <span className="font-semibold text-gray-900">공급 모으기 성과</span>
        <span className="text-xs text-gray-400">게시물 링크로 들어온 사람이 매장·소개 파트너가 됐는지</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: '랜딩', v: total.landings },
          { k: '가입', v: total.signups },
          { k: '매장 등록', v: total.stores },
          { k: '소개 파트너 신청', v: total.applies },
        ].map((s) => (
          <div key={s.k} className="rounded-lg bg-gray-50 px-3 py-2">
            <div className="text-xs text-gray-500">{s.k}</div>
            <div className={`text-lg font-bold ${s.v ? 'text-gray-900' : 'text-gray-400'}`}>{isError ? '—' : s.v}</div>
          </div>
        ))}
      </div>

      {(data?.instagramBioLinks || []).length > 0 && (
        <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <div className="mb-1 font-medium text-gray-700">인스타그램 프로필 링크 (캡션 링크는 안 눌려서 여기로 들어온다)</div>
          {data!.instagramBioLinks.map((b) => (
            <div key={b.audience} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-gray-500">{AUDIENCE_LABEL[b.audience] || b.audience}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-gray-800">{b.url}</span>
              <button onClick={() => copy(b.url)} className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900">
                <Copy className="h-3 w-3" /> 복사
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-sm text-gray-400">불러오는 중…</div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-sm text-tone-bad">
          <AlertTriangle className="h-4 w-4" /> 성과를 불러오지 못했습니다.
          <button onClick={() => refetch()} className="underline">다시 시도</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">아직 게시물 링크로 들어온 사람이 없습니다. 발행 후 여기에 쌓입니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="py-2 pr-3 font-medium">게시물</th>
                <th className="py-2 pr-3 text-right font-medium">랜딩</th>
                <th className="py-2 pr-3 text-right font-medium">가입</th>
                <th className="py-2 pr-3 text-right font-medium">매장</th>
                <th className="py-2 text-right font-medium">소개 파트너</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = r.post
                const plat = PLATFORMS.find((x) => x.key === p?.platform)
                return (
                  <tr key={r.src} className="border-b border-gray-50">
                    <td className="max-w-[260px] py-2 pr-3">
                      <div className="truncate text-gray-900">{p?.title || r.src}</div>
                      <div className="text-xs text-gray-400">
                        {plat?.label || r.src}{p?.audience ? ` · ${AUDIENCE_LABEL[p.audience] || p.audience}` : ''}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-700">{r.landings}</td>
                    <td className="py-2 pr-3 text-right text-gray-700">{r.signups}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${r.stores ? 'text-gray-900' : 'text-gray-400'}`}>{r.stores}</td>
                    <td className={`py-2 text-right font-semibold ${r.creatorApplies ? 'text-gray-900' : 'text-gray-400'}`}>{r.creatorApplies}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
