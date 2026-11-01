/** 🏠 내 생활 요청 목록 (2026-10-24). */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { LifeHeader, STATUS_LABEL, categoryLabel } from './life-shared'

interface Row { id: number; category: string; summary: string; desired_date: string; status: string; quote_count: number; max_quotes: number }

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
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title="내 생활 요청 - 유어딜" description="보낸 견적 요청과 받은 견적" url="/life/requests" />
      <LifeHeader title="내 요청" back="/life" />
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
              <li key={r.id}>
                <Link to={`/life/requests/${r.id}`} className="block rounded-2xl bg-surface p-4 shadow-lift">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-bold">{categoryLabel(r.category)}</span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">{STATUS_LABEL[r.status] || r.status}</span>
                  </div>
                  <p className="mt-1 truncate text-[13px] text-gray-600 dark:text-gray-300">{r.summary}</p>
                  <p className="mt-2 text-[13px]">
                    받은 견적 <b className="text-brand-text">{r.quote_count}</b> / {r.max_quotes} · {r.desired_date}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
