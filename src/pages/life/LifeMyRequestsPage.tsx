/**
 * 🏠 내 생활 견적 요청 목록 (2026-10-24).
 * 2026-10-31 대표 *"견적을 낸 걸 마이페이지나 어디서 봐야하지 않을까? 그 견적 링크를 공유해야 홍보도 되는거잖아"*
 *   — 마이 '내가 산 것' 에 이 화면으로 가는 줄을 달고, 받는 중인 요청마다 [링크 보내기] 를 둔다.
 *   링크(`/life/q/:token`)는 이름·연락처·상세 주소를 가린 공개 페이지라 그대로 보내도 된다.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'
import { STATUS_LABEL, categoryLabel, shareLifeRequest } from './life-shared'

interface Row { id: number; category: string; summary: string; desired_date: string; status: string; quote_count: number; max_quotes: number; share_token?: string | null }

export default function LifeMyRequestsPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api.get('/api/home-service/requests/mine')
      .then((r) => setRows(r.data?.data || []))
      .catch(() => { setFailed(true); setRows([]) })
  }, [])
  if (rows === null) return <BrandLoader fullScreen label="요청을 불러오는 중" />
  return (
    <div className={`${SUB_PAGE_CLS} text-ink pb-safe-nav`}>
      <SEO title="내 생활 요청 - 유어딜" description="보낸 견적 요청과 받은 견적" url="/life/requests" />
      {/* 마이에서 들어오는 화면이라 마이 하위 화면과 같은 머리줄(2026-10-19 한 벌) */}
      <SubPageHeader title="내 견적 요청" backLabel="뒤로 가기" />
      <div className="ur-content-narrow px-4 pb-10">
        {failed ? (
          <p className="py-16 text-center text-[13px] text-tone-bad">요청을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[15px] font-bold">아직 보낸 요청이 없어요</p>
            <Link to="/life" className="ur-btn ur-btn-md ur-btn-primary mt-4">견적 요청하러 가기</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-2xl bg-surface shadow-lift">
                <Link to={`/life/requests/${r.id}`} className="block p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-bold">{categoryLabel(r.category)}</span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{STATUS_LABEL[r.status] || r.status}</span>
                  </div>
                  <p className="mt-1 truncate text-[13px] text-gray-600 dark:text-gray-300">{r.summary}</p>
                  <p className="mt-2 text-[13px]">
                    받은 견적 <b className="text-brand-text">{r.quote_count}</b> / {r.max_quotes} · {r.desired_date}
                  </p>
                </Link>
                {r.share_token && (
                  <button type="button" onClick={() => shareLifeRequest(r.share_token!, `${categoryLabel(r.category)} 견적 요청`)}
                    className="flex w-full items-center justify-center border-t border-rule py-3 text-[13px] font-medium text-brand-text">
                    아는 업체에 링크 보내기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
